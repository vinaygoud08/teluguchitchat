import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Video, VideoOff } from 'lucide-react';

const CallOverlay = ({
  socket,
  user,
  callState,
  otherUser,
  acceptedSignal,
  incomingSignal,
  iceCandidates,
  onHangUp,
  onAcceptCall,
  onDeclineCall,
  role,
  callType
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioFailed, setAudioFailed] = useState(false);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const iceCandidateQueue = useRef([]);
  const isRemoteDescriptionSet = useRef(false);
  const processedCandidates = useRef(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 1. Manage Synthetic Ringtone / Dial-tone
  useEffect(() => {
    if (callState === 'outgoing') {
      startTone('dial');
    } else if (callState === 'incoming') {
      startTone('ring');
    } else {
      stopTone();
    }
    return () => stopTone();
  }, [callState]);

  // 2. Timer for active call
  useEffect(() => {
    let interval = null;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  // 3. Setup WebRTC peer connection when call becomes 'connected' (for callee) or 'outgoing' (for caller)
  useEffect(() => {
    let currentCallState = callState;
    if (currentCallState === 'outgoing') {
      setupWebRTCAsCaller();
    } else if (currentCallState === 'connected' && incomingSignal && !peerConnectionRef.current) {
      setupWebRTCAsCallee();
    }

    return () => {
      // Only run cleanup if the component unmounts, not on every state change!
    };
  }, [callState]); // We removed cleanup from here and moved it to unmount!

  useEffect(() => {
    return () => {
      cleanupWebRTC();
    };
  }, []);

  // 4. Handle accepted signal (Caller side gets this when callee accepts)
  useEffect(() => {
    if (acceptedSignal && peerConnectionRef.current && !isRemoteDescriptionSet.current) {
      console.log("Setting remote description on caller side");
      peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(acceptedSignal))
        .then(() => {
          isRemoteDescriptionSet.current = true;
          iceCandidateQueue.current.forEach(candidate => {
            peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
              .catch(err => console.error("Error adding queued ICE on caller:", err));
          });
          iceCandidateQueue.current = [];
        })
        .catch(err => console.error("Error setting remote description on caller:", err));
    }
  }, [acceptedSignal]);

  // 5. Handle incoming ICE candidates from App prop
  useEffect(() => {
    if (iceCandidates && iceCandidates.length > 0) {
      iceCandidates.forEach((candidateObj, index) => {
        if (!processedCandidates.current.has(index)) {
          if (peerConnectionRef.current && isRemoteDescriptionSet.current) {
            console.log("Adding ICE candidate immediately from prop");
            peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidateObj))
              .catch(err => console.error("Error adding ICE candidate:", err));
          } else {
            console.log("Queueing ICE candidate from prop (connection not ready)");
            iceCandidateQueue.current.push(candidateObj);
          }
          processedCandidates.current.add(index);
        }
      });
    }
  }, [iceCandidates]);

  // --- Sound Synthesizer ---
  const startTone = (type) => {
    try {
      stopTone();
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();

      if (type === 'dial') {
        osc1.frequency.setValueAtTime(350, ctx.currentTime);
        osc2.frequency.setValueAtTime(440, ctx.currentTime);
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        osc1.start();
        osc2.start();

        let time = ctx.currentTime;
        for (let i = 0; i < 30; i++) {
          gainNode.gain.setValueAtTime(0.08, time);
          gainNode.gain.setValueAtTime(0, time + 1.2);
          time += 4.0;
        }
      } else if (type === 'ring') {
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(480, ctx.currentTime);
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        osc1.start();
        osc2.start();

        let time = ctx.currentTime;
        for (let i = 0; i < 20; i++) {
          gainNode.gain.setValueAtTime(0.12, time);
          gainNode.gain.setValueAtTime(0, time + 2.0);
          time += 6.0;
        }
      }
    } catch (err) {
      console.error("Synthesizer failed to initialize:", err);
    }
  };

  const stopTone = () => {
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (e) {}
      audioCtxRef.current = null;
    }
  };

  // --- WebRTC Logic ---
  const createPeerConnection = (otherUserId) => {
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { 
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];

    if (import.meta.env.VITE_TURN_URL) {
      iceServers.push({
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
      });
    }

    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice_candidate', {
          to: otherUser.id || otherUser._id,
          candidate: event.candidate,
          from: user.id || user._id
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      const targetRef = remoteAudioRef;
      
      if (targetRef.current) {
        if (event.streams && event.streams[0]) {
          targetRef.current.srcObject = event.streams[0];
        } else {
          let inboundStream = targetRef.current.srcObject || new MediaStream();
          inboundStream.addTrack(event.track);
          targetRef.current.srcObject = inboundStream;
        }
        targetRef.current.play().catch(err => {
          console.error("Media auto-play failed:", err);
          setAudioFailed(true);
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE Connection State:", pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        console.log("WebRTC connection lost. Hanging up.");
        onHangUp();
      }
    };

    return pc;
  };

  const setupWebRTCAsCaller = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true }
        }, 
        video: callType === 'video' 
      });
      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(e => console.error("Local video play failed:", e));
      }

      const pc = createPeerConnection(otherUser.id || otherUser._id);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("Emitting call_user to", otherUser.id || otherUser._id);
      socket.emit('call_user', {
        userToCall: otherUser.id || otherUser._id,
        signalData: offer,
        from: user.id || user._id,
        name: user.username,
        callType: callType
      });
    } catch (err) {
      console.error("Failed to setup WebRTC as caller:", err);
      alert("Could not access microphone. Make sure microphone permissions are enabled.");
      onHangUp();
    }
  };

  const setupWebRTCAsCallee = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true }
        }, 
        video: callType === 'video' 
      });
      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(e => console.error("Local video play failed:", e));
      }

      const pc = createPeerConnection(otherUser.id);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      console.log("Setting remote description from offer on callee");
      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
      isRemoteDescriptionSet.current = true;
      
      iceCandidateQueue.current.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(err => console.error("Error adding queued ICE on callee:", err));
      });
      iceCandidateQueue.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log("Emitting answer_call to", otherUser.id || otherUser._id);
      socket.emit('answer_call', {
        to: otherUser.id || otherUser._id,
        signal: answer
      });
    } catch (err) {
      console.error("Failed to setup WebRTC as callee:", err);
      alert("Could not access microphone. Make sure microphone permissions are enabled.");
      onHangUp();
    }
  };

  const cleanupWebRTC = () => {
    stopTone();
    // Explicitly notify other peer that we are disconnecting
    if (socket && otherUser && (otherUser.id || otherUser._id)) {
      socket.emit('end_call', { to: otherUser.id || otherUser._id });
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    isRemoteDescriptionSet.current = false;
    iceCandidateQueue.current = [];
    processedCandidates.current.clear();
  };

  const handleDecline = () => {
    socket.emit('decline_call', { to: otherUser.id });
    socket.emit('save_call_history', {
      caller_id: otherUser.id,
      callee_id: user.id,
      status: 'declined',
      duration_seconds: 0,
      callType: callType
    });
    onDeclineCall();
  };

  const handleHangUp = () => {
    socket.emit('end_call', { to: otherUser.id || otherUser._id });
    if (role === 'caller') {
      socket.emit('save_call_history', {
        caller_id: user.id || user._id,
        callee_id: otherUser.id || otherUser._id,
        status: callState === 'connected' ? 'completed' : 'missed',
        duration_seconds: duration,
        callType: callType
      });
    } else if (role === 'callee' && callState === 'connected') {
      // Both could try to save, but let's let caller save it to avoid duplicates
    }
    onHangUp();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getAudioTracks();
      tracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getVideoTracks();
      if (tracks.length > 0) {
        tracks.forEach(track => {
          track.enabled = !track.enabled;
        });
      }
    }
  };

  const toggleSpeaker = async () => {
    if (!remoteAudioRef.current) return;
    if (typeof remoteAudioRef.current.setSinkId === 'function') {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        
        if (audioOutputs.length > 1) {
          const currentId = remoteAudioRef.current.sinkId;
          const nextIndex = (audioOutputs.findIndex(d => d.deviceId === currentId) + 1) % audioOutputs.length;
          await remoteAudioRef.current.setSinkId(audioOutputs[nextIndex].deviceId);
          setIsSpeakerOn(!isSpeakerOn);
        } else {
          alert("Only one audio output device found. The OS controls the speaker automatically.");
        }
      } catch (err) {
        console.error("Error setting speaker:", err);
      }
    } else {
      alert("Your browser does not support manually switching audio output. Use your device's built-in speaker toggle if available.");
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60).toString().padStart(2, '0');
    const seconds = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${seconds}`;
  };

  return (
    <div className={`call-overlay ${callType === 'video' ? 'video-mode' : ''}`}>
      {callType === 'video' ? (
        <div className="video-container" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: -1 }}>
          <video ref={remoteAudioRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            style={{ position: 'absolute', bottom: '100px', right: '20px', width: '120px', height: '160px', objectFit: 'cover', borderRadius: '8px', border: '2px solid white' }} 
          />
        </div>
      ) : (
        <audio ref={remoteAudioRef} autoPlay playsInline />
      )}
      
      <div className={`call-card ${callType === 'video' && callState === 'connected' ? 'video-controls' : ''}`} style={callType === 'video' && callState === 'connected' ? { position: 'absolute', bottom: '20px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white' } : {}}>
        {(!callType || callType !== 'video' || callState !== 'connected') && (
          <div className="call-avatar-container">
            <div className={`call-avatar ${callState === 'outgoing' || callState === 'incoming' ? 'pulsing' : ''}`}>
              🗣️
            </div>
          </div>
        )}

        {(!callType || callType !== 'video' || callState !== 'connected') && (
          <h3 className="call-user-name">{otherUser?.username || 'User'}</h3>
        )}
        <p className="call-status" style={callType === 'video' && callState === 'connected' ? { color: 'white' } : {}}>
          {callState === 'outgoing' && 'Calling...'}
          {callState === 'incoming' && `Incoming ${callType === 'video' ? 'Video' : ''} Call...`}
          {callState === 'connected' && `In Call (${formatTime(duration)})`}
        </p>

        {audioFailed && (
          <button 
            style={{ marginTop: '10px', padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => {
              remoteAudioRef.current.play().then(() => setAudioFailed(false)).catch(err => console.error(err));
            }}
          >
            Tap to Enable Audio
          </button>
        )}

        <div className="call-actions">
          {callState === 'incoming' ? (
            <>
              <button className="call-btn accept" onClick={onAcceptCall} title="Accept Call">
                <Phone size={24} />
              </button>
              <button className="call-btn decline" onClick={handleDecline} title="Decline Call">
                <PhoneOff size={24} />
              </button>
            </>
          ) : (
            <>
              {callState === 'connected' && (
                <>
                  <button className={`call-btn mute ${isMuted ? 'muted' : ''}`} onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                  {callType === 'video' && (
                    <button className="call-btn mute" onClick={toggleVideo} title="Toggle Camera">
                      <Video size={24} />
                    </button>
                  )}
                  {callType !== 'video' && (
                    <button className={`call-btn mute ${isSpeakerOn ? 'active' : ''}`} onClick={toggleSpeaker} title={isSpeakerOn ? "Speaker On" : "Speaker Off"}>
                      {isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
                    </button>
                  )}
                </>
              )}
              <button className="call-btn decline" onClick={handleHangUp} title="End Call">
                <PhoneOff size={24} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;
