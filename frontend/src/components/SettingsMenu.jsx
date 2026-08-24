import React from 'react';
import './SettingsMenu.css';

function SettingsMenu({ onClose, onOpenAccount, onOpenNotifications, onOpenPrivacy, onOpenLanguage }) {
  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <button className="settings-back-btn" onClick={onClose}>
            ←
          </button>
          <h2 className="settings-title">Settings</h2>
        </div>

        <div className="settings-list">
          <div className="settings-item" onClick={onOpenAccount}>
            <div className="settings-item-title" style={{ color: '#ff5252' }}>Account</div>
          </div>
          
          <div className="settings-item" onClick={onOpenNotifications}>
            <div className="settings-item-title">Notifications</div>
          </div>
          
          <div className="settings-item" onClick={onOpenPrivacy}>
            <div className="settings-item-title">Privacy</div>
          </div>
          
          <div className="settings-item">
            <div className="settings-item-title">Chats</div>
          </div>
          
          <div className="settings-item">
            <div className="settings-item-title">Calls</div>
          </div>
          
          <div className="settings-item" onClick={onOpenLanguage}>
            <div className="settings-item-title">Language</div>
            <div className="settings-item-subtitle">Auto</div>
          </div>
          
          <div className="settings-item">
            <div className="settings-item-title">Help & Feedback</div>
          </div>
          
          <div className="settings-item">
            <div className="settings-item-title">Check update</div>
          </div>
          
          <div className="settings-item">
            <div className="settings-item-title">About</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsMenu;
