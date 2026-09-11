import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { useAuth } from '../context/AuthContext';
import { Eye, Music, Play, Pause, Video, MapPin, Calendar, User as UserIcon, X, Maximize2 } from 'lucide-react';

const ProfileViewer = ({ userProfile, onClose }) => {
  const { token } = useAuth();
  const [profileData, setProfileData] = useState(userProfile);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  const userId = userProfile?.id || userProfile?._id;
  const avatarUrl = userId ? `https://dbtltzhycoxefpvbzizn.supabase.co/storage/v1/object/public/abcd/profile_photo_${userId}.jpg` : null;

  useEffect(() => {
    if (!userId || !token) return;
    const fetchLatestDetails = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/users/profile/${userId}`, {
          headers: { 'x-auth-token': token }
        });
        if (res.data) {
          setProfileData(prev => ({ ...prev, ...res.data }));
        }
      } catch (err) {
        console.warn('Could not fetch complete profile details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLatestDetails();
  }, [userId, token]);

  const toggleSong = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.log('Audio play error:', e));
    }
    setIsPlaying(!isPlaying);
  };

  if (!userProfile) return null;

  const displayUser = profileData || userProfile;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }}>
        <div 
          className="modal-content" 
          onClick={e => e.stopPropagation()} 
          style={{ 
            textAlign: 'center', 
            maxWidth: '420px', 
            width: '92%', 
            padding: '28px 24px', 
            borderRadius: '24px',
            background: 'var(--white, #ffffff)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            position: 'relative'
          }}
        >
          {/* Close button */}
          <button 
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(0,0,0,0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--neutral-700, #333)'
            }}
          >
            <X size={18} />
          </button>

          {/* Large Profile Picture Avatar with Click to Enlarge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', marginTop: '8px' }}>
            <div 
              style={{ 
                position: 'relative', 
                cursor: 'pointer',
                borderRadius: '50%',
                padding: '4px',
                background: 'linear-gradient(135deg, var(--brand-500, #6366f1), #ec4899)'
              }}
              onClick={() => setShowFullPhoto(true)}
              title="Click to view full photo"
            >
              <Avatar userId={userId} username={displayUser.username} size={100} />
              <div 
                style={{
                  position: 'absolute',
                  bottom: '4px',
                  right: '4px',
                  background: 'rgba(0,0,0,0.65)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid white'
                }}
              >
                <Maximize2 size={13} />
              </div>
            </div>
          </div>

          <h2 className="modal-title" style={{ margin: '0 0 4px 0', fontSize: '1.4rem', fontWeight: 800 }}>
            {displayUser.username}
          </h2>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {displayUser.gender && (
              <span style={{ 
                background: (displayUser.gender || '').toLowerCase() === 'female' ? '#fdf2f8' : '#eff6ff', 
                color: (displayUser.gender || '').toLowerCase() === 'female' ? '#db2777' : '#2563eb', 
                padding: '4px 10px', 
                borderRadius: '20px', 
                fontSize: '0.8rem', 
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <UserIcon size={12} /> {displayUser.gender}
              </span>
            )}
            {displayUser.age && (
              <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                {displayUser.age} yrs
              </span>
            )}
            {displayUser.country && (
              <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={12} /> {displayUser.country}
              </span>
            )}
          </div>

          {/* Profile Song Section */}
          {displayUser.profileSongUrl && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <Music size={18} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>Profile Song</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{isPlaying ? 'Playing...' : 'Tap to listen'}</div>
                </div>
              </div>
              <audio ref={audioRef} src={displayUser.profileSongUrl} loop onEnded={() => setIsPlaying(false)} />
              <button 
                onClick={toggleSong}
                style={{ 
                  background: isPlaying ? '#ef4444' : '#6366f1', 
                  color: 'white', 
                  border: 'none', 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '50%', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
              </button>
            </div>
          )}

          {/* Status Video Section */}
          {displayUser.statusVideoUrl && (
            <div style={{ marginBottom: '16px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', color: '#3b82f6', marginBottom: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Video size={16} /> Status Video / Story
              </div>
              <video 
                src={displayUser.statusVideoUrl} 
                controls 
                style={{ width: '100%', maxHeight: '220px', borderRadius: '16px', background: '#000', objectFit: 'cover' }}
              />
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button 
              className="btn-secondary" 
              onClick={onClose} 
              style={{ width: '100%', padding: '12px', borderRadius: '14px', fontWeight: 600 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Full Photo Modal Viewer */}
      {showFullPhoto && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowFullPhoto(false)}
          style={{ zIndex: 20000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <button 
            onClick={() => setShowFullPhoto(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={24} />
          </button>
          <div style={{ maxWidth: '90vw', maxHeight: '85vh', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <img 
              src={avatarUrl} 
              alt={displayUser.username}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayUser.username)}&size=300&background=6366f1&color=fff`;
              }}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '80vh', 
                borderRadius: '16px', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                objectFit: 'contain'
              }} 
            />
            <div style={{ color: 'white', marginTop: '12px', fontWeight: 600, fontSize: '1.1rem' }}>
              {displayUser.username}'s Profile Photo
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileViewer;
