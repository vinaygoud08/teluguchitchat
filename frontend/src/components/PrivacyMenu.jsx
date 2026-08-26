import React, { useState } from 'react';
import StoryPrivacyModal from './StoryPrivacyModal';
import './SettingsMenu.css';

function PrivacyMenu({ onClose }) {
  const [readReceipts, setReadReceipts] = useState(() => localStorage.getItem('privacy_readReceipts') !== 'false');
  const [requireRequest, setRequireRequest] = useState(() => localStorage.getItem('privacy_requireRequest') !== 'false');
  const [showActivity, setShowActivity] = useState(() => localStorage.getItem('privacy_showActivity') !== 'false');
  const [showStoryPrivacy, setShowStoryPrivacy] = useState(false);

  const handleToggle = (key, setter, val) => {
    setter(val);
    localStorage.setItem(`privacy_${key}`, val);
  };

  if (showStoryPrivacy) {
    return <StoryPrivacyModal onClose={() => setShowStoryPrivacy(false)} />;
  }

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <button className="settings-back-btn" onClick={onClose}>
            ←
          </button>
          <h2 className="settings-title">Privacy</h2>
        </div>

        <div className="settings-list">
          <label className="settings-item">
            <div className="settings-item-row">
              <div className="settings-item-text">
                <div className="settings-item-title">Read Receipts</div>
                <div className="settings-item-subtitle">Send & receive read receipts</div>
              </div>
              <input 
                type="checkbox" 
                className="settings-toggle" 
                checked={readReceipts}
                onChange={(e) => handleToggle('readReceipts', setReadReceipts, e.target.checked)}
              />
            </div>
          </label>
          
          <label className="settings-item">
            <div className="settings-item-row">
              <div className="settings-item-text">
                <div className="settings-item-title">Require friend request</div>
              </div>
              <input 
                type="checkbox" 
                className="settings-toggle" 
                checked={requireRequest}
                onChange={(e) => handleToggle('requireRequest', setRequireRequest, e.target.checked)}
              />
            </div>
          </label>
          
          <label className="settings-item">
            <div className="settings-item-row">
              <div className="settings-item-text">
                <div className="settings-item-title">Show activity status</div>
              </div>
              <input 
                type="checkbox" 
                className="settings-toggle" 
                checked={showActivity}
                onChange={(e) => handleToggle('showActivity', setShowActivity, e.target.checked)}
              />
            </div>
          </label>

          <div className="settings-item" onClick={() => setShowStoryPrivacy(true)}>
            <div className="settings-item-row">
              <div className="settings-item-text">
                <div className="settings-item-title">Story privacy</div>
                <div className="settings-item-subtitle" style={{ fontSize: '0.8rem', color: '#a0a0a0', marginTop: '2px' }}>Hide story from specific friends</div>
              </div>
              <div style={{ color: '#888' }}>&gt;</div>
            </div>
          </div>

          <div className="settings-item" onClick={() => alert("Block list is empty.")}>
            <div className="settings-item-row">
              <div className="settings-item-text">
                <div className="settings-item-title">Block list</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrivacyMenu;
