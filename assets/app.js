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
    ["login", "home", "gyn", "admin", "me", "inbox", "chat", "log", "ent", "rot-gyn", "consult"].forEach(function (v) { var el = $(v); if (el) el.hidden = v !== id; });
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
    var pics = rpc("a9_login_avatars").catch(function () { return []; });
    return Promise.all([rpc("a9_list_students"), reps, pics]).then(function (res) {
      var map = {};
      (res[2] || []).forEach(function (r) { map[r.id] = r.avatar; });
      state.students = (res[0] || []).map(function (s) { s.avatar = map[s.id] || null; return s; });
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

  // ---------- session ----------
  function afterLogin() {
    $("me-btn").hidden = false;
    $("menu-btn").hidden = false;
    startUnreadPolling();
    paintAvatar($("me-btn"), state.me);
    backToNames();
    route();
  }

  function logout() {
    var t = getToken();
    setToken(null);
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
    rpc("a9_admin_students", { p_token: getToken() }).then(withAvatars).then(function (rows) {
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
      if (res && res.ok) { state.me.avatar = data; state.members = null; renderMe(); paintAvatar($("me-btn"), state.me); photoMsg(data ? "انحفظت الصورة" : "انحذفت الصورة"); }
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
  function loadMembers(force) {
    if (state.members && !force) return Promise.resolve(state.members);
    return rpc("a9_members", { p_token: getToken() }).then(function (rows) { state.members = rows || []; return state.members; });
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
        '<span class="nm">' + esc(m.name) + "</span>" +
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
    if (h === "chat") h = "inbox";
    document.querySelectorAll("[data-nav]").forEach(function (a) { a.classList.toggle("active", a.dataset.nav === h); });
    document.querySelectorAll(".admin-only").forEach(function (a) { a.hidden = !(state.me && state.me.is_admin); });
    showPanel("main");
    loadMembers(true).then(function (all) { $("members-count").textContent = all.length; }).catch(function () {});
  }
  function showPanel(which) {
    $("drawer-main").hidden = which !== "main";
    $("drawer-members").hidden = which !== "members";
    if (which === "members") {
      $("members-search").value = "";
      if (state.members) renderMembers(); else $("members-list").innerHTML = "";
      loadMembers(true).then(renderMembers).catch(function () {
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
    $("person-chat").dataset.id = m.id;
    $("person").hidden = false;
  }
  function closePerson() { $("person").hidden = true; }

  // ---------- messages ----------
  var chat = { other: null, lastId: 0, timer: null, sending: false };
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
  }
  function pollUnread() {
    if (!state.me) return;
    rpc("a9_unread", { p_token: getToken() }).then(setUnread).catch(function () {});
  }
  function startUnreadPolling() {
    clearInterval(unreadTimer);
    pollUnread();
    unreadTimer = setInterval(pollUnread, 30000);
  }

  function openInbox() {
    loading(true);
    rpc("a9_conversations", { p_token: getToken() }).then(function (rows) {
      loading(false);
      rows = rows || [];
      $("inbox-list").innerHTML = rows.length ? rows.map(function (c) {
        var who = { id: c.other, name: c.name, avatar: c.avatar };
        return '<a class="conv' + (c.unread ? " unread" : "") + '" href="#chat/' + c.other + '">' +
          avatar(who) +
          '<div class="conv-main"><div class="conv-top"><b>' + esc(c.name) + "</b>" +
          (c.is_admin ? '<span class="tag gold">الممثل</span>' : "") +
          '<span class="conv-time">' + timeLabel(c.last_at) + "</span></div>" +
          '<div class="conv-last">' + (c.last_mine ? "أنت: " : "") + esc(c.last_body) + "</div></div>" +
          (c.unread ? '<b class="badge">' + c.unread + "</b>" : "") +
          "</a>";
      }).join("") : '<p class="sub center-text" style="padding:24px 16px">ماكو رسائل بعد.</p>';
      pollUnread();
    }).catch(function () { loading(false); $("inbox-list").innerHTML = '<p class="error" style="margin:16px">ما گدرنا نجيب الرسائل.</p>'; });
  }

  function bubble(m) {
    return '<div class="msg ' + (m.mine ? "me" : "them") + '" data-id="' + m.id + '">' +
      '<div class="bubble">' + esc(m.body).replace(/\n/g, "<br>") + "</div>" +
      '<div class="msg-time">' + timeLabel(m.created_at) + (m.mine && m.read_at ? " &middot; مقروءة" : "") + "</div></div>";
  }

  function fetchChat(first) {
    if (!chat.other) return;
    var other = chat.other;
    return rpc("a9_messages", { p_token: getToken(), p_other: other, p_after: first ? 0 : chat.lastId }).then(function (rows) {
      if (chat.other !== other) return;
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
    });
  }

  function openChat(id) {
    var m = (state.members || []).filter(function (x) { return x.id === id; })[0];
    var go = function (person) {
      chat.other = id; chat.lastId = 0;
      paintAvatar($("chat-avatar"), person || { id: id, name: "?" });
      $("chat-name").textContent = person ? person.name : "";
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

  function closeChat() { clearInterval(chat.timer); chat.timer = null; chat.other = null; }

  function sendMessage(e) {
    e.preventDefault();
    var input = $("chat-input");
    var body = input.value.trim();
    if (!body || chat.sending || !chat.other) return;
    chat.sending = true;
    rpc("a9_send", { p_token: getToken(), p_to: chat.other, p_body: body }).then(function (res) {
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
    consult_join: "انضم لمجموعة استشارية", consult_leave: "طلع من مجموعته الاستشارية", consult_add: "ضاف صديق لمجموعته",
    consult_assign: "وزّع طالب على مجموعة", consult_lock: "ثبّت مجموعات الاستشارية", consult_unlock: "فتح مجموعات الاستشارية",
    group_photo: "غيّر صورة المجموعة", group_photo_removed: "حذف صورة المجموعة"
  };
  var LOG_FILTERS = [["all", "الكل"], ["message", "الرسائل"], ["auth", "الدخول والتسجيل"], ["account", "الحسابات"]];
  var LOG_GROUP = { message: "message", register: "auth", login: "auth", login_failed: "auth", locked: "auth", logout: "auth",
                    avatar: "account", avatar_removed: "account", pin_changed: "account", pin_reset: "account",
                    group_photo: "account", group_photo_removed: "account",
                    consult_join: "account", consult_leave: "account", consult_add: "account", consult_assign: "account",
                    consult_lock: "account", consult_unlock: "account" };
  var logState = { rows: [], filter: "all", oldest: null };

  function logLine(e) {
    var who = esc(e.actor || "شخص غير معروف");
    var what = LOG_KINDS[e.kind] || esc(e.kind);
    var text;
    if (e.kind === "message") text = "<b>" + who + "</b> راسل <b>" + esc(e.target || "") + "</b>";
    else if (e.kind === "pin_reset") text = "<b>" + who + "</b> صفّر الرقم السري لـ <b>" + esc(e.target || "") + "</b>";
    else if (e.kind === "consult_add") text = "<b>" + who + "</b> ضاف <b>" + esc(e.target || "") + "</b> لـ" + esc(e.detail || "");
    else if (e.kind === "consult_assign") text = "<b>" + who + "</b> حط <b>" + esc(e.target || "") + "</b> بـ" + esc(e.detail || "");
    else if (e.kind === "consult_join" || e.kind === "consult_leave") text = "<b>" + who + "</b> &middot; " + what + " (" + esc(e.detail || "") + ")";
    else text = "<b>" + who + "</b> &middot; " + what;
    return '<div class="ev ev-' + (LOG_GROUP[e.kind] || "other") + '">' +
      '<span class="ev-dot"></span>' +
      '<div class="ev-main"><div class="ev-text">' + text + "</div>" +
      (e.kind === "message" && e.detail ? '<div class="ev-detail">' + esc(e.detail) + "</div>" : "") +
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
    if (h !== "chat") closeChat();
    if (h === "chat" && parts[1]) { show("chat"); openChat(Number(parts[1])); return; }
    if (h === "inbox") { show("inbox"); openInbox(); return; }
    if (h === "log" && state.me.is_admin) { show("log"); logState.filter = "all"; loadLog(false); return; }
    if (h === "ent") { show("ent"); openEnt(); return; }
    if (h === "rot-gyn") { show("rot-gyn"); openRotGyn(); return; }
    if (h === "consult") { show("consult"); openConsult(); return; }
    if (h === "gyn") { show("gyn"); window.A9_renderGyn(); }
    else if (h === "admin" && state.me.is_admin) { show("admin"); loadAdmin(); openGpAdmin(); }
    else if (h === "me") { show("me"); renderMe(); $("install-row").hidden = isStandalone(); }
    else { show("home"); renderHome(); }
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
    $("gp-grid").innerHTML = ids.length ? ids.map(function (id) {
      return '<div class="gp-thumb" data-id="' + id + '"><img alt="" /><button type="button" class="gp-del" data-del="' + id + '" aria-label="حذف">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
    }).join("") : '<p class="note" style="grid-column:1/-1;text-align:center;margin:18px 0">ماكو صور بعد</p>';
    ids.forEach(function (id) {
      gpGet(id).then(function (src) { var img = $("gp-grid").querySelector('.gp-thumb[data-id="' + id + '"] img'); if (img && src) img.src = src; }).catch(function () {});
    });
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
    return rpc("a9_consult_view", { p_token: getToken() }).then(function (v) {
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

  function renderHome() {
    loadMyGrades().then(renderEntMini).catch(function () {});
    renderGallery();
    loadGallery().then(renderGallery).catch(function () {});
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
  $("nav-members").addEventListener("click", function () { showPanel("members"); });
  $("members-back").addEventListener("click", function () { showPanel("main"); });
  $("drawer-backdrop").addEventListener("click", closeDrawer);
  document.querySelectorAll("[data-nav]").forEach(function (a) { a.addEventListener("click", closeDrawer); });
  $("install-row").addEventListener("click", onInstall);
  $("consult").addEventListener("click", onConsultClick);
  $("consult").addEventListener("change", onConsultMove);
  $("friend-search").addEventListener("input", function () { if (consult) renderFriends(); });
  $("gp-input").addEventListener("change", onGroupPhotos);
  $("gp-grid").addEventListener("click", function (e) { var b = e.target.closest("[data-del]"); if (b) removeGroupPhoto(Number(b.dataset.del)); });
  bindGalleryHold();
  $("person-chat").addEventListener("click", function () {
    var id = $("person-chat").dataset.id; closePerson(); closeDrawer(); location.hash = "chat/" + id;
  });
  $("chat-form").addEventListener("submit", sendMessage);
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
