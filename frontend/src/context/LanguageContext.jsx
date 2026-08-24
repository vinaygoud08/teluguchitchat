import React, { createContext, useState, useEffect, useContext } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(localStorage.getItem('appLanguage') || 'en');

  useEffect(() => {
    localStorage.setItem('appLanguage', language);
  }, [language]);

  const translations = {
    en: {
      chats: '💬 Chats',
      stories: 'Stories',
      friends: 'Friends',
      groups: 'Groups',
      requests: 'Requests',
      search_placeholder: 'Search or start new chat',
      my_story: 'My Story',
      friends_stories: 'Friends\' Stories',
      no_recent_stories: 'No recent stories',
      my_friends: 'My Friends',
      no_friends_found: 'No friends found',
      settings: 'Settings',
      language: 'Language',
      select_language: 'Select Language'
    },
    te: {
      chats: '💬 చాట్‌లు',
      stories: 'స్టోరీలు',
      friends: 'స్నేహితులు',
      groups: 'గ్రూప్‌లు',
      requests: 'అభ్యర్థనలు',
      search_placeholder: 'శోధించండి లేదా కొత్త చాట్ ప్రారంభించండి',
      my_story: 'నా స్టోరీ',
      friends_stories: 'స్నేహితుల స్టోరీలు',
      no_recent_stories: 'ఇటీవలి స్టోరీలు లేవు',
      my_friends: 'నా స్నేహితులు',
      no_friends_found: 'స్నేహితులు కనుగొనబడలేదు',
      settings: 'సెట్టింగ్‌లు',
      language: 'భాష',
      select_language: 'భాషను ఎంచుకోండి'
    },
    hi: {
      chats: '💬 चैट्स',
      stories: 'कहानियां',
      friends: 'दोस्त',
      groups: 'समूह',
      requests: 'अनुरोध',
      search_placeholder: 'खोजें या नई चैट शुरू करें',
      my_story: 'मेरी कहानी',
      friends_stories: 'दोस्तों की कहानियां',
      no_recent_stories: 'कोई हालिया कहानी नहीं',
      my_friends: 'मेरे दोस्त',
      no_friends_found: 'कोई दोस्त नहीं मिला',
      settings: 'सेटिंग्स',
      language: 'भाषा',
      select_language: 'भाषा चुनें'
    }
  };

  const t = (key) => {
    return translations[language]?.[key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
