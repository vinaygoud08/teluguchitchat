import React, { useState, useEffect } from 'react';

function Avatar({ userId, username, size = 44, className = "" }) {
  const [imgError, setImgError] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(localStorage.getItem(`avatar_t_${userId}`) || '');

  useEffect(() => {
    const handleUpdate = () => {
      setCacheBuster(localStorage.getItem(`avatar_t_${userId}`) || '');
      setImgError(false);
    };
    window.addEventListener('avatarUpdate', handleUpdate);
    return () => window.removeEventListener('avatarUpdate', handleUpdate);
  }, [userId]);
  
  // Predictable URL
  const avatarUrl = `https://dbtltzhycoxefpvbzizn.supabase.co/storage/v1/object/public/abcd/profile_photo_${userId}.jpg${cacheBuster ? '?t=' + cacheBuster : ''}`;

  if (!userId || imgError) {
    return (
      <div 
        className={`avatar avatar-public ${className}`} 
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {username ? username.charAt(0).toUpperCase() : '?'}
      </div>
    );
  }

  return (
    <div 
      className={`avatar ${className}`} 
      style={{ 
        width: size, 
        height: size, 
        overflow: 'hidden', 
        padding: 0, 
        background: '#2c2c2c'
      }}
    >
      <img 
        src={avatarUrl} 
        alt={username} 
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setImgError(true)}
      />
    </div>
  );
}

export default Avatar;
