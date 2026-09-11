import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import './AccountModal.css';

function CreateGroupModal({ onClose, onGroupCreated }) {
  const { token, user } = useAuth();
  const [step, setStep] = useState(1); // 1 = Select Participants, 2 = Group Info & Settings
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editInfoPerm, setEditInfoPerm] = useState('all'); // 'all' | 'admins_only'
  const [sendMsgPerm, setSendMsgPerm] = useState('all'); // 'all' | 'admins_only'
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await axios.get('/api/users/me', {
          headers: { 'x-auth-token': token }
        });
        setFriends(res.data.friends || []);
      } catch (err) {
        console.error('Error fetching friends for group:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, [token]);

  const toggleFriend = (id) => {
    const newSet = new Set(selectedFriends);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedFriends(newSet);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await axios.post('/api/groups/upload-avatar', formData, {
        headers: {
          'x-auth-token': token,
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data?.avatarUrl) {
        setAvatarUrl(res.data.avatarUrl);
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      alert('Failed to upload group icon');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!groupName.trim()) {
      alert('Please enter a group subject');
      return;
    }

    setCreating(true);
    try {
      const res = await axios.post('/api/groups/create', {
        name: groupName.trim(),
        description: description.trim(),
        avatar_url: avatarUrl || null,
        memberIds: Array.from(selectedFriends),
        edit_info_permission: editInfoPerm,
        send_messages_permission: sendMsgPerm
      }, {
        headers: { 'x-auth-token': token }
      });

      if (onGroupCreated) onGroupCreated(res.data);
      onClose();
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to create group');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const filteredFriends = (friends || []).filter(f =>
    f && (f.username || '').toLowerCase().includes((search || '').toLowerCase())
  );

  const selectedList = friends.filter(f => selectedFriends.has(f.id));

  return (
    <div className="account-modal-overlay" onClick={onClose}>
      <div 
        className="account-modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '440px', background: '#111b21', color: '#e9edef' }}
      >
        {/* WhatsApp Style Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          padding: '16px 20px', background: '#202c33', color: '#e9edef',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)', position: 'sticky', top: 0, zIndex: 10
        }}>
          <button 
            onClick={step === 2 ? () => setStep(1) : onClose}
            style={{
              background: 'none', border: 'none', color: '#aebac1',
              fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center'
            }}
          >
            ←
          </button>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>
              {step === 1 ? 'New group' : 'New group'}
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#8696a0' }}>
              {step === 1 
                ? (selectedFriends.size > 0 ? `${selectedFriends.size} selected` : 'Add participants')
                : 'Add group subject'}
            </div>
          </div>
        </div>

        {/* STEP 1: SELECT PARTICIPANTS */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 65px)' }}>
            {/* Selected Chips Bar */}
            {selectedList.length > 0 && (
              <div style={{
                display: 'flex', gap: '10px', padding: '12px 16px',
                overflowX: 'auto', borderBottom: '1px solid #222e35', background: '#111b21',
                scrollbarWidth: 'none'
              }}>
                {selectedList.map(f => (
                  <div 
                    key={f.id} 
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      position: 'relative', width: '54px', flexShrink: 0
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <Avatar userId={f.id} username={f.username} size={42} />
                      <button 
                        onClick={() => toggleFriend(f.id)}
                        style={{
                          position: 'absolute', bottom: -2, right: -2,
                          background: '#8696a0', color: '#111b21', border: '2px solid #111b21',
                          borderRadius: '50%', width: '18px', height: '18px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    <span style={{
                      fontSize: '0.7rem', color: '#aebac1', marginTop: '4px',
                      maxWidth: '52px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {f.username}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Search Box */}
            <div style={{ padding: '10px 16px', background: '#111b21' }}>
              <input 
                type="text" 
                placeholder="Search name or number" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', background: '#202c33', border: 'none',
                  borderRadius: '8px', padding: '9px 14px', color: '#e9edef',
                  fontSize: '0.88rem', outline: 'none'
                }}
              />
            </div>

            {/* Contacts List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 80px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', color: '#8696a0', padding: '40px 0' }}>Loading contacts...</div>
              ) : filteredFriends.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#8696a0', padding: '40px 0', fontSize: '0.9rem' }}>
                  {friends.length === 0 ? "No friends available to add." : "No matching contacts found."}
                </div>
              ) : (
                filteredFriends.map(f => {
                  const isSelected = selectedFriends.has(f.id);
                  return (
                    <div 
                      key={f.id}
                      onClick={() => toggleFriend(f.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                        background: isSelected ? 'rgba(0, 168, 132, 0.12)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <Avatar userId={f.id} username={f.username} size={46} />
                        {isSelected && (
                          <div style={{
                            position: 'absolute', bottom: -2, right: -2,
                            background: '#00a884', color: '#111b21', borderRadius: '50%',
                            width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 900, border: '2px solid #111b21'
                          }}>
                            ✓
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, borderBottom: '1px solid #222e35', paddingBottom: '10px' }}>
                        <div style={{ color: '#e9edef', fontWeight: 600, fontSize: '0.95rem' }}>{f.username}</div>
                        <div style={{ color: '#8696a0', fontSize: '0.8rem', marginTop: '2px' }}>Hey there! I am using Chit Chat</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* WhatsApp Floating Green Next Button */}
            {selectedFriends.size > 0 && (
              <div style={{
                position: 'sticky', bottom: '20px', display: 'flex', justifyContent: 'flex-end',
                padding: '0 24px', pointerEvents: 'none'
              }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: '#00a884', color: '#111b21', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.6rem', fontWeight: 'bold', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 168, 132, 0.5)',
                    pointerEvents: 'auto', transition: 'transform 0.15s ease'
                  }}
                  title="Next"
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: GROUP INFO & SETTINGS */}
        {step === 2 && (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100% - 65px)', overflowY: 'auto' }}>
            {/* Group Icon & Subject Input Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Group Avatar Picker */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: '#202c33', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '2px dashed #00a884',
                  flexShrink: 0
                }}
                title="Add group icon"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Group Icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', color: '#00a884', fontSize: '1.4rem' }}>
                    {uploadingAvatar ? '⏳' : '📷'}
                  </div>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleAvatarUpload} 
              />

              {/* Group Name / Subject */}
              <div style={{ flex: 1, position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Type group subject here..." 
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  maxLength={25}
                  required
                  autoFocus
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    borderBottom: '2px solid #00a884', padding: '8px 0', color: '#e9edef',
                    fontSize: '1rem', outline: 'none'
                  }}
                />
                <span style={{ position: 'absolute', right: 0, bottom: '8px', color: '#8696a0', fontSize: '0.75rem' }}>
                  {25 - groupName.length}
                </span>
              </div>
            </div>

            {/* Description Input */}
            <div style={{ background: '#202c33', borderRadius: '12px', padding: '12px 14px' }}>
              <label style={{ fontSize: '0.78rem', color: '#00a884', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Group Description
              </label>
              <textarea 
                placeholder="Add group description (rules, purpose, topics)..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  color: '#e9edef', fontSize: '0.88rem', outline: 'none', resize: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* WhatsApp Group Permissions Section */}
            <div style={{ background: '#202c33', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ color: '#00a884', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⚙️ Group Settings & Permissions
              </div>

              {/* Edit Group Info Permission */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#e9edef', fontSize: '0.9rem', fontWeight: 500 }}>Edit Group Settings</div>
                  <div style={{ color: '#8696a0', fontSize: '0.75rem' }}>Who can change group icon, subject, and description</div>
                </div>
                <select
                  value={editInfoPerm}
                  onChange={e => setEditInfoPerm(e.target.value)}
                  style={{
                    background: '#111b21', color: '#00a884', border: '1px solid #00a884',
                    borderRadius: '8px', padding: '5px 8px', fontSize: '0.8rem', outline: 'none'
                  }}
                >
                  <option value="all">All members</option>
                  <option value="admins_only">Only admins</option>
                </select>
              </div>

              {/* Send Messages Permission */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2a3942', paddingTop: '12px' }}>
                <div>
                  <div style={{ color: '#e9edef', fontSize: '0.9rem', fontWeight: 500 }}>Send Messages</div>
                  <div style={{ color: '#8696a0', fontSize: '0.75rem' }}>Announcement mode: only admins can send messages</div>
                </div>
                <select
                  value={sendMsgPerm}
                  onChange={e => setSendMsgPerm(e.target.value)}
                  style={{
                    background: '#111b21', color: '#00a884', border: '1px solid #00a884',
                    borderRadius: '8px', padding: '5px 8px', fontSize: '0.8rem', outline: 'none'
                  }}
                >
                  <option value="all">All members</option>
                  <option value="admins_only">Only admins</option>
                </select>
              </div>
            </div>

            {/* Selected Participants Summary */}
            <div>
              <div style={{ fontSize: '0.8rem', color: '#8696a0', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Participants: {selectedList.length + 1} (including you)
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ background: '#202c33', color: '#00a884', padding: '4px 10px', borderRadius: '16px', fontSize: '0.78rem', fontWeight: 600 }}>
                  You (Admin)
                </span>
                {selectedList.map(f => (
                  <span key={f.id} style={{ background: '#202c33', color: '#e9edef', padding: '4px 10px', borderRadius: '16px', fontSize: '0.78rem' }}>
                    {f.username}
                  </span>
                ))}
              </div>
            </div>

            {/* WhatsApp Floating Green Create Checkmark Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '10px' }}>
              <button
                onClick={handleSubmit}
                disabled={creating || !groupName.trim()}
                style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: creating || !groupName.trim() ? '#2a3942' : '#00a884',
                  color: '#111b21', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.6rem', fontWeight: 'bold', cursor: creating || !groupName.trim() ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(0, 168, 132, 0.5)',
                  transition: 'all 0.15s ease'
                }}
                title="Create Group"
              >
                {creating ? '⏳' : '✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateGroupModal;
