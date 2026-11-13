// يخلي المنصة تنفتح مثل التطبيق، ويحفظ ملفاتها حتى تفتح أسرع.
// يجيب النسخة الجديدة من الإنترنت أول، وإذا ماكو إنترنت يفتح المحفوظة.
var CACHE = "a9-__V__";
var SHELL = ["./", "index.html",
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
    fetch(req, { cache: "no-cache" }).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () { return caches.match(req).then(function (r) { return r || caches.match("index.html"); }); })
  );
});

// ---------- الإشعارات ----------
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "منصة A9", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "منصة A9", {
    body: d.body || "رسالة جديدة",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    dir: "rtl",
    lang: "ar",
    data: { url: d.url || "" }
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var target = new URL("./", self.registration.scope).href + (e.notification.data && e.notification.data.url || "");
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(self.registration.scope) === 0 && "focus" in list[i]) {
        list[i].navigate ? list[i].navigate(target) : null;
        return list[i].focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});
