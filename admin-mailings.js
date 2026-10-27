/* ============================================================
   Технологии творчества · Кабинет — раздел «Email рассылки»
   Список отправленных и запланированных рассылок, архив и общая
   модель раздела: статусы, аудитории, счётчик подписчиков и
   правило «не чаще раза в 7 дней».

   База подписчиков берётся из «Аудиторий» (AdminAudiences.contacts):
   это одни и те же люди, и второй копии у них быть не должно —
   иначе счётчик в рассылках разойдётся с выгрузками.

   Счётчики отправок (отправлено, прочитано, переходы) хранятся
   в самой записи и не пересчитываются: рассылка ушла, её результат
   это факт, а не производная от текущего состояния базы.

   Модель отдаётся наружу как window.AdminMailings — страница
   добавления подключает этот же файл.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var S = window.AdminStore.state;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var STATUS = {
    draft: "Черновик",
    queue: "В очереди",
    part:  "Частично отправлено",
    done:  "Полностью отправлено",
  };

  /* Отбор по промокоду — условие на прошлые заказы адресата,
     а не на само письмо: «только тем, кто покупал по промокоду». */
  var PROMO = {
    any:     "Не важно",
    with:    "Только с промокодом",
    without: "Только без промокода",
  };

  var THROTTLE_DAYS = 7;

  function box() {
    if (!S.MAILINGS) S.MAILINGS = { items: [] };
    if (!Array.isArray(S.MAILINGS.items)) S.MAILINGS.items = [];
    return S.MAILINGS;
  }

  function subscribers() {
    var A = window.AdminAudiences;
    return (A && A.contacts) ? A.contacts() : [];
  }

  /* «2026-09-03 10:04:00» → Date. Через new Date(строка) нельзя:
     разбор пробельного формата в спецификации не закреплён и в
     Safari даёт Invalid Date. */
  function parseAt(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || ""));
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }

  function ruDateTime(s) {
    var d = parseAt(s);
    if (!d) return String(s || "");
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function ruDate(d) {
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
  }

  function emailList(s) {
    return String(s || "").split(/[,;\s]+/).map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  function audienceLabel(m) {
    return m.audience === "all" ? "Все подписчики" : emailList(m.emails).join(", ");
  }

  /* ---- правило «раз в 7 дней» ----
     Ограничение стоит на рассылках по ВСЕЙ базе: точечные отправки
     на список адресов им не считаются, иначе одна проверка вёрстки
     закрывала бы отправку на неделю. */
  function lastMass() {
    return box().items
      .filter(function (m) { return m.audience === "all" && m.status !== "draft"; })
      .map(function (m) { return { m: m, d: parseAt(m.at) }; })
      .filter(function (x) { return x.d; })
      .sort(function (a, b) { return b.d - a.d; })[0] || null;
  }

  function throttle(now) {
    var total = subscribers().length;
    var last = lastMass();
    if (!last) return { total: total, available: total, until: null, last: null };
    var until = new Date(last.d.getTime() + THROTTLE_DAYS * 86400000);
    var t = (now || new Date()).getTime();
    return t >= until.getTime()
      ? { total: total, available: total, until: null, last: last.m }
      : { total: total, available: 0, until: until, last: last.m };
  }

  function nextId() {
    return box().items.reduce(function (a, m) { return Math.max(a, m.id); }, 14000) + 1;
  }

  function plural(n, forms) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  }

  window.AdminMailings = {
    STATUS: STATUS, PROMO: PROMO, THROTTLE_DAYS: THROTTLE_DAYS,
    all: function () { return box().items; },
    find: function (id) {
      return box().items.filter(function (m) { return String(m.id) === String(id); })[0] || null;
    },
    subscribers: subscribers,
    audienceLabel: audienceLabel,
    emailList: emailList,
    throttle: throttle,
    nextId: nextId,
    parseAt: parseAt,
    ruDateTime: ruDateTime,
    ruDate: ruDate,
    plural: plural,
    esc: esc,
  };

  /* ------------------------------------------------------------
     Список (mailings.html)
     ------------------------------------------------------------ */
  var host = $("#mlList");
  if (!host) return;

  var showArchive = false;
  var open = null;         /* { id, what: "letter" | "who" } — раскрытая строка */
  var pendingArchive = null;

  var COLS = [
    { k: "id",      label: "id",                 cls: "ml-id"  },
    { k: "at",      label: "Дата",               cls: "ml-at"  },
    { k: "name",    label: "Название"                          },
    { k: "aud",     label: "Целевая аудитория",  cls: "ml-aud" },
    { k: "total",   label: "Всего",              num: true },
    { k: "queued",  label: "В очереди",          num: true },
    { k: "sent",    label: "Отправлено",         num: true },
    { k: "read",    label: "Прочитано",          num: true },
    { k: "clicks",  label: "Переходов",          num: true },
    { k: "unsub",   label: "Отписок",            num: true },
    { k: "invalid", label: "Невалидные почты",   num: true },
    { k: "status",  label: "Статус",             cls: "ml-st" },
  ];

  /* ---- получатели ----
     Поимённой отчётности в состоянии нет, но счётчики есть — и
     список должен с ними сходиться до единицы, иначе детализация
     противоречит строке таблицы. Поэтому раскладываем ровно по
     счётчикам, а не выдумываем случайные исходы. */
  function recipients(m) {
    var base = m.audience === "all"
      ? subscribers().map(function (c) { return c.email; })
      : emailList(m.emails);

    var out = [];
    var take = function (n, label, cls) {
      for (var i = 0; i < n && out.length < base.length; i++) {
        out.push({ email: base[out.length], label: label, cls: cls });
      }
    };
    take(m.invalid, "Невалидный адрес", "bad");
    take(m.unsub,   "Отписался",        "warn");
    take(m.clicks,  "Перешёл по ссылке", "ok");
    take(Math.max(0, m.read - m.clicks), "Прочитано", "ok");
    take(Math.max(0, m.sent - m.invalid - m.unsub - m.read), "Отправлено", "");
    take(m.queued,  "В очереди",        "warn");
    while (out.length < base.length) out.push({ email: base[out.length], label: "—", cls: "" });
    return out;
  }

  function detailHtml(m) {
    if (!open || open.id !== m.id) return "";
    var span = COLS.length + 1;

    if (open.what === "letter") {
      /* просмотр письма — с демо-значениями переменных, как предпросмотр в редакторе */
      var html = window.AdminLetter ? window.AdminLetter.renderVars(window.AdminLetter.toHtml(m.letter)) : "";
      var tested = window.AdminLetter && window.AdminLetter.lastTest ? window.AdminLetter.lastTest(m.letter) : "";
      return '<tr class="ml-detail"><td colspan="' + span + '">' +
        '<div class="ml-detail-h">Письмо · ' + esc(m.name) + "</div>" +
        (tested ? '<p class="ml-detail-t">' + esc(tested) + "</p>" : "") +
        '<iframe class="ml-frame" sandbox="" title="Письмо «' + esc(m.name) + '»" srcdoc="' + esc(html) + '"></iframe>' +
        "</td></tr>";
    }

    var rows = recipients(m);
    return '<tr class="ml-detail"><td colspan="' + span + '">' +
      '<div class="ml-detail-h">Получатели · ' + rows.length + " " +
        plural(rows.length, ["адрес", "адреса", "адресов"]) + "</div>" +
      '<div class="ml-who">' + rows.map(function (r) {
        return '<span class="ml-who-i' + (r.cls ? " is-" + r.cls : "") + '">' +
          esc(r.email) + '<b>' + esc(r.label) + "</b></span>";
      }).join("") + "</div></td></tr>";
  }

  function rowHtml(m) {
    var acts = pendingArchive === m.id
      ? '<span class="ad-confirm">' + (showArchive ? "Удалить навсегда?" : "В архив?") +
        '<button class="btn-mini danger" data-act="arc-yes" type="button">Да</button>' +
        '<button class="btn-mini" data-act="arc-no" type="button">Отмена</button></span>'
      : '<button class="rowact" data-act="letter" type="button" title="Посмотреть письмо">' +
          '<span class="vh">Посмотреть письмо</span>◉</button>' +
        '<button class="rowact" data-act="who" type="button" title="Получатели">' +
          '<span class="vh">Получатели</span>▤</button>' +
        (showArchive
          ? '<button class="rowact" data-act="restore" type="button" title="Вернуть из архива">' +
            '<span class="vh">Вернуть из архива</span>↩</button>' +
            '<button class="rowact danger" data-act="arc" type="button" title="Удалить навсегда">' +
            '<span class="vh">Удалить навсегда</span>🗑</button>'
          : '<button class="rowact danger" data-act="arc" type="button" title="В архив">' +
            '<span class="vh">В архив</span>🗑</button>');

    var cells = COLS.map(function (c) {
      if (c.k === "at")     return '<td class="ml-at">' + esc(ruDateTime(m.at)) + "</td>";
      if (c.k === "name")   return "<td><a class=\"rep-link\" href=\"mailing.html?id=" + m.id + "\">" +
                                   esc(m.name) + "</a></td>";
      if (c.k === "aud")    return '<td class="ml-aud">' + esc(audienceLabel(m)) + "</td>";
      if (c.k === "status") return '<td class="ml-st"><span class="ml-badge is-' + esc(m.status) +
                                   '">' + esc(STATUS[m.status] || m.status) + "</span></td>";
      return '<td class="' + (c.cls || "") + (c.num ? " num" : "") + '">' + esc(m[c.k]) + "</td>";
    }).join("");

    return '<tr data-id="' + m.id + '">' + cells + '<td class="acts">' + acts + "</td></tr>" +
      detailHtml(m);
  }

  function render() {
    var items = box().items.filter(function (m) { return !!m.archived === showArchive; });

    $("#mlArcBtn").textContent = showArchive ? "← К рассылкам" : "Архив рассылок";
    $("#mlAdd").hidden = showArchive;
    $("#mlNote").hidden = showArchive;

    if (!items.length) {
      host.innerHTML = '<p class="rep-empty">' + (showArchive
        ? "Архив пуст."
        : "Рассылок пока нет. Нажмите «Добавить» — и соберите первое письмо.") + "</p>";
      return;
    }

    host.innerHTML =
      '<div class="table-wrap"><table class="dtable ml-table"><thead><tr>' +
      COLS.map(function (c) {
        return '<th class="' + (c.cls || "") + (c.num ? " num" : "") + '">' + esc(c.label) + "</th>";
      }).join("") + '<th class="acts">Действия</th></tr></thead><tbody>' +
      items.map(rowHtml).join("") + "</tbody></table></div>";
  }

  function renderNote() {
    var t = throttle();
    var when = t.until ? " Следующая — с " + ruDate(t.until) + "." : "";
    var last = t.last ? " Последняя рассылка по всей базе — «" + esc(t.last.name) + "», " +
      ruDateTime(t.last.at) + "." : "";
    $("#mlNote").innerHTML =
      "<b>Внимание!</b><br />Рассылки по всем подписчикам могут быть отправлены не чаще " +
      "раза в " + THROTTLE_DAYS + " дней.<br />На данный момент доступно для отправки " +
      t.available + " из " + t.total + " " +
      plural(t.total, ["подписчика", "подписчиков", "подписчиков"]) + "." + when + last;
  }

  $("#mlAdd").addEventListener("click", function () { location.href = "mailing.html"; });

  $("#mlArcBtn").addEventListener("click", function () {
    showArchive = !showArchive;
    open = null;
    pendingArchive = null;
    render();
  });

  host.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = Number(btn.closest("tr").dataset.id);
    var act = btn.dataset.act;

    if (act === "letter" || act === "who") {
      open = (open && open.id === id && open.what === act) ? null : { id: id, what: act };
      render();
      return;
    }
    if (act === "arc")     { pendingArchive = id;   render(); return; }
    if (act === "arc-no")  { pendingArchive = null; render(); return; }

    if (act === "restore") {
      window.AdminStore.update(function () {
        var m = window.AdminMailings.find(id);
        if (m) m.archived = false;
      });
      render();
      toast("Рассылка возвращена из архива");
      return;
    }

    if (act === "arc-yes") {
      pendingArchive = null;
      var wasArchive = showArchive;
      window.AdminStore.update(function () {
        if (wasArchive) {
          S.MAILINGS.items = S.MAILINGS.items.filter(function (m) { return m.id !== id; });
        } else {
          var m = window.AdminMailings.find(id);
          if (m) m.archived = true;
        }
      });
      open = null;
      render();
      renderNote();
      toast(wasArchive ? "Рассылка удалена" : "Рассылка убрана в архив");
    }
  });

  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  window.AdminStore.subscribe(function () {
    pendingArchive = null;
    render();
    renderNote();
  });

  renderNote();
  render();
})();
