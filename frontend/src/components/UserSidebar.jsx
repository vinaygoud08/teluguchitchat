import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import ProfileEditor from './ProfileEditor';
import ProfileViewer from './ProfileViewer';

const UserSidebar = ({ activeChat, setActiveChat, users, onlineUsers = new Set(), mobileSidebarOpen = true }) => {
  const { user, token } = useAuth();
  const [tab, setTab] = useState('chats'); // 'chats', 'requests', 'discover'
  const [showEditor, setShowEditor] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [search, setSearch] = useState('');

  const friends = user?.friends || [];
  const friendRequests = user?.friendRequests || [];

  const handleFriendAction = async (action, targetId) => {
    try {
      await axios.post(`/api/users/${action}/${targetId}`, {}, {
        headers: { 'x-auth-token': token }
      });
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Error performing action');
    }
  };

  const filteredFriends = friends.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  // Helper: get initials from username
  const getInitials = (name) => name ? name[0].toUpperCase() : '?';

  // Helper: unique color per user based on name
  const getAvatarStyle = (name) => {
    const hue = name ? (name.charCodeAt(0) * 37 + name.length * 13) % 360 : 200;
    return { background: `linear-gradient(135deg, hsl(${hue}, 65%, 55%), hsl(${(hue + 60) % 360}, 65%, 45%))` };
  };

  return (
    <div className={`user-sidebar${!mobileSidebarOpen ? ' sidebar-hidden' : ''}`}>

      {/* Sidebar Search */}
      <div className="sidebar-search">
        <div className="sidebar-search-wrapper">
          <span className="sidebar-search-icon">🔍</span>
          <input
            className="sidebar-search-input"
            type="text"
            placeholder="Search or start new chat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab-btn ${tab === 'chats' ? 'active' : ''}`}
          onClick={() => setTab('chats')}
        >
          💬 Chats
        </button>
        <button
          className={`sidebar-tab-btn ${tab === 'requests' ? 'active' : ''}`}
          onClick={() => setTab('requests')}
          style={{ position: 'relative' }}
        >
          📩 Requests
          {friendRequests.length > 0 && (
            <span style={{
              position: 'absolute', top: '6px', right: '6px',
              background: '#25d366', color: 'white',
              borderRadius: '50%', width: '17px', height: '17px',
              fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700
            }}>{friendRequests.length}</span>
          )}
        </button>
        <button
          className={`sidebar-tab-btn ${tab === 'discover' ? 'active' : ''}`}
          onClick={() => setTab('discover')}
        >
          🌐 All
        </button>
      </div>

      <div className="sidebar-list">

        {/* ========== CHATS TAB ========== */}
        {tab === 'chats' && (
          <>
            {/* Edit Profile Button */}
            {user && (
              <button className="sidebar-profile-btn" onClick={() => setShowEditor(true)}>
                ✏️ Edit Status & Profile Song
              </button>
            )}

            {/* Public Chat */}
            <div className="sidebar-section-label">Public</div>
            <div
              className={`sidebar-item ${activeChat === 'home' ? 'active' : ''}`}
              onClick={() => setActiveChat('home')}
            >
              <div className="avatar avatar-public">🌐</div>
              <div className="sidebar-item-meta">
                <div className="sidebar-item-top">
                  <span className="sidebar-item-name">Random Chat</span>
                  <span className="sidebar-item-time">Public</span>
                </div>
                <div className="sidebar-item-status">
                  Open global conversation
                </div>
              </div>
            </div>

            {/* Private Chats */}
            {user && (
              <>
                <div className="sidebar-section-label">Private Messages</div>
                {filteredFriends.length === 0 && (
                  <div className="no-users">
                    {friends.length === 0
                      ? "No friends yet — find them in the 'All' tab"
                      : 'No results for "' + search + '"'}
                  </div>
                )}
                {filteredFriends.map(u => {
                  const isOnline = onlineUsers.has(u.id || u._id);
                  return (
                    <div
                      key={u.id || u._id}
                      className={`sidebar-item ${activeChat === (u.id || u._id) ? 'active' : ''}`}
                      onClick={() => setActiveChat(u.id || u._id)}
                    >
                      <div className="avatar" style={{ position: 'relative', ...getAvatarStyle(u.username) }}>
                        {getInitials(u.username)}
                        {isOnline
                          ? <span className="online-dot" />
                          : <span className="offline-dot" />
                        }
                      </div>
                      <div className="sidebar-item-meta">
                        <div className="sidebar-item-top">
                          <span className="sidebar-item-name">{u.username}</span>
                          {u.profileSongUrl && <span title="Has profile song" style={{ fontSize: '0.7rem' }}>🎵</span>}
                        </div>
                        <div className="sidebar-item-status">
                          <span className={isOnline ? 'status-online' : ''}>
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                          {u.statusVideoUrl && <span>📹 Status</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {!user && (
              <div className="sidebar-login-prompt">
                Login to see your private messages and friends.
              </div>
            )}
          </>
        )}

        {/* ========== REQUESTS TAB ========== */}
        {tab === 'requests' && (
          <>
            <div className="sidebar-section-label">Pending Friend Requests</div>
            {friendRequests.length === 0 && (
              <div className="no-users">No pending requests 🎉</div>
            )}
            {friendRequests.map(u => (
              <div key={u.id || u._id} className="sidebar-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <div
                    className="avatar"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setViewingProfile(u)}
                  >
                    {getInitials(u.username)}
                  </div>
                  <div className="sidebar-item-meta">
                    <div className="sidebar-item-name">{u.username}</div>
                    <div className="sidebar-item-status">Wants to connect with you</div>
                  </div>
                </div>
                <div className="request-actions" style={{ width: '100%', paddingLeft: 60 }}>
                  <button className="accept-btn" onClick={() => handleFriendAction('accept-friend', u.id || u._id)}>✓ Accept</button>
                  <button className="decline-btn" onClick={() => handleFriendAction('reject-friend', u.id || u._id)}>✗ Decline</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ========== DISCOVER TAB ========== */}
        {tab === 'discover' && (
          <>
            <div className="sidebar-section-label">All Users</div>
            {filteredUsers.length === 0 && (
              <div className="no-users">No users found</div>
            )}
            {filteredUsers.map(u => {
              const isFriend = friends.some(f => (f.id || f._id) === (u.id || u._id));
              const isOnline = onlineUsers.has(u.id || u._id);
              return (
                <div key={u.id || u._id} className="sidebar-item">
                  <div
                    className="avatar"
                    style={{ cursor: 'pointer', position: 'relative' }}
                    onClick={() => setViewingProfile(u)}
                    title="View Profile"
                  >
                    {getInitials(u.username)}
                    {isOnline ? <span className="online-dot" /> : <span className="offline-dot" />}
                  </div>
                  <div className="sidebar-item-meta">
                    <div className="sidebar-item-top">
                      <span className="sidebar-item-name">{u.username}</span>
                      {isFriend
                        ? <span className="friend-badge">Friend ✓</span>
                        : <button
                            className="add-friend-btn"
                            onClick={(e) => { e.stopPropagation(); handleFriendAction('friend-request', u.id || u._id); }}
                          >+ Add</button>
                      }
                    </div>
                    <div className="sidebar-item-status">
                      <span className={isOnline ? 'status-online' : ''}>{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

      </div>

      {showEditor && <ProfileEditor onClose={() => setShowEditor(false)} />}
      {viewingProfile && <ProfileViewer userProfile={viewingProfile} onClose={() => setViewingProfile(null)} />}
    </div>
  );
};

export default UserSidebar;
