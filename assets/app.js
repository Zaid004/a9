(function () {
  "use strict";

  var CFG = window.A9_CONFIG;
  var TOKEN_KEY = "a9:token";
  var state = { me: null, students: [], picked: null, reps: {}, members: null };

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
    var cls = "avatar" + (extra ? " " + extra : "");
    if (s.avatar) return '<span class="' + cls + ' has-img"><img src="' + esc(s.avatar) + '" alt="" /></span>';
    return '<span class="' + cls + '" style="--h:' + avatarHue(s.id) + '">' + esc(initials(s.name)) + "</span>";
  }
  function paintAvatar(el, s) {
    el.style.setProperty("--h", avatarHue(s.id));
    el.classList.toggle("has-img", !!s.avatar);
    el.innerHTML = s.avatar ? '<img src="' + esc(s.avatar) + '" alt="" />' : esc(initials(s.name));
  }

  function loading(on) { $("loading").hidden = !on; }

  function show(id) {
    ["login", "home", "gyn", "admin", "me"].forEach(function (v) { var el = $(v); if (el) el.hidden = v !== id; });
    window.scrollTo(0, 0);
  }

  // ---------- login ----------
  function renderNames() {
    var q = $("name-search").value.trim();
    var list = state.students
      .filter(function (s) { return !q || s.name.indexOf(q) !== -1; })
      .slice()
      .sort(function (a, b) { return (state.reps[b.id] ? 1 : 0) - (state.reps[a.id] ? 1 : 0); });
    var html = list.map(function (s) {
        var rep = !!state.reps[s.id];
        return '<button type="button" class="name' + (rep ? " rep" : "") + '" data-id="' + s.id + '">' +
          avatar(s) + '<span class="nm">' + esc(s.name) + "</span>" +
          (rep ? '<span class="tag gold">الممثل</span>' : "") +
          (s.has_pin ? "" : '<span class="new">جديد</span>') +
          "</button>";
      }).join("");
    $("names").innerHTML = html || '<p class="sub center-text">ماكو اسم بهذا البحث</p>';
  }

  function loadStudents() {
    loading(true);
    var reps = rpc("a9_representatives").then(function (rows) {
      state.reps = {};
      (rows || []).forEach(function (r) { state.reps[r.id] = true; });
    }).catch(function () {});
    return Promise.all([rpc("a9_list_students"), reps]).then(function (res) {
      state.students = res[0] || [];
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
        refreshMe();
        return;
      }
      var err = res && res.error;
      if (err === "wrong_pin") pinError("الرقم غلط. باقيلك " + res.left + " محاولات قبل ما ينقفل الحساب 15 دقيقة.");
      else if (err === "locked") pinError("الحساب مقفول مؤقتاً. جرب بعد " + res.minutes + " دقيقة.");
      else if (err === "already_set") { pinError("هذا الاسم صار عنده رقم سري. إذا مو إنت، راجع الممثل."); s.has_pin = true; }
      else if (err === "no_pin") { s.has_pin = false; pickStudent(s.id); }
      else pinError("صار خطأ، جرب مرة ثانية.");
    }).catch(function () { loading(false); pinError("ما گدرنا نتصل، تأكد من الإنترنت."); });
  }

  // ---------- session ----------
  function afterLogin() {
    $("me-btn").hidden = false;
    $("menu-btn").hidden = false;
    paintAvatar($("me-btn"), state.me);
    backToNames();
    route();
  }

  function logout() {
    var t = getToken();
    setToken(null);
    state.me = null; state.members = null;
    $("me-btn").hidden = true;
    $("menu-btn").hidden = true;
    closeDrawer();
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
          '<div class="ainfo"><div class="aname">' + esc(r.name) + (r.is_admin ? ' <span class="tag gold">الممثل</span>' : "") + "</div>" +
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

  // ---------- my account ----------
  function refreshMe() {
    return rpc("a9_me", { p_token: getToken() }).then(function (me) {
      if (me && me.id) { state.me = me; paintAvatar($("me-btn"), me); if (location.hash === "#me") renderMe(); }
    }).catch(function () {});
  }

  function renderMe() {
    var me = state.me;
    paintAvatar($("me-avatar"), me);
    $("me-name").textContent = me.name;
    $("me-badges").innerHTML = me.is_admin ? '<span class="tag gold">الممثل</span>' : '<span class="tag preg">طالب</span>';
    $("me-last").textContent = me.last_login ? fmtDate(me.last_login) : "هسه";
    $("photo-remove").hidden = !me.avatar;
    $("me-admin").hidden = !me.is_admin;
    $("pin-msg").hidden = true;
    $("photo-msg").hidden = true;
  }

  function photoMsg(msg) { $("photo-msg").textContent = msg; $("photo-msg").hidden = !msg; }

  // نصغّر الصورة لمربع 256 بكسل حتى تبقى خفيفة
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var size = 256, side = Math.min(img.width, img.height);
        var c = document.createElement("canvas"); c.width = size; c.height = size;
        c.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
      img.src = url;
    });
  }

  function saveAvatar(data) {
    loading(true);
    return rpc("a9_set_avatar", { p_token: getToken(), p_avatar: data }).then(function (res) {
      loading(false);
      if (res && res.ok) { state.me.avatar = data; state.members = null; renderMe(); paintAvatar($("me-btn"), state.me); photoMsg(data ? "انحفظت الصورة" : "انحذفت الصورة"); }
      else photoMsg("ما گدرنا نحفظ الصورة، جرب صورة ثانية.");
    }).catch(function () { loading(false); photoMsg("صار خطأ بالاتصال."); });
  }

  function onPhoto(e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) return photoMsg("اختار صورة.");
    resizeImage(f).then(saveAvatar).catch(function () { photoMsg("ما گدرنا نقرا الصورة، جرب صورة ثانية."); });
  }

  function onChangePin(e) {
    e.preventDefault();
    var o = $("pin-old").value.trim(), n = $("pin-new").value.trim(), n2 = $("pin-new2").value.trim();
    var msg = $("pin-msg");
    function say(text, ok) { msg.textContent = text; msg.className = ok ? "success" : "error"; msg.hidden = false; }
    if (!/^[0-9]{4}$/.test(n)) return say("الرقم الجديد لازم يكون 4 أرقام.");
    if (n !== n2) return say("الرقمين الجداد مو نفس الشي.");
    loading(true);
    rpc("a9_change_pin", { p_token: getToken(), p_old: o, p_new: n }).then(function (res) {
      loading(false);
      if (res && res.ok) { say("تغيّر الرقم السري.", true); $("pin-form").reset(); }
      else if (res && res.error === "wrong_pin") say("الرقم الحالي غلط.");
      else say("ما تغيّر الرقم، جرب مرة ثانية.");
    }).catch(function () { loading(false); say("صار خطأ بالاتصال."); });
  }

  // ---------- participants ----------
  function loadMembers(force) {
    if (state.members && !force) return Promise.resolve(state.members);
    return rpc("a9_members", { p_token: getToken() }).then(function (rows) { state.members = rows || []; return state.members; });
  }

  function renderMembers() {
    var q = $("members-search").value.trim();
    var all = state.members || [];
    var joined = all.filter(function (m) { return m.joined; }).length;
    $("members-sub").textContent = all.length;
    $("drawer-sub").textContent = all.length + " طالب · سجّل منهم " + joined;
    var rows = all.filter(function (m) { return !q || m.name.indexOf(q) !== -1; });
    $("members-list").innerHTML = rows.map(function (m) {
      return '<button type="button" class="mrow' + (m.is_admin ? " rep" : "") + '" data-member="' + m.id + '">' +
        avatar(m) +
        '<span class="nm">' + esc(m.name) + "</span>" +
        (m.is_admin ? '<span class="tag gold">الممثل</span>' : "") +
        (state.me && m.id === state.me.id ? '<span class="tag special">أنت</span>' : "") +
        "</button>";
    }).join("") || '<p class="sub center-text" style="padding:16px">ماكو اسم بهذا البحث</p>';
  }

  // ---------- side menu ----------
  function openDrawer() {
    document.body.classList.add("drawer-open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("menu-btn").setAttribute("aria-expanded", "true");
    $("drawer-backdrop").hidden = false;
    var h = location.hash.replace("#", "") || "home";
    document.querySelectorAll("[data-nav]").forEach(function (a) { a.classList.toggle("active", a.dataset.nav === h); });
    $("nav-admin").hidden = !(state.me && state.me.is_admin);
    if (state.members) renderMembers();
    loadMembers(true).then(renderMembers).catch(function () {
      $("members-list").innerHTML = '<p class="error" style="margin:12px 16px">ما گدرنا نجيب القائمة.</p>';
    });
  }
  function closeDrawer() {
    document.body.classList.remove("drawer-open");
    $("drawer").setAttribute("aria-hidden", "true");
    $("menu-btn").setAttribute("aria-expanded", "false");
    $("drawer-backdrop").hidden = true;
  }

  function openPerson(id) {
    var m = (state.members || []).filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    paintAvatar($("person-avatar"), m);
    $("person-name").textContent = m.name;
    $("person-badge").innerHTML = m.is_admin ? '<span class="tag gold">الممثل</span>' : '<span class="tag preg">طالب</span>';
    $("person").hidden = false;
  }
  function closePerson() { $("person").hidden = true; }

  // ---------- install to home screen ----------
  var installEvt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; });
  function isStandalone() { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; }
  function onInstall() {
    var help = $("install-help");
    if (installEvt) {
      installEvt.prompt();
      installEvt.userChoice.then(function () { installEvt = null; });
      return;
    }
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    help.innerHTML = ios
      ? "<b>بالآيفون:</b> افتح المنصة بـ Safari، اضغط زر المشاركة (المربع اللي بيه سهم لفوق)، وبعدها <b>إضافة إلى الشاشة الرئيسية</b>."
      : "<b>بالأندرويد:</b> من قائمة المتصفح (النقاط الثلاث) اختار <b>إضافة إلى الشاشة الرئيسية</b> أو <b>تثبيت التطبيق</b>.";
    help.hidden = !help.hidden;
  }

  // ---------- routing ----------
  function route() {
    if (!state.me) return showLogin();
    var h = location.hash.replace("#", "");
    if (h === "gyn") { show("gyn"); window.A9_renderGyn(); }
    else if (h === "admin" && state.me.is_admin) { show("admin"); loadAdmin(); }
    else if (h === "me") { show("me"); renderMe(); $("install-row").hidden = isStandalone(); }
    else { show("home"); renderHome(); }
  }

  function renderHome() {
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
  $("photo-input").addEventListener("change", onPhoto);
  $("photo-remove").addEventListener("click", function () { if (confirm("تحذف صورتك؟")) saveAvatar(null); });
  $("pin-form").addEventListener("submit", onChangePin);
  $("members-search").addEventListener("input", renderMembers);
  $("members-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-member]"); if (b) openPerson(Number(b.dataset.member));
  });
  $("person-close").addEventListener("click", closePerson);
  $("person").addEventListener("click", function (e) { if (e.target === $("person")) closePerson(); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!$("person").hidden) closePerson(); else closeDrawer();
  });
  $("menu-btn").addEventListener("click", openDrawer);
  $("drawer-close").addEventListener("click", closeDrawer);
  $("drawer-backdrop").addEventListener("click", closeDrawer);
  document.querySelectorAll("[data-nav]").forEach(function (a) { a.addEventListener("click", closeDrawer); });
  $("install-row").addEventListener("click", onInstall);
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
