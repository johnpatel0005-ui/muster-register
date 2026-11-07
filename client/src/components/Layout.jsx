import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Layout = () => {
  const { user, site, logout } = useAuth();

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-top">
          <div>
            <div className="site-title">
              <span>📋 {site?.name || 'Construction Muster Register'}</span>
            </div>
            <div className="site-tagline">
              📍 {site?.location || 'Main Site'} | Owner: {site?.ownerName || user?.name || 'Owner'}
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

      {/* Footer */}
      <footer className="app-footer no-print">
        Digital Muster Register • Construction Business Daily Wage & Attendance Management
      </footer>
    </div>
  );
};
