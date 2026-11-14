(function () {
  "use strict";

  var TIME = "11:30 صباحاً";

  var P = {
    lab:   { name: "مختبر المهارات", note: "المختبر الأول والثاني", cls: "lab" },
    video: { name: "محاضرة فديوية", note: "قاعة أ. سرمد", cls: "video" },
    cons:  { name: "الاستشارية", note: "", cls: "cons" },
    preg:  { name: "ردهة الحوامل", note: "الطابق الرابع", cls: "preg" },
    gyn:   { name: "ردهة النسائية", note: "الطابق الرابع", cls: "gyn" }
  };

  // جدول Group 3 — مأخوذ من جدول التدريب السريري (المرحلة الخامسة / المجموعة A)
  var DAYS = [
    { d: "2026-11-09", p: "video", t: "Obstetrical & gynecological history and examination, Foley's catheter & Pap smear" },
    { d: "2026-11-10", p: "lab",   t: "Obstetrical & gynecological history and examination, Foley's catheter & Pap smear" },
    { d: "2026-11-11", p: "cons",  t: "Obstetrical & gynecological history and examination, Foley's catheter & Pap smear" },
    { d: "2026-11-12", p: "preg",  t: "Labour management, Episiotomy" },
    { d: "2026-11-15", p: "lab",   t: "Labour management, Episiotomy", where: "بناية طب المجتمع · الطابق الثاني" },
    { d: "2026-11-16", p: "preg",  t: "Labour management, Episiotomy" },
    { d: "2026-11-17", p: "video", t: "Partogram" },
    { d: "2026-11-18", p: "lab",   t: "Partogram" },
    { d: "2026-11-19", p: "gyn",   t: "Partogram" },
    { d: "2026-11-22", p: "cons",  t: "Pre & post caesarean section care" },
    { d: "2026-11-23", p: "lab",   t: "Pre & post caesarean section care" },
    { d: "2026-11-24", p: "gyn",   t: "Pre & post caesarean section care" },
    { d: "2026-11-25", p: "video", t: "Fetal emergency, Early pregnancy disorder" },
    { d: "2026-11-26", p: "lab",   t: "Fetal emergency, Early pregnancy disorder" },
    { d: "2026-11-29", p: "cons",  t: "Fetal emergency, Early pregnancy disorder" },
    { d: "2026-11-30", p: "preg",  t: "APH, PPH" },
    { d: "2026-12-01", p: "lab",   t: "APH, PPH" },
    { d: "2026-12-02", p: "preg",  t: "APH, PPH, Pelvic mass, Puerperium" },
    { d: "2026-12-03", p: "video", t: "Hypertension in pregnancy & eclampsia, D.M in pregnancy" },
    { d: "2026-12-06", p: "lab",   t: "Hypertension in pregnancy & eclampsia, D.M in pregnancy" },
    { d: "2026-12-07", p: "gyn",   t: "Hypertension in pregnancy & eclampsia, D.M in pregnancy" },
    { d: "2026-12-08", special: "Genetics session", note: "لكل المجموعات" },
    { d: "2026-12-09", p: "cons",  t: "Pelvic mass, Puerperium" },
    { d: "2026-12-10", p: "lab",   t: "Pelvic mass, Puerperium" },
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
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
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

  function dateHtml(x) {
    var a = parse(x.d);
    if (x.end) return "من " + WEEKDAYS[a.getDay()] + " " + fmt(a) + " إلى " + fmt(parse(x.end));
    return WEEKDAYS[a.getDay()] + " " + fmt(a);
  }

  function render() {
    var t = today();
    var nextIdx = -1;
    for (var i = 0; i < DAYS.length; i++) { if (lastDay(DAYS[i]) >= t) { nextIdx = i; break; } }

    var next = document.getElementById("next");
    if (nextIdx === -1) {
      next.innerHTML = '<div class="label">خلصت الروتة</div>';
    } else {
      var x = DAYS[nextIdx];
      var start = parse(x.d);
      var diff = Math.round((start - t) / 86400000);
      var when = start <= t ? "اليوم" : diff === 1 ? "باچر" : "بعد " + diff + " أيام";
      next.innerHTML =
        '<div class="label"><span class="pulse"></span>' + (start <= t ? "سشن اليوم" : "السشن الجاي &middot; " + when) + "</div>" +
        '<div class="next-date">' + ICON.cal + dateHtml(x) + "</div>" +
        (x.exam ? "" : '<div class="next-time">' + ICON.clock + TIME + "</div>") +
        '<div class="next-place">' + ICON.pin + placeHtml(x) + "</div>" +
        (x.t && x.p === "lab" ? '<div class="topic">' + esc(x.t) + "</div>" : "");
    }
    var s = summary();
    var pct = Math.round((s.done / s.total) * 100);
    document.getElementById("progress").innerHTML =
      '<div class="progress-head"><span>تقدم الروتة</span><span>' + s.done + " من " + s.total + " سشن</span></div>" +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>';

    var html = "";
    var lastWeek = null;
    DAYS.forEach(function (x, i) {
      var dt = parse(x.d);
      var sunday = new Date(dt); sunday.setDate(dt.getDate() - dt.getDay());
      var wk = sunday.getTime();
      if (wk !== lastWeek) {
        var n = html ? (html.match(/class="week"/g) || []).length + 1 : 1;
        html += '<div class="week">' + (x.exam ? "الامتحانات" : "الأسبوع " + n) + "</div>";
        lastWeek = wk;
      }
      var cls = "row dot-" + (x.exam ? "exam" : x.special ? "special" : P[x.p].cls);
      if (lastDay(x) < t) cls += " past";
      if (i === nextIdx) cls += " current";
      html +=
        '<div class="' + cls + '">' +
          '<div class="date">' + dateHtml(x) + "</div>" +
          '<div class="body"><div class="place">' + placeHtml(x) + "</div>" +
          (x.t && x.p === "lab" ? '<div class="topic">' + esc(x.t) + "</div>" : "") + "</div>" +
        "</div>";
    });
    document.getElementById("list").innerHTML = html;
  }

  // موضوع السشن يطلع بس بأيام مختبر المهارات

  // ملخص للصفحة الرئيسية
  function summary() {
    var t = today();
    var sessions = DAYS.filter(function (x) { return !x.exam; });
    var done = sessions.filter(function (x) { return lastDay(x) < t; }).length;
    var nx = null;
    for (var i = 0; i < DAYS.length; i++) { if (lastDay(DAYS[i]) >= t) { nx = DAYS[i]; break; } }
    var info = null;
    if (nx) {
      var start = parse(nx.d);
      var diff = Math.round((start - t) / 86400000);
      info = {
        when: start <= t ? "اليوم" : diff === 1 ? "باچر" : WEEKDAYS[start.getDay()] + " " + fmt(start),
        place: nx.exam ? "أسبوع الامتحانات" : nx.special ? nx.special : P[nx.p].name + (nx.where ? " · " + nx.where : ""),
        cls: nx.exam ? "exam" : nx.special ? "special" : P[nx.p].cls,
        time: nx.exam ? "" : TIME
      };
    }
    return { done: done, total: sessions.length, next: info };
  }

  window.A9_renderGyn = render;
  window.A9_gynSummary = summary;
})();
