import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  getCurrentUser,
  logout as logoutRequest,
} from '../services/authService';
import { SESSION_ENDED_EVENT } from '../services/api';
import { AuthContext } from './authContextObject';
import { disablePush } from '../services/pushService';

// While the page is visible, re-check the session this often, and whenever the tab regains focus,
// so a session ended from another device signs this page out without waiting for a click.
const SESSION_CHECK_MS = 30_000;
const MIN_CHECK_GAP_MS = 5_000;
const AUTH_CHANNEL = 'devtrack-auth';

function openAuthChannel() {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL);
}

// /auth/me returns a fresh object every time; keep the old one when nothing changed so the
// periodic check does not re-render every consumer.
const sameUser = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  // True when the session ended without this tab signing out (revoked elsewhere, expired,
  // or signed out in another tab); the login page explains why.
  const [sessionEnded, setSessionEnded] = useState(false);

  const userRef = useRef(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const applyUser = useCallback(currentUser => {
    setUser(previous => (previous && currentUser && sameUser(previous, currentUser) ? previous : currentUser));
    if (currentUser) setSessionEnded(false);
  }, []);

  const endSession = useCallback(() => {
    if (!userRef.current) return;
    setUser(null);
    setAuthError(null);
    setSessionEnded(true);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();

      applyUser(currentUser);
      setAuthError(null);

      return currentUser;
    } catch (error) {
      // Do not clear the current user on temporary failures.
      setAuthError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  useEffect(() => {
    let active = true;

    async function initializeAuth() {
      try {
        const currentUser = await getCurrentUser();

        if (active) {
          applyUser(currentUser);
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
  }, [applyUser]);

  // Any request whose token refresh was refused ends the session in the app.
  useEffect(() => {
    window.addEventListener(SESSION_ENDED_EVENT, endSession);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, endSession);
  }, [endSession]);

  // Signing out in one tab signs out the others.
  useEffect(() => {
    const channel = openAuthChannel();
    if (!channel) return undefined;
    channel.onmessage = event => {
      if (event.data === 'signed-out') endSession();
    };
    return () => channel.close();
  }, [endSession]);

  const signedIn = Boolean(user);

  // Re-check the session on focus and on an interval while visible; hidden tabs make no requests.
  useEffect(() => {
    if (!signedIn) return undefined;

    let inFlight = false;
    let lastCheck = Date.now();

    async function checkSession() {
      if (inFlight || document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheck < MIN_CHECK_GAP_MS) return;
      inFlight = true;
      lastCheck = Date.now();
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) applyUser(currentUser);
        else endSession();
      } catch {
        // Offline or the server is waking up: not proof the session ended; try again later.
      } finally {
        inFlight = false;
      }
    }

    const timer = window.setInterval(checkSession, SESSION_CHECK_MS);
    window.addEventListener('focus', checkSession);
    document.addEventListener('visibilitychange', checkSession);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkSession);
      document.removeEventListener('visibilitychange', checkSession);
    };
  }, [signedIn, applyUser, endSession]);

  const logout = useCallback(async () => {
    try {
      // A shared computer should not keep getting this account's notifications. Best effort, and
      // never allowed to hold up signing out.
      await Promise.race([disablePush().catch(() => {}), new Promise(resolve => setTimeout(resolve, 3000))]);
      await logoutRequest();
    } finally {
      setUser(null);
      setAuthError(null);
      setSessionEnded(false);
      const channel = openAuthChannel();
      channel?.postMessage('signed-out');
      channel?.close();
    }
  }, []);

  // For flows where the server already ended the session (password change, account deletion).
  const clearSession = useCallback(() => {
    setUser(null);
    setAuthError(null);
    setSessionEnded(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      sessionEnded,
      isAuthenticated: Boolean(user),
      refreshUser,
      logout,
      clearSession,
    }),
    [user, loading, authError, sessionEnded, refreshUser, logout, clearSession]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
