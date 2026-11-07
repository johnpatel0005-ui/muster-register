import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('construction123');
  const [siteName, setSiteName] = useState('Om Sai Construction Site');
  const [isSetup, setIsSetup] = useState(false);
  const [ownerName, setOwnerName] = useState('Contractor / Site Owner');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    // Check if system has an owner
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        if (!data.hasOwner) {
          setIsSetup(true);
        }
        if (data.siteName) {
          setSiteName(data.siteName);
        }
      })
      .catch((err) => console.error('Status check failed:', err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isSetup) {
        // First-time owner setup
        const res = await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            name: ownerName,
            siteName,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Owner setup failed');
        }
        // Auto login with created credentials
        await login(username, password);
      } else {
        await login(username, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <h2>📋 Digital Muster Register</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            {siteName}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="alert alert-info" style={{ fontSize: '13px', marginBottom: '16px' }}>
          {isSetup ? (
            <strong>First-Time Setup: Create your single owner login.</strong>
          ) : (
            <div>
              <strong>Single Owner Login</strong>
              <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                Default: <code>owner</code> / <code>construction123</code>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {isSetup && (
            <>
              <div className="form-group">
                <label>Construction Site Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Owner / Contractor Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px', padding: '10px' }}
            disabled={submitting}
          >
            {submitting ? 'Please wait...' : isSetup ? 'Save & Open Register' : 'Sign In to Register'}
          </button>
        </form>
      </div>
    </div>
  );
};
