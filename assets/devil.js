// لعبة الانتقام من الشيطان: تختار شيطان (طالب بصورته)، وترميه بالحجارة بالمقلاع 30 ثانية.
// الصور بالقاعدة (private.devils) وتنحفظ بالموبايل حسب رقم النسخة.
(function () {
  "use strict";

  function A() { return window.A9; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return A().esc(s); }

  var ROUND = 30;
  var dv = { list: [], cur: null, img: null, raf: 0, game: null };

  // ---------- الصور ----------
  function photoGet(d) {
    try { var c = JSON.parse(localStorage.getItem("a9:dv:" + d.id) || "null"); if (c && String(c.v) === String(d.photo_v)) return Promise.resolve(c.data); } catch (e) {}
    return A().rpc("a9_devil_photo", { p_token: A().getToken(), p_id: d.id }).then(function (r) {
      if (!r || !r.photo) return null;
      try { localStorage.setItem("a9:dv:" + d.id, JSON.stringify({ v: r.photo_v, data: r.photo })); } catch (e) {}
      return r.photo;
    });
  }
  function first(name) { return (name || "").split(" ")[0]; }

  // ---------- صفحة اللعبة ----------
  function home() {
    $("dv-list").innerHTML = '<p class="note center-text" style="padding:16px">لحظة...</p>';
    A().rpc("a9_devils", { p_token: A().getToken() }).then(function (rows) {
      dv.list = rows || [];
      if (!dv.list.length) { $("dv-list").innerHTML = '<p class="note center-text" style="padding:16px">ماكو شياطين بعد.</p>'; return; }
      $("dv-list").innerHTML = dv.list.map(function (d) {
        return '<a class="dv-card" href="#devilplay/' + d.id + '"><span class="dv-face"><i class="dv-horn l"></i><i class="dv-horn r"></i><img alt="" data-dv="' + d.id + '" /></span>' +
          "<b>" + esc(first(d.name)) + '</b><span class="note">أحسن نتيجة لك: ' + d.my_best + '</span><span class="note">انضرب ' + d.hits + " حجارة</span></a>";
      }).join("");
      dv.list.forEach(function (d) {
        photoGet(d).then(function (src) { var im = document.querySelector('img[data-dv="' + d.id + '"]'); if (im && src) im.src = src; }).catch(function () {});
      });
    }).catch(function () { $("dv-list").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب الشياطين.</p>'; });
  }

  // ---------- اللعب ----------
  function play(id) {
    stop();
    $("dv-over").innerHTML = ""; $("dv-over").hidden = true;
    var go = function () {
      var d = dv.list.filter(function (x) { return x.id === id; })[0];
      if (!d) { $("dv-title").textContent = "ما لگينا الشيطان"; return; }
      dv.cur = d; $("dv-title").textContent = "الانتقام من " + first(d.name);
      setupCanvas();
      dv.img = null;
      photoGet(d).then(function (src) { if (!src) return; var im = new Image(); im.onload = function () { dv.img = im; if (dv.game && !dv.game.running) draw(); }; im.src = src; });
      newGame(); draw();
      overlay('<button type="button" class="btn dv-start" data-dv-act="start">ابدي</button>');
    };
    if (dv.list.length) go();
    else A().rpc("a9_devils", { p_token: A().getToken() }).then(function (r) { dv.list = r || []; go(); });
  }

  var cv, ctx, W, H;
  function setupCanvas() {
    cv = $("dv-canvas"); ctx = cv.getContext("2d");
    var w = Math.min(cv.parentElement.clientWidth, 440), h = Math.round(w * 1.3), dpr = window.devicePixelRatio || 1;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = w; H = h;
  }

  function newGame() {
    var R = W * 0.12;
    dv.game = {
      running: false, t: 0, hits: 0, last: 0,
      d: { x: W / 2, y: H * 0.28, vx: W * 0.3, vy: W * 0.12, R: R, turn: 0.8, shake: 0, ouch: 0, sad: 0, ouchSide: 1, dodged: {} },
      stones: [], parts: [],
      sling: { x: W / 2, y: H - 64 }, pull: null, nextId: 1
    };
  }

  function start() {
    $("dv-over").hidden = true;
    newGame(); dv.game.running = true; dv.game.last = performance.now();
    cancelAnimationFrame(dv.raf); dv.raf = requestAnimationFrame(loop);
  }

  function loop(now) {
    var g = dv.game; if (!g || !g.running) return;
    var dt = Math.min(0.05, (now - g.last) / 1000); g.last = now;
    g.t += dt;
    update(g, dt);
    draw();
    $("dv-hits").textContent = g.hits;
    $("dv-time").style.width = Math.max(0, 100 - (g.t / ROUND) * 100) + "%";
    if (g.t >= ROUND) return finish();
    dv.raf = requestAnimationFrame(loop);
  }

  function update(g, dt) {
    var d = g.d, speedK = 1 + g.t / ROUND * 1.4;  // يصير أسرع ويه الوقت
    d.turn -= dt;
    if (d.turn <= 0) {
      var a = Math.random() * Math.PI * 2, sp = W * (0.22 + Math.random() * 0.18);
      d.vx = Math.cos(a) * sp; d.vy = Math.sin(a) * sp * 0.6;
      d.turn = 0.5 + Math.random() * 0.9;
    }
    d.x += d.vx * speedK * dt; d.y += d.vy * speedK * dt;
    var minX = d.R + 8, maxX = W - d.R - 8, minY = d.R * 1.6, maxY = H * 0.55;
    if (d.x < minX) { d.x = minX; d.vx = Math.abs(d.vx); }
    if (d.x > maxX) { d.x = maxX; d.vx = -Math.abs(d.vx); }
    if (d.y < minY) { d.y = minY; d.vy = Math.abs(d.vy); }
    if (d.y > maxY) { d.y = maxY; d.vy = -Math.abs(d.vy); }
    d.shake = Math.max(0, d.shake - dt); d.ouch = Math.max(0, d.ouch - dt); d.sad = Math.max(0, d.sad - dt);

    var grav = H * 0.55;
    g.stones = g.stones.filter(function (s) {
      s.vy += grav * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += dt * 8;
      // يتهرب أحياناً من الحجارة القريبة
      var dx = d.x - s.x, dy = d.y - s.y, dist = Math.hypot(dx, dy);
      if (!d.dodged[s.id] && dist < d.R * 3.2 && s.vy < 0) {
        d.dodged[s.id] = 1;
        if (Math.random() < 0.18 + g.t / ROUND * 0.22) { d.vx = (dx >= 0 ? 1 : -1) * W * 0.9; d.turn = 0.25; }
      }
      var hitHead = Math.hypot(s.x - d.x, s.y - d.y) < d.R + s.r;
      var hitBody = Math.hypot(s.x - d.x, s.y - (d.y + d.R * 1.25)) < d.R * 0.75 + s.r;
      if (hitHead || hitBody) { hit(g, s); return false; }
      return s.y < H + 40 && s.x > -40 && s.x < W + 40 && s.y > -80;
    });
    g.parts = g.parts.filter(function (p) { p.vy += grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; return p.life > 0; });
  }

  function hit(g, s) {
    var d = g.d;
    g.hits++;
    d.shake = 0.35; d.ouch = 0.75; d.sad = 1.8; d.ouchSide = s.x < d.x ? 1 : -1;
    for (var i = 0; i < 8; i++) {
      var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140;
      g.parts.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.5 + Math.random() * 0.3 });
    }
    if (navigator.vibrate) try { navigator.vibrate(25); } catch (e) {}
  }

  // ---------- الرسم ----------
  function draw() {
    if (!ctx || !dv.game) return;
    var g = dv.game, d = g.d;
    ctx.clearRect(0, 0, W, H);
    // الأرض
    var grd = ctx.createLinearGradient(0, H * 0.62, 0, H);
    grd.addColorStop(0, "rgba(120, 53, 15, 0)"); grd.addColorStop(1, "rgba(120, 53, 15, .18)");
    ctx.fillStyle = grd; ctx.fillRect(0, H * 0.62, W, H * 0.38);

    drawDevil(d, g.t);

    // الحجارة والشظايا
    g.stones.forEach(function (s) { drawStone(s.x, s.y, s.r, s.rot); });
    g.parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.life * 1.6); ctx.fillStyle = "#78716c"; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); ctx.globalAlpha = 1; });

    drawSling(g);
  }

  function drawDevil(d, t) {
    var sx = d.shake ? Math.sin(t * 90) * 6 : 0, R = d.R, x = d.x + sx, y = d.y;
    ctx.save();
    // الذيل
    ctx.strokeStyle = "#b91c1c"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x + R * 0.5, y + R * 1.6);
    var wag = Math.sin(t * 6) * R * 0.3;
    ctx.bezierCurveTo(x + R * 1.4, y + R * 2.0, x + R * 1.5 + wag, y + R * 0.9, x + R * 1.25 + wag, y + R * 0.55);
    ctx.stroke();
    ctx.fillStyle = "#b91c1c"; ctx.beginPath();
    ctx.moveTo(x + R * 1.25 + wag, y + R * 0.35); ctx.lineTo(x + R * 1.05 + wag, y + R * 0.65); ctx.lineTo(x + R * 1.45 + wag, y + R * 0.65); ctx.closePath(); ctx.fill();
    // الشوكة
    ctx.strokeStyle = "#57534e"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - R * 1.15, y + R * 2.1); ctx.lineTo(x - R * 1.15, y + R * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - R * 1.45, y + R * 0.45); ctx.lineTo(x - R * 1.45, y + R * 0.1);
    ctx.moveTo(x - R * 0.85, y + R * 0.45); ctx.lineTo(x - R * 0.85, y + R * 0.1);
    ctx.moveTo(x - R * 1.45, y + R * 0.45); ctx.lineTo(x - R * 0.85, y + R * 0.45);
    ctx.moveTo(x - R * 1.15, y + R * 0.45); ctx.lineTo(x - R * 1.15, y - R * 0.05); ctx.stroke();
    // الجسم
    var bg = ctx.createLinearGradient(0, y + R * 0.5, 0, y + R * 2.1);
    bg.addColorStop(0, "#ef4444"); bg.addColorStop(1, "#991b1b");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(x, y + R * 1.3, R * 0.78, R * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    // الإيد اللي ماسكة الشوكة
    ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x - R * 0.6, y + R * 1.1); ctx.lineTo(x - R * 1.1, y + R * 1.3); ctx.stroke();
    // القرون
    [-1, 1].forEach(function (k) {
      ctx.fillStyle = "#7f1d1d"; ctx.beginPath();
      ctx.moveTo(x + k * R * 0.35, y - R * 0.8);
      ctx.quadraticCurveTo(x + k * R * 0.95, y - R * 1.2, x + k * R * 0.85, y - R * 1.75);
      ctx.quadraticCurveTo(x + k * R * 0.65, y - R * 1.15, x + k * R * 0.75, y - R * 0.55);
      ctx.closePath(); ctx.fill();
    });
    // الوجه: مقصوص (بيضاوي بدون خلفية) أو دائري
    var face = (dv.cur && dv.cur.face) || null, img = dv.img;
    var sadK = Math.min(1, d.sad * 1.6);
    if (img && face && face.cut) {
      var hw = R * 2.3, hh = hw * img.height / img.width, hx = x - hw / 2, hy = y - hh * 0.55;
      ctx.drawImage(img, hx, hy, hw, hh);
      if (d.ouch > 0.45) { ctx.save(); ctx.beginPath(); ctx.ellipse(x, hy + hh / 2, hw * 0.46, hh * 0.47, 0, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = "rgba(220, 38, 38, .25)"; ctx.fillRect(hx, hy, hw, hh); ctx.restore(); }
      if (sadK > 0) drawSad(img, face, hx, hy, hw, hh, sadK, t);
      ctx.restore();
    } else {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
      var bx0 = x - R, by0 = y - R, bs = R * 2;
      if (img) {
        var iw = img.width, ih = img.height, sc = Math.max(bs / iw, bs / ih), dw = iw * sc, dh = ih * sc;
        ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
        bx0 = x - dw / 2; by0 = y - dh / 2;
        if (sadK > 0) drawSad(img, face || DEF_FACE, bx0, by0, dw, dh, sadK, t);
      } else { ctx.fillStyle = "#fecaca"; ctx.fillRect(x - R, y - R, bs, bs); }
      if (d.ouch > 0.45) { ctx.fillStyle = "rgba(220, 38, 38, .3)"; ctx.fillRect(x - R, y - R, bs, bs); }
      ctx.restore();
      ctx.strokeStyle = "#b91c1c"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // آخ!
    if (d.ouch > 0) {
      var bx = x + d.ouchSide * R * 1.35, by = y - R * 1.15, a = Math.min(1, d.ouch * 3);
      ctx.save(); ctx.globalAlpha = a;
      ctx.font = "800 " + Math.round(R * 0.62) + "px Almarai, system-ui, sans-serif";
      var tw = ctx.measureText("آخ!").width + 18, th = R * 0.9;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2.5;
      roundRect(bx - tw / 2, by - th / 2, tw, th, 12); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - d.ouchSide * 6, by + th / 2 - 1); ctx.lineTo(bx - d.ouchSide * 18, by + th / 2 + 12); ctx.lineTo(bx + d.ouchSide * 4, by + th / 2 - 1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#dc2626"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("آخ!", bx, by + 1);
      ctx.restore();
    }
  }
  // الوجه الحزين: الحلگ ينقلب، حواجب حزينة، ودموع
  var DEF_FACE = { e1: [0.36, 0.45], e2: [0.64, 0.45], m: [0.5, 0.72], mw: 0.3, mh: 0.1 };
  function drawSad(img, f, x, y, w, h, k, t) {
    var iw = img.width, ih = img.height;
    // الحلگ مقلوب = زعلان
    var mw = f.mw * w, mh = f.mh * h, mx = x + f.m[0] * w, my = y + f.m[1] * h;
    ctx.save(); ctx.globalAlpha = k;
    ctx.beginPath(); ctx.ellipse(mx, my, mw / 2, mh / 2, 0, 0, Math.PI * 2); ctx.clip();
    ctx.translate(mx, my); ctx.scale(1, -1);
    ctx.drawImage(img, (f.m[0] - f.mw / 2) * iw, (f.m[1] - f.mh / 2) * ih, f.mw * iw, f.mh * ih, -mw / 2, -mh / 2, mw, mh);
    ctx.restore();
    // الحواجب والدموع
    var eyes = [f.e1, f.e2], L = w * 0.11, lw = Math.max(2, w * 0.028);
    ctx.save(); ctx.globalAlpha = k; ctx.lineCap = "round";
    eyes.forEach(function (e, i) {
      var ex = x + e[0] * w, ey = y + e[1] * h, inner = i === 0 ? 1 : -1;
      ctx.strokeStyle = "#1c1917"; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(ex - inner * L * 0.75, ey - h * 0.06); ctx.lineTo(ex + inner * L * 0.55, ey - h * 0.11); ctx.stroke();
      for (var j = 0; j < 2; j++) {
        var ph = (t * 1.4 + j * 0.5 + i * 0.25) % 1, tx = ex + inner * w * 0.01, ty = ey + h * 0.04 + ph * h * 0.22, r = w * 0.03;
        ctx.globalAlpha = k * (1 - ph * 0.6);
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath(); ctx.moveTo(tx, ty - r * 1.6); ctx.quadraticCurveTo(tx + r, ty, tx, ty + r); ctx.quadraticCurveTo(tx - r, ty, tx, ty - r * 1.6); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(tx - r * 0.3, ty, r * 0.25, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = k;
    });
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function drawStone(x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    var gr = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    gr.addColorStop(0, "#d6d3d1"); gr.addColorStop(1, "#57534e");
    ctx.fillStyle = gr; ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(r * 0.5, r * 0.85); ctx.lineTo(-r * 0.6, r * 0.8); ctx.lineTo(-r, 0.1 * r); ctx.lineTo(-r * 0.5, -r * 0.9); ctx.lineTo(r * 0.6, -r * 0.8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawSling(g) {
    var s = g.sling, fork = 26;
    ctx.save();
    ctx.strokeStyle = "#78350f"; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(s.x, s.y + 52); ctx.lineTo(s.x, s.y + 14); ctx.lineTo(s.x - fork, s.y - 14); ctx.moveTo(s.x, s.y + 14); ctx.lineTo(s.x + fork, s.y - 14); ctx.stroke();
    var px = s.x, py = s.y - 8;
    if (g.pull) { px = s.x - g.pull.dx; py = s.y - 8 - g.pull.dy; }
    ctx.strokeStyle = "#292524"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(s.x - fork, s.y - 14); ctx.lineTo(px, py); ctx.lineTo(s.x + fork, s.y - 14); ctx.stroke();
    if (g.running) drawStone(px, py, 10, 0);
    // نقاط التصويب
    if (g.pull) {
      var v = launchVel(g.pull), x = px, y = py, vx = v.x, vy = v.y, grav = H * 0.55;
      ctx.fillStyle = "rgba(87, 83, 78, .45)";
      for (var i = 1; i <= 7; i++) { var tt = i * 0.06; ctx.beginPath(); ctx.arc(x + vx * tt, y + vy * tt + 0.5 * grav * tt * tt, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  // ---------- المقلاع ----------
  var MAXP = 110;
  function launchVel(p) { var k = (H * 2.1) / MAXP; return { x: p.dx * k, y: p.dy * k }; }
  function pos(ev) { var r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  function onDown(ev) {
    var g = dv.game; if (!g || !g.running) return;
    var p = pos(ev); if (p.y < H * 0.5) return;
    g.pull = { sx: p.x, sy: p.y, dx: 0, dy: 0, id: ev.pointerId };
    try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
  }
  function onMove(ev) {
    var g = dv.game; if (!g || !g.pull || ev.pointerId !== g.pull.id) return;
    var p = pos(ev), dx = g.pull.sx - p.x, dy = g.pull.sy - p.y, L = Math.hypot(dx, dy);
    if (L > MAXP) { dx *= MAXP / L; dy *= MAXP / L; }
    g.pull.dx = dx; g.pull.dy = dy;
  }
  function onUp(ev) {
    var g = dv.game; if (!g || !g.pull || ev.pointerId !== g.pull.id) return;
    var p = g.pull; g.pull = null;
    if (Math.hypot(p.dx, p.dy) < 18 || p.dy > -10) return; // لازم تسحب لجوه حتى ترمي لفوگ
    var v = launchVel(p);
    g.stones.push({ id: g.nextId++, x: g.sling.x - p.dx, y: g.sling.y - 8 - p.dy, vx: v.x, vy: v.y, r: 10, rot: 0 });
  }

  // ---------- النهاية ----------
  function finish() {
    var g = dv.game; g.running = false; g.pull = null; draw();
    var d = dv.cur;
    overlay('<div class="dv-result"><b class="dv-big">' + g.hits + '</b><span>حجارة صابت ' + esc(first(d.name)) + '</span><p class="note" id="dv-rank">لحظة...</p>' +
      '<button type="button" class="btn" data-dv-act="start">مرة ثانية</button><div id="dv-board" class="dv-board"></div></div>');
    A().rpc("a9_devil_score", { p_token: A().getToken(), p_id: d.id, p_hits: g.hits }).then(function (r) {
      if (r && r.ok) { $("dv-rank").textContent = (r.record ? "رقم جديد! " : "أحسن نتيجة لك: " + r.best + " · ") + "ترتيبك " + r.rank; d.my_best = r.best; }
      else $("dv-rank").textContent = "";
      return A().rpc("a9_devil_board", { p_token: A().getToken(), p_id: d.id });
    }).then(function (rows) {
      var me = A().state.me && A().state.me.id;
      $("dv-board").innerHTML = (rows || []).length ? '<h3>أكثر المنتقمين</h3>' + rows.map(function (x, i) {
        return '<div class="dv-row' + (x.id === me ? " me" : "") + '"><span>' + (i + 1) + "</span><b>" + esc(x.name) + "</b><span>" + x.best + "</span></div>";
      }).join("") : "";
    }).catch(function () {});
  }
  function overlay(html) { var o = $("dv-over"); o.innerHTML = html; o.hidden = false; }

  function stop() { cancelAnimationFrame(dv.raf); if (dv.game) { dv.game.running = false; dv.game.pull = null; } }

  // ---------- الممثل: إضافة الشياطين ----------
  function adminRender() {
    var box = $("dv-admin-list"); if (!box) return;
    A().rpc("a9_devils", { p_token: A().getToken() }).then(function (rows) {
      dv.list = rows || [];
      box.innerHTML = dv.list.length ? dv.list.map(function (d) {
        return '<div class="cmember"><span class="avatar has-img"><img alt="" data-dva="' + d.id + '" /></span><span class="nm">' + esc(d.name) +
          '</span><button type="button" class="cbtn leave" data-dvdel="' + d.id + '">شيل</button></div>';
      }).join("") : '<p class="note">ماكو شياطين بعد.</p>';
      dv.list.forEach(function (d) { photoGet(d).then(function (src) { var im = document.querySelector('img[data-dva="' + d.id + '"]'); if (im && src) im.src = src; }); });
    }).catch(function () {});
    A().loadMembers().then(function (all) {
      $("dv-student").innerHTML = '<option value="">اختار الطالب</option>' + all.map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + "</option>"; }).join("");
    }).catch(function () {});
  }
  function squareJpeg(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {
          var s = Math.min(im.width, im.height), c = document.createElement("canvas"); c.width = c.height = 320;
          c.getContext("2d").drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 320, 320);
          res(c.toDataURL("image/jpeg", 0.85));
        };
        im.onerror = rej; im.src = fr.result;
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  function adminMsg(t) { var el = $("dv-admin-msg"); el.hidden = !t; el.textContent = t || ""; }
  function onAdminFile(e) {
    var f = e.target.files && e.target.files[0]; e.target.value = "";
    var sid = Number($("dv-student").value);
    if (!f) return;
    if (!sid) { adminMsg("اختار الطالب أول."); return; }
    A().loading(true);
    squareJpeg(f).then(function (data) {
      return A().rpc("a9_admin_devil_set", { p_token: A().getToken(), p_student: sid, p_photo: data });
    }).then(function (r) { A().loading(false); adminMsg(r && r.ok ? "انضاف الشيطان" : "ما گدرنا نحفظ الصورة."); adminRender(); })
      .catch(function () { A().loading(false); adminMsg("ما گدرنا نحفظ الصورة."); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var c = $("dv-canvas");
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", function () { if (dv.game) dv.game.pull = null; });
    $("devilplay").addEventListener("click", function (e) { var b = e.target.closest("[data-dv-act]"); if (b && b.dataset.dvAct === "start") start(); });
    $("dv-file").addEventListener("change", onAdminFile);
    $("dv-admin-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-dvdel]"); if (!b) return;
      A().rpc("a9_admin_devil_remove", { p_token: A().getToken(), p_id: Number(b.dataset.dvdel) }).then(adminRender);
    });
    window.addEventListener("resize", function () { if (location.hash.indexOf("#devilplay/") === 0 && dv.game && !dv.game.running) { setupCanvas(); newGame(); draw(); } });
  });

  window.A9D = { home: home, play: play, stop: stop, admin: adminRender };
})();
