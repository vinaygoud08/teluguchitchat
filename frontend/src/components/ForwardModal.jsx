import React, { useState } from 'react';
import './SettingsMenu.css';
import { Send, Search } from 'lucide-react';
import Avatar from './Avatar';

function ForwardModal({ imageUrl, onClose, friends, myGroups, onSend }) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  const handleToggle = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleSend = () => {
    if (selectedIds.size === 0) return;
    onSend(Array.from(selectedIds));
    onClose();
  };

  const filteredFriends = friends.filter(f => f.username.toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = myGroups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="settings-modal-overlay" onClick={onClose} style={{ zIndex: 100000, justifyContent: 'center', alignItems: 'center' }}>
      <div 
        className="settings-modal-content" 
        style={{ 
          maxWidth: '400px', 
          height: '500px', 
          maxHeight: '90vh', 
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          padding: '15px'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Forward to...</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>
        
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '8px 12px', alignItems: 'center', marginBottom: '15px' }}>
          <Search size={18} color="#aaa" style={{ marginRight: '8px' }} />
          <input 
            type="text" 
            placeholder="Search friends or groups" 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%' }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredGroups.length > 0 && (
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#aaa', marginTop: '10px' }}>Groups</div>
          )}
          {filteredGroups.map(group => (
            <div 
              key={group.id} 
              onClick={() => handleToggle(group.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer' }}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', background: '#4CAF50',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem'
              }}>
                {group.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ flex: 1 }}>{group.name}</span>
              <input type="checkbox" checked={selectedIds.has(group.id)} readOnly style={{ transform: 'scale(1.2)' }} />
            </div>
          ))}

          {filteredFriends.length > 0 && (
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#aaa', marginTop: '10px' }}>Friends</div>
          )}
          {filteredFriends.map(friend => (
            <div 
              key={friend.id || friend._id} 
              onClick={() => handleToggle(friend.id || friend._id)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer' }}
            >
              <Avatar user={friend} size={40} />
              <span style={{ flex: 1 }}>{friend.username}</span>
              <input type="checkbox" checked={selectedIds.has(friend.id || friend._id)} readOnly style={{ transform: 'scale(1.2)' }} />
            </div>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <button 
            onClick={handleSend}
            style={{ 
              background: '#2196F3', 
              color: 'white', 
              border: 'none', 
              padding: '12px', 
              borderRadius: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '8px',
              marginTop: '15px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            <Send size={18} /> Send
          </button>
        )}
      </div>
    </div>
  );
}

export default ForwardModal;
