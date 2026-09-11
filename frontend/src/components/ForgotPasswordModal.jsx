import React, { useState } from 'react';
import axios from 'axios';
import { Mail, Loader2, AlertCircle, CheckCircle2, X, ArrowLeft } from 'lucide-react';

const ForgotPasswordModal = ({ onClose, onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email: email.trim() });
      setMsg(res.data?.msg || 'Password reset link has been sent to your email.');
      setError('');
    } catch (err) {
      console.error('Forgot password error:', err);
      const data = err.response?.data;
      const serverMsg = data?.msg || data?.message || (typeof data === 'string' ? data : '');
      setError(serverMsg || 'An error occurred while sending reset link. Please try again.');
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
            <Mail size={24} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Reset Your Password
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
            Enter your registered email and we'll send you a password reset link
          </p>
        </div>

        {msg ? (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ color: '#10b981', display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <CheckCircle2 size={44} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Check Your Inbox
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
              Back to Login
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

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                  <Mail size={16} />
                </div>
                <input 
                  type="email" 
                  placeholder="your.email@example.com"
                  value={email} 
                  onChange={e => { setEmail(e.target.value); setError(''); }} 
                  required 
                  autoFocus
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
                  Sending Link...
                </>
              ) : (
                'Send Password Reset Link'
              )}
            </button>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button 
                type="button" 
                onClick={() => { if (onBackToLogin) onBackToLogin(); else if (onClose) onClose(); }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#64748b', 
                  fontSize: '0.86rem', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ArrowLeft size={14} /> Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
