import { useSyncExternalStore } from 'react';

// Appearance: "system" follows the device, "light" and "dark" are fixed. Saved per browser only
// (a display preference, not account data). public/theme-init.js applies it before first paint.
export const THEME_OPTIONS = ['system', 'light', 'dark'];
const STORAGE_KEY = 'devtrack-theme';
const listeners = new Set();
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

function readPreference() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return THEME_OPTIONS.includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

let preference = readPreference();

// Dark is the default when the device gives no answer.
const resolve = value => (value === 'system' ? (media?.matches ? 'light' : 'dark') : value);

function apply() {
  document.documentElement.setAttribute('data-theme', resolve(preference));
  listeners.forEach(listener => listener());
}

export function setThemePreference(next) {
  if (!THEME_OPTIONS.includes(next)) return;
  preference = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage blocked (private mode): the choice still applies to this visit.
  }
  apply();
}

if (typeof window !== 'undefined') {
  media?.addEventListener?.('change', () => preference === 'system' && apply());
  // Another tab changed the theme.
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    preference = readPreference();
    apply();
  });
  apply();
}

const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => preference);
  const resolved = useSyncExternalStore(subscribe, () => resolve(preference));
  return { preference: current, resolved, setPreference: setThemePreference };
}
