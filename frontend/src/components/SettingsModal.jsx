import React from 'react';
import './SettingsModal.css';

function SettingsModal({ onClose, onSelectAccount, onSelectSecurity, onLogout, onDeleteAccount }) {
  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <button className="settings-back-btn" onClick={onClose}>←</button>
          <h2 className="settings-title">Settings</h2>
        </div>
        
        <div className="settings-list">
          <button className="settings-item" onClick={onSelectAccount}>
            Account
          </button>
          <button className="settings-item" onClick={onSelectSecurity}>
            Change Password
          </button>
          <button className="settings-item" onClick={onLogout}>
            Logout
          </button>
          <button className="settings-item danger-text" onClick={onDeleteAccount}>
            Delete My Account
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
