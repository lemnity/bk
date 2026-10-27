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

  /* ---- значения по умолчанию ----
     Период операций (keys from/to) — весь журнал AdminReportData.range(),
     чтобы первый «Показать отчёт» сразу дал данные; мероприятие и
     прочие списки — первый вариант («Все»). У «Книги операций» период —
     даты записей бухгалтерии, а не продаж: его не трогаем. */
  if (spec && spec.kind !== "ledger" && window.AdminReportData) {
    var span = window.AdminReportData.range();
    fields.forEach(function (f) {
      if (f.control !== "daterange" || !f.keys || f.keys[0] !== "from") return;
      $("#f_" + f.id + "_from").value = span.min;
      $("#f_" + f.id + "_to").value = span.max;
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

  /* применённые параметры одной строкой — под заголовком результата.
     «Все» / «не выбрано» (первый вариант списка) не пишем. */
  function paramsLine() {
    var out = [];
    fields.forEach(function (f) {
      if (!f.id || f.kind === "check" || f.kind === "or") return;
      if (f.control === "daterange") {
        var a = $("#f_" + f.id + "_from").value, b = $("#f_" + f.id + "_to").value;
        if (a || b) {
          out.push(f.addon + (a ? " с " + ruDate(a) : "") + (b ? " по " + ruDate(b) : ""));
        }
        return;
      }
      var el = $("#f_" + f.id);
      if (!el) return;
      if (el.tagName === "SELECT") {
        if (el.selectedIndex <= 0) return;
        out.push((f.addon ? f.addon + ": " : "") + el.options[el.selectedIndex].text);
      } else if (el.value) {
        out.push((f.addon ? f.addon + ": " : "") + (f.control === "date" ? ruDate(el.value) : el.value));
      }
    });
    return out.length ? out.join(" · ") : "Все данные";
  }

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
    /* «|| 0»: возвраты считаются как −сумма, и пустой список даёт «-0 ₽» */
    if (type === "money") return nf.format(Math.round(v) || 0) + " ₽";
    if (type === "int")   return nf.format(v);
    /* неразрывный пробел: по-русски перед % пробел нужен, но в узком
       столбце обычный пробел рвёт значение на две строки */
    if (type === "pct")   return v + "\u00A0%";
    return String(v);
  }

  var built = false;
  /* модель бланка, показанная на экране: выгрузки берут её, а не форму —
     иначе после правки параметров без «Показать отчёт» файл разойдётся
     с экраном (G5) */
  var lastModel = null;
  var EMPTY = '<p class="rep-empty">Нет данных за выбранный период.</p>';

  function renderTable() {
    var cols = columns.filter(function (c) { return shown[c.id]; });
    if (!cols.length) {
      $("#repResult").innerHTML = '<p class="rep-empty">Не выбрано ни одного столбца.</p>';
      return 0;
    }
    var rows = spec.rows(params());
    if (!rows.length) {
      $("#repResult").innerHTML = EMPTY;
      return 0;
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
    return rows.length;
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

  /* строка под названием бланка: мероприятие, по которому он построен
     (выбранное или первое подходящее — см. doc.eventOf), и период
     «Диапазон событий», если задан */
  function eventLine(p) {
    var parts = [];
    var e = spec.doc.eventOf ? spec.doc.eventOf(p) : null;
    if (e) parts.push(ruDate(e.date) + " · " + e.title + " · " + e.hall);
    if (p.eventFrom || p.eventTo) {
      parts.push("Диапазон событий" + (p.eventFrom ? " с " + ruDate(p.eventFrom) : "") +
        (p.eventTo ? " по " + ruDate(p.eventTo) : ""));
    }
    return parts.join(" · ");
  }

  function docModel() {
    var d = spec.doc;
    var p = params();
    var rows = spec.rows(p);
    var inv  = d.invites ? d.invites(p) : null;
    /* пригласительные всегда входят в «Всего:» и в свод; флажок решает
       только, показывать ли их отдельной строкой */
    var all  = inv ? rows.concat([inv]) : rows;
    var sep  = !!($("#f_invites") && $("#f_invites").checked);
    return {
      org: window.AdminReportDoc.org,
      title: title,
      doc: d,
      cols: columns.filter(function (c) { return shown[c.id]; }),
      eventLine: eventLine(p),
      rows: rows,
      invites: sep ? inv : null,
      totals:  d.totals  ? d.totals(all, p)  : null,
      summary: d.summary ? d.summary(all, p) : null,
    };
  }

  /* выгрузки повторяют экран: нечего показать — нечего и выгружать */
  function setExports(on) {
    ["#repWord", "#repExcel"].forEach(function (id) { $(id).disabled = !on; });
  }

  function render() {
    var actions = $("#repDocActions");
    /* у бланка применённые параметры — в его шапке (eventLine) */
    $("#repParams").textContent = spec.doc ? "" : paramsLine();
    $("#repParams").hidden = !!spec.doc;
    if (!columns.filter(function (c) { return shown[c.id]; }).length) {
      $("#repResult").innerHTML = '<p class="rep-empty">Не выбрано ни одного столбца.</p>';
      actions.hidden = true;
      lastModel = null;
      setExports(false);
      return;
    }
    if (spec.doc) {
      var m = docModel();
      lastModel = m.rows.length ? m : null;
      if (m.rows.length) window.AdminReportDoc.render($("#repResult"), m);
      else $("#repResult").innerHTML = EMPTY;
      actions.hidden = false;
      setExports(m.rows.length > 0);
    } else {
      lastModel = null; /* таблица выгружается не бланком */
      setExports(renderTable() > 0);
      actions.hidden = true;
    }
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
   ["#repExcel", "excel", "Книга Excel сохранена"]].forEach(function (b) {
    $(b[0]).addEventListener("click", function () {
      if (!built || !lastModel || $(b[0]).disabled) return;
      window.AdminReportDoc.download(lastModel, b[1]);
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
