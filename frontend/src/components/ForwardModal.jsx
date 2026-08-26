import React, { useState } from 'react';
import './SettingsMenu.css';
import { Send, Search, Check, FileText, Image as ImageIcon } from 'lucide-react';
import Avatar from './Avatar';

function ForwardModal({ forwardMsg, onClose, friends = [], myGroups = [], onSend }) {
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

  const filteredFriends = friends.filter(f => f?.username?.toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = myGroups.filter(g => g?.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="settings-modal-overlay" onClick={onClose} style={{ zIndex: 100000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div 
        className="settings-modal-content" 
        style={{ 
          maxWidth: '440px', 
          width: '92%',
          height: '540px', 
          maxHeight: '90vh', 
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
          color: 'white',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Forward message</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.6rem', cursor: 'pointer' }}>&times;</button>
        </div>

        {/* Message Preview */}
        {forwardMsg && (
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            padding: '10px 14px',
            borderRadius: '12px',
            marginBottom: '14px',
            borderLeft: '4px solid #6366f1',
            fontSize: '0.88rem',
            color: '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {forwardMsg.imageUrl && (
              <img src={forwardMsg.imageUrl} alt="preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
            )}
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {forwardMsg.text || (forwardMsg.imageUrl ? '📷 Photo' : 'Forwarded message')}
            </div>
          </div>
        )}
        
        {/* Search */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: '24px', padding: '8px 14px', alignItems: 'center', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Search size={18} color="#94a3b8" style={{ marginRight: '8px' }} />
          <input 
            type="text" 
            placeholder="Search friends or groups..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%', fontSize: '0.9rem' }}
          />
        </div>

        {/* Recipient list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
          {filteredGroups.length > 0 && (
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>Groups</div>
          )}
          {filteredGroups.map(group => (
            <div 
              key={group.id} 
              onClick={() => handleToggle(group.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: selectedIds.has(group.id) ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.04)', borderRadius: '12px', cursor: 'pointer', border: selectedIds.has(group.id) ? '1px solid #6366f1' : '1px solid transparent', transition: 'all 0.15s ease' }}
            >
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem'
              }}>
                👥
              </div>
              <span style={{ flex: 1, fontWeight: 600 }}>{group.name}</span>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: selectedIds.has(group.id) ? 'none' : '2px solid #64748b', background: selectedIds.has(group.id) ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedIds.has(group.id) && <Check size={14} color="white" />}
              </div>
            </div>
          ))}

          {filteredFriends.length > 0 && (
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '8px' }}>Friends</div>
          )}
          {filteredFriends.map(friend => {
            const fId = friend.id || friend._id;
            const isSelected = selectedIds.has(fId);
            return (
              <div 
                key={fId} 
                onClick={() => handleToggle(fId)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.04)', borderRadius: '12px', cursor: 'pointer', border: isSelected ? '1px solid #6366f1' : '1px solid transparent', transition: 'all 0.15s ease' }}
              >
                <Avatar userId={fId} username={friend.username} size={38} />
                <span style={{ flex: 1, fontWeight: 600 }}>{friend.username}</span>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid #64748b', background: isSelected ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSelected && <Check size={14} color="white" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Send Button */}
        {selectedIds.size > 0 && (
          <button 
            onClick={handleSend}
            style={{ 
              background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
              color: 'white', 
              border: 'none', 
              padding: '12px', 
              borderRadius: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              marginTop: '14px', 
              cursor: 'pointer', 
              fontWeight: 800,
              fontSize: '0.98rem',
              boxShadow: '0 8px 20px rgba(99,102,241,0.45)'
            }}
          >
            <Send size={18} /> Forward to ({selectedIds.size})
          </button>
        )}
      </div>
    </div>
  );
}

export default ForwardModal;
