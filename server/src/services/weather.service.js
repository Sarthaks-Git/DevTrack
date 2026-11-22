import config from '../config/config.js';
import AppError from '../utils/AppError.js';

// Weather theme: the current conditions near the viewer pick light or dark. Data comes from
// MET Norway (free, commercial use allowed, credit required). The server makes the call so the
// viewer's IP never reaches MET; coordinates arrive already rounded and are never stored or logged.
export const MET_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
export const WEATHER_SOURCE = 'MET Norway';
const CACHE_MS = 30 * 60 * 1000;
const FAILURE_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 1000;
const HOUR_MS = 60 * 60 * 1000;

const cache = new Map();
const inFlight = new Map();

// About 11 km: enough for weather, too coarse to place a person.
export const roundCoordinate = value => Math.round(value * 10) / 10 || 0;

// MET symbol codes, e.g. clearsky_day, partlycloudy_night, cloudy, lightrainshowersandthunder_day.
const CONDITIONS = [
  ['thunder', /thunder/],
  ['sleet', /sleet/],
  ['snow', /snow/],
  ['rain', /rain|drizzle/],
  ['fog', /^fog$/],
  ['cloudy', /^cloudy$/],
  ['partly cloudy', /^partlycloudy$/],
  ['clear', /^(clearsky|fair)$/]
];
const BRIGHT = new Set(['clear', 'partly cloudy']);

// Light only for a clear or partly cloudy day; night and grey, wet or stormy weather are dark.
export function themeForSymbol(symbol) {
  const match = typeof symbol === 'string' && symbol.match(/^([a-z]+?)(?:_(day|night|polartwilight))?$/);
  if (!match) return null;
  const [, base, time] = match;
  const found = CONDITIONS.find(([, pattern]) => pattern.test(base));
  if (!found) return null;
  const [condition] = found;
  const isDay = time ? time === 'day' : null;
  return { condition, isDay, theme: BRIGHT.has(condition) && isDay ? 'light' : 'dark' };
}

const unavailable = () => new AppError('Weather is unavailable right now', 503, 'WEATHER_UNAVAILABLE');

// The forecast hour covering now (the first one may already be in the past).
function currentSymbol(body, now) {
  const series = body?.properties?.timeseries;
  if (!Array.isArray(series)) return null;
  const entry = series.find(item => Date.parse(item?.time) + HOUR_MS > now) || series[0];
  const data = entry?.data;
  return data?.next_1_hours?.summary?.symbol_code || data?.next_6_hours?.summary?.symbol_code || null;
}

async function loadWeather({ lat, lon }, now) {
  let response;
  try {
    response = await fetch(`${MET_URL}?lat=${lat}&lon=${lon}`, {
      // MET asks every client to identify itself with a name and a contact (the public site).
      headers: { 'User-Agent': `DevTrack/1.0 ${config.CLIENT_ORIGIN}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    throw unavailable();
  }
  if (!response.ok) throw unavailable();
  let body;
  try {
    body = await response.json();
  } catch {
    throw unavailable();
  }
  const result = themeForSymbol(currentSymbol(body, now));
  if (!result) throw unavailable();
  return { ...result, updatedAt: new Date(now).toISOString(), source: WEATHER_SOURCE };
}

function remember(key, entry) {
  if (!cache.has(key) && cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, entry);
}

// One MET call per area every 30 minutes, shared by everyone nearby; failures wait 5 minutes.
export async function getWeatherLogic(location, now = Date.now()) {
  const key = `${location.lat},${location.lon}`;
  const hit = cache.get(key);
  if (hit && hit.expires > now) {
    if (hit.failed) throw unavailable();
    return hit.value;
  }
  if (!inFlight.has(key)) {
    const pending = loadWeather(location, now)
      .then(value => {
        remember(key, { value, expires: now + CACHE_MS });
        return value;
      })
      .catch(error => {
        remember(key, { failed: true, expires: now + FAILURE_MS });
        throw error;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return inFlight.get(key);
}

export function clearWeatherCache() {
  cache.clear();
  inFlight.clear();
}
