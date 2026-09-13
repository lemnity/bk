/* ============================================================
   Технологии творчества · Кабинет администратора — shared persisted state
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
      /* цвета зон — из той же холодной шкалы, что и тарифы в app.js,
         и в том же порядке по цене: по ним набирают тёмный текст */
      { zone: "Партер",    color: "#99B1E7", seats: 166, sold: 150, price: 3500 },
      { zone: "Амфитеатр", color: "#B6CFE8", seats: 300, sold: 220, price: 2200 },
      { zone: "Балкон",    color: "#D2E2EC", seats: 120, sold: 70,  price: 1200 },
      { zone: "Ложа",      color: "#929BE4", seats: 24,  sold: 20,  price: 5000 },
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
      { org: "Технологии творчества · свой репертуар",       title: "Прощальные гастроли",     hall: "Большой зал", start: 8,  days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "Технологии творчества · свой репертуар",       title: "Гамлет",                  hall: "Большой зал", start: 14, days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "Технологии творчества · свой репертуар",       title: "Чайка",                   hall: "Большой зал", start: 26, days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "Технологии творчества · свой репертуар",       title: "Ревизор",                 hall: "Малая сцена", start: 5,  days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "Технологии творчества · свой репертуар",       title: "Вишнёвый сад",            hall: "Малая сцена", start: 14, days: 1, type: "own",  amount: 0,      status: "confirmed" },
      { org: "Технологии творчества · свой репертуар",       title: "Щелкунчик",               hall: "Малая сцена", start: 27, days: 1, type: "own",  amount: 0,      status: "confirmed" },
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
    /* Площадки: id — внешний номер площадки, layoutIds — id распоясовок
       (их количество показывается в колонке «Распоясовки»),
       deleted — мягкое удаление под фильтр «Только удалённые». */
    /* Избранные отчёты — номера строк каталога (см. admin-reports.js).
       Хранится здесь, чтобы звёздочка переживала перезагрузку и
       синхронизировалась между вкладками, как остальное состояние. */
    REPORT_FAVS: ["1", "3а", "4а", "5", "6", "7", "11", "52", "54", "118", "119"],
    /* Интеграция (см. admin-integration.js): счётчики аналитики и
       произвольный код виджета. Пустая строка = счётчик не подключён,
       поэтому значения именно строки, а не числа: у GA идентификатор
       нечисловой, а ведущий ноль у пикселя терять нельзя. */
    INTEGRATION: {
      metrika: "105493768",
      ga: "UA-136877717-1",
      fb: "",
      vk: "",
      code: "",
    },
    /* Отметки в «Задачах на день» (см. admin-day-tasks.js). Дата
       хранится рядом со списком: сменились сутки — галочки
       обнуляются сами, без отдельной уборки. */
    DAY_TASKS: { date: "", done: [] },
    /* Email рассылки (см. admin-mailings.js). Счётчики отправок лежат
       в самой записи: пересчитать их из писем уже нельзя — рассылка
       ушла, и её результат это факт, а не производная величина. */
    MAILINGS: seedMailings(),
    /* Реклама на билетах (см. admin-ticket-ads.js): макеты, их привязка
       к представлениям, ссылка и журнал правок. Картинка лежит прямо
       в записи как data-URL — отдельного файлового хранилища у витрины
       нет, поэтому загрузка ужимается до размера билетного макета. */
    TICKET_ADS: seedAds(),
    /* Рефералы (см. admin-referrals.js): базовый адрес страницы
       с виджетом и метки партнёров. Ссылка для размещения нигде не
       хранится — она собирается из base и slug, иначе при смене
       адреса виджета половина ссылок осталась бы со старым. */
    REFERRALS: {
      base: "https://tvorchestvo.ru/afisha",
      items: [
        { id: 2020, name: "блогер",      slug: "bloger"       },
        { id: 1683, name: "SpecialLink", slug: "speciallink"  },
        { id: 1467, name: "Дмитриев",    slug: "dmitriev"     },
        { id: 1343, name: "Тест1",       slug: "test1"        },
        { id: 886,  name: "инструкция",  slug: "instruktsiya" },
        { id: 831,  name: "Школа111",    slug: "shkola111"    },
      ],
    },
    VENUES: [
      { id: 165454, name: "Технологии творчества · Большая сцена", altName: "Технологии творчества · основная сцена",
        address: "Тюмень, ул. Республики, 129", building: "Историческое здание",
        buildingAddress: "Россия, Тюмень, ул. Республики, 129", city: "Тюмень",
        sectors: 4, layoutIds: [900101, 900102], base: true, acceptor: "7701234567", deleted: false },
      { id: 165455, name: "Технологии творчества · Малая сцена", altName: "",
        address: "Тюмень, ул. Республики, 129", building: "Малый зал",
        buildingAddress: "Россия, Тюмень, ул. Республики, 129", city: "Тюмень",
        sectors: 2, layoutIds: [900103], base: false, acceptor: "7701234567", deleted: false },
      { id: 165456, name: "Технологии творчества · Летняя площадка", altName: "Амфитеатр у набережной",
        address: "Тюмень, ул. Челюскинцев, 2", building: "Открытая сцена",
        buildingAddress: "Россия, Тюмень, ул. Челюскинцев, 2", city: "Тюмень",
        sectors: 3, layoutIds: [], base: false, acceptor: "", deleted: false },
      { id: 165457, name: "ДК «Нефтяник»", altName: "",
        address: "Тюмень, ул. Осипенко, 1", building: "Концертный зал",
        buildingAddress: "Россия, Тюмень, ул. Осипенко, 1", city: "Тюмень",
        sectors: 5, layoutIds: [900110], base: false, acceptor: "7702345678", deleted: false },
      { id: 165458, name: "Тобольский драматический театр", altName: "ТДТ им. Ершова",
        address: "Тобольск, ул. Ремезова, 21", building: "Основное здание",
        buildingAddress: "Россия, Тобольск, ул. Ремезова, 21", city: "Тобольск",
        sectors: 3, layoutIds: [900120], base: false, acceptor: "", deleted: false },
      { id: 165459, name: "Ялуторовск · ЦКД", altName: "",
        address: "Ялуторовск, ул. Ленина, 46", building: "Большой зал",
        buildingAddress: "Россия, Ялуторовск, ул. Ленина, 46", city: "Ялуторовск",
        sectors: 2, layoutIds: [], base: false, acceptor: "", deleted: false },
      { id: 165460, name: "ТЮЗ Киселёва, Историческая сцена", altName: "",
        address: "Саратов, Вольская улица, 83", building: "ТЮЗ Киселёва. Историческое здание",
        buildingAddress: "Россия, Саратов, Вольская улица, 83", city: "Саратов",
        sectors: 3, layoutIds: [900130], base: false, acceptor: "", deleted: false },
      { id: 165461, name: "Космонавт", altName: "",
        address: "Санкт-Петербург, Бронницкая улица, 24", building: "Космонавт",
        buildingAddress: "Россия, Санкт-Петербург, Бронницкая улица, 24", city: "Санкт-Петербург",
        sectors: 10, layoutIds: [], base: false, acceptor: "", deleted: false },
      { id: 165462, name: "Технологии творчества · Большая сцена (Копия)", altName: "",
        address: "Тюмень, ул. Республики, 129", building: "Историческое здание",
        buildingAddress: "Россия, Тюмень, ул. Республики, 129", city: "Тюмень",
        sectors: 4, layoutIds: [], base: false, acceptor: "", deleted: true },
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


  /* ---- демо-баннеры для «Рекламы на билетах» ----
     Картинки собираются SVG-строкой, а не лежат файлами в assets:
     так seed весит три килобайта вместо трёх мегабайт и точно
     попадает в те пропорции, которые раздел требует от загрузки
     (1200×402 для вертикального билета, 420×1120 для горизонтального).
     Настоящие макеты приходят из формы загрузки и хранятся уже
     как JPEG data-URL. */
  function adImage(kind, bg, cap, lines) {
    var W = kind === "v" ? 1200 : 420;
    var H = kind === "v" ? 402 : 1120;
    var big = kind === "v" ? 76 : 42;
    var sm = kind === "v" ? 34 : 24;
    var gap = big * 1.3;
    var top = H / 2 - ((lines.length - 1) * gap) / 2 + big * 0.34;
    var font = 'font-family="Rubik, Arial, sans-serif"';

    var body = lines.map(function (t, i) {
      return '<text x="' + (W / 2) + '" y="' + (top + i * gap) + '" text-anchor="middle" ' +
        font + ' font-size="' + big + '" font-weight="600" fill="#ffffff">' + t + '</text>';
    }).join("");

    var eyebrow = '<text x="' + (W / 2) + '" y="' + (kind === "v" ? 74 : 132) + '" ' +
      'text-anchor="middle" ' + font + ' font-size="' + sm + '" font-weight="500" ' +
      'letter-spacing="' + (sm * 0.16).toFixed(1) + '" fill="#ffffff" opacity=".62">' + cap + '</text>';

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" ' +
      'viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>' +
      eyebrow + body + '</svg>';

    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function ad(id, kind, bg, cap, lines, extra) {
    var o = {
      id: id, kind: kind,
      w: kind === "v" ? 1200 : 420,
      h: kind === "v" ? 402 : 1120,
      src: adImage(kind, bg, cap, lines),
      forShows: false, shows: [], link: "",
    };
    return Object.assign(o, extra || {});
  }

  function seedAds() {
    return {
      /* журнал правок — кнопка «Логи» над сеткой */
      log: [
        { at: "2026-09-02T09:14:00.000Z", what: "Добавлено изображение Id: 7126" },
        { at: "2026-09-04T15:41:00.000Z", what: "Id: 6698 — привязано к представлениям (1)" },
        { at: "2026-09-09T11:07:00.000Z", what: "Id: 5870 — изменена ссылка" },
      ],
      items: [
        ad(7126, "v", "#173A6D", "ПАРТНЁР ТЕАТРА",
           ["Кофейня «Антракт»", "кофе и десерт по билету — 15%"],
           { link: "https://antrakt-coffee.ru" }),
        ad(6849, "h", "#0F2A53", "АБОНЕМЕНТ",
           ["Сезон", "2026/27", "шесть", "спектаклей"],
           { link: "https://tvorchestvo.ru/abonement" }),
        ad(6698, "v", "#5B2233", "ПОСЛЕ СПЕКТАКЛЯ",
           ["Ресторан «Партер»", "ул. Республики, 34"],
           { forShows: true, shows: ["Гамлет — Большой зал"], link: "https://parter-rest.ru" }),
        ad(6471, "h", "#1D4E3C", "ДЕТЯМ",
           ["Детская", "студия", "Технологии творчества", "набор с 7 лет"],
           { forShows: true, shows: ["Щелкунчик — Большой зал", "Щелкунчик — Малая сцена"] }),
        ad(5870, "v", "#2F3A54", "КНИЖНЫЙ МАГАЗИН",
           ["«Сюжет» на Республики", "пьесы и биографии — 10%"],
           { link: "https://sujet-books.ru" }),
        ad(5401, "h", "#6A3A12", "ДОМОЙ",
           ["Такси", "«Антракт»", "подача", "к разъезду"],
           { forShows: true, shows: [] }),
      ],
    };
  }


  /* ---- демо-рассылки ----
     Письмо хранится не готовым HTML, а деревом блоков: HTML для
     отправки собирается из него (см. admin-letter.js). Иначе
     рассылку нельзя было бы открыть и поправить — только переверстать. */
  function letter(blocks, style) {
    return {
      style: Object.assign({
        bg: "#F2F5F9",      /* поле вокруг письма */
        canvas: "#FFFFFF",  /* холст самого письма */
        border: "",         /* рамка холста; пусто — рамки нет */
        radius: 0,
        font: "modern",
        ink: "#132437",
      }, style || {}),
      blocks: blocks || [],
    };
  }

  function seedMailings() {
    var promo = letter([
      { t: "heading", text: "Сезон 2026/27 открыт", size: 30, align: "center", color: "" },
      { t: "text", text: "Продажа билетов на сентябрь и октябрь уже идёт. " +
        "Подписчикам — предпродажа за сутки до общего старта.", size: 15, align: "center", color: "" },
      { t: "spacer", height: 20 },
      { t: "button", text: "Смотреть афишу", href: "https://tvorchestvo.ru/afisha",
        bg: "#173A6D", color: "#FFFFFF", align: "center", radius: 6 },
      { t: "spacer", height: 12 },
      { t: "divider", color: "#DCE3ED", thickness: 1 },
      { t: "text", text: "Вы получили это письмо, потому что подписались на афишу.",
        size: 12, align: "center", color: "#596A82" },
    ]);

    var test = letter([
      { t: "heading", text: "Проверка вёрстки", size: 24, align: "left", color: "" },
      { t: "text", text: "Тестовое письмо, отправлено вручную на служебный адрес.",
        size: 15, align: "left", color: "" },
    ]);

    return {
      items: [
        { id: 14815, at: "2026-09-03 10:04:00", name: "Премьера «Гамлета»",
          audience: "all", emails: "", total: 36, queued: 0, sent: 36, read: 19,
          clicks: 7, unsub: 1, invalid: 0, status: "done", archived: false,
          distributors: true, promo: "any", letter: promo },
        { id: 14812, at: "2026-09-02 09:30:00", name: "Сезон 2026/27 открыт",
          audience: "all", emails: "", total: 36, queued: 0, sent: 36, read: 24,
          clicks: 11, unsub: 0, invalid: 1, status: "done", archived: false,
          distributors: false, promo: "any", letter: promo },
        { id: 14802, at: "2026-08-28 20:28:49", name: "Тест рассылки 3",
          audience: "list", emails: "xo2a819o@spamtest.smtp.bz", total: 1, queued: 0,
          sent: 1, read: 1, clicks: 0, unsub: 0, invalid: 0, status: "done",
          archived: false, distributors: false, promo: "any", letter: test },
        { id: 14801, at: "2026-08-28 20:21:50", name: "Тестирование письма 2",
          audience: "list", emails: "dc96589c51aaf77e@mailo-post.ru, unlike777@gmail.com",
          total: 2, queued: 0, sent: 2, read: 1, clicks: 0, unsub: 0, invalid: 0,
          status: "done", archived: false, distributors: false, promo: "any", letter: test },
        { id: 14771, at: "2026-08-26 18:34:03", name: "Тестирование письма",
          audience: "list", emails: "26b73a351ee6453e@mailo-post.ru, unlike777@gmail.com",
          total: 2, queued: 0, sent: 2, read: 1, clicks: 0, unsub: 0, invalid: 0,
          status: "done", archived: false, distributors: false, promo: "any", letter: test },
        { id: 14247, at: "2026-03-11 12:15:00", name: "Рапунцель",
          audience: "list", emails: "varvarskaja@gmail.com", total: 1, queued: 0,
          sent: 1, read: 0, clicks: 0, unsub: 0, invalid: 0, status: "done",
          archived: true, distributors: false, promo: "any", letter: test },
      ],
    };
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
