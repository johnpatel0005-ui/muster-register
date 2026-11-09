import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('muster_token') || null);
  const [user, setUser] = useState(null);
  const [sites, setSites] = useState([]);
  const [currentSite, setCurrentSite] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper for authenticated requests
  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    return fetch(url, { ...options, headers });
  };

  // Helper to load all sites and pick the active one
  const loadSites = async (currentToken = token, preferredSiteId = null) => {
    if (!currentToken) return;
    try {
      const res = await fetch('/api/sites', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const sitesList = await res.json();
        setSites(sitesList);

        const savedId = preferredSiteId || localStorage.getItem('muster_active_site_id');
        let matched = sitesList.find((s) => s._id === savedId);
        if (!matched && sitesList.length > 0) {
          matched = sitesList.find((s) => s.isDefault) || sitesList[0];
        }

        if (matched) {
          setCurrentSite(matched);
          localStorage.setItem('muster_active_site_id', matched._id);
        }
      }
    } catch (err) {
      console.error('Error loading sites list:', err);
    }
  };

  // Verify token and fetch owner & sites
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setUser(null);
        setSites([]);
        setCurrentSite(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          await loadSites(token);
        } else {
          logout();
        }
      } catch (err) {
        console.error('Error fetching auth user:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    localStorage.setItem('muster_token', data.token);
    setToken(data.token);
    setUser(data.user);

    await loadSites(data.token);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('muster_token');
    localStorage.removeItem('muster_active_site_id');
    setToken(null);
    setUser(null);
    setSites([]);
    setCurrentSite(null);
  };

  // Switch the active site across the whole app
  const selectSite = (siteId) => {
    const found = sites.find((s) => s._id === siteId);
    if (found) {
      setCurrentSite(found);
      localStorage.setItem('muster_active_site_id', found._id);
    }
  };

  // Refresh sites list from backend
  const refreshSites = async () => {
    await loadSites(token, currentSite?._id);
  };

  // For backward compatibility: refreshSite updates the current site
  const refreshSite = async () => {
    await refreshSites();
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        sites,
        currentSite,
        site: currentSite, // backward-compatibility alias
        loading,
        login,
        logout,
        authFetch,
        selectSite,
        refreshSites,
        refreshSite,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
