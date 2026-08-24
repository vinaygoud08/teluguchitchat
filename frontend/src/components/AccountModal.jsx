import React, { useContext, useState, useRef, useEffect } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Avatar from './Avatar';
import './AccountModal.css';

function AccountModal({ onClose, onLogout, onDeleteAccount }) {
  const { user, token } = useContext(AuthContext);
  const dateInputRef = useRef(null);

  // States for expanding 'Change Password' section if needed
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isEditingBirthday, setIsEditingBirthday] = useState(false);
  const [countryCode, setCountryCode] = useState(user?.phone_number ? user.phone_number.split(' ')[0] : '+91');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number ? user.phone_number.substring(user.phone_number.indexOf(' ') + 1) : '');
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);

  const [profileData, setProfileData] = useState({
    country: user?.country || '',
    gender: user?.gender || 'Other',
    birthday: user?.birthday || '',
    phone_number: user?.phone_number || ''
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

  const handleProfileUpdate = async (field, value) => {
    const updatedData = { ...profileData, [field]: value };
    setProfileData(updatedData);

    if (field === 'birthday') {
      const age = calculateAge(value);
      if (age !== '' && age < 18) {
        setError('You must be at least 18 years old.');
        return;
      }
    }

    try {
      const res = await axios.put('/api/users/me', { [field]: value }, {
        headers: { 'x-auth-token': token }
      });
      const meRes = await axios.get('/api/users/me', { headers: { 'x-auth-token': token }});
      login(meRes.data, token); 
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to update profile');
    }
  };

  const handlePhoneUpdate = async (newCode, newNumber) => {
    const fullNumber = newNumber.trim() ? `${newCode} ${newNumber.trim()}` : '';
    setProfileData({ ...profileData, phone_number: fullNumber });
    try {
      await axios.put('/api/users/me', { phone_number: fullNumber }, {
        headers: { 'x-auth-token': token }
      });
      const meRes = await axios.get('/api/users/me', { headers: { 'x-auth-token': token }});
      login(meRes.data, token);
    } catch (err) {
      setError('Failed to save phone number');
    }
  };

  const [avatarUrl, setAvatarUrl] = useState(`https://dbtltzhycoxefpvbzizn.supabase.co/storage/v1/object/public/abcd/profile_photo_${user?.id}.jpg`);
  const [avatarKey, setAvatarKey] = useState(Date.now()); // to force remount of Avatar
  const fileInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await axios.post('/api/media/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-auth-token': token
        }
      });
      localStorage.setItem(`avatar_t_${user?.id || user?._id}`, Date.now());
      
      // Add a slight delay to allow Supabase CDN to propagate the new file
      setTimeout(() => {
        window.dispatchEvent(new Event('avatarUpdate'));
        setAvatarKey(Date.now());
      }, 1500);
      
    } catch (err) {
      console.error('Failed to upload avatar', err);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const formatBirthday = (dateStr) => {
    if (!dateStr) return 'Not specified';
    try {
      const date = new Date(dateStr);
      // Ensure it's a valid date
      if (isNaN(date.getTime())) return dateStr;
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const handlePasswordChange = async (e) => {
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
      setTimeout(() => setShowPasswordChange(false), 2000);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to change password');
    }
  };

  return (
    <div className="account-modal-overlay" onClick={onClose}>
      <div className="account-modal-content" onClick={e => e.stopPropagation()}>
        <div className="account-header">
          <button className="account-back-btn" onClick={onClose}>←</button>
          <h2 className="account-title">Account</h2>
        </div>
        
        <div className="account-scroll-area">
          {/* Avatar Section */}
          <div className="account-avatar-section">
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleAvatarUpload} 
            />
            <div 
              className="account-avatar" 
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: 'pointer', overflow: 'hidden', position: 'relative', background: 'transparent' }}
            >
              <Avatar key={avatarKey} userId={user?.id || user?._id} username={user?.username} size={80} />
            </div>
            <div 
              className="avatar-label" 
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              {uploadingAvatar ? 'Uploading...' : 'Add photo'}
            </div>
          </div>

          {/* User Info Section */}
          <div className="account-section-box">
            <div className="account-field">
              <div className="field-label">Name</div>
              <div className="field-value">{user?.username || 'Not specified'}</div>
            </div>
            <div className="account-field">
              <div className="field-label">User ID</div>
              <div className="field-value">{user?.id || user?._id || 'Unknown'}</div>
            </div>
            <div className="account-field">
              <div className="field-label">Email</div>
              <div className="field-value danger-text">{user?.email || 'Not specified'}</div>
            </div>
            <div className="account-field">
              <div className="field-label danger-text">Social accounts</div>
              <div className="field-icon danger-icon">!</div>
            </div>
            <div className="account-field no-border">
              <div className="field-label" style={{ color: profileData.phone_number ? 'inherit' : '#ff5252' }}>Phone number</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select 
                  className="account-select" 
                  value={countryCode} 
                  onChange={e => {
                    setCountryCode(e.target.value);
                    if (phoneNumber) handlePhoneUpdate(e.target.value, phoneNumber);
                  }}
                  style={{ width: '80px', direction: 'ltr', textAlign: 'left' }}
                >
                  <option value="+91">+91 (IN)</option>
                  <option value="+1">+1 (US)</option>
                  <option value="+44">+44 (UK)</option>
                  <option value="+61">+61 (AU)</option>
                  <option value="+81">+81 (JP)</option>
                  <option value="+971">+971 (UAE)</option>
                </select>
                <input 
                  type="tel"
                  placeholder="Enter number"
                  className="account-input-inline"
                  style={{ textAlign: 'right', width: '120px', color: '#fff' }}
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  onBlur={e => handlePhoneUpdate(countryCode, e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Additional Info Section */}
          <div className="account-section-box">
            <div className="account-field">
              <div className="field-label">Country/Region</div>
              <select 
                className="account-select" 
                value={profileData.country}
                onChange={e => handleProfileUpdate('country', e.target.value)}
              >
                <option value="">Not specified</option>
                <option value="India">India</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
                <option value="Australia">Australia</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="account-field">
              <div className="field-label">Gender</div>
              <select 
                className="account-select" 
                value={profileData.gender}
                onChange={e => handleProfileUpdate('gender', e.target.value)}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="account-field no-border">
              <div className="field-label">Birthday</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: '150px' }}>
                {!isEditingBirthday ? (
                  <span 
                    className="field-value" 
                    style={{ cursor: 'pointer', color: '#a0a0a0', fontSize: '0.85rem' }}
                    onClick={() => setIsEditingBirthday(true)}
                  >
                    {profileData.birthday 
                      ? `${new Date(profileData.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} (Age: ${calculateAge(profileData.birthday)})` 
                      : 'Not specified (Click to add)'}
                  </span>
                ) : (
                  <input 
                    type="date" 
                    className="account-input-inline" 
                    style={{ width: '100%', color: '#fff' }}
                    value={profileData.birthday}
                    autoFocus
                    onChange={e => handleProfileUpdate('birthday', e.target.value)}
                    onBlur={() => setIsEditingBirthday(false)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Actions Section */}
          <div className="account-section-box clickable" onClick={() => setShowPasswordChange(!showPasswordChange)}>
            <div className="account-field no-border">
              <div className="field-label">Change password</div>
            </div>
          </div>

          {showPasswordChange && (
            <div className="password-change-box">
              {message && <div className="success-text">{message}</div>}
              {error && <div className="error-text">{error}</div>}
              <form onSubmit={handlePasswordChange}>
                <input type="password" placeholder="Current Password" required value={passwords.currentPassword} onChange={e => setPasswords({...passwords, currentPassword: e.target.value})} className="account-input" />
                <input type="password" placeholder="New Password" required minLength="6" value={passwords.newPassword} onChange={e => setPasswords({...passwords, newPassword: e.target.value})} className="account-input" />
                <input type="password" placeholder="Confirm New Password" required minLength="6" value={passwords.confirmPassword} onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})} className="account-input" />
                <button type="submit" className="account-submit-btn">Save Password</button>
              </form>
            </div>
          )}

          <div className="account-section-box clickable" onClick={onLogout}>
            <div className="account-field no-border">
              <div className="field-label danger-text">Log out</div>
            </div>
          </div>

          <div className="account-section-box clickable" onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}>
            <div className="account-field no-border">
              <div className="field-label danger-text">Delete my account</div>
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="password-change-box">
              <div className="danger-text" style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                Please enter your password to confirm account deletion. This action cannot be undone.
              </div>
              <input 
                type="password" 
                placeholder="Password" 
                required 
                value={deletePassword} 
                onChange={e => setDeletePassword(e.target.value)} 
                className="account-input" 
              />
              <button 
                type="button" 
                className="account-submit-btn" 
                onClick={() => onDeleteAccount(deletePassword)}
              >
                Permanently Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountModal;
