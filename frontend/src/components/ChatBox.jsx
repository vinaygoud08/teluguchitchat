import React, { useEffect, useState, useRef, memo } from 'react';
import axios from 'axios';
import MessageInput from './MessageInput';
import { useAuth } from '../context/AuthContext';
import { User, UserRound, CircleUser, Phone, Video } from 'lucide-react';
import Avatar from './Avatar';
import GroupInfoModal from './GroupInfoModal';
import ImageViewerModal from './ImageViewerModal';
import ProfileViewer from './ProfileViewer';
import { decryptMessage } from '../utils/crypto';

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

const MessageItem = memo(({ msg, isSelf, senderUser, senderColor, senderIcon, onImageClick, onContextMenu, onProfileClick }) => {
  const [viewing, setViewing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5);
  
  const msgKey = msg.id || msg.timestamp;
  const [isViewed, setIsViewed] = useState(() => localStorage.getItem(`viewed_${msgKey}`) === 'true');

  const handleView = () => {
    if (isViewed || viewing) return;
    setViewing(true);
    
    let timer = 5;
    const interval = setInterval(() => {
      timer -= 1;
      setTimeLeft(timer);
      if (timer <= 0) {
        clearInterval(interval);
        setViewing(false);
        setIsViewed(true);
        localStorage.setItem(`viewed_${msgKey}`, 'true');
      }
    }, 1000);
  };

  const timeStr = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  // System messages (call history, encrypted notice, group updates)
  const isSystemMsg = msg.text && (
    msg.text.startsWith('📞') || msg.text.startsWith('❌') || msg.text.includes('Voice Call') || msg.text.startsWith('📢')
  );

  const handleUserClick = () => {
    if (onProfileClick && !isSelf && !isSystemMsg) {
      onProfileClick(senderUser || { username: msg.sender, id: msg.senderId });
    }
  };

  if (isSystemMsg) {
    return (
      <div className="message system">
        <div className="message-content">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className={`message-row ${isSelf ? 'self' : 'other'}`}>
      {!isSelf && (
        <div 
          className="message-avatar-btn" 
          onClick={handleUserClick} 
          title={`Click to view ${msg.sender}'s profile`}
          style={{ cursor: 'pointer' }}
        >
          <Avatar userId={senderUser?.id || senderUser?._id || msg.senderId} username={msg.sender} size={32} />
        </div>
      )}

      <div className={`message ${isSelf ? 'self' : 'other'}`}>
        {!isSelf && (
          <div 
            className="message-sender" 
            onClick={handleUserClick}
            style={senderColor ? { color: senderColor, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' } : { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title={`View ${msg.sender}'s profile`}
          >
            {senderIcon === 'male' && <User size={14} color={senderColor} />}
            {senderIcon === 'female' && <UserRound size={14} color={senderColor} />}
            {senderIcon === 'other' && <CircleUser size={14} color={senderColor} />}
            {msg.sender}
          </div>
        )}
        <div 
          className="message-content" 
          onContextMenu={(e) => {
            e.preventDefault();
            if (onContextMenu) onContextMenu(e, msg);
          }}
          style={{ cursor: 'pointer' }}
        >
          {msg.reply_to && (
            <div style={{ background: 'rgba(0,0,0,0.1)', padding: '5px', borderRadius: '5px', marginBottom: '5px', fontSize: '0.85em', borderLeft: '3px solid #2196F3' }}>
              <strong style={{ color: '#2196F3' }}>{msg.reply_to.sender}</strong>
              {msg.reply_to.imageUrl && <div style={{display:'flex', alignItems:'center', gap:'5px'}}><span>📷 Photo</span><img src={msg.reply_to.imageUrl} style={{width:'30px', height:'30px', borderRadius:'4px', objectFit:'cover'}} /></div>}
              {msg.reply_to.text && <div>{msg.reply_to.text.length > 30 ? msg.reply_to.text.substring(0,30)+'...' : msg.reply_to.text}</div>}
            </div>
          )}
          {msg.text && <div className="message-text">{msg.text}</div>}
          
          {msg.imageUrl && !msg.viewOnce && (
            <img 
              src={msg.imageUrl} 
              alt="attached" 
              className="message-img" 
              onClick={() => onImageClick && onImageClick(msg.imageUrl)}
            />
          )}
          
          {msg.imageUrl && msg.viewOnce && !isSelf && (
            <div className="view-once-container">
              {isViewed ? (
                <div className="viewed-notice" style={{ fontStyle: 'italic', color: '#888', fontSize: '0.85rem' }}>
                  👁️ Photo Opened
                </div>
              ) : viewing ? (
                <div className="viewing-container" style={{ position: 'relative' }}>
                  <img src={msg.imageUrl} alt="view once" className="message-img" />
                  <div className="timer-badge" style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem' }}>
                    {timeLeft}s
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleView}
                  style={{ background: '#e91e63', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Tap to View 📸
                </button>
              )}
            </div>
          )}

          {msg.imageUrl && msg.viewOnce && isSelf && (
            <div className="viewed-notice" style={{ fontStyle: 'italic', color: '#888', fontSize: '0.85rem' }}>
              👁️ View Once Photo Sent
            </div>
          )}

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
    </div>
  );
});

const ChatBox = ({ socket, activeChat, onInitiateCall, users = [], myGroups = [], onlineUsers = new Set(), onBackToSidebar, strangerUserIds }) => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState({ home: [] }); // room -> messages array
  const [strangerLeft, setStrangerLeft] = useState(false);
  const [showRestartWarning, setShowRestartWarning] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [pendingCall, setPendingCall] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  
  // Context Menu & Replies
  const [contextMenu, setContextMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardImageMsg, setForwardImageMsg] = useState(null);
  
  const messagesEndRef = useRef(null);

  // Get the other user's info when in private chat
  const isStrangerChat = activeChat ? activeChat.startsWith('stranger_') : false;
  const activeGroup = myGroups.find(g => g.id === activeChat);
  const otherUser = users.find(u => u.id === activeChat);
  
  // A chat is considered "online" if it's the home chat, a group chat, or if the individual user is online
  const isOnline = activeChat === 'home' || activeGroup || (otherUser && onlineUsers.has(otherUser.id));
  const otherIsOnline = otherUser ? onlineUsers.has(otherUser.id) : false;

  useEffect(() => {
    const joinHome = () => {
      socket.emit('join_home');
    };

    if (socket.connected) {
      joinHome();
    }
    socket.on('connect', joinHome);

    const receiveMessageHandler = (data) => {
      setMessages(prev => {
        const homeMsgs = prev['home'] || [];
        return { ...prev, 'home': [...homeMsgs, data] };
      });
    };

    const receivePrivateHandler = async (data) => {
      const otherId = (data.room && data.room.startsWith('stranger_'))
        ? data.room
        : (data.senderId === user?.id ? data.recipientId : data.senderId);
      
      if (otherId) {
        if (data.text && data.text.startsWith('E2EE:') && user) {
          const uId = user.id || user._id;
          const privateKey = localStorage.getItem(`privateKey_${uId}`);
          if (privateKey) {
            try {
              data.text = await decryptMessage(data.text, privateKey);
            } catch (decErr) {
              console.warn("Could not decrypt message with current key:", decErr);
            }
          }
        }
        setMessages(prev => {
          const userMsgs = prev[otherId] || [];
          return { ...prev, [otherId]: [...userMsgs, data] };
        });
      }
    };

    const handleChatCleared = ({ room, chatKey }) => {
      setMessages(prev => ({ ...prev, [chatKey]: [] }));
    };

    const receiveGroupHandler = (data) => {
      setMessages(prev => {
        const groupMsgs = prev[data.room] || [];
        return { ...prev, [data.room]: [...groupMsgs, data] };
      });
    };

    const deleteMessageHandler = ({ messageId }) => {
      setMessages(prev => {
        const newMsgs = { ...prev };
        for (const key in newMsgs) {
          newMsgs[key] = newMsgs[key].filter(m => m.id !== messageId);
        }
        return newMsgs;
      });
    };

    const pinMessageHandler = ({ messageId, isPinned, roomKey }) => {
      setMessages(prev => {
        const newMsgs = { ...prev };
        if (newMsgs[roomKey]) {
          newMsgs[roomKey] = newMsgs[roomKey].map(m => 
            m.id === messageId ? { ...m, is_pinned: isPinned } : m
          );
        }
        return newMsgs;
      });
    };

    socket.on('receive_message', receiveMessageHandler);
    socket.on('receive_private_message', receivePrivateHandler);
    socket.on('receive_group_message', receiveGroupHandler);
    socket.on('chat_cleared', handleChatCleared);
    socket.on('message_deleted', deleteMessageHandler);
    socket.on('message_pinned', pinMessageHandler);

    return () => {
      socket.off('connect', joinHome);
      socket.off('receive_message', receiveMessageHandler);
      socket.off('receive_private_message', receivePrivateHandler);
      socket.off('receive_group_message', receiveGroupHandler);
      socket.off('chat_cleared', handleChatCleared);
      socket.off('message_deleted', deleteMessageHandler);
      socket.off('message_pinned', pinMessageHandler);
    };
  }, [socket, user]);

  useEffect(() => {
    const joinPrivate = () => {
      if (activeChat && activeChat !== 'home' && !activeGroup && user) {
        const isStranger = activeChat.startsWith('stranger_');
        const room = isStranger ? activeChat : [user.id, activeChat].sort().join('_');
        socket.emit('join_private', room);
      } else if (activeGroup) {
        socket.emit('join_group', activeChat);
      }
    };

    if (socket.connected) {
      joinPrivate();
    }
    socket.on('connect', joinPrivate);

    const fetchHistory = async () => {
      if (!token || !activeChat) return;
      if (activeChat === 'home') return;
      if (!user || !token) return;

      try {
        const url = activeGroup ? `/api/groups/${activeChat}/messages` : `/api/messages/${[user.id, activeChat].sort().join('_')}`;
        const res = await axios.get(url, { headers: { 'x-auth-token': token } });
        
        let messagesData = res.data;
        if (!activeGroup && user) {
          const uId = user.id || user._id;
          const privateKey = localStorage.getItem(`privateKey_${uId}`);
          if (privateKey) {
            messagesData = await Promise.all(messagesData.map(async m => {
              if (m.text && m.text.startsWith('E2EE:')) {
                try {
                  return { ...m, text: await decryptMessage(m.text, privateKey) };
                } catch (e) {
                  return m;
                }
              }
              return m;
            }));
          }
        }
        
        setMessages(prev => ({ ...prev, [activeChat]: messagesData }));
      } catch (err) {
        console.error('Error fetching messages:', err);
      }
    };

    fetchHistory();

    return () => {
      socket.off('connect', joinPrivate);
    };
  }, [activeChat, user, socket, token, activeGroup]);

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

  const handleAddStranger = async () => {
    const targetId = strangerUserIds?.[activeChat];
    if (!targetId) return;
    try {
      await axios.post(`/api/users/friend-request/${targetId}`, {}, {
        headers: { 'x-auth-token': token }
      });
      alert('Friend request sent!');
    } catch (err) {
      alert(err.response?.data?.msg || 'Error sending friend request');
    }
  };

  const handleLeaveStranger = () => {
    socket.emit('leave_stranger_room', activeChat);
    setStrangerLeft(true);
    if (onBackToSidebar) onBackToSidebar();
  };

  const currentMessages = messages[activeChat] || [];

  const renderHeader = () => {
    return (
      <div className="chat-header">
        {onBackToSidebar && (
          <button className="chat-header-btn" onClick={onBackToSidebar} style={{ marginRight: 2 }} aria-label="Back">←</button>
        )}
        
        <div className="chat-header-user">
          {activeChat === 'home' ? (
            <>
              <div className="avatar avatar-public" style={{ width: 40, height: 40, fontSize: '1rem' }}>🌐</div>
              <div className="chat-header-info">
                <h2>Public Chat</h2>
                <span className="status-text online">Public Room</span>
              </div>
            </>
          ) : isStrangerChat ? (
            <>
              <div className="avatar avatar-stranger" style={{ width: 40, height: 40, fontSize: '1rem' }}>🕵️</div>
              <div className="chat-header-info">
                <h2>Stranger</h2>
                <span className={`status-text ${strangerLeft ? 'offline' : 'online'}`}>
                  {strangerLeft ? 'Left the chat' : 'In chat'}
                </span>
              </div>
            </>
          ) : activeGroup ? (
            <>
              <div 
                className="avatar avatar-public" 
                style={{ width: 40, height: 40, fontSize: '1rem', background: '#e91e63', cursor: 'pointer' }}
                onClick={() => setShowGroupInfo(true)}
              >👥</div>
              <div 
                className="chat-header-info" 
                style={{ cursor: 'pointer' }} 
                onClick={() => setShowGroupInfo(true)}
              >
                <h2>{activeGroup.name}</h2>
                <span className="status-text online">Group Chat • tap for info</span>
              </div>
            </>
          ) : otherUser ? (
            <>
              <div style={{ position: 'relative', width: 40, height: 40, cursor: 'pointer' }} onClick={() => setViewingProfile(otherUser)}>
                <Avatar userId={otherUser.id || otherUser._id} username={otherUser.username} size={40} />
                {otherIsOnline ? <span className="online-dot" /> : <span className="offline-dot" />}
              </div>
              <div className="chat-header-info" style={{ cursor: 'pointer' }} onClick={() => setViewingProfile(otherUser)}>
                <h2>{otherUser.username}</h2>
                <span className={`status-text ${otherIsOnline ? 'online' : 'offline'}`}>
                  {otherIsOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </>
          ) : (
            <div className="chat-header-info">
              <h2>Chat</h2>
            </div>
          )}
        </div>

        <div className="chat-header-actions">
          {activeChat === 'home' ? (
            <button className="chat-header-btn restart-btn" onClick={() => setMessages(prev => ({ ...prev, home: [] }))}>🔄 Clear</button>
          ) : isStrangerChat ? (
            <>
              <button className="chat-header-btn" onClick={handleAddStranger}>➕ Add Friend</button>
              <button className="chat-header-btn restart-btn" onClick={handleLeaveStranger}>❌ Leave</button>
            </>
          ) : !activeGroup ? (
            <>
              <button className="chat-header-btn" onClick={() => setPendingCall('audio')} title="Voice Call"><Phone size={20} /></button>
              <button className="chat-header-btn" onClick={() => setPendingCall('video')} title="Video Call"><Video size={20} /></button>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  const pinnedMessage = [...currentMessages].reverse().find(m => m.is_pinned);

  return (
    <div className="chat-container">
      {renderHeader()}

      {pinnedMessage && (
        <div style={{
          background: '#fff3cd', borderBottom: '1px solid #ffeeba', padding: '10px 15px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: '#856404', zIndex: 5, boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              📌 Pinned Message
            </span>
            <span style={{ fontSize: '0.9em' }}>
              {pinnedMessage.imageUrl && '📷 Photo '}
              {pinnedMessage.text && (pinnedMessage.text.length > 50 ? pinnedMessage.text.substring(0, 50) + '...' : pinnedMessage.text)}
            </span>
          </div>
          <button 
            onClick={() => {
              const roomKey = activeChat === 'home' ? 'home_chat' : activeChat;
              socket.emit('pin_message', { messageId: pinnedMessage.id, room: roomKey, unpin: true });
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#856404' }}
          >
            &times;
          </button>
        </div>
      )}

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
          let senderInfo = null;
          if (!isSelf && msg.sender) {
            senderInfo = users.find(u => u.username === msg.sender || (u.id || u._id) === msg.senderId);
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

          return (
            <MessageItem 
              key={msg.id || idx} 
              msg={msgToPass} 
              isSelf={isSelf} 
              senderUser={senderInfo}
              senderColor={senderColor} 
              senderIcon={senderIcon} 
              onImageClick={setViewingImage} 
              onProfileClick={(profile) => {
                if (isStrangerChat) return;
                setViewingProfile(profile);
              }}
              onContextMenu={(e, messageObj) => {
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  msg: messageObj
                });
              }}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '0 15px', boxSizing: 'border-box' }}>
        {replyingTo && (
          <div style={{ 
            background: '#e0f7fa', padding: '8px 12px', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', 
            borderLeft: '4px solid #00acc1', display: 'flex', justifyContent: 'space-between', 
            alignItems: 'center', color: '#006064', width: '100%', boxSizing: 'border-box',
            marginBottom: '-5px', zIndex: 10
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.85em' }}>Replying to {replyingTo.sender}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {replyingTo.imageUrl && <span style={{ fontSize: '0.85em' }}>📷 Photo</span>}
                {replyingTo.text && <span style={{ fontSize: '0.85em' }}>{replyingTo.text.length > 30 ? replyingTo.text.substring(0,30)+'...' : replyingTo.text}</span>}
              </div>
            </div>
            {replyingTo.imageUrl && (
              <img src={replyingTo.imageUrl} alt="preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
            )}
            <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#00838f' }}>&times;</button>
          </div>
        )}
        <div style={{ width: '100%' }}>
          <MessageInput socket={socket} activeChat={activeChat} isGroup={!!activeGroup} onInitiateCall={onInitiateCall} replyingTo={replyingTo} onClearReply={() => setReplyingTo(null)} otherUser={otherUser} />
        </div>
      </div>

      {showGroupInfo && activeGroup && (
        <GroupInfoModal group={activeGroup} onClose={() => setShowGroupInfo(false)} />
      )}

      {showRestartWarning && (
        <RestartWarningModal
          onConfirm={handleRestartChat}
          onCancel={() => setShowRestartWarning(false)}
        />
      )}

      {viewingImage && (
        <ImageViewerModal 
          imageUrl={viewingImage} 
          onClose={() => setViewingImage(null)}
          socket={socket}
          activeChat={activeChat}
          isGroup={!!activeGroup}
          friends={users}
          myGroups={myGroups}
          onInitiateCall={onInitiateCall}
          user={user}
        />
      )}

      {contextMenu && (
        <>
          {/* Overlay to close menu when clicking outside */}
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999 }} onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'white',
            color: 'black',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            borderRadius: '8px',
            padding: '8px 0',
            zIndex: 10000,
            minWidth: '150px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <button 
              onClick={() => { setReplyingTo(contextMenu.msg); setContextMenu(null); }}
              style={{ background: 'none', border: 'none', padding: '10px 15px', textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              Reply
            </button>
            {(contextMenu.msg.imageUrl || contextMenu.msg.text) && (
              <button 
                onClick={() => { setForwardImageMsg(contextMenu.msg); setContextMenu(null); }}
                style={{ background: 'none', border: 'none', padding: '10px 15px', textAlign: 'left', cursor: 'pointer', width: '100%' }}
              >
                Forward
              </button>
            )}
            {contextMenu.msg.text && (
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.msg.text);
                  setContextMenu(null);
                }}
                style={{ background: 'none', border: 'none', padding: '10px 15px', textAlign: 'left', cursor: 'pointer', width: '100%' }}
              >
                Copy
              </button>
            )}
            <button 
              onClick={() => {
                const roomKey = activeChat === 'home' ? 'home_chat' : activeChat; // Adjust based on how messages are keyed, wait, for group/private it relies on activeChat
                // Let's emit pin
                socket.emit('pin_message', { messageId: contextMenu.msg.id, room: roomKey });
                setContextMenu(null);
              }}
              style={{ background: 'none', border: 'none', padding: '10px 15px', textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              Pin
            </button>
            {(contextMenu.msg.senderId === user?.id || contextMenu.msg.sender === user?.username) && (
              <button 
                onClick={() => {
                  const roomKey = activeChat === 'home' ? 'home_chat' : activeChat;
                  socket.emit('delete_message', { messageId: contextMenu.msg.id, room: roomKey });
                  setContextMenu(null);
                }}
                style={{ background: 'none', border: 'none', padding: '10px 15px', textAlign: 'left', cursor: 'pointer', width: '100%', color: 'red' }}
              >
                Delete
              </button>
            )}
            {contextMenu.msg.imageUrl && (
              <button 
                onClick={() => {
                  fetch(contextMenu.msg.imageUrl)
                    .then(res => res.blob())
                    .then(blob => {
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `image-${Date.now()}.jpg`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    })
                    .catch(err => console.error("Download failed:", err));
                  setContextMenu(null);
                }}
                style={{ background: 'none', border: 'none', padding: '10px 15px', textAlign: 'left', cursor: 'pointer', width: '100%' }}
              >
                Save to Gallery
              </button>
            )}
          </div>
        </>
      )}

      {forwardImageMsg && (
        <ForwardModal 
          imageUrl={forwardImageMsg.imageUrl}
          friends={users}
          myGroups={myGroups}
          onClose={() => setForwardImageMsg(null)}
          onSend={(selectedIds) => {
            selectedIds.forEach(targetId => {
              const isTargetGroup = myGroups.some(g => g.id === targetId);
              const baseData = {
                sender: user ? user.username : 'Guest',
                timestamp: new Date().toISOString(),
                imageUrl: forwardImageMsg.imageUrl,
                viewOnce: false
              };
              if (isTargetGroup) {
                socket.emit('send_message', { ...baseData, room: targetId });
              } else {
                socket.emit('send_private_message', { ...baseData, recipientId: targetId });
              }
            });
            setForwardImageMsg(null);
          }}
        />
      )}

      {pendingCall && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setPendingCall(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '24px', maxWidth: '320px' }}>
            <h3 style={{ marginBottom: '15px', color: 'var(--brand-900)' }}>Start {pendingCall === 'video' ? 'Video' : 'Voice'} Call?</h3>
            <p style={{ marginBottom: '25px', color: 'var(--neutral-600)', fontSize: '0.95rem' }}>
              Are you sure you want to call this user?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setPendingCall(null)}
                style={{ padding: '10px 24px', background: 'transparent', border: '1px solid var(--neutral-300)', borderRadius: '24px', color: 'var(--neutral-700)', cursor: 'pointer', fontWeight: '500' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onInitiateCall(pendingCall);
                  setPendingCall(null);
                }}
                style={{ padding: '10px 24px', background: 'var(--brand-500)', border: 'none', borderRadius: '24px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', boxShadow: 'var(--shadow-brand)' }}
              >
                {pendingCall === 'video' ? <Video size={18} /> : <Phone size={18} />} Call
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingProfile && (
        <ProfileViewer 
          userProfile={viewingProfile} 
          onClose={() => setViewingProfile(null)} 
        />
      )}
    </div>
  );
};

export default ChatBox;
