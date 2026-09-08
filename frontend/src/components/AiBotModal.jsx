import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Bot, Send, Sparkles, X, Trash2, ArrowLeft, MessageSquare, Zap, Smile, Copy, Check, Plus, Camera, Image, FileText } from 'lucide-react';

function FormattedAiMessage({ content, isBot }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!isBot) {
    return <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>;
  }

  // Clean raw LaTeX notation into readable math
  let text = content || '';
  text = text
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑[$1 to $2]')
    .replace(/\\sum/g, '∑')
    .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫[$1 to $2]')
    .replace(/\\int/g, '∫')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\textbf\{([^}]+)\}/g, '$1')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\left\(/g, '(').replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[').replace(/\\right\]/g, ']')
    .replace(/\\left\\\{/g, '{').replace(/\\right\\\}/g, '}')
    .replace(/\\\{/g, '{').replace(/\\\}/g, '}')
    .replace(/\\approx/g, '≈')
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\neq?/g, '≠')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\implies/g, '⟹')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sqrt/g, '√')
    .replace(/\^2\b/g, '²').replace(/\^3\b/g, '³').replace(/\^n\b/g, 'ⁿ')
    .replace(/_i\b/g, 'ᵢ').replace(/_1\b/g, '₁').replace(/_2\b/g, '₂').replace(/_3\b/g, '₃')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '');

  const copyCode = (code, idx) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Split into code blocks and normal markdown text
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    parts.push({
      type: 'code',
      language: match[1] || 'code',
      code: match[2].trim(),
      index: blockIndex++
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  const renderInline = (str) => {
    if (!str) return '';
    const tokens = [];
    const inlineRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
    let inLast = 0;
    let inMatch;

    while ((inMatch = inlineRegex.exec(str)) !== null) {
      if (inMatch.index > inLast) {
        tokens.push(str.substring(inLast, inMatch.index));
      }
      if (inMatch[2]) {
        tokens.push(<strong key={inMatch.index} style={{ color: '#f8fafc', fontWeight: 700 }}>{inMatch[2]}</strong>);
      } else if (inMatch[3]) {
        tokens.push(<em key={inMatch.index} style={{ color: '#cbd5e1' }}>{inMatch[3]}</em>);
      } else if (inMatch[4]) {
        tokens.push(
          <code key={inMatch.index} style={{
            background: 'rgba(255,255,255,0.12)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.9em',
            color: '#38bdf8'
          }}>
            {inMatch[4]}
          </code>
        );
      }
      inLast = inMatch.index + inMatch[0].length;
    }
    if (inLast < str.length) {
      tokens.push(str.substring(inLast));
    }
    return tokens.length > 0 ? tokens : str;
  };

  const renderTextPart = (partContent, pIdx) => {
    const lines = partContent.split('\n');
    const elements = [];
    let tableRows = [];
    let inTable = false;

    const flushTable = (k) => {
      if (tableRows.length === 0) return;
      const headers = tableRows[0];
      const rows = tableRows.slice(1);
      elements.push(
        <div key={`table-${k}`} style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: 'rgba(15, 23, 42, 0.75)',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: '0.92rem'
          }}>
            <thead>
              <tr style={{ background: 'rgba(99, 102, 241, 0.25)', borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
                {headers.map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#e0e7ff' }}>
                    {renderInline(h.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rI) => (
                <tr key={rI} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: rI % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  {row.map((cell, cI) => (
                    <td key={cI} style={{ padding: '9px 14px', color: '#f1f5f9' }}>
                      {renderInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    };

    lines.forEach((line, lIdx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed.slice(1, -1).split('|');
        const isSeparator = cells.every(c => c.trim().match(/^:?-+:?$/));
        if (isSeparator) {
          inTable = true;
        } else {
          tableRows.push(cells);
        }
        return;
      } else {
        if (inTable || tableRows.length > 0) {
          flushTable(lIdx);
        }
      }

      if (trimmed.startsWith('### ')) {
        elements.push(
          <div key={lIdx} style={{ fontSize: '1.12rem', fontWeight: 800, color: '#a5b4fc', marginTop: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '4px', height: '16px', background: '#6366f1', borderRadius: '2px', display: 'inline-block' }} />
            {renderInline(trimmed.replace(/^###\s*/, ''))}
          </div>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <div key={lIdx} style={{ fontSize: '1.22rem', fontWeight: 800, color: '#c7d2fe', marginTop: '16px', marginBottom: '8px' }}>
            {renderInline(trimmed.replace(/^##\s*/, ''))}
          </div>
        );
      } else if (trimmed.startsWith('# ')) {
        elements.push(
          <div key={lIdx} style={{ fontSize: '1.32rem', fontWeight: 800, color: '#ffffff', marginTop: '18px', marginBottom: '10px' }}>
            {renderInline(trimmed.replace(/^#\s*/, ''))}
          </div>
        );
      } else if (trimmed === '---' || trimmed === '***') {
        elements.push(<hr key={lIdx} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.12)', margin: '14px 0' }} />);
      } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        elements.push(
          <div key={lIdx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '4px 0', paddingLeft: '6px' }}>
            <span style={{ color: '#818cf8', fontSize: '1.2rem', lineHeight: '1rem', marginTop: '2px' }}>•</span>
            <div style={{ flex: 1 }}>{renderInline(trimmed.replace(/^[*|-]\s+/, ''))}</div>
          </div>
        );
      } else if (trimmed.match(/^\d+\.\s/)) {
        const numMatch = trimmed.match(/^(\d+\.)\s*(.*)$/);
        elements.push(
          <div key={lIdx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', margin: '4px 0', paddingLeft: '6px' }}>
            <span style={{ color: '#93c5fd', fontWeight: 700, minWidth: '22px' }}>{numMatch ? numMatch[1] : '•'}</span>
            <div style={{ flex: 1 }}>{renderInline(numMatch ? numMatch[2] : trimmed)}</div>
          </div>
        );
      } else if (trimmed === '') {
        elements.push(<div key={lIdx} style={{ height: '6px' }} />);
      } else {
        elements.push(
          <div key={lIdx} style={{ margin: '3px 0' }}>
            {renderInline(line)}
          </div>
        );
      }
    });

    if (inTable || tableRows.length > 0) {
      flushTable('end');
    }

    return <div key={pIdx}>{elements}</div>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {parts.map((p, i) => {
        if (p.type === 'code') {
          return (
            <div key={i} style={{
              margin: '10px 0',
              borderRadius: '10px',
              overflow: 'hidden',
              background: '#090d16',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.06)',
                padding: '6px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.8rem',
                color: '#94a3b8',
                borderBottom: '1px solid rgba(255,255,255,0.08)'
              }}>
                <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{p.language}</span>
                <button
                  onClick={() => copyCode(p.code, p.index)}
                  style={{
                    background: copiedIndex === p.index ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    color: copiedIndex === p.index ? '#4ade80' : '#e2e8f0',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {copiedIndex === p.index ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
              <pre style={{
                margin: 0,
                padding: '14px',
                overflowX: 'auto',
                fontSize: '0.88rem',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                color: '#f8fafc',
                lineHeight: '1.5'
              }}>
                <code>{p.code}</code>
              </pre>
            </div>
          );
        }
        return renderTextPart(p.content, i);
      })}
    </div>
  );
}

const LOCAL_FALLBACK_REPLIES = [
  {
    keywords: ['hi', 'hello', 'hey', 'namaste', 'namaskaram', 'నమస్కారం', 'హలో', 'హాయ్', 'ela unnav', 'how are you'],
    reply: "హలో! 🙏 నేను మీ AI అసిస్టెంట్ ని. ఈ రోజు మీకు ఎలా సహాయపడగలను?"
  },
  {
    keywords: ['joke', 'jokes', 'funny', 'నవ్వు', 'జోక్', 'comedy'],
    reply: "😂 ఒక చిన్న జోక్:\nటీచర్: 'బాబూ, సైన్స్ లో నీకు ఇష్టమైన సబ్జెక్ట్ ఏది?'\nస్టూడెంట్: 'రిసెస్ బెల్ టీచర్!' 🔔🤣"
  },
  {
    keywords: ['sametha', 'proverb', 'సామెత', 'quote', 'motivation'],
    reply: "📜 తెలుగు సామెత:\n'తీగ లాగితే డొంక కదిలినట్లు' - చిన్న విషయంతో పెద్ద విషయం బయటపడటం. 🌟"
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
        text: `హలో ${user?.username ? user.username : ''}! 👋 నేను మీ **My AI** అసిస్టెంట్ ని. మీకు ఎలా సహాయపడగలను? ✨`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachment, setAttachment] = useState(null); // { type, name, previewUrl, data (base64), mimeType, textContent }
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [previewModalImg, setPreviewModalImg] = useState(null);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const docInputRef = useRef(null);
  const videoRef = useRef(null);
  const attachMenuRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(`ai_bot_msgs_${user?.id || 'guest'}`, JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, user]);

  // Click outside to close attachment menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setIsAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up camera stream when camera closes
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [cameraStream]);

  // Camera Open Handler
  const handleOpenCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      alert('Camera access could not be started. You can still upload images from your device.');
      setIsCameraOpen(false);
    }
  };

  const handleCloseCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64Data = dataUrl.split(',')[1];

    setAttachment({
      type: 'image',
      name: `Photo_${Date.now()}.jpg`,
      previewUrl: dataUrl,
      data: base64Data,
      mimeType: 'image/jpeg'
    });

    handleCloseCamera();
  };

  // Image File Upload
  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const base64Data = dataUrl.split(',')[1];
      setAttachment({
        type: 'image',
        name: file.name,
        previewUrl: dataUrl,
        data: base64Data,
        mimeType: file.type || 'image/jpeg',
        size: (file.size / 1024).toFixed(1) + ' KB'
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Document File Upload
  const handleDocFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isText = file.type.startsWith('text/') || file.name.match(/\.(txt|csv|json|js|py|cpp|java|html|css|md)$/i);

    if (isText) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const textContent = ev.target.result;
        setAttachment({
          type: 'document',
          name: file.name,
          previewUrl: null,
          textContent: textContent,
          mimeType: 'text/plain',
          size: (file.size / 1024).toFixed(1) + ' KB'
        });
      };
      reader.readAsText(file);
    } else {
      // PDF or binary doc
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const base64Data = dataUrl.split(',')[1];
        setAttachment({
          type: 'document',
          name: file.name,
          previewUrl: null,
          data: base64Data,
          mimeType: isPdf ? 'application/pdf' : 'application/octet-stream',
          size: (file.size / 1024).toFixed(1) + ' KB'
        });
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if ((!query && !attachment) || isTyping) return;

    const currentAttachment = attachment;
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query || (currentAttachment ? `Analyzed attachment: ${currentAttachment.name}` : ''),
      attachment: currentAttachment ? {
        type: currentAttachment.type,
        name: currentAttachment.name,
        previewUrl: currentAttachment.previewUrl,
        size: currentAttachment.size
      } : null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setAttachment(null);
    setIsTyping(true);

    try {
      const historyContext = messages.filter(m => m.id !== 'welcome').slice(-8).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const payload = {
        message: query,
        history: historyContext
      };

      if (currentAttachment) {
        payload.attachment = {
          data: currentAttachment.data,
          mimeType: currentAttachment.mimeType,
          textContent: currentAttachment.textContent,
          fileName: currentAttachment.name
        };
      }

      const res = await axios.post('/api/ai/chat', payload, {
        headers: token ? { 'x-auth-token': token } : {}
      });

      const replyText = res.data?.reply || "నేను మీ సందేశాన్ని అర్థం చేసుకున్నాను! మరిన్ని ప్రశ్నలు అడగండి. 😊";
      const generatedImage = res.data?.generatedImage || null;
      const originalPrompt = res.data?.prompt || query;

      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: replyText,
            generatedImage: generatedImage,
            imagePrompt: originalPrompt,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsTyping(false);
      }, 400);

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
      }, 400);
    }
  };

  const handleRegeneratePhoto = async (msgId, imagePrompt) => {
    if (!imagePrompt) return;
    setIsTyping(true);
    try {
      const res = await axios.post('/api/ai/generate-image', { prompt: imagePrompt }, {
        headers: token ? { 'x-auth-token': token } : {}
      });
      const newImg = res.data?.imageUrl;
      if (newImg) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, generatedImage: newImg } : m));
      }
    } catch (e) {
      console.error('Failed to regenerate image:', e);
    } finally {
      setIsTyping(false);
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
      {/* Hidden file inputs */}
      <input 
        type="file" 
        ref={imageInputRef} 
        accept="image/*" 
        style={{ display: 'none' }} 
        onChange={handleImageFile} 
      />
      <input 
        type="file" 
        ref={docInputRef} 
        accept=".pdf,.doc,.docx,.txt,.csv,.json,.py,.js,.html,.css,.md" 
        style={{ display: 'none' }} 
        onChange={handleDocFile} 
      />

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
              My AI Assistant <Sparkles size={18} color="#fde047" />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              Vision • Documents • Image Gen • Math & Code
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
            <Trash2 size={16} /> Clear
          </button>
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
                  maxWidth: isBot ? '88%' : '75%',
                  padding: '14px 18px',
                  borderRadius: isBot ? '20px 20px 20px 6px' : '20px 20px 6px 20px',
                  background: isBot ? '#1e293b' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#ffffff',
                  boxShadow: isBot ? '0 4px 16px rgba(0,0,0,0.2)' : '0 4px 16px rgba(99, 102, 241, 0.35)',
                  fontSize: '0.98rem',
                  lineHeight: '1.6',
                  position: 'relative',
                  border: isBot ? '1px solid rgba(255,255,255,0.06)' : 'none'
                }}>
                  {/* If user attached media */}
                  {m.attachment && (
                    <div style={{
                      marginBottom: '10px',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '8px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      {m.attachment.type === 'image' && m.attachment.previewUrl ? (
                        <img 
                          src={m.attachment.previewUrl} 
                          alt="User upload" 
                          onClick={() => setPreviewModalImg(m.attachment.previewUrl)}
                          style={{
                            width: '80px',
                            height: '60px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }} 
                        />
                      ) : (
                        <div style={{ padding: '8px 12px', background: '#3b82f6', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                          📄 DOC
                        </div>
                      )}
                      <div style={{ fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600 }}>{m.attachment.name}</div>
                        {m.attachment.size && <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{m.attachment.size}</div>}
                      </div>
                    </div>
                  )}

                  <FormattedAiMessage content={m.text} isBot={isBot} />

                  {/* AI Generated Image Card */}
                  {m.generatedImage && (
                    <div style={{
                      marginTop: '14px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: '#090d16',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                    }}>
                      <div style={{ position: 'relative', overflow: 'hidden' }}>
                        <img 
                          src={m.generatedImage} 
                          alt="AI Generated Art" 
                          onClick={() => setPreviewModalImg(m.generatedImage)}
                          style={{
                            width: '100%',
                            maxHeight: '420px',
                            objectFit: 'cover',
                            display: 'block',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease'
                          }}
                        />
                      </div>
                      <div style={{
                        padding: '10px 14px',
                        background: 'rgba(15, 23, 42, 0.95)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '0.82rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          📸 Ultra-HD Real Photo
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleRegeneratePhoto(m.id, m.imagePrompt || m.text)}
                            title="Generate another real photo shot"
                            style={{
                              background: 'rgba(99, 102, 241, 0.2)',
                              border: '1px solid rgba(99, 102, 241, 0.4)',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              color: '#a5b4fc',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.35)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'; }}
                          >
                            🔄 New Shot
                          </button>
                          <button
                            onClick={() => setPreviewModalImg(m.generatedImage)}
                            style={{
                              background: 'rgba(255,255,255,0.1)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              color: '#ffffff',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            🔍 Full View
                          </button>
                          <a
                            href={m.generatedImage}
                            download="AI_Real_Photo.jpg"
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '5px 12px',
                              color: '#ffffff',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ⬇ Download
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{
                    fontSize: '0.72rem',
                    textAlign: 'right',
                    marginTop: '8px',
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
                <span style={{ fontSize: '0.88rem', color: '#cbd5e1', marginLeft: '6px' }}>AI is thinking & analyzing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Live Camera Viewfinder Modal */}
      {isCameraOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 100001,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            borderRadius: '16px',
            overflow: 'hidden',
            width: '100%',
            maxWidth: '560px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.7)'
          }}>
            <div style={{
              padding: '12px 18px',
              background: '#1e293b',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 700
            }}>
              <span>📷 Capture Photo for AI</span>
              <button 
                onClick={handleCloseCamera}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ background: 'black', position: 'relative', width: '100%', minHeight: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
              />
            </div>
            <div style={{
              padding: '16px',
              background: '#1e293b',
              display: 'flex',
              justifyContent: 'center',
              gap: '16px'
            }}>
              <button
                onClick={handleCloseCamera}
                style={{
                  padding: '10px 20px',
                  borderRadius: '24px',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCapturePhoto}
                style={{
                  padding: '10px 24px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.5)'
                }}
              >
                📸 Capture & Use
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Image Viewer */}
      {previewModalImg && (
        <div 
          onClick={() => setPreviewModalImg(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 100002,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <button 
            onClick={() => setPreviewModalImg(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={24} />
          </button>
          <img 
            src={previewModalImg} 
            alt="Preview" 
            style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} 
          />
        </div>
      )}

      {/* Pinned Bottom Input Bar & Multimodal Controls */}
      <div style={{
        padding: '12px 20px 16px 20px',
        background: '#1e293b',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Attachment Preview Box (if selected) */}
          {attachment && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '12px',
              padding: '8px 14px',
              animation: 'fadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {attachment.type === 'image' && attachment.previewUrl ? (
                  <img 
                    src={attachment.previewUrl} 
                    alt="Preview" 
                    style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{ padding: '8px 12px', background: '#4338ca', borderRadius: '6px', color: 'white', fontWeight: 700, fontSize: '0.8rem' }}>
                    📄 DOC
                  </div>
                )}
                <div>
                  <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.88rem' }}>{attachment.name}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    {attachment.type === 'image' ? '🖼️ Image Ready for AI analysis' : '📄 Document Ready for AI analysis'} ({attachment.size || 'Ready'})
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAttachment(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Remove attachment"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Main Input Row with Plus (+) button and Dropdown Action Menu */}
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            position: 'relative'
          }}>
            {/* Plus (+) Action Button & Floating Menu */}
            <div style={{ position: 'relative' }} ref={attachMenuRef}>
              <button
                type="button"
                onClick={() => setIsAttachMenuOpen(prev => !prev)}
                title="Upload Photo, Document or Camera"
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: isAttachMenuOpen 
                    ? 'linear-gradient(135deg, #6366f1, #a855f7)' 
                    : 'rgba(255,255,255,0.08)',
                  border: isAttachMenuOpen ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.18)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isAttachMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  boxShadow: isAttachMenuOpen ? '0 4px 18px rgba(99,102,241,0.55)' : 'none',
                  flexShrink: 0
                }}
                onMouseEnter={e => {
                  if (!isAttachMenuOpen) {
                    e.currentTarget.style.background = 'rgba(99,102,241,0.25)';
                    e.currentTarget.style.borderColor = '#818cf8';
                  }
                }}
                onMouseLeave={e => {
                  if (!isAttachMenuOpen) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                  }
                }}
              >
                <Plus size={22} strokeWidth={2.5} />
              </button>

              {/* Floating Listwise Actions Popup Menu */}
              {isAttachMenuOpen && (
                <div style={{
                  position: 'absolute',
                  bottom: '58px',
                  left: 0,
                  background: 'rgba(15, 23, 42, 0.96)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  borderRadius: '16px',
                  padding: '8px',
                  width: '270px',
                  boxShadow: '0 18px 45px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  zIndex: 1000,
                  animation: 'fadeInUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                  {/* 1. Camera / Take Photo */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachMenuOpen(false);
                      handleOpenCamera();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#38bdf8'
                    }}>
                      <Camera size={19} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Camera / Take Photo</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Capture math, notes, objects</div>
                    </div>
                  </button>

                  {/* 2. Upload Image */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachMenuOpen(false);
                      imageInputRef.current?.click();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(74, 222, 128, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4ade80'
                    }}>
                      <Image size={19} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Upload Image</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Photos, diagrams, screenshots</div>
                    </div>
                  </button>

                  {/* 3. Upload Document */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachMenuOpen(false);
                      docInputRef.current?.click();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(168, 85, 247, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#c084fc'
                    }}>
                      <FileText size={19} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Upload Document</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>PDF, TXT, CSV, Code files</div>
                    </div>
                  </button>

                  {/* 4. Generate AI Image */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachMenuOpen(false);
                      setInput('Generate an image of ');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fbbf24'
                    }}>
                      <Sparkles size={19} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Generate AI Image</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Create art & graphics from text</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <input 
              type="text"
              placeholder={attachment ? "Add instructions for this file (or press Send)..." : "Ask anything, solve math/code, generate image..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSend();
              }}
              style={{
                flex: 1,
                padding: '13px 20px',
                borderRadius: '28px',
                border: '1px solid rgba(255,255,255,0.15)',
                outline: 'none',
                fontSize: '0.98rem',
                background: '#0f172a',
                color: '#ffffff',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#6366f1';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.2)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />

            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !attachment) || isTyping}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: (input.trim() || attachment) && !isTyping ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255,255,255,0.1)',
                color: (input.trim() || attachment) && !isTyping ? 'white' : '#64748b',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (input.trim() || attachment) && !isTyping ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
                boxShadow: (input.trim() || attachment) && !isTyping ? '0 4px 14px rgba(99,102,241,0.45)' : 'none',
                flexShrink: 0
              }}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiBotModal;
