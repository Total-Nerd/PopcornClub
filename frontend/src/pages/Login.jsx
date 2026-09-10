import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Popcorn, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../api';

const Login = () => {
  const { login, setup, needsSetup, setUser } = useContext(AuthContext);
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState('username'); // 'username' | 'password' | 'setup-password'
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Setup mode fields (used when needsSetup is true)
  const [setupUsername, setSetupUsername] = useState('');
  const [setupPassword, setSetupPassword] = useState('');

  useEffect(() => {
    if (needsSetup) return;
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setUsernameOrEmail(emailParam);
      checkUser(emailParam);
    }
  }, [needsSetup]);

  const checkUser = async (identifier) => {
    if (!identifier) {
      setError('Username or email is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/pre-login', { usernameOrEmail: identifier });
      const { id, hasPassword } = res.data;
      setUserId(id);
      if (hasPassword) {
        setStep('password');
      } else {
        setStep('setup-password');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Account not found. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    checkUser(usernameOrEmail);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(usernameOrEmail, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password || !confirmPassword) {
      setError('Both password fields are required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/complete-setup', { userId, password });
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        const userRes = await api.get('/auth/me');
        setUser(userRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete password setup');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSetupSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await setup(setupUsername, setupPassword);
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('username');
    setPassword('');
    setConfirmPassword('');
    setUserId(null);
    setError('');
  };

  // 1. Initial Setup flow (no accounts exist)
  if (needsSetup) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ width: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <Popcorn size={48} color="var(--accent)" />
            <h2 style={{ marginTop: '16px' }}>Welcome to PopcornClub</h2>
            <p style={{ color: 'var(--text-muted)' }}>Create your admin account</p>
          </div>

          <form onSubmit={handleAdminSetupSubmit}>
            <div className="input-group">
              <label>Username</label>
              <input 
                type="text" 
                className="input-field" 
                value={setupUsername} 
                onChange={e => setSetupUsername(e.target.value)} 
                required 
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={setupPassword} 
                onChange={e => setSetupPassword(e.target.value)} 
                required 
              />
            </div>
            {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.875rem' }}>{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Normal/Invitation login flow
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Popcorn size={48} color="var(--accent)" style={{ margin: '0 auto' }} />
          <h2 style={{ marginTop: '16px' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)' }}>Please log in to continue</p>
        </div>

        {step === 'username' && (
          <form onSubmit={handleUsernameSubmit}>
            <div className="input-group">
              <label>Username or Email</label>
              <input 
                type="text" 
                className="input-field" 
                value={usernameOrEmail} 
                onChange={e => setUsernameOrEmail(e.target.value)} 
                placeholder="Enter username or email"
                required 
                disabled={loading}
              />
            </div>
            {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.875rem' }}>{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading && <Loader2 size={16} className="spin" />}
              <span>Next</span>
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleLoginSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', background: 'var(--overlay-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button type="button" onClick={resetFlow} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} title="Change Account">
                <ArrowLeft size={16} />
              </button>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Logging in as <strong style={{ color: 'var(--accent)' }}>{usernameOrEmail}</strong>
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                disabled={loading}
                autoFocus
              />
            </div>
            {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.875rem' }}>{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading && <Loader2 size={16} className="spin" />}
              <span>Log In</span>
            </button>
          </form>
        )}

        {step === 'setup-password' && (
          <form onSubmit={handleSetupPasswordSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', background: 'var(--overlay-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button type="button" onClick={resetFlow} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} title="Change Account">
                <ArrowLeft size={16} />
              </button>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                First-time setup for <strong style={{ color: 'var(--accent)' }}>{usernameOrEmail}</strong>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
              Please set a secure password for your new account to complete the setup process.
            </p>

            <div className="input-group">
              <label>Choose Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label>Confirm Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
                disabled={loading}
              />
            </div>
            {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.875rem' }}>{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading && <Loader2 size={16} className="spin" />}
              <span>Set Password & Log In</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
