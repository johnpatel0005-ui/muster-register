import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const SettingsPage = () => {
  const { authFetch, site, sites, selectSite, refreshSites, user } = useAuth();

  // Active Site settings state
  const [siteName, setSiteName] = useState('');
  const [location, setLocation] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [standardDailyHours, setStandardDailyHours] = useState(8);
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  // Add new site form state
  const [showAddSiteForm, setShowAddSiteForm] = useState(false);
  const [addSiteName, setAddSiteName] = useState('');
  const [addSiteLocation, setAddSiteLocation] = useState('');
  const [addSiteHours, setAddSiteHours] = useState(8);
  const [addSiteCurrency, setAddSiteCurrency] = useState('₹');
  const [addingSite, setAddingSite] = useState(false);
  const [addSiteMsg, setAddSiteMsg] = useState('');
  const [addSiteErr, setAddSiteErr] = useState('');

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

  // Save current active site details
  const handleSaveSite = async (e) => {
    e.preventDefault();
    setSiteMessage('');
    setSiteError('');
    setSavingSite(true);

    try {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          siteId: site?._id,
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
      await refreshSites();
    } catch (err) {
      setSiteError(err.message);
    } finally {
      setSavingSite(false);
    }
  };

  // Create a new site
  const handleAddSite = async (e) => {
    e.preventDefault();
    setAddSiteMsg('');
    setAddSiteErr('');

    if (!addSiteName.trim()) {
      setAddSiteErr('Site name is required');
      return;
    }

    setAddingSite(true);

    try {
      const res = await authFetch('/api/sites', {
        method: 'POST',
        body: JSON.stringify({
          name: addSiteName.trim(),
          location: addSiteLocation.trim(),
          standardDailyHours: Number(addSiteHours) || 8,
          currencySymbol: addSiteCurrency.trim() || '₹',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create site');
      }

      setAddSiteMsg(`Site "${data.name}" created successfully!`);
      setAddSiteName('');
      setAddSiteLocation('');
      setAddSiteHours(8);
      setAddSiteCurrency('₹');
      setShowAddSiteForm(false);

      await refreshSites();
      selectSite(data._id);
    } catch (err) {
      setAddSiteErr(err.message);
    } finally {
      setAddingSite(false);
    }
  };

  // Delete a site
  const handleDeleteSite = async (siteToDelete) => {
    if (!window.confirm(`Are you sure you want to delete "${siteToDelete.name}"?`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/sites/${siteToDelete._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to delete site');
        return;
      }
      await refreshSites();
    } catch (err) {
      alert(err.message);
    }
  };

  // Change password
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
          <h1 className="page-title">Sites & Application Settings</h1>
          <div className="page-subtitle">
            Manage multiple construction project sites, standard shifts, and account credentials
          </div>
        </div>
      </div>

      {/* 1. All Construction Sites Ledger */}
      <div className="register-panel" style={{ marginBottom: '20px' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>All Construction Sites ({sites.length})</h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Each site maintains its own separate workers, daily attendance, payments, and muster rolls
            </span>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddSiteForm(!showAddSiteForm)}
          >
            {showAddSiteForm ? '✕ Close Form' : '+ Add New Construction Site'}
          </button>
        </div>

        {addSiteMsg && <div className="alert alert-success">{addSiteMsg}</div>}
        {addSiteErr && <div className="alert alert-error">{addSiteErr}</div>}

        {/* Add New Site Collapsible Form */}
        {showAddSiteForm && (
          <div style={{ backgroundColor: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px', margin: '14px 0' }}>
            <h4 style={{ marginBottom: '12px' }}>+ New Construction Site Details</h4>
            <form onSubmit={handleAddSite}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div className="form-group">
                  <label>Site Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Ring Road Overbridge Site"
                    value={addSiteName}
                    onChange={(e) => setAddSiteName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Location / Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Padana GIDC, Jamnagar"
                    value={addSiteLocation}
                    onChange={(e) => setAddSiteLocation(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Standard Shift (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    className="form-control"
                    value={addSiteHours}
                    onChange={(e) => setAddSiteHours(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Currency</label>
                  <input
                    type="text"
                    className="form-control"
                    value={addSiteCurrency}
                    onChange={(e) => setAddSiteCurrency(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" disabled={addingSite}>
                  {addingSite ? 'Creating...' : '✓ Create & Open Site'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddSiteForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sites Table */}
        <div className="table-container">
          <table className="register-table">
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Location</th>
                <th>Active Workers</th>
                <th>Standard Shift</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const isActiveCurrent = s._id === site?._id;
                return (
                  <tr key={s._id} style={isActiveCurrent ? { backgroundColor: '#f0fdf4' } : {}}>
                    <td>
                      <strong>{s.name}</strong>
                      {isActiveCurrent && (
                        <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#15803d', color: '#fff', padding: '2px 6px', borderRadius: '3px' }}>
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td>{s.location || '—'}</td>
                    <td>
                      <span className="badge badge-present">{s.activeWorkers ?? 0} Workers</span>
                    </td>
                    <td>{s.standardDailyHours || 8}h / day</td>
                    <td>{s.currencySymbol || '₹'}</td>
                    <td>
                      <span className="badge badge-present">{s.status || 'active'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {!isActiveCurrent && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => selectSite(s._id)}
                            title="Switch to manage this site"
                          >
                            Switch Site
                          </button>
                        )}
                        {sites.length > 1 && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteSite(s)}
                            title="Delete empty site"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* 2. Current Selected Site Details */}
        <div className="register-panel">
          <div className="panel-header">
            <h3>Active Site Details: {site?.name}</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Updates the settings for currently active site
            </span>
          </div>

          {siteMessage && <div className="alert alert-success">{siteMessage}</div>}
          {siteError && <div className="alert alert-error">{siteError}</div>}

          <form onSubmit={handleSaveSite}>
            <div className="form-group">
              <label>Construction Project / Site Name *</label>
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

        {/* 3. Owner Account Security */}
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
