// DevTrack service worker. It only shows Web Push notifications and opens the app when one is
// tapped. It caches nothing, so the app always loads fresh from the network.

const FALLBACK_PATH = "/app/notifications";

// Only paths inside this site, so a notification can never open another site.
const safePath = (value) => (typeof value === "string" && /^\/(?!\/)[A-Za-z0-9/_#-]*$/.test(value) ? value : FALLBACK_PATH);
const text = (value, max, fallback) => (typeof value === "string" && value ? value.slice(0, max) : fallback);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(text(data.title, 80, "DevTrack"), {
      body: text(data.body, 200, ""),
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: text(data.tag, 40, "devtrack"),
      data: { path: safePath(data.url) },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data?.path), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        try {
          await open.navigate(target);
          return;
        } catch {
          // Not controlled by this worker yet: open a fresh window instead.
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
