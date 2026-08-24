import React from 'react';
import { useSettings } from '../context/SettingsContext';
import './SettingsMenu.css';

function NotificationsMenu({ onClose }) {
  const { notifications, updateNotificationSetting } = useSettings();

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) {
      alert("This browser does not support system notifications.");
      return;
    }
    
    if (Notification.permission === 'granted') {
      alert("Notifications are already enabled on this device!");
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        alert("Notifications successfully enabled!");
      } else {
        alert("Notification permission denied. Please allow it in your browser settings.");
      }
    } else {
      alert("Notifications are currently blocked. Please tap the lock icon in your browser's address bar (or go to site settings) and allow notifications.");
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <button className="settings-back-btn" onClick={onClose}>
            ←
          </button>
          <h2 className="settings-title">Notifications</h2>
        </div>

        <div className="settings-list">
          <div className="settings-group">
            <div className="settings-group-title">Sounds & vibrations</div>
            <div className="settings-group-box">
              <div className="settings-group-item">
                <div className="settings-item-row">
                  <div className="settings-item-title">Messages</div>
                  <input type="checkbox" className="settings-toggle" checked={notifications.messages} onChange={(e) => updateNotificationSetting('messages', e.target.checked)} />
                </div>
              </div>
              <div className="settings-group-item">
                <div className="settings-item-row">
                  <div className="settings-item-title">Incoming calls</div>
                  <input type="checkbox" className="settings-toggle" checked={notifications.calls} onChange={(e) => updateNotificationSetting('calls', e.target.checked)} />
                </div>
              </div>
              <div className="settings-group-item">
                <div className="settings-item-row">
                  <div className="settings-item-title">Random chat match</div>
                  <input type="checkbox" className="settings-toggle" checked={notifications.randomChat} onChange={(e) => updateNotificationSetting('randomChat', e.target.checked)} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="settings-group">
            <div className="settings-group-box">
              <div className="settings-group-item" onClick={handleRequestPermission}>
                <div className="settings-item-title">Notification problems?</div>
                <div className="settings-item-subtitle" style={{ lineHeight: '1.4', marginTop: '6px' }}>
                  Click here to check or allow notification permissions for this browser.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationsMenu;
