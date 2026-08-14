/* ============================================================
   ТБДТ · Кабинет администратора — страница формирования отчёта
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
    document.title = "ТБДТ · Кабинет администратора · Отчёт не найден";
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
  document.title = "ТБДТ · Кабинет администратора · " + title;

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
    return o.map(function (v) { return "<option>" + esc(v) + "</option>"; }).join("");
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
      "</div>" : "") +
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
    $("#repColsMenu").innerHTML = columns.map(function (c) {
      return '<label class="rv-colopt"><input type="checkbox" data-col="' + esc(c.id) + '"' +
        (shown[c.id] ? " checked" : "") + " /><span>" + esc(c.label) + "</span></label>";
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
    if (built) renderTable();
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
    var rows = spec.rows();
    var totals = {};
    cols.forEach(function (c) {
      if (c.type === "int" || c.type === "money") {
        totals[c.id] = rows.reduce(function (a, r) { return a + (r[c.id] || 0); }, 0);
      }
    });

    $("#repResult").innerHTML =
      '<div class="table-wrap"><table class="dtable rv-table"><thead><tr>' +
      cols.map(function (c) {
        return '<th class="' + (c.type === "text" ? "" : "num") + '">' + esc(c.label) + "</th>";
      }).join("") +
      "</tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr>" + cols.map(function (c) {
          return '<td class="' + (c.type === "text" ? "" : "num") + '">' +
            esc(cell(r[c.id], c.type)) + "</td>";
        }).join("") + "</tr>";
      }).join("") +
      '</tbody><tfoot><tr>' +
      cols.map(function (c, i) {
        if (i === 0) return "<td>Итого</td>";
        return '<td class="num">' + (c.id in totals ? esc(cell(totals[c.id], c.type)) : "") + "</td>";
      }).join("") +
      "</tr></tfoot></table></div>";
  }

  $("#repRun").addEventListener("click", function () {
    if (!spec) {
      toast("Параметры этого отчёта ещё не заведены");
      return;
    }
    built = true;
    renderTable();
    $("#repResultWrap").hidden = false;
    toast("Отчёт сформирован");
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
