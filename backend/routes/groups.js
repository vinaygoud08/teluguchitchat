const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const jwt = require('jsonwebtoken');

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

// Create a new group
router.post('/create', verifyToken, async (req, res) => {
  const { name, description, memberIds } = req.body;
  
  if (!name) return res.status(400).json({ msg: 'Group name is required' });

  try {
    // 1. Create the group
    const { data: newGroup, error: groupError } = await supabase
      .from('groups')
      .insert([{ name, description, created_by: req.user.id }])
      .select()
      .single();

    if (groupError) throw groupError;

    // 2. Add creator and selected members to group_members
    const membersToInsert = [
      { group_id: newGroup.id, user_id: req.user.id, role: 'admin' }
    ];

    if (memberIds && Array.isArray(memberIds)) {
      memberIds.forEach(id => {
        if (id !== req.user.id) {
          membersToInsert.push({ group_id: newGroup.id, user_id: id, role: 'member' });
        }
      });
    }

    const { error: membersError } = await supabase
      .from('group_members')
      .insert(membersToInsert);

    if (membersError) throw membersError;

    // Insert system message
    await supabase.from('messages').insert([{
      room: newGroup.id,
      sender: req.user.username,
      senderId: req.user.id,
      text: `📢 ${req.user.username} created the group "${name}".`
    }]);

    // Notify other members in real-time
    const io = req.app.get('io');
    if (io && memberIds && Array.isArray(memberIds)) {
      memberIds.forEach(id => {
        if (id !== req.user.id) {
          io.to(id).emit('added_to_group', newGroup);
        }
      });
    }

    res.json(newGroup);
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Get user's groups
router.get('/my-groups', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        group_id,
        role,
        groups (
          id, name, description, avatar_url, created_at, created_by
        )
      `)
      .eq('user_id', req.user.id);

    if (error) throw error;

    const groups = data.map(gm => ({
      ...gm.groups,
      myRole: gm.role
    }));

    res.json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Get group members
router.get('/:id/members', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        user_id, role, joined_at,
        users ( id, username, email )
      `)
      .eq('group_id', req.params.id);

    if (error) throw error;
    
    res.json(data.map(m => ({ ...m.users, role: m.role, joined_at: m.joined_at })));
  } catch (err) {
    console.error('Error fetching group members:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Get group messages
router.get('/:id/messages', verifyToken, async (req, res) => {
  try {
    // Check if user is in the group first (for security)
    const { data: memberData, error: memberError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (memberError || !memberData) {
      return res.status(403).json({ msg: 'Not a member of this group' });
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room', req.params.id)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching group messages:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
