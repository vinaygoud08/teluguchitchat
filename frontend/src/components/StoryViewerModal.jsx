import React from 'react';
import './SettingsMenu.css';

function StoryViewerModal({ videoUrl, isOwn, onDelete, onClose }) {
  return (
    <div className="settings-modal-overlay" onClick={onClose} style={{ zIndex: 99999, justifyContent: 'center', alignItems: 'center' }}>
      <div 
        className="settings-modal-content" 
        style={{ 
          background: 'transparent', 
          boxShadow: 'none', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          border: 'none',
          padding: 0,
          width: 'auto',
          maxWidth: '90vw',
          position: 'relative'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          position: 'absolute',
          top: '-45px',
          right: '0',
          left: '0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%'
        }}>
          {isOwn && onDelete ? (
            <button
              onClick={() => {
                onDelete();
              }}
              style={{
                background: 'rgba(239, 68, 68, 0.85)',
                border: 'none',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🗑️ Delete Story
            </button>
          ) : <div />}

          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '2rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>

        <video 
          src={videoUrl} 
          controls 
          autoPlay 
          style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px' }}
        />
      </div>
    </div>
  );
}

export default StoryViewerModal;
