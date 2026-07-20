import React, { useState } from 'react';
import axios from 'axios';

const RegisterModal = ({ onClose }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Other');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/register', { username, email, password, age, gender });
      setSuccessMsg(res.data.msg);
      setError('');
    } catch (err) {
      setError(err.response?.data?.msg || 'An error occurred');
      setSuccessMsg('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Create Account</h2>
        {successMsg ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ color: '#4CAF50', fontSize: '18px', marginBottom: '20px' }}>
              {successMsg}
            </div>
            <button type="button" className="btn-primary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Username</label>
              <input 
                type="text" 
                className="form-control" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
            </div>
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
            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Age</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={age} 
                  onChange={e => setAge(e.target.value)} 
                  min="13" max="120"
                  required 
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Gender</label>
                <select 
                  className="form-control" 
                  value={gender} 
                  onChange={e => setGender(e.target.value)}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
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
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Register</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RegisterModal;
