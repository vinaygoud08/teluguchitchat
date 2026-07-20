import React, { useState } from 'react';
import axios from 'axios';

const ResetPasswordModal = ({ token, onClose }) => {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/reset-password', { token, password });
      setMsg(res.data.msg);
      setError('');
    } catch (err) {
      setError(err.response?.data?.msg || 'An error occurred');
      setMsg('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Set New Password</h2>
        {msg ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ color: '#4CAF50', fontSize: '16px', marginBottom: '20px' }}>
              {msg}
            </div>
            <button type="button" className="btn-primary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>New Password</label>
              <input 
                type="password" 
                className="form-control" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                minLength="6"
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Reset Password</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordModal;
