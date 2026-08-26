import React, { useState } from 'react';
import './SettingsMenu.css';
import { Download, Forward } from 'lucide-react';
import MessageInput from './MessageInput';
import ForwardModal from './ForwardModal';

function ImageViewerModal({ imageUrl, onClose, socket, activeChat, isGroup, friends = [], myGroups = [], onInitiateCall, user }) {
  const [showForward, setShowForward] = useState(false);

  const handleDownload = () => {
    fetch(imageUrl)
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(err => console.error("Download failed:", err));
  };

  const handleForwardSend = (selectedIds) => {
    selectedIds.forEach(targetId => {
      const isTargetGroup = myGroups.some(g => g.id === targetId);
      const baseData = {
        sender: user ? user.username : 'Guest',
        senderId: user ? (user.id || user._id) : null,
        timestamp: new Date().toISOString(),
        imageUrl: imageUrl,
        viewOnce: false
      };
      
      if (isTargetGroup) {
        socket.emit('send_group_message', { ...baseData, room: targetId });
      } else {
        const room = user ? [(user.id || user._id), targetId].sort().join('_') : targetId;
        socket.emit('send_private_message', { ...baseData, room, recipientId: targetId });
      }
    });
  };

  return (
    <>
    <div className="settings-modal-overlay" style={{ zIndex: 99999, justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.9)' }}>
      {/* Top Header Bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', padding: '15px 20px', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
        zIndex: 100000,
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={handleDownload} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Download size={24} />
          </button>
          <button onClick={() => setShowForward(true)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Forward size={24} />
          </button>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '2rem', lineHeight: 1 }}>
          &times;
        </button>
      </div>

      {/* Image Container */}
      <div 
        className="settings-modal-content" 
        style={{ 
          background: 'transparent', 
          boxShadow: 'none', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          border: 'none',
          padding: 0,
          width: '100%',
          height: '100%',
          position: 'relative'
        }} 
      >
        <img 
          src={imageUrl} 
          alt="Full screen"
          style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '12px', objectFit: 'contain' }}
        />
      </div>

      {/* Bottom Reply Bar */}
      {activeChat && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: '100%',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 70%, transparent 100%)',
          padding: '10px',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 100000
        }}>
          <div style={{ width: '100%', maxWidth: '800px' }}>
            <MessageInput socket={socket} activeChat={activeChat} isGroup={isGroup} onInitiateCall={onInitiateCall} />
          </div>
        </div>
      )}
    </div>

    {showForward && (
      <ForwardModal 
        forwardMsg={{ imageUrl }}
        friends={friends}
        myGroups={myGroups}
        onClose={() => setShowForward(false)}
        onSend={handleForwardSend}
      />
    )}
    </>
  );
}


export default ImageViewerModal;
