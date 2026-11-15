import request from 'supertest';
import app from '../src/app.js';

export const PASSWORD = 'CorrectHorseBattery9!';

const cookiePairs = response => (response.headers['set-cookie'] || []).map(value => value.split(';')[0]);

export function uniqueUser(prefix = 'tester') {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return { username: `${prefix}_${id}`, email: `${prefix}_${id}@example.com`, password: PASSWORD };
}

// Registers a user and returns a cookie jar plus helpers that send CSRF-protected requests.
export async function createSession(prefix) {
  const user = uniqueUser(prefix);
  const csrfResponse = await request(app).get('/api/auth/csrf');
  const csrfCookie = cookiePairs(csrfResponse).find(pair => pair.startsWith('devtrack_csrf='));
  const csrfToken = decodeURIComponent(csrfCookie.slice('devtrack_csrf='.length));

  const register = await request(app).post('/api/auth/register')
    .set('Cookie', csrfCookie).set('x-csrf-token', csrfToken).set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0')
    .send(user);
  if (register.status !== 201) throw new Error(`Registration failed with ${register.status}`);

  const jar = new Map([[ 'devtrack_csrf', csrfCookie ]]);
  for (const pair of cookiePairs(register)) jar.set(pair.split('=')[0], pair);

  const cookie = () => [...jar.values()].join('; ');
  const send = (method, url) => request(app)[method](url).set('Cookie', cookie()).set('x-csrf-token', csrfToken);

  return {
    user,
    userId: register.body.user.id,
    csrfToken,
    cookie,
    absorb(response) {
      for (const pair of cookiePairs(response)) jar.set(pair.split('=')[0], pair);
    },
    get: url => request(app).get(url).set('Cookie', cookie()),
    post: url => send('post', url),
    patch: url => send('patch', url),
    del: url => send('delete', url),
  };
}

export async function login(user) {
  const csrfResponse = await request(app).get('/api/auth/csrf');
  const csrfCookie = cookiePairs(csrfResponse).find(pair => pair.startsWith('devtrack_csrf='));
  const csrfToken = decodeURIComponent(csrfCookie.slice('devtrack_csrf='.length));
  const response = await request(app).post('/api/auth/login')
    .set('Cookie', csrfCookie).set('x-csrf-token', csrfToken)
    .send({ email: user.email, password: user.password });
  return { response, cookie: [csrfCookie, ...cookiePairs(response)].join('; ') };
}
