import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Layout = () => {
  const { user, sites, currentSite, selectSite, refreshSites, logout, authFetch } = useAuth();

  // Quick Add Site Modal state
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');
  const [newSiteHours, setNewSiteHours] = useState(8);
  const [newSiteCurrency, setNewSiteCurrency] = useState('₹');
  const [submittingSite, setSubmittingSite] = useState(false);
  const [siteModalError, setSiteModalError] = useState('');

  const handleCreateSite = async (e) => {
    e.preventDefault();
    if (!newSiteName.trim()) {
      setSiteModalError('Site name is required');
      return;
    }

    setSubmittingSite(true);
    setSiteModalError('');

    try {
      const res = await authFetch('/api/sites', {
        method: 'POST',
        body: JSON.stringify({
          name: newSiteName.trim(),
          location: newSiteLocation.trim(),
          standardDailyHours: Number(newSiteHours) || 8,
          currencySymbol: newSiteCurrency.trim() || '₹',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create construction site');
      }

      const created = await res.json();
      await refreshSites();
      selectSite(created._id);

      // Reset form & close modal
      setNewSiteName('');
      setNewSiteLocation('');
      setNewSiteHours(8);
      setNewSiteCurrency('₹');
      setShowAddSiteModal(false);
    } catch (err) {
      setSiteModalError(err.message);
    } finally {
      setSubmittingSite(false);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-top">
          <div>
            <div className="site-title">
              <span>📋 Construction Muster Register</span>
            </div>

            {/* Site Switcher Bar */}
            <div className="site-switcher-box no-print">
              <span className="site-switcher-label">📍 Active Site:</span>
              <select
                value={currentSite?._id || ''}
                onChange={(e) => {
                  if (e.target.value === '__add_site__') {
                    setShowAddSiteModal(true);
                  } else {
                    selectSite(e.target.value);
                  }
                }}
                className="site-switcher-select"
                title="Select Construction Site"
              >
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} {s.location ? `(${s.location})` : ''}
                  </option>
                ))}
                <option value="__add_site__">+ Add New Site...</option>
              </select>

              <button
                onClick={() => setShowAddSiteModal(true)}
                className="btn btn-secondary btn-sm"
                title="Add a new construction project site"
                style={{ padding: '3px 8px', fontSize: '13px' }}
              >
                + Add Site
              </button>
            </div>

            <div className="site-tagline print-only">
              📍 Site: {currentSite?.name || 'Main Site'} ({currentSite?.location || 'Location'}) | Owner: {currentSite?.ownerName || user?.name || 'Owner'}
            </div>
          </div>

          <div className="user-meta no-print">
            <span className="user-badge">👤 {user?.name || 'Owner'}</span>
            <button onClick={logout} className="btn btn-secondary btn-sm" title="Log out">
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Primary Tab Navigation */}
      <nav className="app-nav no-print">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/workers"
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          Workers
        </NavLink>
        <NavLink
          to="/attendance"
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          Attendance
        </NavLink>
        <NavLink
          to="/payments"
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          Payments
        </NavLink>
        <NavLink
          to="/muster"
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          Muster Register
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          Settings
        </NavLink>
      </nav>

      {/* Main Content View */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Quick Add Site Modal */}
      {showAddSiteModal && (
        <div className="modal-backdrop" onClick={() => setShowAddSiteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>+ Add New Construction Site</h3>
              <button
                onClick={() => setShowAddSiteModal(false)}
                className="btn-icon"
                title="Close"
              >
                ✕
              </button>
            </div>

            {siteModalError && <div className="alert alert-danger">{siteModalError}</div>}

            <form onSubmit={handleCreateSite} style={{ padding: '16px' }}>
              <div className="form-group">
                <label>Site / Project Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Hospital Wing Project"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Location / Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Sector 12, Gandhinagar"
                  value={newSiteLocation}
                  onChange={(e) => setNewSiteLocation(e.target.value)}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Standard Shift (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    className="form-control"
                    value={newSiteHours}
                    onChange={(e) => setNewSiteHours(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Currency Symbol</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newSiteCurrency}
                    onChange={(e) => setNewSiteCurrency(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddSiteModal(false)}
                  className="btn btn-secondary"
                  disabled={submittingSite}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingSite}
                >
                  {submittingSite ? 'Creating...' : '✓ Create Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer no-print">
        Digital Muster Register • Construction Business Daily Wage & Attendance Management
      </footer>
    </div>
  );
};
