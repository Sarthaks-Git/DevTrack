import { useEffect } from 'react';
import { getWeather } from '../services/weatherService';
import { LOCATION_KEY, getThemePreference, setWeatherState, useTheme, weatherIsFresh } from './theme';

const REFRESH_MS = 30 * 60 * 1000;
// About 11 km: enough for weather, too coarse to place a person. The server rounds again.
const round = value => Math.round(value * 10) / 10 || 0;

function savedLocation() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LOCATION_KEY));
    return saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon) ? saved : null;
  } catch {
    return null;
  }
}

// Asks the browser once; the rounded result is kept in this browser only.
export function requestLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const location = { lat: round(position.coords.latitude), lon: round(position.coords.longitude) };
        try {
          window.localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
        } catch {
          // Storage blocked: weather works for this visit only.
        }
        resolve(location);
      },
      reject,
      { enableHighAccuracy: false, maximumAge: 60 * 60 * 1000, timeout: 15000 }
    );
  });
}

let pending = null;

export function refreshWeather({ force = false, location = savedLocation() } = {}) {
  if (getThemePreference() !== 'weather' && !force) return Promise.resolve();
  if (!location) {
    setWeatherState({ status: 'unavailable' });
    return Promise.resolve();
  }
  if (!force && weatherIsFresh(REFRESH_MS)) return Promise.resolve();
  if (pending) return pending;
  setWeatherState({ status: 'loading' });
  pending = getWeather(location)
    .then(data => setWeatherState({ result: { theme: data.theme, condition: data.condition, isDay: data.isDay, at: Date.now() }, status: 'ok' }))
    .catch(() => setWeatherState({ status: 'unavailable' }))
    .finally(() => {
      pending = null;
    });
  return pending;
}

// Mounted once in the signed-in layout: checks the weather every 30 minutes while the page is visible.
export function useWeatherRefresh() {
  const { preference } = useTheme();
  useEffect(() => {
    if (preference !== 'weather') return undefined;
    const check = () => document.visibilityState === 'visible' && refreshWeather();
    check();
    const timer = window.setInterval(check, REFRESH_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [preference]);
}
