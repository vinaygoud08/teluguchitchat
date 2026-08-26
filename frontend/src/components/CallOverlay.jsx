import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Video, VideoOff, SwitchCamera, FlipHorizontal } from 'lucide-react';

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
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [isMirrored, setIsMirrored] = useState(false);
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

  // 3. Setup WebRTC peer connection
  useEffect(() => {
    let currentCallState = callState;
    if (currentCallState === 'outgoing') {
      setupWebRTCAsCaller();
    } else if (currentCallState === 'connected' && incomingSignal && !peerConnectionRef.current) {
      setupWebRTCAsCallee();
    }
  }, [callState]);

  useEffect(() => {
    return () => {
      cleanupWebRTC();
    };
  }, []);

  // 4. Handle accepted signal
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

  // 5. Handle incoming ICE candidates
  useEffect(() => {
    if (iceCandidates && iceCandidates.length > 0) {
      iceCandidates.forEach((candidateObj, index) => {
        if (!processedCandidates.current.has(index)) {
          if (peerConnectionRef.current && isRemoteDescriptionSet.current) {
            peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidateObj))
              .catch(err => console.error("Error adding ICE candidate:", err));
          } else {
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
        video: callType === 'video' ? {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false
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

      socket.emit('call_user', {
        userToCall: otherUser.id || otherUser._id,
        signalData: offer,
        from: user.id || user._id,
        name: user.username,
        callType: callType
      });
    } catch (err) {
      console.error("Failed to setup WebRTC as caller:", err);
      alert("Could not access camera/microphone. Please ensure permissions are granted.");
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
        video: callType === 'video' ? {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false
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

      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
      isRemoteDescriptionSet.current = true;
      
      iceCandidateQueue.current.forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(err => console.error("Error adding queued ICE on callee:", err));
      });
      iceCandidateQueue.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer_call', {
        to: otherUser.id || otherUser._id,
        signal: answer
      });
    } catch (err) {
      console.error("Failed to setup WebRTC as callee:", err);
      alert("Could not access camera/microphone. Please ensure permissions are granted.");
      onHangUp();
    }
  };

  const cleanupWebRTC = () => {
    stopTone();
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
        const nextEnabled = !tracks[0].enabled;
        tracks.forEach(track => {
          track.enabled = nextEnabled;
        });
        setIsVideoOff(!nextEnabled);
      }
    }
  };

  const switchCamera = async () => {
    if (!localStreamRef.current || callType !== 'video') return;
    try {
      const nextFacingMode = facingMode === 'user' ? 'environment' : 'user';
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldVideoTrack) oldVideoTrack.stop();

      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacingMode } }
        });
      } catch (e) {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacingMode } }
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        if (oldVideoTrack) localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(newVideoTrack);

        if (peerConnectionRef.current) {
          const senders = peerConnectionRef.current.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setFacingMode(nextFacingMode);
        if (nextFacingMode === 'environment') {
          setIsMirrored(false);
        }
      }
    } catch (err) {
      console.error("Failed to switch camera:", err);
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
        }
      } catch (err) {}
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60).toString().padStart(2, '0');
    const seconds = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${seconds}`;
  };

  return (
    <div className={`call-overlay ${callType === 'video' ? 'video-mode' : ''}`} style={{ zIndex: 99999 }}>
      {callType === 'video' ? (
        <div className="video-container" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#090a0f', zIndex: 1, overflow: 'hidden' }}>
          <video 
            ref={remoteAudioRef} 
            autoPlay 
            playsInline 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
          <div 
            className="local-video-preview" 
            title="Click to toggle mirror / normal view"
            onClick={() => setIsMirrored(prev => !prev)}
            style={{ zIndex: 10 }}
          >
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover', 
                transform: isMirrored ? 'scaleX(-1)' : 'none',
                display: isVideoOff ? 'none' : 'block'
              }} 
            />
            {isVideoOff && (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1e293b', color: '#94a3b8', gap: '4px' }}>
                <VideoOff size={24} />
                <span style={{ fontSize: '10px' }}>Video Off</span>
              </div>
            )}
            <div style={{ position: 'absolute', bottom: '4px', left: '6px', fontSize: '9px', background: 'rgba(0,0,0,0.65)', color: 'white', padding: '2px 5px', borderRadius: '4px', pointerEvents: 'none' }}>
              {isMirrored ? 'Mirrored' : 'Normal'}
            </div>
          </div>
        </div>
      ) : (
        <audio ref={remoteAudioRef} autoPlay playsInline />
      )}
      
      {/* Pinned Call Card Overlay */}
      <div 
        className={`call-card ${callType === 'video' && callState === 'connected' ? 'video-controls' : ''}`}
        style={{
          position: callType === 'video' && callState === 'connected' ? 'absolute' : 'relative',
          zIndex: 100,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)'
        }}
      >
        {(!callType || callType !== 'video' || callState !== 'connected') && (
          <div className="call-avatar-container">
            <div className={`call-avatar ${callState === 'outgoing' || callState === 'incoming' ? 'pulsing' : ''}`}>
              🗣️
            </div>
          </div>
        )}

        {(!callType || callType !== 'video' || callState !== 'connected') && (
          <h3 className="call-user-name" style={{ margin: '4px 0', fontSize: '1.3rem', fontWeight: 800 }}>
            {otherUser?.username || 'User'}
          </h3>
        )}

        <p className="call-status" style={{ margin: '0 0 14px 0', color: '#cbd5e1', fontSize: '0.92rem' }}>
          {callState === 'outgoing' && 'Calling...'}
          {callState === 'incoming' && `Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call...`}
          {callState === 'connected' && (callType === 'video' ? `In Video Call (${formatTime(duration)})` : `In Call (${formatTime(duration)})`)}
        </p>

        {audioFailed && (
          <button 
            style={{ marginBottom: '14px', padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => {
              remoteAudioRef.current?.play().then(() => setAudioFailed(false)).catch(console.error);
            }}
          >
            Tap to Enable Audio 🔊
          </button>
        )}

        <div className="call-actions" style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
          {callState === 'incoming' ? (
            <>
              <button 
                className="call-btn accept" 
                onClick={onAcceptCall} 
                title="Accept Call"
                style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#22c55e', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 18px rgba(34,197,94,0.45)' }}
              >
                <Phone size={26} />
              </button>
              <button 
                className="call-btn decline" 
                onClick={handleDecline} 
                title="Decline Call"
                style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 18px rgba(239,68,68,0.45)' }}
              >
                <PhoneOff size={26} />
              </button>
            </>
          ) : (
            <>
              {callState === 'connected' && (
                <>
                  <button className={`call-btn mute ${isMuted ? 'muted' : ''}`} onClick={toggleMute} title={isMuted ? "Unmute Mic" : "Mute Mic"}>
                    {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                  </button>
                  
                  {callType === 'video' && (
                    <>
                      <button 
                        className={`call-btn mute ${isVideoOff ? 'muted' : ''}`} 
                        onClick={toggleVideo} 
                        title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                      >
                        {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
                      </button>
                      <button 
                        className="call-btn mute" 
                        onClick={switchCamera} 
                        title={`Switch Camera (${facingMode === 'user' ? 'Front' : 'Back'})`}
                      >
                        <SwitchCamera size={22} />
                      </button>
                      <button 
                        className={`call-btn mute ${isMirrored ? 'active' : ''}`} 
                        onClick={() => setIsMirrored(prev => !prev)} 
                        title={isMirrored ? "Mirror View: ON" : "Mirror View: OFF"}
                      >
                        <FlipHorizontal size={22} />
                      </button>
                    </>
                  )}

                  {callType !== 'video' && (
                    <button className={`call-btn mute ${isSpeakerOn ? 'active' : ''}`} onClick={toggleSpeaker} title={isSpeakerOn ? "Speaker On" : "Speaker Off"}>
                      {isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
                    </button>
                  )}
                </>
              )}

              {/* End / Cancel Call Button */}
              <button 
                className="call-btn decline" 
                onClick={handleHangUp} 
                title={callState === 'connected' ? "End Call" : "Cancel Call"}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
                  transition: 'transform 0.15s ease'
                }}
              >
                <PhoneOff size={26} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;
