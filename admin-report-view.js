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
  /* модель отчёта, экран и выгрузки — общие с каталогом (admin-report-doc.js) */
  var Doc = window.AdminReportDoc;

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

  /* ---- значения по умолчанию ----
     Те же, что у выгрузки из каталога (Doc.defaults): период операций —
     весь журнал, у «Книги операций» период пуст; списки — первый
     вариант, флажки — f.on (их форма уже проставила сама). */
  if (spec) {
    var dflt = Doc.defaults(spec);
    fields.forEach(function (f) {
      if (f.control !== "daterange") return;
      var keys = f.keys || [f.id + "_from", f.id + "_to"];
      $("#f_" + f.id + "_from").value = dflt[keys[0]];
      $("#f_" + f.id + "_to").value = dflt[keys[1]];
    });
  }

  /* ---- проверка периода ----
     «с» позже «по» — сообщение под полем, отчёт не строится. Сообщение
     живёт в строке формы (.rv-row) и снимается при исправлении. */
  function rangeError(f) {
    var a = $("#f_" + f.id + "_from"), b = $("#f_" + f.id + "_to");
    var row = a.closest(".rv-row");
    var msg = row.parentNode.querySelector('.rv-notice[data-for="' + f.id + '"]');
    var bad = !!(a.value && b.value && a.value > b.value);
    [a, b].forEach(function (el) {
      if (bad) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    });
    if (!bad) { if (msg) msg.remove(); return false; }
    if (!msg) {
      msg = document.createElement("p");
      msg.className = "rv-notice";
      msg.dataset.for = f.id;
      msg.id = "e_" + f.id;
      msg.setAttribute("role", "alert");
      row.insertAdjacentElement("afterend", msg);
      a.setAttribute("aria-describedby", msg.id);
      b.setAttribute("aria-describedby", msg.id);
    }
    msg.textContent = (f.addon || "Период") + ": дата «с» позже даты «по». Исправьте период.";
    return true;
  }
  function validate() {
    var bad = false;
    fields.forEach(function (f) {
      if (f.control === "daterange" && rangeError(f)) bad = true;
    });
    return !bad;
  }
  fields.forEach(function (f) {
    if (f.control !== "daterange") return;
    ["_from", "_to"].forEach(function (sfx) {
      $("#f_" + f.id + sfx).addEventListener("change", function () {
        if ($('.rv-notice[data-for="' + f.id + '"]')) rangeError(f);
      });
    });
  });

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
  var built = false;
  /* модель, показанная на экране (бланк или таблица): выгрузки берут
     её, а не форму — иначе после правки параметров без «Показать отчёт»
     файл разойдётся с экраном (G5) */
  var lastModel = null;
  var EMPTY = '<p class="rep-empty">Нет данных за выбранный период.</p>';
  var EXPORTS = ["#repWord", "#repExcel", "#repCsv", "#repPrint"];

  /* выгрузки повторяют экран: нечего показать — нечего и выгружать */
  function setExports(on) {
    EXPORTS.forEach(function (id) { $(id).disabled = !on; });
  }

  function render() {
    var actions = $("#repDocActions");
    var cols = columns.filter(function (c) { return shown[c.id]; });
    lastModel = null;
    if (!cols.length) {
      $("#repParams").textContent = "";
      $("#repParams").hidden = true;
      $("#repResult").innerHTML = '<p class="rep-empty">Не выбрано ни одного столбца.</p>';
      actions.hidden = true;
      setExports(false);
      return;
    }
    var m = Doc.model(spec, { no: no, title: title, params: params(), cols: cols });
    /* у бланка применённые параметры — в его шапке (eventLine) */
    $("#repParams").textContent = m.kind === "doc" ? "" : m.paramsLine;
    $("#repParams").hidden = m.kind === "doc";
    if (m.empty) {
      $("#repResult").innerHTML = EMPTY;
    } else {
      Doc.render($("#repResult"), m);
      lastModel = m;
    }
    actions.hidden = false;
    setExports(!m.empty);
  }

  $("#repRun").addEventListener("click", function () {
    if (!spec) {
      toast("Параметры этого отчёта ещё не заведены");
      return;
    }
    if (!validate()) {
      /* старый результат с другими параметрами не оставляем на экране */
      built = false;
      lastModel = null;
      $("#repResultWrap").hidden = true;
      return;
    }
    built = true;
    render();
    $("#repResultWrap").hidden = false;
    toast("Отчёт сформирован");
  });

  [["#repWord", "word", "Документ Word сохранён"],
   ["#repExcel", "excel", "Книга Excel сохранена"],
   ["#repCsv", "csv", "Файл CSV сохранён"],
   ["#repPrint", "print", ""]].forEach(function (b) {
    $(b[0]).addEventListener("click", function () {
      if (!built || !lastModel || $(b[0]).disabled) return;
      /* печать — это сам экран: форма и кнопки скрыты @media print */
      if (b[1] === "print") { window.print(); return; }
      if (b[1] === "csv") Doc.downloadCsv(lastModel);
      else Doc.download(lastModel, b[1]);
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

  /* «⚙ Настроить» из каталога (setup=1): сразу открыть выбор столбцов
     и поставить фокус в первое поле параметров */
  if (new URLSearchParams(location.search).get("setup") === "1") {
    if (canPick) {
      colsMenu.hidden = false;
      colsBtn.setAttribute("aria-expanded", "true");
    }
    var first = $("#repForm").querySelector("input, select");
    if (first) first.focus();
  }
})();
