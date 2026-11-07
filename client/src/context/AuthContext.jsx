import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('muster_token') || null);
  const [user, setUser] = useState(null);
  const [site, setSite] = useState(null);
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

  // Verify token and fetch owner & site info
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setUser(null);
        setSite(null);
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
          setSite(data.site);
        } else {
          // Token invalid or expired
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

    // Fetch site info immediately
    try {
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        setSite(meData.site);
      }
    } catch (e) {
      console.error('Failed to pre-fetch site info:', e);
    }

    return data;
  };

  const logout = () => {
    localStorage.removeItem('muster_token');
    setToken(null);
    setUser(null);
    setSite(null);
  };

  const refreshSite = async () => {
    try {
      const res = await authFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSite(data);
      }
    } catch (err) {
      console.error('Error refreshing site:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        site,
        loading,
        login,
        logout,
        authFetch,
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
