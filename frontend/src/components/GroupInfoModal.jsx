import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const GroupInfoModal = ({ group, onClose }) => {
  const { token } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await axios.get(`/api/groups/${group.id}/members`, {
          headers: { 'x-auth-token': token }
        });
        setMembers(res.data);
      } catch (err) {
        console.error('Error fetching group members:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMembers();
  }, [group.id, token]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden' }}>
        
        {/* Header section with big avatar */}
        <div style={{ background: '#f5f5f5', padding: '30px 20px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
          <div className="avatar avatar-public" style={{ width: 100, height: 100, fontSize: '3rem', margin: '0 auto 15px', background: '#e91e63' }}>
            👥
          </div>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: '#333' }}>{group.name}</h2>
          <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Group Chat • {members.length} participants</p>
          {group.description && (
            <p style={{ marginTop: '15px', color: '#444', fontStyle: 'italic' }}>"{group.description}"</p>
          )}
        </div>

        {/* Participants List */}
        <div style={{ padding: '20px', maxHeight: '300px', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#555', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Participants</h3>
          
          {loading ? (
            <div style={{ textAlign: 'center', color: '#888' }}>Loading participants...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {members.map(member => (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <Avatar userId={member.id} username={member.username} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{member.username}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>{member.role === 'admin' ? 'Admin' : 'Member'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '15px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', background: '#fafafa' }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;
