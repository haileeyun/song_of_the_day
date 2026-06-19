import React, { useState } from 'react';
import { api } from '../utils/api';

export default function Login({ onLoginSuccess, addToast }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      addToast('Please enter both username and password.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      let user;
      if (isRegister) {
        user = await api.register(username, password);
        addToast('Registration successful! Welcome.', 'success');
      } else {
        user = await api.login(username, password);
        addToast(`Welcome back, ${user.username}!`, 'success');
      }
      onLoginSuccess(user);
    } catch (err) {
      addToast(err.message || 'Authentication failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="glass-panel auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div className="logo-icon">🎵</div>
          </div>
          <h2 className="logo-text" style={{ fontSize: '1.8rem', display: 'block', margin: '0.5rem 0' }}>
            Song of the Day
          </h2>
          <p className="auth-subtitle">
            {isRegister 
              ? 'Create an account to build your music calendar' 
              : 'Sign in to access your calendar and share songs'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              className="form-control"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="form-control"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem', padding: '0.8rem' }}
            disabled={isLoading}
          >
            {isLoading 
              ? (isRegister ? 'Creating Account...' : 'Signing In...') 
              : (isRegister ? 'Create Account' : 'Sign In')
            }
          </button>
        </form>

        <p className="auth-toggle-text">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span 
            className="auth-toggle-link" 
            onClick={() => {
              setIsRegister(!isRegister);
              setUsername('');
              setPassword('');
            }}
          >
            {isRegister ? 'Sign In' : 'Sign Up'}
          </span>
        </p>
      </div>
    </div>
  );
}
