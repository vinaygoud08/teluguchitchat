import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import './AccountModal.css';

const GroupInfoModal = ({ group, onClose, onGroupUpdated, onGroupDeleted, onInitiateCall, initialAddMode = false }) => {
  const { token, user } = useAuth();
  const [details, setDetails] = useState(group);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchMember, setSearchMember] = useState('');

  // Editing modes
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(group.name || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState(group.description || '');

  // Sub-screens & Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [selectedMemberAction, setSelectedMemberAction] = useState(null); // Member clicked for admin action menu

  // Add members state
  const [friends, setFriends] = useState([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState(new Set());
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Group settings permissions
  const [editInfoPerm, setEditInfoPerm] = useState(group.edit_info_permission || 'all');
  const [sendMsgPerm, setSendMsgPerm] = useState(group.send_messages_permission || 'all');

  const fileInputRef = useRef(null);

  const myId = user?.id || user?._id;
  const myMember = members.find(m => (m.id || m._id) === myId);
  const isAdmin = myMember?.role === 'admin';
  const isCreator = details.created_by === myId;
  const canEditInfo = isAdmin || editInfoPerm !== 'admins_only';

  // Fetch full details and members
  const fetchGroupDetails = async () => {
    try {
      const res = await axios.get(`/api/groups/${group.id}/details`, {
        headers: { 'x-auth-token': token }
      });
      if (res.data) {
        setDetails(res.data);
        setMembers(res.data.members || []);
        setEditedName(res.data.name || '');
        setEditedDesc(res.data.description || '');
        setEditInfoPerm(res.data.edit_info_permission || 'all');
        setSendMsgPerm(res.data.send_messages_permission || 'all');
        if (onGroupUpdated) onGroupUpdated(res.data);
      }
    } catch (err) {
      console.error('Error fetching group details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
    if (initialAddMode) {
      handleOpenAddMembers();
    }
  }, [group.id, token, initialAddMode]);

  // Upload Group Avatar
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const uploadRes = await axios.post('/api/groups/upload-avatar', formData, {
        headers: {
          'x-auth-token': token,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (uploadRes.data?.avatarUrl) {
        const updateRes = await axios.put(`/api/groups/${group.id}`, {
          avatar_url: uploadRes.data.avatarUrl
        }, {
          headers: { 'x-auth-token': token }
        });
        setDetails(prev => ({ ...prev, avatar_url: uploadRes.data.avatarUrl }));
        if (onGroupUpdated) onGroupUpdated(updateRes.data);
      }
    } catch (err) {
      alert('Failed to upload group icon');
      console.error(err);
    }
  };

  // Save Subject / Name
  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    try {
      const res = await axios.put(`/api/groups/${group.id}`, {
        name: editedName.trim()
      }, {
        headers: { 'x-auth-token': token }
      });
      setDetails(prev => ({ ...prev, name: editedName.trim() }));
      setIsEditingName(false);
      if (onGroupUpdated) onGroupUpdated(res.data);
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to update group name');
    }
  };

  // Save Description
  const handleSaveDesc = async () => {
    try {
      const res = await axios.put(`/api/groups/${group.id}`, {
        description: editedDesc.trim()
      }, {
        headers: { 'x-auth-token': token }
      });
      setDetails(prev => ({ ...prev, description: editedDesc.trim() }));
      setIsEditingDesc(false);
      if (onGroupUpdated) onGroupUpdated(res.data);
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to update description');
    }
  };

  // Save Group Permissions
  const handleSavePermissions = async (newEditPerm, newSendPerm) => {
    try {
      const res = await axios.put(`/api/groups/${group.id}`, {
        edit_info_permission: newEditPerm,
        send_messages_permission: newSendPerm
      }, {
        headers: { 'x-auth-token': token }
      });
      setEditInfoPerm(newEditPerm);
      setSendMsgPerm(newSendPerm);
      setDetails(prev => ({ ...prev, edit_info_permission: newEditPerm, send_messages_permission: newSendPerm }));
      if (onGroupUpdated) onGroupUpdated(res.data);
      alert('Group settings updated!');
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to update settings');
    }
  };

  const [searchAddUser, setSearchAddUser] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);

  // Open Add Members modal & fetch friends and all users
  const handleOpenAddMembers = async () => {
    setShowAddMembersModal(true);
    setLoadingFriends(true);
    try {
      const [meRes, allUsersRes] = await Promise.all([
        axios.get('/api/users/me', { headers: { 'x-auth-token': token } }).catch(() => ({ data: {} })),
        axios.get('/api/users', { headers: { 'x-auth-token': token } }).catch(() => ({ data: [] }))
      ]);

      const myFriends = meRes.data?.friends || [];
      const allUsers = Array.isArray(allUsersRes.data) ? allUsersRes.data : [];
      const currentMemberIds = new Set(members.map(m => m.id || m._id));

      // Combine friends and all users, avoiding duplicates and excluding current members & self
      const candidatesMap = new Map();
      myFriends.forEach(f => {
        const id = f.id || f._id;
        if (id && id !== myId && !currentMemberIds.has(id)) {
          candidatesMap.set(id, { ...f, id, isFriend: true });
        }
      });
      allUsers.forEach(u => {
        const id = u.id || u._id;
        if (id && id !== myId && !currentMemberIds.has(id) && !candidatesMap.has(id)) {
          candidatesMap.set(id, { ...u, id, isFriend: false });
        }
      });

      setAvailableUsers(Array.from(candidatesMap.values()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Add selected members to group
  const handleAddMembersSubmit = async () => {
    if (selectedNewMembers.size === 0) return;
    try {
      await axios.post(`/api/groups/${group.id}/members`, {
        memberIds: Array.from(selectedNewMembers)
      }, {
        headers: { 'x-auth-token': token }
      });
      setSelectedNewMembers(new Set());
      setShowAddMembersModal(false);
      fetchGroupDetails();
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to add members');
    }
  };

  // Toggle Admin role (Promote / Dismiss)
  const handleToggleAdminRole = async (targetUserId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await axios.put(`/api/groups/${group.id}/members/${targetUserId}/role`, {
        role: newRole
      }, {
        headers: { 'x-auth-token': token }
      });
      setSelectedMemberAction(null);
      fetchGroupDetails();
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to update role');
    }
  };

  // Remove Member
  const handleRemoveMember = async (targetUserId, username) => {
    if (!window.confirm(`Are you sure you want to remove ${username} from the group?`)) return;
    try {
      await axios.delete(`/api/groups/${group.id}/members/${targetUserId}`, {
        headers: { 'x-auth-token': token }
      });
      setSelectedMemberAction(null);
      fetchGroupDetails();
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to remove member');
    }
  };

  // Exit Group (Leave)
  const handleExitGroup = async () => {
    if (!window.confirm("Are you sure you want to exit this group?")) return;
    try {
      await axios.delete(`/api/groups/${group.id}/members/${myId}`, {
        headers: { 'x-auth-token': token }
      });
      if (onGroupDeleted) onGroupDeleted(group.id);
      onClose();
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to leave group');
    }
  };

  // Delete Group (Admin only)
  const handleDeleteGroup = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this group for all participants?")) return;
    try {
      await axios.delete(`/api/groups/${group.id}`, {
        headers: { 'x-auth-token': token }
      });
      if (onGroupDeleted) onGroupDeleted(group.id);
      onClose();
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to delete group');
    }
  };

  const filteredMembers = members.filter(m =>
    (m.username || '').toLowerCase().includes(searchMember.toLowerCase())
  );

  const formattedDate = details.created_at
    ? new Date(details.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="account-modal-overlay" onClick={onClose}>
      <div 
        className="account-modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '440px', background: '#111b21', color: '#e9edef' }}
      >
        {/* WhatsApp Group Info Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: '#202c33', color: '#e9edef',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)', position: 'sticky', top: 0, zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button 
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#aebac1', fontSize: '1.4rem', cursor: 'pointer' }}
            >
              ←
            </button>
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Group info</span>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setShowSettingsModal(true)}
              style={{
                background: 'none', border: 'none', color: '#00a884',
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              ⚙️ Settings
            </button>
          )}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '30px' }}>
          {/* HERO SECTION: AVATAR & NAME */}
          <div style={{
            background: '#111b21', padding: '24px 20px 18px', display: 'flex',
            flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            borderBottom: '8px solid #0c1317'
          }}>
            {/* Group Avatar */}
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <div 
                style={{
                  width: '100px', height: '100px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c6ff7, #ec4899)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.8rem', color: 'white', overflow: 'hidden',
                  border: '3px solid #202c33', boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
                }}
              >
                {details.avatar_url ? (
                  <img src={details.avatar_url} alt="Group Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  '👥'
                )}
              </div>

              {canEditInfo && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    background: '#00a884', color: '#111b21', border: '3px solid #111b21',
                    borderRadius: '50%', width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                  }}
                  title="Change group icon"
                >
                  📷
                </button>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={handleAvatarUpload} 
              />
            </div>

            {/* Group Subject / Title */}
            {isEditingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '300px' }}>
                <input 
                  type="text" 
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  maxLength={25}
                  autoFocus
                  style={{
                    flex: 1, background: '#202c33', border: '1px solid #00a884',
                    borderRadius: '8px', padding: '6px 10px', color: '#e9edef',
                    fontSize: '1rem', outline: 'none'
                  }}
                />
                <button 
                  onClick={handleSaveName}
                  style={{ background: '#00a884', color: '#111b21', border: 'none', borderRadius: '6px', padding: '6px 10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  ✓
                </button>
                <button 
                  onClick={() => { setEditedName(details.name); setIsEditingName(false); }}
                  style={{ background: '#2a3942', color: '#aebac1', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#e9edef' }}>
                  {details.name}
                </h2>
                {canEditInfo && (
                  <button 
                    onClick={() => setIsEditingName(true)}
                    style={{ background: 'none', border: 'none', color: '#00a884', cursor: 'pointer', fontSize: '1rem' }}
                    title="Edit subject"
                  >
                    ✏️
                  </button>
                )}
              </div>
            )}

            <div style={{ color: '#8696a0', fontSize: '0.82rem', marginTop: '6px' }}>
              Group • {members.length} participants
            </div>

            {details.created_by && (
              <div style={{ color: '#8696a0', fontSize: '0.75rem', marginTop: '4px' }}>
                Created by <span style={{ color: '#00a884', fontWeight: 600 }}>{details.creatorName || 'Admin'}</span>
                {formattedDate && ` on ${formattedDate}`}
              </div>
            )}
          </div>

          {/* GROUP DESCRIPTION */}
          <div style={{ padding: '16px 20px', background: '#111b21', borderBottom: '8px solid #0c1317' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: '#00a884', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Group Description
              </span>
              {canEditInfo && !isEditingDesc && (
                <button 
                  onClick={() => setIsEditingDesc(true)}
                  style={{ background: 'none', border: 'none', color: '#00a884', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  ✏️ Edit
                </button>
              )}
            </div>

            {isEditingDesc ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea
                  value={editedDesc}
                  onChange={e => setEditedDesc(e.target.value)}
                  rows={3}
                  placeholder="Add group description..."
                  autoFocus
                  style={{
                    width: '100%', background: '#202c33', border: '1px solid #00a884',
                    borderRadius: '8px', padding: '8px 10px', color: '#e9edef',
                    fontSize: '0.88rem', outline: 'none', resize: 'none', fontFamily: 'inherit'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => { setEditedDesc(details.description || ''); setIsEditingDesc(false); }}
                    style={{ background: '#2a3942', color: '#aebac1', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveDesc}
                    style={{ background: '#00a884', color: '#111b21', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ color: details.description ? '#d1d7db' : '#8696a0', fontSize: '0.88rem', fontStyle: details.description ? 'normal' : 'italic', lineHeight: 1.5 }}>
                {details.description || 'No description added yet.'}
              </div>
            )}
          </div>

          {/* GROUP SETTINGS PREVIEW / ENTRY (FOR ADMINS) */}
          {isAdmin && (
            <div 
              onClick={() => setShowSettingsModal(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', background: '#111b21', borderBottom: '8px solid #0c1317',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ fontSize: '1.2rem', color: '#00a884' }}>⚙️</div>
                <div>
                  <div style={{ color: '#e9edef', fontWeight: 500, fontSize: '0.92rem' }}>Group Settings</div>
                  <div style={{ color: '#8696a0', fontSize: '0.76rem' }}>
                    Edit permissions, message restrictions, admin access
                  </div>
                </div>
              </div>
              <span style={{ color: '#8696a0', fontSize: '1.2rem' }}>›</span>
            </div>
          )}

          {/* PARTICIPANTS SECTION */}
          <div style={{ padding: '16px 20px', background: '#111b21' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ color: '#8696a0', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {members.length} Participants
              </span>
              <span style={{ color: '#00a884', fontSize: '0.82rem', fontWeight: 600 }}>
                {members.filter(m => m.role === 'admin').length} Admins
              </span>
            </div>

            {/* Add Participant Button */}
            <div 
              onClick={handleOpenAddMembers}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '10px 0 14px', cursor: 'pointer', borderBottom: '1px solid #202c33'
              }}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%',
                background: '#00a884', color: '#111b21', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold'
              }}>
                +
              </div>
              <div style={{ color: '#e9edef', fontWeight: 600, fontSize: '0.95rem' }}>
                Add participants
              </div>
            </div>

            {/* Participant Search */}
            {members.length > 5 && (
              <div style={{ padding: '10px 0' }}>
                <input 
                  type="text" 
                  placeholder="Search participants..."
                  value={searchMember}
                  onChange={e => setSearchMember(e.target.value)}
                  style={{
                    width: '100%', background: '#202c33', border: 'none',
                    borderRadius: '8px', padding: '8px 12px', color: '#e9edef',
                    fontSize: '0.85rem', outline: 'none'
                  }}
                />
              </div>
            )}

            {/* Members List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {filteredMembers.map(m => {
                const memberId = m.id || m._id;
                const isMe = memberId === myId;
                const memberIsCreator = memberId === details.created_by;
                const memberIsAdmin = m.role === 'admin';

                return (
                  <div 
                    key={memberId}
                    onClick={() => {
                      if ((isAdmin || isCreator) && !isMe) {
                        setSelectedMemberAction(m);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 8px', borderRadius: '8px',
                      cursor: ((isAdmin || isCreator) && !isMe) ? 'pointer' : 'default',
                      background: selectedMemberAction?.id === memberId ? 'rgba(0,168,132,0.12)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <Avatar userId={memberId} username={m.username} size={44} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#e9edef', fontWeight: 600, fontSize: '0.92rem' }}>
                          {m.username}
                        </span>
                        {isMe && (
                          <span style={{ color: '#8696a0', fontSize: '0.78rem' }}> (You)</span>
                        )}
                      </div>
                      <div style={{ color: '#8696a0', fontSize: '0.78rem', marginTop: '2px' }}>
                        {m.email || 'Participant'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {memberIsCreator && (
                        <span style={{
                          background: 'rgba(245, 158, 11, 0.18)',
                          border: '1px solid rgba(245, 158, 11, 0.5)',
                          color: '#f59e0b',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}>
                          👑 Creator
                        </span>
                      )}
                      {memberIsAdmin && !memberIsCreator && (
                        <span style={{
                          background: 'rgba(0, 168, 132, 0.15)',
                          border: '1px solid rgba(0, 168, 132, 0.4)',
                          color: '#00a884',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}>
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DANGER ZONE: EXIT / DELETE GROUP */}
          <div style={{ padding: '20px', borderTop: '8px solid #0c1317', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={handleExitGroup}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444', fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              🚪 Exit group
            </button>

            {isAdmin && (
              <button
                onClick={handleDeleteGroup}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444',
                  color: '#ff6b6b', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                🗑️ Delete group for everyone
              </button>
            )}
          </div>
        </div>

        {/* SUB-MODAL 1: WHATSAPP GROUP SETTINGS MODAL */}
        {showSettingsModal && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: '#111b21', zIndex: 20, display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px 20px', background: '#202c33', color: '#e9edef',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              <button 
                onClick={() => setShowSettingsModal(false)}
                style={{ background: 'none', border: 'none', color: '#aebac1', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ←
              </button>
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Group settings</span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
              {/* Setting 1: Edit Group Info */}
              <div style={{ background: '#202c33', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#e9edef', fontWeight: 600, fontSize: '0.95rem' }}>Edit group info</div>
                <div style={{ color: '#8696a0', fontSize: '0.8rem', marginTop: '3px', marginBottom: '12px' }}>
                  Choose who can change this group's subject, icon, and description.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d7db', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="editInfo" 
                      checked={editInfoPerm === 'all'} 
                      onChange={() => handleSavePermissions('all', sendMsgPerm)}
                    />
                    All participants
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d7db', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="editInfo" 
                      checked={editInfoPerm === 'admins_only'} 
                      onChange={() => handleSavePermissions('admins_only', sendMsgPerm)}
                    />
                    Only admins
                  </label>
                </div>
              </div>

              {/* Setting 2: Send Messages */}
              <div style={{ background: '#202c33', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#e9edef', fontWeight: 600, fontSize: '0.95rem' }}>Send messages</div>
                <div style={{ color: '#8696a0', fontSize: '0.8rem', marginTop: '3px', marginBottom: '12px' }}>
                  Choose who can send messages to this group (Announcement mode).
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d7db', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="sendMsg" 
                      checked={sendMsgPerm === 'all'} 
                      onChange={() => handleSavePermissions(editInfoPerm, 'all')}
                    />
                    All participants
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d7db', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="sendMsg" 
                      checked={sendMsgPerm === 'admins_only'} 
                      onChange={() => handleSavePermissions(editInfoPerm, 'admins_only')}
                    />
                    Only admins
                  </label>
                </div>
              </div>

              {/* Setting 3: Manage Group Admins */}
              <div style={{ background: '#202c33', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#e9edef', fontWeight: 600, fontSize: '0.95rem' }}>Edit group admins</div>
                <div style={{ color: '#8696a0', fontSize: '0.8rem', marginTop: '3px', marginBottom: '12px' }}>
                  Promote or dismiss members as group admins.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {members.map(m => {
                    const mId = m.id || m._id;
                    const isMAdmin = m.role === 'admin';
                    const isMe = mId === myId;

                    return (
                      <div key={mId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar userId={mId} username={m.username} size={34} />
                          <span style={{ color: '#e9edef', fontSize: '0.88rem' }}>{m.username} {isMe && '(You)'}</span>
                        </div>
                        {!isMe && (
                          <button
                            onClick={() => handleToggleAdminRole(mId, m.role)}
                            style={{
                              background: isMAdmin ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 168, 132, 0.2)',
                              border: `1px solid ${isMAdmin ? '#ef4444' : '#00a884'}`,
                              color: isMAdmin ? '#ef4444' : '#00a884',
                              borderRadius: '6px', padding: '4px 10px', fontSize: '0.76rem',
                              fontWeight: 600, cursor: 'pointer'
                            }}
                          >
                            {isMAdmin ? 'Dismiss as admin' : 'Make admin'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-MODAL 2: ADD PARTICIPANTS MODAL */}
        {showAddMembersModal && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: '#111b21', zIndex: 25, display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px 20px', background: '#202c33', color: '#e9edef',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              <button 
                onClick={() => setShowAddMembersModal(false)}
                style={{ background: 'none', border: 'none', color: '#aebac1', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ←
              </button>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Add participants</div>
                <div style={{ fontSize: '0.78rem', color: '#8696a0' }}>{selectedNewMembers.size} selected</div>
              </div>
            </div>

            <div style={{ padding: '12px 16px 4px 16px', background: '#111b21' }}>
              <input
                type="text"
                placeholder="Search by username or ID..."
                value={searchAddUser}
                onChange={e => setSearchAddUser(e.target.value)}
                style={{
                  width: '100%',
                  background: '#202c33',
                  border: '1px solid #2a3942',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#e9edef',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
              {loadingFriends ? (
                <div style={{ textAlign: 'center', color: '#8696a0', padding: '30px' }}>Loading users...</div>
              ) : availableUsers.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#8696a0', padding: '30px', fontSize: '0.9rem' }}>
                  No available users to add.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableUsers
                    .filter(u => (u.username || '').toLowerCase().includes(searchAddUser.toLowerCase()) || (u.id || '').toLowerCase().includes(searchAddUser.toLowerCase()))
                    .map(f => {
                      const fId = f.id || f._id;
                      const isSelected = selectedNewMembers.has(fId);
                      return (
                        <div 
                          key={fId}
                          onClick={() => {
                            const next = new Set(selectedNewMembers);
                            if (next.has(fId)) next.delete(fId);
                            else next.add(fId);
                            setSelectedNewMembers(next);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                            background: isSelected ? 'rgba(0, 168, 132, 0.16)' : 'rgba(32, 44, 51, 0.6)',
                            border: isSelected ? '1px solid #00a884' : '1px solid transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            readOnly
                            style={{ accentColor: '#00a884', transform: 'scale(1.2)' }}
                          />
                          <Avatar userId={fId} username={f.username} size={42} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: '#e9edef', fontWeight: 600, fontSize: '0.92rem' }}>{f.username}</span>
                              {f.isFriend && (
                                <span style={{ fontSize: '0.68rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '1px 6px', borderRadius: '6px' }}>Friend</span>
                              )}
                            </div>
                            <div style={{ color: '#8696a0', fontSize: '0.75rem', marginTop: '2px' }}>
                              ID: {fId.length > 12 ? fId.substring(0, 12) + '...' : fId}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {selectedNewMembers.size > 0 && (
              <div style={{ padding: '16px 20px', borderTop: '1px solid #202c33', display: 'flex', justifyContent: 'flex-end', background: '#111b21' }}>
                <button
                  onClick={handleAddMembersSubmit}
                  style={{
                    background: '#00a884', color: '#111b21', border: 'none',
                    borderRadius: '50px', padding: '10px 24px', fontWeight: 'bold',
                    fontSize: '0.92rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,168,132,0.4)'
                  }}
                >
                  Add ({selectedNewMembers.size}) Participants
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUB-MODAL 3: WHATSAPP PARTICIPANT ACTION SHEET */}
        {selectedMemberAction && (
          <div 
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.65)', zIndex: 100, display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
            onClick={() => setSelectedMemberAction(null)}
          >
            <div 
              style={{
                width: '100%', maxWidth: '320px', background: '#202c33',
                borderRadius: '16px', padding: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                color: '#e9edef'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '14px', borderBottom: '1px solid #2a3942' }}>
                <Avatar userId={selectedMemberAction.id || selectedMemberAction._id} username={selectedMemberAction.username} size={44} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedMemberAction.username}</div>
                  <div style={{ color: '#00a884', fontSize: '0.78rem' }}>
                    {selectedMemberAction.role === 'admin' ? 'Group Admin' : 'Participant'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
                {/* Toggle Admin */}
                <button
                  onClick={() => handleToggleAdminRole(selectedMemberAction.id || selectedMemberAction._id, selectedMemberAction.role)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 10px',
                    background: 'none', border: 'none', color: '#e9edef', fontSize: '0.9rem',
                    textAlign: 'left', cursor: 'pointer', borderRadius: '8px'
                  }}
                >
                  <span>🛡️</span>
                  <span>{selectedMemberAction.role === 'admin' ? 'Dismiss as admin' : 'Make group admin'}</span>
                </button>

                {/* Remove Participant */}
                <button
                  onClick={() => handleRemoveMember(selectedMemberAction.id || selectedMemberAction._id, selectedMemberAction.username)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 10px',
                    background: 'none', border: 'none', color: '#ef4444', fontSize: '0.9rem',
                    textAlign: 'left', cursor: 'pointer', borderRadius: '8px'
                  }}
                >
                  <span>🚫</span>
                  <span>Remove {selectedMemberAction.username}</span>
                </button>
              </div>

              <div style={{ marginTop: '10px', borderTop: '1px solid #2a3942', paddingTop: '8px', textAlign: 'right' }}>
                <button
                  onClick={() => setSelectedMemberAction(null)}
                  style={{ background: 'none', border: 'none', color: '#8696a0', fontSize: '0.85rem', cursor: 'pointer', padding: '6px 12px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default GroupInfoModal;
