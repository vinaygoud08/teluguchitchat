const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient.cjs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email.cjs');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ user: { id: userId } }, process.env.JWT_SECRET || 'supersecretkey_for_chitchat', {
    expiresIn: '7d',
  });
};

// Helper to calculate age
const calculateAge = (birthdayString) => {
  if (!birthdayString) return null;
  const today = new Date();
  const birthDate = new Date(birthdayString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, birthday, gender, country, age: providedAge } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: 'Please provide email and password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const calculatedAge = calculateAge(birthday) ?? (providedAge ? parseInt(providedAge) : null);

    if (calculatedAge !== null && calculatedAge < 18) {
      return res.status(400).json({ msg: 'You must be at least 18 years old to register.' });
    }

    // Check if user exists in public.users
    const { data: existingUsers, error: checkErr } = await supabase
      .from('users')
      .select('id, email, username')
      .ilike('email', cleanEmail)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ msg: 'An account with this email already exists. Please log in.' });
    }

    let finalUsername = username ? String(username).trim() : '';
    if (!finalUsername) {
      const base = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      finalUsername = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // 1. Create User in Supabase Authentication (auth.users)
    let authUserId = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: {
          username: finalUsername,
          gender: gender || 'Other',
          age: calculatedAge,
          country: country || null
        }
      });

      if (authError) {
        console.warn('Supabase Auth createUser notice:', authError.message);
        if (authError.message && (authError.message.includes('already') || authError.message.includes('exists'))) {
          const { data: listData } = await supabase.auth.admin.listUsers();
          const found = (listData?.users || []).find(u => u.email?.toLowerCase() === cleanEmail);
          if (found) {
            authUserId = found.id;
          }
        }
      } else if (authData && authData.user) {
        authUserId = authData.user.id;
      }
    } catch (authErr) {
      console.warn('Supabase auth admin call notice:', authErr.message);
    }

    // 2. Hash password for local database verification
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(password), salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const finalUserId = authUserId || crypto.randomUUID();

    // 3. Create user profile in public.users table
    const newUser = {
      id: finalUserId,
      username: finalUsername,
      email: cleanEmail,
      password: hashedPassword,
      age: calculatedAge,
      birthday: birthday || null,
      country: country || null,
      gender: gender || 'Other',
      is_verified: true, // Auto-verified
      verification_token: verificationToken
    };

    const { error: insertError } = await supabase
      .from('users')
      .insert([newUser]);

    if (insertError) {
      console.error('Profile Insert Error:', insertError);
      return res.status(500).json({ msg: 'Database error saving user profile: ' + (insertError.message || '') });
    }

    // Send optional verification / welcome email asynchronously
    try {
      sendVerificationEmail(cleanEmail, verificationToken).catch(err => {
        console.warn('Welcome email skipped:', err.message);
      });
    } catch (e) {}

    // Generate JWT token for instant smooth login
    const token = generateToken(finalUserId);

    res.status(201).json({ 
      msg: 'Registration successful!',
      token,
      user: {
        id: finalUserId,
        username: finalUsername,
        email: cleanEmail
      }
    });
  } catch (err) {
    console.error('Registration Exception:', err);
    res.status(500).json({ msg: err.message || 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({ msg: 'Please enter your Email or User ID and Password.' });
    }

    const cleanLoginId = String(loginId).trim();
    const cleanPassword = String(password);
    const isEmail = cleanLoginId.includes('@');

    // 1. Fetch user by email or username (case-insensitive) using limit(1) to avoid multi-row exceptions
    let query = supabase.from('users').select('*');
    if (isEmail) {
      query = query.ilike('email', cleanLoginId);
    } else {
      query = query.ilike('username', cleanLoginId);
    }

    const { data: userProfiles, error: profileError } = await query.limit(1);

    if (profileError) {
      console.error('Supabase query error:', profileError);
      return res.status(500).json({ msg: 'Database error querying account profile: ' + (profileError.message || '') });
    }

    let userProfile = userProfiles && userProfiles.length > 0 ? userProfiles[0] : null;

    // 2. If not found in public.users, check if user exists in Supabase auth.users
    if (!userProfile && isEmail) {
      try {
        const { data: listData } = await supabase.auth.admin.listUsers();
        const foundAuthUser = (listData?.users || []).find(u => u.email?.toLowerCase() === cleanLoginId.toLowerCase());
        if (foundAuthUser) {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(cleanPassword, salt);
          const newPublicUser = {
            id: foundAuthUser.id,
            username: foundAuthUser.user_metadata?.username || cleanLoginId.split('@')[0],
            email: foundAuthUser.email,
            password: hashedPassword,
            gender: foundAuthUser.user_metadata?.gender || 'Other',
            is_verified: true
          };
          const { error: syncInsertErr } = await supabase.from('users').insert([newPublicUser]);
          if (!syncInsertErr) {
            userProfile = newPublicUser;
          }
        }
      } catch (authFindErr) {
        console.warn('Auth sync lookup error:', authFindErr.message);
      }
    }

    if (!userProfile) {
      return res.status(400).json({ msg: 'No account found with this Email or User ID. Please check your credentials or create an account.' });
    }

    // 3. Compare password with local bcrypt (exact, uppercase, lowercase, trimmed)
    let isMatch = false;
    if (userProfile.password && userProfile.password !== 'handled_by_supabase_auth' && userProfile.password !== 'handled_by_guest_auth') {
      try {
        isMatch = await bcrypt.compare(cleanPassword, userProfile.password);
        
        if (!isMatch) {
          isMatch = await bcrypt.compare(cleanPassword.toUpperCase(), userProfile.password);
        }
        if (!isMatch) {
          isMatch = await bcrypt.compare(cleanPassword.toLowerCase(), userProfile.password);
        }
        if (!isMatch && cleanPassword.trim() !== cleanPassword) {
          isMatch = await bcrypt.compare(cleanPassword.trim(), userProfile.password);
        }
      } catch (bcryptErr) {
        console.warn("Bcrypt comparison notice:", bcryptErr.message);
      }
    }

    // 4. If bcrypt comparison did not match, try Supabase Auth sign-in as fallback
    if (!isMatch && userProfile.email) {
      try {
        const { data: authSignInData, error: authSignInErr } = await supabase.auth.signInWithPassword({
          email: userProfile.email,
          password: cleanPassword
        });

        if (!authSignInErr && authSignInData?.user) {
          isMatch = true;
          // Sync new bcrypt hash back to public.users table
          try {
            const salt = await bcrypt.genSalt(10);
            const newHashedPassword = await bcrypt.hash(cleanPassword, salt);
            await supabase.from('users').update({ password: newHashedPassword, is_verified: true }).eq('id', userProfile.id);
          } catch (syncErr) {
            console.warn('Password hash sync error:', syncErr.message);
          }
        }
      } catch (supabaseAuthErr) {
        console.warn('Supabase Auth signIn fallback error:', supabaseAuthErr.message);
      }
    }

    if (!isMatch) {
      return res.status(400).json({ msg: 'Incorrect password. Please verify your password or use Forgot Password.' });
    }

    // 5. Generate Token
    const token = generateToken(userProfile.id);

    // Return the custom JWT and the user profile
    res.json({ 
      token, 
      user: { 
        id: userProfile.id, 
        username: userProfile.username, 
        email: userProfile.email 
      } 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: 'Server error during login: ' + (err.message || 'Internal error') });
  }
});

