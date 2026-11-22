import { useSyncExternalStore } from 'react';

// Appearance: "system" follows the device, "light" and "dark" are fixed, "weather" follows the
// current weather near the viewer (theme/weather.js). Saved per browser only (a display preference,
// not account data). public/theme-init.js applies it before first paint.
export const THEME_OPTIONS = ['system', 'light', 'dark', 'weather'];
const STORAGE_KEY = 'devtrack-theme';
// Weather mode only: the rounded location and the last answer, both kept in this browser.
export const WEATHER_KEY = 'devtrack-weather';
export const LOCATION_KEY = 'devtrack-weather-location';
// An older answer is not trusted any more; the theme falls back to the device setting.
const WEATHER_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const listeners = new Set();
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

function readStored(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): the choice still applies to this visit.
  }
}

function readPreference() {
  const saved = readStored(STORAGE_KEY);
  return THEME_OPTIONS.includes(saved) ? saved : 'system';
}

function readWeather() {
  try {
    const saved = JSON.parse(readStored(WEATHER_KEY));
    return saved && (saved.theme === 'light' || saved.theme === 'dark') && Number.isFinite(saved.at) ? saved : null;
  } catch {
    return null;
  }
}

let preference = readPreference();
// { result: last answer or null, status: 'idle' | 'loading' | 'ok' | 'unavailable' }. Replaced, never mutated.
let weatherState = { result: readWeather(), status: 'idle' };

const deviceTheme = () => (media?.matches ? 'light' : 'dark');
const freshWeather = () => {
  const { result } = weatherState;
  return result && Date.now() - result.at < WEATHER_MAX_AGE_MS ? result : null;
};

// Dark is the default when the device gives no answer.
const resolve = value => {
  if (value === 'system') return deviceTheme();
  if (value === 'weather') return freshWeather()?.theme || deviceTheme();
  return value;
};

// A theme change crossfades the page (View Transitions; styles at the end of index.css).
// Browsers without them, and the first paint, switch instantly.
function apply({ animate = true } = {}) {
  const root = document.documentElement;
  const next = resolve(preference);
  const update = () => {
    root.setAttribute('data-theme', next);
    listeners.forEach(listener => listener());
  };

  if (!animate || root.getAttribute('data-theme') === next || typeof document.startViewTransition !== 'function') {
    update();
    return;
  }

  root.classList.add('dt-theme-switching');
  const transition = document.startViewTransition(update);
  transition.finished
    .catch(() => {})
    .finally(() => root.classList.remove('dt-theme-switching'));
}

export function setThemePreference(next) {
  if (!THEME_OPTIONS.includes(next)) return;
  // Leaving weather mode forgets the location and the last answer.
  if (next !== 'weather') {
    writeStored(LOCATION_KEY, null);
    writeStored(WEATHER_KEY, null);
    weatherState = { result: null, status: 'idle' };
  }
  preference = next;
  writeStored(STORAGE_KEY, next);
  apply();
}

export const getThemePreference = () => preference;
export const weatherIsFresh = maxAgeMs => {
  const result = freshWeather();
  return Boolean(result && Date.now() - result.at < maxAgeMs);
};

export function setWeatherState({ result, status }) {
  const nextResult = result === undefined ? weatherState.result : result;
  weatherState = { result: nextResult, status };
  if (result) writeStored(WEATHER_KEY, JSON.stringify(result));
  apply();
}

if (typeof window !== 'undefined') {
  media?.addEventListener?.('change', () => apply());
  // Another tab changed the theme or fetched new weather.
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) preference = readPreference();
    else if (event.key === WEATHER_KEY) weatherState = { ...weatherState, result: readWeather() };
    else return;
    apply();
  });
  apply({ animate: false });
}

const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => preference);
  const resolved = useSyncExternalStore(subscribe, () => resolve(preference));
  const weather = useSyncExternalStore(subscribe, () => weatherState);
  const weatherFresh = useSyncExternalStore(subscribe, () => Boolean(freshWeather()));
  return { preference: current, resolved, weather, weatherFresh, setPreference: setThemePreference };
}
