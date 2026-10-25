import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('smartjobs_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.user);
      } catch (err) {
        console.error('Failed to fetch user:', err);
        setToken(null);
        localStorage.removeItem('smartjobs_token');
        localStorage.removeItem('smartjobs_user');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('smartjobs_token', newToken);
    localStorage.setItem('smartjobs_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password, confirmPassword, preferences = {}, termsAccepted = true) => {
    const res = await api.post('/auth/register', {
      name,
      email,
      password,
      confirmPassword,
      preferences,
      termsAccepted,
    });
    if (res.data.requiresVerification) {
      return res.data;
    }
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('smartjobs_token', newToken);
    localStorage.setItem('smartjobs_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const verifyEmail = async (email, code) => {
    const res = await api.post('/auth/verify-email', { email, code });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('smartjobs_token', newToken);
    localStorage.setItem('smartjobs_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const resendCode = async (email) => {
    const res = await api.post('/auth/resend-code', { email });
    return res.data;
  };

  const forgotPassword = async (email) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  };

  const resetPassword = async (codeOrToken, email, password, confirmPassword) => {
    const payload = {
      email,
      password,
      confirmPassword,
    };
    if (codeOrToken && codeOrToken.length === 6 && /^\d+$/.test(codeOrToken)) {
      payload.code = codeOrToken;
    } else if (codeOrToken) {
      payload.token = codeOrToken;
    }
    const res = await api.post('/auth/reset-password', payload);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Best-effort logout notification to server
    }
    localStorage.removeItem('smartjobs_token');
    localStorage.removeItem('smartjobs_user');
    setToken(null);
    setUser(null);
  };

  const updatePreferences = async (preferences) => {
    const res = await api.put('/users/preferences', preferences);
    setUser(res.data.user);
    return res.data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        register,
        verifyEmail,
        resendCode,
        forgotPassword,
        resetPassword,
        logout,
        updatePreferences,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
