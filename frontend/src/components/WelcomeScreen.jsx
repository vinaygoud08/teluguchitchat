import React from 'react';

const WelcomeScreen = ({ onSignUp, onLogin }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, var(--brand-400), var(--coral-500))',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '1.8rem',
            fontWeight: 'bold',
            boxShadow: 'var(--shadow-md)'
          }}>
            CC
          </div>
        </div>

        <h2 className="modal-title" style={{ fontSize: '1.6rem', marginBottom: '12px' }}>
          Free voice & video calls
        </h2>
        <p className="warning-text" style={{ marginBottom: '32px', fontSize: '0.95rem' }}>
          Join Chit Chat Telugu to connect with friends and the community.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="btn-primary" onClick={onSignUp} style={{ width: '100%', padding: '14px', fontSize: '1.05rem', borderRadius: 'var(--radius-md)' }}>
            Sign up
          </button>
          
          <button className="btn-cancel" onClick={onLogin} style={{ width: '100%', padding: '14px', fontSize: '1.05rem', background: 'var(--neutral-100)', color: 'var(--neutral-800)', borderRadius: 'var(--radius-md)' }}>
            Log in
          </button>
        </div>

        <p style={{ marginTop: '24px', fontSize: '0.8rem', color: 'var(--neutral-600)' }}>
          By continuing, you agree to the Terms and acknowledge the Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
