/* ============================================================
   Технологии творчества · Кабинет администратора — страница формирования отчёта
   report.html?no=<номер>. Заголовок и хлебные крошки берём из
   каталога (admin-reports.js), параметры и столбцы — из спеки
   (admin-report-specs.js). Спеки нет → универсальная форма и
   честная плашка, что параметры этого отчёта ещё не заведены.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = window.AdminReports.esc;

  var no = new URLSearchParams(location.search).get("no") || "";
  var rep = window.AdminReports.find(no);
  var spec = window.AdminReportSpecs.get(no);

  /* ---- отчёт не найден ---- */
  if (!rep) {
    $("#repTitle").textContent = "Отчёт не найден";
    document.title = "Технологии творчества · Кабинет администратора · Отчёт не найден";
    $("#repCrumbTail").textContent = "Отчёт не найден";
    $("#repBody").innerHTML =
      '<section class="panel pad stub">' +
      '<div class="stub-mark" aria-hidden="true">▧</div>' +
      "<h2>Такого отчёта нет</h2>" +
      "<p>Отчёт с номером «" + esc(no) + "» отсутствует в каталоге. " +
      "Возможно, ссылка устарела.</p>" +
      '<a class="stub-back" href="reports.html">← Ко всем отчётам</a></section>';
    return;
  }

  /* Заголовок и крошка — РАЗНЫЕ строки. У 3а в h1 короткое рабочее
     название, а в крошке полное («…с разбивкой оплаты в кассе по
     типам»). Поэтому h1 берём из спеки, а крошку всегда из каталога. */
  var title = (spec && spec.title) || rep.name;
  $("#repTitle").textContent = title;
  $("#repCrumbTail").textContent = no + ". " + rep.name;
  document.title = "Технологии творчества · Кабинет администратора · " + title;

  /* ---- параметры ---- */
  var FALLBACK_FIELDS = [
    { kind: "select", id: "event", col: "left", options: function () {
        var S = window.AdminStore.state;
        var ev = Array.isArray(S.EVENTS) ? S.EVENTS : [];
        return ["Событие не выбрано"].concat(ev.map(function (e) { return e.title + " · " + e.date; }));
      } },
    { kind: "group", id: "from", col: "right", addon: "Период с", control: "date" },
    { kind: "group", id: "to",   col: "right", addon: "по",       control: "date" },
  ];

  var fields  = (spec && spec.fields)  || FALLBACK_FIELDS;
  var columns = (spec && spec.columns) || [];

  function optionsOf(f) {
    var o = typeof f.options === "function" ? f.options() : (f.options || []);
    /* вариант — строка (значение = подпись) или { value, label }:
       у мероприятия в параметр уходит id, а на экране — название */
    return o.map(function (v) {
      if (v && typeof v === "object") {
        return '<option value="' + esc(v.value) + '">' + esc(v.label) + "</option>";
      }
      return "<option>" + esc(v) + "</option>";
    }).join("");
  }

  /* значения формы → параметры rows(params). Ключ — id поля,
     у daterange — keys: [от, до] (или id_from / id_to) */
  function params() {
    var p = {};
    fields.forEach(function (f) {
      if (!f.id) return;
      if (f.kind === "group" && f.control === "daterange") {
        var keys = f.keys || [f.id + "_from", f.id + "_to"];
        var a = $("#f_" + f.id + "_from"), b = $("#f_" + f.id + "_to");
        p[keys[0]] = a ? a.value : "";
        p[keys[1]] = b ? b.value : "";
        return;
      }
      var el = $("#f_" + f.id);
      if (!el) return;
      p[f.id] = f.kind === "check" ? el.checked : el.value;
    });
    return p;
  }

  function fieldHtml(f) {
    if (f.kind === "or") return '<span class="rv-or">или</span>';

    if (f.kind === "check") {
      return '<label class="rv-check"><input type="checkbox" id="f_' + esc(f.id) + '"' +
        (f.on ? " checked" : "") + " /><span>" + esc(f.label) + "</span></label>";
    }

    if (f.kind === "select") {
      return '<select class="rv-select" id="f_' + esc(f.id) + '"' +
        (f.label ? ' aria-label="' + esc(f.label) + '"' : "") + ">" + optionsOf(f) + "</select>";
    }

    if (f.kind === "group") {
      var inner;
      if (f.control === "select") {
        inner = '<select id="f_' + esc(f.id) + '">' + optionsOf(f) + "</select>";
      } else if (f.control === "daterange") {
        /* Диапазон — это ДВА поля, «от» и «до»: у HTML нет одного
           инпута на период, а тянуть datepicker-библиотеку в статику
           ради этого незачем — type="date" открывает календарь ОС
           и на телефоне даёт родное колесо дат. */
        inner = '<input id="f_' + esc(f.id) + '_from" type="date" class="rv-date" ' +
                  'aria-label="' + esc(f.addon) + ' — дата с" />' +
                '<span class="rv-dash" aria-hidden="true">—</span>' +
                '<input id="f_' + esc(f.id) + '_to" type="date" class="rv-date" ' +
                  'aria-label="' + esc(f.addon) + ' — дата по" />';
      } else {
        inner = '<input id="f_' + esc(f.id) + '" type="' + (f.control === "date" ? "date" : "text") +
          '" placeholder="' + esc(f.placeholder || "") + '" autocomplete="off" />';
      }
      return '<div class="rv-group' + (f.control === "daterange" ? " rv-group-range" : "") +
        '"><span class="rv-addon" id="a_' + esc(f.id) + '">' + esc(f.addon) + "</span>" +
        inner + "</div>";
    }
    return "";
  }

  function colHtml(which) {
    var list = fields.filter(function (f) { return (f.col || "left") === which; });
    if (!list.length) return "";
    return '<div class="rv-col rv-col-' + which + '">' +
      list.map(function (f) { return '<div class="rv-row">' + fieldHtml(f) + "</div>"; }).join("") +
      "</div>";
  }

  var hasMid = fields.some(function (f) { return f.kind === "or"; });

  $("#repForm").innerHTML =
    colHtml("left") +
    (hasMid ? '<div class="rv-col rv-col-mid">' +
      fields.filter(function (f) { return f.kind === "or"; })
            .map(function (f) { return '<div class="rv-row">' + fieldHtml(f) + "</div>"; }).join("") +
      "</div>" : (fields.some(function (f) { return (f.col || "left") === "right"; })
      /* сетка формы — три колонки «левая | или | правая»: без пустой
         средней правая колонка встаёт во вторую (auto) и сжимает левую */
      ? '<div class="rv-col rv-col-mid" aria-hidden="true"></div>' : "")) +
    colHtml("right");

  /* ---- столбцы ---- */
  var shown = {};
  columns.forEach(function (c) { shown[c.id] = c.on !== false; });

  /* pickColumns:false — столбцы у отчёта фиксированные, кнопки выбора
     нет (так у 3а). Таблица при этом строится обычным порядком. */
  var canPick = !!columns.length && !(spec && spec.pickColumns === false);

  function buildColumnPicker() {
    var host = $("#repCols");
    if (!canPick) { host.hidden = true; return; }
    /* fixed-столбец (Продавец, Мероприятие) в меню не показываем:
       без него у строк пропадает подпись. Парные столбцы подписываем
       вместе с надстройкой — иначе в меню три одинаковых «Число». */
    $("#repColsMenu").innerHTML = columns.filter(function (c) { return !c.fixed; })
      .map(function (c) {
        var label = (c.group ? c.group + " · " : "") + c.label;
        return '<label class="rv-colopt"><input type="checkbox" data-col="' + esc(c.id) + '"' +
          (shown[c.id] ? " checked" : "") + " /><span>" + esc(label) + "</span></label>";
      }).join("");
  }

  var colsBtn = $("#repColsBtn");
  var colsMenu = $("#repColsMenu");

  colsBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var open = colsMenu.hidden;
    colsMenu.hidden = !open;
    colsBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  /* клик мимо и Esc закрывают меню — иначе оно перекрывает таблицу */
  document.addEventListener("click", function (e) {
    if (colsMenu.hidden) return;
    if (e.target.closest("#repCols")) return;
    colsMenu.hidden = true;
    colsBtn.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !colsMenu.hidden) {
      colsMenu.hidden = true;
      colsBtn.setAttribute("aria-expanded", "false");
      colsBtn.focus();
    }
  });
  colsMenu.addEventListener("change", function (e) {
    var cb = e.target.closest("input[data-col]");
    if (!cb) return;
    shown[cb.dataset.col] = cb.checked;
    if (built) render();
  });

  /* ---- результат ---- */
  var nf = new Intl.NumberFormat("ru-RU");
  function cell(v, type) {
    if (type === "money") return nf.format(Math.round(v)) + " ₽";
    if (type === "int")   return nf.format(v);
    /* неразрывный пробел: по-русски перед % пробел нужен, но в узком
       столбце обычный пробел рвёт значение на две строки */
    if (type === "pct")   return v + "\u00A0%";
    return String(v);
  }

  var built = false;

  function renderTable() {
    var cols = columns.filter(function (c) { return shown[c.id]; });
    if (!cols.length) {
      $("#repResult").innerHTML = '<p class="rep-empty">Не выбрано ни одного столбца.</p>';
      return;
    }
    var rows = spec.rows(params());
    if (!rows.length) {
      $("#repResult").innerHTML = '<p class="rep-empty">Нет данных за выбранный период.</p>';
      return;
    }
    /* «Итого» — суммы int/money, кроме total:false (цены); доли %
       и сальдо считает сама спека в total(rows) */
    var totals = {};
    cols.forEach(function (c) {
      if ((c.type === "int" || c.type === "money") && c.total !== false) {
        totals[c.id] = rows.reduce(function (a, r) { return a + (r[c.id] || 0); }, 0);
      }
    });
    if (spec.total) {
      var extra = spec.total(rows) || {};
      cols.forEach(function (c) { if (c.id in extra) totals[c.id] = extra[c.id]; });
    }

    $("#repResult").innerHTML =
      '<div class="table-wrap"><table class="dtable rv-table"><thead><tr>' +
      cols.map(function (c) {
        return '<th class="' + (c.type === "text" ? "" : "num") + '">' + esc(c.label) + "</th>";
      }).join("") +
      "</tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr>" + cols.map(function (c) {
          var v = r[c.id];
          return '<td class="' + (c.type === "text" ? "" : "num") + '">' +
            (v === undefined || v === null ? "" : esc(cell(v, c.type))) + "</td>";
        }).join("") + "</tr>";
      }).join("") +
      '</tbody><tfoot><tr>' +
      cols.map(function (c, i) {
        if (i === 0) return "<td>Итого</td>";
        return '<td class="num">' + (c.id in totals ? esc(cell(totals[c.id], c.type)) : "") + "</td>";
      }).join("") +
      "</tr></tfoot></table></div>";
  }

  /* ---- бланк документа ----
     У отчёта со спекой doc результат — не таблица, а бланк: шапка
     с «Утверждаю», итоги, свод, подписи. Ту же модель забирают
     кнопки Word и Excel, поэтому собирается она в одном месте. */

  function ruDate(v) {
    if (!v) return "";
    var p = v.split("-");
    return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : v;
  }

  /* строка события под названием отчёта — то, что выбрано в форме */
  function eventLine() {
    var ev = $("#f_event");
    if (ev && ev.selectedIndex > 0) {
      /* в списке событие лежит как «Гамлет · 2026-06-12 · Большой зал»,
         в бланке дата идёт первой */
      var p = ev.value.split(" · ");
      if (p.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(p[1])) {
        return ruDate(p[1]) + " · " + p[0] + " · " + p[2];
      }
      return ev.value;
    }
    var from = $("#f_range_from"), to = $("#f_range_to");
    if (from && to && (from.value || to.value)) {
      return "Период с " + (ruDate(from.value) || "…") + " по " + (ruDate(to.value) || "…");
    }
    var show = $("#f_show");
    if (show && show.selectedIndex > 0) return show.value;
    return "";
  }

  function docModel() {
    var d = spec.doc;
    var rows = spec.rows(params());
    var inv  = d.invites ? d.invites() : null;
    /* пригласительные всегда входят в «Всего:» и в свод; флажок решает
       только, показывать ли их отдельной строкой */
    var all  = inv ? rows.concat([inv]) : rows;
    var sep  = !!($("#f_invites") && $("#f_invites").checked);
    return {
      org: window.AdminReportDoc.org,
      title: title,
      doc: d,
      cols: columns.filter(function (c) { return shown[c.id]; }),
      eventLine: eventLine(),
      rows: rows,
      invites: sep ? inv : null,
      totals:  d.totals  ? d.totals(all)  : null,
      summary: d.summary ? d.summary(all) : null,
    };
  }

  function render() {
    var actions = $("#repDocActions");
    if (!columns.filter(function (c) { return shown[c.id]; }).length) {
      $("#repResult").innerHTML = '<p class="rep-empty">Не выбрано ни одного столбца.</p>';
      actions.hidden = true;
      return;
    }
    if (spec.doc) {
      window.AdminReportDoc.render($("#repResult"), docModel());
      actions.hidden = false;
    } else {
      renderTable();
      actions.hidden = true;
    }
  }

  $("#repRun").addEventListener("click", function () {
    if (!spec) {
      toast("Параметры этого отчёта ещё не заведены");
      return;
    }
    built = true;
    render();
    $("#repResultWrap").hidden = false;
    toast("Отчёт сформирован");
  });

  [["#repWord", "word", "Документ Word сохранён"],
   ["#repExcel", "excel", "Книга Excel сохранена"]].forEach(function (b) {
    $(b[0]).addEventListener("click", function () {
      if (!built || !spec || !spec.doc) return;
      window.AdminReportDoc.download(docModel(), b[1]);
      toast(b[2]);
    });
  });

  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---- избранное в шапке ---- */
  var favBtn = $("#repFavBtn");
  function syncFav() {
    var on = window.AdminReports.isFav(no);
    favBtn.classList.toggle("is-fav", on);
    favBtn.setAttribute("aria-pressed", on ? "true" : "false");
    favBtn.title = on ? "Убрать из избранного" : "В избранное";
    $("#repFavLabel").textContent = on ? "В избранном" : "В избранное";
  }
  favBtn.addEventListener("click", function () {
    window.AdminReports.toggleFav(no);
    syncFav();
  });

  /* спеки нет — говорим прямо, а не показываем пустую таблицу */
  if (!spec) $("#repNotice").hidden = false;

  buildColumnPicker();
  syncFav();
})();
