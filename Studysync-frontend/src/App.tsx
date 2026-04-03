import React, { useState, useEffect } from 'react';
import useCameraProcessor from './hooks/useCameraProcessor';
import SpeechDetector from './components/SpeechDetector';
import BlurDetection from './components/BlurDetection';
import FaceDetectors from './components/FaceDetectors';
import YouTubePlayer from './components/YouTubePlayer';
import { Shield, Camera, Mic, AlertTriangle, Users, ExternalLink, PauseCircle, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { io } from 'socket.io-client';
const socket = io('http://localhost:4444');

const getYouTubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const App: React.FC = () => {
  const [ytLink, setYtLink] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState("No");
  const [isBlur, setIsBlur] = useState("No");
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isGracePeriod, setIsGracePeriod] = useState(false);
  const [volume, setVolume] = useState(0);

  // Network & Local Penalty States
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [isNetworkPaused, setIsNetworkPaused] = useState(false);
  const [isTabDistracted, setIsTabDistracted] = useState(false); 
  const [isManualBreak, setIsManualBreak] = useState(false);
  
  const { modelReady, faces, stream, internalVideoRef } = useCameraProcessor(3);

  const attachStream = (el: HTMLVideoElement | null) => {
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  };

  // --- INDEPENDENT TAB SWITCHING CONTROLLER ---
  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.hidden && sessionStarted && !isManualBreak) {
            console.log(`[Study Sync] Tab switched locally!`);
            setIsTabDistracted(true);
            
            if (roomId) {
                socket.emit('distraction-detected', roomId);
            }
        }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [roomId, sessionStarted, isManualBreak]); 

  // --- MASTER NETWORK CONTROLLER ---
  useEffect(() => {
    if (!roomId) return;

    socket.emit('join-room', roomId);

    const handleSyncVideo = (newVideoId: string) => {
        console.log(`[Study Sync] Video synced from room: ${newVideoId}`);
        setVideoId(newVideoId);
        setYtLink(`https://www.youtube.com/watch?v=${newVideoId}`);
    };

    const handlePauseSession = (data: any) => {
        console.log("[Study Sync] Network pause received:", data.message);
        setIsNetworkPaused(true);
    };

    socket.on('sync-video', handleSyncVideo);
    socket.on('pause-session', handlePauseSession);

    return () => {
        socket.off('sync-video', handleSyncVideo);
        socket.off('pause-session', handlePauseSession);
    };
  }, [roomId]);

  // --- FLUID AUTO-RESUME LOGIC ---
  useEffect(() => {
    // 1. If user takes a manual break or a strict network/tab penalty is active, force pause.
    if (isManualBreak || isNetworkPaused || isTabDistracted || !sessionStarted) {
        setIsPlaying(false);
        return;
    }

    // 2. Evaluate Sensors dynamically
    const requirementsMet = isFocused && isBlur === "No" && faces.length === 1 && isSpeaking === "No";
    
    // Auto-play instantly when requirements are met, auto-pause instantly when they fail
    setIsPlaying(requirementsMet || isGracePeriod);
    
  }, [isFocused, isBlur, faces.length, isSpeaking, sessionStarted, isGracePeriod, isNetworkPaused, isTabDistracted, isManualBreak]);

  // --- UI HANDLERS ---
  const handleStart = () => {
    const id = getYouTubeId(ytLink);
    if (id) {
       setVideoId(id);
       if (roomId) {
           socket.emit('set-video', { roomId, videoId: id });
       }
    } else {
       alert('Please enter a valid YouTube URL');
    }
  };

  const startMonitoring = () => {
    setSessionStarted(true);
    setIsGracePeriod(true);
    setTimeout(() => setIsGracePeriod(false), 3000); 
  };

  const handleCreateRoom = () => {
    const newCode = "sync-" + Math.random().toString(36).substring(2, 8);
    setRoomId(newCode);
    if (videoId) {
        socket.emit('set-video', { roomId: newCode, videoId });
    }
  };

  const handleJoinRoom = () => {
    if (joinInput.trim()) {
        setRoomId(joinInput.trim());
    }
  };

  // Calculate if background AI sensors should be actively running to save CPU
  const isSensorsActive = sessionStarted && !isManualBreak && !isTabDistracted && !isNetworkPaused;

  // Compute if the AI warning should be shown (Looking away, but not on a break)
  const showAiWarning = sessionStarted && !isPlaying && !isManualBreak && !isTabDistracted && !isNetworkPaused && !isGracePeriod;

  return (
    <div className="dashboard">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">S</div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>StudySync</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>AI-Powered Focus Monitor</p>
          </div>
        </div>
        <div className="status-badge" style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
             <Camera size={16} color={modelReady ? '#22c55e' : '#ef4444'} />
             <span>Camera {modelReady ? 'Online' : 'Initializing...'}</span>
          </div>
        </div>
      </header>

      <main className="video-section">
        {!videoId ? (
          <div className="setup-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem' }}>
             <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Studying something specific?</h2>
             <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Enter any YouTube video link below to start your focus session.</p>
             <div style={{ display: 'flex', width: '100%', maxWidth: '600px', gap: '1rem' }}>
                <input 
                  type="text" 
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={ytLink}
                  onChange={(e) => setYtLink(e.target.value)}
                  style={{ 
                    flex: 1, 
                    padding: '1rem', 
                    borderRadius: '12px', 
                    background: 'var(--glass-bg)', 
                    border: '1px solid var(--glass-border)',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
                <button 
                  onClick={handleStart}
                  style={{ 
                    padding: '0 2rem', 
                    borderRadius: '12px', 
                    background: 'var(--accent-color)', 
                    color: '#fff', 
                    border: 'none', 
                    fontWeight: 600, 
                    cursor: 'pointer' 
                  }}
                >
                  Confirm Video
                </button>
             </div>
          </div>
        ) : (
          <YouTubePlayer videoId={videoId} isPlaying={isPlaying} />
        )}
        
        <AnimatePresence>
          {videoId && !isPlaying && modelReady && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overlay-warning"
            >
              {!sessionStarted ? (
                <>
                  <Shield size={64} className="pulse" color="var(--accent-color)" style={{ marginBottom: '1rem' }} />
                  <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Ready to Study?</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Grant permissions and click below to begin your monitoring session.</p>
                  <button 
                    onClick={startMonitoring}
                    style={{ 
                      padding: '1rem 3rem', 
                      borderRadius: '30px', 
                      background: 'var(--accent-color)', 
                      color: '#fff', 
                      border: 'none', 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      fontSize: '1.1rem'
                    }}
                  >
                    Start Monitoring Session
                  </button>
                </>
              ) : isManualBreak ? (
                <>
                  <PauseCircle size={64} className="pulse" color="#3b82f6" style={{ marginBottom: '1rem' }} />
                  <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Session Paused</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '2rem', textAlign: 'center' }}>
                    You are on a manual break. The AI has temporarily stopped enforcing focus rules.
                  </p>
                  <button 
                    onClick={() => setIsManualBreak(false)}
                    style={{ 
                      padding: '0.75rem 2rem', 
                      borderRadius: '8px', 
                      background: '#3b82f6', 
                      color: '#fff', 
                      border: 'none', 
                      fontWeight: 600, 
                      cursor: 'pointer' 
                    }}
                  >
                    Resume Session
                  </button>
                </>
              ) : isTabDistracted ? (
                <>
                  <ExternalLink size={64} className="pulse" color="#f97316" style={{ marginBottom: '1rem' }} />
                  <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Tab Switched!</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '2rem', textAlign: 'center' }}>
                    You navigated away from StudySync. The video has been paused to ensure you don't miss any content.
                  </p>
                  <button 
                    onClick={() => setIsTabDistracted(false)}
                    style={{ 
                      padding: '0.75rem 2rem', 
                      borderRadius: '8px', 
                      background: '#f97316', 
                      color: '#fff', 
                      border: 'none', 
                      fontWeight: 600, 
                      cursor: 'pointer' 
                    }}
                  >
                    Acknowledge & Resume
                  </button>
                </>
              ) : isNetworkPaused ? (
                <>
                  <Users size={64} className="pulse" color="#eab308" style={{ marginBottom: '1rem' }} />
                  <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Group Sync Paused</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '2rem', textAlign: 'center' }}>
                    Someone in your study room switched tabs or got distracted. Waiting for everyone to refocus.
                  </p>
                  <button 
                    onClick={() => setIsNetworkPaused(false)}
                    style={{ 
                      padding: '0.75rem 2rem', 
                      borderRadius: '8px', 
                      background: '#eab308', 
                      color: '#000', 
                      border: 'none', 
                      fontWeight: 600, 
                      cursor: 'pointer' 
                    }}
                  >
                    Acknowledge & Resume
                  </button>
                </>
              ) : showAiWarning ? (
                /* NEW: Auto-Resuming Warning Overlay (No Button) */
                <>
                  <AlertTriangle size={64} className="pulse" color="var(--danger-color)" style={{ marginBottom: '1rem' }} />
                  <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Attention Required!</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', textAlign: 'center', marginBottom: '1rem' }}>
                    Playback has been paused because you are not focused or your camera is obscured.
                  </p>
                  <div style={{ padding: '0.5rem 1rem', background: '#ef444420', borderRadius: '8px', border: '1px solid #ef444450', color: '#ef4444', fontSize: '0.875rem', fontWeight: 600 }}>
                     Focus on the screen to auto-resume...
                  </div>
                </>
              ) : null}
              
              {sessionStarted && !isManualBreak && !isTabDistracted && !isNetworkPaused && (
                <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.5 }}>Focus</p>
                    <p style={{ fontWeight: 600, color: (isFocused || isGracePeriod) ? '#22c55e' : '#ef4444' }}>{isGracePeriod ? 'CALIBRATING...' : (isFocused ? 'YES' : 'LOOKING AWAY')}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.5 }}>Presence</p>
                    <p style={{ fontWeight: 600, color: (faces.length === 1 || isGracePeriod) ? '#22c55e' : '#ef4444' }}>{isGracePeriod ? 'DETECTING...' : (faces.length === 1 ? 'OK' : 'NOT DETECTED')}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.5 }}>Blur</p>
                    <p style={{ fontWeight: 600, color: (isBlur === "No" || isGracePeriod) ? '#22c55e' : '#ef4444' }}>{isGracePeriod ? 'CLEANING...' : (isBlur === "No" ? 'CLEAR' : 'BLURRY')}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.5 }}>Silence</p>
                    <p style={{ fontWeight: 600, color: (isSpeaking === "No" || isGracePeriod) ? '#22c55e' : '#ef4444' }}>{isGracePeriod ? 'MONITORING...' : (isSpeaking === "No" ? 'QUIET' : 'SPEAKING')}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <aside className="monitor-section">

        {sessionStarted && (
          <div className="card" style={{ marginBottom: '1rem', background: isManualBreak ? '#1e3a8a30' : 'var(--glass-bg)', borderColor: isManualBreak ? '#3b82f6' : 'var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: isManualBreak ? '#3b82f6' : '#fff', margin: 0 }}>
                  {isManualBreak ? <PauseCircle size={16} /> : <Play size={16} />}
                  Session Control
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                  {isManualBreak ? 'AI is paused.' : 'AI is monitoring.'}
                </p>
              </div>
              <button 
                onClick={() => setIsManualBreak(!isManualBreak)}
                style={{ 
                  padding: '0.5rem 1rem', 
                  borderRadius: '6px', 
                  background: isManualBreak ? '#3b82f6' : 'var(--glass-border)', 
                  color: '#fff', 
                  border: 'none', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                {isManualBreak ? 'Resume AI' : 'Take Break'}
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={16} /> Group Sync
          </h3>
          
          {!roomId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                  onClick={handleCreateRoom}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: 'var(--accent-color)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                  Create Room
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                      type="text" 
                      placeholder="Room Code"
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: '#fff', fontSize: '0.875rem' }}
                  />
                  <button 
                      onClick={handleJoinRoom}
                      style={{ padding: '0.5rem 1rem', borderRadius: '6px', background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                      Join
                  </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid #22c55e50', textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Connected to Room</p>
                <p style={{ fontFamily: 'monospace', fontSize: '1.25rem', color: '#22c55e', margin: '0.5rem 0', fontWeight: 'bold' }}>{roomId}</p>
                <button 
                    onClick={() => setRoomId(null)}
                    style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                    Disconnect
                </button>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Tracking Sensors</h3>
          <div className="status-grid">
            <div className={`status-item ${isFocused ? 'status-active' : 'status-inactive'}`}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className="status-dot"></div>
                <span>Focus Detection</span>
              </div>
              <span style={{ fontSize: '0.875rem' }}>{isFocused ? 'Focused' : 'Lost'}</span>
            </div>

            <div className={`status-item ${isSpeaking === "No" ? 'status-active' : 'status-inactive'}`}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className="status-dot"></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mic size={14} /> <span>Silence Control</span>
                </div>
              </div>
              <span style={{ fontSize: '0.875rem' }}>{isSpeaking === "No" ? 'Quiet' : 'Speaking'}</span>
            </div>

            <div className={`status-item ${isBlur === "No" ? 'status-active' : 'status-inactive'}`}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className="status-dot"></div>
                <span>Video Clarity</span>
              </div>
              <span style={{ fontSize: '0.875rem' }}>{isBlur === "No" ? 'Clear' : 'Blurry'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Hidden/Background Sensors */}
      <SpeechDetector 
        isActive={isSensorsActive}
        setIsSpeaking={(status, vol) => {
          setIsSpeaking(status);
          if (vol !== undefined) setVolume(vol);
        }} 
      />
      
      <BlurDetection 
        videoRef={internalVideoRef} 
        setIsBlur={setIsBlur} 
        isActive={isSensorsActive}
      />
      
      <FaceDetectors 
        setIsFocused={setIsFocused} 
        faces={faces} 
        isActive={isSensorsActive}
      />

      <motion.div
        drag
        dragConstraints={{ left: 0, right: window.innerWidth - 240, top: 0, bottom: window.innerHeight - 180 }}
        initial={{ x: window.innerWidth - 260, y: 100 }}
        className="floating-preview"
        style={{
          position: 'fixed',
          width: '240px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          padding: '8px',
          zIndex: 1000,
          cursor: 'grab',
          boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
        }}
      >
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden' }}>
          <video ref={attachStream} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 8px', background: isFocused ? 'var(--success-color)' : 'var(--danger-color)', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
            {isFocused ? 'FOCUSED' : 'LOST'}
          </div>
        </div>
        
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
             <span style={{ fontSize: '10px', opacity: 0.6, textTransform: 'uppercase' }}>Environmental Noise</span>
             <span style={{ fontSize: '10px', color: volume > 50 ? 'var(--danger-color)' : 'var(--text-secondary)' }}>{volume}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
             <motion.div 
               animate={{ width: `${volume}%` }}
               transition={{ type: 'spring', damping: 15 }}
               style={{ 
                 height: '100%', 
                 background: volume > 50 ? 'var(--danger-color)' : 'linear-gradient(90deg, #6366f1, #a855f7)',
                 boxShadow: '0 0 10px var(--accent-glow)'
               }} 
             />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default App;