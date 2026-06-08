import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Tv } from 'lucide-react';

const Login = () => {
  const { login, setup, needsSetup } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (needsSetup) {
        await setup(username, password);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ width: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Tv size={48} color="var(--accent)" />
          <h2 style={{ marginTop: '16px' }}>{needsSetup ? 'Welcome to TVTracker' : 'Welcome Back'}</h2>
          <p style={{ color: 'var(--text-muted)' }}>{needsSetup ? 'Create your admin account' : 'Please log in to continue'}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              className="input-field" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              className="input-field" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '0.875rem' }}>{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {needsSetup ? 'Complete Setup' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
