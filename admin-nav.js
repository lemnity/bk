/* ============================================================
   ТБДТ · Кабинет администратора — навигация сайдбара
   Единый источник структуры меню: дерево описано здесь, разметка
   рендерится в #sideNav на каждой странице кабинета. Активный пункт
   определяется по атрибуту data-page у <body>.

   Новый подраздел = одна строка в NAV. Пункт без href — заготовка,
   она открывается страницей-шаблоном section.html?s=<page>.
   ============================================================ */
(function () {
  "use strict";

  const STUB_BASE = "section.html?s=";
  const LS_KEY = "tbdt.nav.open";

  const NAV = [
    { page: "overview", label: "Консоль", icon: "◉", href: "admin.html" },

    {
      id: "admin", label: "Администрирование", icon: "▥",
      items: [
        { page: "venues",       label: "Площадки",               icon: "◫", href: "venues.html" },
        { page: "halls",        label: "Залы",                   icon: "▦", href: "halls.html"  },
        { page: "rental",       label: "Аренда зала",            icon: "⌂", href: "rental.html" },
        { page: "shows",        label: "Представления",          icon: "≡" },
        { page: "actors",       label: "Актёры",                 icon: "☆", href: "actors.html" },
        { page: "goods",        label: "Товары",                 icon: "▨" },
        { page: "events",       label: "События",                icon: "◈", href: "events.html" },
        { page: "orders",       label: "Заказы",                 icon: "≣" },
        { page: "reports",      label: "Отчёты",                 icon: "▧", href: "reports.html" },
        { page: "bank-orders",  label: "Заказы на р/с",          icon: "№" },
        { page: "distributors", label: "Распространители",       icon: "⇄" },
        { page: "quotas",       label: "Квоты",                  icon: "◔" },
        { page: "cashiers",     label: "Кассиры",                icon: "◧" },
        { page: "blanks",       label: "Учёт билетных бланков",  icon: "▯" },
        { page: "users",        label: "Пользователи",           icon: "◍" },
        { page: "roles",        label: "Роли и доступы",         icon: "⊘" },
        { page: "sellers",      label: "Продавцы билетов",       icon: "$" },
        { page: "analytics",    label: "Аналитика",              icon: "∿", href: "analytics.html" },
        { page: "organizers",   label: "Организаторы",           icon: "◎" },
        { page: "guides",       label: "Гиды",                   icon: "▷" },
        { page: "tariffs",      label: "Тарифы",                 icon: "◇" },
      ]
    },

    {
      id: "settings", label: "Настройки", icon: "⚙",
      items: [
        { page: "prices",        label: "Цены",             icon: "₽", href: "prices.html" },
        { page: "venue",         label: "Реквизиты театра", icon: "⊙" },
        { page: "schedule",      label: "Расписание",       icon: "⊞" },
        { page: "notifications", label: "Уведомления",      icon: "✦" },
      ]
    },

    {
      id: "box", label: "Касса", icon: "▣",
      items: [
        { page: "ledger",  label: "Бухгалтерия", icon: "▤", href: "ledger.html" },
        { page: "refunds", label: "Возвраты",    icon: "↺" },
      ]
    },

    {
      id: "marketing", label: "Маркетинг", icon: "◆",
      items: [
        { page: "ticket-ads",  label: "Реклама на билетах",   icon: "▭" },
        { page: "mailing",     label: "Email рассылки",       icon: "✉" },
        { page: "subscribers", label: "Подписчики",           icon: "⊚" },
        { page: "campaigns",   label: "Акции",                icon: "✧" },
        { page: "social",      label: "Соц. сети",            icon: "⊛" },
        { page: "promo",       label: "Промокоды",            icon: "✂" },
        { page: "closed-sale", label: "Коды закрытых продаж", icon: "⊠" },
        { page: "discounts",   label: "Условные скидки",      icon: "%" },
        { page: "referrals",   label: "Рефералы",             icon: "⊕" },
        { page: "integration", label: "Интеграция",           icon: "⊡" },
        { page: "audiences",   label: "Аудитории",            icon: "▩" },
      ]
    },
  ];

  /* ---------- вспомогательное ---------- */

  const linkOf = item => item.href || STUB_BASE + item.page;

  /** Плоский список всех пунктов — для поиска по page. */
  function flatten() {
    const out = [];
    NAV.forEach(node => {
      if (node.items) node.items.forEach(it => out.push({ ...it, group: node }));
      else out.push({ ...node, group: null });
    });
    return out;
  }

  function find(page) {
    return flatten().find(it => it.page === page) || null;
  }

  /* ---------- память раскрытых групп ---------- */

  function readOpen() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY));
      return Array.isArray(raw) ? raw : null;
    } catch { return null; }
  }

  function writeOpen(ids) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(ids)); } catch { /* приватный режим */ }
  }

  /* ---------- рендер ---------- */

  function render(root) {
    const nav = root || document.getElementById("sideNav");
    if (!nav) return;

    const current = document.body.dataset.page || "";
    const activeItem = find(current);
    const activeGroupId = activeItem && activeItem.group ? activeItem.group.id : null;

    /* Группа с активной страницей раскрыта всегда; остальные — как в прошлый раз.
       Первый визит: раскрыта только активная группа. */
    const remembered = readOpen();
    const isOpen = id =>
      id === activeGroupId || (remembered ? remembered.includes(id) : false);

    nav.innerHTML = "";

    NAV.forEach(node => {
      if (!node.items) {
        nav.appendChild(buildLink(node, current));
        return;
      }

      const open = isOpen(node.id);
      const group = document.createElement("div");
      group.className = "nav-group" + (open ? " open" : "");
      group.dataset.group = node.id;
      if (node.id === activeGroupId) group.classList.add("has-active");

      const bodyId = "ng-" + node.id;

      const head = document.createElement("button");
      head.type = "button";
      head.className = "ng-head";
      head.setAttribute("aria-expanded", String(open));
      head.setAttribute("aria-controls", bodyId);
      head.innerHTML =
        '<span class="ni" aria-hidden="true">' + node.icon + "</span>" +
        '<span class="ng-title">' + node.label + "</span>" +
        '<span class="ng-caret" aria-hidden="true">▾</span>';
      head.addEventListener("click", () => toggle(group, head));

      const body = document.createElement("div");
      body.className = "ng-body";
      body.id = bodyId;

      const inner = document.createElement("div");
      inner.className = "ng-inner";
      node.items.forEach(it => inner.appendChild(buildLink(it, current)));
      body.appendChild(inner);

      group.append(head, body);
      nav.appendChild(group);
    });

    revealActive(nav);
  }

  /** Длинные группы прокручиваются — подводим активный пункт в видимую часть.
      Скроллим только контейнер меню, страницу не трогаем. */
  function revealActive(nav) {
    const a = nav.querySelector("a.active");
    if (!a || nav.scrollHeight <= nav.clientHeight) return;

    /* offsetTop тут не годится: у .ng-inner своя система координат (position:relative).
       Считаем от рамок — надёжно при любой вложенности. */
    const nb = nav.getBoundingClientRect();
    const ab = a.getBoundingClientRect();
    const top = ab.top - nb.top + nav.scrollTop;
    const bottom = top + ab.height;

    if (top < nav.scrollTop) nav.scrollTop = Math.max(0, top - 12);
    else if (bottom > nav.scrollTop + nav.clientHeight) nav.scrollTop = bottom - nav.clientHeight + 12;
  }

  function buildLink(item, current) {
    const a = document.createElement("a");
    a.href = linkOf(item);
    a.dataset.page = item.page;
    if (item.page === current) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
    if (!item.href) a.classList.add("is-stub");
    a.innerHTML =
      '<span class="ni" aria-hidden="true">' + item.icon + "</span>" +
      '<span class="nl">' + item.label + "</span>";
    return a;
  }

  function toggle(group, head) {
    const open = group.classList.toggle("open");
    head.setAttribute("aria-expanded", String(open));

    const ids = [];
    document.querySelectorAll(".nav-group.open").forEach(g => ids.push(g.dataset.group));
    writeOpen(ids);
  }

  window.AdminNav = { tree: NAV, find, flatten, linkOf, render };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => render());
  } else {
    render();
  }
})();
