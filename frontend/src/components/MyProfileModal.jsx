import React, { useState, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

function MyProfileModal({ onClose }) {
  const { user, token, login } = useContext(AuthContext);
  
  // State for profile fields
  const [formData, setFormData] = useState({
    username: user?.username || '',
    gender: user?.gender || '',
    country: user?.country || '',
    birthday: user?.birthday || ''
  });

  // State for password change
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'security'

  const handleProfileChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    
    try {
      const res = await axios.put('/api/users/me', formData, {
        headers: { 'x-auth-token': token }
      });
      setMessage(res.data.msg);
      
      // Update local user state
      login({ ...user, ...formData }, token);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to update profile');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (passwords.newPassword !== passwords.confirmPassword) {
      return setError('New passwords do not match');
    }

    try {
      const res = await axios.post('/api/users/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      }, {
        headers: { 'x-auth-token': token }
      });
      setMessage(res.data.msg);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to change password');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content profile-modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">My Profile</h2>
        
        <div className="profile-tabs">
          <button 
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => { setActiveTab('profile'); setMessage(''); setError(''); }}
          >
            Profile Details
          </button>
          <button 
            className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => { setActiveTab('security'); setMessage(''); setError(''); }}
          >
            Security
          </button>
        </div>

        {message && <div className="success-text" style={{ color: 'var(--success)', textAlign: 'center', marginBottom: '10px', fontSize: '0.9rem' }}>{message}</div>}
        {error && <div className="error-text" style={{ marginBottom: '10px' }}>{error}</div>}

        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="profile-form">
            <div className="form-group readonly-group">
              <label>Email</label>
              <input type="email" className="form-control" value={user?.email || ''} readOnly disabled style={{opacity: 0.7, cursor: 'not-allowed'}} />
            </div>

            <div className="form-group">
              <label>Username</label>
              <input 
                type="text" 
                className="form-control" 
                name="username" 
                value={formData.username} 
                onChange={handleProfileChange} 
                required 
              />
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '15px' }}>
              <div className="form-group half" style={{ flex: 1 }}>
                <label>Gender</label>
                <select className="form-control" name="gender" value={formData.gender} onChange={handleProfileChange}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group half" style={{ flex: 1 }}>
                <label>Birthday</label>
                <input 
                  type="date" 
                  className="form-control" 
                  name="birthday" 
                  value={formData.birthday} 
                  onChange={handleProfileChange} 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Country / Region</label>
              <input 
                type="text" 
                className="form-control" 
                name="country" 
                value={formData.country} 
                onChange={handleProfileChange} 
                placeholder="e.g. India, USA"
              />
            </div>

            <button type="submit" className="btn-primary full-width" style={{ width: '100%', marginTop: '10px', padding: '12px' }}>Save Profile</button>
          </form>
        )}

        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label>Current Password</label>
              <input 
                type="password" 
                className="form-control" 
                name="currentPassword" 
                value={passwords.currentPassword} 
                onChange={handlePasswordChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input 
                type="password" 
                className="form-control" 
                name="newPassword" 
                value={passwords.newPassword} 
                onChange={handlePasswordChange} 
                required 
                minLength="6"
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input 
                type="password" 
                className="form-control" 
                name="confirmPassword" 
                value={passwords.confirmPassword} 
                onChange={handlePasswordChange} 
                required 
                minLength="6"
              />
            </div>

            <button type="submit" className="btn-primary full-width" style={{ width: '100%', marginTop: '10px', padding: '12px' }}>Change Password</button>
          </form>
        )}

        <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '20px' }}>
          <button type="button" className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>Close Profile</button>
        </div>
      </div>
    </div>
  );
}

export default MyProfileModal;
