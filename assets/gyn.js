(function () {
  "use strict";

  var TIME = "11:30 صباحاً";

  var P = {
    lab:   { name: "مختبر المهارات", note: "المختبر الأول والثاني", cls: "lab" },
    video: { name: "محاضرة فديوية", note: "قاعة أ. سرمد · مستشفى بغداد التعليمي · الطابق الرابع", cls: "video" },
    cons:  { name: "الاستشارية", note: "مستشفى الاستشارية · الطابق الأول", cls: "cons" },
    preg:  { name: "ردهة الحوامل", note: "مستشفى بغداد التعليمي · الطابق الرابع", cls: "preg" },
    gyn:   { name: "ردهة النسائية", note: "مستشفى بغداد التعليمي · الطابق الرابع", cls: "gyn" }
  };

  // جدول Group 3 — مأخوذ من جدول التدريب السريري (المرحلة الخامسة / المجموعة A)
  // أسماء الدكاترة من جدول فرع النسائية والتوليد (مختبر المهارات = مختبر مهارات 1)
  var CONS_DR = ["أ.م.د. نجمة محمود", "م.د. نادية نايف", "م.د. فنن يحيى", "م.د. رشا فاضل", "د. ليلى حسين", "د. ندى سعيد"];

  var DAYS = [
    { d: "2026-11-09", p: "video", t: "Obstetrical & gynecological history and examination, Foley's catheter & Pap smear" },
    { d: "2026-11-10", p: "lab",   t: "Obstetrical & gynecological history and examination, Foley's catheter & Pap smear" },
    { d: "2026-11-11", p: "cons",  t: "Obstetrical & gynecological history and examination, Foley's catheter & Pap smear" },
    { d: "2026-11-12", p: "preg",  t: "Labour management, Episiotomy" },
    { d: "2026-11-15", p: "lab",   t: "Labour management, Episiotomy", where: "بناية طب المجتمع · الطابق الثاني" },
    { d: "2026-11-16", p: "preg",  t: "Labour management, Episiotomy" },
    { d: "2026-11-17", p: "video", t: "Partogram" },
    { d: "2026-11-18", p: "lab",   t: "Partogram", where: "بناية طب المجتمع" },
    { d: "2026-11-19", p: "gyn",   t: "Partogram" },
    { d: "2026-11-22", p: "cons",  t: "Pre & post caesarean section care", dr: CONS_DR },
    { d: "2026-11-23", p: "lab",   t: "Pre & post caesarean section care", where: "بناية طب المجتمع", dr: "د. نور قصي" },
    { d: "2026-11-24", p: "gyn",   t: "Pre & post caesarean section care", dr: "د. نور هادي" },
    { d: "2026-11-25", p: "video", t: "Fetal emergency, Early pregnancy disorder", dr: "د. رشا سالم" },
    { d: "2026-11-26", p: "lab",   t: "Fetal emergency, Early pregnancy disorder", where: "بناية طب المجتمع", dr: "د. نور قصي" },
    { d: "2026-11-29", p: "cons",  t: "Fetal emergency, Early pregnancy disorder", dr: CONS_DR },
    { d: "2026-11-30", p: "preg",  t: "APH, PPH", dr: "د. شيماء كاظم" },
    { d: "2026-12-01", p: "lab",   t: "APH, PPH", where: "بناية طب المجتمع", dr: "د. رشا فاضل" },
    { d: "2026-12-02", p: "preg",  t: "APH, PPH, Pelvic mass, Puerperium", dr: "د. كواكب نجم الدين" },
    { d: "2026-12-03", p: "video", t: "Hypertension in pregnancy & eclampsia, D.M in pregnancy", dr: "د. اخلاص جبار" },
    { d: "2026-12-06", p: "lab",   t: "Hypertension in pregnancy & eclampsia, D.M in pregnancy", where: "بناية طب المجتمع" },
    { d: "2026-12-07", p: "gyn",   t: "Hypertension in pregnancy & eclampsia, D.M in pregnancy" },
    { d: "2026-12-08", special: "Genetics session", note: "لكل المجموعات" },
    { d: "2026-12-09", p: "cons",  t: "Pelvic mass, Puerperium" },
    { d: "2026-12-10", p: "lab",   t: "Pelvic mass, Puerperium", where: "بناية طب المجتمع" },
    { d: "2026-12-13", end: "2026-12-17", exam: true }
  ];

  var ICON = {
    cal: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    clock: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
  };

  var WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  var MONTHS = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];

  function parse(s) { var a = s.split("-"); return new Date(+a[0], +a[1] - 1, +a[2]); }
  // الوقت حسب بغداد، حتى ما يتأثر بساعة الموبايل لو منطقته غلط
  function baghdadNow() {
    var parts = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour };
  }
  function today() { var b = baghdadNow(); return new Date(b.y, b.m - 1, b.d); }
  // بعد الساعة 1 ظهراً سشن اليوم ينحسب خالص، ويطلع سشن اليوم الجاي
  var CUTOFF_HOUR = 13;
  function cutoff() { var b = baghdadNow(), d = today(); if (b.h >= CUTOFF_HOUR) d.setDate(d.getDate() + 1); return d; }
  function fmt(dt) { return dt.getDate() + " " + MONTHS[dt.getMonth()]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function lastDay(x) { return parse(x.end || x.d); }

  function placeHtml(x) {
    if (x.exam) return '<span class="tag exam">أسبوع الامتحانات</span>';
    if (x.special) return '<span class="tag special">' + esc(x.special) + "</span>" + (x.note ? '<span class="note">' + esc(x.note) + "</span>" : "");
    var p = P[x.p];
    var note = x.where || p.note; // where: مكان خاص بهذا اليوم بدل المكان المعتاد
    return '<span class="tag ' + p.cls + '">' + p.name + "</span>" + (note ? '<span class="note' + (x.where ? " where" : "") + '">' + esc(note) + "</span>" : "");
  }

  // الدكتور (أو دكاترة الاستشارية)
  function drText(x) { return !x.dr ? "" : Array.isArray(x.dr) ? "الدكاترة: " + x.dr.join("، ") : x.dr; }
  function drHtml(x) { var t = drText(x); return t ? '<div class="dr">' + esc(t) + "</div>" : ""; }

  function dateHtml(x) {
    var a = parse(x.d);
    if (x.end) return "من " + WEEKDAYS[a.getDay()] + " " + fmt(a) + " إلى " + fmt(parse(x.end));
    return WEEKDAYS[a.getDay()] + " " + fmt(a);
  }

  function render() {
    var t = cutoff(), now = today();
    var nextIdx = -1;
    for (var i = 0; i < DAYS.length; i++) { if (lastDay(DAYS[i]) >= t) { nextIdx = i; break; } }

    var next = document.getElementById("next");
    if (nextIdx === -1) {
      next.innerHTML = '<div class="label">خلصت الروتة</div>';
    } else {
      var x = DAYS[nextIdx];
      var start = parse(x.d);
      var diff = Math.round((start - now) / 86400000);
      var when = start <= now ? "اليوم" : diff === 1 ? "باچر" : "بعد " + diff + " أيام";
      next.innerHTML =
        '<div class="label"><span class="pulse"></span>' + (start <= now ? "سشن اليوم" : "السشن الجاي &middot; " + when) + "</div>" +
        '<div class="next-date">' + ICON.cal + dateHtml(x) + "</div>" +
        (x.exam ? "" : '<div class="next-time">' + ICON.clock + TIME + "</div>") +
        '<div class="next-place">' + ICON.pin + placeHtml(x) + "</div>" +
        drHtml(x) +
        (x.t && x.p === "lab" ? '<div class="topic">' + esc(x.t) + "</div>" : "");
    }
    var s = summary();
    var pct = Math.round((s.done / s.total) * 100);
    document.getElementById("progress").innerHTML =
      '<div class="progress-head"><span>تقدم الروتة</span><span>' + s.done + " من " + s.total + " سشن</span></div>" +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>';

    // نقسم الجدول لأسابيع (كل أسبوع يبدي الأحد)
    var weeks = [], lastWeek = null;
    DAYS.forEach(function (x, i) {
      var dt = parse(x.d);
      var sunday = new Date(dt); sunday.setDate(dt.getDate() - dt.getDay());
      var wk = sunday.getTime();
      if (wk !== lastWeek) { weeks.push({ n: weeks.length + 1, exam: !!x.exam, items: [] }); lastWeek = wk; }
      var cls = "row dot-" + (x.exam ? "exam" : x.special ? "special" : P[x.p].cls);
      if (lastDay(x) < t) cls += " past";
      if (i === nextIdx) cls += " current";
      weeks[weeks.length - 1].items.push(
        '<div class="' + cls + '">' +
          '<div class="date">' + dateHtml(x) + "</div>" +
          '<div class="body"><div class="place">' + placeHtml(x) + "</div>" +
          drHtml(x) +
          (x.t && x.p === "lab" ? '<div class="topic">' + esc(x.t) + "</div>" : "") + "</div>" +
        "</div>");
      if (i === nextIdx) weeks[weeks.length - 1].current = true;
    });
    // الترتيب: أسبوعنا أول، بعده الأسابيع الجاية، وبالآخر الأسابيع اللي فاتت
    var cur = weeks.findIndex(function (w) { return w.current; });
    if (cur < 0) cur = 0;
    var order = weeks.slice(cur).concat(weeks.slice(0, cur));
    var html = order.map(function (w, k) {
      return (k === weeks.length - cur && cur > 0 ? '<div class="week past-head">الأسابيع اللي فاتت</div>' : "") +
        '<div class="week' + (w.current ? " now" : "") + '">' + (w.exam ? "الامتحانات" : "الأسبوع " + w.n) + (w.current ? " · هذا الأسبوع" : "") + "</div>" +
        w.items.join("");
    }).join("");
    document.getElementById("list").innerHTML = html;
  }

  // موضوع السشن يطلع بس بأيام مختبر المهارات

  // ملخص للصفحة الرئيسية
  function summary() {
    var t = cutoff(), now = today();
    var sessions = DAYS.filter(function (x) { return !x.exam; });
    var done = sessions.filter(function (x) { return lastDay(x) < t; }).length;
    var nx = null;
    for (var i = 0; i < DAYS.length; i++) { if (lastDay(DAYS[i]) >= t) { nx = DAYS[i]; break; } }
    var info = null;
    if (nx) {
      var start = parse(nx.d);
      var diff = Math.round((start - now) / 86400000);
      info = {
        when: start <= now ? "اليوم" : diff === 1 ? "باچر" : WEEKDAYS[start.getDay()] + " " + fmt(start),
        place: nx.exam ? "أسبوع الامتحانات" : nx.special ? nx.special : P[nx.p].name + ((nx.where || P[nx.p].note) ? " · " + (nx.where || P[nx.p].note) : ""),
        cls: nx.exam ? "exam" : nx.special ? "special" : P[nx.p].cls,
        time: nx.exam ? "" : TIME,
        dr: drText(nx)
      };
    }
    return { done: done, total: sessions.length, next: info };
  }

  // نصوص تبليغ التيليغرام (تنرسل الليلة اللي قبل السشن)
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoOf(dt) { return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate()); }
  function announcements() {
    var from = isoOf(today());
    return DAYS.filter(function (x) { return x.d >= from && (x.p || x.special); }).map(function (x) {
      var dt = parse(x.d), lines = ["تبليغ سشن باچر", "", WEEKDAYS[dt.getDay()] + " " + fmt(dt)];
      if (x.special) { lines.push(x.special); if (x.note) lines.push(x.note); lines.push("الساعة " + TIME); }
      else {
        var pl = P[x.p];
        lines.push(pl.name, x.where || pl.note, "الساعة " + TIME);
        if (x.dr) lines.push(drText(x));
        if (x.p === "lab" && x.t) lines.push("الموضوع: " + x.t);
      }
      lines.push("", "https://zaid004.github.io/a9/");
      return { d: x.d, text: lines.join("\n") };
    });
  }
  window.A9_gynAnnouncements = announcements;
  window.A9_renderGyn = render;
  window.A9_gynSummary = summary;
})();
