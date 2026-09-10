import React, { useState, useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera, Monitor, Users, Volume2, VolumeX } from 'lucide-react';
import Avatar from './Avatar';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

const GroupCallOverlay = ({
  socket,
  user,
  groupId,
  groupName,
  callType = 'video', // 'video' | 'audio'
  onLeaveCall
}) => {
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peers, setPeers] = useState([]); // Array of { socketId, userId, username, stream, isVideoOff, isMuted }

  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const remoteStreamsRef = useRef(new Map()); // socketId -> MediaStream
  const pendingIceCandidatesRef = useRef(new Map()); // socketId -> Array<candidate>
  const isMountedRef = useRef(true);

  // 1. Timer
  useEffect(() => {
    isMountedRef.current = true;
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // 2. Initialize Local Stream & Join Call
  useEffect(() => {
    let activeStream = null;

    const initMediaAndJoin = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        activeStream = stream;
        localStreamRef.current = stream;

        if (localVideoRef.current && callType === 'video') {
          localVideoRef.current.srcObject = stream;
        }

        // Join room on backend
        socket.emit('join_group_call', {
          groupId,
          groupName,
          user: { id: user.id || user._id, username: user.username },
          callType
        });
      } catch (err) {
        console.error("Failed to get local media stream:", err);
        // If video fails, try audio only
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          activeStream = audioStream;
          localStreamRef.current = audioStream;
          setIsVideoEnabled(false);

          socket.emit('join_group_call', {
            groupId,
            groupName,
            user: { id: user.id || user._id, username: user.username },
            callType: 'audio'
          });
        } catch (audioErr) {
          console.error("Failed to get audio stream:", audioErr);
          alert("Could not access microphone/camera. Please grant permissions to join the call.");
          onLeaveCall();
        }
      }
    };

    initMediaAndJoin();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
      cleanupAllPeers();
    };
  }, []);

  const createPeerConnection = (targetSocketId, targetUserId, targetUsername) => {
    if (peerConnectionsRef.current.has(targetSocketId)) {
      return peerConnectionsRef.current.get(targetSocketId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(targetSocketId, pc);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        remoteStreamsRef.current.set(targetSocketId, remoteStream);
        updatePeersState();
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('group_call_ice_candidate', {
          groupId,
          toSocketId: targetSocketId,
          fromUserId: user.id || user._id,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        removePeer(targetSocketId);
      }
    };

    return pc;
  };

  const updatePeersState = () => {
    if (!isMountedRef.current) return;
    const currentPeers = [];
    peerConnectionsRef.current.forEach((pc, socketId) => {
      const stream = remoteStreamsRef.current.get(socketId) || null;
      const cached = peers.find(p => p.socketId === socketId) || {};
      currentPeers.push({
        socketId,
        userId: cached.userId || socketId,
        username: cached.username || 'Participant',
        stream,
        isVideoOff: false,
        isMuted: false
      });
    });
    setPeers(currentPeers);
  };

  const removePeer = (targetSocketId) => {
    const pc = peerConnectionsRef.current.get(targetSocketId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(targetSocketId);
    }
    remoteStreamsRef.current.delete(targetSocketId);
    pendingIceCandidatesRef.current.delete(targetSocketId);
    setPeers(prev => prev.filter(p => p.socketId !== targetSocketId));
  };

  const cleanupAllPeers = () => {
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    setPeers([]);
  };

  // 3. Socket event listeners for Group Call
  useEffect(() => {
    // When joining, establish offers with existing participants
    const handleGroupCallJoined = async (data) => {
      console.log("[Group Call Joined] Existing participants:", data.participants);
      if (!data.participants) return;

      for (const p of data.participants) {
        if (!p.socketId || p.userId === (user.id || user._id)) continue;
        const pc = createPeerConnection(p.socketId, p.userId, p.username);
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          socket.emit('group_call_signal', {
            groupId,
            toSocketId: p.socketId,
            fromUserId: user.id || user._id,
            fromUsername: user.username,
            signal: offer,
            callType
          });
        } catch (err) {
          console.error("Error creating offer for", p.username, err);
        }
      }
    };

    // When another user joins after us
    const handleUserJoined = (data) => {
      console.log("[Group Call] User joined:", data.username);
      // Update peers list placeholder
      setPeers(prev => {
        if (prev.some(p => p.socketId === data.socketId)) return prev;
        return [...prev, { socketId: data.socketId, userId: data.userId, username: data.username, stream: null }];
      });
    };

    // Handling Offer or Answer signals
    const handleSignal = async (data) => {
      const { fromSocketId, fromUserId, fromUsername, signal } = data;
      let pc = peerConnectionsRef.current.get(fromSocketId);
      if (!pc) {
        pc = createPeerConnection(fromSocketId, fromUserId, fromUsername);
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          // Apply queued ICE candidates
          const queued = pendingIceCandidatesRef.current.get(fromSocketId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingIceCandidatesRef.current.delete(fromSocketId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('group_call_signal', {
            groupId,
            toSocketId: fromSocketId,
            fromUserId: user.id || user._id,
            fromUsername: user.username,
            signal: answer,
            callType
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const queued = pendingIceCandidatesRef.current.get(fromSocketId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingIceCandidatesRef.current.delete(fromSocketId);
        }
      } catch (err) {
        console.error("Error handling group call signal from", fromUsername, err);
      }
    };

    // Handling ICE candidate
    const handleIceCandidate = async (data) => {
      const { fromSocketId, candidate } = data;
      const pc = peerConnectionsRef.current.get(fromSocketId);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding group ICE candidate:", err);
        }
      } else {
        if (!pendingIceCandidatesRef.current.has(fromSocketId)) {
          pendingIceCandidatesRef.current.set(fromSocketId, []);
        }
        pendingIceCandidatesRef.current.get(fromSocketId).push(candidate);
      }
    };

    // User left call
    const handleUserLeft = (data) => {
      console.log("[Group Call] User left:", data.userId);
      if (data.socketId) {
        removePeer(data.socketId);
      } else if (data.userId) {
        const p = peers.find(item => item.userId === data.userId);
        if (p) removePeer(p.socketId);
      }
    };

    // Call ended by system
    const handleCallEnded = (data) => {
      if (data.groupId === groupId) {
        handleHangup();
      }
    };

    socket.on('group_call_joined', handleGroupCallJoined);
    socket.on('group_call_user_joined', handleUserJoined);
    socket.on('group_call_signal', handleSignal);
    socket.on('group_call_ice_candidate', handleIceCandidate);
    socket.on('group_call_user_left', handleUserLeft);
    socket.on('group_call_ended', handleCallEnded);

    return () => {
      socket.off('group_call_joined', handleGroupCallJoined);
      socket.off('group_call_user_joined', handleUserJoined);
      socket.off('group_call_signal', handleSignal);
      socket.off('group_call_ice_candidate', handleIceCandidate);
      socket.off('group_call_user_left', handleUserLeft);
      socket.off('group_call_ended', handleCallEnded);
    };
  }, [groupId, user, callType]);

  // 4. Controls
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setIsAudioMuted(!audioTracks[0].enabled);
      }
    }
  };

  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        setIsVideoEnabled(videoTracks[0].enabled);
      } else {
        // Add video track dynamically
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
          });
          const newVideoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newVideoTrack);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          peerConnectionsRef.current.forEach(pc => {
            pc.addTrack(newVideoTrack, localStreamRef.current);
          });
          setIsVideoEnabled(true);
        } catch (e) {
          console.error("Could not enable camera:", e);
        }
      }
    }
  };

  const switchCamera = async () => {
    if (!localStreamRef.current) return;
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldTrack = localStreamRef.current.getVideoTracks()[0];

      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStreamRef.current.addTrack(newVideoTrack);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });
    } catch (err) {
      console.error("Failed to switch camera:", err);
    }
  };

  const toggleScreenShare = async () => {
    if (!navigator.mediaDevices.getDisplayMedia) {
      alert("Screen sharing is not supported on this device/browser.");
      return;
    }

    if (isScreenSharing) {
      // Revert to camera
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
        });
        const camTrack = camStream.getVideoTracks()[0];
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(camTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(camTrack);
        });
        setIsScreenSharing(false);
      } catch (err) {
        console.error("Error reverting screen share:", err);
      }
    } else {
      // Start screen share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        localStreamRef.current.addTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });
        setIsScreenSharing(true);

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.error("Screen share cancelled or failed:", err);
      }
    }
  };

  const handleHangup = () => {
    socket.emit('leave_group_call', {
      groupId,
      userId: user.id || user._id
    });
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    cleanupAllPeers();
    onLeaveCall();
  };

  const totalParticipants = peers.length + 1;

  // Grid layout helper
  const getGridColsClass = () => {
    if (totalParticipants <= 1) return 'grid-1';
    if (totalParticipants === 2) return 'grid-2';
    if (totalParticipants <= 4) return 'grid-4';
    if (totalParticipants <= 6) return 'grid-6';
    return 'grid-many';
  };

  return (
    <div className="group-call-overlay">
      {/* Top Bar Header */}
      <div className="group-call-header">
        <div className="group-call-title-area">
          <div className="group-call-indicator">
            <span className="pulsing-live-dot" />
            <span className="group-call-badge">{callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}</span>
          </div>
          <h3 className="group-call-name">{groupName}</h3>
          <span className="group-call-timer">{formatDuration(duration)}</span>
        </div>

        <div className="group-call-header-actions">
          <button
            className={`group-call-hdr-btn ${showParticipantsDrawer ? 'active' : ''}`}
            onClick={() => setShowParticipantsDrawer(!showParticipantsDrawer)}
            title="Participants"
          >
            <Users size={18} />
            <span className="participants-count-tag">{totalParticipants}</span>
          </button>
        </div>
      </div>

      {/* Main Video/Audio Grid Area */}
      <div className={`group-call-grid ${getGridColsClass()}`}>
        {/* Local User Card */}
        <div className="group-call-card local-card">
          {isVideoEnabled && localStreamRef.current ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`group-call-video ${facingMode === 'user' && !isScreenSharing ? 'mirrored' : ''}`}
            />
          ) : (
            <div className="group-call-avatar-wrap">
              <Avatar userId={user.id || user._id} username={user.username} size={80} />
              {!isAudioMuted && <div className="speaking-pulse-ring" />}
            </div>
          )}
          <div className="group-call-card-footer">
            <span className="participant-name">You ({user.username})</span>
            <div className="participant-status-icons">
              {isAudioMuted ? <MicOff size={14} color="#f43f5e" /> : <Mic size={14} color="#22c55e" />}
              {!isVideoEnabled && <VideoOff size={14} color="#94a3b8" />}
            </div>
          </div>
        </div>

        {/* Remote Peers Cards */}
        {peers.map((peer) => (
          <RemoteParticipantCard key={peer.socketId} peer={peer} />
        ))}
      </div>

      {/* Participants Drawer */}
      {showParticipantsDrawer && (
        <div className="group-call-drawer">
          <div className="group-call-drawer-header">
            <h4>In this Call ({totalParticipants})</h4>
            <button onClick={() => setShowParticipantsDrawer(false)} className="drawer-close-btn">&times;</button>
          </div>
          <div className="group-call-drawer-list">
            <div className="drawer-participant-item">
              <Avatar userId={user.id || user._id} username={user.username} size={36} />
              <div className="drawer-participant-info">
                <strong>You ({user.username})</strong>
                <span>{isAudioMuted ? 'Muted' : 'Speaking'}</span>
              </div>
            </div>
            {peers.map(p => (
              <div key={p.socketId} className="drawer-participant-item">
                <Avatar userId={p.userId} username={p.username} size={36} />
                <div className="drawer-participant-info">
                  <strong>{p.username}</strong>
                  <span>Connected</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Control Bar */}
      <div className="group-call-controls">
        <button
          className={`group-call-ctrl-btn ${isAudioMuted ? 'muted' : ''}`}
          onClick={toggleAudio}
          title={isAudioMuted ? "Unmute Mic" : "Mute Mic"}
        >
          {isAudioMuted ? <MicOff size={22} /> : <Mic size={22} />}
          <span>{isAudioMuted ? "Unmute" : "Mute"}</span>
        </button>

        <button
          className={`group-call-ctrl-btn ${!isVideoEnabled ? 'video-off' : ''}`}
          onClick={toggleVideo}
          title={isVideoEnabled ? "Stop Camera" : "Start Camera"}
        >
          {isVideoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
          <span>{isVideoEnabled ? "Camera On" : "Camera Off"}</span>
        </button>

        {isVideoEnabled && (
          <button
            className="group-call-ctrl-btn"
            onClick={switchCamera}
            title="Flip Camera"
          >
            <SwitchCamera size={22} />
            <span>Flip</span>
          </button>
        )}

        <button
          className={`group-call-ctrl-btn ${isScreenSharing ? 'active' : ''}`}
          onClick={toggleScreenShare}
          title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
        >
          <Monitor size={22} />
          <span>{isScreenSharing ? "Stop Share" : "Share"}</span>
        </button>

        <button
          className="group-call-ctrl-btn hangup-btn"
          onClick={handleHangup}
          title="Leave Call"
        >
          <PhoneOff size={24} />
          <span>Leave</span>
        </button>
      </div>
    </div>
  );
};

// Component for each remote participant
const RemoteParticipantCard = ({ peer }) => {
  const videoRef = useRef(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  useEffect(() => {
    if (peer.stream && videoRef.current) {
      videoRef.current.srcObject = peer.stream;
      const checkVideoTrack = () => {
        const videoTracks = peer.stream.getVideoTracks();
        setHasRemoteVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      };
      checkVideoTrack();
      peer.stream.onaddtrack = checkVideoTrack;
      peer.stream.onremovetrack = checkVideoTrack;
    }
  }, [peer.stream]);

  return (
    <div className="group-call-card remote-card">
      {peer.stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`group-call-video ${hasRemoteVideo ? '' : 'hidden'}`}
        />
      )}

      {(!peer.stream || !hasRemoteVideo) && (
        <div className="group-call-avatar-wrap">
          <Avatar userId={peer.userId} username={peer.username} size={80} />
          <div className="speaking-pulse-ring" />
        </div>
      )}

      <div className="group-call-card-footer">
        <span className="participant-name">{peer.username}</span>
        <div className="participant-status-icons">
          {hasRemoteVideo ? <Video size={14} color="#22c55e" /> : <VideoOff size={14} color="#94a3b8" />}
        </div>
      </div>
    </div>
  );
};

export default GroupCallOverlay;