// Guest Login
router.post('/guest-login', async (req, res) => {
  try {
    const { name, age, gender } = req.body;
    
    // Basic validation
    if (age && parseInt(age) < 18) {
      return res.status(400).json({ msg: 'You must be at least 18 years old to proceed as a guest.' });
    }

    const guestId = crypto.randomUUID();
    const cleanName = (name || 'Guest').replace(/[^a-zA-Z0-9]/g, '');
    const guestUsername = `${cleanName}_${Math.floor(1000 + Math.random() * 9000)}`;
    const guestEmail = `${guestUsername.toLowerCase()}@guest.local`;

    const newUser = {
      id: guestId,
      username: guestUsername,
      email: guestEmail,
      password: 'handled_by_guest_auth', // dummy password
      age: age ? parseInt(age) : null,
      gender: gender || 'Other',
      is_verified: true, // Guests don't need email verification
    };

    const { error: insertError } = await supabase
      .from('users')
      .insert([newUser]);

    if (insertError) {
      console.error('Guest Insert Error:', insertError);
      return res.status(500).json({ msg: 'Server error creating guest user.' });
    }

    const token = generateToken(guestId);

    res.json({ 
      token, 
      user: { 
        id: guestId, 
        username: guestUsername, 
        email: guestEmail 
      } 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return res.json({ msg: 'If that email is registered, a password reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

    const { error: updateError } = await supabase
      .from('users')
      .update({ reset_token: resetToken, reset_token_expiry: resetTokenExpiry })
      .eq('id', user.id);

    if (updateError) {
      console.error('Reset Token Update Error:', updateError.message);
      return res.status(500).json({ msg: 'Server error' });
    }

    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      return res.status(500).json({ msg: 'Failed to send reset email' });
    }

    res.json({ msg: 'If that email is registered, a password reset link has been sent.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, reset_token_expiry')
      .eq('reset_token', token)
      .maybeSingle();

    if (error || !user) {
      return res.status(400).json({ msg: 'Invalid or expired reset token' });
    }

    // Check expiry
    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ msg: 'Reset token has expired' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password: hashedPassword, 
        reset_token: null, 
        reset_token_expiry: null 
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Update Password Error:', updateError.message);
      return res.status(500).json({ msg: 'Server error' });
    }

    // Sync new password to Supabase Auth admin
    try {
      await supabase.auth.admin.updateUserById(user.id, { password: password });
    } catch (authSyncErr) {
      console.warn('Supabase auth password update error:', authSyncErr);
    }

    res.json({ msg: 'Password successfully reset. You can now log in.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
