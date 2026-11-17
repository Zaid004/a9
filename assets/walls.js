// لعبة سباق الجدران: لوحة 9x9، كل لاعب يوصل للطرف الثاني ويحط جدران تسد طريق خصمه.
// المربع = r*9+c. اللاعب A يبدي من الصف 8 وهدفه الصف 0، واللاعب B بالعكس.
// الجدار "h"+r+c يسد بين الصف r و r+1 للعمودين c و c+1، و "v"+r+c يسد بين العمود c و c+1 للصفين r و r+1.
// نفس القواعد مكتوبة بالقاعدة (private.wg_*)، والسيرفر يتأكد من كل حركة أونلاين.
(function () {
  "use strict";

  function A() { return window.A9; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return A().esc(s); }

  // ---------- القواعد ----------
  var DR = [-1, 1, 0, 0], DC = [0, 0, -1, 1];
  function wset(walls) { var s = {}; (walls || []).forEach(function (w) { s[w] = 1; }); return s; }
  function blocked(W, r1, c1, r2, c2) {
    if (r2 === r1 + 1) return !!(W["h" + r1 + c1] || W["h" + r1 + (c1 - 1)]);
    if (r2 === r1 - 1) return !!(W["h" + r2 + c1] || W["h" + r2 + (c1 - 1)]);
    if (c2 === c1 + 1) return !!(W["v" + r1 + c1] || W["v" + (r1 - 1) + c1]);
    if (c2 === c1 - 1) return !!(W["v" + r1 + c2] || W["v" + (r1 - 1) + c2]);
    return true;
  }
  function stepOk(W, r1, c1, r2, c2) { return r2 >= 0 && r2 <= 8 && c2 >= 0 && c2 <= 8 && !blocked(W, r1, c1, r2, c2); }
  function moves(W, me, op) {
    var r = Math.floor(me / 9), c = me % 9, res = [];
    for (var d = 0; d < 4; d++) {
      var nr = r + DR[d], nc = c + DC[d];
      if (!stepOk(W, r, c, nr, nc)) continue;
      if (nr * 9 + nc === op) {
        if (stepOk(W, nr, nc, nr + DR[d], nc + DC[d])) res.push((nr + DR[d]) * 9 + nc + DC[d]);
        else for (var s = 0; s < 4; s++) {
          if ((DR[s] !== 0) === (DR[d] !== 0)) continue;
          var sr = nr + DR[s], sc = nc + DC[s];
          if (stepOk(W, nr, nc, sr, sc) && sr * 9 + sc !== me) res.push(sr * 9 + sc);
        }
      } else res.push(nr * 9 + nc);
    }
    return res;
  }
  // أقصر مسافة للصف الهدف (بدون حساب القطعة الثانية)، أو -1 إذا ماكو طريق
  function dist(W, pos, goal) {
    var seen = {}, q = [pos], dd = [0], h = 0; seen[pos] = 1;
    while (h < q.length) {
      var p = q[h], k = dd[h]; h++;
      var r = Math.floor(p / 9), c = p % 9;
      if (r === goal) return k;
      for (var d = 0; d < 4; d++) {
        if (!stepOk(W, r, c, r + DR[d], c + DC[d])) continue;
        var n = (r + DR[d]) * 9 + c + DC[d];
        if (!seen[n]) { seen[n] = 1; q.push(n); dd.push(k + 1); }
      }
    }
    return -1;
  }
  function wallErr(W, o, r, c, a, b) {
    if ((o !== "h" && o !== "v") || r < 0 || r > 7 || c < 0 || c > 7) return "bad";
    if (W["h" + r + c] || W["v" + r + c]) return "overlap";
    if (o === "h" && (W["h" + r + (c - 1)] || W["h" + r + (c + 1)])) return "overlap";
    if (o === "v" && (W["v" + (r - 1) + c] || W["v" + (r + 1) + c])) return "overlap";
    W[o + r + c] = 1;
    var ok = dist(W, a, 0) >= 0 && dist(W, b, 8) >= 0;
    delete W[o + r + c];
    return ok ? null : "blocks";
  }
  var ERR = {
    overlap: "هنا يتقاطع ويه جدار ثاني",
    blocks: "ما يصير تسد الطريق كله على لاعب",
    no_walls: "خلصت جدرانك",
    bad: "ما يصير هنا",
    bad_move: "هاي الحركة ما تصير",
    not_your_turn: "مو دورك",
    not_active: "اللعبة خلصت"
  };

  // ---------- حالة الشاشة ----------
  var ws = { mode: null, g: null, prev: null, poll: null, busy: false, ai: null, homeTimer: null, myOpen: null };

  function newLocal() {
    return { a_pos: 76, b_pos: 4, a_walls: 10, b_walls: 10, walls: [], turn: "A", status: "active", winner: null, last_move: null, me: "A" };
  }
  function side() { return ws.mode === "online" ? ws.g.me : ws.g.turn; }
  function canAct() {
    var g = ws.g;
    if (!g || g.status !== "active" || ws.busy) return false;
    if (ws.mode === "online") return g.turn === g.me;
    if (ws.mode === "ai") return g.turn === "A";
    return true;
  }
  function flipped() { return ws.mode === "online" && ws.g && ws.g.me === "B"; }

  function names() {
    var g = ws.g, st = A().state, me = st.me ? { id: st.me.id, name: st.me.name.split(" ")[0], avatar: st.me.avatar } : { name: "أنت" };
    if (ws.mode === "online") {
      var op = g.opponent || { name: "" }, om = A().memberById(op.id) || {};
      var opp = { id: op.id, name: (op.name || "").split(" ")[0], avatar: om.avatar || null };
      return g.me === "A" ? { A: me, B: opp } : { A: opp, B: me };
    }
    if (ws.mode === "ai") return { A: me, B: { name: "الكمبيوتر" } };
    return { A: { name: "الأزرق" }, B: { name: "الوردي" } };
  }
  function chip(p, s, active, left) {
    var av = p.id ? A().avatar(p) : '<span class="avatar wl-av ' + (s === "B" ? "b" : "") + '">' + esc((p.name || " ")[0]) + "</span>";
    return '<div class="xo-p' + (active ? " active" : "") + '">' + av + "<b>" + esc(p.name) + '</b><span class="wl-left"><i class="wl-dot ' + s.toLowerCase() + '"></i>' + left + " جدران</span></div>";
  }

  // ---------- الرسم ----------
  function render() {
    var g = ws.g; if (!g) return;
    var W = wset(g.walls), flip = flipped(), live = g.status === "active", n = names();
    $("wl-players").innerHTML = chip(n.A, "A", live && g.turn === "A", g.a_walls) + '<div class="xo-score">VS</div>' + chip(n.B, "B", live && g.turn === "B", g.b_walls);

    // النص فوگ اللوحة
    var st = "", cls = "xo-status";
    if (g.status === "pending") st = g.incoming ? n.A.name + " يتحداك" : "بانتظار " + n.B.name + " يقبل التحدي";
    else if (live) {
      if (ws.mode === "online") st = g.turn === g.me ? "دورك" : "دور " + (g.me === "A" ? n.B.name : n.A.name);
      else if (ws.mode === "ai") st = g.turn === "A" ? "دورك" : "الكمبيوتر يفكر...";
      else st = "دور " + n[g.turn].name;
    } else if (g.status === "done") {
      var mine = ws.mode === "online" ? g.me : ws.mode === "ai" ? "A" : null;
      if (mine) { st = g.winner === mine ? "فزت!" : (ws.mode === "ai" ? "فاز الكمبيوتر" : "فاز " + n[g.winner].name); cls += g.winner === mine ? " won" : " lost"; }
      else { st = "فاز " + n[g.winner].name + "!"; cls += " won"; }
    } else st = g.status === "declined" ? "انرفض التحدي" : "انلغت اللعبة لأن ما صار لعب نص ساعة";
    $("wl-status").textContent = st; $("wl-status").className = cls;

    // اللوحة
    var act = canAct(), s = live ? side() : null;
    var mePos = s === "A" ? g.a_pos : g.b_pos, opPos = s === "A" ? g.b_pos : g.a_pos;
    var legal = act ? moves(W, mePos, opPos) : [];
    var html = [];
    for (var vr = 0; vr < 9; vr++) for (var vc = 0; vc < 9; vc++) {
      var real = flip ? (8 - vr) * 9 + (8 - vc) : vr * 9 + vc, rr = Math.floor(real / 9);
      var c = "wl-cell" + (rr === 0 ? " goal-a" : rr === 8 ? " goal-b" : "") + (legal.indexOf(real) !== -1 ? " can" : "");
      var pawn = real === g.a_pos ? '<i class="wl-pawn a"></i>' : real === g.b_pos ? '<i class="wl-pawn b"></i>' : "";
      html.push('<div class="' + c + '" data-v="' + vr + "," + vc + '" style="grid-row:' + (2 * vr + 1) + ";grid-column:" + (2 * vc + 1) + '"' + ">" + pawn + "</div>");
    }
    var last = g.last_move && /[hv]/.test(g.last_move[1]) ? g.last_move.slice(1) : null;
    (g.walls || []).forEach(function (w) { html.push(wallHtml(w[0], +w[1], +w[2], w === last ? " new" : "")); });
    if (ws.prev && act) html.push(wallHtml(ws.prev.o, ws.prev.r, ws.prev.c, ws.prev.err ? " bad" : " prev"));
    $("wl-board").innerHTML = html.join("");

    var msg = "";
    if (ws.note) { msg = ws.note; ws.note = null; }
    $("wl-msg").textContent = msg;

    var acts = "";
    if (ws.mode === "online") {
      if (g.incoming && g.status === "pending") acts += '<button type="button" class="btn" data-wl="accept">قبول التحدي</button><button type="button" class="btn outline-danger" data-wl="decline">رفض</button>';
      else if (g.status === "done" || g.status === "declined" || g.status === "cancelled") acts += '<button type="button" class="btn" data-wl="rematch">مباراة ثانية</button>';
    } else acts += g.status === "done" ? '<button type="button" class="btn" data-wl="again">جولة ثانية</button>' : '<button type="button" class="btn ghost" data-wl="again">إعادة</button>';
    $("wl-actions").innerHTML = acts;
  }
  function wallHtml(o, r, c, extra) {
    var flip = flipped(), vr = flip ? 7 - r : r, vc = flip ? 7 - c : c;
    var pos = o === "h" ? "grid-row:" + (2 * vr + 2) + ";grid-column:" + (2 * vc + 1) + " / span 3"
                        : "grid-column:" + (2 * vc + 2) + ";grid-row:" + (2 * vr + 1) + " / span 3";
    return '<i class="wl-wall ' + o + extra + '" style="' + pos + '"></i>';
  }

  // ---------- اللعب ----------
  // دوسة على مربع أخضر = حركة. إصبعك على اللوحة (سحب أو ضغطة طويلة) = معاينة جدار بأقرب فراغ، وتشيل إصبعك = يتثبت
  var touch = null;
  function anchorAt(ev) {
    var el = $("wl-board"), rc = el.getBoundingClientRect(), pad = 8, gap = 7;
    var inner = rc.width - pad * 2, pitch = (inner - gap * 8) / 9 + gap;
    var x = ev.clientX - rc.left - pad, y = ev.clientY - rc.top - pad;
    if (x < -pad || y < -pad || x > inner + pad || y > inner + pad) return null;
    var kx = Math.min(8, Math.max(1, Math.round((x + gap / 2) / pitch))), ky = Math.min(8, Math.max(1, Math.round((y + gap / 2) / pitch)));
    var dx = Math.abs(x - (kx * pitch - gap / 2)), dy = Math.abs(y - (ky * pitch - gap / 2));
    var ar = ky - 1, ac = kx - 1, flip = flipped();
    return { o: dy <= dx ? "h" : "v", r: flip ? 7 - ar : ar, c: flip ? 7 - ac : ac };
  }
  function wallsLeft() { var g = ws.g, s = side(); return s === "A" ? g.a_walls : g.b_walls; }
  function showPrev(ev) {
    var a = anchorAt(ev), g = ws.g;
    if (!a || !wallsLeft()) { if (ws.prev) { ws.prev = null; render(); } return; }
    if (ws.prev && ws.prev.o === a.o && ws.prev.r === a.r && ws.prev.c === a.c) return;
    a.err = wallErr(wset(g.walls), a.o, a.r, a.c, g.a_pos, g.b_pos);
    ws.prev = a; render();
  }
  function onDown(ev) {
    if (!canAct()) return;
    var cell = ev.target.closest(".wl-cell");
    touch = { x: ev.clientX, y: ev.clientY, drag: false, cell: cell && cell.classList.contains("can") ? cell.dataset.v : null, id: ev.pointerId };
    try { $("wl-board").setPointerCapture(ev.pointerId); } catch (e) {}
    clearTimeout(touch.hold);
    var last = { clientX: ev.clientX, clientY: ev.clientY };
    touch.last = last;
    touch.hold = setTimeout(function () { if (touch && !touch.drag) { touch.drag = true; showPrev(touch.last); } }, 220);
  }
  function onMove(ev) {
    if (!touch || ev.pointerId !== touch.id) return;
    touch.last = { clientX: ev.clientX, clientY: ev.clientY };
    if (!touch.drag && Math.hypot(ev.clientX - touch.x, ev.clientY - touch.y) > 8) touch.drag = true;
    if (touch.drag) showPrev(ev);
  }
  function onUp(ev) {
    if (!touch || ev.pointerId !== touch.id) return;
    var t = touch; touch = null; clearTimeout(t.hold);
    if (t.drag) {
      var p = ws.prev;
      if (p && !p.err && anchorAt(ev)) return play(p.o, p.r, p.c);
      ws.prev = null; return render();
    }
    if (t.cell) { var v = t.cell.split(","); onCell(+v[0], +v[1]); }
  }
  function onCancel() { if (!touch) return; clearTimeout(touch.hold); touch = null; ws.prev = null; render(); }
  function onCell(vr, vc) {
    if (!canAct()) return;
    var g = ws.g, flip = flipped();
    var real = flip ? (8 - vr) * 9 + (8 - vc) : vr * 9 + vc, s = side();
    var me = s === "A" ? g.a_pos : g.b_pos, op = s === "A" ? g.b_pos : g.a_pos;
    if (moves(wset(g.walls), me, op).indexOf(real) === -1) return;
    play("m", Math.floor(real / 9), real % 9);
  }

  function applyLocal(g, kind, r, c) {
    var s = g.turn;
    if (kind === "m") {
      if (s === "A") g.a_pos = r * 9 + c; else g.b_pos = r * 9 + c;
      if ((s === "A" && r === 0) || (s === "B" && r === 8)) { g.status = "done"; g.winner = s; }
    } else {
      g.walls = g.walls.concat([kind + r + c]);
      if (s === "A") g.a_walls--; else g.b_walls--;
    }
    g.last_move = s + kind + r + c;
    g.turn = s === "A" ? "B" : "A";
  }

  function play(kind, r, c) {
    ws.prev = null;
    if (ws.mode !== "online") {
      applyLocal(ws.g, kind, r, c);
      render();
      if (ws.mode === "ai" && ws.g.status === "active" && ws.g.turn === "B") { clearTimeout(ws.ai); ws.ai = setTimeout(aiMove, 450); }
      return;
    }
    ws.busy = true;
    A().rpc("a9_wall_move", { p_token: A().getToken(), p_game: ws.g.id, p_kind: kind, p_r: r, p_c: c }).then(function (res) {
      ws.busy = false;
      if (res && res.ok) ws.g = res.game;
      else ws.note = ERR[res && res.error] || "ما گدرنا نسجل الحركة، جرب مرة ثانية.";
      render();
    }).catch(function () { ws.busy = false; ws.note = "صار خطأ بالاتصال، جرب مرة ثانية."; render(); });
  }

  // الكمبيوتر يلعب بالأزرق ضدك: يحط جدار إذا يأخرك أكثر ما يأخره، وإلا يمشي بأقصر طريق
  function aiMove() {
    var g = ws.g; if (!g || g.status !== "active" || g.turn !== "B" || ws.mode !== "ai") return;
    var W = wset(g.walls), myD = dist(W, g.b_pos, 8), opD = dist(W, g.a_pos, 0);
    if (g.b_walls > 0 && opD <= myD) {
      var best = null;
      ["h", "v"].forEach(function (o) {
        for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
          if (wallErr(W, o, r, c, g.a_pos, g.b_pos)) continue;
          W[o + r + c] = 1;
          var score = (dist(W, g.a_pos, 0) - opD) - (dist(W, g.b_pos, 8) - myD) + Math.random() * 0.3;
          delete W[o + r + c];
          if (!best || score > best.s) best = { s: score, o: o, r: r, c: c };
        }
      });
      if (best && (best.s >= 2 || (best.s >= 1 && opD <= 3))) return play(best.o, best.r, best.c);
    }
    var opts = moves(W, g.b_pos, g.a_pos), pick = null, bestD = 99;
    opts.forEach(function (m) {
      var d = Math.floor(m / 9) === 8 ? 0 : dist(W, m, 8), d2 = d + Math.random() * 0.5;
      if (d >= 0 && d2 < bestD) { bestD = d2; pick = m; }
    });
    if (pick == null) pick = opts[0];
    play("m", Math.floor(pick / 9), pick % 9);
  }

  // ---------- أونلاين ----------
  function stopPoll() { clearInterval(ws.poll); ws.poll = null; }
  function online(id) {
    stopPoll(); clearTimeout(ws.ai);
    ws.mode = "online"; ws.g = null; ws.prev = null; ws.busy = false;
    $("wl-board").innerHTML = ""; $("wl-actions").innerHTML = ""; $("wl-status").textContent = ""; $("wl-msg").textContent = "";
    var load = function () {
      return A().rpc("a9_wall_get", { p_token: A().getToken(), p_game: id }).then(function (g) {
        if (location.hash !== "#wall/" + id) return;
        var changed = !ws.g || ws.g.updated_at !== g.updated_at || ws.g.status !== g.status;
        if (changed && !ws.busy) { ws.g = g; if (g.turn !== g.me) ws.prev = null; render(); }
        if (window.A9C && g.opponent && g.opponent.id) window.A9C.mount($("wl-chat"), { kind: "dm", other: g.opponent.id, name: (g.opponent.name || "").split(" ")[0] });
      });
    };
    A().loadMembers().then(function () { if (ws.g) render(); }).catch(function () {});
    load().catch(function () { $("wl-status").textContent = "ما گدرنا نفتح اللعبة."; });
    ws.poll = setInterval(function () {
      if (location.hash !== "#wall/" + id) return stopPoll();
      if (document.hidden || !ws.g) return;
      if (ws.g.status === "active" && ws.g.turn === ws.g.me) return; // دورك: ماكو داعي نسأل
      if (ws.g.status === "done" || ws.g.status === "declined" || ws.g.status === "cancelled") return;
      load().catch(function () {});
    }, 2000);
  }
  function local(mode) {
    if (window.A9C) window.A9C.unmount();
    stopPoll(); clearTimeout(ws.ai);
    ws.mode = mode; ws.g = newLocal(); ws.prev = null; ws.busy = false;
    render();
  }

  // ---------- صفحة اللعبة ----------
  function home() {
    $("wl-search").value = "";
    A().loadMembers().then(renderPeople).catch(function () {});
    ws.myOpen = null;
    refreshHome(true);
    clearInterval(ws.homeTimer);
    ws.homeTimer = setInterval(function () {
      if (location.hash !== "#walls") { clearInterval(ws.homeTimer); return; }
      if (!document.hidden) refreshHome(false);
    }, 8000);
  }
  function refreshHome(first) {
    return A().loadMembers().catch(function () {}).then(function () { return A().rpc("a9_wall_list", { p_token: A().getToken() }); }).then(function (d) {
      if (location.hash !== "#walls") return;
      if (!first && ws.myOpen && !d.my_open) {
        var g0 = (d.games || []).filter(function (g) { return g.status === "active"; })[0];
        ws.myOpen = null;
        if (g0) { location.hash = "wall/" + g0.id; return; }
      }
      ws.myOpen = d.my_open || null;
      $("wl-stats").innerHTML = "<div><b>" + d.wins + "</b><span>فوز</span></div><div><b>" + d.losses + "</b><span>خسارة</span></div>";
      var st = A().state;
      var mine = d.my_open
        ? '<div class="xo-game hot">' + A().avatar(st.me || { name: "" }) + '<div class="ainfo"><b>مباراتك مفتوحة</b><span class="note">بانتظار أي طالب يدخل يلعب ضدك</span></div>' +
          '<button type="button" class="cbtn leave" data-wopencancel="' + d.my_open + '">إلغاء</button></div>'
        : '<div class="xo-game"><div class="ainfo"><b>سوّي مباراة مفتوحة</b></div><button type="button" class="cbtn join" data-wopencreate="1">سوّي</button></div>';
      var others = (d.open || []).map(function (o) {
        var c = o.creator;
        return '<div class="xo-game">' + A().avatar(A().memberById(c.id) || c) + '<div class="ainfo"><b>' + esc(c.name) + '</b><span class="note">يدور خصم</span></div>' +
          '<button type="button" class="cbtn join" data-wopenjoin="' + o.id + '">العب ضده</button></div>';
      }).join("");
      $("wl-open").innerHTML = mine + others;
      var games = d.games || [];
      $("wl-games").innerHTML = games.length ? games.map(function (g) {
        var op = g.opponent || { name: "" }, s, cls = "";
        if (g.status === "pending") { s = g.incoming ? "يتحداك" : "بانتظار قبوله"; cls = g.incoming ? " hot" : ""; }
        else if (g.status === "active") { s = g.turn === g.me ? "دورك" : "دوره"; cls = g.turn === g.me ? " hot" : ""; }
        else if (g.status === "done") s = g.winner === g.me ? "فزت" : "خسرت";
        else s = g.status === "declined" ? "رفض التحدي" : "انلغت، ما صار لعب نص ساعة";
        var btns = g.incoming ? '<button type="button" class="cbtn join" data-waccept="' + g.id + '">قبول</button><button type="button" class="cbtn leave" data-wdecline="' + g.id + '">رفض</button>'
                              : '<a class="cbtn join" href="#wall/' + g.id + '">' + (g.status === "active" ? "العب" : "فتح") + "</a>";
        return '<div class="xo-game' + cls + '">' + A().avatar(A().memberById(op.id) || op) + '<div class="ainfo"><b>' + esc(op.name) + '</b><span class="note">' + s + "</span></div>" + btns + "</div>";
      }).join("") : '<p class="note center-text" style="padding:16px">ماكو تحديات. اختار طالب من تحت وتحداه.</p>';
    }).catch(function () { if (first) $("wl-games").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب التحديات.</p>'; });
  }
  function renderPeople() {
    var q = $("wl-search").value.trim(), st = A().state;
    var list = (st.members || []).filter(function (m) { return (!st.me || m.id !== st.me.id) && m.joined && (!q || m.name.indexOf(q) !== -1); });
    $("wl-people").innerHTML = list.map(function (m) {
      return '<div class="cmember xo-person">' + A().avatar(m) + '<span class="nm">' + esc(m.name) + '</span><button type="button" class="cbtn join" data-wchallenge="' + m.id + '">تحدي</button></div>';
    }).join("") || '<p class="note center-text" style="padding:16px">ماكو اسم بهذا البحث</p>';
  }
  function respond(id, accept) {
    A().rpc("a9_wall_respond", { p_token: A().getToken(), p_game: id, p_accept: accept }).then(function () {
      if (accept) { if (location.hash === "#wall/" + id) online(id); else location.hash = "wall/" + id; }
      else if (location.hash === "#walls") refreshHome(true); else online(id);
    });
  }

  function onClick(e) {
    var b = e.target.closest("button, a"); if (!b) return;
    var d = b.dataset, tk = A().getToken();
    if (d.wmode) { location.hash = "wallplay/" + d.wmode; return; }
    if (d.wl === "again") { clearTimeout(ws.ai); return local(ws.mode); }
    if (d.wl === "accept") return respond(ws.g.id, true);
    if (d.wl === "decline") return respond(ws.g.id, false);
    if (d.wl === "rematch") {
      A().rpc("a9_wall_rematch", { p_token: tk, p_game: ws.g.id }).then(function (r) { if (r && r.ok) location.hash = "wall/" + r.id; });
      return;
    }
    if (d.wchallenge) {
      A().loading(true);
      A().rpc("a9_wall_challenge", { p_token: tk, p_opponent: Number(d.wchallenge) }).then(function (r) {
        A().loading(false); if (r && r.ok) location.hash = "wall/" + r.id; else alert("ما گدرنا نرسل التحدي.");
      }).catch(function () { A().loading(false); });
      return;
    }
    if (d.waccept) return respond(Number(d.waccept), true);
    if (d.wdecline) return respond(Number(d.wdecline), false);
    if (d.wopencreate) {
      A().loading(true);
      A().rpc("a9_wall_open_create", { p_token: tk }).then(function () { A().loading(false); return refreshHome(true); }).catch(function () { A().loading(false); });
      return;
    }
    if (d.wopencancel) {
      ws.myOpen = null;
      A().rpc("a9_wall_open_cancel", { p_token: tk, p_open: Number(d.wopencancel) }).then(function () { return refreshHome(true); });
      return;
    }
    if (d.wopenjoin) {
      A().loading(true);
      A().rpc("a9_wall_open_join", { p_token: tk, p_open: Number(d.wopenjoin) }).then(function (r) {
        A().loading(false);
        if (r && r.ok) location.hash = "wall/" + r.id;
        else { alert("سبقك أحد، أو صاحبها لغاها."); refreshHome(true); }
      }).catch(function () { A().loading(false); });
    }
  }

  function stop() { stopPoll(); clearTimeout(ws.ai); clearInterval(ws.homeTimer); }

  document.addEventListener("DOMContentLoaded", function () {
    $("walls").addEventListener("click", onClick);
    $("wallplay").addEventListener("click", onClick);
    $("wl-search").addEventListener("input", renderPeople);
    var bd = $("wl-board");
    bd.addEventListener("pointerdown", onDown);
    bd.addEventListener("pointermove", onMove);
    bd.addEventListener("pointerup", onUp);
    bd.addEventListener("pointercancel", onCancel);
    bd.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  });

  window.A9W = { home: home, online: online, local: local, stop: stop, _rules: { moves: moves, dist: dist, wallErr: wallErr, wset: wset } };
})();
