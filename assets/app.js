(function () {
  "use strict";

  const D = window.A9_DATA;
  const app = document.getElementById("app");
  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const WEEK_ORDER = [6, 0, 1, 2, 3, 4]; // السبت → الخميس

  // ---------- helpers ----------
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const store = {
    get(k, def) {
      try { const v = localStorage.getItem("a9:" + k); return v == null ? def : JSON.parse(v); } catch { return def; }
    },
    set(k, v) {
      try { localStorage.setItem("a9:" + k, JSON.stringify(v)); } catch { /* ignore */ }
    },
  };

  const parseDate = (d) => { const [y, m, day] = d.split("-").map(Number); return new Date(y, m - 1, day); };
  const today0 = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  const daysUntil = (d) => Math.round((parseDate(d) - today0()) / 86400000);
  const fmtDate = (d) =>
    parseDate(d).toLocaleDateString("ar-IQ", { weekday: "long", day: "numeric", month: "long" });
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const fmtTime = (t) => {
    let [h, m] = t.split(":").map(Number);
    const suf = h >= 12 ? "م" : "ص";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${suf}`;
  };
  const subjectById = (id) => D.subjects.find((s) => s.id === id);
  const lectureKey = (sid, i) => `${sid}#${i}#${D.subjects.find((s) => s.id === sid).lectures[i].title}`;
  const daysLabel = (n) => (n === 0 ? "اليوم!" : n === 1 ? "باچر" : n === 2 ? "عگب باچر" : `بعد ${n} يوم`);

  // ---------- theme ----------
  const themeBtn = document.getElementById("theme-toggle");
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    themeBtn.textContent = t === "dark" ? "☀️" : "🌙";
  }
  applyTheme(store.get("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  themeBtn.addEventListener("click", () => {
    const t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    store.set("theme", t);
    applyTheme(t);
  });

  document.getElementById("brand-name").textContent = "منصة " + (D.group.name || "A9");
  document.getElementById("footer-text").textContent =
    `${D.group.name} · ${D.group.college} · ${D.group.year}`;

  // ---------- views ----------
  function classRows(list, highlightNow) {
    if (!list.length) return `<div class="empty">ماكو محاضرات 🎉</div>`;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    return list
      .map((c) => {
        const now = highlightNow && nowMin >= toMin(c.start) && nowMin < toMin(c.end);
        return `<div class="class-row ${now ? "now" : ""}">
          <div class="time">${fmtTime(c.start)}</div>
          <div class="info"><strong>${esc(c.subject)}</strong> <span class="badge">${esc(c.type)}</span>
            <div class="muted">📍 ${esc(c.place)} · لحد ${fmtTime(c.end)}${now ? " · <b>هسه</b>" : ""}</div></div>
        </div>`;
      })
      .join("");
  }

  const classesOn = (day) => D.schedule.filter((c) => c.day === day).sort((a, b) => toMin(a.start) - toMin(b.start));
  const upcomingExams = () =>
    D.exams.filter((e) => daysUntil(e.date) >= 0).sort((a, b) => parseDate(a.date) - parseDate(b.date));

  function viewHome() {
    const g = D.group;
    const day = new Date().getDay();
    const next = upcomingExams()[0];
    const anns = [...D.announcements].sort(
      (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || parseDate(b.date) - parseDate(a.date)
    );
    const hour = new Date().getHours();
    const greet = hour < 12 ? "صباح الخير" : hour < 18 ? "هلا بيكم" : "مساء الخير";

    return `
      <section class="hero">
        <h1>${greet} يا ${esc(g.name)} 👋</h1>
        <p>${esc(g.motto || "")}</p>
        <div class="chips"><span class="chip">${esc(g.college)}</span><span class="chip">${esc(g.stage)}</span><span class="chip">${esc(g.year)}</span></div>
      </section>

      <div class="grid grid-2">
        <div class="card">
          <h2 class="section">📅 محاضرات اليوم <span class="badge">${DAYS[day]}</span></h2>
          ${classRows(classesOn(day), true)}
        </div>
        <div class="card">
          <h2 class="section">⏳ أقرب امتحان</h2>
          ${
            next
              ? `<div class="exam"><div class="count"><div class="big-number">${daysUntil(next.date)}</div><small>يوم</small></div>
                 <div><strong>${esc(next.subject)}</strong> <span class="badge warn">${esc(next.type)}</span>
                 <div class="muted">${fmtDate(next.date)} · ${fmtTime(next.time)}</div>
                 ${next.notes ? `<div class="muted">📝 ${esc(next.notes)}</div>` : ""}</div></div>
                 <p style="margin-bottom:0"><a href="#exams">كل الامتحانات ←</a></p>`
              : `<div class="empty">ماكو امتحانات قريبة، استانسوا 😄</div>`
          }
        </div>
      </div>

      <h2 class="section" style="margin-top:22px">📢 الإعلانات</h2>
      <div class="stack">
        ${
          anns.length
            ? anns
                .map(
                  (a) => `<div class="card">
              <h3>${a.pinned ? '<span class="pin">📌</span> ' : ""}${esc(a.title)}</h3>
              <div class="muted" style="font-size:.85rem">${fmtDate(a.date)}</div>
              <p style="margin:.4em 0 0">${esc(a.body)}</p></div>`
                )
                .join("")
            : `<div class="card empty">ماكو إعلانات</div>`
        }
      </div>`;
  }

  function viewSchedule() {
    const today = new Date().getDay();
    return `
      <h2 class="section">🗓️ الجدول الأسبوعي</h2>
      <div class="grid grid-2">
        ${WEEK_ORDER.map((d) => {
          const list = classesOn(d);
          return `<div class="card day-card ${d === today ? "today" : ""}">
            <h3>${DAYS[d]} ${d === today ? '<span class="badge primary">اليوم</span>' : ""}</h3>
            ${classRows(list, d === today)}
          </div>`;
        }).join("")}
      </div>`;
  }

  function subjectProgress(s) {
    const done = store.get("done", {});
    const n = s.lectures.filter((_, i) => done[lectureKey(s.id, i)]).length;
    return { n, total: s.lectures.length, pct: s.lectures.length ? Math.round((n / s.lectures.length) * 100) : 0 };
  }

  function viewLectures(subId) {
    if (subId) return viewSubject(subId);
    return `
      <h2 class="section">📚 المحاضرات</h2>
      <p class="muted">اختار المادة. علّم ✓ على المحاضرة اللي خلصتها حتى تتابع تقدمك (يتحفظ بجهازك).</p>
      <div class="grid grid-3">
        ${D.subjects
          .map((s) => {
            const p = subjectProgress(s);
            return `<a class="card subject-card" style="--c:${esc(s.color)}" href="#lectures/${esc(s.id)}">
              <div class="ico">${s.icon}</div>
              <h3 style="color:var(--text)">${esc(s.name)}</h3>
              <div class="muted ltr">${esc(s.en)}</div>
              <div class="muted" style="font-size:.85rem">${p.n} من ${p.total} محاضرة</div>
              <div class="progress"><i style="width:${p.pct}%"></i></div>
            </a>`;
          })
          .join("")}
      </div>`;
  }

  function viewSubject(id) {
    const s = subjectById(id);
    if (!s) return `<div class="empty">المادة مموجودة. <a href="#lectures">رجوع</a></div>`;
    const done = store.get("done", {});
    const p = subjectProgress(s);
    return `
      <a href="#lectures" class="btn ghost back">→ رجوع للمواد</a>
      <h2 class="section">${s.icon} ${esc(s.name)} <span class="badge ltr">${esc(s.en)}</span></h2>
      <p class="muted">خلصت ${p.n} من ${p.total} (${p.pct}%)</p>
      <input class="search" id="lec-search" placeholder="🔍 دوّر على محاضرة..." />
      <div class="stack" id="lec-list">
        ${s.lectures.length ? s.lectures
          .map((l, i) => {
            const key = lectureKey(s.id, i);
            const isDone = !!done[key];
            return `<div class="card lecture ${isDone ? "done" : ""}" data-search="${esc((l.title + " " + l.doctor).toLowerCase())}">
              <input type="checkbox" data-key="${esc(key)}" ${isDone ? "checked" : ""} aria-label="خلصتها" />
              <div class="info">
                <div class="title">${i + 1}. ${esc(l.title)}</div>
                <div class="muted" style="font-size:.85rem">${esc(l.doctor)}${l.date ? " · " + fmtDate(l.date) : ""}</div>
              </div>
              ${l.link ? `<a class="btn" href="${esc(l.link)}" target="_blank" rel="noopener">فتح 📄</a>` : `<span class="badge">قريباً</span>`}
            </div>`;
          })
          .join("") : `<div class="card empty">بعد ماكو محاضرات</div>`}
      </div>`;
  }

  function bindSubject() {
    const list = document.getElementById("lec-list");
    if (!list) return;
    list.addEventListener("change", (e) => {
      if (e.target.type !== "checkbox") return;
      const done = store.get("done", {});
      if (e.target.checked) done[e.target.dataset.key] = true;
      else delete done[e.target.dataset.key];
      store.set("done", done);
      render();
    });
    const search = document.getElementById("lec-search");
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      list.querySelectorAll(".lecture").forEach((el) => {
        el.style.display = el.dataset.search.includes(q) ? "" : "none";
      });
    });
  }

  function viewExams() {
    const all = [...D.exams].sort((a, b) => parseDate(a.date) - parseDate(b.date));
    return `
      <h2 class="section">⏳ الامتحانات</h2>
      <div class="stack">
        ${all.length ? all
          .map((e) => {
            const n = daysUntil(e.date);
            const past = n < 0;
            return `<div class="card exam ${past ? "past" : ""}">
              <div class="count"><div class="big-number">${past ? "✓" : n}</div><small>${past ? "خلص" : daysLabel(n)}</small></div>
              <div>
                <strong>${esc(e.subject)}</strong> <span class="badge warn">${esc(e.type)}</span>
                <div class="muted">📅 ${fmtDate(e.date)} · 🕘 ${fmtTime(e.time)}</div>
                <div class="muted">📍 ${esc(e.place)}</div>
                ${e.notes ? `<div>📝 ${esc(e.notes)}</div>` : ""}
              </div>
            </div>`;
          })
          .join("") : `<div class="card empty">ماكو امتحانات مسجلة</div>`}
      </div>`;
  }

  // ---------- quiz ----------
  const quiz = { filter: "all", order: [], idx: 0, score: 0, answered: false };

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function startQuiz(filter) {
    quiz.filter = filter;
    quiz.order = shuffle(D.questions.map((q, i) => i).filter((i) => filter === "all" || D.questions[i].subject === filter));
    quiz.idx = 0; quiz.score = 0; quiz.answered = false;
  }

  function viewQuiz() {
    if (!quiz.order.length && quiz.idx === 0) startQuiz(quiz.filter);
    const subsWithQ = D.subjects.filter((s) => D.questions.some((q) => q.subject === s.id));
    const filters = `<div class="filter-row">
      <button class="badge ${quiz.filter === "all" ? "primary" : ""}" data-filter="all">الكل (${D.questions.length})</button>
      ${subsWithQ.map((s) => `<button class="badge ${quiz.filter === s.id ? "primary" : ""}" data-filter="${esc(s.id)}">${s.icon} ${esc(s.name)} (${D.questions.filter((q) => q.subject === s.id).length})</button>`).join("")}
    </div>`;

    if (!quiz.order.length) return `<h2 class="section">🧠 بنك الأسئلة</h2>${filters}<div class="card empty">ماكو أسئلة لهالمادة بعد</div>`;

    if (quiz.idx >= quiz.order.length) {
      const pct = Math.round((quiz.score / quiz.order.length) * 100);
      const best = store.get("best:" + quiz.filter, 0);
      if (pct > best) store.set("best:" + quiz.filter, pct);
      const msg = pct >= 90 ? "وحش! 🔥" : pct >= 70 ? "عاشت ايدك 👏" : pct >= 50 ? "زين، بس راجع شوية 📖" : "لا تيأس، عيدها 💪";
      return `<h2 class="section">🧠 بنك الأسئلة</h2>${filters}
        <div class="card" style="text-align:center">
          <div class="big-number">${quiz.score} / ${quiz.order.length}</div>
          <h3 style="margin-top:10px">${msg}</h3>
          <p class="muted">${pct}% · أحسن نتيجة إلك: ${Math.max(pct, best)}%</p>
          <button class="btn" id="q-restart">عيد الأسئلة 🔁</button>
        </div>`;
    }

    const q = D.questions[quiz.order[quiz.idx]];
    const s = subjectById(q.subject);
    return `<h2 class="section">🧠 بنك الأسئلة</h2>${filters}
      <div class="card">
        <div class="quiz-bar">
          <span class="badge primary">سؤال ${quiz.idx + 1} من ${quiz.order.length}</span>
          ${s ? `<span class="badge">${s.icon} ${esc(s.name)}</span>` : ""}
          <span class="badge">الصح: ${quiz.score}</span>
        </div>
        <div class="q-text">${esc(q.q)}</div>
        <div class="options" id="q-options">
          ${q.options.map((o, i) => `<button class="option" data-i="${i}">${String.fromCharCode(65 + i)}. ${esc(o)}</button>`).join("")}
        </div>
        <div id="q-feedback"></div>
      </div>`;
  }

  function bindQuiz() {
    document.querySelectorAll("[data-filter]").forEach((b) =>
      b.addEventListener("click", () => { startQuiz(b.dataset.filter); render(); })
    );
    const restart = document.getElementById("q-restart");
    if (restart) restart.addEventListener("click", () => { startQuiz(quiz.filter); render(); });

    const opts = document.getElementById("q-options");
    if (!opts) return;
    const q = D.questions[quiz.order[quiz.idx]];
    opts.addEventListener("click", (e) => {
      const btn = e.target.closest(".option");
      if (!btn || quiz.answered) return;
      quiz.answered = true;
      const chosen = Number(btn.dataset.i);
      const right = chosen === q.answer;
      if (right) quiz.score++;
      opts.querySelectorAll(".option").forEach((o) => {
        o.disabled = true;
        if (Number(o.dataset.i) === q.answer) o.classList.add("correct");
      });
      if (!right) btn.classList.add("wrong");
      document.getElementById("q-feedback").innerHTML = `
        <div class="explain"><strong>${right ? "✅ صح!" : "❌ غلط"}</strong> ${q.explain ? esc(q.explain) : ""}</div>
        <div style="margin-top:12px;text-align:left"><button class="btn" id="q-next">${quiz.idx + 1 < quiz.order.length ? "السؤال الجاي ←" : "شوف النتيجة 🏁"}</button></div>`;
      document.getElementById("q-next").addEventListener("click", () => {
        quiz.idx++; quiz.answered = false; render();
      });
    });
  }

  function viewLinks() {
    return `<h2 class="section">🔗 روابط مهمة</h2>
      <div class="grid grid-2">
        ${D.links.map((l) => `<a class="card link-card" href="${esc(l.url)}" target="_blank" rel="noopener">
          <div class="ico">${l.icon || "🔗"}</div>
          <div><h3>${esc(l.title)}</h3><div class="muted">${esc(l.desc || "")}</div></div></a>`).join("")}
      </div>`;
  }

  // ---------- router ----------
  const routes = {
    home: [viewHome],
    schedule: [viewSchedule],
    lectures: [viewLectures, bindSubject],
    exams: [viewExams],
    quiz: [viewQuiz, bindQuiz],
    links: [viewLinks],
  };

  function render() {
    const [name, arg] = (location.hash.slice(1) || "home").split("/");
    const route = routes[name] || routes.home;
    app.innerHTML = route[0](arg ? decodeURIComponent(arg) : undefined);
    if (route[1]) route[1]();
    document.querySelectorAll("#tabs a").forEach((a) =>
      a.classList.toggle("active", a.dataset.tab === (routes[name] ? name : "home"))
    );
  }

  let lastTab = null;
  window.addEventListener("hashchange", () => {
    const tab = (location.hash.slice(1) || "home").split("/")[0];
    if (tab !== lastTab) window.scrollTo(0, 0);
    lastTab = tab;
    render();
  });
  render();
})();
