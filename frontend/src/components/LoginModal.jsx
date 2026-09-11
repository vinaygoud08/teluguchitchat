import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

const LoginModal = ({ onClose, onForgotPassword, onRegister, onGuestLogin }) => {
  const [view, setView] = useState('selection'); // 'selection' or 'userLogin'
  const [loginId, setLoginId] = useState(''); // email or username
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('/api/auth/login', { loginId, password });
      if (res.data && res.data.token && res.data.user) {
        login(res.data.user, res.data.token);
      } else {
        setError('Invalid response received from server.');
      }
    } catch (err) {
      console.error('Login request failed:', err);
      let serverMsg = '';
      const data = err.response?.data;
      if (typeof data === 'string' && data.length < 200) {
        serverMsg = data;
      } else if (data?.msg && typeof data.msg === 'string') {
        serverMsg = data.msg;
      } else if (data?.message && typeof data.message === 'string') {
        serverMsg = data.message;
      } else if (data?.error) {
        if (typeof data.error === 'string') serverMsg = data.error;
        else if (typeof data.error === 'object' && data.error?.message) serverMsg = String(data.error.message);
      }
      
      if (!err.response || err.response.status === 404) {
        setError('Backend server is not reachable (404/Network).');
      } else if (err.response.status === 500) {
        setError(serverMsg || 'Internal server error (500). Please check Vercel Logs or environment variables.');
      } else {
        setError(serverMsg || 'Invalid login credentials. Please check your username/email and password.');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '380px' }}>
        
        {view === 'selection' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <h2 className="modal-title" style={{ marginBottom: '30px' }}>Welcome to Chit Chat</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ padding: '12px', fontSize: '1rem', borderRadius: '8px', border: 'none' }}
                onClick={() => setView('userLogin')}
              >
                Login as User
              </button>
              
              <button 
                type="button" 
                className="btn-primary" 
                style={{ padding: '12px', fontSize: '1rem', borderRadius: '8px', border: 'none', backgroundColor: '#4CAF50' }}
                onClick={onGuestLogin}
              >
                Login as Guest
              </button>
            </div>

            <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <span style={{ color: '#666' }}>New here? </span>
              <button 
                type="button" 
                onClick={onRegister} 
                style={{ background: 'none', border: 'none', color: '#5046e5', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              >
                Register as User
              </button>
            </div>
          </div>
        )}

        {view === 'userLogin' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <button 
                type="button" 
                onClick={() => setView('selection')}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                ← Back
              </button>
              <h2 className="modal-title" style={{ margin: '0 auto', transform: 'translateX(-15px)' }}>User Login</h2>
            </div>

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email or User ID</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={loginId} 
                  onChange={e => setLoginId(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="form-control" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div style={{ textAlign: 'right', marginTop: '5px' }}>
                  <button 
                    type="button" 
                    onClick={onForgotPassword} 
                    style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>
              {error && <div className="error-text">{typeof error === 'string' ? error : (error?.message || error?.msg || '')}</div>}
              <div className="modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }} onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none' }}>Login</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
