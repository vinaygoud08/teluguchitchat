import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const LoginModal = ({ onClose, onForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      login(res.data.user, res.data.token);
    } catch (err) {
      setError(err.response?.data?.msg || 'An error occurred');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Welcome Back</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              className="form-control" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              className="form-control" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
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
          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Login</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
