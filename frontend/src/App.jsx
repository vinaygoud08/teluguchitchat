import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import ChatBox from './components/ChatBox';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import MyProfileModal from './components/MyProfileModal';
import GuestLoginModal from './components/GuestLoginModal';
import AuthContext from './context/AuthContext';
import UserSidebar from './components/UserSidebar';
import CallOverlay from './components/CallOverlay';
import GroupCallOverlay from './components/GroupCallOverlay';
import AccountModal from './components/AccountModal';
import SettingsMenu from './components/SettingsMenu';
import NotificationsMenu from './components/NotificationsMenu';
import PrivacyMenu from './components/PrivacyMenu';
import LanguageMenu from './components/LanguageMenu';
import WelcomeScreen from './components/WelcomeScreen';
import AiBotModal from './components/AiBotModal';
import UpdatesModal from './components/UpdatesModal';
import { Bot } from 'lucide-react';
import { LanguageProvider } from './context/LanguageContext';
import { useSettings } from './context/SettingsContext';
import { generateKeyPair, exportPublicKey, exportPrivateKey } from './utils/crypto';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : '');

const socket = io(BACKEND_URL || '/', {
  transports: ['websocket', 'polling'],
  timeout: 15000,
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000
});

function App() {
  const { playNotificationSound } = useSettings();
  const [token, setToken] = useState(() => {
    try {
      const t = localStorage.getItem('token');
      return (t && t !== 'undefined' && t !== 'null') ? t : null;
    } catch(e) {
      return null;
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('user');
      if (u && u !== 'undefined' && u !== 'null') {
        const parsed = JSON.parse(u);
        if (parsed && typeof parsed === 'object' && (parsed.id || parsed._id || parsed.username)) {
          return parsed;
        }
      }
    } catch(e) {}
    return null;
  });

  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showGuestLogin, setShowGuestLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showAiBot, setShowAiBot] = useState(false);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);

  // Group Call State
  const [groupCallSession, setGroupCallSession] = useState({
    active: false,
    groupId: null,
    groupName: '',
    callType: 'video'
  });
  const [activeGroupCalls, setActiveGroupCalls] = useState({}); // groupId -> { isActive, callType, participantsCount, initiator }

  const menuRef = useRef(null);
  const [resetToken, setResetToken] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const activeChatRef = useRef(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [users, setUsers] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const [isSearchingStranger, setIsSearchingStranger] = useState(false);
  const [strangerUserIds, setStrangerUserIds] = useState({}); // room -> hidden userId

  const handleSetActiveChat = (chatId) => {
    setActiveChat(chatId);
    activeChatRef.current = chatId;

    // Clear unread count for this chat
    setUnreadCounts(prev => {
      if (!prev[chatId]) return prev;
      const newCounts = { ...prev };
      delete newCounts[chatId];
      return newCounts;
    });

    // On mobile, close sidebar when chat is selected
    if (window.innerWidth <= 768) {
      setMobileSidebarOpen(false);
    }
  };

  const [callSession, setCallSession] = useState({
    state: 'idle', // 'idle', 'outgoing', 'incoming', 'connected'
    role: null,    // 'caller', 'callee'
    otherUser: null, // { id, username }
    acceptedSignal: null,
    incomingSignal: null,
    trigger: 0,
  });

  const iceCandidatesMap = useRef({});

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (token && storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.warn("Invalid stored user JSON, resetting:", e);
      localStorage.removeItem('user');
    }
  }, [token]);

  useEffect(() => {
    // Supabase redirects use hash fragments (#access_token=...)
    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (type === 'recovery' && accessToken) {
        setResetToken(accessToken);
        setShowResetPassword(true);
        // Clear the hash from the URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowSettings(false);
        setShowAccount(false);
        setShowNotifications(false);
        setShowPrivacy(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch users list and current user profile
  useEffect(() => {
    if (token) {
      // Fetch all users for Discover tab
      axios.get('/api/users', {
        headers: { 'x-auth-token': token }
      }).then(res => {
        if (Array.isArray(res.data)) {
          setUsers(res.data);
        }
      }).catch(err => console.error(err));

      // Fetch current user with populated friends and requests
      axios.get('/api/users/me', {
        headers: { 'x-auth-token': token }
      }).then(res => {
        if (res.data && typeof res.data === 'object' && (res.data.id || res.data._id || res.data.username)) {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        } else {
          // If response is not a valid user JSON (e.g., HTML from SPA rewrite or invalid token)
          console.warn("Invalid user payload received, resetting auth");
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }).catch(err => {
        console.error("Error fetching /api/users/me:", err);
        if (err.response?.status === 401 || err.response?.status === 404) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      });

      // Fetch user's groups
      axios.get('/api/groups/my-groups', {
        headers: { 'x-auth-token': token }
      }).then(res => {
        if (Array.isArray(res.data)) {
          setMyGroups(res.data);
        }
      }).catch(err => {
        console.error("Error fetching my-groups:", err);
      });

    } else {
      setUsers([]);
      setMyGroups([]);
      setActiveChat(null);
      setIsSearchingStranger(false);
    }
  }, [token]);

  // Socket signaling configuration for calls
  useEffect(() => {
    if (!user) return;

    const joinUserRoom = () => {
      socket.emit('join_user', user.id || user._id);
    };

    if (socket.connected) {
      joinUserRoom();
    }

    socket.on('connect', joinUserRoom);
    return () => {
      socket.off('connect', joinUserRoom);
    };
  }, [user]);

  // Online status tracking
  useEffect(() => {
    const handleOnlineUsers = (usersArr) => {
      setOnlineUsers(new Set(usersArr));
    };

    const handleUserOnline = (userId) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.add(userId);
        return newSet;
      });
    };

    const handleUserOffline = (userId) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };

    socket.on('online_users', handleOnlineUsers);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);

    return () => {
      socket.off('online_users', handleOnlineUsers);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
    };
  }, []);

  useEffect(() => {
    const handleIncomingCall = (data) => {
      console.log("Received call_incoming from", data.name);
      playNotificationSound('calls');
      setCallSession({
        state: 'incoming',
        role: 'callee',
        otherUser: { id: data.from, username: data.name },
        incomingSignal: data.signal,
        acceptedSignal: null,
        callType: data.callType || 'audio',
      });
    };

    const handleCallAccepted = (signal) => {
      console.log("Received call_accepted");
      setCallSession(prev => ({
        ...prev,
        state: 'connected',
        acceptedSignal: signal
      }));
    };

    const handleIceCandidate = (data) => {
      console.log("Received ice_candidate from", data.from);
      if (!iceCandidatesMap.current[data.from]) {
        iceCandidatesMap.current[data.from] = [];
      }
      // Reassign to a new array so the reference changes and useEffect triggers in CallOverlay
      iceCandidatesMap.current[data.from] = [...iceCandidatesMap.current[data.from], data.candidate];

      // Trigger a render so CallOverlay gets the updated array
      setCallSession(prev => ({ ...prev, trigger: Math.random() }));
    };

    const handleCallEnded = () => {
      console.log("Call ended by remote peer");
      resetCallSession();
    };

    const handleCallDeclined = () => {
      console.log("Call declined by remote peer");
      alert("Call was declined.");
      resetCallSession();
    };

    const handleStrangerMatch = ({ room, otherUserId }) => {
      playNotificationSound('randomChat');
      setIsSearchingStranger(false);
      setStrangerUserIds(prev => ({ ...prev, [room]: otherUserId }));
      setActiveChat(room);
      if (window.innerWidth <= 768) {
        setMobileSidebarOpen(false);
      }
    };

    const handleStrangerLeft = () => {
      alert("The stranger has left the chat.");
    };

    socket.on('call_incoming', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('ice_candidate', handleIceCandidate);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_declined', handleCallDeclined);
    socket.on('stranger_match', handleStrangerMatch);
    socket.on('stranger_left', handleStrangerLeft);

    const handleFriendRequestReceived = () => {
      // Refresh current user to get updated friend requests
      if (token) {
        axios.get('/api/users/me', {
          headers: { 'x-auth-token': token }
        }).then(res => {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        }).catch(err => console.error(err));
      }
    };

    const handleUnreadMessage = (msg) => {
      if (user && (msg.senderId === user.id || msg.senderId === user._id)) return;

      const isPrivate = msg.room && msg.room.includes('_');
      const badgeKey = isPrivate ? msg.senderId : msg.room;

      if (activeChatRef.current !== badgeKey) {
        playNotificationSound('messages');
        setUnreadCounts(prev => ({
          ...prev,
          [badgeKey]: (prev[badgeKey] || 0) + 1
        }));
      }
    };

    const handleAddedToGroup = (group) => {
      setMyGroups(prev => {
        if (prev.find(g => g.id === group.id)) return prev;
        return [...prev, group];
      });
      socket.emit('join_group', group.id);
    };

    const handleGroupCallStatusUpdate = (data) => {
      console.log("Group call status update:", data);
      setActiveGroupCalls(prev => {
        if (!data.isActive) {
          const next = { ...prev };
          delete next[data.groupId];
          return next;
        }
        return { ...prev, [data.groupId]: data };
      });
    };

    const handleActiveGroupCallsList = (callsList) => {
      const map = {};
      (callsList || []).forEach(c => {
        map[c.groupId] = { ...c, isActive: true };
      });
      setActiveGroupCalls(map);
    };

    const handleGroupCallEnded = ({ groupId }) => {
      setActiveGroupCalls(prev => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      setGroupCallSession(prev => (prev.groupId === groupId ? { active: false, groupId: null, groupName: '', callType: 'video' } : prev));
    };

    socket.on('receive_friend_request', handleFriendRequestReceived);
    socket.on('receive_private_message', handleUnreadMessage);
    socket.on('receive_group_message', handleUnreadMessage);
    socket.on('added_to_group', handleAddedToGroup);
    socket.on('group_call_status_update', handleGroupCallStatusUpdate);
    socket.on('active_group_calls_list', handleActiveGroupCallsList);
    socket.on('group_call_ended', handleGroupCallEnded);

    if (user) {
      socket.emit('get_active_group_calls');
    }

    return () => {
      socket.off('call_incoming', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_declined', handleCallDeclined);
      socket.off('stranger_match', handleStrangerMatch);
      socket.off('stranger_left', handleStrangerLeft);
      socket.off('receive_friend_request', handleFriendRequestReceived);
      socket.off('receive_private_message', handleUnreadMessage);
      socket.off('receive_group_message', handleUnreadMessage);
      socket.off('added_to_group', handleAddedToGroup);
      socket.off('group_call_status_update', handleGroupCallStatusUpdate);
      socket.off('active_group_calls_list', handleActiveGroupCallsList);
      socket.off('group_call_ended', handleGroupCallEnded);
    };
  }, [user, token, socket]);

  const handleInitiateGroupCall = (groupId, groupName, callType = 'video') => {
    setGroupCallSession({
      active: true,
      groupId,
      groupName: groupName || 'Group Call',
      callType: callType || 'video'
    });
  };

  const handleLeaveGroupCall = () => {
    setGroupCallSession({
      active: false,
      groupId: null,
      groupName: '',
      callType: 'video'
    });
  };

  const resetCallSession = () => {
    iceCandidatesMap.current = {};
    setCallSession({
      state: 'idle',
      role: null,
      otherUser: null,
      acceptedSignal: null,
      incomingSignal: null,
      trigger: 0,
      callType: 'audio'
    });
  };

  const initiateCall = (type = 'audio') => {
    if (!user || activeChat === 'home') return;
    const targetUser = users.find(u => u.id === activeChat);
    const targetUsername = targetUser ? targetUser.username : 'User';

    setCallSession({
      state: 'outgoing',
      role: 'caller',
      otherUser: { id: activeChat, username: targetUsername },
      acceptedSignal: null,
      incomingSignal: null,
      trigger: 0,
      callType: type
    });
  };

  const acceptIncomingCall = () => {
    setCallSession(prev => ({
      ...prev,
      state: 'connected'
    }));
  };

  const login = async (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setShowLogin(false);
    setShowGuestLogin(false);
    setShowRegister(false);
    setActiveChat(null);
    setMobileSidebarOpen(true);
    setIsSearchingStranger(false);
    socket.emit('leave_stranger_queue');

    // E2EE Setup
    try {
      const storedPrivateKey = localStorage.getItem(`privateKey_${userData.id}`);
      if (!storedPrivateKey) {
        console.log('Generating E2EE keys...');
        const keyPair = await generateKeyPair();
        const publicKeyPem = await exportPublicKey(keyPair.publicKey);
        const privateKeyPem = await exportPrivateKey(keyPair.privateKey);

        localStorage.setItem(`privateKey_${userData.id}`, privateKeyPem);

        await axios.put('/api/users/public-key', { public_key: publicKeyPem }, {
          headers: { 'x-auth-token': jwtToken }
        }).catch(err => console.error("Could not save public key to backend. Make sure the column exists.", err));
      } else if (!userData.public_key) {
        // We have local key but backend is missing it (e.g. after adding column later)
        // We need the corresponding public key. For simplicity, just regenerate.
        console.log('Backend missing public key, regenerating...');
        const keyPair = await generateKeyPair();
        const publicKeyPem = await exportPublicKey(keyPair.publicKey);
        const privateKeyPem = await exportPrivateKey(keyPair.privateKey);
        localStorage.setItem(`privateKey_${userData.id}`, privateKeyPem);
        await axios.put('/api/users/public-key', { public_key: publicKeyPem }, {
          headers: { 'x-auth-token': jwtToken }
        }).catch(e => console.error(e));
      }
    } catch (err) {
      console.error('Failed to setup E2EE keys:', err);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setActiveChat(null);
    setIsSearchingStranger(false);
    socket.emit('leave_stranger_queue');
  };



  const handleDeleteAccount = async (password) => {
    if (!password) {
      alert("Password is required to delete your account.");
      return;
    }
    try {
      await axios.delete('/api/users/me', {
        headers: { 'x-auth-token': token },
        data: { password }
      });
      logout();
      alert("Your account has been deleted.");
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to delete account. Please try again.");
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, setUser }}>
      <LanguageProvider>
        <div className="app-container">
          <header className="app-header">
            <div className="brand">Chit Chat Telugu</div>
            <div className="auth-buttons">
              {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    className="my-ai-btn"
                    onClick={() => setShowAiBot(true)}
                    title="Chat with My AI"
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '24px',
                      padding: '6px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      cursor: 'pointer',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      letterSpacing: '0.3px',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={e => { 
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => { 
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Bot size={19} color="#60a5fa" strokeWidth={2.4} />
                    <span>My AI</span>
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() => setShowSettings(true)}
                    style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', padding: '0 10px', cursor: 'pointer', color: 'white' }}
                  >
                    ☰
                  </button>
                </div>
              ) : (
                <>
                  <button className="btn-secondary" onClick={() => setShowLogin(true)}>Log in</button>
                  <button className="btn-primary" onClick={() => setShowRegister(true)}>Sign up</button>
                </>
              )}
            </div>
          </header>

          {!user && !showLogin && !showRegister && !showForgotPassword && !showResetPassword && !showGuestLogin && (
            <WelcomeScreen
              onSignUp={() => setShowRegister(true)}
              onLogin={() => setShowLogin(true)}
            />
          )}

          <div className="main-content">
            <div className={`sidebar-wrapper ${activeChat ? 'mobile-hidden' : ''}`}>
              <UserSidebar
                activeChat={activeChat}
                setActiveChat={handleSetActiveChat}
                users={users}
                setUsers={setUsers}
                myGroups={myGroups}
                setMyGroups={setMyGroups}
                onlineUsers={onlineUsers}
                mobileSidebarOpen={mobileSidebarOpen}
                socket={socket}
                isSearchingStranger={isSearchingStranger}
                setIsSearchingStranger={setIsSearchingStranger}
                unreadCounts={unreadCounts}
                activeGroupCalls={activeGroupCalls}
              />
            </div>

            <div className={`chat-wrapper ${!activeChat ? 'mobile-hidden' : ''}`}>
              {activeChat ? (
                <ChatBox
                  socket={socket}
                  activeChat={activeChat}
                  onInitiateCall={initiateCall}
                  onInitiateGroupCall={handleInitiateGroupCall}
                  activeGroupCalls={activeGroupCalls}
                  users={users}
                  myGroups={myGroups}
                  setMyGroups={setMyGroups}
                  onlineUsers={onlineUsers}
                  onBackToSidebar={() => {
                    setActiveChat(null);
                    setMobileSidebarOpen(true);
                  }}
                  strangerUserIds={strangerUserIds}
                />
              ) : (
                <div className="no-chat-selected">
                  <div className="no-chat-card">
                    <div className="no-chat-logo">
                      <div className="no-chat-icon">💬</div>
                    </div>
                    <h2>Chit Chat Telugu</h2>
                    <p>Select a conversation from the left to start chatting, make secure encrypted calls, or meet new people with Stranger Chat!</p>
                    <div className="no-chat-features">
                      <span>🔒 End-to-End Encrypted</span>
                      <span>⚡ HD Audio & Video Calls</span>
                      <span>🤖 My AI Bot Assistant</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {showLogin && (
            <LoginModal
              onClose={() => setShowLogin(false)}
              onForgotPassword={() => { setShowLogin(false); setShowForgotPassword(true); }}
              onRegister={() => { setShowLogin(false); setShowRegister(true); }}
              onGuestLogin={() => { setShowLogin(false); setShowGuestLogin(true); }}
            />
          )}
          {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
          {showGuestLogin && <GuestLoginModal onClose={() => setShowGuestLogin(false)} />}
          {showForgotPassword && <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />}
          {showResetPassword && <ResetPasswordModal token={resetToken} onClose={() => setShowResetPassword(false)} />}

          {showSettings && (
            <SettingsMenu
              onClose={() => setShowSettings(false)}
              onOpenAccount={() => { setShowSettings(false); setShowAccount(true); }}
              onOpenNotifications={() => { setShowSettings(false); setShowNotifications(true); }}
              onOpenPrivacy={() => { setShowSettings(false); setShowPrivacy(true); }}
              onOpenLanguage={() => { setShowSettings(false); setShowLanguage(true); }}
              onCheckUpdate={() => { setShowSettings(false); setShowUpdatesModal(true); }}
            />
          )}

          {showUpdatesModal && (
            <UpdatesModal
              onClose={() => setShowUpdatesModal(false)}
            />
          )}

          {showAccount && (
            <AccountModal
              onClose={() => setShowAccount(false)}
              onLogout={() => { setShowAccount(false); logout(); }}
              onDeleteAccount={(password) => { setShowAccount(false); handleDeleteAccount(password); }}
            />
          )}

          {showNotifications && (
            <NotificationsMenu
              onClose={() => setShowNotifications(false)}
            />
          )}

          {showPrivacy && (
            <PrivacyMenu
              onClose={() => setShowPrivacy(false)}
            />
          )}

          {showLanguage && (
            <LanguageMenu
              onClose={() => setShowLanguage(false)}
            />
          )}

          {showAiBot && (
            <AiBotModal
              onClose={() => setShowAiBot(false)}
            />
          )}

          {callSession.state !== 'idle' && (
            <CallOverlay
              socket={socket}
              user={user}
              callState={callSession.state}
              otherUser={callSession.otherUser}
              acceptedSignal={callSession.acceptedSignal}
              incomingSignal={callSession.incomingSignal}
              iceCandidates={iceCandidatesMap.current[callSession.otherUser?.id] || []}
              onHangUp={resetCallSession}
              onAcceptCall={acceptIncomingCall}
              onDeclineCall={resetCallSession}
              role={callSession.role}
              callType={callSession.callType}
            />
          )}

          {groupCallSession.active && (
            <GroupCallOverlay
              socket={socket}
              user={user}
              groupId={groupCallSession.groupId}
              groupName={groupCallSession.groupName}
              callType={groupCallSession.callType}
              onLeaveCall={handleLeaveGroupCall}
            />
          )}
        </div>
      </LanguageProvider>
    </AuthContext.Provider>
  );
}

export default App;
