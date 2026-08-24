import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import './SettingsMenu.css';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'te', name: 'Telugu (తెలుగు)' },
  { code: 'hi', name: 'Hindi (हिंदी)' }
];

function LanguageMenu({ onClose }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <button className="settings-back-btn" onClick={onClose}>
            ←
          </button>
          <h2 className="settings-title">Language</h2>
        </div>

        <div className="settings-list">
          {LANGUAGES.map(lang => (
            <div 
              key={lang.code} 
              className="settings-item" 
              onClick={() => { setLanguage(lang.code); onClose(); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div className="settings-item-title">{lang.name}</div>
              {language === lang.code && <div style={{ color: '#25d366' }}>✓</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LanguageMenu;
