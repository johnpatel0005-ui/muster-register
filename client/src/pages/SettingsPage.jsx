import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const SettingsPage = () => {
  const { authFetch, site, user, refreshSite } = useAuth();

  // Site settings state
  const [siteName, setSiteName] = useState('');
  const [location, setLocation] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [standardDailyHours, setStandardDailyHours] = useState(8);
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [siteMessage, setSiteMessage] = useState('');
  const [siteError, setSiteError] = useState('');
  const [pwdMessage, setPwdMessage] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [savingSite, setSavingSite] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    if (site) {
      setSiteName(site.name || '');
      setLocation(site.location || '');
      setOwnerName(site.ownerName || '');
      setStandardDailyHours(site.standardDailyHours || 8);
      setCurrencySymbol(site.currencySymbol || '₹');
    }
  }, [site]);

  const handleSaveSite = async (e) => {
    e.preventDefault();
    setSiteMessage('');
    setSiteError('');
    setSavingSite(true);

    try {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: siteName,
          location,
          ownerName,
          standardDailyHours: Number(standardDailyHours),
          currencySymbol,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to save settings');
      }

      setSiteMessage('Site settings updated successfully.');
      refreshSite();
    } catch (err) {
      setSiteError(err.message);
    } finally {
      setSavingSite(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwdMessage('');
    setPwdError('');

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPwdError('New password must be at least 6 characters');
      return;
    }

    setSavingPwd(true);

    try {
      const res = await authFetch('/api/auth/update-profile', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Password update failed');
      }

      setPwdMessage('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdError(err.message);
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Register & Site Settings</h1>
          <div className="page-subtitle">
            Configure site details, standard shift hours, and owner credentials
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Construction Site Details */}
        <div className="register-panel">
          <div className="panel-header">
            <h3>Construction Site Details</h3>
          </div>

          {siteMessage && <div className="alert alert-success">{siteMessage}</div>}
          {siteError && <div className="alert alert-error">{siteError}</div>}

          <form onSubmit={handleSaveSite}>
            <div className="form-group">
              <label>Construction Project / Site Name</label>
              <input
                type="text"
                className="form-control"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Site Location / Address</label>
              <input
                type="text"
                className="form-control"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Owner / Contractor Name</label>
              <input
                type="text"
                className="form-control"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label>Standard Daily Hours</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  className="form-control"
                  value={standardDailyHours}
                  onChange={(e) => setStandardDailyHours(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Currency Symbol</label>
                <input
                  type="text"
                  className="form-control"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={savingSite}>
              {savingSite ? 'Saving...' : 'Save Site Settings'}
            </button>
          </form>
        </div>

        {/* Owner Account Security */}
        <div className="register-panel">
          <div className="panel-header">
            <h3>Owner Account Security</h3>
          </div>

          {pwdMessage && <div className="alert alert-success">{pwdMessage}</div>}
          {pwdError && <div className="alert alert-error">{pwdError}</div>}

          <div className="form-group">
            <label>Owner Username</label>
            <input
              type="text"
              className="form-control"
              value={user?.username || 'owner'}
              disabled
              style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Single owner account mode active.
            </span>
          </div>

          <form onSubmit={handleUpdatePassword}>
            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                className="form-control"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
              />
            </div>

            <button type="submit" className="btn btn-secondary" disabled={savingPwd}>
              {savingPwd ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
