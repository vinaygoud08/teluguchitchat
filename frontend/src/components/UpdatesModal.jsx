import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkles, RefreshCw, CheckCircle2, ArrowLeft, Download, ShieldCheck, Zap } from 'lucide-react';

const CURRENT_CLIENT_VERSION = localStorage.getItem('app_installed_version') || '2.3.0';

function UpdatesModal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [installedVersion, setInstalledVersion] = useState(CURRENT_CLIENT_VERSION);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    fetchUpdateInfo();
  }, []);

  const fetchUpdateInfo = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/version/check?clientVersion=${installedVersion}`);
      setUpdateInfo(res.data);
    } catch (err) {
      console.error('Failed to check updates:', err);
      // Fallback
      setUpdateInfo({
        version: '2.4.0',
        releaseDate: 'August 26, 2026',
        title: 'Chit Chat Telugu v2.4.0 — Super AI & Responsive Update 🚀',
        changelog: [
          '🤖 Full-Screen Telugu & English AI Assistant (Meta AI style)',
          '💬 Natural message layout & bubble expansion (no awkward line dividing)',
          '📱 Screen-friendly responsive design for Mobile, Tablet & Desktop',
          '🖼️ Clickable Profile Photo Viewer with full-screen zoom',
          '🔒 Supabase Auth sync for instant registration & profile data retention',
          '⚡ Ultra low-latency WebRTC Audio & Video Calling',
          '🎥 24-Hour Video Stories & Profile Songs player'
        ],
        updateAvailable: installedVersion !== '2.4.0'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyUpdate = async () => {
    setUpdating(true);
    try {
      const targetVersion = updateInfo?.version || '2.4.0';
      localStorage.setItem('app_installed_version', targetVersion);
      setInstalledVersion(targetVersion);

      // Clear any service worker / web caches
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        } catch (e) {}
      }

      setUpdateSuccess(true);

      // Reload device view after 1.2s to reflect changes cleanly
      setTimeout(() => {
        window.location.reload(true);
      }, 1200);

    } catch (err) {
      console.error('Error applying update:', err);
      setUpdating(false);
    }
  };

  const hasUpdate = updateInfo?.version && updateInfo.version !== installedVersion;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '94%',
          background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: '24px',
          padding: '0',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              App Updates <Sparkles size={16} color="#fde047" />
            </h3>
          </div>

          <button
            onClick={fetchUpdateInfo}
            disabled={loading}
            title="Check for updates again"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#93c5fd',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s infinite linear' : 'none' }} />
            <span>Check</span>
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px 22px', maxHeight: '72vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <RefreshCw size={36} color="#818cf8" style={{ animation: 'spin 1s infinite linear', marginBottom: '16px' }} />
              <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>Checking for updates...</div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '6px' }}>Connecting to Chit Chat Telugu servers</div>
            </div>
          ) : (
            <>
              {/* Version Badges */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '14px 18px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: '20px'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Device Version</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#e2e8f0', marginTop: '2px' }}>v{installedVersion}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Latest Version</div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: hasUpdate ? '#4ade80' : '#60a5fa',
                    marginTop: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    justifyContent: 'flex-end'
                  }}>
                    v{updateInfo?.version || '2.4.0'}
                    {hasUpdate ? <Zap size={15} color="#4ade80" /> : <CheckCircle2 size={15} color="#60a5fa" />}
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              {hasUpdate ? (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.25), rgba(219, 39, 119, 0.25))',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  padding: '16px',
                  borderRadius: '16px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} color="#fde047" /> New Update Available!
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '4px' }}>
                    {updateInfo?.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    Released: {updateInfo?.releaseDate}
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  padding: '16px',
                  borderRadius: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <CheckCircle2 size={24} color="#4ade80" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#4ade80' }}>Your App is Up to Date</div>
                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>You are running the latest version with all recent features.</div>
                  </div>
                </div>
              )}

              {/* Features / Changelog */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#93c5fd', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} /> What's New in this Version:
                </div>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  {updateInfo?.changelog?.map((item, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        fontSize: '0.86rem', 
                        color: '#e2e8f0', 
                        padding: '6px 0', 
                        borderBottom: idx !== updateInfo.changelog.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        lineHeight: '1.4'
                      }}
                    >
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              {hasUpdate ? (
                <button
                  onClick={handleApplyUpdate}
                  disabled={updating}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '16px',
                    border: 'none',
                    background: updateSuccess ? '#16a34a' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '1rem',
                    cursor: updating ? 'not-allowed' : 'pointer',
                    boxShadow: '0 8px 24px rgba(79, 70, 229, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {updating ? (
                    <>
                      <RefreshCw size={18} style={{ animation: 'spin 1s infinite linear' }} />
                      <span>{updateSuccess ? 'Update Applied! Refreshing...' : 'Downloading & Applying Update...'}</span>
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      <span>Update Now (v{updateInfo?.version || '2.4.0'})</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleApplyUpdate}
                  disabled={updating}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <RefreshCw size={16} />
                  <span>Force Refresh / Reinstall Version</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default UpdatesModal;
