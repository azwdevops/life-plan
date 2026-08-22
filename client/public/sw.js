// Minimal service worker. A fetch handler is required for Chrome/Edge to
// consider the app installable — this app doesn't do offline caching, it
// just passes every request straight through to the network.
self.addEventListener("fetch", () => {});
