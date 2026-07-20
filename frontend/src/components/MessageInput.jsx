import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Send, Image as ImageIcon, Smile, Phone, Sticker } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

const STICKERS = [
  'https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.gif',
  'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
  'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
  'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
  'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif',
  'https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif',
  'https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif',
  'https://media.giphy.com/media/BzyTuYCmvSORqs1Q/giphy.gif',
];

const MessageInput = ({ socket, activeChat, onInitiateCall }) => {
  const { user, token } = useAuth();
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const fileInputRef = useRef(null);

  const handleSendText = () => {
    if (!text.trim()) return;
    sendMessage({ text: text.trim() });
    setText('');
  };

  const sendMessage = (content) => {
    const baseData = {
      sender: user ? user.username : `Guest-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...content
    };

    if (activeChat === 'home') {
      socket.emit('send_message', baseData);
    } else {
      if (!user) return; // Guests can't send private messages
      const room = [user.id, activeChat].sort().join('_');
      socket.emit('send_private_message', {
        ...baseData,
        room,
        senderId: user.id,
        recipientId: activeChat
      });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSendText();
  };

  const handleImageClick = () => {
    if (!user) return;
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await axios.post('/api/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-auth-token': token
        }
      });
      sendMessage({ imageUrl: res.data.imageUrl });
    } catch (err) {
      console.error('Upload failed', err);
      alert('Failed to upload image.');
    }
    e.target.value = '';
  };

  const handleGifClick = () => {
    if (!user) return;
    const url = prompt('Paste the direct URL of the GIF:');
    if (url) {
      sendMessage({ gifUrl: url });
    }
  };

  const handleEmojiToggle = () => {
    if (!user) return;
    setShowEmojiPicker(!showEmojiPicker);
    setShowStickerPicker(false);
  };

  const onEmojiClick = (emojiObject) => {
    setText(prev => prev + emojiObject.emoji);
  };

  const handleStickerClick = () => {
    if (!user) return;
    setShowStickerPicker(!showStickerPicker);
    setShowEmojiPicker(false);
  };

  const onStickerSelect = (url) => {
    sendMessage({ stickerUrl: url });
    setShowStickerPicker(false);
  };

  const handleCallClick = () => {
    if (!user || activeChat === 'home') return;
    onInitiateCall();
  };

  const isGuestInPrivate = !user && activeChat !== 'home';

  return (
    <div className="input-area">
      <div className="input-wrapper">
        <input 
          type="text" 
          className="chat-input" 
          placeholder={isGuestInPrivate ? "Login to chat privately" : "Type a message..."} 
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isGuestInPrivate}
        />
      </div>
      
      <input 
        type="file" 
        accept="image/*" 
        style={{ display: 'none' }} 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      
      <button 
        className="action-btn" 
        disabled={!user} 
        onClick={handleImageClick}
        data-tooltip={!user ? "Login to send images" : "Send Image"}
      >
        <ImageIcon size={20} />
      </button>
      
      <button 
        className="action-btn" 
        disabled={!user} 
        onClick={handleEmojiToggle}
        data-tooltip={!user ? "Login to send Emojis" : "Emoji"}
      >
        <Smile size={20} />
      </button>

      <button 
        className="action-btn" 
        disabled={!user} 
        onClick={handleStickerClick}
        data-tooltip={!user ? "Login to send Stickers" : "Send Sticker"}
      >
        <Sticker size={20} />
      </button>

      <button 
        className="action-btn" 
        disabled={!user || activeChat === 'home'} 
        onClick={handleCallClick}
        data-tooltip={!user ? "Login to make calls" : (activeChat === 'home' ? "Select a user to call" : "Voice Call")}
      >
        <Phone size={20} />
      </button>

      <button className="send-btn" onClick={handleSendText} disabled={isGuestInPrivate}>
        <Send size={18} />
      </button>

      {showEmojiPicker && (
        <div className="picker-container">
          <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
        </div>
      )}

      {showStickerPicker && (
        <div className="picker-container sticker-picker">
          <div className="sticker-grid">
            {STICKERS.map((url, i) => (
              <img key={i} src={url} alt="sticker" onClick={() => onStickerSelect(url)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageInput;
