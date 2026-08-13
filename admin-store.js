/* ============================================================
   ТБДТ · Кабинет администратора — shared persisted state
   Single source of truth for the domain-mutable collections,
   synchronized across per-section HTML files and browser tabs
   via localStorage + BroadcastChannel.
   Plain script (no module). Loads before admin.js.
   ============================================================ */
(function () {
  "use strict";

  var KEY = "tbdt_admin_v1";

  /* ---- seed / demo data for the mutable collections + UI prefs ---- */
  var DEFAULTS = {
    TIERS: [
      { zone: "Партер",    color: "#e0533f", seats: 166, sold: 150, price: 3500 },
      { zone: "Амфитеатр", color: "#46c35a", seats: 300, sold: 220, price: 2200 },
      { zone: "Балкон",    color: "#3f8fe0", seats: 120, sold: 70,  price: 1200 },
      { zone: "Ложа",      color: "#e04f8c", seats: 24,  sold: 20,  price: 5000 },
    ],
    LEDGER: [
      { date: "01.06", op: "Продажа билетов · онлайн",    cat: "Касса",      amount: 318400,  type: "income" },
      { date: "02.06", op: "Аренда сцены · репетиции",    cat: "Постановка", amount: -64000,  type: "expense" },
      { date: "03.06", op: "Продажа билетов · касса",     cat: "Касса",      amount: 142900,  type: "income" },
      { date: "03.06", op: "Гонорары артистов",           cat: "Зарплата",   amount: -210000, type: "expense" },
      { date: "04.06", op: "Реклама · соцсети",           cat: "Маркетинг",  amount: -38500,  type: "expense" },
      { date: "05.06", op: "Продажа билетов · агрегаторы", cat: "Партнёры",  amount: 96700,   type: "income" },
      { date: "06.06", op: "Костюмы и реквизит",          cat: "Постановка", amount: -52300,  type: "expense" },
      { date: "07.06", op: "Продажа билетов · онлайн",    cat: "Касса",      amount: 274100,  type: "income" },
    ],
    EVENTS: [
      { title: "Гамлет",       genre: "Трагедия", date: "2026-06-12", hall: "Большой зал", age: "16+", status: "sale" },
      { title: "Чайка",        genre: "Комедия",  date: "2026-06-18", hall: "Большой зал", age: "12+", status: "soon" },
      { title: "Вишнёвый сад", genre: "Драма",    date: "2026-06-25", hall: "Большой зал", age: "12+", status: "sale" },
      { title: "Щелкунчик",    genre: "Балет",    date: "2026-07-03", hall: "Большой зал", age: "0+",  status: "soon" },
    ],
    ACTORS: [
      { name: "Аркадий Светлов",  role: "Ведущий мастер сцены",  salary: 118000, fee: 12000, shows: 11 },
      { name: "Вера Кольцова",    role: "Ведущий мастер сцены",  salary: 112000, fee: 11000, shows: 10 },
      { name: "Михаил Дорохов",   role: "Артист драмы",          salary: 86000,  fee: 8000,  shows: 9  },
      { name: "Ольга Закревская", role: "Артистка драмы",        salary: 84000,  fee: 7500,  shows: 8  },
      { name: "Игорь Бельский",   role: "Характерный актёр",     salary: 78000,  fee: 7000,  shows: 7  },
      { name: "Наталья Гордеева", role: "Артистка драмы",        salary: 72000,  fee: 6500,  shows: 6  },
      { name: "Павел Ермаков",    role: "Артист драмы",          salary: 68000,  fee: 6000,  shows: 5  },
      { name: "Лидия Воронцова",  role: "Артистка драмы",        salary: 64000,  fee: 5500,  shows: 6  },
      { name: "Семён Рябинин",    role: "Характерный актёр",     salary: 62000,  fee: 5000,  shows: 4  },
      { name: "Анна Левитина",    role: "Артистка драмы",        salary: 58000,  fee: 4800,  shows: 3  },
      { name: "Тимур Аскаров",    role: "Артист вспом. состава", salary: 46000,  fee: 3500,  shows: 3  },
      { name: "Дарья Соловьёва",  role: "Артист вспом. состава", salary: 44000,  fee: 3200,  shows: 2  },
    ],
    RENTALS: [
      { org: "ТБДТ · свой репертуар",       title: "Прощальные гастроли",     hall: "Большой зал", start: 8,  days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "ТБДТ · свой репертуар",       title: "Гамлет",                  hall: "Большой зал", start: 14, days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "ТБДТ · свой репертуар",       title: "Чайка",                   hall: "Большой зал", start: 26, days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "ТБДТ · свой репертуар",       title: "Ревизор",                 hall: "Малая сцена", start: 5,  days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "ТБДТ · свой репертуар",       title: "Вишнёвый сад",            hall: "Малая сцена", start: 14, days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "ТБДТ · свой репертуар",       title: "Щелкунчик",               hall: "Малая сцена", start: 27, days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "Малый театр (Москва)",        title: "«Горе от ума»",           hall: "Большой зал", start: 3,  days: 2, type: "tour", amount: 420000, status: "confirmed" },
      { org: "Коляда-Театр (Екатеринбург)", title: "«Ревизор»",               hall: "Большой зал", start: 10, days: 3, type: "tour", amount: 510000, status: "confirmed" },
      { org: "БДТ им. Товстоногова (СПб)",  title: "Гастроли · «Гроза»",      hall: "Большой зал", start: 19, days: 4, type: "tour", amount: 680000, status: "option" },
      { org: "ПАО «СибурТюмень»",           title: "Корпоративный вечер",     hall: "Большой зал", start: 16, days: 1, type: "rent", amount: 280000, status: "confirmed" },
      { org: "Студия «Новая сцена»",        title: "Фестиваль моноспектаклей", hall: "Малая сцена", start: 10, days: 2, type: "rent", amount: 120000, status: "confirmed" },
      { org: "Тюменский гос. университет",  title: "Вручение дипломов",       hall: "Малая сцена", start: 19, days: 1, type: "rent", amount: 90000,  status: "option" },
      { org: "Школа танца «Ритм»",          title: "Отчётный концерт",        hall: "Малая сцена", start: 23, days: 1, type: "rent", amount: 70000,  status: "request" },
      { org: "Тюменская филармония",        title: "Симфонический вечер",     hall: "Большой зал", start: 28, days: 1, type: "rent", amount: 160000, status: "confirmed" },
    ],
    HALLS: [
      { name: "Большой зал", rows: 9, cols: 18, cells: seedBig() },
      { name: "Малая сцена", rows: 6, cols: 12, cells: seedSmall() },
    ],
    period: "month",
  };

  function seedBig() {
    var rows = 9, cols = 18, cells = new Array(rows * cols);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var centre = 1 - Math.abs(c - (cols - 1) / 2) / ((cols - 1) / 2);
        var v;
        if (r < 2) v = 0;
        else if (r < 5) v = centre > 0.5 ? 1 : 2;
        else v = 3;
        cells[r * cols + c] = v;
      }
    }
    return cells;
  }
  function seedSmall() {
    var rows = 6, cols = 12, cells = new Array(rows * cols);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        cells[r * cols + c] = r < 2 ? 0 : r < 4 ? 1 : 3;
      }
    }
    return cells;
  }

  /* ---- deep helpers ---- */
  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }
  function isObj(v) {
    return v && typeof v === "object" && !Array.isArray(v);
  }
  // Deep-merge `src` over a deep clone of `base`: missing keys filled from base,
  // present keys (incl. arrays) taken from src. Future-version safe.
  function deepMerge(base, src) {
    var out = clone(base);
    if (!isObj(src)) return out;
    Object.keys(src).forEach(function (k) {
      if (isObj(out[k]) && isObj(src[k])) out[k] = deepMerge(out[k], src[k]);
      else out[k] = clone(src[k]);
    });
    return out;
  }

  /* ---- live state ---- */
  var state = clone(DEFAULTS);
  var subs = [];

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (_) { raw = null; }
    if (!raw) {
      state = clone(DEFAULTS);
      save();                 // seed on first run
      return state;
    }
    try {
      var parsed = JSON.parse(raw);
      assign(deepMerge(DEFAULTS, parsed));
    } catch (_) {
      assign(clone(DEFAULTS));
    }
    return state;
  }

  // replace state contents in place (keep the same object reference so
  // admin.js's `const S = AdminStore.state` keeps pointing at live data)
  function assign(next) {
    Object.keys(state).forEach(function (k) {
      if (!(k in next)) delete state[k];
    });
    Object.keys(next).forEach(function (k) { state[k] = next[k]; });
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* quota / private mode */ }
  }

  function reloadFromStorage() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (_) { raw = null; }
    if (!raw) { assign(clone(DEFAULTS)); return; }
    try { assign(deepMerge(DEFAULTS, JSON.parse(raw))); }
    catch (_) { assign(deepMerge(DEFAULTS, {})); }
  }

  function notify() {
    subs.slice().forEach(function (fn) {
      try { fn(state); } catch (e) { /* one bad subscriber must not break others */ }
    });
  }

  var bc = ("BroadcastChannel" in window) ? new BroadcastChannel("tbdt-admin") : null;

  function update(mutator) {
    if (typeof mutator === "function") mutator(state);
    save();
    notify();
    if (bc) { try { bc.postMessage({ t: "sync" }); } catch (_) {} }
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    subs.push(fn);
    return function () {
      var i = subs.indexOf(fn);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  if (bc) {
    bc.onmessage = function (e) {
      if (e && e.data && e.data.t === "sync") { reloadFromStorage(); notify(); }
    };
  }
  // fires in OTHER tabs/windows when localStorage changes
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) { reloadFromStorage(); notify(); }
  });

  // initialize on load (seed + save DEFAULTS on first run)
  load();

  window.AdminStore = {
    state: state,
    save: save,
    update: update,
    subscribe: subscribe,
    KEY: KEY,
  };
})();
