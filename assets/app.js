(function () {
  "use strict";

  var CFG = window.A9_CONFIG;
  var TOKEN_KEY = "a9:token";
  var state = { me: null, students: [], picked: null };

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  function rpc(fn, args) {
    return fetch(CFG.url + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.key },
      body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = txt ? JSON.parse(txt) : null;
        if (!r.ok) { var err = new Error((data && data.message) || "request_failed"); err.data = data; throw err; }
        return data;
      });
    });
  }

  function initials(name) {
    var parts = String(name).split(" ").filter(Boolean);
    return (parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "");
  }
  function avatarHue(id) { return (id * 47) % 360; }
  function avatar(s, extra) {
    return '<span class="avatar' + (extra ? " " + extra : "") + '" style="--h:' + avatarHue(s.id) + '">' + esc(initials(s.name)) + "</span>";
  }

  function loading(on) { $("loading").hidden = !on; }

  function show(id) {
    ["login", "home", "gyn", "admin"].forEach(function (v) { $(v).hidden = v !== id; });
    window.scrollTo(0, 0);
  }

  // ---------- login ----------
  function renderNames() {
    var q = $("name-search").value.trim();
    var html = state.students
      .filter(function (s) { return !q || s.name.indexOf(q) !== -1; })
      .map(function (s) {
        return '<button type="button" class="name" data-id="' + s.id + '">' +
          avatar(s) + '<span class="nm">' + esc(s.name) + "</span>" +
          (s.has_pin ? "" : '<span class="new">جديد</span>') +
          "</button>";
      }).join("");
    $("names").innerHTML = html || '<p class="sub center-text">ماكو اسم بهذا البحث</p>';
  }

  function loadStudents() {
    loading(true);
    return rpc("a9_list_students").then(function (rows) {
      state.students = rows || [];
      renderNames();
    }).catch(function () {
      $("names").innerHTML = '<p class="error">ما گدرنا نجيب الأسماء، تأكد من الإنترنت وحدّث الصفحة.</p>';
    }).then(function () { loading(false); });
  }

  function pickStudent(id) {
    var s = state.students.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    state.picked = s;
    $("login-pick").hidden = true;
    $("login-pin").hidden = false;
    $("pin-name").textContent = s.name;
    $("pin-avatar").textContent = initials(s.name);
    $("pin-avatar").style.setProperty("--h", avatarHue(s.id));
    $("pin-error").hidden = true;
    $("pin1").value = ""; $("pin2").value = "";
    var first = !s.has_pin;
    $("pin-hint").textContent = first
      ? "أول مرة تدخل. اختار رقم سري من 4 أرقام، وتذكره لأنك راح تحتاجه كل مرة."
      : "اكتب رقمك السري (4 أرقام)";
    $("pin2-wrap").hidden = !first;
    $("pin2").required = first;
    $("pin-submit").textContent = first ? "حفظ الرقم والدخول" : "دخول";
    setTimeout(function () { $("pin1").focus(); }, 50);
  }

  function backToNames() {
    state.picked = null;
    $("login-pin").hidden = true;
    $("login-pick").hidden = false;
  }

  function pinError(msg) { $("pin-error").textContent = msg; $("pin-error").hidden = false; }

  function submitPin(e) {
    e.preventDefault();
    var s = state.picked; if (!s) return;
    var p1 = $("pin1").value.trim(), p2 = $("pin2").value.trim();
    if (!/^[0-9]{4}$/.test(p1)) return pinError("الرقم السري لازم يكون 4 أرقام بالضبط.");
    var first = !s.has_pin;
    if (first && p1 !== p2) return pinError("الرقمين مو نفس الشي، اكتبهم مرة ثانية.");

    loading(true);
    rpc(first ? "a9_set_pin" : "a9_login", { p_id: s.id, p_pin: p1 }).then(function (res) {
      loading(false);
      if (res && res.ok) {
        setToken(res.token);
        state.me = { id: res.id, name: res.name, is_admin: res.is_admin };
        afterLogin();
        return;
      }
      var err = res && res.error;
      if (err === "wrong_pin") pinError("الرقم غلط. باقيلك " + res.left + " محاولات قبل ما ينقفل الحساب 15 دقيقة.");
      else if (err === "locked") pinError("الحساب مقفول مؤقتاً. جرب بعد " + res.minutes + " دقيقة.");
      else if (err === "already_set") { pinError("هذا الاسم صار عنده رقم سري. إذا مو إنت، راجع المسؤول."); s.has_pin = true; }
      else if (err === "no_pin") { s.has_pin = false; pickStudent(s.id); }
      else pinError("صار خطأ، جرب مرة ثانية.");
    }).catch(function () { loading(false); pinError("ما گدرنا نتصل، تأكد من الإنترنت."); });
  }

  // ---------- session ----------
  function afterLogin() {
    $("user-box").hidden = false;
    $("user-name").textContent = state.me.name.split(" ")[0];
    $("admin-link").hidden = !state.me.is_admin;
    backToNames();
    route();
  }

  function logout() {
    var t = getToken();
    setToken(null);
    state.me = null;
    $("user-box").hidden = true;
    if (t) rpc("a9_logout", { p_token: t }).catch(function () {});
    location.hash = "";
    showLogin();
  }

  function showLogin() {
    show("login");
    backToNames();
    $("name-search").value = "";
    loadStudents();
  }

  // ---------- admin ----------
  function fmtDate(iso) {
    if (!iso) return "ما دخل بعد";
    var d = new Date(iso);
    return d.toLocaleDateString("ar-IQ", { day: "numeric", month: "long" }) + " " +
      d.toLocaleTimeString("ar-IQ", { hour: "numeric", minute: "2-digit" });
  }

  function loadAdmin() {
    loading(true);
    rpc("a9_admin_students", { p_token: getToken() }).then(function (rows) {
      loading(false);
      var done = rows.filter(function (r) { return r.has_pin; }).length;
      $("admin-summary").textContent = "سجّل " + done + " من " + rows.length + " طالب";
      $("admin-bar").style.width = Math.round((done / rows.length) * 100) + "%";
      $("admin-list").innerHTML = rows.map(function (r) {
        return '<div class="arow">' +
          avatar(r) +
          '<div class="ainfo"><div class="aname">' + esc(r.name) + (r.is_admin ? ' <span class="tag special">مسؤول</span>' : "") + "</div>" +
          '<div class="note">' + (r.has_pin ? "آخر دخول: " + fmtDate(r.last_login) : "ما سجّل بعد") + (r.locked ? " &middot; مقفول مؤقتاً" : "") + "</div></div>" +
          '<span class="tag ' + (r.has_pin ? "preg" : "cons") + '">' + (r.has_pin ? "مسجّل" : "ما سجّل") + "</span>" +
          (r.has_pin && !r.is_admin ? '<button type="button" class="small-btn" data-reset="' + r.id + '" data-name="' + esc(r.name) + '">تصفير الرقم</button>' : '<span class="small-spacer"></span>') +
          "</div>";
      }).join("");
    }).catch(function () {
      loading(false);
      $("admin-list").innerHTML = '<p class="error" style="padding:16px">ما عندك صلاحية، أو صار خطأ بالاتصال.</p>';
    });
  }

  function resetPin(id, name) {
    if (!confirm("تصفير الرقم السري لـ " + name + "؟\nراح يطلع من حسابه، ومن يدخل مرة ثانية يختار رقم جديد.")) return;
    loading(true);
    rpc("a9_admin_reset_pin", { p_token: getToken(), p_student: id }).then(function (res) {
      loading(false);
      if (!res || !res.ok) alert("ما صار التصفير.");
      loadAdmin();
    }).catch(function () { loading(false); alert("صار خطأ بالاتصال."); });
  }

  // ---------- routing ----------
  function route() {
    if (!state.me) return showLogin();
    var h = location.hash.replace("#", "");
    if (h === "gyn") { show("gyn"); window.A9_renderGyn(); }
    else if (h === "admin" && state.me.is_admin) { show("admin"); loadAdmin(); }
    else { show("home"); renderHome(); }
  }

  function renderHome() {
    var h = new Date().getHours();
    var greet = h < 12 ? "صباح الخير" : h < 18 ? "هلا" : "مساء الخير";
    $("hello-name").textContent = greet + " " + state.me.name.split(" ")[0];
    $("hello-date").textContent = new Date().toLocaleDateString("ar-IQ", { weekday: "long", day: "numeric", month: "long" });
    var s = window.A9_gynSummary();
    $("rot-bar").style.width = Math.round((s.done / s.total) * 100) + "%";
    $("rot-count").textContent = "خلصت " + s.done + " من " + s.total + " سشن";
    $("rot-next").innerHTML = s.next
      ? '<span class="rot-label">' + (s.next.when === "اليوم" ? "اليوم" : "الجاي: " + esc(s.next.when)) + "</span>" +
        '<span class="rot-place">' + esc(s.next.place) + (s.next.time ? " &middot; " + esc(s.next.time) : "") + "</span>"
      : '<span class="rot-label">خلصت الروتة</span>';
  }

  // ---------- events ----------
  $("name-search").addEventListener("input", renderNames);
  $("names").addEventListener("click", function (e) {
    var b = e.target.closest(".name"); if (b) pickStudent(Number(b.dataset.id));
  });
  $("pin-back").addEventListener("click", backToNames);
  $("login-pin").addEventListener("submit", submitPin);
  $("logout").addEventListener("click", logout);
  $("admin-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-reset]"); if (b) resetPin(Number(b.dataset.reset), b.dataset.name);
  });
  window.addEventListener("hashchange", route);

  // ---------- start ----------
  var t = getToken();
  if (!t) { showLogin(); return; }
  loading(true);
  rpc("a9_me", { p_token: t }).then(function (me) {
    loading(false);
    if (me && me.id) { state.me = me; afterLogin(); }
    else { setToken(null); showLogin(); }
  }).catch(function () { loading(false); setToken(null); showLogin(); });
})();
