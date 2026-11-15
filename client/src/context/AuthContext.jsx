
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getCurrentUser,
  logout as logoutRequest,
} from '../services/authService';
import { AuthContext } from './authContextObject';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();

      setUser(currentUser);
      setAuthError(null);

      return currentUser;
    } catch (error) {
      // Do not clear the current user on temporary failures.
      setAuthError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      try {
        const currentUser = await getCurrentUser();

        if (active) {
          setUser(currentUser);
          setAuthError(null);
        }
      } catch (error) {
        if (active) {
          // A network/server error is not proof of logout.
          setAuthError(error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setAuthError(null);
    }
  }, []);

  // For flows where the server already ended the session (password change, account deletion).
  const clearSession = useCallback(() => {
    setUser(null);
    setAuthError(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      isAuthenticated: Boolean(user),
      refreshUser,
      logout,
      clearSession,
    }),
    [user, loading, authError, refreshUser, logout, clearSession]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
