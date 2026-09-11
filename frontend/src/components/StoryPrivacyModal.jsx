import React, { useState, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Avatar from './Avatar';
import './SettingsMenu.css';

function StoryPrivacyModal({ onClose }) {
  const { user, token, login } = useContext(AuthContext);
  const friends = user?.friends || [];
  const initialHiddenList = new Set(user?.hidden_story_from || []);
  const [hiddenSet, setHiddenSet] = useState(initialHiddenList);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleUser = (userId) => {
    const newSet = new Set(hiddenSet);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setHiddenSet(newSet);
  };

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    try {
      const hiddenArray = Array.from(hiddenSet);
      await axios.put('/api/users/me', { hidden_story_from: hiddenArray }, {
        headers: { 'x-auth-token': token }
      });
      // Refresh user context
      const meRes = await axios.get('/api/users/me', { headers: { 'x-auth-token': token }});
      login(meRes.data, token);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save settings. Make sure hidden_story_from is in Supabase.');
      setSaving(false);
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <button className="settings-back-btn" onClick={onClose}>←</button>
          <h2 className="settings-title">Hide Story From</h2>
        </div>
        
        <div style={{ padding: '0 20px', color: '#a0a0a0', fontSize: '0.9rem', marginBottom: '10px' }}>
          Select the friends who you do NOT want to see your stories.
        </div>

        {error && <div style={{ color: '#ff5252', padding: '10px 20px', fontSize: '0.9rem' }}>{typeof error === 'string' ? error : (error?.message || error?.msg || '')}</div>}

        <div className="settings-list" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          {friends.length === 0 ? (
            <div style={{ padding: '20px', color: '#888', textAlign: 'center' }}>
              You don't have any friends yet.
            </div>
          ) : (
            friends.map(friend => {
              const friendId = friend.id || friend._id;
              const isHidden = hiddenSet.has(friendId);
              return (
                <div key={friendId} className="settings-item" onClick={() => toggleUser(friendId)} style={{ padding: '10px 20px' }}>
                  <div className="settings-item-row" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '15px' }}>
                    <Avatar userId={friendId} username={friend.username} size={40} />
                    <div className="settings-item-text" style={{ flex: 1 }}>
                      <div className="settings-item-title" style={{ fontSize: '1rem', color: isHidden ? '#ff5252' : '#fff' }}>
                        {friend.username}
                      </div>
                      <div className="settings-item-subtitle" style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>
                        {isHidden ? 'Story hidden' : 'Can see your story'}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {isHidden ? (
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#ff5252', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      ) : (
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #555' }}></div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ padding: '20px' }}>
          <button 
            style={{ width: '100%', padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StoryPrivacyModal;
