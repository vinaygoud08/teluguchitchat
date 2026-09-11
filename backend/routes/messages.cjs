const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient.cjs');
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

// GET latest message/timestamp for each user conversation
router.get('/recent/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, room, senderId, recipientId, timestamp, text, imageUrl, gifUrl, stickerUrl, fileUrl')
      .or(`senderId.eq.${userId},recipientId.eq.${userId}`)
      .order('timestamp', { ascending: false })
      .limit(300);

    if (error) {
      console.error('Error fetching recent messages:', error);
      return res.json({});
    }

    const latestByOtherUser = {};
    (messages || []).forEach(msg => {
      let otherUserId = null;
      if (msg.senderId === userId && msg.recipientId) {
        otherUserId = msg.recipientId;
      } else if (msg.recipientId === userId && msg.senderId) {
        otherUserId = msg.senderId;
      } else if (msg.room && msg.room.includes('_') && !msg.room.startsWith('stranger_') && msg.room !== 'home_chat') {
        const parts = msg.room.split('_');
        if (parts.length === 2) {
          otherUserId = parts[0] === userId ? parts[1] : parts[0];
        }
      }

      if (otherUserId && !latestByOtherUser[otherUserId]) {
        latestByOtherUser[otherUserId] = {
          lastMessageTime: msg.timestamp,
          lastMessageText: msg.text || (msg.imageUrl ? '📷 Photo' : (msg.fileUrl ? '📁 File' : (msg.stickerUrl ? '🎨 Sticker' : 'Message')))
        };
      }
    });

    res.json(latestByOtherUser);
  } catch (err) {
    console.error('Error in recent conversations:', err);
    res.json({});
  }
});

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
