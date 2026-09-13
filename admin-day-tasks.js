/* ============================================================
   Технологии творчества · Кабинет — ЗАДАЧИ НА ДЕНЬ
   Карточка справа на Консоли. Список не выдуман и не заведён
   руками: он вычисляется из состояния кабинета. Задача здесь —
   это место, где что-то настроено наполовину и поэтому молча не
   работает: макет рекламы без привязки, черновик рассылки,
   пустой адрес виджета у рефералов, неподключённый счётчик.

   Такие вещи не падают с ошибкой и не видны на своих экранах,
   пока туда не зайдёшь. Поэтому им нужна одна общая витрина.

   Отметка «сделано» живёт до конца суток: список пересобирается
   заново каждый день, и вчерашние галочки к нему не относятся.
   Отметка ничего не чинит — она убирает строку с глаз.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var host = $("#dayList");
  if (!host) return;

  var S = window.AdminStore.state;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня",
                "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  var DAYS = ["воскресенье", "понедельник", "вторник", "среда",
              "четверг", "пятница", "суббота"];

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function humanDate() {
    var d = new Date();
    return d.getDate() + " " + MONTHS[d.getMonth()] + ", " + DAYS[d.getDay()];
  }

  /* ---- отметки ----
     Храним дату вместе со списком: сменились сутки — галочки
     обнуляются сами, без отдельной уборки. */
  function marks() {
    if (!S.DAY_TASKS || S.DAY_TASKS.date !== today()) {
      S.DAY_TASKS = { date: today(), done: [] };
    }
    return S.DAY_TASKS;
  }

  /* ------------------------------------------------------------
     Что считать задачей
     ------------------------------------------------------------
     level: "warn" — настроено наполовину, тихо не работает;
            "todo" — обычное дело, которое ждёт решения. */
  function collect() {
    var out = [];
    var add = function (id, level, text, href, hint) {
      out.push({ id: id, level: level, text: text, href: href, hint: hint || "" });
    };

    /* ---- рассылки ---- */
    var ml = (S.MAILINGS && S.MAILINGS.items) || [];
    ml.filter(function (m) { return !m.archived && m.status === "draft"; })
      .forEach(function (m) {
        add("ml-draft-" + m.id, "todo", "Дописать черновик рассылки «" + m.name + "»",
            "mailing.html?id=" + m.id);
      });
    var queued = ml.filter(function (m) { return !m.archived && m.status === "queue"; });
    if (queued.length) {
      add("ml-queue", "todo", "В очереди на отправку: " + queued.length + " " +
          plural(queued.length, ["рассылка", "рассылки", "рассылок"]), "mailings.html",
          queued.map(function (m) { return m.name; }).join(", "));
    }

    /* ---- реклама на билетах ---- */
    var ads = (S.TICKET_ADS && S.TICKET_ADS.items) || [];
    ads.filter(function (a) { return a.forShows && !(a.shows || []).length; })
      .forEach(function (a) {
        add("ad-noshow-" + a.id, "warn",
            "Макет Id " + a.id + " помечен «только для представлений», но ни одно не выбрано",
            "ticket-ads.html", "Такой макет не попадёт ни на один билет.");
      });
    var noLink = ads.filter(function (a) { return !a.link; });
    if (noLink.length) {
      add("ad-nolink", "todo", "Без ссылки: " + noLink.length + " " +
          plural(noLink.length, ["макет", "макета", "макетов"]) + " рекламы", "ticket-ads.html",
          "Id " + noLink.map(function (a) { return a.id; }).join(", "));
    }

    /* ---- рефералы ---- */
    var ref = S.REFERRALS || {};
    if (!String(ref.base || "").trim() && (ref.items || []).length) {
      add("ref-nobase", "warn",
          "Не указан адрес страницы с виджетом — реферальные ссылки не собираются",
          "referrals.html", (ref.items || []).length + " меток без рабочей ссылки.");
    }

    /* ---- интеграция ---- */
    var it = S.INTEGRATION || {};
    if (!String(it.metrika || "").trim()) {
      add("int-metrika", "warn", "Счётчик Яндекс Метрики не подключён", "integration.html",
          "Статистика по виджету не собирается.");
    }
    if (!String(it.ga || "").trim()) {
      add("int-ga", "todo", "Счётчик Google Analytics не подключён", "integration.html");
    }

    /* ---- аренда ---- */
    var wait = (S.RENTALS || []).filter(function (r) {
      return r.status === "request" || r.status === "option";
    });
    wait.forEach(function (r) {
      add("rent-" + r.org + "-" + r.start, r.status === "request" ? "warn" : "todo",
          (r.status === "request" ? "Заявка на аренду: " : "Опция без подтверждения: ") +
          r.org + " — " + r.title, "rental.html", r.hall + ", с " + r.start + " числа");
    });

    return out;
  }

  function plural(n, forms) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  }

  /* ------------------------------------------------------------
     Отрисовка
     ------------------------------------------------------------ */
  var showDone = false;

  function render() {
    var all = collect();
    var done = marks().done;
    var left = all.filter(function (t) { return done.indexOf(t.id) === -1; });
    var hidden = all.length - left.length;

    $("#dayDate").textContent = humanDate();
    $("#dayCount").textContent = left.length
      ? left.length + " " + plural(left.length, ["дело", "дела", "дел"])
      : "";

    if (!all.length) {
      host.innerHTML = '<p class="day-clear">Незакрытых хвостов нет — всё настроено.</p>';
      return;
    }
    if (!left.length) {
      host.innerHTML = '<p class="day-clear">На сегодня всё разобрано.</p>' + doneToggle(hidden, all, done);
      return;
    }

    host.innerHTML = '<ul class="day-list">' + left.map(itemHtml).join("") + "</ul>" +
      doneToggle(hidden, all, done);
  }

  function itemHtml(t) {
    return '<li class="day-i is-' + esc(t.level) + '" data-id="' + esc(t.id) + '">' +
      '<button class="day-check" type="button" data-act="done" title="Убрать до завтра">' +
        '<span class="vh">Убрать до завтра</span></button>' +
      '<span class="day-b">' +
        '<a class="day-t" href="' + esc(t.href) + '">' + esc(t.text) + "</a>" +
        (t.hint ? '<span class="day-h">' + esc(t.hint) + "</span>" : "") +
      "</span></li>";
  }

  function doneToggle(hidden, all, done) {
    if (!hidden) return "";
    var body = showDone
      ? '<ul class="day-list day-list-done">' + all.filter(function (t) {
          return done.indexOf(t.id) !== -1;
        }).map(function (t) {
          return '<li class="day-i is-done" data-id="' + esc(t.id) + '">' +
            '<button class="day-check is-on" type="button" data-act="undone" title="Вернуть">' +
            '<span class="vh">Вернуть</span>✓</button>' +
            '<span class="day-b"><span class="day-t">' + esc(t.text) + "</span></span></li>";
        }).join("") + "</ul>"
      : "";
    return '<button class="day-more" type="button" data-act="toggle">' +
      (showDone ? "Скрыть убранные" : "Убрано сегодня: " + hidden) + "</button>" + body;
  }

  host.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;

    if (btn.dataset.act === "toggle") { showDone = !showDone; render(); return; }

    var id = btn.closest("[data-id]").dataset.id;
    window.AdminStore.update(function () {
      var m = marks();
      var i = m.done.indexOf(id);
      if (btn.dataset.act === "done" && i === -1) m.done.push(id);
      if (btn.dataset.act === "undone" && i !== -1) m.done.splice(i, 1);
    });
    render();
  });

  window.AdminStore.subscribe(render);
  render();
})();
