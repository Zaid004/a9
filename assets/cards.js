// لعبة الورق "خلّصها": ورق بألوان وأرقام، والفايز أول واحد يخلص ورقه.
// الورق: r/b/g/y + رقم (0-9)، و w4 (+4 وتبديل لون). السيرفر يوزع ويخفي الورق ويتأكد من كل حركة.
// صور البطاقات: بطاقة حمرة لكل رقم، والمتصفح يطلع منها الأزرق والأخضر والأصفر.
(function () {
  "use strict";

  function A() { return window.A9; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return A().esc(s); }

  var NAME = "خلّصها";
  var MODES = { 2: "1 ضد 1", 3: "3 لاعبين", 4: "4 لاعبين", 22: "2 ضد 2" };
  var COLORS = { r: "#dc2626", b: "#2563eb", g: "#16a34a", y: "#eab308" };
  var COLOR_NAMES = { r: "أحمر", b: "أزرق", g: "أخضر", y: "أصفر" };
  var HUE = { b: 222, g: 135, y: 50 };
  var ERR = { no_match: "هاي الورقة ما تنلعب هسه", not_your_turn: "مو دورك", already_drew: "سحبت ورقة بهذا الدور", draw_first: "اسحب ورقة أول", pick_color: "اختار لون", not_active: "اللعبة خلصت" };

  var cs = { room: null, st: null, poll: null, lobbyTimer: null, busy: false, art: {}, artV: {}, tinted: {}, note: "" };

  // ---------- صور البطاقات ----------
  function artKey(card) { return card === "w4" ? "w4" : card.slice(1); }
  function loadArt(versions) {
    var need = [];
    Object.keys(versions || {}).forEach(function (k) {
      var v = versions[k];
      if (cs.artV[k] === v && cs.art[k]) return;
      try { var c = JSON.parse(localStorage.getItem("a9:card:" + k) || "null"); if (c && c.v === v) { cs.art[k] = c.data; cs.artV[k] = v; return; } } catch (e) {}
      need.push(k);
    });
    if (!need.length) return Promise.resolve();
    return A().rpc("a9_card_art", { p_token: A().getToken(), p_keys: need }).then(function (rows) {
      (rows || []).forEach(function (r) {
        cs.art[r.k] = r.photo; cs.artV[r.k] = r.v;
        Object.keys(cs.tinted).forEach(function (t) { if (t.indexOf(r.k + ":") === 0) delete cs.tinted[t]; });
        try { localStorage.setItem("a9:card:" + r.k, JSON.stringify({ v: r.v, data: r.photo })); } catch (e) {}
      });
    }).catch(function () {});
  }
  // نبدل اللون الأحمر بس (مو لون الوجه): البكسلات الحمرة المشبعة تاخذ لون جديد
  function tint(src, col) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        var c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
        var x = c.getContext("2d"); x.drawImage(im, 0, 0);
        var d = x.getImageData(0, 0, c.width, c.height), p = d.data, nh = HUE[col] / 360;
        for (var i = 0; i < p.length; i += 4) {
          var r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
          if (dd < 0.18 || mx !== r) continue;
          var s = dd / (1 - Math.abs(2 * l - 1)), h = ((g - b) / dd) / 6; if (h < 0) h += 1;
          if (s < 0.45 || (h > 0.045 && h < 0.94)) continue;
          if (col === "y") l = Math.min(0.62, l + 0.12);
          var q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q;
          p[i] = hue2(pp, q, nh + 1 / 3) * 255; p[i + 1] = hue2(pp, q, nh) * 255; p[i + 2] = hue2(pp, q, nh - 1 / 3) * 255;
        }
        x.putImageData(d, 0, 0);
        res(c.toDataURL("image/webp", 0.85));
      };
      im.onerror = function () { res(src); };
      im.src = src;
    });
  }
  function hue2(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
  function artFor(card) {
    var k = artKey(card), src = cs.art[k];
    if (!src) return null;
    var col = card[0];
    if (card === "w4" || col === "r") return src;
    var key = k + ":" + col + ":" + cs.artV[k];
    if (cs.tinted[key]) return typeof cs.tinted[key] === "string" ? cs.tinted[key] : null;
    cs.tinted[key] = tint(src, col).then(function (u) { cs.tinted[key] = u; render(); });
    return null;
  }

  function cardHtml(card, opts) {
    opts = opts || {};
    var cls = "kc" + (opts.big ? " big" : "") + (opts.can ? " can" : "") + (opts.dim ? " dim" : "") + (card === "w4" ? " w" : "");
    var attrs = opts.play ? ' data-kplay="' + card + '"' : "";
    var img = artFor(card);
    if (img) return '<button type="button" class="' + cls + ' art"' + attrs + '><img alt="" src="' + img + '" /></button>';
    if (card === "w4") {
      return '<button type="button" class="' + cls + '"' + attrs + '><span class="kc-w"><i style="background:#dc2626"></i><i style="background:#2563eb"></i><i style="background:#eab308"></i><i style="background:#16a34a"></i></span><b class="kc-n">+4</b><span class="kc-c tl">+4</span><span class="kc-c br">+4</span></button>';
    }
    var n = card.slice(1);
    return '<button type="button" class="' + cls + '" style="--kc:' + COLORS[card[0]] + '"' + attrs + '><b class="kc-n">' + n + '</b><span class="kc-c tl">' + n + '</span><span class="kc-c br">' + n + "</span></button>";
  }

  // ---------- القواعد بالمتصفح (للتلوين بس؛ السيرفر هو اللي يقرر) ----------
  function playable(card, st) {
    if (card === "w4") return true;
    return card[0] === st.color || (st.top !== "w4" && card.slice(1) === st.top.slice(1));
  }

  // ---------- صفحة اللعبة (الغرف) ----------
  function lobby() {
    stop();
    refreshLobby(true);
    cs.lobbyTimer = setInterval(function () {
      if (location.hash !== "#cards") { clearInterval(cs.lobbyTimer); return; }
      if (!document.hidden) refreshLobby(false);
    }, 6000);
  }
  function names(players) { return (players || []).map(function (p) { return esc(p.name.split(" ")[0]); }).join("، "); }
  function refreshLobby(first) {
    return A().rpc("a9_card_lobby", { p_token: A().getToken() }).then(function (d) {
      if (location.hash !== "#cards") return;
      loadArt(d.art);
      $("kc-wins").textContent = d.wins;
      var mine = (d.mine || []).map(function (r) {
        var st = r.status === "done" ? (r.winner_seat === r.my_seat || (r.mode === 22 && (r.winner_seat % 2) === (r.my_seat % 2)) ? "فزت" : "خلصت") : r.my_turn ? "دورك" : "شغالة";
        return '<div class="xo-game' + (r.my_turn ? " hot" : "") + '"><div class="ainfo"><b>' + MODES[r.mode] + '</b><span class="note">' + names(r.players) + " · " + st + '</span></div><a class="cbtn join" href="#card/' + r.id + '">' + (r.status === "active" ? "العب" : "فتح") + "</a></div>";
      }).join("");
      $("kc-mine").innerHTML = mine || '<p class="note center-text" style="padding:14px">ماكو ألعاب شغالة.</p>';
      var open = (d.open || []).map(function (r) {
        var left = r.seats - r.players.length;
        return '<div class="xo-game' + (r.mine ? " hot" : "") + '"><div class="ainfo"><b>' + MODES[r.mode] + '</b><span class="note">' + names(r.players) + " · ينتظر " + left + (left === 1 ? " لاعب" : " لاعبين") + "</span></div>" +
          (r.mine ? '<a class="cbtn join" href="#card/' + r.id + '">فتح</a>' : '<button type="button" class="cbtn join" data-kjoin="' + r.id + '">ادخل</button>') + "</div>";
      }).join("");
      $("kc-open").innerHTML = open || '<p class="note center-text" style="padding:14px">ماكو غرف مفتوحة. سوّي وحدة من فوگ.</p>';
    }).catch(function () { if (first) $("kc-open").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب الغرف.</p>'; });
  }

  // ---------- الطاولة ----------
  function stopPoll() { clearInterval(cs.poll); cs.poll = null; }
  function table(id) {
    stop();
    cs.room = id; cs.st = null; cs.note = "";
    $("kc-table").innerHTML = '<p class="note center-text" style="padding:30px">لحظة...</p>';
    A().loadMembers().catch(function () {});
    var load = function () {
      return A().rpc("a9_card_state", { p_token: A().getToken(), p_room: id }).then(function (s) {
        if (location.hash !== "#card/" + id || cs.busy) return;
        if (!cs.st || cs.st.updated_at !== s.updated_at || cs.st.status !== s.status) { cs.st = s; render(); }
      });
    };
    A().rpc("a9_card_lobby", { p_token: A().getToken() }).then(function (d) { return loadArt(d.art); }).then(function () { if (cs.st) render(); }).catch(function () {});
    load().catch(function () { $("kc-table").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نفتح اللعبة.</p>'; });
    cs.poll = setInterval(function () {
      if (location.hash !== "#card/" + id) return stopPoll();
      var s = cs.st; if (document.hidden || !s) return;
      if (s.status === "done" || s.status === "cancelled") return;
      if (s.status === "active" && s.turn === s.my_seat) return;
      load().catch(function () {});
    }, 2000);
  }

  function seatName(s, seat) { var p = (s.players || [])[seat]; return p ? p.name.split(" ")[0] : ""; }
  function teamOf(s, seat) { return s.mode === 22 ? seat % 2 : seat; }

  function render() {
    var s = cs.st; if (!s || location.hash !== "#card/" + s.id) return;
    var me = s.my_seat, html = "";
    if (s.status === "open" || (s.status === "cancelled" && !s.top)) {
      var left = s.seats - (s.players || []).length;
      html = '<div class="kc-wait"><h2>' + MODES[s.mode] + "</h2>" +
        '<div class="kc-seats">' + (s.players || []).map(function (p) { return '<div class="kc-seat">' + A().avatar(A().memberById(p.id) || p) + "<b>" + esc(p.name.split(" ")[0]) + "</b></div>"; }).join("") +
        new Array(Math.max(0, left) + 1).join('<div class="kc-seat empty"><span class="avatar">?</span><b>ينتظر</b></div>') + "</div>" +
        (s.status === "cancelled" ? '<p class="note center-text">انلغت الغرفة.</p>' : '<p class="note center-text">اللعبة تبدي وحدها من يكمل العدد.</p>' +
        '<button type="button" class="btn outline-danger" data-kleave="1">' + (me === 0 ? "إلغاء الغرفة" : "اطلع من الغرفة") + "</button>") + "</div>";
      $("kc-table").innerHTML = html;
      return;
    }
    var live = s.status === "active", myTurn = live && s.turn === me;
    // الخصوم
    var others = (s.players || []).filter(function (p) { return p.seat !== me; });
    html += '<div class="kc-opps">' + others.map(function (p) {
      var mate = s.mode === 22 && teamOf(s, p.seat) === teamOf(s, me);
      return '<div class="kc-opp' + (live && s.turn === p.seat ? " turn" : "") + '">' + A().avatar(A().memberById(p.id) || p) +
        "<b>" + esc(p.name.split(" ")[0]) + "</b>" + (mate ? '<span class="tag preg">فريقك</span>' : "") +
        '<span class="kc-count"><i class="kc-mini"></i>' + p.count + "</span></div>";
    }).join("") + "</div>";
    // النص
    var st = "", cls = "xo-status";
    if (live) st = myTurn ? (s.drawn ? "سحبت ورقة: العبها أو مرّر" : "دورك") : "دور " + seatName(s, s.turn);
    else if (s.status === "done") {
      var won = s.winner_seat === me || (s.mode === 22 && teamOf(s, s.winner_seat) === teamOf(s, me));
      st = won ? (s.winner_seat === me ? "فزت!" : "فاز فريقك!") : "فاز " + seatName(s, s.winner_seat);
      cls += won ? " won" : " lost";
    } else st = "انلغت اللعبة لأن ما صار لعب نص ساعة";
    html += '<p class="' + cls + '">' + st + "</p>";
    // الوسط
    html += '<div class="kc-center">' +
      '<button type="button" class="kc kc-back' + (myTurn && !s.drawn ? " can" : "") + '" data-kdraw="1"' + (myTurn && !s.drawn ? "" : " disabled") + '><span>' + NAME + '</span><small>' + s.deck_count + "</small></button>" +
      '<div class="kc-pile">' + (s.top ? cardHtml(s.top, { big: true }) : "") + "</div>" +
      '<div class="kc-color" style="--kc:' + COLORS[s.color] + '"><i></i><span>' + COLOR_NAMES[s.color] + "</span></div></div>";
    html += '<p class="note center-text kc-note">' + esc(cs.note || "") + "</p>";
    cs.note = "";
    // ورقي
    var hand = (s.hand || []).slice().sort(function (a, b) { return a === "w4" ? 1 : b === "w4" ? -1 : a < b ? -1 : a > b ? 1 : 0; });
    html += '<div class="kc-hand">' + hand.map(function (c) {
      var can = myTurn && playable(c, s);
      return cardHtml(c, { can: can, dim: myTurn && !can, play: true });
    }).join("") + "</div>";
    var acts = "";
    if (myTurn && s.drawn) acts += '<button type="button" class="btn ghost" data-kpass="1">مرّر الدور</button>';
    if (s.status === "done" || s.status === "cancelled") acts += '<button type="button" class="btn" data-kagain="' + s.mode + '">لعبة جديدة</button>';
    html += '<div class="xo-actions">' + acts + "</div>";
    $("kc-table").innerHTML = html;
  }

  function act(fn, args) {
    cs.busy = true;
    args.p_token = A().getToken(); args.p_room = cs.room;
    return A().rpc(fn, args).then(function (r) {
      cs.busy = false;
      if (r && r.ok) cs.st = r.state; else cs.note = ERR[r && r.error] || "ما گدرنا، جرب مرة ثانية.";
      render();
    }).catch(function () { cs.busy = false; cs.note = "صار خطأ بالاتصال."; render(); });
  }
  function pickColor(card) {
    var o = $("kc-pick");
    o.innerHTML = '<div class="kc-pick-box"><b>اختار اللون</b><div>' + ["r", "b", "g", "y"].map(function (c) {
      return '<button type="button" data-kcol="' + c + '" style="background:' + COLORS[c] + '">' + COLOR_NAMES[c] + "</button>";
    }).join("") + '</div><button type="button" class="btn ghost" data-kcol="">إلغاء</button></div>';
    o.hidden = false; o.dataset.card = card;
  }

  function createRoom(mode) {
    A().loading(true);
    A().rpc("a9_card_create", { p_token: A().getToken(), p_mode: mode }).then(function (r) {
      A().loading(false); if (r && r.ok) location.hash = "card/" + r.id;
    }).catch(function () { A().loading(false); });
  }
  function onClick(e) {
    var b = e.target.closest("button, a"); if (!b) return;
    var d = b.dataset;
    if (d.kmode) return createRoom(Number(d.kmode));
    if (d.kagain) return createRoom(Number(d.kagain));
    if (d.kjoin) {
      A().loading(true);
      A().rpc("a9_card_join", { p_token: A().getToken(), p_room: Number(d.kjoin) }).then(function (r) {
        A().loading(false);
        if (r && r.ok) location.hash = "card/" + r.id; else { alert(r && r.error === "full" ? "الغرفة امتلت." : "الغرفة ما متاحة."); refreshLobby(true); }
      }).catch(function () { A().loading(false); });
      return;
    }
    if (d.kleave) {
      A().rpc("a9_card_leave", { p_token: A().getToken(), p_room: cs.room }).then(function () { location.hash = "cards"; });
      return;
    }
    var s = cs.st; if (!s || cs.busy) return;
    var myTurn = s.status === "active" && s.turn === s.my_seat;
    if (d.kdraw && myTurn && !s.drawn) return act("a9_card_draw", {});
    if (d.kpass && myTurn) return act("a9_card_pass", {});
    if (d.kplay && myTurn) {
      if (!playable(d.kplay, s)) { cs.note = ERR.no_match; return render(); }
      if (d.kplay === "w4") return pickColor("w4");
      return act("a9_card_play", { p_card: d.kplay, p_color: d.kplay[0] });
    }
    if (d.kcol != null) {
      var o = $("kc-pick"); o.hidden = true;
      if (d.kcol) act("a9_card_play", { p_card: o.dataset.card, p_color: d.kcol });
    }
  }

  // ---------- الممثل: صور البطاقات ----------
  function adminRender() {
    var box = $("kc-art-admin"); if (!box) return;
    A().rpc("a9_card_lobby", { p_token: A().getToken() }).then(function (d) { return loadArt(d.art); }).then(function () {
      var keys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "w4"];
      box.innerHTML = keys.map(function (k) {
        var src = cs.art[k];
        return '<label class="kc-art-slot">' + (src ? '<img alt="" src="' + src + '" />' : '<span>' + (k === "w4" ? "+4" : k) + "</span>") +
          '<input type="file" accept="image/*" hidden data-kart="' + k + '" /><small>' + (k === "w4" ? "+4" : "رقم " + k) + "</small></label>";
      }).join("");
    }).catch(function () {});
  }
  // نقص الهامش الأبيض حول البطاقة: نلگى حدود اللون الأحمر، وإذا ما لگينا (بطاقة سودة) نقص على حدود اللي مو أبيض
  function trimBox(im) {
    var sc = Math.min(1, 400 / Math.max(im.width, im.height)), w = Math.round(im.width * sc), h = Math.round(im.height * sc);
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var x = c.getContext("2d"); x.drawImage(im, 0, 0, w, h);
    var p = x.getImageData(0, 0, w, h).data;
    function box(test, frac) {
      var rows = [], cols = [], i, j;
      for (j = 0; j < h; j++) { var n = 0; for (i = 0; i < w; i++) if (test(4 * (j * w + i))) n++; rows.push(n > w * frac); }
      for (i = 0; i < w; i++) { var m = 0; for (j = 0; j < h; j++) if (test(4 * (j * w + i))) m++; cols.push(m > h * frac); }
      var t = rows.indexOf(true), bm = rows.lastIndexOf(true), l = cols.indexOf(true), r = cols.lastIndexOf(true);
      if (t < 0 || l < 0 || bm - t < h * 0.5 || r - l < w * 0.5) return null;
      return { x: l / sc, y: t / sc, w: (r - l + 1) / sc, h: (bm - t + 1) / sc };
    }
    return box(function (k) { return p[k] > 140 && p[k + 1] < 80 && p[k + 2] < 80; }, 0.25) ||
           box(function (k) { return p[k] < 225 || p[k + 1] < 225 || p[k + 2] < 225; }, 0.5) ||
           { x: 0, y: 0, w: im.width, h: im.height };
  }
  function onArtFile(e) {
    var k = e.target.dataset.kart, f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!k || !f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var b = trimBox(im), W = 320, H = Math.round(b.h * W / b.w), c = document.createElement("canvas"); c.width = W; c.height = H;
        c.getContext("2d").drawImage(im, b.x, b.y, b.w, b.h, 0, 0, W, H);
        A().loading(true);
        A().rpc("a9_admin_card_art_set", { p_token: A().getToken(), p_key: k, p_photo: c.toDataURL("image/webp", 0.85) }).then(function (r) {
          A().loading(false); var m = $("kc-art-msg"); m.hidden = false; m.textContent = r && r.ok ? "انحفظت البطاقة" : "ما گدرنا نحفظ البطاقة.";
          adminRender();
        }).catch(function () { A().loading(false); });
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  }

  function stop() { stopPoll(); clearInterval(cs.lobbyTimer); }

  document.addEventListener("DOMContentLoaded", function () {
    $("cards").addEventListener("click", onClick);
    $("cardplay").addEventListener("click", onClick);
    var adm = $("kc-art-admin"); if (adm) adm.addEventListener("change", onArtFile);
  });

  window.A9K = { lobby: lobby, table: table, stop: stop, admin: adminRender };
})();
