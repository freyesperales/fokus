// Minimal service worker — network-first, falls back to nothing.
// fokus's PWA is online-only for now; this exists so the manifest counts as installable.
const VERSION = "v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass through. No caching yet to avoid stale config bugs.
});
