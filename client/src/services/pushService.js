import api from './api';

// Phone and browser notifications (Web Push). The service worker (public/sw.js) shows them.

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// iPhone and iPad only allow web notifications for an app added to the Home Screen.
export const needsHomeScreen = () =>
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia?.('(display-mode: standalone)').matches;

export const permission = () => (pushSupported() ? Notification.permission : 'unsupported');

function keyBytes(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
}

function sameKey(buffer, base64url) {
  if (!buffer) return false;
  const a = new Uint8Array(buffer);
  const b = keyBytes(base64url);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export async function getPushStatus() {
  const { data } = await api.get('/push');
  return data.data;
}

/** This browser's current subscription, if any. */
export async function currentSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function enablePush(publicKey) {
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    throw new Error(result === 'denied'
      ? 'Notifications are blocked for this site. Allow them in your browser\'s site settings, then try again.'
      : 'Notifications were not allowed.');
  }
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  // A subscription made for another server key cannot receive our notifications.
  if (subscription && !sameKey(subscription.options?.applicationServerKey, publicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  }
  const { data } = await api.post('/push/subscriptions', subscription.toJSON());
  return data.data;
}

/** Turns notifications off for this browser (locally and on the server). */
export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe().catch(() => {});
  const { data } = await api.delete('/push/subscriptions', { data: { endpoint } });
  return data.data;
}

export async function removePushDevice(id) {
  const { data } = await api.delete(`/push/subscriptions/${id}`);
  return data.data;
}

export async function sendTestPush() {
  const { data } = await api.post('/push/test');
  return data.data;
}
