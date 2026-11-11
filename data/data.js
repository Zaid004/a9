/*
 * ===========================================================
 *  ملف المحتوى — عدّل هنا بس، والموقع يتحدث وحده
 * ===========================================================
 *  - كل قسم عبارة عن قائمة [ ... ] وكل عنصر بين { ... }
 *  - انتبه للفواصل , بين العناصر وللعلامات " "
 *  - التواريخ بصيغة "YYYY-MM-DD" والأوقات "HH:MM"
 *  - المحتوى الحالي أمثلة — بدّله بمحتوى مجموعتكم
 */

window.A9_DATA = {
  group: {
    name: "مجموعة A9",
    college: "كلية الطب",
    stage: "المرحلة الثانية",       // غيّرها حسب مرحلتكم
    year: "2026 – 2027",
    motto: "نذاكر سوة، ننجح سوة 🩺",
  },

  // ---------- الإعلانات (الأحدث فوق) ----------
  announcements: [
    {
      date: "2026-11-10",
      title: "أهلاً بيكم بمنصة A9",
      body: "هنا راح تلگون الجدول، المحاضرات، مواعيد الامتحانات وبنك أسئلة. أي ملاحظة دزوها للممثل.",
      pinned: true,
    },
    {
      date: "2026-11-09",
      title: "تغيير موعد عملي الفسلجة",
      body: "عملي الفسلجة صار يوم الثلاثاء الساعة 10 بدل الأربعاء.",
    },
  ],

  // ---------- الجدول الأسبوعي ----------
  // day: 0=الأحد 1=الاثنين 2=الثلاثاء 3=الأربعاء 4=الخميس 5=الجمعة 6=السبت
  // type: "نظري" أو "عملي" أو "سريري" أو أي شي
  schedule: [
    { day: 0, start: "08:30", end: "10:00", subject: "التشريح",      type: "نظري", place: "القاعة 3" },
    { day: 0, start: "10:30", end: "12:30", subject: "التشريح",      type: "عملي", place: "صالة التشريح" },
    { day: 1, start: "08:30", end: "10:00", subject: "الفسلجة",      type: "نظري", place: "القاعة 1" },
    { day: 1, start: "10:30", end: "12:00", subject: "الكيمياء الحياتية", type: "نظري", place: "القاعة 1" },
    { day: 2, start: "08:30", end: "10:00", subject: "الأنسجة",      type: "نظري", place: "القاعة 2" },
    { day: 2, start: "10:00", end: "12:00", subject: "الفسلجة",      type: "عملي", place: "مختبر 4" },
    { day: 3, start: "08:30", end: "10:00", subject: "الكيمياء الحياتية", type: "نظري", place: "القاعة 3" },
    { day: 3, start: "10:30", end: "12:30", subject: "الأنسجة",      type: "عملي", place: "مختبر 2" },
    { day: 4, start: "09:00", end: "11:00", subject: "طب المجتمع",    type: "نظري", place: "القاعة 1" },
  ],

  // ---------- المواد والمحاضرات ----------
  // link: رابط الملف (Google Drive / Telegram / PDF ...) — اتركه "" إذا ماكو
  subjects: [
    {
      id: "anatomy",
      name: "التشريح",
      en: "Anatomy",
      icon: "🦴",
      color: "#e76f51",
      lectures: [
        { title: "Upper limb — Bones", doctor: "د. —", date: "2026-10-05", link: "" },
        { title: "Upper limb — Muscles", doctor: "د. —", date: "2026-10-12", link: "" },
        { title: "Brachial plexus", doctor: "د. —", date: "2026-10-19", link: "" },
      ],
    },
    {
      id: "physiology",
      name: "الفسلجة",
      en: "Physiology",
      icon: "❤️",
      color: "#d62828",
      lectures: [
        { title: "Cell membrane & transport", doctor: "د. —", date: "2026-10-06", link: "" },
        { title: "Resting membrane potential", doctor: "د. —", date: "2026-10-13", link: "" },
        { title: "Action potential", doctor: "د. —", date: "2026-10-20", link: "" },
      ],
    },
    {
      id: "biochem",
      name: "الكيمياء الحياتية",
      en: "Biochemistry",
      icon: "🧪",
      color: "#2a9d8f",
      lectures: [
        { title: "Amino acids & proteins", doctor: "د. —", date: "2026-10-06", link: "" },
        { title: "Enzymes", doctor: "د. —", date: "2026-10-15", link: "" },
      ],
    },
    {
      id: "histology",
      name: "الأنسجة",
      en: "Histology",
      icon: "🔬",
      color: "#7b2cbf",
      lectures: [
        { title: "Epithelial tissue", doctor: "د. —", date: "2026-10-07", link: "" },
        { title: "Connective tissue", doctor: "د. —", date: "2026-10-14", link: "" },
      ],
    },
    {
      id: "community",
      name: "طب المجتمع",
      en: "Community Medicine",
      icon: "🌍",
      color: "#457b9d",
      lectures: [
        { title: "Introduction to epidemiology", doctor: "د. —", date: "2026-10-09", link: "" },
      ],
    },
  ],

  // ---------- الامتحانات ----------
  exams: [
    { date: "2026-12-01", time: "09:00", subject: "التشريح", type: "شهري", place: "القاعة الكبرى", notes: "Upper limb كامل" },
    { date: "2026-12-08", time: "09:00", subject: "الفسلجة", type: "شهري", place: "القاعة الكبرى", notes: "" },
    { date: "2026-12-15", time: "10:00", subject: "الكيمياء الحياتية", type: "كويز", place: "القاعة 1", notes: "" },
  ],

  // ---------- بنك الأسئلة ----------
  // subject: لازم يطابق id مالت المادة فوق
  // answer: رقم الجواب الصحيح يبدي من 0
  questions: [
    {
      subject: "anatomy",
      q: "Which nerve supplies the deltoid muscle?",
      options: ["Radial nerve", "Axillary nerve", "Musculocutaneous nerve", "Median nerve"],
      answer: 1,
      explain: "العصب الإبطي (Axillary, C5–C6) يغذي الـ deltoid والـ teres minor.",
    },
    {
      subject: "anatomy",
      q: "Wrist drop results from injury to which nerve?",
      options: ["Ulnar", "Median", "Radial", "Axillary"],
      answer: 2,
      explain: "الـ Radial nerve يغذي باسطات الرسغ، فإصابته تسبب wrist drop.",
    },
    {
      subject: "physiology",
      q: "The resting membrane potential of a typical neuron is about:",
      options: ["+30 mV", "−70 mV", "−90 mV", "0 mV"],
      answer: 1,
      explain: "تقريباً −70 mV بالعصبون، أما العضلة الهيكلية تقريباً −90 mV.",
    },
    {
      subject: "physiology",
      q: "The Na⁺/K⁺ ATPase pumps:",
      options: ["3 Na⁺ in, 2 K⁺ out", "2 Na⁺ out, 3 K⁺ in", "3 Na⁺ out, 2 K⁺ in", "1 Na⁺ out, 1 K⁺ in"],
      answer: 2,
      explain: "تطلّع 3 صوديوم وتدخّل 2 بوتاسيوم، فهي electrogenic.",
    },
    {
      subject: "biochem",
      q: "Which amino acid contains a sulfur atom?",
      options: ["Serine", "Cysteine", "Glycine", "Lysine"],
      answer: 1,
      explain: "الـ Cysteine والـ Methionine بيهم كبريت.",
    },
    {
      subject: "histology",
      q: "The epithelium lining the urinary bladder is:",
      options: ["Simple squamous", "Stratified squamous", "Transitional", "Simple columnar"],
      answer: 2,
      explain: "الـ Transitional epithelium (urothelium) يتمدد ويه امتلاء المثانة.",
    },
  ],

  // ---------- روابط مهمة ----------
  links: [
    { title: "كروب التلگرام", url: "https://t.me/", icon: "✈️", desc: "الكروب الرسمي للمجموعة" },
    { title: "درايف المحاضرات", url: "https://drive.google.com/", icon: "📁", desc: "كل الملفات بمكان واحد" },
    { title: "Kenhub", url: "https://www.kenhub.com/", icon: "🦴", desc: "تشريح بالصور" },
    { title: "Osmosis", url: "https://www.osmosis.org/", icon: "🎥", desc: "فيديوهات شرح" },
  ],
};
