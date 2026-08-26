import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Bot, Send, Sparkles, X, Trash2, ArrowLeft, MessageSquare, Zap, Smile } from 'lucide-react';

const SUGGESTIONS = [
  { label: "నమస్కారం! 🙏", text: "నమస్కారం! ఎలా ఉన్నారు?" },
  { label: "Telugu Joke 😄", text: "ఒక మంచి తెలుగు జోక్ చెప్పు" },
  { label: "తెలుగు సామెత 📜", text: "ఒక మంచి తెలుగు సామెత మరియు అర్థం చెప్పు" },
  { label: "App Features 💡", text: "Chit Chat Telugu లో ఏమేం ఫీచర్లు ఉన్నాయి?" },
  { label: "Movie Trivia 🎬", text: "తెలుగు సినిమా గురించి ఏదైనా ఆసక్తికరమైన విషయం చెప్పు" },
  { label: "Friendship Quote 🤝", text: "స్నేహం గురించి ఒక మంచి కొటేషన్ చెప్పు" },
];

const LOCAL_FALLBACK_REPLIES = [
  {
    keywords: ['hi', 'hello', 'hey', 'namaste', 'namaskaram', 'నమస్కారం', 'హలో', 'హాయ్', 'ela unnav', 'how are you'],
    reply: "నమస్కారం! 🙏 నేను మీ Chit Chat Telugu AI Bot. ఈ రోజు మీకు ఎలా సహాయపడగలను?"
  },
  {
    keywords: ['joke', 'jokes', 'funny', 'నవ్వు', 'జోక్', 'comedy'],
    reply: "😂 ఒక చిన్న జోక్:\nటీచర్: 'బాబూ, సైన్స్ లో నీకు ఇష్టమైన సబ్జెక్ట్ ఏది?'\nస్టూడెంట్: 'రిసెస్ బెల్ టీచర్!' 🔔🤣"
  },
  {
    keywords: ['sametha', 'proverb', 'సామెత', 'quote', 'motivation'],
    reply: "📜 తెలుగు సామెత:\n'తీగ లాగితే డొంక కదిలినట్లు' - చిన్న విషయంతో పెద్ద విషయం బయటపడటం."
  },
  {
    keywords: ['feature', 'features', 'app', 'help', 'call', 'video', 'story', 'stranger'],
    reply: "📱 Chit Chat Telugu ఫీచర్లు:\n1. 💬 **Private Chat**: ఎండ్-టు-ఎండ్ ఎన్క్రిప్షన్‌తో చాటింగ్.\n2. 📞 **Audio & Video Calls**: హై క్వాలిటీ కాల్స్.\n3. 🕵️ **Stranger Chat**: అపరిచితులతో చాట్.\n4. 📺 **Stories**: స్టేటస్ వీడియోలు & ప్రొఫైల్ సాంగ్స్.\n5. 👥 **Groups**: స్నేహితులతో గ్రూప్స్!"
  }
];

