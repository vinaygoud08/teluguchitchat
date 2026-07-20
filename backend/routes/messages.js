const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const jwt = require('jsonwebtoken');

// Middleware to protect route
const auth = async (req, res, next) => {
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

// GET messages for a specific room
router.get('/:room', auth, async (req, res) => {
  try {
    const room = req.params.room;
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room', room)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;
      
    res.json(messages.reverse());
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// DELETE all messages in a room (restart chat)
router.delete('/:room', auth, async (req, res) => {
  try {
    const room = req.params.room;
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('room', room);

    if (error) throw error;
    res.json({ msg: 'Chat cleared successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
