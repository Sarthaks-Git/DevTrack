
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',

  withCredentials: true,

  headers: {
    'Content-Type': 'application/json',
  },

  timeout: 15000,
});

function readCookie(name) {
  if (typeof document === 'undefined') return null;

  const prefix = `${name}=`;

  const item = document.cookie
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(prefix));

  return item
    ? decodeURIComponent(item.slice(prefix.length))
    : null;
}

let csrfPromise = null;
let refreshPromise = null;

export async function ensureCsrfToken() {
  const existingToken = readCookie('devtrack_csrf');

  if (existingToken) {
    return existingToken;
  }

  if (!csrfPromise) {
    csrfPromise = api
      .get('/auth/csrf')
      .then(() => readCookie('devtrack_csrf'))
      .finally(() => {
        csrfPromise = null;
      });
  }

  return csrfPromise;
}

// Attach the CSRF token to state-changing requests.
api.interceptors.request.use(async config => {
  const method = config.method?.toLowerCase();

  if (method && !['get', 'head', 'options'].includes(method)) {
    let token = readCookie('devtrack_csrf');

    if (!token) {
      await ensureCsrfToken();
      token = readCookie('devtrack_csrf');
    }

    if (token) {
      config.headers.set('X-CSRF-Token', token);
    }
  }

  return config;
});

const isAuthEndpoint = url => {
  const authEndpoints = [
    '/auth/login',
    '/auth/register',
    '/auth/logout',
    '/auth/refresh',
    '/auth/csrf',
  ];

  return authEndpoints.some(endpoint => url.endsWith(endpoint));
};

// Coordinate refresh requests across tabs.
async function performRefresh() {
  const refreshOperation = async () => {
    await ensureCsrfToken();
    await api.post('/auth/refresh');
  };

  // Web Locks are supported by modern Chromium browsers.
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(
      'devtrack-auth-refresh',
      { mode: 'exclusive' },
      refreshOperation
    );
  }

  // Fallback: deduplicates within this tab only.
  // Cross-tab coordination requires Web Locks support.
  return refreshOperation();
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// Surface the API's human-readable message instead of Axios's generic status text.
function withServerMessage(error) {
  if (error?.code === 'ECONNABORTED') {
    error.message = 'The server took too long to respond. Please try again.';
  } else if (error?.response?.status === 429) {
    error.message = 'Too many requests. Please wait a moment and try again.';
  } else if (error?.response) {
    error.message = errorMessage(error, error.message);
  } else if (error?.request) {
    error.message = 'Cannot reach DevTrack. Check your connection and try again.';
  }

  return error;
}

// Retry requests after an expired access token is refreshed.
api.interceptors.response.use(
  response => response,

  async error => {
    const originalRequest = error.config;

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry ||
      isAuthEndpoint(originalRequest.url || '')
    ) {
      return Promise.reject(withServerMessage(error));
    }

    originalRequest._retry = true;

    try {
      await refreshSession();

      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(withServerMessage(refreshError));
    }
  }
);

export function errorMessage(
  error,
  fallback = 'Something went wrong. Please try again.'
) {
  return (
    error.response?.data?.message ||
    error.response?.data?.error?.message ||
    fallback
  );
}

export default api;
