/* Home Suite alerts. The helper script sends an empty "wake up" push when a to-do is
   added; this asks the helper what is new and shows it as a Home Suite notification.
   It does nothing else (no caching of pages). */
"use strict";

var CONFIG_URL = "home-suite-config";   // saved by the Home and To-dos pages: { helper, key, since }
var TODOS = "./todos/";
var ICON = "./icons/icon-192.png";
var BADGE = "./icons/badge-96.png";

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });

function readConfig() {
  return caches.open("home-suite").then(function (c) { return c.match(CONFIG_URL); })
    .then(function (res) { return res ? res.json() : {}; })
    .catch(function () { return {}; });
}
function saveConfig(cfg) {
  return caches.open("home-suite").then(function (c) {
    return c.put(CONFIG_URL, new Response(JSON.stringify(cfg), { headers: { "Content-Type": "application/json" } }));
  });
}

function show(title, body, tag) {
  return self.registration.showNotification(title, {
    body: body, tag: tag, icon: ICON, badge: BADGE, renotify: true,
    data: { url: new URL(TODOS, self.registration.scope).href }
  });
}

self.addEventListener("push", function (event) {
  event.waitUntil(readConfig().then(function (cfg) {
    if (!cfg.helper || !cfg.key) return show("Home To-dos", "Something new was added.", "todos");
    return fetch(cfg.helper, { method: "POST", body: JSON.stringify({ key: cfg.key, action: "pushNews", since: cfg.since || 0 }) })
      .then(function (res) { return res.json(); })
      .then(function (out) {
        if (!out || !out.ok) return show("Home To-dos", "Something new was added.", "todos");
        cfg.since = out.now || Date.now();
        var shown = (out.items || []).map(function (it) { return show("New in " + it.list, it.task, it.id); });
        if (!shown.length) shown.push(out.test ? show("Home Suite", "Alerts are on for this device.", "test")
                                               : show("Home To-dos", "Your lists were updated.", "todos"));
        return Promise.all(shown.concat([saveConfig(cfg)]));
      })
      .catch(function () { return show("Home To-dos", "Something new was added.", "todos"); });
  }));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf("/todos/") >= 0 && "focus" in list[i]) return list[i].focus();
    }
    return self.clients.openWindow(url);
  }));
});
