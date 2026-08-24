import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const StoryViewsModal = ({ onClose }) => {
  const { token } = useAuth();
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchViews = async () => {
      try {
        const res = await axios.get('/api/users/story-views', {
          headers: { 'x-auth-token': token }
        });
        setViews(res.data);
      } catch (err) {
        console.error('Error fetching story views', err);
      } finally {
        setLoading(false);
      }
    };
    fetchViews();
  }, [token]);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '20px', maxWidth: '350px' }}>
        <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>👁️ Story Viewers ({views.length})</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </h3>
        
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>Loading...</div>
          ) : views.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No one has viewed your story yet.</div>
          ) : (
            views.map(v => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <Avatar userId={v.id} username={v.username} size={36} />
                <div style={{ marginLeft: '12px' }}>
                  <div style={{ fontWeight: 'bold' }}>{v.username}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>{new Date(v.viewed_at).toLocaleString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryViewsModal;
