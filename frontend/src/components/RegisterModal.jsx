import React, { useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';

const RegisterModal = ({ onClose }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [gender, setGender] = useState('Other');
  const [country, setCountry] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setName(newName);
    if (newName.trim() !== '') {
      // Auto-generate username (User ID) based on name
      const baseName = newName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      setUsername(`${baseName}_${randomNum}`);
    } else {
      setUsername('');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('You must agree to the terms and conditions and verify you are 18+.');
      return;
    }

    if (!dobDay || !dobMonth || !dobYear) {
      setError('Please select your full Date of Birth.');
      return;
    }

    const birthDateStr = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }

    if (calculatedAge < 18) {
      setError('You must be at least 18 years old to register.');
      return;
    }

    try {
      const res = await axios.post('/api/auth/register', { username, email, password, age: calculatedAge, gender, birthday: birthDateStr, country });
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
              <label>Name</label>
              <input 
                type="text" 
                className="form-control" 
                value={name} 
                onChange={handleNameChange} 
                required 
              />
            </div>
            {username && (
              <div className="form-group">
                <label>System Generated User ID</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={username} 
                  disabled
                  style={{ backgroundColor: '#f0f0f0' }}
                />
              </div>
            )}
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
            <div className="form-group">
              <label>Country/Region</label>
              <select 
                className="form-control" 
                value={country} 
                onChange={e => setCountry(e.target.value)}
                required
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
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input 
                type="checkbox" 
                id="termsCheck"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: '4px' }}
                required
              />
              <label htmlFor="termsCheck" style={{ fontSize: '13px', lineHeight: '1.4' }}>
                I am 18+ and agree to the Terms and Conditions.
              </label>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Sign up</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RegisterModal;
