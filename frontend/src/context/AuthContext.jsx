import React, { createContext, useState, useEffect } from 'react';
import api from '../api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await api.get('/auth/status');
      if (res.data.setupRequired) {
        setNeedsSetup(true);
      } else {
        const token = localStorage.getItem('token');
        if (token) {
          const userRes = await api.get('/auth/me');
          setUser(userRes.data);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
  };

  const setup = async (username, password) => {
    const res = await api.post('/auth/setup', { username, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    setNeedsSetup(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, login, setup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
