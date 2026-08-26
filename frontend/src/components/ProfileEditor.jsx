import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ProfileEditor = ({ onClose }) => {
  const { user, token, setUser } = useAuth();
  const [songFile, setSongFile] = useState(null);
  const [statusFile, setStatusFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (file, type) => {
    if (!file) return;
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('media', file);
    formData.append('type', type);

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
      alert('Status uploaded successfully!');
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.msg || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStory = async () => {
    if (!window.confirm("Are you sure you want to delete your status video?")) return;
    setLoading(true);
    setError('');
    try {
      await axios.delete('/api/media/story', {
        headers: { 'x-auth-token': token }
      });
      if (setUser) {
        const updatedUser = { ...user, statusVideoUrl: null, story_views: [] };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      alert('Status deleted successfully!');
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.msg || 'Failed to delete status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Upload Status</h2>
        
        {error && <div className="error-text">{error}</div>}

        <div className="form-group">
          <label style={{ fontWeight: 'bold' }}>Status Video (Max 30s, mp4)</label>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Current: {user?.statusVideoUrl ? <a href={user.statusVideoUrl} target="_blank" rel="noreferrer">Uploaded</a> : 'None'}</span>
            {user?.statusVideoUrl && (
              <button 
                onClick={handleDeleteStory}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  textDecoration: 'underline'
                }}
              >
                Delete Story
              </button>
            )}
          </div>
          <input 
            type="file" 
            accept="video/*" 
            onChange={e => setStatusFile(e.target.files[0])} 
            className="form-control"
          />
          <button 
            className="btn-primary" 
            style={{ marginTop: '10px', width: '100%' }}
            onClick={() => handleUpload(statusFile, 'status')}
            disabled={!statusFile || loading}
          >
            {loading ? 'Uploading...' : 'Upload Video'}
          </button>
        </div>

        <div className="modal-actions" style={{ marginTop: '30px' }}>
          <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditor;
