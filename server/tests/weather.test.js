import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { MET_URL, clearWeatherCache, getWeatherLogic, themeForSymbol } from '../src/services/weather.service.js';
import { createSession } from './helpers.js';

const realFetch = globalThis.fetch;
const HOUR = 60 * 60 * 1000;

const metBody = (symbol, { time = new Date().toISOString(), field = 'next_1_hours' } = {}) => ({
  properties: { timeseries: [{ time, data: { instant: { details: {} }, [field]: { summary: { symbol_code: symbol } } } }] }
});

// Answers MET Norway calls only; anything else (e.g. sign-up checks) goes to the real fetch.
function stubMet(handler) {
  const met = vi.fn(handler);
  vi.stubGlobal('fetch', vi.fn((url, options) => (String(url).startsWith(MET_URL) ? met(String(url), options) : realFetch(url, options))));
  return met;
}
const json = body => ({ ok: true, status: 200, json: async () => body });

describe('weather theme rule', () => {
  it('is light only on a clear or partly cloudy day', () => {
    expect(themeForSymbol('clearsky_day')).toEqual({ condition: 'clear', isDay: true, theme: 'light' });
    expect(themeForSymbol('fair_day').theme).toBe('light');
    expect(themeForSymbol('partlycloudy_day')).toEqual({ condition: 'partly cloudy', isDay: true, theme: 'light' });
    expect(themeForSymbol('clearsky_night')).toEqual({ condition: 'clear', isDay: false, theme: 'dark' });
    expect(themeForSymbol('fair_polartwilight').theme).toBe('dark');
    expect(themeForSymbol('cloudy')).toEqual({ condition: 'cloudy', isDay: null, theme: 'dark' });
    expect(themeForSymbol('fog').condition).toBe('fog');
    expect(themeForSymbol('lightrainshowers_day')).toEqual({ condition: 'rain', isDay: true, theme: 'dark' });
    expect(themeForSymbol('heavysleet').condition).toBe('sleet');
    expect(themeForSymbol('snowshowers_night').condition).toBe('snow');
    expect(themeForSymbol('lightrainshowersandthunder_day').condition).toBe('thunder');
  });

  it('rejects anything that is not a known MET symbol', () => {
    for (const value of [undefined, null, '', 'sunny', 'CLEARSKY_DAY', 'clearsky_dusk', 'clearsky_day<script>', 42]) {
      expect(themeForSymbol(value)).toBeNull();
    }
  });
});

describe('GET /api/weather', () => {
  let ann;
  let bob;

  beforeAll(async () => {
    ann = await createSession('wx_ann');
    bob = await createSession('wx_bob');
  });
  beforeEach(() => clearWeatherCache());
  afterEach(() => vi.unstubAllGlobals());

  it('needs a signed-in user', async () => {
    const met = stubMet(async () => json(metBody('clearsky_day')));
    const res = await request(app).get('/api/weather?lat=28.6&lon=77.2');
    expect(res.status).toBe(401);
    expect(met).not.toHaveBeenCalled();
  });

  it('refuses bad coordinates without calling MET', async () => {
    const met = stubMet(async () => json(metBody('clearsky_day')));
    for (const query of ['', '?lat=28.6', '?lat=91&lon=0', '?lat=0&lon=180.5', '?lat=abc&lon=1', '?lat=1e2&lon=1',
      '?lat=1&lat=2&lon=3', '?lat=1&lon=2&city=delhi', '?lat=1.123456789&lon=2']) {
      const res = await ann.get(`/api/weather${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
    expect(met).not.toHaveBeenCalled();
  });

  it('rounds the location to about 11 km, identifies itself to MET, and returns the theme', async () => {
    const met = stubMet(async () => json(metBody('partlycloudy_day')));
    const res = await ann.get('/api/weather?lat=28.61394&lon=77.20902');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ theme: 'light', condition: 'partly cloudy', isDay: true, source: 'MET Norway' });
    expect(JSON.stringify(res.body)).not.toContain('28.61');

    expect(met).toHaveBeenCalledTimes(1);
    const [url, options] = met.mock.calls[0];
    expect(url).toBe(`${MET_URL}?lat=28.6&lon=77.2`);
    expect(options.headers['User-Agent']).toMatch(/^DevTrack\/1\.0 /);
  });

  it('shares one MET call per area for 30 minutes, across users', async () => {
    const met = stubMet(async () => json(metBody('rain')));
    expect((await ann.get('/api/weather?lat=51.507&lon=-0.128')).body.data.theme).toBe('dark');
    expect((await bob.get('/api/weather?lat=51.52&lon=-0.13')).body.data.condition).toBe('rain');
    expect(met).toHaveBeenCalledTimes(1);

    await ann.get('/api/weather?lat=48.85&lon=2.35');
    expect(met).toHaveBeenCalledTimes(2);
  });

  it('answers 503 when MET fails, and waits before asking again', async () => {
    const met = stubMet(async () => { throw new TypeError('fetch failed'); });
    const first = await ann.get('/api/weather?lat=10&lon=10');
    expect(first.status).toBe(503);
    expect(first.body.code).toBe('WEATHER_UNAVAILABLE');
    expect((await ann.get('/api/weather?lat=10&lon=10')).status).toBe(503);
    expect(met).toHaveBeenCalledTimes(1);
  });

  it('treats MET errors, broken bodies and unknown symbols as unavailable', async () => {
    const replies = [
      { ok: false, status: 429, json: async () => ({}) },
      { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } },
      json({ properties: {} }),
      json(metBody('sunshine_day'))
    ];
    for (const [index, reply] of replies.entries()) {
      stubMet(async () => reply);
      const res = await ann.get(`/api/weather?lat=${20 + index}&lon=20`);
      expect(res.status, `reply ${index}`).toBe(503);
      vi.unstubAllGlobals();
    }
  });
});

describe('weather service', () => {
  beforeEach(() => clearWeatherCache());
  afterEach(() => vi.unstubAllGlobals());

  it('uses the forecast hour covering now, and the 6-hour summary when the 1-hour one is missing', async () => {
    const now = Date.now();
    stubMet(async () => json({
      properties: {
        timeseries: [
          { time: new Date(now - 2 * HOUR).toISOString(), data: { next_1_hours: { summary: { symbol_code: 'clearsky_day' } } } },
          { time: new Date(now - HOUR / 2).toISOString(), data: { next_6_hours: { summary: { symbol_code: 'heavysnow' } } } }
        ]
      }
    }));
    expect(await getWeatherLogic({ lat: 60.4, lon: 5.3 }, now)).toMatchObject({ condition: 'snow', theme: 'dark' });
  });

  it('makes one call when the same area is asked for twice at once', async () => {
    const met = stubMet(async () => json(metBody('cloudy')));
    const [a, b] = await Promise.all([getWeatherLogic({ lat: 1, lon: 1 }), getWeatherLogic({ lat: 1, lon: 1 })]);
    expect(a).toEqual(b);
    expect(met).toHaveBeenCalledTimes(1);
  });

  it('asks again once the 30 minutes are up', async () => {
    const met = stubMet(async () => json(metBody('clearsky_day')));
    const start = Date.now();
    await getWeatherLogic({ lat: 2, lon: 2 }, start);
    await getWeatherLogic({ lat: 2, lon: 2 }, start + 29 * 60 * 1000);
    expect(met).toHaveBeenCalledTimes(1);
    await getWeatherLogic({ lat: 2, lon: 2 }, start + 31 * 60 * 1000);
    expect(met).toHaveBeenCalledTimes(2);
  });
});
