import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ProfileEditor from './ProfileEditor';
import ProfileViewer from './ProfileViewer';
import Avatar from './Avatar';
import CreateGroupModal from './CreateGroupModal';
import StoryViewsModal from './StoryViewsModal';
import StoryViewerModal from './StoryViewerModal';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const UserSidebar = ({ activeChat, setActiveChat, users, setUsers, onlineUsers = new Set(), mobileSidebarOpen = true, socket, isSearchingStranger, setIsSearchingStranger, myGroups, setMyGroups, unreadCounts = {} }) => {
  const { user, token, setUser } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'friends', 'requests', 'groups', 'stories'
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showStoryViews, setShowStoryViews] = useState(false);
  const [viewingStoryUrl, setViewingStoryUrl] = useState(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);
  const [uploadingStory, setUploadingStory] = useState(false);

  const friends = user?.friends || [];
  const [friendRequests, setFriendRequests] = useState(user?.friendRequests || []);
  const [recentConversations, setRecentConversations] = useState({});

  useEffect(() => {
    setFriendRequests(user?.friendRequests || []);
  }, [user?.friendRequests]);

  useEffect(() => {
    if (!token || !user) return;

    const fetchRecentConversations = async () => {
      try {
        const res = await axios.get('/api/messages/recent/conversations', {
          headers: { 'x-auth-token': token }
        });
        if (res.data) {
          setRecentConversations(res.data);
        }
      } catch (err) {
        console.error('Error fetching recent conversations:', err);
      }
    };

    fetchRecentConversations();

    const handleNewMessage = (data) => {
      const myId = user.id || user._id;
      const otherId = (data.room && data.room.startsWith('stranger_'))
        ? null
        : (data.senderId === myId ? data.recipientId : data.senderId);

      if (otherId) {
        setRecentConversations(prev => ({
          ...prev,
          [otherId]: {
            lastMessageTime: data.timestamp || new Date().toISOString(),
            lastMessageText: data.text || (data.imageUrl ? '📷 Photo' : (data.fileUrl ? '📁 File' : (data.stickerUrl ? '🎨 Sticker' : 'Message')))
          }
        }));
      }
    };

    if (socket) {
      socket.on('receive_private_message', handleNewMessage);
    }
    return () => {
      if (socket) {
        socket.off('receive_private_message', handleNewMessage);
      }
    };
  }, [token, user, socket]);

  const handleFriendAction = async (action, targetId) => {
    try {
      await axios.post(`/api/users/${action}/${targetId}`, {}, {
        headers: { 'x-auth-token': token }
      });
      if (action === 'friend-request') {
        socket.emit('send_friend_request', { senderId: user.id || user._id, targetId });
        alert("Friend request sent!");
      } else {
        const meRes = await axios.get('/api/users/me', { headers: { 'x-auth-token': token } });
        if (meRes.data && setUser) {
          setUser(meRes.data);
          localStorage.setItem('user', JSON.stringify(meRes.data));
        }
        const usersRes = await axios.get('/api/users', { headers: { 'x-auth-token': token } });
        if (usersRes.data && setUsers) {
          setUsers(usersRes.data);
        }
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Error performing action');
    }
  };

  const handleStoryUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingStory(true);
    const formData = new FormData();
    formData.append('media', file);
    formData.append('type', 'status');

    try {
      const res = await axios.post('/api/media/upload-profile-media', formData, {
        headers: { 
          'x-auth-token': token,
          'Content-Type': 'multipart/form-data'
        }
      });
      if (setUser && res.data?.url) {
        const updatedUser = { ...user, statusVideoUrl: res.data.url, story_views: [] };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      alert('Story uploaded successfully!');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.msg || 'Upload failed');
    } finally {
      setUploadingStory(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteStory = async () => {
    if (!window.confirm("Are you sure you want to delete your story?")) return;
    try {
      await axios.delete('/api/media/story', {
        headers: { 'x-auth-token': token }
      });
      if (setUser) {
        const updatedUser = { ...user, statusVideoUrl: null, story_views: [] };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      setViewingStoryUrl(null);
      alert("Story deleted successfully!");
    } catch (err) {
      console.error('Delete Story Error:', err);
      alert(err.response?.data?.msg || 'Failed to delete story');
    }
  };

  const handleRecordView = async (targetUserId) => {
    try {
      await axios.post(`/api/users/story-view/${targetUserId}`, {}, {
        headers: { 'x-auth-token': token }
      });
    } catch (err) {
      console.error('Error recording view:', err);
    }
  };

  const filteredFriends = friends.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const sortedFriends = [...filteredFriends].sort((a, b) => {
    const aId = a.id || a._id;
    const bId = b.id || b._id;
    const aTime = recentConversations[aId]?.lastMessageTime ? new Date(recentConversations[aId].lastMessageTime).getTime() : 0;
    const bTime = recentConversations[bId]?.lastMessageTime ? new Date(recentConversations[bId].lastMessageTime).getTime() : 0;
    if (bTime !== aTime) {
      return bTime - aTime;
    }
    return (a.username || '').localeCompare(b.username || '');
  });

  const searchedUsers = users.filter(u => {
    if (!search) return false;
    const s = search.toLowerCase();
    if (friends.some(f => (f.id || f._id) === (u.id || u._id))) return false;
    if (friendRequests.some(r => (r.id || r._id) === (u.id || u._id))) return false;
    return (u.id && u.id.toLowerCase().includes(s)) || 
           (u.email && u.email.toLowerCase().includes(s)) ||
           (u.username && u.username.toLowerCase().includes(s));
  });

  const handleFindStranger = () => {
    if (!user) {
      alert("Please login to chat with strangers.");
      return;
    }
    setIsSearchingStranger(true);
    socket.emit('find_stranger', user.id || user._id);
  };

  const handleCancelSearch = () => {
    setIsSearchingStranger(false);
    socket.emit('leave_stranger_queue');
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
            placeholder={t('search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          {t('chats')}
        </button>
        <button className={`sidebar-tab-btn ${activeTab === 'stories' ? 'active' : ''}`} onClick={() => setActiveTab('stories')}>
          {t('stories')}
        </button>
        <button className={`sidebar-tab-btn ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => setActiveTab('friends')}>
          {t('friends')}
        </button>
        <button className={`sidebar-tab-btn ${activeTab === 'groups' ? 'active' : ''}`} onClick={() => setActiveTab('groups')}>
          {t('groups')}
        </button>
        <button
          className={`sidebar-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
          style={{ position: 'relative' }}
        >
          {t('requests')}
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
      </div>

      <div className="sidebar-list">

        {/* ========== CHATS TAB ========== */}
        {activeTab === 'chats' && (
          <>
            {/* Stranger Chat Matchmaking */}
            {user && (
              <div 
                className="sidebar-item" 
                style={{ background: isSearchingStranger ? '#fff3cd' : '#e8f0fe', cursor: isSearchingStranger ? 'default' : 'pointer' }}
                onClick={!isSearchingStranger ? handleFindStranger : undefined}
              >
                <div className="avatar avatar-public" style={{ background: isSearchingStranger ? '#ffc107' : '#1a73e8' }}>🎲</div>
                <div className="sidebar-item-meta">
                  <div className="sidebar-item-top">
                    <span className="sidebar-item-name" style={{ color: '#000' }}>
                      {isSearchingStranger ? "Searching..." : "Chat with Stranger"}
                    </span>
                  </div>
                  <div className="sidebar-item-status" style={{ color: '#333' }}>
                    {isSearchingStranger ? "Looking for a random partner..." : "Start an anonymous 1-on-1 chat"}
                  </div>
                </div>
                {isSearchingStranger && (
                  <button className="btn-cancel" onClick={(e) => { e.stopPropagation(); handleCancelSearch(); }} style={{ fontSize: '0.7rem', padding: '4px 8px' }}>Cancel</button>
                )}
              </div>
            )}

            {/* Private Chats */}
            {user && (
              <>
                <div className="sidebar-section-label">Private Messages</div>
                {filteredFriends.length === 0 && (
                  <div className="no-users">
                    {friends.length === 0
                      ? "No friends yet — add them from search!"
                      : 'No results for "' + search + '"'}
                  </div>
                )}
                {sortedFriends.map(u => {
                  const uId = u.id || u._id;
                  const isOnline = onlineUsers.has(uId);
                  const lastChat = recentConversations[uId];
                  const timeFormatted = lastChat?.lastMessageTime
                    ? new Date(lastChat.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={uId}
                      className={`sidebar-item ${activeChat === uId ? 'active' : ''}`}
                      onClick={() => setActiveChat(uId)}
                    >
                      <div style={{ position: 'relative' }}>
                        <Avatar userId={uId} username={u.username} size={44} />
                        {isOnline
                          ? <span className="online-dot" />
                          : <span className="offline-dot" />
                        }
                      </div>
                      <div className="sidebar-item-meta">
                        <div className="sidebar-item-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div>
                            <span className="sidebar-item-name">{u.username}</span>
                            {u.profileSongUrl && <span title="Has profile song" style={{ fontSize: '0.7rem', marginLeft: 4 }}>🎵</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {timeFormatted && (
                              <span style={{ fontSize: '0.7rem', color: '#8e8ea0' }}>{timeFormatted}</span>
                            )}
                            {unreadCounts[uId] > 0 && (
                              <div style={{
                                background: '#25d366', color: 'white', borderRadius: '10px',
                                padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold'
                              }}>
                                {unreadCounts[uId] > 9 ? '9+' : unreadCounts[uId]}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="sidebar-item-status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={isOnline ? 'status-online' : ''} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                            {lastChat?.lastMessageText 
                              ? (lastChat.lastMessageText.startsWith('E2EE:') ? '🔒 Encrypted message' : (lastChat.lastMessageText.startsWith('📞') || lastChat.lastMessageText.startsWith('❌') ? lastChat.lastMessageText : lastChat.lastMessageText)) 
                              : (isOnline ? 'Online' : 'Offline')}
                          </span>
                          {u.statusVideoUrl && <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>📹 Status</span>}
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

            {user && search && searchedUsers.length > 0 && (
              <>
                <div className="sidebar-section-label" style={{ marginTop: '20px' }}>Global Search Results</div>
                {searchedUsers.map(u => (
                  <div key={u.id || u._id} className="sidebar-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                      <div style={{ cursor: 'pointer' }} onClick={() => setViewingProfile(u)}>
                        <Avatar userId={u.id || u._id} username={u.username} size={44} />
                      </div>
                      <div className="sidebar-item-meta" style={{ flex: 1 }}>
                        <div className="sidebar-item-name">{u.username}</div>
                        <div className="sidebar-item-status" style={{ fontSize: '0.75rem' }}>ID: {u.id || u._id}</div>
                      </div>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '16px' }}
                        onClick={(e) => { e.stopPropagation(); handleFriendAction('friend-request', u.id || u._id); }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ========== GROUPS TAB ========== */}
        {activeTab === 'groups' && (
          <>
            <button 
              className="btn-primary" 
              style={{ width: '100%', marginBottom: '15px' }}
              onClick={() => setShowCreateGroup(true)}
            >
              + Create New Group
            </button>
            <div className="users-list">
              {myGroups.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
                  You are not in any groups yet.
                </div>
              ) : (
                myGroups.map(group => (
                  <div 
                    key={group.id} 
                    className={`sidebar-item ${activeChat === group.id ? 'active' : ''}`}
                    onClick={() => setActiveChat(group.id)}
                  >
                    <div style={{ position: 'relative' }}>
                      <div className="avatar avatar-public" style={{ width: 44, height: 44, fontSize: '1.2rem', background: '#e91e63' }}>
                        👥
                      </div>
                    </div>
                    <div className="sidebar-item-meta" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div className="sidebar-item-name">{group.name}</div>
                        {unreadCounts[group.id] > 0 && (
                          <div style={{
                            background: '#25d366', color: 'white', borderRadius: '10px',
                            padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold'
                          }}>
                            {unreadCounts[group.id] > 9 ? '9+' : unreadCounts[group.id]}
                          </div>
                        )}
                      </div>
                      <div className="sidebar-item-status">Group Chat</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ========== REQUESTS TAB ========== */}
        {activeTab === 'requests' && (
          <>
            <div className="sidebar-section-label">Pending Friend Requests</div>
            {friendRequests.length === 0 && (
              <div className="no-users">No pending requests 🎉</div>
            )}
            {friendRequests.map(u => (
              <div key={u.id || u._id} className="sidebar-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => setViewingProfile(u)}>
                    <Avatar userId={u.id || u._id} username={u.username} size={44} />
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

        {/* ========== STORIES TAB ========== */}
        {activeTab === 'stories' && (
          <>
            <div className="sidebar-section-label">{t('my_story')}</div>
            {user ? (
              <div 
                className="sidebar-item" 
                onClick={() => !uploadingStory && fileInputRef.current?.click()}
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <div style={{ position: 'relative' }}>
                  <Avatar userId={user.id || user._id} username={user.username} size={44} />
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2,
                    background: '#25d366', color: 'white', borderRadius: '50%',
                    width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 'bold', border: '2px solid var(--sidebar-bg)'
                  }}>+</span>
                </div>
                <div className="sidebar-item-meta" style={{ flex: 1 }}>
                  <div className="sidebar-item-name">{uploadingStory ? 'Uploading...' : 'My Story'}</div>
                  <div className="sidebar-item-status">
                    {uploadingStory ? 'Please wait...' : 'Tap to add story (Max 1 min)'}
                  </div>
                  {user.statusVideoUrl && !uploadingStory && (
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#25d366', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }} onClick={(e) => { e.stopPropagation(); setViewingStoryUrl(user.statusVideoUrl); }}>▶ View My Story</span>
                      <button onClick={(e) => { e.stopPropagation(); setShowStoryViews(true); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.1rem', padding: '0 2px' }} title="Viewers">👁️</button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteStory(); }} 
                        style={{ 
                          background: 'rgba(239, 68, 68, 0.15)', 
                          border: '1px solid rgba(239, 68, 68, 0.35)', 
                          color: '#ef4444', 
                          borderRadius: '4px',
                          padding: '2px 7px',
                          cursor: 'pointer', 
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontWeight: '500'
                        }} 
                        title="Delete My Story"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="video/*" 
                  style={{ display: 'none' }} 
                  onChange={handleStoryUpload}
                />
              </div>
            ) : (
              <div className="no-users">Login to post a story</div>
            )}
            
            <div className="sidebar-section-label" style={{ marginTop: '20px' }}>{t('friends_stories')}</div>
            {filteredFriends.filter(f => f.statusVideoUrl).length === 0 ? (
              <div className="no-users">{t('no_recent_stories')}</div>
            ) : (
              filteredFriends.filter(f => f.statusVideoUrl).map(u => (
                <div 
                  key={u.id || u._id} 
                  className="sidebar-item" 
                  onClick={() => {
                    handleRecordView(u.id || u._id);
                    setViewingStoryUrl(u.statusVideoUrl);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ position: 'relative', padding: '2px', border: '2px solid #25d366', borderRadius: '50%' }}>
                    <Avatar userId={u.id || u._id} username={u.username} size={40} />
                  </div>
                  <div className="sidebar-item-meta">
                    <div className="sidebar-item-name">{u.username}</div>
                    <div className="sidebar-item-status">
                      <span style={{ color: '#25d366' }}>▶ View Story</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ========== FRIENDS TAB ========== */}
        {activeTab === 'friends' && (
          <>
            <div className="sidebar-section-label">{t('my_friends')}</div>
            {filteredFriends.length === 0 && (
              <div className="no-users">{t('no_friends_found')}</div>
            )}
            {[...filteredFriends]
              .sort((a, b) => {
                const aOnline = onlineUsers.has(a.id || a._id);
                const bOnline = onlineUsers.has(b.id || b._id);
                if (aOnline && !bOnline) return -1;
                if (!aOnline && bOnline) return 1;
                return 0;
              })
              .map(u => {
                const isOnline = onlineUsers.has(u.id || u._id);
                return (
                  <div
                    key={u.id || u._id}
                    className={`sidebar-item ${activeChat === (u.id || u._id) ? 'active' : ''}`}
                    onClick={() => setActiveChat(u.id || u._id)}
                  >
                    <div style={{ position: 'relative' }}>
                      <Avatar userId={u.id || u._id} username={u.username} size={44} />
                      {isOnline
                        ? <span className="online-dot" />
                        : <span className="offline-dot" />
                      }
                    </div>
                    <div className="sidebar-item-meta">
                      <div className="sidebar-item-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div>
                          <span className="sidebar-item-name">{u.username}</span>
                          {u.profileSongUrl && <span title="Has profile song" style={{ fontSize: '0.7rem', marginLeft: 4 }}>🎵</span>}
                        </div>
                        {unreadCounts[u.id || u._id] > 0 && (
                          <div style={{
                            background: '#25d366', color: 'white', borderRadius: '10px',
                            padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold'
                          }}>
                            {unreadCounts[u.id || u._id] > 9 ? '9+' : unreadCounts[u.id || u._id]}
                          </div>
                        )}
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
      </div>

      {viewingProfile && (
        <ProfileViewer userProfile={viewingProfile} onClose={() => setViewingProfile(null)} />
      )}

      {showCreateGroup && (
        <CreateGroupModal 
          onClose={() => setShowCreateGroup(false)} 
          onGroupCreated={(newGroup) => {
            setMyGroups(prev => [...prev, newGroup]);
            setActiveChat(newGroup.id);
            setActiveTab('chats');
          }}
        />
      )}

      {showStoryViews && (
        <StoryViewsModal onClose={() => setShowStoryViews(false)} />
      )}

      {viewingStoryUrl && (
        <StoryViewerModal 
          videoUrl={viewingStoryUrl} 
          isOwn={user && viewingStoryUrl === user.statusVideoUrl}
          onDelete={handleDeleteStory}
          onClose={() => setViewingStoryUrl(null)} 
        />
      )}
    </div>
  );
};

export default UserSidebar;
