import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import './AccountModal.css';

function CreateGroupModal({ onClose, onGroupCreated }) {
  const { token, user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Fetch friends to add to group
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setCreating(true);
    try {
      const res = await axios.post('/api/groups/create', {
        name: groupName.trim(),
        description: description.trim(),
        memberIds: Array.from(selectedFriends)
      }, {
        headers: { 'x-auth-token': token }
      });
      onGroupCreated(res.data);
      onClose();
    } catch (err) {
      alert('Failed to create group');
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="account-modal-overlay" onClick={onClose}>
      <div className="account-modal-content" onClick={e => e.stopPropagation()}>
        <div className="account-header">
          <button className="account-back-btn" onClick={onClose}>←</button>
          <h2 className="account-title">New Group</h2>
        </div>
        
        <div className="account-scroll-area">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="text" 
              className="account-input" 
              placeholder="Group Subject" 
              value={groupName} 
              onChange={e => setGroupName(e.target.value)} 
              required
              maxLength={25}
            />
            
            <input 
              type="text" 
              className="account-input" 
              placeholder="Group Description (Optional)" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
            />

            <h3 style={{ color: 'white', marginTop: '10px', fontSize: '1.1rem' }}>Add Participants</h3>
            
            {loading ? (
              <div style={{ color: '#888' }}>Loading friends...</div>
            ) : friends.length === 0 ? (
              <div style={{ color: '#888' }}>You don't have any friends to add yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                {friends.map(f => (
                  <div 
                    key={f.id} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', 
                      background: selectedFriends.has(f.id) ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px', cursor: 'pointer'
                    }}
                    onClick={() => toggleFriend(f.id)}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedFriends.has(f.id)}
                      readOnly
                      style={{ transform: 'scale(1.2)' }}
                    />
                    <Avatar userId={f.id} username={f.username} size={36} />
                    <span style={{ color: 'white' }}>{f.username}</span>
                  </div>
                ))}
              </div>
            )}

            <button 
              type="submit" 
              className="account-submit-btn" 
              disabled={creating || !groupName.trim()}
              style={{ marginTop: '20px' }}
            >
              {creating ? 'Creating...' : `Create Group (${selectedFriends.size} selected)`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateGroupModal;
