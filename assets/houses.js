// لعبة بيت بيوت: شبكة 5x5 مربعات (6x6 نقاط). اللي يسكّر الضلع الرابع لمربع ياخذه ويلعب مرة ثانية.
// كل مربع وراه صورة مكان من الكلية، تبين شوية شوية ويا كل خط حوله، ومن يكتمل يبين اسم المكان.
// الخطوط: أفقية 0..29 (r*5+c، r من 0 لـ 5)، عمودية 30..59 (30 + r*6+c، r من 0 لـ 4).
// lines[i]: 0 ماكو، 1 رسمه A، 2 رسمه B. boxes[k]: 0 أو 1 أو 2. نفس القواعد بالقاعدة (a9_house_move).
(function () {
  "use strict";

  function A() { return window.A9; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return A().esc(s); }
  function first(n) { return (n || "").split(" ")[0]; }

  // ---------- القواعد ----------
  function boxLines(k) { var r = Math.floor(k / 5), c = k % 5; return [r * 5 + c, (r + 1) * 5 + c, 30 + r * 6 + c, 30 + r * 6 + c + 1]; }
  var LINE_BOXES = (function () {
    var m = []; for (var i = 0; i < 60; i++) m.push([]);
    for (var k = 0; k < 25; k++) boxLines(k).forEach(function (l) { m[l].push(k); });
    return m;
  })();
  function sides(lines, k) { return boxLines(k).filter(function (l) { return lines[l]; }).length; }
  function score(boxes) { var a = 0, b = 0; boxes.forEach(function (x) { if (x === 1) a++; else if (x === 2) b++; }); return { A: a, B: b }; }
  // يرسم الخط ويرجع شكد مربع انأخذ
  function applyLine(g, line, who) {
    var n = who === "A" ? 1 : 2, got = 0;
    g.lines[line] = n;
    LINE_BOXES[line].forEach(function (k) { if (!g.boxes[k] && sides(g.lines, k) === 4) { g.boxes[k] = n; got++; } });
    return got;
  }

  // ---------- الصور ----------
  var photos = {}, placeIds = null;
  function photoKey(id) { return "a9:hp:" + id; }
  function loadPlaces(ids) {
    var need = [];
    (ids || []).forEach(function (id) {
      if (id == null || photos[id] || need.indexOf(id) !== -1) return;
      try { var c = JSON.parse(localStorage.getItem(photoKey(id)) || "null"); if (c && c.photo) { photos[id] = c; return; } } catch (e) {}
      need.push(id);
    });
    if (!need.length) return Promise.resolve();
    return A().rpc("a9_house_places", { p_token: A().getToken(), p_ids: need }).then(function (rows) {
      (rows || []).forEach(function (p) {
        photos[p.id] = { name: p.name, photo: p.photo };
        try { localStorage.setItem(photoKey(p.id), JSON.stringify(photos[p.id])); } catch (e) {}
      });
    }).catch(function () {});
  }
  function allPlaceIds() {
    if (placeIds) return Promise.resolve(placeIds);
    return A().rpc("a9_house_place_ids", { p_token: A().getToken() }).then(function (ids) { placeIds = ids || []; return placeIds; })
      .catch(function () { return []; });
  }
  function pickPlaces(ids) {
    if (!ids.length) return [];
    var res = [];
    while (res.length < 25) res = res.concat(ids.slice().sort(function () { return Math.random() - 0.5; }));
    return res.slice(0, 25);
  }

  // ---------- حالة الشاشة ----------
  var hs = { mode: null, g: null, poll: null, busy: false, ai: null, homeTimer: null, myOpen: null, fresh: {} };
  function newLocal(places) {
    var l = [], b = []; for (var i = 0; i < 60; i++) l.push(0); for (var k = 0; k < 25; k++) b.push(0);
    return { lines: l, boxes: b, places: places || [], turn: "A", status: "active", winner: null, last_line: null, me: "A" };
  }
  function canAct() {
    var g = hs.g;
    if (!g || g.status !== "active" || hs.busy) return false;
    if (hs.mode === "online") return g.turn === g.me;
    if (hs.mode === "ai") return g.turn === "A";
    return true;
  }
  function names() {
    var g = hs.g, st = A().state, me = st.me ? { id: st.me.id, name: first(st.me.name), avatar: st.me.avatar } : { name: "أنت" };
    if (hs.mode === "online") {
      var op = g.opponent || { name: "" }, om = A().memberById(op.id) || {};
      var opp = { id: op.id, name: first(op.name), avatar: om.avatar || null };
      return g.me === "A" ? { A: me, B: opp } : { A: opp, B: me };
    }
    if (hs.mode === "ai") return { A: me, B: { name: "الكمبيوتر" } };
    return { A: { name: "الأزرق" }, B: { name: "الوردي" } };
  }
  function chip(p, s, active, n) {
    var av = p.id ? A().avatar(p) : '<span class="avatar hb-av ' + s.toLowerCase() + '">' + esc((p.name || " ")[0]) + "</span>";
    return '<div class="xo-p hb-p ' + s.toLowerCase() + (active ? " active" : "") + '">' + av + "<b>" + esc(p.name) + '</b><span class="hb-count"><i></i>' + n + " بيت</span></div>";
  }

  // ---------- الرسم ----------
  function render() {
    var g = hs.g; if (!g) return;
    var live = g.status === "active", n = names(), sc = score(g.boxes);
    $("hb-players").innerHTML = chip(n.A, "A", live && g.turn === "A", sc.A) + '<div class="xo-score">VS</div>' + chip(n.B, "B", live && g.turn === "B", sc.B);

    var st = "", cls = "xo-status";
    if (g.status === "pending") st = g.incoming ? n.A.name + " يتحداك" : "بانتظار " + n.B.name + " يقبل التحدي";
    else if (live) {
      if (hs.mode === "online") st = g.turn === g.me ? "دورك" : "دور " + (g.me === "A" ? n.B.name : n.A.name);
      else if (hs.mode === "ai") st = g.turn === "A" ? "دورك" : "الكمبيوتر يفكر...";
      else st = "دور " + n[g.turn].name;
    } else if (g.status === "done") {
      var mine = hs.mode === "online" ? g.me : hs.mode === "ai" ? "A" : null;
      if (mine) { st = g.winner === mine ? "فزت! " + sc[mine] + " بيت" : (hs.mode === "ai" ? "فاز الكمبيوتر" : "فاز " + n[g.winner].name); cls += g.winner === mine ? " won" : " lost"; }
      else { st = "فاز " + n[g.winner].name + "!"; cls += " won"; }
    } else st = g.status === "declined" ? "انرفض التحدي" : "انلغت اللعبة لأن ما صار لعب نص ساعة";
    $("hb-status").textContent = st; $("hb-status").className = cls;

    var act = canAct(), html = [];
    for (var r = 0; r < 6; r++) for (var c = 0; c < 6; c++)
      html.push('<i class="hb-dot" style="grid-row:' + (2 * r + 1) + ";grid-column:" + (2 * c + 1) + '"></i>');
    for (var k = 0; k < 25; k++) {
      var br = Math.floor(k / 5), bc = k % 5, s = sides(g.lines, k), own = g.boxes[k], pid = g.places[k], p = pid != null ? photos[pid] : null;
      var img = p ? '<img alt="" src="' + p.photo + '" />' : '<span class="hb-ph"></span>';
      html.push('<div class="hb-box s' + s + (own ? " own o" + own : "") + (hs.fresh[k] ? " fresh" : "") + '" style="grid-row:' + (2 * br + 2) + ";grid-column:" + (2 * bc + 2) + '">' +
        img + (own ? '<span class="hb-name">' + esc(p ? p.name : "") + "</span>" : "") + "</div>");
    }
    for (var l = 0; l < 60; l++) {
      var pos = l < 30 ? "grid-row:" + (2 * Math.floor(l / 5) + 1) + ";grid-column:" + (2 * (l % 5) + 2)
                       : "grid-row:" + (2 * Math.floor((l - 30) / 6) + 2) + ";grid-column:" + (2 * ((l - 30) % 6) + 1);
      var who = g.lines[l];
      html.push('<button type="button" class="hb-line ' + (l < 30 ? "h" : "v") + (who ? " on p" + who : act ? " can" : "") + (l === g.last_line ? " last" : "") +
        '" data-line="' + l + '" style="' + pos + '"' + (who || !act ? " disabled" : "") + ' aria-label="خط"></button>');
    }
    $("hb-board").innerHTML = html.join("");
    hs.fresh = {};

    $("hb-msg").textContent = hs.note || ""; hs.note = null;
    var acts = "";
    if (hs.mode === "online") {
      if (g.incoming && g.status === "pending") acts += '<button type="button" class="btn" data-hb="accept">قبول التحدي</button><button type="button" class="btn outline-danger" data-hb="decline">رفض</button>';
      else if (g.status === "done" || g.status === "declined" || g.status === "cancelled") acts += '<button type="button" class="btn" data-hb="rematch">مباراة ثانية</button>';
    } else acts += g.status === "done" ? '<button type="button" class="btn" data-hb="again">جولة ثانية</button>' : '<button type="button" class="btn ghost" data-hb="again">إعادة</button>';
    $("hb-actions").innerHTML = acts;
  }
  function markFresh(before, after) { for (var k = 0; k < 25; k++) if (!before[k] && after[k]) hs.fresh[k] = 1; }

  // ---------- اللعب ----------
  function play(line) {
    var g = hs.g;
    if (!canAct() || g.lines[line]) return;
    if (hs.mode !== "online") {
      var before = g.boxes.slice(), got = applyLine(g, line, g.turn);
      g.last_line = line; markFresh(before, g.boxes);
      afterLocal(got);
      return;
    }
    hs.busy = true;
    var before2 = g.boxes.slice();
    A().rpc("a9_house_move", { p_token: A().getToken(), p_game: g.id, p_line: line }).then(function (res) {
      hs.busy = false;
      if (res && res.ok) { markFresh(before2, res.game.boxes); hs.g = res.game; }
      else hs.note = res && res.error === "not_your_turn" ? "مو دورك" : res && res.error === "taken" ? "هذا الخط مرسوم" : "ما گدرنا نسجل الحركة، جرب مرة ثانية.";
      render();
    }).catch(function () { hs.busy = false; hs.note = "صار خطأ بالاتصال، جرب مرة ثانية."; render(); });
  }
  function afterLocal(got) {
    var g = hs.g, sc = score(g.boxes);
    if (sc.A + sc.B === 25) { g.status = "done"; g.winner = sc.A > sc.B ? "A" : "B"; }
    else if (!got) g.turn = g.turn === "A" ? "B" : "A";
    render();
    if (hs.mode === "ai" && g.status === "active" && g.turn === "B") { clearTimeout(hs.ai); hs.ai = setTimeout(aiMove, 550); }
  }

  // الكمبيوتر: ياخذ أي بيت جاهز، وإذا ماكو يرسم خط ما يعطيك بيت، وإذا كل الخطوط تعطي يختار الأقل خسارة
  function giveaway(g, line) {
    var t = { lines: g.lines.slice(), boxes: g.boxes.slice() }, n = 0, again = true;
    applyLine(t, line, "B");
    while (again) {
      again = false;
      for (var k = 0; k < 25; k++) if (!t.boxes[k] && sides(t.lines, k) === 3) {
        var miss = boxLines(k).filter(function (l) { return !t.lines[l]; })[0];
        n += applyLine(t, miss, "A"); again = true;
      }
    }
    return n;
  }
  function aiMove() {
    var g = hs.g; if (!g || g.status !== "active" || g.turn !== "B" || hs.mode !== "ai") return;
    var free = [], l, k;
    for (l = 0; l < 60; l++) if (!g.lines[l]) free.push(l);
    for (k = 0; k < 25; k++) if (!g.boxes[k] && sides(g.lines, k) === 3) {
      var miss = boxLines(k).filter(function (x) { return !g.lines[x]; })[0];
      return aiPlay(miss);
    }
    var safe = free.filter(function (x) { return LINE_BOXES[x].every(function (b) { return sides(g.lines, b) < 2; }); });
    if (safe.length) return aiPlay(safe[Math.floor(Math.random() * safe.length)]);
    var best = null;
    free.forEach(function (x) { var c = giveaway(g, x) + Math.random() * 0.2; if (!best || c < best.c) best = { c: c, l: x }; });
    aiPlay(best.l);
  }
  function aiPlay(line) {
    var g = hs.g, before = g.boxes.slice(), got = applyLine(g, line, "B");
    g.last_line = line; markFresh(before, g.boxes);
    afterLocal(got);
  }

  // ---------- أونلاين ----------
  function stopPoll() { clearInterval(hs.poll); hs.poll = null; }
  function online(id) {
    stopPoll(); clearTimeout(hs.ai);
    hs.mode = "online"; hs.g = null; hs.busy = false;
    $("hb-board").innerHTML = ""; $("hb-actions").innerHTML = ""; $("hb-status").textContent = ""; $("hb-msg").textContent = "";
    var load = function () {
      return A().rpc("a9_house_get", { p_token: A().getToken(), p_game: id }).then(function (g) {
        if (location.hash !== "#house/" + id) return;
        var changed = !hs.g || hs.g.updated_at !== g.updated_at || hs.g.status !== g.status;
        if (changed && !hs.busy) {
          if (hs.g) markFresh(hs.g.boxes, g.boxes);
          hs.g = g; render();
          loadPlaces(g.places).then(function () { if (hs.g === g) render(); });
        }
        if (window.A9C && g.opponent && g.opponent.id) window.A9C.mount($("hb-chat"), { kind: "dm", other: g.opponent.id, name: first(g.opponent.name) });
      });
    };
    A().loadMembers().then(function () { if (hs.g) render(); }).catch(function () {});
    load().catch(function () { $("hb-status").textContent = "ما گدرنا نفتح اللعبة."; });
    hs.poll = setInterval(function () {
      if (location.hash !== "#house/" + id) return stopPoll();
      if (document.hidden || !hs.g) return;
      if (hs.g.status === "active" && hs.g.turn === hs.g.me) return;
      if (hs.g.status === "done" || hs.g.status === "declined" || hs.g.status === "cancelled") return;
      load().catch(function () {});
    }, 2000);
  }
  function local(mode) {
    if (window.A9C) window.A9C.unmount();
    stopPoll(); clearTimeout(hs.ai);
    hs.mode = mode; hs.busy = false; hs.g = newLocal([]);
    render();
    allPlaceIds().then(function (ids) {
      var pl = pickPlaces(ids), g = hs.g;
      if (!pl.length || hs.mode !== mode) return;
      g.places = pl; render();
      loadPlaces(pl).then(function () { if (hs.g === g) render(); });
    });
  }

  // ---------- صفحة اللعبة ----------
  function home() {
    $("hb-search").value = "";
    A().loadMembers().then(renderPeople).catch(function () {});
    hs.myOpen = null;
    refreshHome(true);
    clearInterval(hs.homeTimer);
    hs.homeTimer = setInterval(function () {
      if (location.hash !== "#houses") { clearInterval(hs.homeTimer); return; }
      if (!document.hidden) refreshHome(false);
    }, 8000);
  }
  function refreshHome(firstLoad) {
    return A().loadMembers().catch(function () {}).then(function () { return A().rpc("a9_house_list", { p_token: A().getToken() }); }).then(function (d) {
      if (location.hash !== "#houses") return;
      if (!firstLoad && hs.myOpen && !d.my_open) {
        var g0 = (d.games || []).filter(function (g) { return g.status === "active"; })[0];
        hs.myOpen = null;
        if (g0) { location.hash = "house/" + g0.id; return; }
      }
      hs.myOpen = d.my_open || null;
      $("hb-stats").innerHTML = "<div><b>" + d.wins + "</b><span>فوز</span></div><div><b>" + d.losses + "</b><span>خسارة</span></div>";
      var st = A().state;
      var mine = d.my_open
        ? '<div class="xo-game hot">' + A().avatar(st.me || { name: "" }) + '<div class="ainfo"><b>مباراتك مفتوحة</b><span class="note">بانتظار أي طالب يدخل يلعب ضدك</span></div>' +
          '<button type="button" class="cbtn leave" data-hopencancel="' + d.my_open + '">إلغاء</button></div>'
        : '<div class="xo-game"><div class="ainfo"><b>سوّي مباراة مفتوحة</b></div><button type="button" class="cbtn join" data-hopencreate="1">سوّي</button></div>';
      var others = (d.open || []).map(function (o) {
        var c = o.creator;
        return '<div class="xo-game">' + A().avatar(A().memberById(c.id) || c) + '<div class="ainfo"><b>' + esc(c.name) + '</b><span class="note">يدور خصم</span></div>' +
          '<button type="button" class="cbtn join" data-hopenjoin="' + o.id + '">العب ضده</button></div>';
      }).join("");
      $("hb-open").innerHTML = mine + others;
      var games = d.games || [];
      $("hb-games").innerHTML = games.length ? games.map(function (g) {
        var op = g.opponent || { name: "" }, s, cls = "";
        if (g.status === "pending") { s = g.incoming ? "يتحداك" : "بانتظار قبوله"; cls = g.incoming ? " hot" : ""; }
        else if (g.status === "active") { s = g.turn === g.me ? "دورك" : "دوره"; cls = g.turn === g.me ? " hot" : ""; }
        else if (g.status === "done") s = g.winner === g.me ? "فزت" : "خسرت";
        else s = g.status === "declined" ? "رفض التحدي" : "انلغت، ما صار لعب نص ساعة";
        var btns = g.incoming ? '<button type="button" class="cbtn join" data-haccept="' + g.id + '">قبول</button><button type="button" class="cbtn leave" data-hdecline="' + g.id + '">رفض</button>'
                              : '<a class="cbtn join" href="#house/' + g.id + '">' + (g.status === "active" ? "العب" : "فتح") + "</a>";
        return '<div class="xo-game' + cls + '">' + A().avatar(A().memberById(op.id) || op) + '<div class="ainfo"><b>' + esc(op.name) + '</b><span class="note">' + s + "</span></div>" + btns + "</div>";
      }).join("") : '<p class="note center-text" style="padding:16px">ماكو تحديات. اختار طالب من تحت وتحداه.</p>';
    }).catch(function () { if (firstLoad) $("hb-games").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب التحديات.</p>'; });
  }
  function renderPeople() {
    var q = $("hb-search").value.trim(), st = A().state;
    var list = (st.members || []).filter(function (m) { return (!st.me || m.id !== st.me.id) && m.joined && (!q || m.name.indexOf(q) !== -1); });
    $("hb-people").innerHTML = list.map(function (m) {
      return '<div class="cmember xo-person">' + A().avatar(m) + '<span class="nm">' + esc(m.name) + '</span><button type="button" class="cbtn join" data-hchallenge="' + m.id + '">تحدي</button></div>';
    }).join("") || '<p class="note center-text" style="padding:16px">ماكو اسم بهذا البحث</p>';
  }
  function respond(id, accept) {
    A().rpc("a9_house_respond", { p_token: A().getToken(), p_game: id, p_accept: accept }).then(function () {
      if (accept) { if (location.hash === "#house/" + id) online(id); else location.hash = "house/" + id; }
      else if (location.hash === "#houses") refreshHome(true); else online(id);
    });
  }

  function onClick(e) {
    var line = e.target.closest("[data-line]");
    if (line) { play(Number(line.dataset.line)); return; }
    var b = e.target.closest("button, a"); if (!b) return;
    var d = b.dataset, tk = A().getToken();
    if (d.hmode) { location.hash = "houseplay/" + d.hmode; return; }
    if (d.hb === "again") { clearTimeout(hs.ai); return local(hs.mode); }
    if (d.hb === "accept") return respond(hs.g.id, true);
    if (d.hb === "decline") return respond(hs.g.id, false);
    if (d.hb === "rematch") {
      A().rpc("a9_house_rematch", { p_token: tk, p_game: hs.g.id }).then(function (r) { if (r && r.ok) location.hash = "house/" + r.id; });
      return;
    }
    if (d.hchallenge) {
      A().loading(true);
      A().rpc("a9_house_challenge", { p_token: tk, p_opponent: Number(d.hchallenge) }).then(function (r) {
        A().loading(false); if (r && r.ok) location.hash = "house/" + r.id; else alert("ما گدرنا نرسل التحدي.");
      }).catch(function () { A().loading(false); });
      return;
    }
    if (d.haccept) return respond(Number(d.haccept), true);
    if (d.hdecline) return respond(Number(d.hdecline), false);
    if (d.hopencreate) {
      A().loading(true);
      A().rpc("a9_house_open_create", { p_token: tk }).then(function () { A().loading(false); return refreshHome(true); }).catch(function () { A().loading(false); });
      return;
    }
    if (d.hopencancel) {
      hs.myOpen = null;
      A().rpc("a9_house_open_cancel", { p_token: tk, p_open: Number(d.hopencancel) }).then(function () { return refreshHome(true); });
      return;
    }
    if (d.hopenjoin) {
      A().loading(true);
      A().rpc("a9_house_open_join", { p_token: tk, p_open: Number(d.hopenjoin) }).then(function (r) {
        A().loading(false);
        if (r && r.ok) location.hash = "house/" + r.id;
        else { alert("سبقك أحد، أو صاحبها لغاها."); refreshHome(true); }
      }).catch(function () { A().loading(false); });
    }
  }

  function stop() { stopPoll(); clearTimeout(hs.ai); clearInterval(hs.homeTimer); }

  // ---------- الإدارة: صور الأماكن ----------
  function squareJpeg(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var s = Math.min(im.width, im.height), c = document.createElement("canvas"); c.width = c.height = 420;
          c.getContext("2d").drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 420, 420);
          res(c.toDataURL("image/jpeg", 0.8));
        };
        im.onerror = rej; im.src = fr.result;
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  function adminMsg(t) { var el = $("hp-admin-msg"); if (!el) return; el.hidden = !t; el.textContent = t || ""; }
  function admin() {
    var box = $("hp-admin-list"); if (!box) return;
    A().rpc("a9_admin_house_places", { p_token: A().getToken() }).then(function (rows) {
      rows = rows || [];
      placeIds = rows.map(function (r) { return r.id; });
      $("hp-count").textContent = rows.length + " مكان";
      box.innerHTML = rows.length ? rows.map(function (p) {
        return '<div class="hp-item"><img alt="" data-hpimg="' + p.id + '" /><span class="nm">' + esc(p.name) + "</span>" +
          '<button type="button" class="cbtn" data-hprename="' + p.id + '" data-name="' + esc(p.name) + '">تعديل</button>' +
          '<button type="button" class="cbtn leave" data-hpdel="' + p.id + '">شيل</button></div>';
      }).join("") : '<p class="note">ماكو أماكن بعد. اكتب اسم المكان واختار صورته.</p>';
      loadPlaces(placeIds).then(function () {
        rows.forEach(function (p) { var im = document.querySelector('img[data-hpimg="' + p.id + '"]'); if (im && photos[p.id]) im.src = photos[p.id].photo; });
      });
    }).catch(function () {});
  }
  function onAdminFile(e) {
    var f = e.target.files && e.target.files[0]; e.target.value = "";
    var name = $("hp-name").value.trim();
    if (!f) return;
    if (!name) { adminMsg("اكتب اسم المكان أول."); return; }
    A().loading(true);
    squareJpeg(f).then(function (data) {
      return A().rpc("a9_admin_house_place_add", { p_token: A().getToken(), p_name: name, p_photo: data });
    }).then(function (r) {
      A().loading(false);
      if (r && r.ok) { $("hp-name").value = ""; adminMsg("انضاف " + name); } else adminMsg("ما گدرنا نحفظ الصورة.");
      admin();
    }).catch(function () { A().loading(false); adminMsg("ما گدرنا نحفظ الصورة."); });
  }
  function onAdminClick(e) {
    var b = e.target.closest("[data-hpdel]");
    if (b) {
      if (!confirm("تشيل هذا المكان من اللعبة؟")) return;
      A().rpc("a9_admin_house_place_remove", { p_token: A().getToken(), p_id: Number(b.dataset.hpdel) }).then(admin);
      return;
    }
    var r = e.target.closest("[data-hprename]");
    if (r) {
      var id = Number(r.dataset.hprename), nm = prompt("اسم المكان", r.dataset.name || "");
      if (!nm || !nm.trim()) return;
      A().rpc("a9_admin_house_place_rename", { p_token: A().getToken(), p_id: id, p_name: nm.trim() }).then(function () {
        if (photos[id]) { photos[id].name = nm.trim(); try { localStorage.setItem(photoKey(id), JSON.stringify(photos[id])); } catch (e2) {} }
        admin();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("houses").addEventListener("click", onClick);
    $("houseplay").addEventListener("click", onClick);
    $("hb-search").addEventListener("input", renderPeople);
    var f = $("hp-file"); if (f) f.addEventListener("change", onAdminFile);
    var l = $("hp-admin-list"); if (l) l.addEventListener("click", onAdminClick);
  });

  window.A9H = { home: home, online: online, local: local, stop: stop, admin: admin, _rules: { applyLine: applyLine, sides: sides, boxLines: boxLines } };
})();
