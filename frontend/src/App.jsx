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

const socket = io(import.meta.env.VITE_BACKEND_URL || '/');

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGuestLogin, setShowGuestLogin] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const [activeChat, setActiveChat] = useState('home');
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const [isSearchingStranger, setIsSearchingStranger] = useState(false);
  const [strangerUserIds, setStrangerUserIds] = useState({}); // room -> hidden userId

  const handleSetActiveChat = (chatId) => {
    setActiveChat(chatId);
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
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
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
  }, []);

  // Fetch users list and current user profile
  useEffect(() => {
    if (token) {
      // Fetch all users for Discover tab
      axios.get('/api/users', {
        headers: { 'x-auth-token': token }
      }).then(res => {
        setUsers(res.data);
      }).catch(err => console.error(err));

      // Fetch current user with populated friends and requests
      axios.get('/api/users/me', {
        headers: { 'x-auth-token': token }
      }).then(res => {
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      }).catch(err => console.error(err));

    } else {
      setUsers([]);
      setActiveChat('home');
    }
  }, [token]);

  // Socket signaling configuration for calls
  useEffect(() => {
    if (user) {
      socket.emit('join_user', user.id);
    }
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
      setCallSession({
        state: 'incoming',
        role: 'callee',
        otherUser: { id: data.from, username: data.name },
        incomingSignal: data.signal,
        acceptedSignal: null,
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
      iceCandidatesMap.current[data.from].push(data.candidate);
      
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

    return () => {
      socket.off('call_incoming', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('ice_candidate', handleIceCandidate);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_declined', handleCallDeclined);
      socket.off('stranger_match', handleStrangerMatch);
      socket.off('stranger_left', handleStrangerLeft);
    };
  }, [user]);

  const resetCallSession = () => {
    iceCandidatesMap.current = {};
    setCallSession({
      state: 'idle',
      role: null,
      otherUser: null,
      acceptedSignal: null,
      incomingSignal: null,
      trigger: 0,
    });
  };

  const initiateCall = () => {
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
    });
  };

  const acceptIncomingCall = () => {
    setCallSession(prev => ({
      ...prev,
      state: 'connected'
    }));
  };

  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setShowLogin(false);
    setShowGuestLogin(false);
    setShowRegister(false);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setActiveChat('home');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      <div className="app-container">
        <header className="app-header">
          <div className="brand">Chit Chat Telugu</div>
          <div className="auth-buttons">
            {user ? (
              <>
                <button className="btn-secondary" onClick={() => setShowProfile(true)} style={{ marginRight: '10px' }}>My Profile</button>
                <button className="btn-secondary" onClick={logout}>Logout</button>
              </>
            ) : (
              <>
                <button className="btn-secondary" onClick={() => setShowLogin(true)}>Login</button>
                <button className="btn-primary" onClick={() => setShowRegister(true)}>Register</button>
              </>
            )}
          </div>
        </header>

        <div className="main-content">
          <UserSidebar
            activeChat={activeChat}
            setActiveChat={handleSetActiveChat}
            users={users}
            setUsers={setUsers}
            onlineUsers={onlineUsers}
            mobileSidebarOpen={mobileSidebarOpen}
            socket={socket}
            isSearchingStranger={isSearchingStranger}
            setIsSearchingStranger={setIsSearchingStranger}
          />
          <ChatBox
            socket={socket}
            activeChat={activeChat}
            onInitiateCall={initiateCall}
            users={users}
            onlineUsers={onlineUsers}
            onBackToSidebar={() => setMobileSidebarOpen(true)}
            strangerUserIds={strangerUserIds}
          />
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
        {showProfile && <MyProfileModal onClose={() => setShowProfile(false)} />}

        {callSession.state !== 'idle' && (
          <CallOverlay
            socket={socket}
            user={user}
            callState={callSession.state}
            role={callSession.role}
            otherUser={callSession.otherUser}
            acceptedSignal={callSession.acceptedSignal}
            incomingSignal={callSession.incomingSignal}
            iceCandidates={[...(iceCandidatesMap.current[callSession.otherUser?.id] || [])]}
            onHangUp={resetCallSession}
            onAcceptCall={acceptIncomingCall}
            onDeclineCall={resetCallSession}
          />
        )}
      </div>
    </AuthContext.Provider>
  );
}

export default App;
