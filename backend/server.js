const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const supabase = require('./supabaseClient');

// Make io accessible in routes
app.set('io', io);

// Routes
app.use('/api/users', require('./routes/user'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/media', require('./routes/media'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/version', require('./routes/version'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io logic
const onlineUsers = new Map(); // socket.id -> userId
const onlineUsersSet = new Set(); // Set of userIds currently online
let strangerQueue = []; // Array of { socketId, userId }
const activeGroupCalls = new Map(); // groupId -> { groupId, groupName, callType, initiator: { id, username }, participants: Map(userId -> { id, username, socketId }) }

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_home', () => {
    socket.join('home_chat');
    console.log(`User ${socket.id} joined home_chat`);
  });

  socket.on('send_message', async (data) => {
    try {
      const msgData = {
        room: 'home_chat',
        sender: data.sender,
        senderId: data.senderId,
        text: data.text || '',
        imageUrl: data.imageUrl || null,
        gifUrl: data.gifUrl || null,
        stickerUrl: data.stickerUrl || null,
        fileUrl: data.fileUrl || null,
        fileType: data.fileType || null
      };

      const { data: savedMsg, error } = await supabase
        .from('messages')
        .insert([msgData])
        .select()
        .single();

      if (error) {
        console.error('Error saving home message:', error);
        // Fallback: emit message with temporary id so chat still works
        io.to('home_chat').emit('receive_message', { ...data, id: Date.now().toString(), timestamp: new Date().toISOString() });
        return;
      }
      io.to('home_chat').emit('receive_message', { ...savedMsg, ...data });
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('join_private', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined private room ${room}`);
  });

  socket.on('join_group', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined group room ${room}`);
  });

  socket.on('send_private_message', async (data) => {
    try {
      if (data.room && data.room.startsWith('stranger_')) {
        // Ephemeral chat, don't save to DB
        io.to(data.room).emit('receive_private_message', data);
        return;
      }

      const msgData = {
        room: data.room,
        sender: data.sender,
        senderId: data.senderId,
        recipientId: data.recipientId,
        text: data.text || '',
        imageUrl: data.imageUrl || null,
        gifUrl: data.gifUrl || null,
        stickerUrl: data.stickerUrl || null,
        fileUrl: data.fileUrl || null,
        fileType: data.fileType || null
      };

      const { data: savedMsg, error } = await supabase
        .from('messages')
        .insert([msgData])
        .select()
        .single();

      if (error) {
        console.error('Error saving private message:', error);
        // Fallback emit so chat stays responsive
        io.to(data.room).emit('receive_private_message', { ...data, id: Date.now().toString(), timestamp: new Date().toISOString() });
        return;
      }
      
      // Pass along ephemeral metadata (e.g. viewOnce, reply_to) in the socket event
      io.to(data.room).emit('receive_private_message', { ...savedMsg, ...data });
    } catch (err) {
      console.error('Error saving private message:', err);
    }
  });

  socket.on('send_group_message', async (data) => {
    try {
      const msgData = {
        room: data.room,
        sender: data.sender,
        senderId: data.senderId,
        text: data.text || '',
        imageUrl: data.imageUrl || null,
        gifUrl: data.gifUrl || null,
        stickerUrl: data.stickerUrl || null,
        fileUrl: data.fileUrl || null,
        fileType: data.fileType || null
      };

      const { data: savedMsg, error } = await supabase
        .from('messages')
        .insert([msgData])
        .select()
        .single();

      if (error) {
        console.error('Error saving group message:', error);
        // Fallback emit so group chat stays responsive
        io.to(data.room).emit('receive_group_message', { ...data, id: Date.now().toString(), timestamp: new Date().toISOString() });
        return;
      }
      io.to(data.room).emit('receive_group_message', { ...savedMsg, ...data });
    } catch (err) {
      console.error('Error saving group message:', err);
    }
  });

  socket.on('delete_message', async (data) => {
    try {
      if (data.messageId) {
        await supabase.from('messages').delete().eq('id', data.messageId).catch(() => {});
        if (data.room) {
          io.to(data.room).emit('message_deleted', { messageId: data.messageId });
        }
        if (data.otherUserId) {
          io.to(data.otherUserId).emit('message_deleted', { messageId: data.messageId });
        }
        socket.emit('message_deleted', { messageId: data.messageId });
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  });

  socket.on('pin_message', async (data) => {
    try {
      if (data.messageId) {
        const isPinned = !data.unpin;
        await supabase.from('messages').update({ is_pinned: isPinned }).eq('id', data.messageId).catch(() => {});
        const roomKey = data.roomKey || data.room;
        if (data.room) {
          io.to(data.room).emit('message_pinned', { messageId: data.messageId, isPinned, roomKey });
        }
        if (data.otherUserId) {
          io.to(data.otherUserId).emit('message_pinned', { messageId: data.messageId, isPinned, roomKey });
        }
        socket.emit('message_pinned', { messageId: data.messageId, isPinned, roomKey });
      }
    } catch (err) {
      console.error('Error pinning message:', err);
    }
  });

  // WebRTC Signaling and Online Status
  socket.on('join_user', async (userId) => {
    socket.join(userId);
    console.log(`User socket ${socket.id} joined personal room ${userId}`);
    
    // Track online user
    onlineUsers.set(socket.id, userId);
    onlineUsersSet.add(userId);
    
    try {
      // Get friends of the user
      const { data: friendLinks } = await supabase
        .from('friends')
        .select('friend_id')
        .eq('user_id', userId);
        
      const friendIds = friendLinks ? friendLinks.map(link => link.friend_id) : [];
      
      // Calculate which friends are online
      const onlineFriends = friendIds.filter(fId => onlineUsersSet.has(fId));
      
      // Send current online *friends* to this socket
      socket.emit('online_users', onlineFriends);
      
      // Notify only online *friends* that this user is online
      for (const friendId of onlineFriends) {
        io.to(friendId).emit('user_online', userId);
      }

      // Join all group rooms the user is part of
      const { data: groupMembers } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);
        
      if (groupMembers) {
        groupMembers.forEach(gm => {
          socket.join(gm.group_id);
          console.log(`User socket ${socket.id} joined group room ${gm.group_id}`);
        });
      }
    } catch (err) {
      console.error('Error fetching friends/groups for online status:', err);
      socket.emit('online_users', []);
    }
  });

  socket.on('call_user', (data) => {
    console.log(`[call_user] from: ${data.from} to: ${data.userToCall}`);
    io.to(data.userToCall).emit('call_incoming', { 
      signal: data.signalData, 
      from: data.from, 
      name: data.name,
      callType: data.callType 
    });
  });

  socket.on('answer_call', (data) => {
    console.log(`[answer_call] to: ${data.to}`);
    io.to(data.to).emit('call_accepted', data.signal);
  });

  socket.on('ice_candidate', (data) => {
    console.log(`[ice_candidate] from: ${data.from} to: ${data.to}`);
    io.to(data.to).emit('ice_candidate', { candidate: data.candidate, from: data.from });
  });

  socket.on('end_call', (data) => {
    console.log(`[end_call] to: ${data.to}`);
    io.to(data.to).emit('call_ended');
  });

  socket.on('decline_call', (data) => {
    io.to(data.to).emit('call_declined');
  });

  // ================= GROUP CALL SIGNALING =================
  socket.on('join_group_call', (data) => {
    const { groupId, groupName, user, callType } = data;
    if (!groupId || !user) return;

    const callRoom = 'group_call_' + groupId;
    socket.join(callRoom);

    let call = activeGroupCalls.get(groupId);
    if (!call) {
      call = {
        groupId,
        groupName: groupName || 'Group Call',
        callType: callType || 'video',
        initiator: { id: user.id || user._id, username: user.username },
        participants: new Map(),
        startedAt: new Date().toISOString()
      };
      activeGroupCalls.set(groupId, call);
    }

    const userId = user.id || user._id;
    const existingParticipants = Array.from(call.participants.values()).filter(p => p.userId !== userId);

    call.participants.set(userId, {
      userId,
      username: user.username,
      socketId: socket.id,
      callType: callType || call.callType
    });

    console.log(`[Group Call] User ${user.username} (${socket.id}) joined group call ${groupId}. Total participants: ${call.participants.size}`);

    // Send existing participants to the joiner
    socket.emit('group_call_joined', {
      groupId,
      groupName: call.groupName,
      callType: call.callType,
      initiator: call.initiator,
      participants: existingParticipants
    });

    // Notify other participants in the call room
    socket.to(callRoom).emit('group_call_user_joined', {
      userId,
      username: user.username,
      socketId: socket.id,
      callType: callType || call.callType
    });

    // Notify all members of this group that an active group call is in progress
    io.to(groupId).emit('group_call_status_update', {
      groupId,
      groupName: call.groupName,
      callType: call.callType,
      initiator: call.initiator,
      isActive: true,
      participantsCount: call.participants.size
    });
  });

  socket.on('group_call_signal', (data) => {
    const { toSocketId, fromUserId, fromUsername, signal, callType, groupId } = data;
    if (toSocketId) {
      io.to(toSocketId).emit('group_call_signal', {
        fromSocketId: socket.id,
        fromUserId,
        fromUsername,
        signal,
        callType,
        groupId
      });
    }
  });

  socket.on('group_call_ice_candidate', (data) => {
    const { toSocketId, fromUserId, candidate, groupId } = data;
    if (toSocketId) {
      io.to(toSocketId).emit('group_call_ice_candidate', {
        fromSocketId: socket.id,
        fromUserId,
        candidate,
        groupId
      });
    }
  });

  socket.on('leave_group_call', (data) => {
    const { groupId, userId } = data;
    const uid = userId || onlineUsers.get(socket.id);
    if (!groupId || !uid) return;

    const callRoom = 'group_call_' + groupId;
    socket.leave(callRoom);

    const call = activeGroupCalls.get(groupId);
    if (call) {
      call.participants.delete(uid);
      console.log(`[Group Call] User ${uid} left group call ${groupId}. Remaining: ${call.participants.size}`);

      io.to(callRoom).emit('group_call_user_left', {
        userId: uid,
        socketId: socket.id
      });

      if (call.participants.size === 0) {
        activeGroupCalls.delete(groupId);
        io.to(groupId).emit('group_call_ended', { groupId });
        io.to(groupId).emit('group_call_status_update', {
          groupId,
          isActive: false,
          participantsCount: 0
        });
      } else {
        io.to(groupId).emit('group_call_status_update', {
          groupId,
          groupName: call.groupName,
          callType: call.callType,
          initiator: call.initiator,
          isActive: true,
          participantsCount: call.participants.size
        });
      }
    }
  });

  socket.on('get_active_group_calls', () => {
    const activeCallsList = [];
    for (const [groupId, call] of activeGroupCalls.entries()) {
      if (call.participants.size > 0) {
        activeCallsList.push({
          groupId,
          groupName: call.groupName,
          callType: call.callType,
          initiator: call.initiator,
          participantsCount: call.participants.size
        });
      }
    }
    socket.emit('active_group_calls_list', activeCallsList);
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

  socket.on('send_friend_request', (data) => {
    io.to(data.targetId).emit('receive_friend_request', { from: data.senderId });
  });

  // Anonymous Matchmaking
  socket.on('find_stranger', (userId) => {
    // Check if user is already in queue
    const existingIndex = strangerQueue.findIndex(u => u.userId === userId || u.socketId === socket.id);
    if (existingIndex !== -1) return;

    // Check if anyone else is waiting
    if (strangerQueue.length > 0) {
      const match = strangerQueue.shift(); // Get the first person in queue
      // Create a unique room for them
      const roomId = 'stranger_' + match.userId + '_' + userId + '_' + Date.now();
      
      // Join both sockets to the new room
      socket.join(roomId);
      const matchSocket = io.sockets.sockets.get(match.socketId);
      if (matchSocket) {
        matchSocket.join(roomId);
      }

      // Notify both
      io.to(socket.id).emit('stranger_match', { room: roomId, otherUserId: match.userId });
      io.to(match.socketId).emit('stranger_match', { room: roomId, otherUserId: userId });
    } else {
      strangerQueue.push({ socketId: socket.id, userId });
    }
  });

  socket.on('leave_stranger_queue', () => {
    strangerQueue = strangerQueue.filter(u => u.socketId !== socket.id);
  });

  socket.on('leave_stranger_room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('stranger_left');
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from stranger queue if they were waiting
    strangerQueue = strangerQueue.filter(u => u.socketId !== socket.id);

    // Remove from any active group calls
    for (const [groupId, call] of activeGroupCalls.entries()) {
      for (const [pUserId, pData] of call.participants.entries()) {
        if (pData.socketId === socket.id) {
          call.participants.delete(pUserId);
          const callRoom = 'group_call_' + groupId;
          io.to(callRoom).emit('group_call_user_left', { userId: pUserId, socketId: socket.id });
          if (call.participants.size === 0) {
            activeGroupCalls.delete(groupId);
            io.to(groupId).emit('group_call_ended', { groupId });
            io.to(groupId).emit('group_call_status_update', { groupId, isActive: false, participantsCount: 0 });
          } else {
            io.to(groupId).emit('group_call_status_update', {
              groupId,
              groupName: call.groupName,
              callType: call.callType,
              initiator: call.initiator,
              isActive: true,
              participantsCount: call.participants.size
            });
          }
          break;
        }
      }
    }

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
        
        try {
          const { data: friendLinks } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', userId);
            
          const friendIds = friendLinks ? friendLinks.map(link => link.friend_id) : [];
          for (const friendId of friendIds) {
            if (onlineUsersSet.has(friendId)) {
              io.to(friendId).emit('user_offline', userId);
            }
          }
        } catch (err) {
          console.error('Error fetching friends for offline status:', err);
        }
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
      const callTypeStr = data.callType === 'video' ? 'Video' : 'Voice';
      if (data.status === 'missed') text = `❌ Missed ${callTypeStr} Call`;
      else if (data.status === 'declined') text = `❌ Declined ${callTypeStr} Call`;
      else {
        const mins = Math.floor(data.duration_seconds / 60);
        const secs = data.duration_seconds % 60;
        const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        text = `${data.callType === 'video' ? '📹' : '📞'} ${callTypeStr} Call (${durStr})`;
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

if (require.main === module) {
  // Auto-cleanup stale home_chat messages (older than 10 minutes)
  setInterval(async () => {
    try {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await supabase
        .from('messages')
        .delete()
        .eq('room', 'home_chat')
        .lt('timestamp', tenMinsAgo);
    } catch (err) {
      console.error('Error in auto-cleanup of home_chat:', err);
    }
  }, 5 * 60000); // Check every 5 minutes

  // Auto-cleanup expired stories (older than 24 hours)
  setInterval(async () => {
    try {
      const { data: usersWithStories, error } = await supabase
        .from('users')
        .select('id, statusVideoUrl')
        .not('statusVideoUrl', 'is', null);

      if (!error && usersWithStories) {
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const now = Date.now();

        for (const u of usersWithStories) {
          if (!u.statusVideoUrl) continue;
          const match = u.statusVideoUrl.match(/profile_status_(\d+)/);
          if (match && match[1]) {
            const uploadTime = parseInt(match[1], 10);
            if (now - uploadTime > TWENTY_FOUR_HOURS) {
              try {
                const parts = u.statusVideoUrl.split('/abcd/');
                if (parts.length > 1) {
                  const filePath = decodeURIComponent(parts[1].split('?')[0]);
                  await supabase.storage.from('abcd').remove([filePath]);
                }
              } catch (e) {}

              await supabase
                .from('users')
                .update({ statusVideoUrl: null, story_views: [] })
                .eq('id', u.id);

              await supabase
                .from('messages')
                .delete()
                .match({ room: 'story_view', recipientId: u.id });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in auto-cleanup of expired stories:', err);
    }
  }, 5 * 60000); // Check every 5 minutes
}

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
