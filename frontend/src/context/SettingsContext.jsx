import React, { createContext, useState, useEffect, useContext } from 'react';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('appSettings_notifications');
      return saved ? JSON.parse(saved) : {
        messages: true,
        calls: true,
        randomChat: true
      };
    } catch (e) {
      return {
        messages: true,
        calls: true,
        randomChat: true
      };
    }
  });

  useEffect(() => {
    localStorage.setItem('appSettings_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const updateNotificationSetting = (key, value) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const playNotificationSound = (type) => {
    if (!notifications[type]) return;
    
    try {
      // Different sounds for different events
      const src = type === 'calls' 
        ? 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg'
        : type === 'randomChat'
        ? 'https://actions.google.com/sounds/v1/cartoon/pop_with_echo.ogg'
        : 'https://actions.google.com/sounds/v1/ui/beep_short_on.ogg'; // default message
        
      const audio = new Audio(src);
      audio.play().catch(e => console.log('Audio autoplay prevented:', e));
    } catch (err) {
      console.error('Error playing sound:', err);
    }
  };

  return (
    <SettingsContext.Provider value={{ notifications, updateNotificationSetting, playNotificationSound }}>
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsContext;
