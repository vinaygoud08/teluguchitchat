const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

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
    const { username, email, password, birthday, gender, country } = req.body;

    const age = calculateAge(birthday);

    if (age !== null && age < 18) {
      return res.status(400).json({ msg: 'You must be at least 18 years old to register.' });
    }

    // Check if user exists in public.users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ msg: 'User with this email already exists' });
    }

    // 1. Create User in Supabase Authentication (auth.users)
    let authUserId = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          username: username,
          gender: gender,
          age: age,
          country: country
        }
      });

      if (authError) {
        console.warn('Supabase Auth createUser warning:', authError.message);
        if (authError.message && (authError.message.includes('already') || authError.message.includes('exists'))) {
          // If already in auth.users, check if we can retrieve the user id
          const { data: listData } = await supabase.auth.admin.listUsers();
          const found = (listData?.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (found) {
            authUserId = found.id;
          } else {
            return res.status(400).json({ msg: 'User with this email is already registered in Authentication.' });
          }
        }
      } else if (authData && authData.user) {
        authUserId = authData.user.id;
      }
    } catch (authErr) {
      console.error('Error creating user in Supabase auth:', authErr);
    }

    // 2. Hash password for local authentication verification
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const finalUserId = authUserId || crypto.randomUUID();

    // 3. Create user profile in public.users table
    const newUser = {
      id: finalUserId,
      username,
      email,
      password: hashedPassword,
      age: age,
      birthday: birthday || null,
      country: country || null,
      gender,
      is_verified: true, // Auto-verified since auth user was created
      verification_token: verificationToken
    };

    const { error: insertError } = await supabase
      .from('users')
      .insert([newUser]);

    if (insertError) {
      console.error('Profile Insert Error:', insertError);
      return res.status(500).json({ msg: 'Server error saving profile data.' });
    }

    // Send optional verification / welcome email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    res.status(201).json({ msg: 'Registration successful! You can now log in.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({ msg: 'Please provide email/username and password' });
    }

    const cleanLoginId = String(loginId).trim();
    const cleanPassword = String(password);

    // 1. Fetch user by email or username (case-insensitive)
    const isEmail = cleanLoginId.includes('@');
    let query = supabase.from('users').select('*');
    if (isEmail) {
      query = query.ilike('email', cleanLoginId);
    } else {
      query = query.ilike('username', cleanLoginId);
    }

    const { data: userProfile, error: profileError } = await query.maybeSingle();

    if (profileError) {
      console.error('Supabase query error:', profileError);
      return res.status(500).json({ msg: 'Database error querying account profile' });
    }

    if (!userProfile) {
      return res.status(400).json({ msg: 'Invalid login credentials (Account not found)' });
    }

    // 2. Compare password with case-insensitive fallback
    // Some legacy users might have 'handled_by_supabase_auth' if they were created during the Supabase transition.
    if (userProfile.password === 'handled_by_supabase_auth') {
      return res.status(400).json({ msg: 'Please reset your password using the Forgot Password link to migrate your account.' });
    }

    let isMatch = false;
    let matchedPassword = cleanPassword;
    try {
      // First try exact password
      isMatch = await bcrypt.compare(cleanPassword, userProfile.password);
      
      // Fallback 1: Uppercase (e.g. VINNU.54 when user typed vinnu.54)
      if (!isMatch) {
        isMatch = await bcrypt.compare(cleanPassword.toUpperCase(), userProfile.password);
        if (isMatch) matchedPassword = cleanPassword.toUpperCase();
      }

      // Fallback 2: Lowercase (e.g. vinnu.54 when user typed VINNU.54)
      if (!isMatch) {
        isMatch = await bcrypt.compare(cleanPassword.toLowerCase(), userProfile.password);
        if (isMatch) matchedPassword = cleanPassword.toLowerCase();
      }

      // Fallback 3: Trimmed password
      if (!isMatch && cleanPassword.trim() !== cleanPassword) {
        isMatch = await bcrypt.compare(cleanPassword.trim(), userProfile.password);
        if (isMatch) matchedPassword = cleanPassword.trim();
      }
    } catch (bcryptErr) {
      console.warn("Bcrypt comparison error:", bcryptErr);
    }

    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid password. Please check your password.' });
    }

    // 3. Generate Token
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
    console.error('Login error:', err.message);
    res.status(500).json({ msg: 'Server error during login' });
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
