import React, { useEffect, useState, useRef, memo } from 'react';
import axios from 'axios';
import MessageInput from './MessageInput';
import { useAuth } from '../context/AuthContext';
import { User, UserRound, CircleUser } from 'lucide-react';

// Inline warning modal
const RestartWarningModal = ({ onConfirm, onCancel }) => (
  <div className="modal-overlay" onClick={onCancel}>
    <div className="modal-content warning-modal" onClick={e => e.stopPropagation()}>
      <div className="warning-icon">⚠️</div>
      <div className="warning-title">Start a New Chat?</div>
      <div className="warning-text">
        This will permanently delete <strong>all messages</strong> in this conversation for <strong>both users</strong>. This cannot be undone.
      </div>
      <div className="warning-actions">
        <button className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm}>Yes, Clear Chat</button>
      </div>
    </div>
  </div>
);

const MessageItem = memo(({ msg, isSelf, senderColor, senderIcon }) => {
  const timeStr = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  // System messages (call history, encrypted notice)
  const isSystemMsg = msg.text && (
    msg.text.startsWith('📞') || msg.text.startsWith('❌') || msg.text.includes('Voice Call')
  );

  return (
    <div className={`message ${isSystemMsg ? 'system' : isSelf ? 'self' : 'other'}`}>
      {!isSelf && !isSystemMsg && (
        <div className="message-sender" style={senderColor ? { color: senderColor, display: 'flex', alignItems: 'center', gap: '4px' } : { display: 'flex', alignItems: 'center', gap: '4px' }}>
          {senderIcon === 'male' && <User size={14} color={senderColor} />}
          {senderIcon === 'female' && <UserRound size={14} color={senderColor} />}
          {senderIcon === 'other' && <CircleUser size={14} color={senderColor} />}
          {msg.sender}
        </div>
      )}
      <div className="message-content">
        {msg.text && <div>{msg.text}</div>}
        {msg.imageUrl && <img src={msg.imageUrl} alt="attached" className="message-img" />}
        {msg.gifUrl && <img src={msg.gifUrl} alt="gif" className="message-img" />}
        {msg.stickerUrl && (
          <img src={msg.stickerUrl} alt="sticker" className="message-img"
            style={{ background: 'transparent', maxWidth: '150px' }} />
        )}
        {!isSystemMsg && timeStr && (
          <span className="message-time">{timeStr}</span>
        )}
      </div>
    </div>
  );
});

