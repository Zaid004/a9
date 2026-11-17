// محادثة جوه الألعاب.
// لعبة بين اثنين: نفس المحادثة الخاصة ويا الخصم (الرسائل تطلع بصفحة الرسائل هم).
// لعبة 3 أو 4 لاعبين: محادثة للغرفة، تنمسح من تخلص اللعبة.
(function () {
  "use strict";

  function A() { return window.A9; }
  function esc(s) { return A().esc(s); }

  var cur = null; // { el, cfg, hash, last, timer, open, unread }

  function unmount() {
    if (!cur) return;
    clearInterval(cur.timer);
    cur.el.innerHTML = ""; cur.el.hidden = true;
    cur = null;
  }

  function mount(el, cfg) {
    if (!el) return;
    if (cur && cur.el === el && cur.cfg.kind === cfg.kind && cur.cfg.other === cfg.other && cur.cfg.room === cfg.room) return;
    unmount();
    cur = { el: el, cfg: cfg, hash: location.hash, last: 0, timer: null, open: false, unread: 0, items: [], closed: false };
    el.hidden = false;
    el.innerHTML = '<div class="gchat">' +
      '<button type="button" class="gchat-head" data-gchat="toggle"><span>محادثة' + (cfg.name ? " ويا " + esc(cfg.name) : " اللعبة") + '</span><b class="gchat-badge" hidden></b><i class="gchat-chev"></i></button>' +
      '<div class="gchat-body" hidden><div class="gchat-list"></div>' +
      '<form class="gchat-form"><input type="text" maxlength="300" placeholder="اكتب رسالة" autocomplete="off" /><button type="submit" class="cbtn join">ارسل</button></form>' +
      (cfg.kind === "room" ? '<p class="note gchat-note">هاي المحادثة تنمسح من تخلص اللعبة.</p>' : '<p class="note gchat-note">نفس محادثتك الخاصة ويا ' + esc(cfg.name || "") + ".</p>") +
      "</div></div>";
    el.querySelector("[data-gchat=toggle]").addEventListener("click", function () {
      if (!cur) return;
      cur.open = !cur.open; cur.unread = 0;
      el.querySelector(".gchat-body").hidden = !cur.open;
      el.querySelector(".gchat").classList.toggle("open", cur.open);
      paint();
      if (cur.open) { var l = el.querySelector(".gchat-list"); l.scrollTop = l.scrollHeight; }
    });
    el.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var inp = el.querySelector("input"), body = inp.value.trim();
      if (!body || !cur) return;
      inp.value = "";
      var c = cur.cfg, tk = A().getToken();
      (c.kind === "dm" ? A().rpc("a9_send", { p_token: tk, p_to: c.other, p_body: body }) : A().rpc("a9_card_chat_send", { p_token: tk, p_room: c.room, p_body: body }))
        .then(function () { return poll(); }).catch(function () { inp.value = body; });
    });
    poll(true);
    cur.timer = setInterval(function () {
      if (!cur) return;
      if (location.hash !== cur.hash) return unmount();
      if (!document.hidden) poll();
    }, 3000);
  }

  function poll(first) {
    if (!cur) return Promise.resolve();
    var c = cur.cfg, me = cur, tk = A().getToken();
    var p = c.kind === "dm"
      ? A().rpc("a9_messages", { p_token: tk, p_other: c.other, p_after: me.last }).then(function (rows) {
          return (rows || []).map(function (m) { return { i: m.id, body: m.body, mine: m.mine, name: m.mine ? "" : c.name }; });
        })
      : A().rpc("a9_card_chat", { p_token: tk, p_room: c.room, p_after: me.last }).then(function (d) {
          me.closed = !!(d && d.closed);
          return ((d && d.items) || []).map(function (m) { return { i: m.i, body: m.body, mine: m.mine, name: m.mine ? "" : (m.name || "").split(" ")[0] }; });
        });
    return p.then(function (items) {
      if (cur !== me || !items.length) { if (cur === me && me.closed) paint(); return; }
      me.items = me.items.concat(items).slice(-40);
      me.last = items[items.length - 1].i;
      if (!first && !me.open) me.unread += items.filter(function (x) { return !x.mine; }).length;
      paint();
    }).catch(function () {});
  }

  function paint() {
    if (!cur) return;
    var el = cur.el, list = el.querySelector(".gchat-list"), badge = el.querySelector(".gchat-badge");
    badge.hidden = !cur.unread; badge.textContent = cur.unread;
    var atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    list.innerHTML = cur.items.length ? cur.items.map(function (m) {
      return '<div class="gmsg' + (m.mine ? " mine" : "") + '">' + (m.name && cur.cfg.kind === "room" ? "<b>" + esc(m.name) + "</b>" : "") + "<span>" + esc(m.body) + "</span></div>";
    }).join("") : '<p class="note center-text">ماكو رسائل بعد.</p>';
    if (atEnd || cur.open) list.scrollTop = list.scrollHeight;
    var form = el.querySelector("form"); if (form) form.hidden = cur.closed;
  }

  window.A9C = { mount: mount, unmount: unmount };
})();
