import React, { useState } from 'react';
import axios from 'axios';
import { Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';

const ResetPasswordModal = ({ token, onClose, onBackToLogin }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/reset-password', { token, password });
      setMsg(res.data?.msg || 'Password successfully reset! You can now log in.');
      setError('');
    } catch (err) {
      console.error('Reset password error:', err);
      const data = err.response?.data;
      const serverMsg = data?.msg || data?.message || (typeof data === 'string' ? data : '');
      setError(serverMsg || 'An error occurred while resetting your password. The link may have expired.');
      setMsg('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000, backdropFilter: 'blur(8px)', background: 'rgba(10, 10, 20, 0.7)' }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: '400px', 
          width: '92%', 
          padding: '28px 24px', 
          borderRadius: '24px',
          background: 'linear-gradient(165deg, #ffffff 0%, #f8faff 100%)',
          boxShadow: '0 25px 50px -12px rgba(80, 70, 229, 0.25), 0 0 0 1px rgba(99, 102, 241, 0.1)',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button 
          type="button"
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '18px', 
            right: '18px', 
            background: '#f1f3f9', 
            border: 'none', 
            borderRadius: '50%', 
            width: '32px', 
            height: '32px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: '#64748b', 
            cursor: 'pointer' 
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '48px', 
            height: '48px', 
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))', 
            borderRadius: '16px',
            color: '#4f46e5',
            marginBottom: '10px'
          }}>
            <Lock size={24} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Set New Password
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
            Choose a secure password for your account
          </p>
        </div>

        {msg ? (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ color: '#10b981', display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <CheckCircle2 size={44} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Password Changed!
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '20px' }}>
              {msg}
            </p>
            <button 
              type="button" 
              onClick={() => { if (onBackToLogin) onBackToLogin(); else if (onClose) onClose(); }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.94rem',
                cursor: 'pointer'
              }}
            >
              Log In Now
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '10px 12px',
                borderRadius: '12px',
                fontSize: '0.82rem',
                marginBottom: '14px'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>{typeof error === 'string' ? error : (error?.message || error?.msg || 'Error')}</div>
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                  <Lock size={16} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="At least 6 characters"
                  value={password} 
                  onChange={e => { setPassword(e.target.value); setError(''); }} 
                  required 
                  minLength={6}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 38px',
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.92rem',
                    background: '#f8fafc',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                  <Lock size={16} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Repeat your password"
                  value={confirmPassword} 
                  onChange={e => { setConfirmPassword(e.target.value); setError(''); }} 
                  required 
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 38px',
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '0.92rem',
                    background: '#f8fafc',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.96rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 20px rgba(79, 70, 229, 0.35)',
                opacity: loading ? 0.8 : 1
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  Updating Password...
                </>
              ) : (
                'Save New Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordModal;
