import React, { useRef, useState } from 'react';

const ProfileViewer = ({ userProfile, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const toggleSong = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  if (!userProfile) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
        
        <h2 className="modal-title" style={{ marginBottom: '5px' }}>{userProfile.username}</h2>
        
        <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
          {userProfile.age ? `${userProfile.age} yrs` : 'Age unknown'} • {userProfile.gender || 'Gender unknown'}
        </div>

        {userProfile.profileSongUrl && (
          <div style={{ marginBottom: '20px', padding: '15px', background: '#1e293b', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: '#10b981', marginBottom: '10px', fontWeight: 'bold' }}>🎵 Profile Song</div>
            <audio ref={audioRef} src={userProfile.profileSongUrl} loop />
            <button 
              onClick={toggleSong}
              style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
            >
              {isPlaying ? 'Pause Song' : 'Play Song'}
            </button>
          </div>
        )}

        {userProfile.statusVideoUrl ? (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginBottom: '5px', fontWeight: 'bold' }}>📺 Status Video</div>
            <video 
              src={userProfile.statusVideoUrl} 
              controls 
              style={{ width: '100%', maxHeight: '300px', borderRadius: '8px', background: 'black' }}
            />
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: '0.9rem', padding: '20px' }}>
            No status video uploaded.
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '30px' }}>
          <button className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>Close Profile</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileViewer;
