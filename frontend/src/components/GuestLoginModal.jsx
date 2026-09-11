import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const GuestLoginModal = ({ onClose }) => {
  const [name, setName] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [gender, setGender] = useState('Other');
  const [isHuman, setIsHuman] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);
  const maxDateString = maxDate.toISOString().split('T')[0];

  const handleGuestLogin = async (e) => {
    e.preventDefault();
    if (!isHuman) {
      setError('Please verify that you are not a robot and meet the age requirement.');
      return;
    }

    if (!dobDay || !dobMonth || !dobYear) {
      setError('Please select your full Date of Birth.');
      return;
    }

    // Calculate age from dob
    const birthDate = new Date(`${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }

    if (calculatedAge < 18) {
      setError('You must be at least 18 years old to proceed as a guest.');
      return;
    }

    try {
      const res = await axios.post('/api/auth/guest-login', { name, age: calculatedAge, gender });
      if (res.data && res.data.token && res.data.user) {
        login(res.data.user, res.data.token);
      } else {
        setError('Invalid response received from server.');
      }
    } catch (err) {
      console.error('Guest login request failed:', err);
      const serverMsg = err.response?.data?.msg || err.response?.data?.error || (typeof err.response?.data === 'string' && err.response.data.length < 150 ? err.response.data : null);
      if (!err.response || err.response.status === 404) {
        setError('Backend server is not reachable (404/Network).');
      } else if (err.response.status === 500) {
        setError(serverMsg || 'Internal server error (500). Please check Vercel Logs or environment variables.');
      } else {
        setError(serverMsg || 'An error occurred during guest login');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Guest Login</h2>
        <form onSubmit={handleGuestLogin}>
          <div className="form-group">
            <label>Guest Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Date of Birth</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <select 
                  className="form-control" 
                  value={dobDay} 
                  onChange={e => setDobDay(e.target.value)} 
                  required
                  style={{ padding: '8px 4px' }}
                >
                  <option value="">DD</option>
                  {Array.from({length: 31}, (_, i) => <option key={i+1} value={String(i+1)}>{i+1}</option>)}
                </select>
                <select 
                  className="form-control" 
                  value={dobMonth} 
                  onChange={e => setDobMonth(e.target.value)} 
                  required
                  style={{ padding: '8px 4px' }}
                >
                  <option value="">MM</option>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => 
                    <option key={i+1} value={String(i+1)}>{m}</option>
                  )}
                </select>
                <select 
                  className="form-control" 
                  value={dobYear} 
                  onChange={e => setDobYear(e.target.value)} 
                  required
                  style={{ padding: '8px 4px' }}
                >
                  <option value="">YYYY</option>
                  {Array.from({length: 100}, (_, i) => {
                    const year = new Date().getFullYear() - 18 - i;
                    return <option key={year} value={String(year)}>{year}</option>;
                  })}
                </select>
              </div>
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
          <div style={{ marginTop: '15px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              border: '1px solid #d3d3d3', 
              background: '#f9f9f9', 
              padding: '12px 15px',
              borderRadius: '3px',
              boxShadow: '0 0 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  id="recaptchaCheck"
                  checked={isHuman}
                  onChange={(e) => setIsHuman(e.target.checked)}
                  style={{ width: '24px', height: '24px', cursor: 'pointer' }}
                  required
                />
                <label htmlFor="recaptchaCheck" style={{ fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                  I'm not a robot & I am 18+
                </label>
              </div>
              <div style={{ textAlign: 'center' }}>
                <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" alt="reCAPTCHA" width="28" />
                <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>reCAPTCHA</div>
                <div style={{ fontSize: '8px', color: '#555' }}>Privacy - Terms</div>
              </div>
            </div>
          </div>
          {error && <div className="error-text" style={{ marginTop: '10px' }}>{error}</div>}
          <div className="modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, backgroundColor: '#4CAF50', padding: '10px', borderRadius: '8px', border: 'none' }}>Login as Guest</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GuestLoginModal;
