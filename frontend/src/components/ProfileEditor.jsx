import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ProfileEditor = ({ onClose }) => {
  const { user, token } = useAuth();
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
      await axios.post('/api/media/upload-profile-media', formData, {
        headers: { 
          'x-auth-token': token,
          'Content-Type': 'multipart/form-data'
        }
      });
      // Force reload to grab new user object from /me
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.msg || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Edit Profile</h2>
        
        {error && <div className="error-text">{error}</div>}

        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label style={{ fontWeight: 'bold' }}>Profile Song (mp3/wav)</label>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px' }}>
            Current: {user?.profileSongUrl ? <a href={user.profileSongUrl} target="_blank" rel="noreferrer">Uploaded</a> : 'None'}
          </div>
          <input 
            type="file" 
            accept="audio/*" 
            onChange={e => setSongFile(e.target.files[0])} 
            className="form-control"
          />
          <button 
            className="btn-primary" 
            style={{ marginTop: '10px', width: '100%' }}
            onClick={() => handleUpload(songFile, 'song')}
            disabled={!songFile || loading}
          >
            {loading ? 'Uploading...' : 'Upload Song'}
          </button>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 'bold' }}>Status Video (Max 30s, mp4)</label>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '10px' }}>
            Current: {user?.statusVideoUrl ? <a href={user.statusVideoUrl} target="_blank" rel="noreferrer">Uploaded</a> : 'None'}
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
