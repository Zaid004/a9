// يخلي المنصة تنفتح مثل التطبيق، ويحفظ ملفاتها حتى تفتح أسرع.
// يجيب النسخة الجديدة من الإنترنت أول، وإذا ماكو إنترنت يفتح المحفوظة.
var CACHE = "a9-v1";
var SHELL = ["./", "index.html", "assets/style.css", "assets/app.js", "assets/gyn.js", "assets/config.js",
             "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return; // قاعدة البيانات ما تنحفظ
  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match("index.html"); }); })
  );
});
