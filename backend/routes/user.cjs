const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient.cjs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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

// Helper function to check if a story is older than 24 hours
function isStoryExpired(statusVideoUrl) {
  if (!statusVideoUrl) return false;
  const match = statusVideoUrl.match(/profile_status_(\d+)/);
  if (match && match[1]) {
    const uploadTime = parseInt(match[1], 10);
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (Date.now() - uploadTime > TWENTY_FOUR_HOURS) {
      return true;
    }
  }
  return false;
}

// Helper function to get populated user
async function getPopulatedUser(userId) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, username, email, age, gender, profileSongUrl, statusVideoUrl, birthday, country, phone_number, is_verified, created_at, hidden_story_from')
    .eq('id', userId)
    .single();

  if (userError || !user) return null;

  // Check if own story is expired (24 hours)
  if (user.statusVideoUrl && isStoryExpired(user.statusVideoUrl)) {
    user.statusVideoUrl = null;
    supabase.from('users').update({ statusVideoUrl: null, story_views: [] }).eq('id', userId).then(() => {}).catch(() => {});
  }

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
      .select('id, username, email, statusVideoUrl, profileSongUrl, hidden_story_from')
      .in('id', friendIds);
    
    // Filter out stories if this user is in their hidden_story_from array or if story is older than 24 hours
    friends = (friendsData || []).map(f => {
      const hiddenFrom = f.hidden_story_from || [];
      const expired = isStoryExpired(f.statusVideoUrl);
      if (expired) {
        supabase.from('users').update({ statusVideoUrl: null, story_views: [] }).eq('id', f.id).then(() => {}).catch(() => {});
      }
      if (hiddenFrom.includes(userId) || expired) {
        return { ...f, statusVideoUrl: null }; // Hide or expired story
      }
      return f;
    });
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

    const sanitizedUsers = (users || []).map(u => {
      if (isStoryExpired(u.statusVideoUrl)) {
        return { ...u, statusVideoUrl: null };
      }
      return u;
    });

    res.json(sanitizedUsers);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Get single user full profile details
router.get('/profile/:id', verifyToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, age, gender, country, birthday, profileSongUrl, statusVideoUrl, created_at')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (isStoryExpired(user.statusVideoUrl)) {
      user.statusVideoUrl = null;
    }

    res.json(user);
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

// Update Profile
router.put('/me', verifyToken, async (req, res) => {
  try {
    const { username, gender, country, birthday, phone_number, hidden_story_from } = req.body;
    
    const updates = {};
    if (username) updates.username = username;
    if (gender) updates.gender = gender;
    if (phone_number !== undefined) updates.phone_number = phone_number === '' ? null : phone_number;
    if (hidden_story_from !== undefined) updates.hidden_story_from = hidden_story_from;
    
    if (country !== undefined) updates.country = country;
    if (birthday !== undefined) {
      updates.birthday = birthday === '' ? null : birthday;
      updates.age = calculateAge(birthday);
    }

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
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters long' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', req.user.id);

    if (updateError) {
      console.error('Password Update Error:', updateError);
      return res.status(500).json({ msg: 'Failed to update password' });
    }

    // Also sync to Supabase Auth admin if possible
    try {
      await supabase.auth.admin.updateUserById(req.user.id, { password: newPassword });
    } catch (authSyncErr) {
      console.warn('Supabase auth password sync warning:', authSyncErr.message);
    }

    res.json({ msg: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).send('Server error');
  }
});

// Record a view for a target user's story
router.post('/story-view/:targetUserId', verifyToken, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) return res.json({ msg: 'Own story' });

    // Fetch the target user's story views
    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('story_views')
      .eq('id', targetUserId)
      .single();
    
    if (fetchError) throw fetchError;

    const views = targetUser?.story_views || [];
    
    // If we haven't already viewed it, add our ID
    if (!views.includes(currentUserId)) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ story_views: [...views, currentUserId] })
        .eq('id', targetUserId);
      if (updateError) throw updateError;
    }

    res.json({ msg: 'View recorded' });
  } catch (err) {
    console.error('Record story view error:', err);
    res.status(500).send('Server error');
  }
});

// Get Story Views for the logged-in user
router.get('/story-views', verifyToken, async (req, res) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('story_views')
      .eq('id', req.user.id)
      .single();
    
    if (userError) throw userError;

    const viewerIds = user?.story_views || [];
    if (viewerIds.length === 0) return res.json([]);

    const { data: viewers, error: viewersError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', viewerIds);

    if (viewersError) throw viewersError;
    res.json(viewers || []);
  } catch (err) {
    console.error('Get story views error:', err);
    res.status(500).send('Server error');
  }
});



// Save public key
router.put('/public-key', verifyToken, async (req, res) => {
  try {
    const { public_key } = req.body;
    
    const { error } = await supabase
      .from('users')
      .update({ public_key })
      .eq('id', req.user.id);
      
    if (error) {
      // Column might not exist in database, return success to prevent frontend console errors
      return res.json({ msg: 'Public key ignored (column not configured in DB)' });
    }
    
    res.json({ msg: 'Public key saved successfully' });
  } catch (err) {
    res.json({ msg: 'Public key ignored' });
  }
});

// Delete Account
router.delete('/me', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('password')
      .eq('id', req.user.id)
      .single();

    if (profileError || !userProfile) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (userProfile.password !== 'handled_by_guest_auth') {
      if (!password) {
        return res.status(400).json({ msg: 'Password is required to delete your account' });
      }
      const isMatch = await bcrypt.compare(password, userProfile.password);
      if (!isMatch) {
        return res.status(400).json({ msg: 'Incorrect password' });
      }
    }

    const { error } = await supabase.from('users').delete().eq('id', req.user.id);
    if (error) {
      console.error('Delete Error:', error);
      return res.status(500).json({ msg: 'Failed to delete account.' });
    }

    try {
      await supabase.auth.admin.deleteUser(req.user.id);
    } catch (authDelErr) {
      console.warn('Supabase Auth user delete error:', authDelErr);
    }

    res.json({ msg: 'Account deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
