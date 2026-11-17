// لعبة الورق "9no": ورق بألوان وأرقام، والفايز أول واحد يخلص ورقه.
// الورق: r/b/g/y + رقم (0-9)، و w4 (+4 وتبديل لون). السيرفر يوزع ويخفي الورق ويتأكد من كل حركة.
// صور البطاقات: بطاقة حمرة لكل رقم، والمتصفح يطلع منها الأزرق والأخضر والأصفر.
(function () {
  "use strict";

  function A() { return window.A9; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return A().esc(s); }

  var NAME = "9no";
  var MODES = { 2: "1 ضد 1", 3: "3 لاعبين", 4: "4 لاعبين", 22: "2 ضد 2" };
  var COLORS = { r: "#dc2626", b: "#2563eb", g: "#16a34a", y: "#eab308" };
  var COLOR_NAMES = { r: "أحمر", b: "أزرق", g: "أخضر", y: "أصفر" };
  var HUE = { b: 222, g: 135, y: 50 };
  var SYM = { s: "&#8856;", r: "&#8644;", d: "+2" };
  var KIND = { s: "تخطي", r: "عكس", d: "+2" };
  var AUTO_NOTE = "سحبت ورقة وما عندك شي ينلعب، فراح الدور";
  var ERR = { no_match: "هاي الورقة ما تنلعب هسه", not_your_turn: "مو دورك", already_drew: "سحبت ورقة بهذا الدور", draw_first: "اسحب ورقة أول", pick_color: "اختار لون", not_active: "اللعبة خلصت" };

  var cs = { room: null, st: null, poll: null, lobbyTimer: null, busy: false, art: {}, artV: {}, tinted: {}, note: "", ai: null, hash: "" };

  // ---------- صور البطاقات ----------
  function artKey(card) { return card[0] === "w" ? card : card.slice(1); }
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
    if (col === "w" || col === "r") return src;
    var key = k + ":" + col + ":" + cs.artV[k];
    if (cs.tinted[key]) return typeof cs.tinted[key] === "string" ? cs.tinted[key] : null;
    cs.tinted[key] = tint(src, col).then(function (u) { cs.tinted[key] = u; render(); });
    return null;
  }

  function cardHtml(card, opts) {
    opts = opts || {};
    var cls = "kc" + (opts.big ? " big" : "") + (opts.tiny ? " tiny" : "") + (opts.can ? " can" : "") + (opts.dim ? " dim" : "") + (card[0] === "w" ? " w" : "");
    var attrs = opts.play ? ' data-kplay="' + card + '"' : "";
    var img = artFor(card);
    if (img) return '<button type="button" class="' + cls + ' art"' + attrs + '><img alt="" src="' + img + '" /></button>';
    if (card[0] === "w") {
      var wl = card === "w4" ? "+4" : "";
      return '<button type="button" class="' + cls + '"' + attrs + '><span class="kc-w"><i style="background:#dc2626"></i><i style="background:#2563eb"></i><i style="background:#eab308"></i><i style="background:#16a34a"></i></span><b class="kc-n">' + wl + '</b><span class="kc-c tl">' + (wl || "&#9638;") + '</span><span class="kc-c br">' + (wl || "&#9638;") + "</span></button>";
    }
    var n = SYM[card.slice(1)] || card.slice(1);
    return '<button type="button" class="' + cls + '" style="--kc:' + COLORS[card[0]] + '"' + attrs + '><b class="kc-n">' + n + '</b><span class="kc-c tl">' + n + '</span><span class="kc-c br">' + n + "</span></button>";
  }

  // ---------- القواعد بالمتصفح (للتلوين بس؛ السيرفر هو اللي يقرر) ----------
  function playable(card, st) {
    if (card[0] === "w") return true;
    return card[0] === st.color || (st.top[0] !== "w" && card.slice(1) === st.top.slice(1));
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
  function teamNames(r, t) { return (r.players || []).filter(function (p) { return p.seat % 2 === t; }).map(function (p) { return esc(p.name.split(" ")[0]); }).join("، ") || "فارغ"; }
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
      var inv = (d.invites || []).map(function (r) {
        return '<div class="xo-game hot"><div class="ainfo"><b>' + esc((r.by || "").split(" ")[0]) + " يدعوك · " + MODES[r.mode] + '</b><span class="note">' + names(r.players) + "</span></div>" +
          '<button type="button" class="cbtn join" data-kaccept="' + r.id + '">قبول</button><button type="button" class="cbtn leave" data-kdecline="' + r.id + '">رفض</button></div>';
      }).join("");
      $("kc-inv-wrap").hidden = !inv; $("kc-inv").innerHTML = inv;
      var open = (d.open || []).map(function (r) {
        var left = r.free;
        var info = r.mode === 22 ? "فريق 1: " + teamNames(r, 0) + " · فريق 2: " + teamNames(r, 1) : names(r.players) + " · ينتظر " + left + (left === 1 ? " لاعب" : " لاعبين");
        var btns = r.mine ? '<a class="cbtn join" href="#card/' + r.id + '">فتح</a>'
          : r.mode === 22 ? [0, 1].map(function (t) { return '<button type="button" class="cbtn join" data-kjoin="' + r.id + '" data-kteam="' + t + '"' + (r.free_teams && r.free_teams[t] ? "" : " disabled") + ">فريق " + (t + 1) + "</button>"; }).join("")
          : '<button type="button" class="cbtn join" data-kjoin="' + r.id + '">ادخل</button>';
        return '<div class="xo-game' + (r.mine ? " hot" : "") + '"><div class="ainfo"><b>' + MODES[r.mode] + '</b><span class="note">' + info + "</span></div>" + btns + "</div>";
      }).join("");
      $("kc-open").innerHTML = open || '<p class="note center-text" style="padding:14px">ماكو غرف مفتوحة. سوّي وحدة من فوگ.</p>';
    }).catch(function () { if (first) $("kc-open").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب الغرف.</p>'; });
  }

  // ---------- الطاولة (أونلاين) ----------
  function stopPoll() { clearInterval(cs.poll); cs.poll = null; clearTimeout(cs.botTimer); }
  function table(id) {
    stop();
    cs.ai = null; cs.room = id; cs.st = null; cs.note = ""; cs.hash = "#card/" + id;
    $("kc-table").innerHTML = '<p class="note center-text" style="padding:30px">لحظة...</p>';
    A().loadMembers().catch(function () {});
    var load = function () {
      return A().rpc("a9_card_state", { p_token: A().getToken(), p_room: id }).then(function (s) {
        if (location.hash !== cs.hash || cs.busy) return;
        if (!cs.st || cs.st.updated_at !== s.updated_at || cs.st.status !== s.status) { cs.st = s; render(); }
      });
    };
    A().rpc("a9_card_lobby", { p_token: A().getToken() }).then(function (d) { return loadArt(d.art); }).then(function () { if (cs.st) render(); }).catch(function () {});
    load().catch(function () { $("kc-table").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نفتح اللعبة.</p>'; });
    cs.poll = setInterval(function () {
      if (location.hash !== cs.hash) return stopPoll();
      var s = cs.st; if (document.hidden || !s) return;
      if (s.status === "done" || s.status === "cancelled") return;
      if (s.status === "active" && s.turn === s.my_seat) return;
      load().catch(function () {});
    }, 2000);
  }

  // ---------- ضد الجهاز (كلها بالمتصفح) ----------
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function newDeck() {
    var d = [];
    ["r", "b", "g", "y"].forEach(function (c) {
      d.push(c + "0"); for (var n = 1; n <= 9; n++) { d.push(c + n); d.push(c + n); }
      ["s", "r", "d"].forEach(function (v) { d.push(c + v); d.push(c + v); });
    });
    for (var k = 0; k < 4; k++) { d.push("w4"); d.push("wc"); }
    return shuffle(d);
  }
  function aiStart() {
    stop();
    var st = A().state, me = st.me || { id: 0, name: "أنت" };
    var g = { deck: newDeck(), discard: [], hands: [[], []], turn: 0, drawn: false, color: null, status: "active", winner: null };
    var i = g.deck.findIndex(function (c) { return /^[rbgy][0-9]$/.test(c); });
    g.discard.push(g.deck.splice(i, 1)[0]); g.color = g.discard[0][0];
    for (var k = 0; k < 7; k++) { g.hands[0].push(g.deck.pop()); g.hands[1].push(g.deck.pop()); }
    cs.ai = { g: g, me: me };
    cs.room = null; cs.hash = "#cardai"; cs.note = "";
    aiSync();
  }
  function aiTake(g, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      if (!g.deck.length) { if (g.discard.length <= 1) break; var top = g.discard.pop(); g.deck = shuffle(g.discard); g.discard = [top]; }
      out.push(g.deck.pop());
    }
    return out;
  }
  function aiSync() {
    var a = cs.ai, g = a.g;
    cs.st = { id: "ai", mode: 2, seats: 2, status: g.status, my_seat: 0, hand: g.hands[0].slice(), top: g.discard[g.discard.length - 1], color: g.color,
      turn: g.turn, drawn: g.drawn, deck_count: g.deck.length, winner_seat: g.winner, updated_at: Date.now(),
      players: [{ seat: 0, id: a.me.id, name: a.me.name, count: g.hands[0].length }, { seat: 1, id: null, name: "الجهاز", count: g.hands[1].length, bot: true }] };
    render();
    if (g.status === "active" && g.turn === 1) { clearTimeout(cs.botTimer); cs.botTimer = setTimeout(aiBot, 900); }
  }
  function aiPlay(seat, card, color) {
    var g = cs.ai.g, h = g.hands[seat], i = h.indexOf(card);
    if (i < 0 || g.turn !== seat || g.status !== "active") return false;
    if (!playable(card, { color: g.color, top: g.discard[g.discard.length - 1] })) return false;
    h.splice(i, 1); g.discard.push(card); g.color = card[0] === "w" ? color : card[0]; g.drawn = false;
    if (!h.length) { g.status = "done"; g.winner = seat; return true; }
    var next = 1 - seat, v = card.slice(1);
    // بلعبة اثنين: +4 و +2 والتخطي والعكس كلها ترجع الدور لنفس اللاعب
    if (card === "w4" || (card[0] !== "w" && v === "d")) g.hands[next] = g.hands[next].concat(aiTake(g, card === "w4" ? 4 : 2));
    if (card === "w4" || (card[0] !== "w" && (v === "d" || v === "s" || v === "r"))) next = seat;
    g.turn = next;
    return true;
  }
  function bestColor(h) {
    var n = { r: 0, b: 0, g: 0, y: 0 };
    h.forEach(function (c) { if (c[0] !== "w") n[c[0]]++; });
    return Object.keys(n).sort(function (a, b) { return n[b] - n[a]; })[0];
  }
  // الجهاز: يلعب ورقة من اللون اللي عنده أكثر شي، ويخلي +4 للأخير
  function aiBot() {
    var a = cs.ai; if (!a || location.hash !== "#cardai") return;
    var g = a.g; if (g.status !== "active" || g.turn !== 1) return;
    var h = g.hands[1], top = g.discard[g.discard.length - 1], ctx = { color: g.color, top: top };
    var pick = function () {
      var col = bestColor(h), opts = h.filter(function (c) { return c[0] !== "w" && playable(c, ctx); });
      opts.sort(function (x, y) { return (y[0] === col) - (x[0] === col) || (/[srd]/.test(y[1]) - /[srd]/.test(x[1])); });
      return opts[0] || (h.indexOf("wc") >= 0 ? "wc" : h.indexOf("w4") >= 0 ? "w4" : null);
    };
    var c = pick();
    if (!c && !g.drawn) { g.hands[1] = h.concat(aiTake(g, 1)); h = g.hands[1]; g.drawn = true; c = pick(); }
    if (c) aiPlay(1, c, bestColor(h.filter(function (x) { return x !== c; })));
    else { g.drawn = false; g.turn = 0; }
    aiSync();
  }

  function sortHand(h) { return (h || []).slice().sort(function (a, b) { return (a[0] === "w") - (b[0] === "w") || (a < b ? -1 : a > b ? 1 : 0); }); }
  function teamOf(s, seat) { return s.mode === 22 ? seat % 2 : seat; }
  function playerAt(s, seat) { return (s.players || []).filter(function (p) { return p.seat === seat; })[0] || null; }
  function seatName(s, seat) { var p = playerAt(s, seat); return p ? p.name.split(" ")[0] : ""; }
  function avatarOf(p) { return p.bot ? '<span class="avatar kc-bot">AI</span>' : A().avatar(A().memberById(p.id) || p); }

  // مكان كل لاعب حول الطاولة: إنت تحت، واللي بعدك يسار، وبعده فوگ، وبعده يمين
  var SPOTS = { 2: ["top"], 3: ["left", "right"], 4: ["left", "top", "right"] };

  function render() {
    var s = cs.st; if (!s || location.hash !== cs.hash) return;
    var me = s.my_seat, html = "";
    if (s.status === "open" || (s.status === "cancelled" && !s.top)) { renderWait(s); return; }
    var live = s.status === "active", myTurn = live && s.turn === me;
    // الطاولة
    var spots = SPOTS[s.seats] || [], ring = '<div class="kc-ring s' + s.seats + '">';
    for (var k = 1; k < s.seats; k++) {
      var seat = (me + k) % s.seats, p = playerAt(s, seat); if (!p) continue;
      var tag = s.mode === 22 ? (teamOf(s, seat) === teamOf(s, me) ? '<span class="tag preg">فريقك</span>' : '<span class="tag cons">خصم</span>') : "";
      ring += '<div class="kc-opp ' + spots[k - 1] + (live && s.turn === seat ? " turn" : "") + '">' + avatarOf(p) +
        "<b>" + esc(p.name.split(" ")[0]) + "</b>" + tag +
        (s.mode === 22 && teamOf(s, seat) === teamOf(s, me) && s.mate_hand ? '<span class="kc-mate">' + sortHand(s.mate_hand).map(function (c) { return cardHtml(c, { tiny: true }); }).join("") + "</span>"
          : '<span class="kc-fan">' + new Array(Math.min(p.count, 7) + 1).join("<i></i>") + "</span>") +
        '<span class="kc-count">' + p.count + (p.count === 1 ? " ورقة" : " ورقات") + "</span></div>";
    }
    ring += '<div class="kc-center">' +
      '<button type="button" class="kc kc-back' + (myTurn && !s.drawn ? " can" : "") + '" data-kdraw="1"' + (myTurn && !s.drawn ? "" : " disabled") + '><span>' + NAME + '</span><small>' + s.deck_count + "</small></button>" +
      '<div class="kc-pile">' + (s.top ? cardHtml(s.top, { big: true }) : "") + "</div>" +
      '<div class="kc-color" style="--kc:' + COLORS[s.color] + '"><i></i><span>' + COLOR_NAMES[s.color] + "</span></div></div></div>";
    // النص
    var st = "", cls = "xo-status";
    if (live) st = myTurn ? (s.drawn ? "سحبت ورقة: العبها أو مرّر" : "دورك") : "دور " + seatName(s, s.turn);
    else if (s.status === "done") {
      var won = s.winner_seat === me || (s.mode === 22 && teamOf(s, s.winner_seat) === teamOf(s, me));
      st = won ? (s.winner_seat === me ? "فزت!" : "فاز فريقك!") : "فاز " + seatName(s, s.winner_seat);
      cls += won ? " won" : " lost";
    } else st = "انلغت اللعبة لأن ما صار لعب نص ساعة";
    html += ring + '<p class="' + cls + '">' + st + "</p>";
    html += '<p class="note center-text kc-note">' + esc(cs.note || "") + "</p>";
    cs.note = "";
    // ورقي (تحت)
    var mineP = playerAt(s, me);
    var hand = sortHand(s.hand);
    html += '<div class="kc-me' + (myTurn ? " turn" : "") + '">' + (mineP ? avatarOf(mineP) : "") + "<b>إنت</b>" + (s.mode === 22 ? '<span class="tag preg">فريق ' + (teamOf(s, me) + 1) + "</span>" : "") + "</div>";
    html += '<div class="kc-hand">' + hand.map(function (c) {
      var can = myTurn && playable(c, s);
      return cardHtml(c, { can: can, dim: myTurn && !can, play: true });
    }).join("") + "</div>";
    var acts = "";
    if (myTurn && s.drawn) acts += '<button type="button" class="btn ghost" data-kpass="1">مرّر الدور</button>';
    if (s.status === "done" || s.status === "cancelled") acts += cs.ai ? '<button type="button" class="btn" data-kai="1">جولة ثانية</button>' : '<button type="button" class="btn" data-kagain="' + s.mode + '">لعبة جديدة</button>';
    html += '<div class="xo-actions">' + acts + "</div>";
    $("kc-table").innerHTML = html;
    mountChat(s);
  }

  function renderWait(s) {
    var me = s.my_seat, html = '<div class="kc-wait"><h2>' + MODES[s.mode] + "</h2>";
    var open = s.status === "open";
    var seat = function (i) {
      var p = playerAt(s, i);
      if (p) return '<div class="kc-seat' + (i === me ? " me" : "") + '">' + avatarOf(p) + "<b>" + esc(p.name.split(" ")[0]) + "</b></div>";
      var inv = (s.invites || []).filter(function (x) { return x.seat === i; })[0];
      if (inv) return '<div class="kc-seat invited">' + A().avatar(A().memberById(inv.id) || inv) + "<b>" + esc(inv.name.split(" ")[0]) + '</b><span class="tag special">مدعو</span>' +
        (open ? '<button type="button" class="kc-x" data-kuninv="' + i + '" aria-label="إلغاء الدعوة">×</button>' : "") + "</div>";
      return open ? '<button type="button" class="kc-seat empty kc-invite" data-kinv="' + i + '"><span class="avatar">+</span><b>ادعُ لاعب</b></button>'
                  : '<div class="kc-seat empty"><span class="avatar">?</span><b>ينتظر</b></div>';
    };
    if (s.mode === 22) {
      html += '<div class="kc-teams">' + [0, 1].map(function (t) {
        var mineT = me >= 0 && me % 2 === t, free = !playerAt(s, t) || !playerAt(s, t + 2);
        return '<div class="kc-team' + (mineT ? " mine" : "") + '"><h3>فريق ' + (t + 1) + "</h3><div>" + seat(t) + seat(t + 2) + "</div>" +
          (!mineT && free && s.status === "open" ? '<button type="button" class="cbtn join" data-kswitch="1">انتقل لهذا الفريق</button>' : "") + "</div>";
      }).join("") + "</div>";
    } else {
      html += '<div class="kc-seats">'; for (var i = 0; i < s.seats; i++) html += seat(i); html += "</div>";
    }
    html += s.status === "cancelled" ? '<p class="note center-text">انلغت الغرفة.</p>'
      : '<div class="kc-priv"><button type="button" class="chip' + (s.is_private ? " on" : "") + '" data-kpriv="1">خاصة: بس المدعوين</button>' +
        '<button type="button" class="chip' + (s.is_private ? "" : " on") + '" data-kpriv="0">مفتوحة للكل</button></div>' +
        '<p class="note center-text">دوس على مكان فارغ حتى تدعو لاعب. اللعبة تبدي وحدها من يكمل العدد.</p><button type="button" class="btn outline-danger" data-kleave="1">اطلع من الغرفة</button>';
    $("kc-table").innerHTML = html + "</div>";
    mountChat(s);
  }

  // المحادثة: 1 ضد 1 = المحادثة الخاصة ويا الخصم، وأكثر = محادثة الغرفة
  function mountChat(s) {
    var box = $("kc-chat");
    if (!window.A9C || !box) return;
    if (cs.ai || s.status === "done" || s.status === "cancelled") return window.A9C.unmount();
    if (s.seats === 2) {
      var op = (s.players || []).filter(function (p) { return p.seat !== s.my_seat; })[0];
      if (!op) return window.A9C.unmount();
      window.A9C.mount(box, { kind: "dm", other: op.id, name: op.name.split(" ")[0] });
    } else window.A9C.mount(box, { kind: "room", room: s.id });
  }

  function act(fn, args) {
    cs.busy = true;
    args.p_token = A().getToken(); args.p_room = cs.room;
    return A().rpc(fn, args).then(function (r) {
      cs.busy = false;
      if (r && r.ok) { cs.st = r.state; if (r.auto_passed) cs.note = AUTO_NOTE; } else cs.note = ERR[r && r.error] || "ما گدرنا، جرب مرة ثانية.";
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
  function playCard(card, color) {
    if (cs.ai) { if (aiPlay(0, card, color)) aiSync(); return; }
    act("a9_card_play", { p_card: card, p_color: color });
  }

  function roomCall(fn, args, errMsg) {
    args.p_token = A().getToken(); args.p_room = cs.room;
    return A().rpc(fn, args).then(function (r) {
      if (r && r.ok === false && errMsg) alert(errMsg);
      return A().rpc("a9_card_state", { p_token: A().getToken(), p_room: cs.room });
    }).then(function (st) { if (st) { cs.st = st; render(); } }).catch(function () {});
  }
  function invitePicker(seat) {
    var s = cs.st, o = $("kc-pick");
    var taken = {}; (s.players || []).forEach(function (p) { taken[p.id] = 1; });
    o.dataset.seat = seat;
    var team = s.mode === 22 ? (seat % 2 === (s.my_seat % 2) ? " (لفريقك)" : " (للفريق الثاني)") : "";
    o.innerHTML = '<div class="kc-pick-box kc-inv-box"><b>ادعُ لاعب' + team + '</b><input type="search" class="input" id="kc-inv-q" placeholder="دوّر على اسم" autocomplete="off" />' +
      '<div class="kc-inv-list" id="kc-inv-list"></div><button type="button" class="btn ghost" data-kclose="1">إلغاء</button></div>';
    o.hidden = false;
    var draw = function () {
      var q = $("kc-inv-q").value.trim(), me = A().state.me;
      $("kc-inv-list").innerHTML = (A().state.members || []).filter(function (m) { return m.joined && !taken[m.id] && (!me || m.id !== me.id) && (!q || m.name.indexOf(q) !== -1); })
        .map(function (m) { return '<button type="button" class="kc-inv-row" data-kinvto="' + m.id + '">' + A().avatar(m) + "<span>" + esc(m.name) + "</span></button>"; }).join("") ||
        '<p class="note center-text">ماكو اسم بهذا البحث</p>';
    };
    A().loadMembers().then(draw).catch(draw);
    $("kc-inv-q").addEventListener("input", draw);
  }
  function createRoom(mode) {
    A().loading(true);
    A().rpc("a9_card_create2", { p_token: A().getToken(), p_mode: mode, p_team: 0 }).then(function (r) {
      A().loading(false); if (r && r.ok) location.hash = "card/" + r.id;
    }).catch(function () { A().loading(false); });
  }
  function onClick(e) {
    var b = e.target.closest("button, a"); if (!b) return;
    var d = b.dataset;
    if (d.kai) { if (location.hash === "#cardai") aiStart(); else location.hash = "cardai"; return; }
    if (d.kmode) return createRoom(Number(d.kmode));
    if (d.kagain) return createRoom(Number(d.kagain));
    if (d.kjoin) {
      A().loading(true);
      A().rpc("a9_card_join2", { p_token: A().getToken(), p_room: Number(d.kjoin), p_team: d.kteam != null ? Number(d.kteam) : null }).then(function (r) {
        A().loading(false);
        if (r && r.ok) location.hash = "card/" + r.id;
        else { alert(r && r.error === "team_full" ? "هذا الفريق امتلى." : r && r.error === "full" ? "الغرفة امتلت." : "الغرفة ما متاحة."); refreshLobby(true); }
      }).catch(function () { A().loading(false); });
      return;
    }
    if (d.kswitch) {
      A().rpc("a9_card_switch", { p_token: A().getToken(), p_room: cs.room }).then(function (r) {
        if (!r || !r.ok) alert("الفريق امتلى.");
        return A().rpc("a9_card_state", { p_token: A().getToken(), p_room: cs.room });
      }).then(function (s) { if (s) { cs.st = s; render(); } });
      return;
    }
    if (d.kinv != null) return invitePicker(Number(d.kinv));
    if (d.kinvto) {
      $("kc-pick").hidden = true;
      return roomCall("a9_card_invite", { p_student: Number(d.kinvto), p_seat: Number($("kc-pick").dataset.seat) }, "ما گدرنا ندز الدعوة.");
    }
    if (d.kuninv != null) return roomCall("a9_card_uninvite", { p_seat: Number(d.kuninv) });
    if (d.kpriv != null) return roomCall("a9_card_privacy", { p_private: d.kpriv === "1" });
    if (d.kclose) { $("kc-pick").hidden = true; return; }
    if (d.kaccept) {
      A().loading(true);
      A().rpc("a9_card_join2", { p_token: A().getToken(), p_room: Number(d.kaccept), p_team: null }).then(function (r) {
        A().loading(false); if (r && r.ok) location.hash = "card/" + r.id; else { alert("الغرفة ما متاحة هسه."); refreshLobby(true); }
      }).catch(function () { A().loading(false); });
      return;
    }
    if (d.kdecline) { A().rpc("a9_card_decline", { p_token: A().getToken(), p_room: Number(d.kdecline) }).then(function () { refreshLobby(true); }); return; }
    if (d.kleave) {
      A().rpc("a9_card_leave", { p_token: A().getToken(), p_room: cs.room }).then(function () { location.hash = "cards"; });
      return;
    }
    var s = cs.st; if (!s || cs.busy) return;
    var myTurn = s.status === "active" && s.turn === s.my_seat;
    if (d.kdraw && myTurn && !s.drawn) {
      if (cs.ai) {
        var g = cs.ai.g, ctx = { color: g.color, top: g.discard[g.discard.length - 1] };
        g.hands[0] = g.hands[0].concat(aiTake(g, 1));
        if (g.hands[0].some(function (c) { return playable(c, ctx); })) g.drawn = true;
        else { g.drawn = false; g.turn = 1; cs.note = AUTO_NOTE; }
        return aiSync();
      }
      return act("a9_card_draw", {});
    }
    if (d.kpass && myTurn) {
      if (cs.ai) { cs.ai.g.drawn = false; cs.ai.g.turn = 1; return aiSync(); }
      return act("a9_card_pass", {});
    }
    if (d.kplay && myTurn) {
      if (!playable(d.kplay, s)) { cs.note = ERR.no_match; return render(); }
      if (d.kplay[0] === "w") return pickColor(d.kplay);
      return playCard(d.kplay, d.kplay[0]);
    }
    if (d.kcol != null) {
      var o = $("kc-pick"); o.hidden = true;
      if (d.kcol) playCard(o.dataset.card, d.kcol);
    }
  }

  // ---------- الممثل: صور البطاقات ----------
  function adminRender() {
    var box = $("kc-art-admin"); if (!box) return;
    A().rpc("a9_card_lobby", { p_token: A().getToken() }).then(function (d) { return loadArt(d.art); }).then(function () {
      var keys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "s", "r", "d", "w4", "wc"];
      var LBL = { s: "تخطي", r: "عكس", d: "+2", w4: "+4", wc: "تبديل لون" };
      box.innerHTML = keys.map(function (k) {
        var src = cs.art[k];
        return '<label class="kc-art-slot">' + (src ? '<img alt="" src="' + src + '" />' : '<span>' + (LBL[k] || k) + "</span>") +
          '<input type="file" accept="image/*" hidden data-kart="' + k + '" /><small>' + (LBL[k] || "رقم " + k) + "</small></label>";
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
  function ai() {
    A().rpc("a9_card_lobby", { p_token: A().getToken() }).then(function (d) { return loadArt(d.art); }).then(function () { if (cs.ai) render(); }).catch(function () {});
    aiStart();
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("cards").addEventListener("click", onClick);
    $("cardplay").addEventListener("click", onClick);
    var adm = $("kc-art-admin"); if (adm) adm.addEventListener("change", onArtFile);
  });

  window.A9K = { lobby: lobby, table: table, ai: ai, stop: stop, admin: adminRender };
})();
