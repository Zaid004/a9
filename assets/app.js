(function () {
  "use strict";

  var CFG = window.A9_CONFIG;
  var TOKEN_KEY = "a9:token";
  var state = { me: null, students: [], picked: null, reps: {}, members: null };
  // أدوات مشتركة للألعاب اللي بملفات ثانية (assets/walls.js)
  window.A9 = {
    rpc: function (f, a) { return rpc(f, a); }, getToken: function () { return getToken(); }, esc: function (x) { return esc(x); },
    avatar: function (x, e) { return avatar(x, e); }, loading: function (on) { loading(on); },
    loadMembers: function (f) { return loadMembers(f); }, memberById: function (id) { return memberById(id); }, state: state
  };

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
    var a = s.avatar
      ? '<span class="' + cls + ' has-img"><img src="' + esc(s.avatar) + '" alt="" /></span>'
      : '<span class="' + cls + '" style="--h:' + avatarHue(s.id) + '">' + esc(initials(s.name)) + "</span>";
    // الممثل يشوف نقطة خضرة على صورة أي طالب متصل، بكل مكان
    return typeof onlineDot === "function" && s.id && onlineDot(s.id) ? '<span class="av-wrap">' + a + onlineDot(s.id) + "</span>" : a;
  }
  function paintAvatar(el, s) {
    el.style.setProperty("--h", avatarHue(s.id));
    el.classList.toggle("has-img", !!s.avatar);
    el.innerHTML = s.avatar ? '<img src="' + esc(s.avatar) + '" alt="" />' : esc(initials(s.name));
  }

  function loading(on) { $("loading").hidden = !on; }

  function syncFab() { var f = $("home-fab"); if (f) f.hidden = !(state.unread > 0 && !$("home").hidden); }
  function show(id) {
    ["login", "home", "gyn", "admin", "me", "inbox", "chat", "log", "ent", "rot-gyn", "consult", "new", "exam", "xo", "xoplay", "games", "walls", "wallplay", "devil", "devilplay", "cards", "cardplay"].forEach(function (v) { var el = $(v); if (el) el.hidden = v !== id; });
    syncFab();
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
    var vers = rpc("a9_login_avatar_versions").catch(function () { return []; });
    return Promise.all([rpc("a9_list_students"), reps, vers]).then(function (res) {
      var map = {};
      (res[2] || []).forEach(function (r) { map[r.id] = r.avatar_v; });
      var list = (res[0] || []).map(function (s) { s.avatar_v = map[s.id] || null; return s; });
      return fillAvatars(list, function (ids) { return rpc("a9_login_avatars_by_id", { p_ids: ids }); });
    }).then(function (list) {
      state.students = list;
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
    paintAvatar($("pin-avatar"), s);
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

  // ---------- الجهاز والمتصفح (يبين للممثل بصفحة الإدارة) ----------
  var SAMSUNG = { "SM-S938": "Galaxy S25 Ultra", "SM-S936": "Galaxy S25+", "SM-S931": "Galaxy S25",
    "SM-S928": "Galaxy S24 Ultra", "SM-S926": "Galaxy S24+", "SM-S921": "Galaxy S24", "SM-S721": "Galaxy S24 FE",
    "SM-S918": "Galaxy S23 Ultra", "SM-S916": "Galaxy S23+", "SM-S911": "Galaxy S23", "SM-S711": "Galaxy S23 FE",
    "SM-S908": "Galaxy S22 Ultra", "SM-S906": "Galaxy S22+", "SM-S901": "Galaxy S22",
    "SM-A566": "Galaxy A56", "SM-A556": "Galaxy A55", "SM-A546": "Galaxy A54", "SM-A536": "Galaxy A53",
    "SM-A366": "Galaxy A36", "SM-A356": "Galaxy A35", "SM-A346": "Galaxy A34", "SM-A256": "Galaxy A25",
    "SM-A166": "Galaxy A16", "SM-A155": "Galaxy A15", "SM-A145": "Galaxy A14", "SM-A065": "Galaxy A06", "SM-A055": "Galaxy A05",
    "SM-F956": "Galaxy Z Fold6", "SM-F741": "Galaxy Z Flip6", "SM-F946": "Galaxy Z Fold5", "SM-F731": "Galaxy Z Flip5",
    "SM-N986": "Galaxy Note20 Ultra", "SM-G998": "Galaxy S21 Ultra", "SM-G991": "Galaxy S21" };
  function niceModel(m) {
    m = (m || "").trim();
    if (!m || m === "K") return "";
    var k = m.slice(0, 7).toUpperCase();
    if (SAMSUNG[k]) return "Samsung " + SAMSUNG[k];
    if (/^SM-/i.test(m)) return "Samsung " + m;
    return m;
  }
  function browserName(ua) {
    if (/Telegram/i.test(ua)) return "Telegram";
    if (/Instagram/i.test(ua)) return "Instagram";
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook";
    if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
    if (/EdgA?\/|EdgiOS/i.test(ua)) return "Edge";
    if (/OPR\/|OPiOS/i.test(ua)) return "Opera";
    if (/Firefox|FxiOS/i.test(ua)) return "Firefox";
    if (/CriOS/i.test(ua)) return "Chrome";
    if (/Chrome\//i.test(ua)) return "Chrome";
    if (/Safari/i.test(ua)) return "Safari";
    return "متصفح ثاني";
  }
  function deviceInfo() {
    var ua = navigator.userAgent || "", dev = "", m;
    var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
    if (/iPhone/i.test(ua)) dev = "iPhone" + ((m = ua.match(/OS (\d+)[_.](\d+)/)) ? " · iOS " + m[1] + "." + m[2] : "");
    else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) dev = "iPad";
    else if (/Android/i.test(ua)) {
      m = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|\))/);
      dev = niceModel(m && m[1]) || "Android";
      if (dev.indexOf("Samsung") !== 0 && dev !== "Android") dev = dev + " (Android)";
    }
    else if (/Windows/i.test(ua)) dev = "Windows";
    else if (/Macintosh/i.test(ua)) dev = "Mac";
    else if (/Linux/i.test(ua)) dev = "Linux";
    else dev = "جهاز غير معروف";
    var base = function (d) { return d + " · " + browserName(ua) + (standalone ? " (مثبّت كتطبيق)" : ""); };
    // كروم على أندرويد يخفي الموديل بالـ UA، فنطلبه منه مباشرة
    if (/Android/i.test(ua) && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      return navigator.userAgentData.getHighEntropyValues(["model"]).then(function (h) {
        var nm = niceModel(h && h.model);
        return base(nm ? (nm.indexOf("Samsung") === 0 ? nm : nm + " (Android)") : dev);
      }).catch(function () { return base(dev); });
    }
    return Promise.resolve(base(dev));
  }
  var deviceSent = false;
  function sendDevice() {
    if (deviceSent || !getToken()) return;
    deviceSent = true;
    deviceInfo().then(function (d) { return rpc("a9_set_device", { p_token: getToken(), p_device: d }); }).catch(function () { deviceSent = false; });
  }

  // ---------- session ----------
  function afterLogin() {
    sendDevice();
    $("me-btn").hidden = false;
    $("menu-btn").hidden = false;
    startUnreadPolling();
    syncPush();
    loadPresence();
    setTimeout(maybeShowIntro, 600);
    paintAvatar($("me-btn"), state.me);
    backToNames();
    route();
  }

  function logout() {
    var t = getToken();
    setToken(null); deviceSent = false;
    state.me = null; state.members = null;
    gpClearCache();
    $("me-btn").hidden = true;
    $("menu-btn").hidden = true;
    closeDrawer();
    closeChat(); clearInterval(unreadTimer); setUnread(0);
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
    Promise.all([rpc("a9_admin_students", { p_token: getToken() }).then(withAvatars), loadPresence(),
                 rpc("a9_admin_security", { p_token: getToken() }).catch(function () { return []; })]).then(function (res) {
      var rows = res[0], devs = {};
      (res[2] || []).forEach(function (d) { devs[d.id] = d; });
      loading(false);
      var online = rows.filter(function (r) { return presence[r.id] && presence[r.id].online; }).length;
      var done = rows.filter(function (r) { return r.has_pin; }).length;
      $("admin-summary").textContent = "سجّل " + done + " من " + rows.length + " طالب · متصل هسه " + online;
      $("admin-bar").style.width = Math.round((done / rows.length) * 100) + "%";
      $("admin-list").innerHTML = rows.map(function (r) {
        var on = presence[r.id] && presence[r.id].online;
        return '<div class="arow">' +
          avatar(r) +
          '<div class="ainfo"><div class="aname">' + esc(r.name) + (r.is_admin ? ' <span class="tag gold">الممثل</span>' : "") + "</div>" +
          '<div class="note' + (on ? " is-online" : "") + '">' + (r.has_pin ? seenLabel(presence[r.id]) : "ما سجّل بعد") + (r.locked ? " &middot; مقفول مؤقتاً" : "") + "</div>" +
          secLines(devs[r.id], r.id) + "</div>" +
          '<span class="tag ' + (r.has_pin ? "preg" : "cons") + '">' + (r.has_pin ? "مسجّل" : "ما سجّل") + "</span>" +
          (r.has_pin && !r.is_admin ? '<button type="button" class="small-btn" data-reset="' + r.id + '" data-name="' + esc(r.name) + '">تصفير الرقم</button>' : '<span class="small-spacer"></span>') +
          "</div>";
      }).join("");
    }).catch(function () {
      loading(false);
      $("admin-list").innerHTML = '<p class="error" style="padding:16px">ما عندك صلاحية، أو صار خطأ بالاتصال.</p>';
    });
  }

  function secLines(d, id) {
    if (!d || (!d.device && !d.ip)) return "";
    return (d.device ? '<div class="note adev">' + esc(d.device) + "</div>" : "") +
      (d.ip ? '<div class="note adev">IP ' + esc(d.ip) + (d.place ? " · " + esc(d.place) : "") + (d.isp ? " · " + esc(d.isp) : "") + "</div>" : "") +
      '<button type="button" class="adev-log" data-devlog="' + id + '">سجل الدخول</button><div class="devlog" id="devlog-' + id + '" hidden></div>';
  }

  function toggleDevLog(id) {
    var box = $("devlog-" + id); if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '<p class="note">لحظة...</p>';
    rpc("a9_admin_device_log", { p_token: getToken(), p_student: id }).then(function (rows) {
      box.innerHTML = (rows && rows.length) ? rows.map(function (l) {
        return '<div class="devlog-row"><b>' + esc(fmtDate(l.at)) + "</b>" +
          (l.device ? "<span>" + esc(l.device) + "</span>" : "") +
          (l.ip ? "<span>IP " + esc(l.ip) + (l.place ? " · " + esc(l.place) : "") + (l.isp ? " · " + esc(l.isp) : "") + "</span>" : "") + "</div>";
      }).join("") : '<p class="note">ماكو سجل بعد.</p>';
    }).catch(function () { box.innerHTML = '<p class="error">ما گدرنا نجيب السجل.</p>'; });
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
  function resizeImage(file, maxSide) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        if (maxSide) {
          // صورة كاملة بدون قص، أطول ضلع maxSide
          var r = Math.min(1, maxSide / Math.max(img.width, img.height));
          c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          return resolve(c.toDataURL("image/jpeg", 0.78));
        }
        var size = 256, side = Math.min(img.width, img.height);
        c.width = size; c.height = size;
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
      if (res && res.ok) { state.me.avatar = data; state.members = null; if (data && res.v) avPut(state.me.id, res.v, data); else avDrop(state.me.id); renderMe(); paintAvatar($("me-btn"), state.me); photoMsg(data ? "انحفظت الصورة" : "انحذفت الصورة"); }
      else photoMsg("ما گدرنا نحفظ الصورة، جرب صورة ثانية.");
    }).catch(function () { loading(false); photoMsg("صار خطأ بالاتصال."); });
  }

  function onPhoto(e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type)) return photoMsg("اختار صورة.");
    resizeImage(f, 0).then(saveAvatar).catch(function () { photoMsg("ما گدرنا نقرا الصورة، جرب صورة ثانية."); });
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
  // كاش الصور بالموبايل: الصورة تنزل مرة وحدة، وبعدها بس رقم النسخة
  function avGet(id) { try { var o = JSON.parse(localStorage.getItem("a9:av:" + id) || "null"); return o && o.v ? o : null; } catch (e) { return null; } }
  function avPut(id, v, data) { try { localStorage.setItem("a9:av:" + id, JSON.stringify({ v: v, data: data })); } catch (e) {} }
  function avDrop(id) { try { localStorage.removeItem("a9:av:" + id); } catch (e) {} }
  // rows فيها id و avatar_v. fetcher ياخذ قائمة ids ويرجع {id, avatar, avatar_v}
  function fillAvatars(rows, fetcher) {
    var need = [];
    rows.forEach(function (r) {
      if (!r.avatar_v) { r.avatar = null; avDrop(r.id); return; }
      var c = avGet(r.id);
      if (c && String(c.v) === String(r.avatar_v)) r.avatar = c.data;
      else { r.avatar = c ? c.data : null; need.push(r.id); }
    });
    if (!need.length) return Promise.resolve(rows);
    return fetcher(need).then(function (pics) {
      var map = {};
      (pics || []).forEach(function (p) { map[p.id] = p; avPut(p.id, p.avatar_v, p.avatar); });
      rows.forEach(function (r) { if (map[r.id]) r.avatar = map[r.id].avatar; });
      return rows;
    }).catch(function () { return rows; });
  }

  var membersAt = 0;
  function loadMembers(force) {
    // force يجيب القائمة من جديد بس إذا صار عليها أكثر من دقيقة
    if (state.members && (!force || Date.now() - membersAt < 60000)) return Promise.resolve(state.members);
    return rpc("a9_members_lite", { p_token: getToken() }).then(function (rows) {
      return fillAvatars(rows || [], function (ids) { return rpc("a9_avatars", { p_token: getToken(), p_ids: ids }); });
    }).then(function (rows) { state.members = rows; membersAt = Date.now(); return rows; });
  }

  function renderMembers() {
    var q = $("members-search").value.trim();
    var all = state.members || [];
    var joined = all.filter(function (m) { return m.joined; }).length;
    $("members-sub").textContent = all.length;
    $("drawer-sub").textContent = all.length + " طالب" + (state.me && state.me.is_admin ? " · سجّل منهم " + joined : "");
    var rows = all.filter(function (m) { return !q || m.name.indexOf(q) !== -1; });
    $("members-list").innerHTML = rows.map(function (m) {
      return '<button type="button" class="mrow' + (m.is_admin ? " rep" : "") + '" data-member="' + m.id + '">' +
        avatar(m) +
        '<span class="nm">' + esc(m.name) + seenLine(m.id) + "</span>" +
        (m.is_admin ? '<span class="tag gold">الممثل</span>' : "") +
        (state.me && m.id === state.me.id ? '<span class="tag special">أنت</span>' : "") +
        "</button>";
    }).join("") || '<p class="sub center-text" style="padding:16px">ماكو اسم بهذا البحث</p>';
  }

  // يضيف صور الحسابات لأي قائمة طلاب (من قائمة المشاركين)
  function withAvatars(rows) {
    return loadMembers().then(function (all) {
      var map = {};
      (all || []).forEach(function (m) { map[m.id] = m.avatar; });
      (rows || []).forEach(function (r) { if (!r.avatar && map[r.id]) r.avatar = map[r.id]; });
      return rows;
    }).catch(function () { return rows; });
  }

  // ---------- side menu ----------
  function openDrawer() {
    document.body.classList.add("drawer-open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("menu-btn").setAttribute("aria-expanded", "true");
    $("drawer-backdrop").hidden = false;
    var h = (location.hash.replace("#", "") || "home").split("/")[0];
    if (h === "chat" || h === "gchat" || h === "new") h = "inbox";
    if (h === "xoplay") h = "xo";
    document.querySelectorAll("[data-nav]").forEach(function (a) { a.classList.toggle("active", a.dataset.nav === h); });
    document.querySelectorAll(".admin-only").forEach(function (a) { a.hidden = !(state.me && state.me.is_admin); });
    showPanel("main");
    loadMembers(true).then(function (all) { $("members-count").textContent = all.length; }).catch(function () {});
    loadPresence();
  }
  function showPanel(which) {
    $("drawer-main").hidden = which !== "main";
    $("drawer-members").hidden = which !== "members";
    if (which === "members") {
      $("members-search").value = "";
      if (state.members) renderMembers(); else $("members-list").innerHTML = "";
      Promise.all([loadMembers(true), loadPresence()]).then(renderMembers).catch(function () {
        $("members-list").innerHTML = '<p class="error" style="margin:12px 16px">ما گدرنا نجيب القائمة.</p>';
      });
    }
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
    $("person-chat").hidden = !!(state.me && m.id === state.me.id);
    var seen = state.me && state.me.is_admin && m.id !== state.me.id ? seenLabel(presence[m.id]) : "";
    $("person-badge").insertAdjacentHTML("beforeend", seen ? '<p class="note person-seen' + (presence[m.id] && presence[m.id].online ? " is-online" : "") + '">' + esc(seen) + "</p>" : "");
    $("person-chat").dataset.id = m.id;
    $("person").hidden = false;
  }
  function closePerson() { $("person").hidden = true; }

  // ---------- messages ----------
  var chat = { kind: "dm", other: null, lastId: 0, lastSender: null, timer: null, sending: false, info: null };
  var GROUP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 19a4 4 0 0 1 6.5-3.1"/></svg>';
  var unreadTimer = null;

  function timeLabel(iso) {
    var d = new Date(iso), now = new Date();
    var same = d.toDateString() === now.toDateString();
    var t = d.toLocaleTimeString("ar-IQ", { hour: "numeric", minute: "2-digit" });
    return same ? t : d.toLocaleDateString("ar-IQ", { day: "numeric", month: "short" }) + " " + t;
  }

  function setUnread(n) {
    $("menu-dot").hidden = !n;
    $("nav-unread").hidden = !n;
    $("nav-unread").textContent = n > 99 ? "99+" : n;
    // دائرة صغيرة تحت يمين الرئيسية إذا اكو رسائل ما مقروءة
    state.unread = n;
    $("home-fab-n").textContent = n > 99 ? "99+" : n;
    syncFab();
  }
  function pollUnread() {
    if (!state.me) return;
    rpc("a9_unread", { p_token: getToken() }).then(setUnread).catch(function () {});
    if (!document.hidden) rpc("a9_ping", { p_token: getToken() }).catch(function () {});
    if (state.me.is_admin && !document.hidden) loadPresence().then(refreshPresenceViews);
  }

  // ---------- presence (للممثل بس) ----------
  var presence = {};
  function loadPresence() {
    if (!state.me || !state.me.is_admin) return Promise.resolve(presence);
    return rpc("a9_admin_presence", { p_token: getToken() }).then(function (rows) {
      presence = {};
      (rows || []).forEach(function (r) { presence[r.id] = r; });
      return presence;
    }).catch(function () { return presence; });
  }
  // نحدّث الشاشة الحالية من تتغير حالة الاتصال
  function refreshPresenceViews() {
    var h = (location.hash.replace("#", "") || "home").split("/")[0];
    if (document.body.classList.contains("drawer-open") && !$("drawer-members").hidden) renderMembers();
    if (h === "chat" && chat.kind === "dm" && chat.other) $("chat-subline").innerHTML = seenLine(chat.other);
  }
  function seenLabel(p) {
    if (!p || !p.last_seen) return "ما ظهر بعد";
    if (p.online) return "متصل هسه";
    var mins = Math.floor((Date.now() - new Date(p.last_seen).getTime()) / 60000);
    if (mins < 60) return "آخر ظهور: قبل " + Math.max(mins, 2) + " دقيقة";
    var d = new Date(p.last_seen), now = new Date();
    var time = d.toLocaleTimeString("ar-IQ", { hour: "numeric", minute: "2-digit" });
    if (d.toDateString() === now.toDateString()) return "آخر ظهور: اليوم " + time;
    var y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "آخر ظهور: أمس " + time;
    return "آخر ظهور: " + d.toLocaleDateString("ar-IQ", { weekday: "long", day: "numeric", month: "long" }) + " " + time;
  }
  function onlineDot(id) {
    if (!state.me || !state.me.is_admin || id === state.me.id) return "";
    var p = presence[id]; return p && p.online ? '<i class="online-dot" title="متصل هسه"></i>' : "";
  }
  function seenLine(id) {
    if (!state.me || !state.me.is_admin || id === state.me.id) return "";
    var p = presence[id];
    return '<span class="seen-line' + (p && p.online ? " is-online" : "") + '">' + esc(seenLabel(p)) + "</span>";
  }
  function startUnreadPolling() {
    clearInterval(unreadTimer);
    pollUnread();
    unreadTimer = setInterval(pollUnread, 30000);
  }

  function openInbox() {
    loading(true);
    var dms = Promise.all([loadPresence(), loadMembers().catch(function () {})]).then(function () { return rpc("a9_conversations", { p_token: getToken() }); });
    var groups = rpc("a9_group_list", { p_token: getToken() }).catch(function () { return []; });
    Promise.all([dms, groups]).then(function (res) {
      loading(false);
      var items = (res[0] || []).map(function (c) { c.kind = "dm"; return c; })
        .concat((res[1] || []).map(function (g) { g.kind = "group"; return g; }))
        .sort(function (a, b) { return new Date(b.last_at) - new Date(a.last_at); });
      $("inbox-list").innerHTML = items.length ? items.map(function (c) {
        if (c.kind === "group") {
          var last = c.last_body ? (c.last_mine ? "أنت: " : c.last_sender ? esc(c.last_sender.split(" ")[0]) + ": " : "") + esc(c.last_body) : "مجموعة جديدة · " + c.members + " أعضاء";
          return '<a class="conv' + (c.unread ? " unread" : "") + '" href="#gchat/' + c.id + '">' +
            '<span class="avatar group-av">' + GROUP_ICON + "</span>" +
            '<div class="conv-main"><div class="conv-top"><b>' + esc(c.name) + '</b><span class="tag special">مجموعة</span>' +
            '<span class="conv-time">' + timeLabel(c.last_at) + "</span></div>" +
            '<div class="conv-last">' + last + "</div></div>" +
            (c.unread ? '<b class="badge">' + c.unread + "</b>" : "") + "</a>";
        }
        var who = { id: c.other, name: c.name, avatar: c.avatar || (memberById(c.other) || {}).avatar };
        return '<a class="conv' + (c.unread ? " unread" : "") + '" href="#chat/' + c.other + '">' +
          avatar(who) +
          '<div class="conv-main"><div class="conv-top"><b>' + esc(c.name) + "</b>" +
          (c.is_admin ? '<span class="tag gold">الممثل</span>' : "") +
          '<span class="conv-time">' + timeLabel(c.last_at) + "</span></div>" +
          '<div class="conv-last">' + (c.last_mine ? "أنت: " : "") + esc(c.last_body) + "</div>" + seenLine(c.other) + "</div>" +
          (c.unread ? '<b class="badge">' + c.unread + "</b>" : "") +
          "</a>";
      }).join("") : '<p class="sub center-text" style="padding:24px 16px">ماكو رسائل بعد. اضغط "محادثة جديدة" حتى تبدي.</p>';
      pollUnread();
    }).catch(function () { loading(false); $("inbox-list").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب الرسائل.</p>'; });
  }

  // ----- new chat / add members picker -----
  var picker = { mode: "new", chosen: {} };
  function openPicker(mode) {
    loadPresence().then(function () { if (location.hash.indexOf("#new") === 0) renderPicker(); });
    picker = { mode: mode, chosen: {} };
    var add = mode === "add";
    $("new-title").textContent = add ? "إضافة أعضاء" : "محادثة جديدة";
    $("new-sub").textContent = add ? "اختار الطلاب اللي تريد تضيفهم لـ " + (chat.info ? chat.info.name : "المجموعة") + "." : "اختار طالب حتى تراسله، أو أكثر من طالب حتى تسوي مجموعة.";
    $("new-back").setAttribute("href", add ? "#gchat/" + chat.other : "#inbox");
    $("new-search").value = ""; $("group-name").value = "";
    loadMembers().then(renderPicker).catch(function () { $("new-list").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب الأسماء.</p>'; });
    renderPicker();
  }
  function renderPicker() {
    var q = $("new-search").value.trim();
    var inGroup = {};
    if (picker.mode === "add" && chat.info) (chat.info.members || []).forEach(function (m) { inGroup[m.id] = true; });
    var list = (state.members || []).filter(function (m) { return (!state.me || m.id !== state.me.id) && !inGroup[m.id]; })
      .filter(function (m) { return !q || m.name.indexOf(q) !== -1; });
    $("new-list").innerHTML = list.map(function (m) {
      var on = !!picker.chosen[m.id];
      return '<button type="button" class="pick' + (on ? " on" : "") + '" data-pick="' + m.id + '">' + avatar(m) +
        '<span class="nm">' + esc(m.name) + seenLine(m.id) + "</span>" + (m.is_admin ? '<span class="tag gold">الممثل</span>' : "") +
        '<span class="check">' + (on ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : "") + "</span></button>";
    }).join("") || '<p class="sub center-text" style="padding:16px">' + (q ? "ماكو اسم بهذا البحث" : "ماكو طلاب") + "</p>";
    var ids = Object.keys(picker.chosen);
    $("pick-bar").hidden = !ids.length;
    var names = ids.map(function (id) { return picker.chosen[id].split(" ")[0]; });
    $("pick-chosen").textContent = ids.length + " مختارين: " + names.join("، ");
    var group = picker.mode === "new" && ids.length > 1;
    $("group-name").hidden = !group;
    $("pick-go").textContent = picker.mode === "add" ? "إضافة" : group ? "إنشاء مجموعة" : "مراسلة";
  }
  function onPick(e) {
    var b = e.target.closest("[data-pick]"); if (!b) return;
    var id = b.dataset.pick, m = (state.members || []).filter(function (x) { return String(x.id) === id; })[0];
    if (picker.chosen[id]) delete picker.chosen[id]; else picker.chosen[id] = m ? m.name : "";
    renderPicker();
    if (!$("group-name").hidden && Object.keys(picker.chosen).length === 2) $("group-name").focus();
  }
  function onPickGo() {
    var ids = Object.keys(picker.chosen).map(Number);
    if (!ids.length) return;
    if (picker.mode === "add") {
      loading(true);
      rpc("a9_group_add", { p_token: getToken(), p_group: chat.other, p_members: ids }).then(function (res) {
        loading(false);
        if (res && res.ok) location.hash = "gchat/" + chat.other; else alert("ما انضافوا.");
      }).catch(function () { loading(false); alert("صار خطأ بالاتصال."); });
      return;
    }
    if (ids.length === 1) { location.hash = "chat/" + ids[0]; return; }
    var name = $("group-name").value.trim();
    if (!name) { $("group-name").focus(); alert("اكتب اسم للمجموعة."); return; }
    loading(true);
    rpc("a9_group_create", { p_token: getToken(), p_name: name, p_members: ids }).then(function (res) {
      loading(false);
      if (res && res.ok) location.hash = "gchat/" + res.id; else alert("ما انسوت المجموعة.");
    }).catch(function () { loading(false); alert("صار خطأ بالاتصال."); });
  }

  function memberById(id) { return (state.members || []).filter(function (x) { return x.id === id; })[0]; }

  function bubble(m) {
    var time = '<div class="msg-time">' + timeLabel(m.created_at) +
      (chat.kind !== "group" && m.mine && m.read_at ? " &middot; مقروءة" : "") +
      (chat.kind === "group" && m.mine ? ' <button type="button" class="reads" data-reads="' + m.id + '"></button>' : "") + "</div>";
    var body = '<div class="bubble">' + esc(m.body).replace(/\n/g, "<br>") + "</div>";
    if (chat.kind !== "group" || m.mine) {
      chat.lastSender = null;
      return '<div class="msg ' + (m.mine ? "me" : "them") + '" data-id="' + m.id + '">' + body + time + "</div>";
    }
    // رسالة من عضو ثاني بالمجموعة: صورته واسمه (أول رسالة من سلسلة رسائله)
    var first = m.sender !== chat.lastSender;
    chat.lastSender = m.sender;
    var person = memberById(m.sender) || { id: m.sender, name: m.sender_name || "" };
    return '<div class="msg them grp' + (first ? " first" : "") + '" data-id="' + m.id + '">' +
      (first ? '<button type="button" class="msg-av" data-person="' + m.sender + '" aria-label="' + esc(person.name) + '">' + avatar(person) + "</button>"
             : '<span class="msg-av-gap"></span>') +
      '<div class="msg-col">' + (first ? '<button type="button" class="msg-who" data-person="' + m.sender + '">' + esc(m.sender_name || person.name) + "</button>" : "") +
      body + time + "</div></div>";
  }

  // منو قرا رسائلي بالمجموعة
  var groupReads = [];
  function readersOf(msgId) { return groupReads.filter(function (r) { return r.last_read_id >= msgId; }); }
  function paintReads() {
    var total = groupReads.length;
    Array.prototype.forEach.call(document.querySelectorAll("#chat-msgs .reads"), function (b) {
      var n = readersOf(Number(b.dataset.reads)).length;
      b.textContent = !total ? "" : n === 0 ? "ما قراها أحد" : n === total ? "قراها الكل" : "قراها " + n + " من " + total;
      b.classList.toggle("all", total > 0 && n === total);
    });
  }
  function fetchReads() {
    if (chat.kind !== "group" || !chat.other) return;
    var g = chat.other;
    rpc("a9_group_reads", { p_token: getToken(), p_group: g }).then(function (rows) {
      if (chat.other !== g) return;
      groupReads = rows || []; paintReads();
    }).catch(function () {});
  }
  function showReaders(msgId) {
    var read = readersOf(msgId), notYet = groupReads.filter(function (r) { return r.last_read_id < msgId; });
    var row = function (r) { var m = memberById(r.id) || r; return '<div class="cmember">' + avatar(m) + '<span class="nm">' + esc(r.name) + "</span></div>"; };
    $("reads-list").innerHTML =
      '<h3 class="sub-title">قروها (' + read.length + ")</h3>" + (read.length ? read.map(row).join("") : '<p class="note">بعد محد قراها.</p>') +
      (notYet.length ? '<h3 class="sub-title">بعد ما قروها (' + notYet.length + ")</h3>" + notYet.map(row).join("") : "");
    $("reads").hidden = false;
  }

  function fetchChat(first) {
    if (!chat.other) return;
    var other = chat.other, kind = chat.kind;
    var req = kind === "group"
      ? rpc("a9_group_messages", { p_token: getToken(), p_group: other, p_after: first ? 0 : chat.lastId })
      : rpc("a9_messages", { p_token: getToken(), p_other: other, p_after: first ? 0 : chat.lastId });
    return req.then(function (rows) {
      if (chat.other !== other || chat.kind !== kind) return;
      if (first) chat.lastSender = null;
      rows = rows || [];
      var box = $("chat-msgs");
      var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      if (first) box.innerHTML = rows.length ? "" : '<p class="chat-empty">ابدأ المحادثة.</p>';
      if (rows.length) {
        var empty = box.querySelector(".chat-empty"); if (empty) empty.remove();
        box.insertAdjacentHTML("beforeend", rows.map(bubble).join(""));
        chat.lastId = rows[rows.length - 1].id;
      }
      if (first || nearBottom) box.scrollTop = box.scrollHeight;
      if (kind === "group") { paintReads(); fetchReads(); }
    });
  }

  function openChat(id) {
    var m = (state.members || []).filter(function (x) { return x.id === id; })[0];
    var go = function (person) {
      chat.kind = "dm"; chat.other = id; chat.lastId = 0; chat.info = null;
      $("chat-avatar").classList.remove("group-av");
      paintAvatar($("chat-avatar"), person || { id: id, name: "?" });
      $("chat-name").textContent = person ? person.name : "";
      $("chat-subline").innerHTML = seenLine(id);
      $("chat-msgs").innerHTML = "";
      $("chat-input").value = "";
      fetchChat(true).then(pollUnread).catch(function () {
        $("chat-msgs").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نفتح المحادثة.</p>';
      });
      clearInterval(chat.timer);
      chat.timer = setInterval(function () { if (!document.hidden) fetchChat(false); }, 4000);
    };
    if (m) go(m);
    else loadMembers(true).then(function (all) { go(all.filter(function (x) { return x.id === id; })[0]); });
  }

  function openGroupChat(id) {
    chat.kind = "group"; chat.other = id; chat.lastId = 0; chat.info = null; groupReads = [];
    var av = $("chat-avatar"); av.className = "avatar group-av"; av.innerHTML = GROUP_ICON; av.style.removeProperty("--h");
    $("chat-name").textContent = ""; $("chat-subline").textContent = "";
    $("chat-msgs").innerHTML = ""; $("chat-input").value = "";
    loadMembers().catch(function () {});
    rpc("a9_group_info", { p_token: getToken(), p_group: id }).then(function (info) {
      if (chat.other !== id) return;
      chat.info = info;
      $("chat-name").textContent = info.name;
      $("chat-subline").textContent = (info.members || []).length + " أعضاء · اضغط للتفاصيل";
    }).catch(function () { $("chat-msgs").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نفتح المجموعة.</p>'; });
    fetchChat(true).then(pollUnread).catch(function () {});
    clearInterval(chat.timer);
    chat.timer = setInterval(function () { if (!document.hidden) fetchChat(false); }, 4000);
  }

  function openGroupInfo() {
    loadPresence();
    if (chat.kind !== "group" || !chat.info) return;
    var info = chat.info, mem = state.members || [];
    $("ginfo-name").textContent = info.name;
    $("ginfo-count").textContent = (info.members || []).length + " أعضاء";
    $("ginfo-members").innerHTML = (info.members || []).map(function (m) {
      var full = mem.filter(function (x) { return x.id === m.id; })[0] || m;
      return '<div class="cmember">' + avatar(full) + '<span class="nm">' + esc(m.name) + seenLine(m.id) + "</span>" +
        (m.is_admin ? '<span class="tag gold">الممثل</span>' : "") + (state.me && m.id === state.me.id ? '<span class="tag special">أنت</span>' : "") + "</div>";
    }).join("");
    $("ginfo").hidden = false;
  }
  function closeGroupInfo() { $("ginfo").hidden = true; }

  function closeChat() { clearInterval(chat.timer); chat.timer = null; chat.other = null; chat.info = null; }

  function sendMessage(e) {
    e.preventDefault();
    var input = $("chat-input");
    var body = input.value.trim();
    if (!body || chat.sending || !chat.other) return;
    chat.sending = true;
    var call = chat.kind === "group"
      ? rpc("a9_group_send", { p_token: getToken(), p_group: chat.other, p_body: body })
      : rpc("a9_send", { p_token: getToken(), p_to: chat.other, p_body: body });
    call.then(function (res) {
      chat.sending = false;
      if (res && res.ok) { input.value = ""; autoGrow(); fetchChat(false); }
      else alert("ما انرسلت الرسالة.");
    }).catch(function () { chat.sending = false; alert("صار خطأ بالاتصال، الرسالة ما انرسلت."); });
  }

  function autoGrow() {
    var el = $("chat-input");
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  // ---------- admin event log ----------
  var LOG_KINDS = {
    register: "تسجيل جديد", login: "تسجيل دخول", login_failed: "رقم سري غلط", locked: "انقفل الحساب",
    logout: "تسجيل خروج", avatar: "غيّر صورته", avatar_removed: "حذف صورته", pin_changed: "غيّر رقمه السري",
    pin_reset: "صفّر رقم سري", message: "رسالة",
    xo_challenge: "تحدي XO", xo_accept: "قبل تحدي XO", xo_decline: "رفض تحدي XO", xo_win: "فاز بـ XO", xo_draw: "تعادل بـ XO", xo_open: "سوّى مباراة XO مفتوحة", xo_join: "دخل مباراة XO مفتوحة",
    wall_challenge: "تحدي سباق الجدران", wall_accept: "قبل تحدي سباق الجدران", wall_decline: "رفض تحدي سباق الجدران", wall_win: "فاز بسباق الجدران",
    wall_open: "سوّى مباراة جدران مفتوحة", wall_join: "دخل مباراة جدران مفتوحة",
    card_create: "سوّى لعبة 9no", card_win: "فاز بـ 9no", card_invite: "دعا طالب يلعب 9no",
    group_create: "سوّى مجموعة محادثة", group_add: "ضاف أعضاء لمجموعة", group_leave: "طلع من مجموعة", group_message: "رسالة بمجموعة",
    consult_join: "انضم لمجموعة استشارية", consult_leave: "طلع من مجموعته الاستشارية", consult_add: "ضاف صديق لمجموعته",
    consult_assign: "وزّع طالب على مجموعة", consult_lock: "ثبّت مجموعات الاستشارية", consult_unlock: "فتح مجموعات الاستشارية",
    group_photo: "غيّر صورة المجموعة", group_photo_removed: "حذف صورة المجموعة",
    tg_edit: "عدّل تبليغ التيليغرام", tg_link: "ربط مجموعة التيليغرام"
  };
  var LOG_FILTERS = [["all", "الكل"], ["message", "الرسائل"], ["auth", "الدخول والتسجيل"], ["account", "الحسابات"], ["game", "الألعاب"]];
  var LOG_GROUP = { xo_challenge: "game", xo_accept: "game", xo_decline: "game", xo_win: "game", xo_draw: "game", xo_open: "game", xo_join: "game", wall_challenge: "game", wall_accept: "game", wall_decline: "game", wall_win: "game", wall_open: "game", wall_join: "game", card_create: "game", card_win: "game", card_invite: "game", message: "message", group_message: "message", group_create: "message", group_add: "message", group_leave: "message", register: "auth", login: "auth", login_failed: "auth", locked: "auth", logout: "auth",
                    avatar: "account", avatar_removed: "account", pin_changed: "account", pin_reset: "account",
                    group_photo: "account", group_photo_removed: "account",
                    consult_join: "account", consult_leave: "account", consult_add: "account", consult_assign: "account",
                    consult_lock: "account", consult_unlock: "account", tg_edit: "account", tg_link: "account" };
  var logState = { rows: [], filter: "all", oldest: null };

  function logLine(e) {
    var who = esc(e.actor || "شخص غير معروف");
    var what = LOG_KINDS[e.kind] || esc(e.kind);
    var text;
    if (e.kind === "message") text = "<b>" + who + "</b> راسل <b>" + esc(e.target || "") + "</b>";
    else if (e.kind === "pin_reset") text = "<b>" + who + "</b> صفّر الرقم السري لـ <b>" + esc(e.target || "") + "</b>";
    else if (e.kind === "group_message") text = "<b>" + who + "</b> كتب بمجموعة";
    else if (e.kind === "xo_challenge") text = "<b>" + who + "</b> تحدى <b>" + esc(e.target || "") + "</b> بلعبة XO";
    else if (e.kind === "xo_accept") text = "<b>" + who + "</b> قبل تحدي <b>" + esc(e.target || "") + "</b> وبدت المباراة";
    else if (e.kind === "xo_decline") text = "<b>" + who + "</b> رفض تحدي <b>" + esc(e.target || "") + "</b>";
    else if (e.kind === "xo_win") text = "<b>" + who + "</b> فاز على <b>" + esc(e.target || "") + "</b> بلعبة XO";
    else if (e.kind === "xo_draw") text = "<b>" + who + "</b> و<b>" + esc(e.target || "") + "</b> تعادلوا بلعبة XO";
    else if (e.kind === "group_create" || e.kind === "group_add" || e.kind === "group_leave") text = "<b>" + who + "</b> &middot; " + what + ' "' + esc(e.detail || "") + '"';
    else if (e.kind === "consult_add") text = "<b>" + who + "</b> ضاف <b>" + esc(e.target || "") + "</b> لـ" + esc(e.detail || "");
    else if (e.kind === "consult_assign") text = "<b>" + who + "</b> حط <b>" + esc(e.target || "") + "</b> بـ" + esc(e.detail || "");
    else if (e.kind === "consult_join" || e.kind === "consult_leave") text = "<b>" + who + "</b> &middot; " + what + " (" + esc(e.detail || "") + ")";
    else text = "<b>" + who + "</b> &middot; " + what;
    return '<div class="ev ev-' + (LOG_GROUP[e.kind] || "other") + '">' +
      '<span class="ev-dot"></span>' +
      '<div class="ev-main"><div class="ev-text">' + text + "</div>" +
      ((e.kind === "message" || e.kind === "group_message") && e.detail ? '<div class="ev-detail">' + esc(e.detail) + "</div>" : "") +
      '<div class="ev-time">' + new Date(e.at).toLocaleString("ar-IQ", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit" }) + "</div></div></div>";
  }

  function renderLog() {
    $("log-filters").innerHTML = LOG_FILTERS.map(function (f) {
      return '<button type="button" class="chip' + (logState.filter === f[0] ? " on" : "") + '" data-filter="' + f[0] + '">' + f[1] + "</button>";
    }).join("");
    var rows = logState.rows.filter(function (e) { return logState.filter === "all" || LOG_GROUP[e.kind] === logState.filter; });
    $("log-list").innerHTML = rows.length ? rows.map(logLine).join("") : '<p class="sub center-text" style="padding:24px 16px">ماكو أحداث.</p>';
  }

  function loadLog(more) {
    loading(true);
    rpc("a9_admin_events", { p_token: getToken(), p_before: more ? logState.oldest : null, p_limit: 100 }).then(function (rows) {
      loading(false);
      rows = rows || [];
      logState.rows = more ? logState.rows.concat(rows) : rows;
      if (rows.length) logState.oldest = rows[rows.length - 1].id;
      $("log-more").hidden = rows.length < 100;
      renderLog();
    }).catch(function () { loading(false); $("log-list").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب السجل.</p>'; });
  }

  // ---------- notifications ----------
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  function pushSupported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
  function urlB64(s) {
    var pad = "=".repeat((4 - s.length % 4) % 4), b = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a;
  }
  function notifState() {
    if (!pushSupported()) return isIOS && !isStandalone() ? "needs-install" : "unsupported";
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "granted") return "granted";
    return "default";
  }
  function notifHelpText(st) {
    if (st === "needs-install") return "بالآيفون الإشعارات تشتغل بس من تضيف المنصة لشاشة الموبايل: من Safari اضغط زر المشاركة وبعدها <b>إضافة إلى الشاشة الرئيسية</b>، وافتح المنصة من الأيقونة وفعّل الإشعارات من هنا.";
    if (st === "denied") return "الإشعارات مقفولة لهذا الموقع. فعّلها من إعدادات الموبايل أو المتصفح، وبعدها ارجع اضغط هنا.";
    if (st === "unsupported") return "هذا المتصفح ما يدعم الإشعارات. جرب Chrome، أو بالآيفون ضيف المنصة لشاشة الموبايل.";
    return "";
  }
  function enableNotifications() {
    var st = notifState();
    if (st !== "default" && st !== "granted") return Promise.resolve(st);
    return Notification.requestPermission().then(function (perm) {
      if (perm !== "granted") return notifState();
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription().then(function (sub) {
          return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(CFG.vapidPublic) });
        });
      }).then(function (sub) {
        var j = sub.toJSON();
        return rpc("a9_push_subscribe", { p_token: getToken(), p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
      }).then(function (res) { return res && res.ok ? "granted" : "error"; });
    }).catch(function () { return "error"; });
  }
  // إذا الإذن موجود، نتأكد إن الاشتراك محفوظ بالقاعدة (يتجدد أحياناً)
  function syncPush() {
    if (notifState() !== "granted") return;
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (sub) { var j = sub.toJSON(); rpc("a9_push_subscribe", { p_token: getToken(), p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth }).catch(function () {}); }
      else enableNotifications();
    }).catch(function () {});
  }
  function renderNotifRow() {
    var st = notifState();
    $("notif-state").textContent = st === "granted" ? "مفعّلة" : st === "default" ? "اضغط للتفعيل" : "غير متاحة";
    $("notif-help").hidden = true;
  }
  function onNotifRow() {
    var st = notifState();
    if (st === "granted") { $("notif-help").innerHTML = "الإشعارات مفعّلة. راح يوصلك إشعار من أحد يراسلك أو يكتب بمجموعة إنت بيها."; $("notif-help").hidden = !$("notif-help").hidden; return; }
    if (st !== "default") { $("notif-help").innerHTML = notifHelpText(st); $("notif-help").hidden = false; return; }
    enableNotifications().then(function (r) {
      renderNotifRow();
      if (r !== "granted") { $("notif-help").innerHTML = r === "error" ? "ما گدرنا نفعّل الإشعارات، جرب مرة ثانية." : notifHelpText(r); $("notif-help").hidden = false; }
    });
  }

  // ---------- intro popup (مرة وحدة لكل جهاز) ----------
  var INTRO_KEY = "a9:seen:messages-intro";
  function maybeShowIntro() {
    try { if (localStorage.getItem(INTRO_KEY)) return; } catch (e) { return; }
    var st = notifState();
    $("intro-notif").hidden = st === "granted" || st === "unsupported";
    $("intro-notif").textContent = st === "needs-install" ? "شلون أفعّل الإشعارات؟" : "تفعيل الإشعارات";
    $("intro-notif-note").textContent = "";
    $("intro").hidden = false;
  }
  function closeIntro() { $("intro").hidden = true; try { localStorage.setItem(INTRO_KEY, "1"); } catch (e) {} }
  function onIntroNotif() {
    var st = notifState();
    if (st !== "default") { $("intro-notif-note").innerHTML = notifHelpText(st); return; }
    enableNotifications().then(function (r) {
      if (r === "granted") { $("intro-notif").hidden = true; $("intro-notif-note").textContent = "انفعلت الإشعارات."; }
      else $("intro-notif-note").innerHTML = r === "error" ? "ما گدرنا نفعّلها، جرب من صفحة حسابك." : notifHelpText(r);
    });
  }

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
    var parts = location.hash.replace("#", "").split("/");
    var h = parts[0];
    var addingToGroup = h === "new" && parts[1] === "add" && chat.kind === "group" && chat.other;
    if (h !== "chat" && h !== "gchat" && !addingToGroup) closeChat();
    if (addingToGroup) { clearInterval(chat.timer); chat.timer = null; }
    if (h !== "gchat") closeGroupInfo();
    if (h === "chat" && parts[1]) { show("chat"); openChat(Number(parts[1])); return; }
    if (h === "gchat" && parts[1]) { show("chat"); openGroupChat(Number(parts[1])); return; }
    if (h === "new") { show("new"); openPicker(parts[1] === "add" ? "add" : "new"); return; }
    if (h === "inbox") { show("inbox"); openInbox(); return; }
    if (h === "log" && state.me.is_admin) { show("log"); logState.filter = "all"; loadLog(false); return; }
    if (h === "ent") { show("ent"); openEnt(); return; }
    if (h === "exam") { show("exam"); openExam(); return; }
    if (h !== "xoplay") stopXoPoll();
    if (h !== "wall" && h !== "wallplay" && h !== "walls" && window.A9W) window.A9W.stop();
    if (h !== "devilplay" && window.A9D) window.A9D.stop();
    if (h !== "card" && h !== "cards" && h !== "cardai" && window.A9K) window.A9K.stop();
    if (window.A9C && !((h === "card" || h === "xo" || h === "wall") && parts[1])) window.A9C.unmount();
    if (h === "cards") { show("cards"); window.A9K.lobby(); return; }
    if (h === "cardai") { show("cardplay"); window.A9K.ai(); return; }
    if (h === "card" && parts[1]) { show("cardplay"); window.A9K.table(Number(parts[1])); return; }
    if (h === "games") { show("games"); return; }
    if (h === "devil") { show("devil"); window.A9D.home(); return; }
    if (h === "devilplay" && parts[1]) { show("devilplay"); window.A9D.play(Number(parts[1])); return; }
    if (h === "walls") { show("walls"); window.A9W.home(); return; }
    if (h === "wall" && parts[1]) { show("wallplay"); window.A9W.online(Number(parts[1])); return; }
    if (h === "wallplay") { show("wallplay"); window.A9W.local(parts[1] === "friend" ? "friend" : "ai"); return; }
    if (h === "xo" && parts[1]) { show("xoplay"); openXoOnline(Number(parts[1])); return; }
    if (h === "xo") { show("xo"); openXoHome(); return; }
    if (h === "xoplay") { show("xoplay"); openXoLocal(parts[1] === "friend" ? "friend" : "ai"); return; }
    if (h === "rot-gyn") { show("rot-gyn"); openRotGyn(); return; }
    if (h === "consult") { show("consult"); openConsult(); return; }
    if (h === "gyn") { show("gyn"); window.A9_renderGyn(); }
    else if (h === "admin" && state.me.is_admin) { show("admin"); loadAdmin(); openGpAdmin(); openTgAdmin(); if (window.A9D) window.A9D.admin(); if (window.A9K) window.A9K.admin(); }
    else if (h === "me") { show("me"); renderMe(); renderNotifRow(); $("install-row").hidden = isStandalone(); }
    else { show("home"); renderHome(); pollUnread(); }
  }

  // ---------- group photos (gallery) ----------
  var GP_CACHE = "a9:gp:";
  var gallery = { ids: [], data: {} };

  function gpGet(id) {
    if (gallery.data[id]) return Promise.resolve(gallery.data[id]);
    try { var c = localStorage.getItem(GP_CACHE + id); if (c) { gallery.data[id] = c; return Promise.resolve(c); } } catch (e) {}
    return rpc("a9_group_photo_data", { p_token: getToken(), p_id: id }).then(function (src) {
      if (src) { gallery.data[id] = src; try { localStorage.setItem(GP_CACHE + id, src); } catch (e) {} }
      return src;
    });
  }
  function gpClearCache() {
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(GP_CACHE) === 0) localStorage.removeItem(k); }); } catch (e) {}
    gallery = { ids: [], data: {} };
  }

  function loadGallery() {
    return rpc("a9_group_photo_ids", { p_token: getToken() }).then(function (rows) {
      gallery.ids = (rows || []).map(function (r) { return r.id; });
      // نشيل من الموبايل الصور اللي انحذفت
      try { Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(GP_CACHE) === 0 && gallery.ids.indexOf(Number(k.slice(GP_CACHE.length))) === -1) localStorage.removeItem(k);
      }); } catch (e) {}
      return gallery.ids;
    });
  }

  function renderGallery() {
    var ids = gallery.ids;
    $("gallery").hidden = !ids.length;
    if (!ids.length) return;
    var track = $("gallery-track");
    var have = Array.prototype.map.call(track.children, function (s) { return Number(s.dataset.id); });
    if (have.join() !== ids.join()) {
      track.innerHTML = ids.map(function (id) {
        return '<div class="slide" data-id="' + id + '"><img alt="صورة المجموعة" draggable="false" /><span class="slide-cap">المرحلة الخامسة &middot; 2026 – 2027</span></div>';
      }).join("");
      $("gallery-dots").innerHTML = ids.length > 1 ? ids.map(function (_, i) { return '<i' + (i === 0 ? ' class="on"' : "") + "></i>"; }).join("") : "";
      track.scrollLeft = 0;
    }
    ids.forEach(function (id) {
      gpGet(id).then(function (src) {
        var img = track.querySelector('.slide[data-id="' + id + '"] img');
        if (img && src && img.getAttribute("src") !== src) img.src = src;
      }).catch(function () {});
    });
  }

  function updateDots() {
    var track = $("gallery-track");
    var i = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
    Array.prototype.forEach.call($("gallery-dots").children, function (d, k) { d.classList.toggle("on", k === i); });
  }

  // من يلمس الصور (ثابت أو يسحب بيناتهن) تتوضح، ومن يشيل إصبعه وتوقف الحركة ترجع ضبابية
  function bindGalleryHold() {
    var track = $("gallery-track");
    var touching = false, settle = null;
    function on() { clearTimeout(settle); track.classList.add("holding"); }
    function offSoon() {
      clearTimeout(settle);
      settle = setTimeout(function () { if (!touching) track.classList.remove("holding"); }, 220);
    }
    function start() { touching = true; on(); restartAuto(); }
    function end() { touching = false; offSoon(); restartAuto(); }
    track.addEventListener("touchstart", start, { passive: true });
    track.addEventListener("touchend", end);
    track.addEventListener("touchcancel", end);
    track.addEventListener("mousedown", start);
    window.addEventListener("mouseup", function () { if (touching) end(); });
    track.addEventListener("scroll", function () {
      updateDots();
      if (track.classList.contains("holding")) { clearTimeout(settle); if (!touching) offSoon(); }
    }, { passive: true });
    track.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    restartAuto();
  }

  // كل 3 ثواني تنتقل للصورة اللي بعدها، وبعد الأخيرة ترجع للأولى
  var autoTimer = null;
  function restartAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(function () {
      var track = $("gallery-track");
      var slides = track.children;
      if (slides.length < 2 || document.hidden || $("home").hidden || track.classList.contains("holding")) return;
      var i = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
      var next = slides[(i + 1) % slides.length];
      var dir = getComputedStyle(track).direction === "rtl" ? -1 : 1;
      track.scrollTo({ left: dir * next.offsetWidth * ((i + 1) % slides.length), behavior: "smooth" });
    }, 3000);
  }

  // ----- admin side -----
  function gpMsg(m) { $("gp-msg").textContent = m; $("gp-msg").hidden = !m; }
  function renderGpAdmin() {
    var ids = gallery.ids;
    $("gp-grid").innerHTML = ids.length ? ids.map(function (id, i) {
      // الأسهم تغير الترتيب: السهم لليمين يقدمها، ولليسار يأخرها
      return '<div class="gp-thumb" data-id="' + id + '"><img alt="" /><span class="gp-num">' + (i + 1) + '</span><button type="button" class="gp-del" data-del="' + id + '" aria-label="حذف">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<div class="gp-move">' +
        '<button type="button" data-move="-1" data-id="' + id + '" aria-label="قدّمها"' + (i === 0 ? " disabled" : "") + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>' +
        '<button type="button" data-move="1" data-id="' + id + '" aria-label="أخّرها"' + (i === ids.length - 1 ? " disabled" : "") + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' +
        "</div></div>";
    }).join("") : '<p class="note" style="grid-column:1/-1;text-align:center;margin:18px 0">ماكو صور بعد</p>';
    ids.forEach(function (id) {
      gpGet(id).then(function (src) { var img = $("gp-grid").querySelector('.gp-thumb[data-id="' + id + '"] img'); if (img && src) img.src = src; }).catch(function () {});
    });
  }
  var gpOrderTimer = null;
  function moveGroupPhoto(id, dir) {
    var ids = gallery.ids, i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    ids[i] = ids[j]; ids[j] = id;
    renderGpAdmin();
    // نحفظ بعد ما يوكف عن التحريك شوية، حتى ما نرسل طلب لكل ضغطة
    clearTimeout(gpOrderTimer);
    gpOrderTimer = setTimeout(function () {
      rpc("a9_admin_group_photo_order", { p_token: getToken(), p_ids: gallery.ids.slice() }).then(function (r) {
        gpMsg(r && r.ok ? "انحفظ الترتيب" : "ما گدرنا نحفظ الترتيب.");
      }).catch(function () { gpMsg("ما گدرنا نحفظ الترتيب."); });
    }, 700);
  }
  // ---------- Telegram announcements (admin) ----------
  var tg = { view: null, editing: null };
  var TG_ERR = { not_admin: "هاي للممثل بس.", no_admin_chat: "افتح البوت بالخاص ودوس Start أول.", not_found: "ما لگينا التبليغ.", bad_text: "النص فارغ أو طويل هواية." };
  function tgMsg(t) { var el = $("tg-msg"); el.hidden = !t; el.textContent = t || ""; }
  function tgDayLabel(iso) {
    var a = iso.split("-"), dt = new Date(+a[0], +a[1] - 1, +a[2]);
    return dt.toLocaleDateString("ar-IQ-u-nu-latn", { weekday: "long", day: "numeric", month: "long" });
  }
  function tgAuto(day) {
    var list = window.A9_gynAnnouncements ? window.A9_gynAnnouncements() : [];
    var x = list.filter(function (i) { return i.d === day; })[0];
    return x ? x.text : null;
  }
  function openTgAdmin() {
    tgMsg(""); tg.editing = null;
    var items = window.A9_gynAnnouncements ? window.A9_gynAnnouncements() : [];
    rpc("a9_admin_tg_sync", { p_token: getToken(), p_items: items }).catch(function () {})
      .then(loadTg);
  }
  function loadTg() {
    return rpc("a9_admin_tg_view", { p_token: getToken() }).then(function (v) { tg.view = v; renderTg(); })
      .catch(function () { tgMsg("ما گدرنا نجيب التبليغات."); });
  }
  function renderTg() {
    var v = tg.view; if (!v) return;
    $("tg-status").innerHTML =
      '<div class="tg-row"><span>المجموعة</span><b>' + (v.group_linked ? esc(v.group_title || "مربوطة") : "بعدها ما مربوطة") + "</b>" +
        '<button type="button" class="cbtn join" data-tg="link">' + (v.group_linked ? "إعادة الربط" : "ربط المجموعة") + "</button></div>" +
      '<div class="tg-row"><span>التبليغات</span><b>' + (v.enabled ? "شغالة" : "موقفة") + "</b>" +
        '<button type="button" class="cbtn ' + (v.enabled ? "leave" : "join") + '" data-tg="toggle">' + (v.enabled ? "إيقاف" : "تشغيل") + "</button></div>" +
      (v.group_linked ? "" : '<p class="note">ضيف البوت @a9_group_bot للمجموعة وسويه أدمن، واكتب بالمجموعة /start@a9_group_bot، وبعدين دوس "ربط المجموعة".</p>');
    var items = v.items || [];
    $("tg-list").innerHTML = items.length ? items.map(function (it) {
      var past = it.day <= v.today && !it.sent_at;
      var st = it.status === "ok" ? '<span class="tag preg">انرسل</span>'
        : it.status === "pending" ? '<span class="tag special">يندز هسه</span>'
        : it.status ? '<span class="tag cons" title="' + esc(it.status) + '">ما انرسل</span>'
        : past ? '<span class="tag">فات</span>' : '<span class="tag lab">جاي</span>';
      var head = '<div class="tg-head"><b>' + esc(tgDayLabel(it.day)) + "</b>" + (it.auto ? "" : '<span class="tag gold">معدّل</span>') + st + "</div>";
      var note = '<p class="note">ينرسل ليلة ' + esc(tgDayLabel(prevDay(it.day))) + " الساعة 11 المسا</p>";
      if (tg.editing === it.day) {
        return '<div class="tg-item editing">' + head +
          '<textarea id="tg-edit" class="tg-text" rows="8" maxlength="3500">' + esc(it.body) + "</textarea>" +
          '<div class="tg-btns"><button type="button" class="cbtn join" data-tg="save" data-day="' + it.day + '">حفظ</button>' +
          '<button type="button" class="cbtn" data-tg="cancel">إلغاء</button></div></div>';
      }
      var done = !!it.sent_at || it.day <= v.today;
      return '<div class="tg-item' + (done ? " done" : "") + '">' + head + (done ? "" : note) +
        '<pre class="tg-text">' + esc(it.body) + "</pre>" +
        (it.status && it.status !== "ok" && it.status !== "pending" ? '<p class="note">السبب: ' + esc(it.status) + "</p>" : "") +
        (done ? "" : '<div class="tg-btns"><button type="button" class="cbtn join" data-tg="edit" data-day="' + it.day + '">تعديل</button>' +
          '<button type="button" class="cbtn" data-tg="test" data-day="' + it.day + '">تجربة بالخاص</button>' +
          (it.auto ? "" : '<button type="button" class="cbtn leave" data-tg="reset" data-day="' + it.day + '">رجع للنص التلقائي</button>') + "</div>") +
        "</div>";
    }).join("") : '<p class="note center-text">ماكو تبليغات جاية.</p>';
  }
  function prevDay(iso) { var a = iso.split("-"), dt = new Date(+a[0], +a[1] - 1, +a[2] - 1); return dt.getFullYear() + "-" + ("0" + (dt.getMonth() + 1)).slice(-2) + "-" + ("0" + dt.getDate()).slice(-2); }
  function tgWait(req, link, tries) {
    return new Promise(function (res) { setTimeout(res, 1500); }).then(function () {
      return rpc("a9_admin_tg_req", { p_token: getToken(), p_req: req, p_link: link });
    }).then(function (r) {
      if (r && r.done) return r;
      if (tries <= 1) return { done: true, status: "تيليغرام ما جاوب، جرب بعد شوية." };
      return tgWait(req, link, tries - 1);
    });
  }
  function onTgClick(e) {
    var b = e.target.closest("[data-tg]"); if (!b) return;
    var act = b.dataset.tg, day = b.dataset.day, v = tg.view;
    var it = v && (v.items || []).filter(function (x) { return x.day === day; })[0];
    if (act === "edit") { tg.editing = day; renderTg(); var ta = $("tg-edit"); if (ta) ta.focus(); return; }
    if (act === "cancel") { tg.editing = null; renderTg(); return; }
    var done = function (r) { loading(false); if (r && r.ok === false) tgMsg(TG_ERR[r.error] || "صار خطأ، جرب مرة ثانية."); return r; };
    var fail = function () { loading(false); tgMsg("صار خطأ بالاتصال، جرب مرة ثانية."); };
    tgMsg(""); loading(true);
    if (act === "save" || act === "reset") {
      var body = act === "save" ? $("tg-edit").value : tgAuto(day);
      if (act === "reset" && !body) { loading(false); tgMsg("هذا اليوم ما موجود بالجدول."); return; }
      rpc("a9_admin_tg_edit", { p_token: getToken(), p_day: day, p_body: body, p_auto: act === "reset" || body === tgAuto(day) }).then(done)
        .then(function (r) { if (r && r.ok) { tg.editing = null; tgMsg(act === "save" ? "انحفظ التعديل" : "رجع النص التلقائي"); return loadTg(); } }).catch(fail);
    } else if (act === "toggle") {
      rpc("a9_admin_tg_enable", { p_token: getToken(), p_on: !v.enabled }).then(done).then(loadTg).catch(fail);
    } else if (act === "test") {
      rpc("a9_admin_tg_test", { p_token: getToken(), p_day: day }).then(done).then(function (r) {
        if (!r || !r.ok) return;
        loading(true);
        return tgWait(r.req, false, 8).then(function (w) { loading(false); tgMsg(w.status === "ok" ? "وصلك التبليغ بالخاص بالتيليغرام" : "ما وصل: " + w.status); });
      }).catch(fail);
    } else if (act === "link") {
      rpc("a9_admin_tg_link", { p_token: getToken() }).then(done).then(function (r) {
        if (!r || !r.ok) return;
        loading(true);
        return tgWait(r.req, true, 8).then(function (w) {
          loading(false);
          if (w.status === "ok") { tgMsg("انربطت المجموعة: " + (w.title || "")); return loadTg(); }
          tgMsg(w.status === "no_group" ? "ما لگينا المجموعة. تأكد إن البوت مضاف وأدمن، واكتب بالمجموعة /start@a9_group_bot وجرب مرة ثانية." : "ما انربطت: " + w.status);
        });
      }).catch(fail);
    } else loading(false);
  }

  function openGpAdmin() { gpMsg(""); loadGallery().then(renderGpAdmin).catch(function () { gpMsg("ما گدرنا نجيب الصور."); }); }

  function onGroupPhotos(e) {
    var files = Array.prototype.slice.call(e.target.files || []).filter(function (f) { return /^image\//.test(f.type); });
    e.target.value = "";
    if (!files.length) return;
    var done = 0, failed = 0;
    loading(true);
    files.reduce(function (p, f) {
      return p.then(function () {
        gpMsg("جاري الرفع " + (done + failed + 1) + " من " + files.length);
        return resizeImage(f, 1200).then(function (data) {
          return rpc("a9_admin_add_group_photo", { p_token: getToken(), p_photo: data }).then(function (res) {
            if (res && res.ok) { done++; gallery.data[res.id] = data; try { localStorage.setItem(GP_CACHE + res.id, data); } catch (x) {} }
            else failed++;
          });
        }).catch(function () { failed++; });
      });
    }, Promise.resolve()).then(function () {
      loading(false);
      gpMsg("انرفعت " + done + " صورة" + (failed ? "، وما انرفعت " + failed : ""));
      return loadGallery().then(renderGpAdmin);
    });
  }

  function removeGroupPhoto(id) {
    if (!confirm("تحذف هاي الصورة؟")) return;
    loading(true);
    rpc("a9_admin_remove_group_photo", { p_token: getToken(), p_id: id }).then(function (res) {
      loading(false);
      if (res && res.ok) { delete gallery.data[id]; try { localStorage.removeItem(GP_CACHE + id); } catch (x) {} gpMsg("انحذفت الصورة"); }
      else gpMsg("ما انحذفت الصورة.");
      return loadGallery().then(renderGpAdmin);
    }).catch(function () { loading(false); gpMsg("صار خطأ بالاتصال."); });
  }

  // ---------- consultation groups ----------
  var CAP = { F: 5, M: 4, total: 8 };
  var consult = null;
  var CONSULT_ERR = {
    locked: "المجاميع تثبتت، ما تگدر تبدل. راجع الممثل.",
    not_open: "الانضمام بعده ما انفتح.",
    full: "هالمجموعة تعبت لجنسك.",
    already_in_group: "هذا الطالب صار بمجموعة.",
    not_in_group: "لازم تنضم لمجموعة أول.",
    bad_friend: "تگدر تضيف بس من نفس جنسك."
  };

  function openRotGyn() {
    var s = window.A9_gynSummary();
    $("rot-gyn-sub").textContent = "خلصت " + s.done + " من " + s.total + " سشن";
    rpc("a9_consult_view", { p_token: getToken() }).then(function (v) {
      var soon = !v.is_admin && v.opens_at && v.now && new Date(v.opens_at) > new Date(v.now);
      $("tile-consult-sub").textContent = v.my_group ? "إنت بالمجموعة " + v.my_group : (v.locked ? "المجاميع تثبتت" : soon ? "يفتح الساعة " + new Date(v.opens_at).toLocaleTimeString("ar-IQ", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Baghdad" }) : "اختار مجموعتك");
    }).catch(function () {});
  }

  var clockSkew = 0, openTimer = null;
  function consultLoad() {
    return Promise.all([rpc("a9_consult_view", { p_token: getToken() }), loadMembers().catch(function () { return []; })]).then(function (res) {
      var v = res[0];
      var fill = function (x) { var m = memberById(x.id); if (!x.avatar && m) x.avatar = m.avatar; };
      (v.groups || []).forEach(function (g) { (g.members || []).forEach(fill); });
      (v.unassigned || []).forEach(fill);
      consult = v;
      if (v.now) clockSkew = new Date(v.now).getTime() - Date.now(); // نعتمد وقت السيرفر مو ساعة الموبايل
      renderConsult();
      startOpenTimer();
    });
  }
  function msToOpen() {
    if (!consult || !consult.opens_at) return 0;
    return new Date(consult.opens_at).getTime() - (Date.now() + clockSkew);
  }
  function notOpenYet() { return !consult.is_admin && msToOpen() > 0; }
  function startOpenTimer() {
    clearInterval(openTimer);
    if (msToOpen() <= 0) return;
    openTimer = setInterval(function () {
      if ($("consult").hidden) { clearInterval(openTimer); return; }
      if (msToOpen() <= 0) { clearInterval(openTimer); consultLoad(); return; }
      var el = $("open-count"); if (el) el.textContent = fmtLeft(msToOpen());
    }, 1000);
  }
  function fmtLeft(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    var two = function (n) { return (n < 10 ? "0" : "") + n; };
    return (h ? h + ":" + two(m) : m) + ":" + two(ss);
  }
  function openConsult() {
    $("consult-groups").innerHTML = "";
    $("consult-status").innerHTML = "";
    $("friend-search").value = "";
    loading(true);
    consultLoad().then(function () { loading(false); }).catch(function () {
      loading(false);
      $("consult-groups").innerHTML = '<p class="error">ما گدرنا نجيب المجاميع.</p>';
    });
  }

  function consultCall(fn, args, okMsg) {
    loading(true);
    args.p_token = getToken();
    return rpc(fn, args).then(function (res) {
      loading(false);
      if (res && res.ok) return consultLoad();
      alert(CONSULT_ERR[res && res.error] || "ما صار، جرب مرة ثانية.");
      return consultLoad();
    }).catch(function () { loading(false); alert("صار خطأ بالاتصال."); });
  }

  // الحد لكل مجموعة: التوزيع متساوي (17 بنية = 5،4،4،4 · 14 ولد = 4،4،3،3)
  function capFor(gr, gender) {
    var v = consult;
    var total = gender === "F" ? v.girls_total : v.boys_total;
    if (total == null) return CAP[gender];
    var key = gender === "F" ? "girls" : "boys";
    var base = Math.floor(total / 4), extra = total % 4;
    var over = v.groups.filter(function (x) { return x[key] > base; }).length;
    return gr[key] > base || over < extra ? base + 1 : base;
  }

  function renderConsult() {
    var v = consult, admin = v.is_admin, g = v.my_gender;
    var other = g === "F" ? "ولد" : "بنات";
    // status
    var waiting = notOpenYet();
    var openLabel = v.opens_at ? new Date(v.opens_at).toLocaleTimeString("ar-IQ", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Baghdad" }) : "";
    $("consult-status").innerHTML =
      (waiting ? '<div class="open-banner"><div>الانضمام يفتح الساعة <b>' + openLabel + '</b> بتوقيت بغداد</div><span>باقي <b id="open-count">' + fmtLeft(msToOpen()) + "</b></span></div>" : "") +
      (v.locked ? '<div class="cstat locked">المجاميع تثبتت</div>' : waiting ? '<div class="cstat none">بعده ما انفتح</div>' : '<div class="cstat open">الاختيار مفتوح</div>') +
      (v.my_group ? '<div class="cstat mine">إنت بالمجموعة ' + v.my_group + "</div>" : '<div class="cstat none">بعدك ما اخترت مجموعة</div>');

    // groups
    $("consult-groups").innerHTML = v.groups.map(function (gr) {
      var mine = v.my_group === gr.no;
      var myCount = g === "F" ? gr.girls : gr.boys;
      var room = myCount < capFor(gr, g) && gr.girls + gr.boys < CAP.total;
      var repG = v.rep_group === gr.no;
      var btn = "";
      if (waiting) btn = "";
      else if (!v.locked) {
        if (mine) btn = '<button type="button" class="cbtn leave" data-leave="1">مغادرة</button>';
        else if (room) btn = '<button type="button" class="cbtn join" data-join="' + gr.no + '">' + (v.my_group ? "انتقال لهنا" : "انضمام") + "</button>";
        else btn = '<span class="cfull">تعبت</span>';
      }
      var members = gr.members.map(function (m) {
        var sel = admin ? '<select class="cmove" data-move="' + m.id + '">' +
          [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '"' + (n === gr.no ? " selected" : "") + ">" + n + "</option>"; }).join("") +
          '<option value="">برة</option></select>' : "";
        return '<div class="cmember' + (admin ? " g-" + m.gender : "") + '">' + avatar(m) + '<span class="nm">' + esc(m.name) + "</span>" +
          (m.is_admin ? '<span class="tag gold">الممثل</span>' : "") + (state.me && m.id === state.me.id ? '<span class="tag special">أنت</span>' : "") + sel + "</div>";
      }).join("");
      var counts = admin
        ? '<span class="chip-n">بنات ' + gr.girls + "/" + capFor(gr, "F") + '</span><span class="chip-n">ولد ' + gr.boys + "/" + capFor(gr, "M") + "</span>"
        : '<span class="chip-n">' + (g === "F" ? "بنات " + gr.girls + "/" + capFor(gr, "F") : "ولد " + gr.boys + "/" + capFor(gr, "M")) + '</span><span class="chip-n muted-chip">' + other + " " + (g === "F" ? gr.boys : gr.girls) + "</span>";
      return '<section class="cgroup' + (mine ? " mine" : "") + (repG ? " rep-group" : "") + '">' +
        '<div class="cg-head"><b>المجموعة ' + gr.no + (repG ? ' <span class="rep-label">مجموعة الممثل</span>' : "") + "</b>" + btn + "</div>" +
        '<div class="cg-counts">' + counts + "</div>" +
        '<div class="cg-members">' + (members || '<p class="note" style="margin:6px 0">' + (admin ? "ماكو أحد بعد" : "ماكو " + (g === "F" ? "بنات" : "ولد") + " بعد") + "</p>") + "</div>" +
        "</section>";
    }).join("");

    // friends
    var canAdd = !v.locked && v.my_group && !waiting;
    $("consult-friends").hidden = !canAdd || admin;
    if (canAdd && !admin) renderFriends();

    // admin panel
    $("consult-admin").hidden = !admin;
    if (admin) {
      var un = v.unassigned;
      $("consult-admin").innerHTML =
        '<h2 class="card-title">إدارة المجاميع</h2>' +
        '<button type="button" class="btn ghost print-btn" data-print="1">إصدار ورقة A4 للمجاميع</button>' +
        '<button type="button" class="btn ' + (v.locked ? "ghost" : "") + '" data-lock="' + (v.locked ? "0" : "1") + '">' + (v.locked ? "فتح المجاميع للتبديل" : "تثبيت المجاميع") + "</button>" +
        '<h3 class="sub-title">ما اختاروا (' + un.length + ")</h3>" +
        (un.length ? un.map(function (s) {
          return '<div class="cmember g-' + s.gender + '">' + avatar(s) + '<span class="nm">' + esc(s.name) + "</span>" +
            '<select class="cmove" data-move="' + s.id + '"><option value="" selected>وزّع</option>' +
            [1, 2, 3, 4].map(function (n) { return '<option value="' + n + '">' + n + "</option>"; }).join("") + "</select></div>";
        }).join("") : '<p class="note">الكل اختاروا.</p>');
    }
  }

  function renderFriends() {
    var mine = consult.groups.filter(function (x) { return x.no === consult.my_group; })[0];
    var g = consult.my_gender;
    var full = mine && ((g === "F" ? mine.girls : mine.boys) >= capFor(mine, g) || mine.girls + mine.boys >= CAP.total);
    $("friend-search").hidden = !!full;
    if (full) { $("friend-list").innerHTML = '<p class="note">مجموعتك تعبت، ما تگدر تضيف أكثر.</p>'; return; }
    var q = $("friend-search").value.trim();
    var list = consult.unassigned.filter(function (s) { return !q || s.name.indexOf(q) !== -1; });
    $("friend-list").innerHTML = list.length ? list.map(function (s) {
      return '<div class="cmember">' + avatar(s) + '<span class="nm">' + esc(s.name) + '</span><button type="button" class="cbtn join" data-add="' + s.id + '">إضافة</button></div>';
    }).join("") : '<p class="note">' + (q ? "ماكو اسم بهذا البحث" : "الكل منضمين لمجاميع") + "</p>";
  }

  function onConsultClick(e) {
    var b = e.target.closest("button"); if (!b || !consult) return;
    if (b.dataset.join) consultCall("a9_consult_join", { p_group: Number(b.dataset.join) });
    else if (b.dataset.leave) { if (confirm("تطلع من مجموعتك؟")) consultCall("a9_consult_leave", {}); }
    else if (b.dataset.add) consultCall("a9_consult_add_friend", { p_friend: Number(b.dataset.add) });
    else if (b.dataset.print) printConsult();
    else if (b.dataset.lock) {
      var lock = b.dataset.lock === "1";
      if (confirm(lock ? "تثبت المجاميع؟ ما أحد يگدر يبدل بعدها." : "تفتح المجاميع للتبديل؟")) consultCall("a9_admin_consult_lock", { p_locked: lock });
    }
  }
  // ورقة A4: كل المجاميع بأسماء الطلاب (للممثل)
  function printConsult() {
    var v = consult;
    var today = new Date().toLocaleDateString("ar-IQ", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Baghdad" });
    var byName = function (a, b) { return a.name.localeCompare(b.name, "ar"); };
    var groupHtml = v.groups.map(function (gr) {
      var girls = gr.members.filter(function (m) { return m.gender === "F"; }).sort(byName);
      var boys = gr.members.filter(function (m) { return m.gender === "M"; }).sort(byName);
      var n = 0;
      var row = function (m) {
        n++;
        return "<tr><td class=\"n\">" + n + "</td><td>" + esc(m.name) + (m.is_admin ? " <span class=\"p-rep\">الممثل</span>" : "") + "</td><td class=\"sig\"></td></tr>";
      };
      return '<section class="p-group' + (v.rep_group === gr.no ? " rep" : "") + '">' +
        "<h2>المجموعة " + gr.no + (v.rep_group === gr.no ? " &middot; مجموعة الممثل" : "") + "</h2>" +
        '<p class="p-count">' + (gr.girls + gr.boys) + " طلاب &middot; " + gr.girls + " بنات &middot; " + gr.boys + " ولد</p>" +
        "<table><thead><tr><th class=\"n\">ت</th><th>الاسم</th><th class=\"sig\">الحضور</th></tr></thead><tbody>" +
        (girls.length ? '<tr class="p-sub"><td colspan="3">البنات</td></tr>' + girls.map(row).join("") : "") +
        (boys.length ? '<tr class="p-sub"><td colspan="3">الولد</td></tr>' + boys.map(row).join("") : "") +
        (!girls.length && !boys.length ? '<tr><td colspan="3" class="p-empty">ماكو أحد</td></tr>' : "") +
        "</tbody></table></section>";
    }).join("");
    var un = v.unassigned || [];
    $("print-sheet").innerHTML =
      '<header class="p-head"><div><h1>مجموعات الاستشارية</h1><p>روتة النسائية والتوليد &middot; مجموعة A9 &middot; المرحلة الخامسة</p></div>' +
      '<div class="p-date">' + today + (v.locked ? "<br>المجاميع مثبتة" : "<br>المجاميع غير مثبتة بعد") + "</div></header>" +
      '<div class="p-grid">' + groupHtml + "</div>" +
      (un.length ? '<p class="p-un"><b>بدون مجموعة (' + un.length + "):</b> " + un.map(function (s) { return esc(s.name); }).join("، ") + "</p>" : "");
    setTimeout(function () { window.print(); }, 50);
  }

  function onConsultMove(e) {
    var s = e.target.closest("select.cmove"); if (!s) return;
    var g = s.value === "" ? null : Number(s.value);
    consultCall("a9_admin_consult_assign", { p_student: Number(s.dataset.move), p_group: g });
  }

  // ---------- midterm results ----------
  var EXAM = "mid1";
  var SUBJ_NAME = { ent: "ENT", eye: "العيون", ortho: "الكسور" };
  var exam = { subj: "ent", mine: null, stage: {}, group: {}, showAll: false, sort: "abc" };
  function byName(a, b) { return a.name.localeCompare(b.name, "ar"); }
  function fmtNum(x) { return x == null ? "—" : String(Number(x)); }
  function pct(g, mx) { return g == null ? 0 : Math.round(Number(g) / Number(mx) * 100); }

  function renderExamMini() {
    rpc("a9_exam_mine", { p_token: getToken(), p_exam: EXAM }).then(function (rows) {
      exam.mine = rows || [];
      if (!exam.mine.length) return;
      $("exam-mini").innerHTML = ["ent", "eye", "ortho"].map(function (s) {
        var r = exam.mine.filter(function (x) { return x.subject === s; })[0];
        return r ? SUBJ_NAME[s] + ' <bdi dir="ltr">' + fmtNum(r.grade) + "/" + fmtNum(r.max_grade) + "</bdi>" : "";
      }).filter(Boolean).join(" &middot; ");
    }).catch(function () {});
  }

  function openExam() {
    exam.showAll = false; $("stage-search").value = "";
    Array.prototype.forEach.call($("subj-tabs").children, function (b) { b.classList.toggle("on", b.dataset.subj === exam.subj); });
    var mine = exam.mine ? Promise.resolve(exam.mine) : rpc("a9_exam_mine", { p_token: getToken(), p_exam: EXAM }).then(function (r) { exam.mine = r || []; return exam.mine; });
    loading(true);
    Promise.all([mine, loadMembers().catch(function () { return []; })]).then(function () { loading(false); renderExam(); })
      .catch(function () { loading(false); $("my-exam").innerHTML = '<p class="error">ما گدرنا نجيب النتائج.</p>'; });
  }

  function renderExam() {
    var s = exam.subj;
    var r = (exam.mine || []).filter(function (x) { return x.subject === s; })[0];
    $("my-exam").innerHTML = r
      ? '<span class="grade-label">درجتك بـ' + SUBJ_NAME[s] + "</span>" +
        '<div class="grade-big">' + fmtNum(r.grade) + ' <small>/ ' + fmtNum(r.max_grade) + "</small></div>" +
        '<div class="bar"><i style="width:' + pct(r.grade, r.max_grade) + '%"></i></div>' +
        (exam.sort === "grade" ? '<div class="rank-row">' +
          '<div><b>' + r.group_rank + ' <small>من ' + r.group_total + '</small></b><span>ترتيبك بالمجموعة</span></div>' +
          '<div><b>' + r.stage_rank + ' <small>من ' + r.stage_total + '</small></b><span>ترتيبك بالمرحلة</span></div>' +
        "</div>" : "") +
        '<div class="avg-row"><span>معدل المجموعة <b>' + fmtNum(r.group_avg) + '</b></span><span>معدل المرحلة <b>' + fmtNum(r.stage_avg) + "</b></span></div>"
      : '<p class="note center-text">ما لگينا درجتك بهالمادة.</p>';
    loadExamGroup(); loadExamStage();
  }

  function gradeRow(rank, person, g, mx, mine, ours) {
    return '<div class="grow exam-row' + (mine ? " mine" : ours ? " ours" : "") + '">' +
      (exam.sort === "grade" ? '<span class="rk">' + rank + "</span>" : "") + (person.id ? avatar(person) : "") +
      '<span class="nm">' + esc(person.name) + (mine ? ' <span class="tag special">أنت</span>' : "") + "</span>" +
      '<span class="gcell"><b class="gval">' + fmtNum(g) + '</b><span class="mini-bar"><i style="width:' + pct(g, mx) + '%"></i></span></span></div>';
  }

  function loadExamGroup() {
    var s = exam.subj;
    var draw = function (rows) {
      if (exam.subj !== s) return;
      var rank = 0, prev = null, i = 0;
      var ranked = rows.map(function (x) { i++; if (x.grade !== prev) { rank = i; prev = x.grade; } return Object.assign({ rank: rank }, x); });
      if (exam.sort === "abc") ranked.sort(byName);
      $("exam-group").innerHTML = ranked.map(function (x) {
        var m = memberById(x.id) || x;
        return gradeRow(x.rank, { id: x.id, name: x.name, avatar: m.avatar }, x.grade, x.max_grade, state.me && x.id === state.me.id, false);
      }).join("");
    };
    if (exam.group[s]) return draw(exam.group[s]);
    rpc("a9_exam_group", { p_token: getToken(), p_exam: EXAM, p_subject: s }).then(function (rows) { exam.group[s] = rows || []; draw(exam.group[s]); })
      .catch(function () { $("exam-group").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب درجات المجموعة.</p>'; });
  }

  function loadExamStage() {
    var s = exam.subj;
    if (exam.stage[s]) return drawStage();
    $("exam-stage").innerHTML = '<p class="note center-text" style="padding:16px">جاري التحميل</p>';
    rpc("a9_exam_stage", { p_token: getToken(), p_exam: EXAM, p_subject: s }).then(function (rows) {
      var rank = 0, prev = null;
      exam.stage[s] = (rows || []).map(function (x, i) { if (x.grade !== prev) { rank = i + 1; prev = x.grade; } x.rank = rank; return x; });
      if (exam.subj === s) drawStage();
    }).catch(function () { $("exam-stage").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب درجات المرحلة.</p>'; });
  }

  function drawStage() {
    var rows = exam.stage[exam.subj] || [];
    var q = $("stage-search").value.trim();
    var list = q ? rows.filter(function (x) { return x.name.indexOf(q) !== -1; }) : rows.slice();
    if (exam.sort === "abc") list.sort(byName);
    var limit = q || exam.showAll ? list.length : 50;
    var myName = state.me ? state.me.name : "";
    $("stage-count").textContent = "(" + rows.length + " طالب)";
    $("exam-stage").innerHTML = list.slice(0, limit).map(function (x) {
      return gradeRow(x.rank, { name: x.name }, x.grade, x.max_grade, x.ours && x.name === myName, x.ours);
    }).join("") || '<p class="note center-text" style="padding:16px">ماكو اسم بهذا البحث</p>';
    $("stage-more").hidden = !!q || exam.showAll || list.length <= 50;
    $("stage-more").textContent = "عرض الكل (" + list.length + ")";
  }

  // ---------- XO game ----------
  var LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function xoWinner(b) {
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i];
      if (b[l[0]] !== "." && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { w: b[l[0]], line: l };
    }
    return b.indexOf(".") === -1 ? { w: "D", line: [] } : null;
  }
  // الكمبيوتر: صعب = minimax (ما يخسر)، سهل = أحياناً يغلط
  function minimax(b, me, turn, depth) {
    var r = xoWinner(b);
    if (r) return { s: r.w === me ? 10 - depth : r.w === "D" ? 0 : depth - 10 }; // يفضّل الفوز الأسرع والخسارة الأبطأ
    var best = { s: turn === me ? -99 : 99, i: -1 };
    for (var i = 0; i < 9; i++) if (b[i] === ".") {
      var s = minimax(b.slice(0, i) + turn + b.slice(i + 1), me, turn === "X" ? "O" : "X", depth + 1).s;
      if (turn === me ? s > best.s : s < best.s) best = { s: s, i: i };
    }
    return best;
  }
  function aiMove(b, me, level) {
    var free = []; for (var i = 0; i < 9; i++) if (b[i] === ".") free.push(i);
    if (level === "easy" && Math.random() < 0.55) return free[Math.floor(Math.random() * free.length)];
    if (free.length === 9) return [0, 2, 4, 6, 8][Math.floor(Math.random() * 5)];
    return minimax(b, me, me, 0).i;
  }

  var xo = { mode: null, board: ".........", turn: "X", level: "hard", game: null, poll: null, busy: false, scores: { X: 0, O: 0, D: 0 } };
  function stopXoPoll() { clearInterval(xo.poll); xo.poll = null; }

  function drawBoard(board, winLine, clickable) {
    $("xo-board").innerHTML = board.split("").map(function (c, i) {
      var win = winLine && winLine.indexOf(i) !== -1;
      return '<button type="button" class="xo-cell' + (c === "X" ? " x" : c === "O" ? " o" : "") + (win ? " win" : "") + '" data-cell="' + i + '"' +
        (!clickable || c !== "." ? " disabled" : "") + ">" + (c === "." ? "" : c) + "</button>";
    }).join("");
  }
  function playerChip(p, mark, active) {
    return '<div class="xo-p' + (active ? " active" : "") + '">' + (p.id ? avatar(p) : '<span class="avatar xo-av ' + (mark === "O" ? "o" : "") + '">' + esc(p.name[0] || "") + "</span>") +
      '<b>' + esc(p.name) + '</b><span class="xo-mark ' + (mark === "O" ? "o" : "x") + '">' + mark + "</span></div>";
  }

  // ----- local: AI / friend -----
  function openXoLocal(mode) {
    if (window.A9C) window.A9C.unmount();
    xo.mode = mode; xo.board = "........."; xo.turn = "X"; xo.game = null; xo.scores = { X: 0, O: 0, D: 0 };
    $("xo-level").hidden = mode !== "ai";
    Array.prototype.forEach.call($("xo-level").children, function (b) { b.classList.toggle("on", b.dataset.level === xo.level); });
    renderLocal();
  }
  function renderLocal() {
    var me = state.me ? { id: state.me.id, name: state.me.name.split(" ")[0], avatar: state.me.avatar } : { name: "أنت" };
    var px = xo.mode === "ai" ? me : { name: "لاعب X" }, po = xo.mode === "ai" ? { name: "الكمبيوتر" } : { name: "لاعب O" };
    var r = xoWinner(xo.board);
    $("xo-players").innerHTML = playerChip(px, "X", !r && xo.turn === "X") + '<div class="xo-score">' + xo.scores.O + " - " + xo.scores.X + "</div>" + playerChip(po, "O", !r && xo.turn === "O");
    var status = r ? (r.w === "D" ? "تعادل" : xo.mode === "ai" ? (r.w === "X" ? "فزت!" : "فاز الكمبيوتر") : "فاز " + r.w + "!") :
      (xo.mode === "ai" ? (xo.turn === "X" ? "دورك" : "الكمبيوتر يفكر...") : "دور " + xo.turn);
    $("xo-status").textContent = status;
    $("xo-status").className = "xo-status" + (r && r.w !== "D" && (xo.mode !== "ai" || r.w === "X") ? " won" : r && xo.mode === "ai" && r.w === "O" ? " lost" : "");
    drawBoard(xo.board, r && r.line, !r && (xo.mode === "friend" || xo.turn === "X"));
    $("xo-actions").innerHTML = r ? '<button type="button" class="btn" data-xo="again">جولة ثانية</button>' : '<button type="button" class="btn ghost" data-xo="again">إعادة</button>';
  }
  function localMove(i) {
    if (xo.board[i] !== "." || xoWinner(xo.board)) return;
    xo.board = xo.board.slice(0, i) + xo.turn + xo.board.slice(i + 1);
    xo.turn = xo.turn === "X" ? "O" : "X";
    var r = xoWinner(xo.board); if (r) xo.scores[r.w === "D" ? "D" : r.w]++;
    renderLocal();
    if (!r && xo.mode === "ai" && xo.turn === "O") {
      setTimeout(function () {
        if (xo.mode !== "ai" || xo.turn !== "O") return;
        localMove(aiMove(xo.board, "O", xo.level));
      }, 450);
    }
  }

  // ----- online -----
  var xoHome = { timer: null, myOpen: null };
  function openXoHome() {
    $("xo-search").value = "";
    loadMembers().then(renderXoPeople).catch(function () {});
    xoHome.myOpen = null;
    refreshXoHome(true);
    clearInterval(xoHome.timer);
    // تحديث كل 8 ثواني وإنت بصفحة اللعبة: حتى تبين المباريات المفتوحة الجديدة، وتختفي المنتهية
    xoHome.timer = setInterval(function () {
      if (location.hash !== "#xo") { clearInterval(xoHome.timer); return; }
      if (!document.hidden) refreshXoHome(false);
    }, 8000);
  }
  function refreshXoHome(first) {
    return loadMembers().catch(function () {}).then(function () { return rpc("a9_xo_list", { p_token: getToken() }); }).then(function (d) {
      if (location.hash !== "#xo") return;
      // صاحب المباراة المفتوحة: إذا أحد دخل، ننقله للعبة مباشرة
      if (!first && xoHome.myOpen && !d.my_open) {
        var g0 = (d.games || []).filter(function (g) { return g.status === "active"; })[0];
        xoHome.myOpen = null;
        if (g0) { location.hash = "xo/" + g0.id; return; }
      }
      xoHome.myOpen = d.my_open || null;
      $("xo-stats").innerHTML = '<div><b>' + d.wins + '</b><span>فوز</span></div><div><b>' + d.losses + '</b><span>خسارة</span></div><div><b>' + d.draws + "</b><span>تعادل</span></div>";
      var mine = d.my_open
        ? '<div class="xo-game hot">' + avatar(state.me || { name: "" }) + '<div class="ainfo"><b>مباراتك مفتوحة</b><span class="note">بانتظار أي طالب يدخل يلعب ضدك</span></div>' +
          '<button type="button" class="cbtn leave" data-opencancel="' + d.my_open + '">إلغاء</button></div>'
        : '<div class="xo-game"><div class="ainfo"><b>سوّي مباراة مفتوحة</b></div>' +
          '<button type="button" class="cbtn join" data-opencreate="1">سوّي</button></div>';
      var others = (d.open || []).map(function (o) {
        var c = o.creator;
        return '<div class="xo-game">' + avatar(memberById(c.id) || c) + '<div class="ainfo"><b>' + esc(c.name) + '</b><span class="note">يدور خصم</span></div>' +
          '<button type="button" class="cbtn join" data-openjoin="' + o.id + '">العب ضده</button></div>';
      }).join("");
      $("xo-open").innerHTML = mine + others;
      var games = d.games || [];
      $("xo-games").innerHTML = games.length ? games.map(function (g) {
        var op = g.opponent || { name: "" }, st, cls = "";
        if (g.status === "pending") { st = g.incoming ? "يتحداك" : "بانتظار قبوله"; cls = g.incoming ? " hot" : ""; }
        else if (g.status === "active") { st = g.turn === g.me ? "دورك" : "دوره"; cls = g.turn === g.me ? " hot" : ""; }
        else if (g.status === "done") st = g.winner === "D" ? "تعادل" : g.winner === g.me ? "فزت" : "خسرت";
        else st = g.status === "declined" ? "رفض التحدي" : "انلغت، ما صار لعب نص ساعة";
        var btns = g.incoming ? '<button type="button" class="cbtn join" data-accept="' + g.id + '">قبول</button><button type="button" class="cbtn leave" data-decline="' + g.id + '">رفض</button>'
                              : '<a class="cbtn join" href="#xo/' + g.id + '">' + (g.status === "active" ? "العب" : "فتح") + "</a>";
        return '<div class="xo-game' + cls + '">' + avatar(memberById(op.id) || op) + '<div class="ainfo"><b>' + esc(op.name) + '</b><span class="note">' + st + "</span></div>" + btns + "</div>";
      }).join("") : '<p class="note center-text" style="padding:16px">ماكو تحديات. اختار طالب من تحت وتحداه.</p>';
      var hot = games.filter(function (g) { return g.incoming || (g.status === "active" && g.turn === g.me); }).length;
      $("games-mini").textContent = hot ? hot + " تحدي ينتظرك" : "XO · الجدران · الشيطان · 9no";
    }).catch(function () { if (first) $("xo-games").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب التحديات.</p>'; });
  }
  function renderXoPeople() {
    var q = $("xo-search").value.trim();
    var list = (state.members || []).filter(function (m) { return (!state.me || m.id !== state.me.id) && m.joined && (!q || m.name.indexOf(q) !== -1); });
    $("xo-people").innerHTML = list.map(function (m) {
      return '<div class="cmember xo-person">' + avatar(m) + '<span class="nm">' + esc(m.name) + '</span><button type="button" class="cbtn join" data-challenge="' + m.id + '">تحدي</button></div>';
    }).join("") || '<p class="note center-text" style="padding:16px">ماكو اسم بهذا البحث</p>';
  }
  function openXoOnline(id) {
    xo.mode = "online"; xo.game = null; $("xo-level").hidden = true;
    $("xo-board").innerHTML = ""; $("xo-actions").innerHTML = ""; $("xo-status").textContent = "";
    var load = function () {
      return rpc("a9_xo_get", { p_token: getToken(), p_game: id }).then(function (g) {
        if (location.hash !== "#xo/" + id) return;
        var changed = !xo.game || xo.game.board !== g.board || xo.game.status !== g.status;
        xo.game = g; if (changed) renderOnline();
        if (window.A9C && g.opponent && g.opponent.id) window.A9C.mount($("xo-chat"), { kind: "dm", other: g.opponent.id, name: (g.opponent.name || "").split(" ")[0] });
      });
    };
    loadMembers().then(function () { if (xo.game && location.hash === "#xo/" + id) renderOnline(); }).catch(function () {});
    load().catch(function () { $("xo-status").textContent = "ما گدرنا نفتح اللعبة."; });
    stopXoPoll();
    xo.poll = setInterval(function () { if (!document.hidden) load().catch(function () {}); }, 2000);
  }
  function renderOnline() {
    var g = xo.game, me = g.me, op = g.opponent || { name: "" };
    var mine = state.me ? { id: state.me.id, name: state.me.name.split(" ")[0], avatar: state.me.avatar } : { name: "أنت" };
    var opm = memberById(op.id) || {};
    var opp = { id: op.id, name: (op.name || "").split(" ")[0], avatar: op.avatar || opm.avatar || null };
    var px = me === "X" ? mine : opp, po = me === "X" ? opp : mine;
    var live = g.status === "active";
    $("xo-players").innerHTML = playerChip(px, "X", live && g.turn === "X") + '<div class="xo-score">VS</div>' + playerChip(po, "O", live && g.turn === "O");
    var st = "", cls = "xo-status";
    if (g.status === "pending") st = g.incoming ? opp.name + " يتحداك" : "بانتظار " + opp.name + " يقبل التحدي";
    else if (live) st = g.turn === me ? "دورك" : "دور " + opp.name;
    else if (g.status === "done") { st = g.winner === "D" ? "تعادل" : g.winner === me ? "فزت!" : "فاز " + opp.name; cls += g.winner === me ? " won" : g.winner === "D" ? "" : " lost"; }
    else st = g.status === "declined" ? "انرفض التحدي" : "انلغت اللعبة لأن ما صار لعب نص ساعة";
    $("xo-status").textContent = st; $("xo-status").className = cls;
    var line = g.win_line ? g.win_line.split(",").map(function (n) { return Number(n) - 1; }) : null;
    drawBoard(g.board, line, live && g.turn === me);
    $("xo-actions").innerHTML = g.incoming && g.status === "pending"
      ? '<button type="button" class="btn" data-accept="' + g.id + '">قبول التحدي</button><button type="button" class="btn outline-danger" data-decline="' + g.id + '">رفض</button>'
      : g.status === "done" || g.status === "declined" ? '<button type="button" class="btn" data-xo="rematch">مباراة ثانية</button>' : "";
  }
  function onlineMove(i) {
    var g = xo.game; if (!g || xo.busy || g.status !== "active" || g.turn !== g.me || g.board[i] !== ".") return;
    xo.busy = true;
    g.board = g.board.slice(0, i) + g.me + g.board.slice(i + 1); g.turn = g.me === "X" ? "O" : "X"; renderOnline(); // تظهر فوراً
    rpc("a9_xo_move", { p_token: getToken(), p_game: g.id, p_cell: i + 1 }).then(function (res) {
      xo.busy = false;
      if (res && res.ok) { xo.game = res.game; renderOnline(); }
      else rpc("a9_xo_get", { p_token: getToken(), p_game: g.id }).then(function (fresh) { xo.game = fresh; renderOnline(); });
    }).catch(function () { xo.busy = false; alert("صار خطأ بالاتصال."); });
  }
  function xoRespond(id, accept) {
    rpc("a9_xo_respond", { p_token: getToken(), p_game: id, p_accept: accept }).then(function () {
      if (accept) location.hash = "xo/" + id; else openXoHome();
    });
  }
  function onXoClick(e) {
    var b = e.target.closest("button, a"); if (!b) return;
    if (b.dataset.mode) { location.hash = "xoplay/" + b.dataset.mode; return; }
    if (b.dataset.challenge) {
      loading(true);
      rpc("a9_xo_challenge", { p_token: getToken(), p_opponent: Number(b.dataset.challenge) }).then(function (r) {
        loading(false); if (r && r.ok) location.hash = "xo/" + r.id; else alert("ما گدرنا نرسل التحدي.");
      }).catch(function () { loading(false); });
      return;
    }
    if (b.dataset.opencreate) {
      loading(true);
      rpc("a9_xo_open_create", { p_token: getToken() }).then(function () { loading(false); return refreshXoHome(true); }).catch(function () { loading(false); });
      return;
    }
    if (b.dataset.opencancel) {
      xoHome.myOpen = null;
      rpc("a9_xo_open_cancel", { p_token: getToken(), p_open: Number(b.dataset.opencancel) }).then(function () { return refreshXoHome(true); });
      return;
    }
    if (b.dataset.openjoin) {
      loading(true);
      rpc("a9_xo_open_join", { p_token: getToken(), p_open: Number(b.dataset.openjoin) }).then(function (r) {
        loading(false);
        if (r && r.ok) location.hash = "xo/" + r.id;
        else { alert("سبقك أحد، أو صاحبها لغاها."); refreshXoHome(true); }
      }).catch(function () { loading(false); });
      return;
    }
    if (b.dataset.accept) return xoRespond(Number(b.dataset.accept), true);
    if (b.dataset.decline) return xoRespond(Number(b.dataset.decline), false);
    if (b.dataset.cell != null && !b.disabled) { var i = Number(b.dataset.cell); return xo.mode === "online" ? onlineMove(i) : localMove(i); }
    if (b.dataset.level) { xo.level = b.dataset.level; openXoLocal("ai"); return; }
    if (b.dataset.xo === "again") { xo.board = "........."; xo.turn = "X"; renderLocal(); return; }
    if (b.dataset.xo === "rematch" && xo.game) {
      rpc("a9_xo_rematch", { p_token: getToken(), p_game: xo.game.id }).then(function (r) { if (r && r.ok) location.hash = "xo/" + r.id; });
    }
  }

  // ---------- grades ----------
  var myGrades = null;
  function fmtGrade(g) {
    if (!g) return "—";
    if (g.status) return g.status;
    if (g.grade == null) return "—";
    return String(Number(g.grade)) + " / " + Number(g.max_grade || 10);
  }
  function loadMyGrades() {
    return rpc("a9_my_grades", { p_token: getToken() }).then(function (rows) {
      myGrades = {};
      (rows || []).forEach(function (r) { myGrades[r.rotation] = r; });
      return myGrades;
    });
  }
  function renderEntMini() {
    var g = myGrades && myGrades.ent;
    $("ent-mini").innerHTML = g ? "انتهت · درجتك " + (g.status ? esc(g.status) : '<bdi dir="ltr">' + esc(fmtGrade(g)) + "</bdi>") : "انتهت";
  }
  function openEnt() {
    $("ent-grade").textContent = "—"; $("ent-bar").style.width = "0";
    loadMyGrades().then(function () {
      var g = myGrades.ent;
      $("ent-grade").textContent = g ? fmtGrade(g) : "ما نزلت بعد";
      $("ent-grade").classList.toggle("held", !!(g && g.status));
      $("ent-bar").style.width = g && g.grade != null ? Math.round(g.grade / (g.max_grade || 10) * 100) + "%" : "0";
    }).catch(function () { $("ent-grade").textContent = "ما گدرنا نجيب الدرجة"; });

    var admin = state.me && state.me.is_admin;
    $("ent-admin").hidden = !admin;
    if (!admin) return;
    rpc("a9_admin_grades", { p_token: getToken(), p_rotation: "ent" }).then(withAvatars).then(function (rows) {
      rows = rows || [];
      var nums = rows.filter(function (r) { return r.grade != null; }).map(function (r) { return Number(r.grade); });
      var avg = nums.length ? (nums.reduce(function (a, b) { return a + b; }, 0) / nums.length) : 0;
      $("ent-stats").textContent = nums.length ? "المعدل " + avg.toFixed(2) + " · أعلى درجة " + Math.max.apply(null, nums) + " · أقل درجة " + Math.min.apply(null, nums) : "";
      $("ent-list").innerHTML = rows.map(function (r) {
        var low = r.grade != null && Number(r.grade) < 5;
        return '<div class="grow">' + avatar(r) +
          '<span class="nm">' + esc(r.name) + "</span>" +
          '<b class="gval' + (r.status ? " held" : low ? " low" : "") + '">' + esc(fmtGrade(r.grade == null && !r.status ? null : r)) + "</b></div>";
      }).join("");
    }).catch(function () { $("ent-list").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب الدرجات.</p>'; });
  }

  function refreshXoBadge() {
    rpc("a9_xo_list", { p_token: getToken() }).then(function (d) {
      var hot = (d.games || []).filter(function (g) { return g.incoming || (g.status === "active" && g.turn === g.me); }).length;
      
      $("games-mini").textContent = hot ? hot + " تحدي ينتظرك" : "XO · الجدران · الشيطان · 9no";
      $("games-mini").classList.toggle("hot", !!hot);
    }).catch(function () {});
  }

  function renderHome() {
    renderExamMini();
    refreshXoBadge();
    loadMyGrades().then(renderEntMini).catch(function () {});
    renderGallery();
    loadGallery().then(renderGallery).catch(function () {});
    var s = window.A9_gynSummary();
    $("rot-bar").style.width = Math.round((s.done / s.total) * 100) + "%";
    $("rot-count").textContent = "خلصت " + s.done + " من " + s.total + " سشن";
    $("rot-next").innerHTML = s.next
      ? '<span class="rot-label">' + (s.next.when === "اليوم" ? "اليوم" : "الجاي: " + esc(s.next.when)) + "</span>" +
        '<span class="rot-place">' + esc(s.next.place) + (s.next.time ? " &middot; " + esc(s.next.time) : "") + "</span>"+
        (s.next.dr ? '<span class="rot-dr">' + esc(s.next.dr) + "</span>" : "")
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
  $("nav-members").addEventListener("click", function () { showPanel("members"); });
  $("members-back").addEventListener("click", function () { showPanel("main"); });
  $("drawer-backdrop").addEventListener("click", closeDrawer);
  document.querySelectorAll("[data-nav]").forEach(function (a) { a.addEventListener("click", closeDrawer); });
  $("install-row").addEventListener("click", onInstall);
  $("xo").addEventListener("click", onXoClick);
  $("xoplay").addEventListener("click", onXoClick);
  $("xo-search").addEventListener("input", renderXoPeople);
  $("subj-tabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-subj]"); if (!b) return;
    exam.subj = b.dataset.subj; exam.showAll = false; $("stage-search").value = "";
    Array.prototype.forEach.call($("subj-tabs").children, function (x) { x.classList.toggle("on", x === b); });
    renderExam();
  });
  $("stage-search").addEventListener("input", drawStage);
  $("exam-sort").addEventListener("click", function (e) {
    var b = e.target.closest("[data-sort]"); if (!b) return;
    exam.sort = b.dataset.sort;
    Array.prototype.forEach.call($("exam-sort").children, function (x) { x.classList.toggle("on", x === b); });
    renderExam();
  });
  $("stage-more").addEventListener("click", function () { exam.showAll = true; drawStage(); });
  $("notif-row").addEventListener("click", onNotifRow);
  $("intro-notif").addEventListener("click", onIntroNotif);
  $("intro-close").addEventListener("click", closeIntro);
  $("intro-open").addEventListener("click", closeIntro);
  $("intro").addEventListener("click", function (e) { if (e.target === $("intro")) closeIntro(); });
  $("consult").addEventListener("click", onConsultClick);
  $("consult").addEventListener("change", onConsultMove);
  $("friend-search").addEventListener("input", function () { if (consult) renderFriends(); });
  $("gp-input").addEventListener("change", onGroupPhotos);
  $("tg-list").addEventListener("click", onTgClick);
  $("tg-status").addEventListener("click", onTgClick);
  $("gp-grid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del]"); if (b) return removeGroupPhoto(Number(b.dataset.del));
    var m = e.target.closest("[data-move]"); if (m && !m.disabled) moveGroupPhoto(Number(m.dataset.id), Number(m.dataset.move));
  });
  bindGalleryHold();
  $("person-chat").addEventListener("click", function () {
    var id = $("person-chat").dataset.id; closePerson(); closeDrawer(); location.hash = "chat/" + id;
  });
  $("chat-form").addEventListener("submit", sendMessage);
  $("chat-msgs").addEventListener("click", function (e) {
    var p = e.target.closest("[data-person]");
    if (p) { var id = Number(p.dataset.person); loadMembers().then(function () { openPerson(id); }); return; }
    var r = e.target.closest("[data-reads]");
    if (r) showReaders(Number(r.dataset.reads));
  });
  $("reads-close").addEventListener("click", function () { $("reads").hidden = true; });
  $("reads").addEventListener("click", function (e) { if (e.target === $("reads")) $("reads").hidden = true; });
  $("chat-who-btn").addEventListener("click", function () {
    if (chat.kind === "group") openGroupInfo();
    else if (chat.other) { loadMembers().then(function () { openPerson(chat.other); $("person-chat").hidden = true; }); }
  });
  $("new-search").addEventListener("input", renderPicker);
  $("new-list").addEventListener("click", onPick);
  $("pick-go").addEventListener("click", onPickGo);
  $("ginfo-close").addEventListener("click", closeGroupInfo);
  $("ginfo").addEventListener("click", function (e) { if (e.target === $("ginfo")) closeGroupInfo(); });
  $("ginfo-add").addEventListener("click", function () { closeGroupInfo(); location.hash = "new/add"; });
  $("ginfo-leave").addEventListener("click", function () {
    if (!confirm("تطلع من المجموعة؟ ما راح توصلك رسائلها.")) return;
    rpc("a9_group_leave", { p_token: getToken(), p_group: chat.other }).then(function () { closeGroupInfo(); location.hash = "inbox"; });
  });
  $("chat-input").addEventListener("input", autoGrow);
  $("chat-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !/iphone|ipad|android/i.test(navigator.userAgent)) { e.preventDefault(); sendMessage(e); }
  });
  $("log-filters").addEventListener("click", function (e) {
    var b = e.target.closest("[data-filter]"); if (b) { logState.filter = b.dataset.filter; renderLog(); }
  });
  $("log-more").addEventListener("click", function () { loadLog(true); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) pollUnread(); });
  $("admin-list").addEventListener("click", function (e) {
    var b = e.target.closest("[data-reset]"); if (b) resetPin(Number(b.dataset.reset), b.dataset.name);
    var l = e.target.closest("[data-devlog]"); if (l) toggleDevLog(Number(l.dataset.devlog));
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
