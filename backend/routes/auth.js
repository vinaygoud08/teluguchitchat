const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ user: { id: userId } }, process.env.JWT_SECRET || 'supersecretkey_for_chitchat', {
    expiresIn: '7d',
  });
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, age, gender } = req.body;

    if (age && parseInt(age) < 18) {
      return res.status(400).json({ msg: 'You must be at least 18 years old to register.' });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const newUser = {
      id: crypto.randomUUID(), // Generate UUID for the user
      username,
      email,
      password: hashedPassword,
      age: age ? parseInt(age) : null,
      gender,
      is_verified: false,
      verification_token: verificationToken
    };

    const { error: insertError } = await supabase
      .from('users')
      .insert([newUser]);

    if (insertError) {
      console.error('Profile Insert Error:', insertError);
      return res.status(500).json({ msg: 'Server error saving profile data.' });
    }

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Still succeed the registration, but maybe warn
    }

    res.status(201).json({ msg: 'Registration successful! Please check your email to verify your account.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: err.message || 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;

    // 1. Fetch user by email or username
    const isEmail = loginId && loginId.includes('@');
    let query = supabase.from('users').select('*');
    if (isEmail) {
      query = query.eq('email', loginId);
    } else {
      query = query.eq('username', loginId);
    }

    const { data: userProfile, error: profileError } = await query.maybeSingle();

    if (profileError || !userProfile) {
      return res.status(400).json({ msg: 'Invalid login credentials' });
    }

    // 2. Compare password
    // Some legacy users might have 'handled_by_supabase_auth' if they were created during the Supabase transition.
    // If they do, they can't login via custom auth unless they reset password.
    if (userProfile.password === 'handled_by_supabase_auth') {
      return res.status(400).json({ msg: 'Please reset your password using the Forgot Password link to migrate your account.' });
    }

    const isMatch = await bcrypt.compare(password, userProfile.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid login credentials' });
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
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
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

    res.json({ msg: 'Password successfully reset. You can now log in.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
