const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST']
  }
});

const supabase = require('./supabaseClient');
// Routes
app.use('/api/users', require('./routes/user'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/media', require('./routes/media'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io logic
const onlineUsers = new Map(); // socket.id -> userId
const onlineUsersSet = new Set(); // Set of userIds currently online
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_home', () => {
    socket.join('home_chat');
    console.log(`User ${socket.id} joined home_chat`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { data: savedMsg, error } = await supabase
        .from('messages')
        .insert([{
          room: 'home_chat',
          ...data
        }])
        .select()
        .single();

      if (error) throw error;
      io.to('home_chat').emit('receive_message', savedMsg);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('join_private', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined private room ${room}`);
  });

  socket.on('send_private_message', async (data) => {
    try {
      const { data: savedMsg, error } = await supabase
        .from('messages')
        .insert([{
          room: data.room,
          ...data
        }])
        .select()
        .single();

      if (error) throw error;
      io.to(data.room).emit('receive_private_message', savedMsg);
    } catch (err) {
      console.error('Error saving private message:', err);
    }
  });

  // WebRTC Signaling and Online Status
  socket.on('join_user', (userId) => {
    socket.join(userId);
    console.log(`User socket ${socket.id} joined personal room ${userId}`);
    
    // Track online user
    onlineUsers.set(socket.id, userId);
    onlineUsersSet.add(userId);
    
    // Send current online users to this socket
    socket.emit('online_users', Array.from(onlineUsersSet));
    
    // Broadcast to everyone else that this user is online
    socket.broadcast.emit('user_online', userId);
  });

  socket.on('call_user', (data) => {
    io.to(data.userToCall).emit('call_incoming', { signal: data.signalData, from: data.from, name: data.name });
  });

  socket.on('answer_call', (data) => {
    io.to(data.to).emit('call_accepted', data.signal);
  });

  socket.on('ice_candidate', (data) => {
    io.to(data.to).emit('ice_candidate', { candidate: data.candidate, from: data.from });
  });

  socket.on('end_call', (data) => {
    io.to(data.to).emit('call_ended');
  });

  socket.on('decline_call', (data) => {
    io.to(data.to).emit('call_declined');
  });

  // Clear chat — notify the other user's socket room
  socket.on('clear_chat', (data) => {
    const { room, chatKey, otherUserId } = data;
    // Emit to the private room so other user's client also clears
    io.to(room).emit('chat_cleared', { room, chatKey });
    // Also emit directly to the other user's personal room with their chat key
    if (otherUserId) {
      // The sender's userId is chatKey for the other user, so we need to find sender
      const senderId = onlineUsers.get(socket.id);
      if (senderId) {
        io.to(otherUserId).emit('chat_cleared', { room, chatKey: senderId });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const userId = onlineUsers.get(socket.id);
    if (userId) {
      onlineUsers.delete(socket.id);
      
      // Check if user has other active sockets
      let hasOtherSockets = false;
      for (const [sid, uid] of onlineUsers.entries()) {
        if (uid === userId) {
          hasOtherSockets = true;
          break;
        }
      }
      
      if (!hasOtherSockets) {
        onlineUsersSet.delete(userId);
        io.emit('user_offline', userId);
      }
    }
  });

  socket.on('save_call_history', async (data) => {
    try {
      const supabase = require('./supabaseClient');

      // Insert a message into the chat like WhatsApp
      const { data: callerInfo } = await supabase.from('users').select('username').eq('id', data.caller_id).single();
      const callerUsername = callerInfo ? callerInfo.username : 'Unknown';

      const room = [data.caller_id, data.callee_id].sort().join('_');
      let text = '';
      if (data.status === 'missed') text = '❌ Missed Voice Call';
      else if (data.status === 'declined') text = '❌ Declined Voice Call';
      else {
        const mins = Math.floor(data.duration_seconds / 60);
        const secs = data.duration_seconds % 60;
        const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        text = `📞 Voice Call (${durStr})`;
      }

      const { data: savedMsg, error: msgError } = await supabase.from('messages').insert([{
        room,
        sender: callerUsername,
        senderId: data.caller_id,
        recipientId: data.callee_id,
        text
      }]).select().single();

      if (!msgError && savedMsg) {
        io.to(room).emit('receive_private_message', savedMsg);
      }
    } catch (err) {
      console.error("Error saving call history:", err);
    }
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get(/^.*$/, (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
