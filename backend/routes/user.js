const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const verifyToken = async (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_for_chitchat');
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// Helper function to get populated user
async function getPopulatedUser(userId) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError || !user) return null;

  // Get friends
  const { data: friendLinks } = await supabase
    .from('friends')
    .select('friend_id')
    .eq('user_id', userId);
  
  let friends = [];
  if (friendLinks && friendLinks.length > 0) {
    const friendIds = friendLinks.map(link => link.friend_id);
    const { data: friendsData } = await supabase
      .from('users')
      .select('id, username, email')
      .in('id', friendIds);
    friends = friendsData || [];
  }

  // Get friend requests received
  const { data: requestLinks } = await supabase
    .from('friend_requests')
    .select('sender_id')
    .eq('receiver_id', userId);

  let friendRequests = [];
  if (requestLinks && requestLinks.length > 0) {
    const senderIds = requestLinks.map(link => link.sender_id);
    const { data: requestsData } = await supabase
      .from('users')
      .select('id, username, email')
      .in('id', senderIds);
    friendRequests = requestsData || [];
  }

  return { ...user, friends, friendRequests };
}

// Get the current logged-in user with populated friends and friend requests
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await getPopulatedUser(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Get all users (except current user) - useful for "Discover" tab
router.get('/', verifyToken, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, email, age, gender, profileSongUrl, statusVideoUrl')
      .neq('id', req.user.id);
      
    if (error) throw error;
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Send a friend request
router.post('/friend-request/:id', verifyToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user.id) {
      return res.status(400).json({ msg: "You can't send a friend request to yourself" });
    }

    // Check if target user exists
    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', targetUserId)
      .single();
      
    if (!targetUser) return res.status(404).json({ msg: 'User not found' });

    // Check if already friends
    const { data: existingFriend } = await supabase
      .from('friends')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('friend_id', targetUserId)
      .maybeSingle();

    if (existingFriend) {
      return res.status(400).json({ msg: 'Already friends' });
    }

    // Check if request already sent
    const { data: existingRequest } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('sender_id', req.user.id)
      .eq('receiver_id', targetUserId)
      .maybeSingle();

    if (existingRequest) {
      return res.status(400).json({ msg: 'Friend request already sent' });
    }

    // Insert request
    const { error: insertError } = await supabase
      .from('friend_requests')
      .insert([{ sender_id: req.user.id, receiver_id: targetUserId }]);

    if (insertError) throw insertError;
    
    res.json({ msg: 'Friend request sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Accept a friend request
router.post('/accept-friend/:id', verifyToken, async (req, res) => {
  try {
    const requesterId = req.params.id;
    const currentUserId = req.user.id;

    // Verify the request exists
    const { data: request } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('sender_id', requesterId)
      .eq('receiver_id', currentUserId)
      .maybeSingle();

    if (!request) {
      return res.status(400).json({ msg: 'No pending friend request from this user' });
    }

    // Remove from requests
    await supabase
      .from('friend_requests')
      .delete()
      .eq('sender_id', requesterId)
      .eq('receiver_id', currentUserId);

    // Add to friends for both users
    await supabase
      .from('friends')
      .upsert([
        { user_id: currentUserId, friend_id: requesterId },
        { user_id: requesterId, friend_id: currentUserId }
      ], { onConflict: 'user_id,friend_id' });

    res.json({ msg: 'Friend request accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Reject/Cancel a friend request
router.post('/reject-friend/:id', verifyToken, async (req, res) => {
  try {
    const requesterId = req.params.id;
    const currentUserId = req.user.id;

    // Remove from requests
    await supabase
      .from('friend_requests')
      .delete()
      .eq('sender_id', requesterId)
      .eq('receiver_id', currentUserId);

    res.json({ msg: 'Friend request removed' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Update Profile
router.put('/me', verifyToken, async (req, res) => {
  try {
    const { username, gender, country, birthday } = req.body;
    
    const updates = {};
    if (username) updates.username = username;
    if (gender) updates.gender = gender;
    // We try to update country and birthday. If they don't exist in Supabase, this might throw an error.
    if (country) updates.country = country;
    if (birthday) updates.birthday = birthday;

    const { error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id);

    if (updateError) {
      console.error('Update Error:', updateError);
      return res.status(500).json({ msg: 'Failed to update profile. (Did you add country/birthday to Supabase?)' });
    }

    res.json({ msg: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Change Password
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { newPassword } = req.body;

    // With Supabase Auth, you don't need to verify the old password if they are already authenticated,
    // you can just call updateUser to set the new password.
    const { error: updateError } = await supabase.auth.updateUser(
      { password: newPassword },
      { headers: { Authorization: `Bearer ${req.header('x-auth-token')}` } }
    );

    if (updateError) return res.status(400).json({ msg: updateError.message });

    res.json({ msg: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