function AiBotModal({ onClose }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(`ai_bot_msgs_${user?.id || 'guest'}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        id: 'welcome',
        sender: 'bot',
        text: `నమస్కారం ${user?.username || ''}! 🙏\nనేను మీ Chit Chat Telugu AI Assistant ని. మీరు నాతో తెలుగులో లేదా ఇంగ్లీషులో చాట్ చేయవచ్చు! 🤖✨`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(`ai_bot_msgs_${user?.id || 'guest'}`, JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, user]);

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isTyping) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const historyContext = messages.filter(m => m.id !== 'welcome').slice(-8).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const res = await axios.post('/api/ai/chat', { 
        message: query,
        history: historyContext
      }, {
        headers: token ? { 'x-auth-token': token } : {}
      });

      const replyText = res.data?.reply || "నేను మీ సందేశాన్ని అర్థం చేసుకున్నాను! మరిన్ని ప్రశ్నలు అడగండి. 😊";

      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: replyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsTyping(false);
      }, 500);

    } catch (err) {
      const clean = query.toLowerCase();
      let matched = LOCAL_FALLBACK_REPLIES.find(r => r.keywords.some(k => clean.includes(k)));
      const replyText = matched ? matched.reply : "నమస్కారం! నేను మీ Chit Chat Telugu AI బోట్ ని. మీతో మాట్లాడటం చాలా సంతోషంగా ఉంది! 🤖🌟";

      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: replyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsTyping(false);
      }, 500);
    }
  };

  const handleClear = () => {
    const welcome = [
      {
        id: 'welcome',
        sender: 'bot',
        text: `నమస్కారం! 🙏 చాట్ రీసెట్ చేయబడింది. ఏం మాట్లాడదాం? 🤖`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    setMessages(welcome);
    localStorage.removeItem(`ai_bot_msgs_${user?.id || 'guest'}`);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Full Screen Top Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: 'white',
        flexShrink: 0,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            title="Back to Chit Chat"
          >
            <ArrowLeft size={22} />
          </button>
          
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.45)',
            border: '2px solid rgba(255,255,255,0.3)'
          }}>
            <Bot size={26} color="white" />
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              My AI Bot <Sparkles size={18} color="#fde047" />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              Always Online • Telugu & English AI Assistant
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={handleClear}
            title="Clear Chat History"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          >
            <Trash2 size={16} /> Clear Chat
          </button>
        </div>
      </div>

      {/* Suggestion Chips Banner */}
      <div style={{
        background: '#1e293b',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '10px 20px',
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: '10px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          {SUGGESTIONS.map((item, index) => (
            <button
              key={index}
              onClick={() => handleSend(item.text)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#e2e8f0',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={e => { 
                e.currentTarget.style.borderColor = '#818cf8'; 
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)';
                e.currentTarget.style.color = '#ffffff'; 
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; 
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = '#e2e8f0'; 
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Full-Screen Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 20px',
        background: '#0b1329',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flex: 1
        }}>
          {messages.map((m) => {
            const isBot = m.sender === 'bot';
            return (
              <div 
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: isBot ? 'flex-start' : 'flex-end',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}
              >
                {isBot && (
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0,
                    boxShadow: '0 4px 10px rgba(99,102,241,0.3)',
                    marginTop: '2px'
                  }}>
                    <Bot size={20} />
                  </div>
                )}
                <div style={{
                  maxWidth: '75%',
                  padding: '14px 18px',
                  borderRadius: isBot ? '20px 20px 20px 6px' : '20px 20px 6px 20px',
                  background: isBot ? '#1e293b' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#ffffff',
                  boxShadow: isBot ? '0 4px 16px rgba(0,0,0,0.2)' : '0 4px 16px rgba(99, 102, 241, 0.35)',
                  fontSize: '0.98rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  position: 'relative',
                  border: isBot ? '1px solid rgba(255,255,255,0.06)' : 'none'
                }}>
                  {m.text}
                  <div style={{
                    fontSize: '0.72rem',
                    textAlign: 'right',
                    marginTop: '6px',
                    color: isBot ? '#94a3b8' : 'rgba(255,255,255,0.75)'
                  }}>
                    {m.time}
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <Bot size={20} />
              </div>
              <div style={{ background: '#1e293b', padding: '12px 20px', borderRadius: '20px 20px 20px 6px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ width: '8px', height: '8px', background: '#818cf8', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: '0.88rem', color: '#cbd5e1', marginLeft: '6px' }}>AI is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pinned Bottom Input Bar */}
      <div style={{
        padding: '16px 20px',
        background: '#1e293b',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <input 
            type="text"
            placeholder="Type in Telugu or English (e.g. ఒక జోక్ చెప్పు)..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSend();
            }}
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: '28px',
              border: '1px solid rgba(255,255,255,0.15)',
              outline: 'none',
              fontSize: '1rem',
              background: '#0f172a',
              color: '#ffffff'
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: input.trim() && !isTyping ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.1)',
              color: input.trim() && !isTyping ? 'white' : '#64748b',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              boxShadow: input.trim() && !isTyping ? '0 4px 14px rgba(99,102,241,0.45)' : 'none',
              flexShrink: 0
            }}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AiBotModal;