const ChatBox = ({ socket, activeChat, onInitiateCall, users = [], onlineUsers = new Set(), onBackToSidebar, strangerUserIds }) => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState({});
  const [showRestartWarning, setShowRestartWarning] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const messagesEndRef = useRef(null);

  // Get the other user's info when in private chat
  const otherUser = activeChat !== 'home' ? users.find(u => u.id === activeChat) : null;
  const otherIsOnline = otherUser ? onlineUsers.has(otherUser.id) : false;

  useEffect(() => {
    socket.emit('join_home');

    const receiveMessageHandler = (data) => {
      setMessages(prev => {
        const homeMsgs = prev['home'] || [];
        return { ...prev, 'home': [...homeMsgs, data] };
      });
    };

    const receivePrivateHandler = (data) => {
      const otherId = data.senderId === user?.id ? data.recipientId : data.senderId;
      if (otherId) {
        setMessages(prev => {
          const userMsgs = prev[otherId] || [];
          return { ...prev, [otherId]: [...userMsgs, data] };
        });
      }
    };

    const handleChatCleared = ({ room, chatKey }) => {
      setMessages(prev => ({ ...prev, [chatKey]: [] }));
    };

    socket.on('receive_message', receiveMessageHandler);
    socket.on('receive_private_message', receivePrivateHandler);
    socket.on('chat_cleared', handleChatCleared);

    return () => {
      socket.off('receive_message', receiveMessageHandler);
      socket.off('receive_private_message', receivePrivateHandler);
      socket.off('chat_cleared', handleChatCleared);
    };
  }, [socket, user]);

  useEffect(() => {
    if (activeChat !== 'home' && user) {
      const room = [user.id, activeChat].sort().join('_');
      socket.emit('join_private', room);
    }

    const fetchHistory = async () => {
      let room = 'home_chat';
      if (activeChat !== 'home' && user) {
        room = [user.id, activeChat].sort().join('_');
      }
      if (!token) return;
      try {
        const res = await axios.get(`/api/messages/${room}`, {
          headers: { 'x-auth-token': token }
        });
        setMessages(prev => ({ ...prev, [activeChat]: res.data }));
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    fetchHistory();
  }, [activeChat, user, socket, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChat]);

  const handleRestartChat = async () => {
    setIsClearing(true);
    try {
      let room = 'home_chat';
      let chatKey = 'home';
      if (activeChat !== 'home' && user) {
        room = [user.id, activeChat].sort().join('_');
        chatKey = activeChat;
      }
      await axios.delete(`/api/messages/${room}`, {
        headers: { 'x-auth-token': token }
      });
      // Notify both users via socket
      socket.emit('clear_chat', { room, chatKey, otherUserId: activeChat !== 'home' ? activeChat : null });
      setMessages(prev => ({ ...prev, [activeChat]: [] }));
    } catch (err) {
      console.error('Error clearing chat:', err);
      alert('Failed to clear chat. Please try again.');
    } finally {
      setIsClearing(false);
      setShowRestartWarning(false);
    }
  };

  const currentMessages = messages[activeChat] || [];
  const isStrangerChat = activeChat.startsWith('stranger_');

  const handleAddStranger = async () => {
    const targetId = strangerUserIds?.[activeChat];
    if (!targetId) return;
    try {
      await axios.post(`/api/users/friend-request/${targetId}`, {}, {
        headers: { 'x-auth-token': token }
      });
      alert('Friend request sent! Once they accept from the Requests tab, you will see their identity.');
    } catch (err) {
      alert(err.response?.data?.msg || 'Error sending friend request');
    }
  };

  const handleLeaveStranger = () => {
    socket.emit('leave_stranger_room', activeChat);
    if (onBackToSidebar) {
      onBackToSidebar();
    }
  };

  // Chat Header
  const renderHeader = () => {
    if (activeChat === 'home') {
      return (
        <div className="chat-header">
          {onBackToSidebar && (
            <button
              className="chat-header-btn"
              onClick={onBackToSidebar}
              style={{ marginRight: 2 }}
              aria-label="Back"
            >
              ←
            </button>
          )}
          <div className="avatar avatar-public" style={{ width: 40, height: 40, fontSize: '1rem' }}>🌐</div>
          <div style={{ flex: 1 }}>
            <div className="chat-header-name">Random Chat</div>
            <div className="chat-header-status">Public conversation — open to everyone</div>
          </div>
        </div>
      );
    }

    if (isStrangerChat) {
      return (
        <div className="chat-header">
          {onBackToSidebar && (
            <button className="chat-header-btn" onClick={handleLeaveStranger} style={{ marginRight: 2 }} aria-label="Back">←</button>
          )}
          <div className="avatar" style={{ width: 40, height: 40, background: '#555' }}>👤</div>
          <div style={{ flex: 1 }}>
            <div className="chat-header-name">Stranger</div>
            <div className="chat-header-status">Anonymous Chat</div>
          </div>
          <div className="chat-header-actions">
            <button className="chat-header-btn" onClick={handleAddStranger}>
              ➕ Add Friend
            </button>
            <button className="chat-header-btn restart-btn" onClick={handleLeaveStranger}>
              ❌ Leave
            </button>
          </div>
        </div>
      );
    }

    if (otherUser) {
      const initials = otherUser.username[0].toUpperCase();
      return (
        <div className="chat-header">
          {onBackToSidebar && (
            <button
              className="chat-header-btn"
              onClick={onBackToSidebar}
              style={{ marginRight: 2 }}
              aria-label="Back"
            >
              ←
            </button>
          )}
          <div className="avatar" style={{ width: 40, height: 40, fontSize: '1rem', position: 'relative',
            background: `linear-gradient(135deg, hsl(${(otherUser.username.charCodeAt(0) * 37) % 360}, 65%, 55%), hsl(${(otherUser.username.charCodeAt(0) * 37 + 60) % 360}, 65%, 45%))` }}>
            {otherUser.username[0].toUpperCase()}
            {otherIsOnline ? <span className="online-dot" /> : <span className="offline-dot" />}
          </div>
          <div style={{ flex: 1 }}>
            <div className="chat-header-name">{otherUser.username}</div>
            <div className={`chat-header-status ${otherIsOnline ? 'online' : ''}`}>
              {otherIsOnline ? 'Online' : 'Offline'}
            </div>
          </div>
          <div className="chat-header-actions">
            <button
              className="chat-header-btn restart-btn"
              onClick={() => setShowRestartWarning(true)}
            >
              🔄 Restart Chat
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="chat-header">
        <div className="avatar" style={{ width: 40, height: 40 }}>💬</div>
        <div className="chat-header-name" style={{ flex: 1 }}>Private Chat</div>
      </div>
    );
  };

  return (
    <div className="chat-container">
      {renderHeader()}

      <div className="messages-area">
        {activeChat !== 'home' && (
          <div className="encrypted-notice">
            🔒 Messages are private — only you and the other person can see them.
          </div>
        )}

        {currentMessages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <div className="chat-empty-title">No messages yet</div>
            <div className="chat-empty-subtitle">
              {activeChat === 'home'
                ? 'Say hello in the public chat!'
                : 'Send a message to start your private conversation.'}
            </div>
          </div>
        )}

        {currentMessages.map((msg, idx) => {
          const isSelf = user && msg.sender === user.username;
          let senderColor = '#333'; // default black/dark-gray for 'other'
          let senderIcon = 'other';
          if (!isSelf && msg.sender) {
            const senderInfo = users.find(u => u.username === msg.sender);
            if (senderInfo) {
              const g = senderInfo.gender ? senderInfo.gender.toLowerCase() : '';
              if (g === 'male') {
                senderColor = '#2196F3'; // blue
                senderIcon = 'male';
              } else if (g === 'female') {
                senderColor = '#E91E63'; // pink
                senderIcon = 'female';
              }
            }
          }
          let msgToPass = msg;
          if (isStrangerChat && !isSelf) {
            msgToPass = { ...msg, sender: 'Stranger' };
            senderColor = '#555';
            senderIcon = 'other';
          }

          return <MessageItem key={msg.id || idx} msg={msgToPass} isSelf={isSelf} senderColor={senderColor} senderIcon={senderIcon} />;
        })}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput socket={socket} activeChat={activeChat} onInitiateCall={onInitiateCall} />

      {showRestartWarning && (
        <RestartWarningModal
          onConfirm={handleRestartChat}
          onCancel={() => setShowRestartWarning(false)}
        />
      )}
    </div>
  );
};

export default ChatBox;
