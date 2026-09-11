import React, { useState, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

function MyProfileModal({ initialTab = 'account', onClose }) {
  const { user, token, login } = useContext(AuthContext);


  // State for password change
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab === 'security' ? 'security' : 'account');

  // State for editable profile fields
  const [profileData, setProfileData] = useState({
    country: user?.country || '',
    gender: user?.gender || 'Other',
    birthday: user?.birthday || ''
  });

  const calculateAge = (birthdayString) => {
    if (!birthdayString) return '';
    const today = new Date();
    const birthDate = new Date(birthdayString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    
    const age = calculateAge(profileData.birthday);
    if (age !== '' && age < 18) {
      return setError('You must be at least 18 years old.');
    }

    try {
      const res = await axios.put('/api/users/me', profileData, {
        headers: { 'x-auth-token': token }
      });
      setMessage(res.data.msg);
      // Fetch fresh user data to update the AuthContext
      const meRes = await axios.get('/api/users/me', { headers: { 'x-auth-token': token }});
      login(meRes.data, token); // Update context
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
            className={`tab-btn ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => { setActiveTab('account'); setMessage(''); setError(''); }}
          >
            Account Details
          </button>
          <button 
            className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => { setActiveTab('security'); setMessage(''); setError(''); }}
          >
            Security
          </button>
        </div>

        {message && <div className="success-text" style={{ color: 'var(--success)', textAlign: 'center', marginBottom: '10px', fontSize: '0.9rem' }}>{message}</div>}
        {error && <div className="error-text" style={{ marginBottom: '10px' }}>{typeof error === 'string' ? error : (error?.message || error?.msg || '')}</div>}

        {activeTab === 'account' && (
          <form className="profile-form" onSubmit={handleUpdateProfile}>
            <div className="form-group readonly-group">
              <label>Name / Username</label>
              <input type="text" className="form-control" value={user?.username || ''} readOnly disabled style={{opacity: 0.7, cursor: 'not-allowed'}} />
            </div>

            <div className="form-group readonly-group">
              <label>User ID</label>
              <input type="text" className="form-control" value={user?.id || user?._id || ''} readOnly disabled style={{opacity: 0.7, cursor: 'not-allowed'}} />
            </div>

            <div className="form-group readonly-group">
              <label>Email</label>
              <input type="email" className="form-control" value={user?.email || ''} readOnly disabled style={{opacity: 0.7, cursor: 'not-allowed'}} />
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '15px' }}>
              <div className="form-group half" style={{ flex: 1 }}>
                <label>Country / Region</label>
                <select 
                  className="form-control" 
                  value={profileData.country}
                  onChange={(e) => setProfileData({...profileData, country: e.target.value})}
                >
                  <option value="">Select Country</option>
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group half" style={{ flex: 1 }}>
                <label>Gender</label>
                <select 
                  className="form-control" 
                  value={profileData.gender}
                  onChange={(e) => setProfileData({...profileData, gender: e.target.value})}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Birthday <span style={{ fontWeight: 'normal', color: '#a0a0a0', marginLeft: '10px' }}>{profileData.birthday ? `(Age: ${calculateAge(profileData.birthday)})` : ''}</span></label>
              <input 
                type="date" 
                className="form-control" 
                value={profileData.birthday}
                onChange={(e) => setProfileData({...profileData, birthday: e.target.value})}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Save Profile Changes
            </button>
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
                onChange={(e) => setPasswords({ ...passwords, [e.target.name]: e.target.value })} 
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
                onChange={(e) => setPasswords({ ...passwords, [e.target.name]: e.target.value })} 
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
                onChange={(e) => setPasswords({ ...passwords, [e.target.name]: e.target.value })} 
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
