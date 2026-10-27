/* ============================================================
   Технологии творчества · Кабинет администратора — БЛАНК ОТЧЁТА
   Результат отчёта — это не таблица, а документ: шапка с полным
   наименованием и «Утверждаю», таблица со сгруппированной шапкой
   («Продано» → «Число» | «Сумма»), строки итогов, свод
   «Аншлаг / Реализовано», подписи и код отчёта внизу.

   Разметка бланка ОДНА на три вывода: экран, Word и Excel.
   Разница только в оформлении и в формате чисел:
     · экран — классы .rdoc-*, стили лежат в admin.css;
     · Word/Excel — внешний css в файл не попадёт, поэтому те же
       классы описаны в FILE_CSS и уезжают внутрь файла;
     · Excel получает СЫРЫЕ числа (без разрядов и «₽»), иначе
       ячейки приедут текстом и по ним не посчитать сумму.

   Word и Excel открывают HTML со своими office-namespace —
   поэтому файлы .doc/.xls собираются без единой библиотеки.
   Расплата: Excel при открытии предупреждает о несовпадении
   формата и расширения. Чтобы этого не было, нужен настоящий
   .xlsx (zip + OOXML) — отдельная работа, здесь её нет.

   Модель отчёта (model) тоже собирается ЗДЕСЬ, одна на всех: её
   показывает страница отчёта, её же выгружают Word, Excel, CSV и
   печать, и её же строит build(no, params) для выгрузки из каталога
   без открытия страницы. Табличный отчёт (спека без doc) — та же
   модель с kind:"table": на экране и в файле одна разметка таблицы.
   ============================================================ */
(function () {
  "use strict";

  var esc = window.AdminReports.esc;
  var nf  = new Intl.NumberFormat("ru-RU");

  /* Полное наименование учреждения для шапки бланка. Одно место на
     все отчёты: правим здесь, а не в каждой спеке. */
  var ORG = "Технологии творчества";

  /* ---- значения ---- */
  function fmt(v, type, raw) {
    if (v === null || v === undefined || v === "") return "";
    if (raw) return String(v);                       /* Excel: число числом */
    /* «|| 0»: возвраты считаются как −сумма, и пустой список даёт «-0 ₽» */
    if (type === "money") return nf.format(Math.round(v) || 0) + " ₽";
    if (type === "int")   return nf.format(v);
    /* неразрывный пробел: по-русски перед % пробел нужен, но в узком
       столбце обычный пробел рвёт значение на две строки */
    if (type === "pct")   return v + "\u00A0%";
    return String(v);
  }

  function cls(c) { return c.type === "text" ? "rdoc-t" : "rdoc-n"; }

  /* ---- шапка таблицы ----
     Соседние столбцы с одинаковым group уходят под общую надстройку
     («Продано» → «Число» | «Сумма»). Столбцы без group занимают обе
     строки шапки (rowspan). Если групп нет вовсе — шапка в одну
     строку, как у отчёта 3а. */
  function groupCols(cols) {
    var out = [];
    cols.forEach(function (c) {
      var last = out[out.length - 1];
      if (c.group && last && last.group === c.group) last.items.push(c);
      else out.push({ group: c.group || null, items: [c] });
    });
    return out;
  }

  function theadHtml(cols) {
    var groups = groupCols(cols);
    var twoRow = groups.some(function (g) { return g.group; });

    var r1 = groups.map(function (g) {
      if (!g.group) {
        return '<th class="' + cls(g.items[0]) + '"' + (twoRow ? ' rowspan="2"' : "") + ">" +
          esc(g.items[0].label) + "</th>";
      }
      return '<th colspan="' + g.items.length + '">' + esc(g.group) + "</th>";
    }).join("");

    if (!twoRow) return "<tr>" + r1 + "</tr>";

    var r2 = groups.filter(function (g) { return g.group; }).map(function (g) {
      return g.items.map(function (c) {
        return '<th class="' + cls(c) + '">' + esc(c.label) + "</th>";
      }).join("");
    }).join("");

    return "<tr>" + r1 + "</tr><tr>" + r2 + "</tr>";
  }

  function rowHtml(cols, r, rowCls, raw) {
    return "<tr" + (rowCls ? ' class="' + rowCls + '"' : "") + ">" +
      cols.map(function (c) {
        return '<td class="' + cls(c) + '">' +
          esc(fmt(r[c.id], c.type, raw && c.type !== "text")) + "</td>";
      }).join("") + "</tr>";
  }

  /* ---- свод «Аншлаг / Реализовано» ----
     Последний столбец всегда процент, остальные — типа строки
     («Кол-во мест» считается в штуках, «На сумму» — в рублях). */
  function summaryHtml(sum, raw) {
    if (!sum) return "";
    return '<div class="rdoc-scroll"><table class="rdoc-table rdoc-sum"><thead><tr>' +
      sum.head.map(function (h, i) {
        return '<th class="' + (i ? "rdoc-n" : "rdoc-t") + '">' + esc(h) + "</th>";
      }).join("") +
      "</tr></thead><tbody>" +
      sum.rows.map(function (r) {
        return '<tr><td class="rdoc-t">' + esc(r.label) + "</td>" +
          r.cells.map(function (v, i) {
            var t = (i === r.cells.length - 1) ? "pct" : r.type;
            return '<td class="rdoc-n">' + esc(fmt(v, t, raw)) + "</td>";
          }).join("") + "</tr>";
      }).join("") +
      "</tbody></table></div>";
  }

  /* ---- бланк целиком ---- */
  function docHtml(m, raw) {
    var d = m.doc;

    /* Шапка — служебная таблица без рамок, а не flex: Word и Excel
       флексы не понимают и «Утверждаю» уехало бы под наименование,
       а не встало справа от него. */
    var head =
      '<table class="rdoc-top"><tr>' +
        '<td class="rdoc-org">' +
          '<p class="rdoc-org-name">' + esc(m.org) + "</p>" +
          '<p class="rdoc-cap">' + esc(d.caption) + "</p>" +
          (m.eventLine ? '<p class="rdoc-cap">' + esc(m.eventLine) + "</p>" : "") +
          (d.ticketSet ? '<p class="rdoc-cap">Номер билетного комплекта ' +
            esc(String(d.ticketSet)) + "</p>" : "") +
        "</td>" +
        '<td class="rdoc-appr">' +
          "<p>«Утверждаю»</p>" +
          '<p class="rdoc-line">_______________________________</p>' +
          "<p>«___» ______________ 20___ г.</p>" +
        "</td>" +
      "</tr></table>";

    var table =
      '<div class="rdoc-scroll"><table class="rdoc-table"><thead>' + theadHtml(m.cols) +
      "</thead><tbody>" +
      m.rows.map(function (r) { return rowHtml(m.cols, r, "", raw); }).join("") +
      (m.invites ? rowHtml(m.cols, m.invites, "rdoc-sub", raw) : "") +
      (m.totals  ? rowHtml(m.cols, m.totals,  "rdoc-tot", raw) : "") +
      "</tbody></table></div>";

    var sign =
      '<div class="rdoc-sign">' +
        "<p><b>Начальник отдела по реализации билетов</b>&nbsp; ______________________</p>" +
        "<p><b>Отчет проверил:</b></p>" +
        "<p><b>Главный бухгалтер:</b>&nbsp; ______________________</p>" +
      "</div>" +
      '<p class="rdoc-code">«' + esc(d.code) + "»</p>";

    return head + table + summaryHtml(m.summary, raw) + sign;
  }

  /* ---- табличный отчёт ----
     Разметка одна для экрана и для файла: на экране её оформляют
     .dtable/.rv-table из admin.css, в файле — FILE_CSS. «Итого» —
     в tfoot, первый столбец подписан. */
  function tableHtml(m, raw) {
    var num = function (c) { return c.type === "text" ? "" : "num"; };
    return '<table class="dtable rv-table"><thead><tr>' +
      m.cols.map(function (c) {
        return '<th class="' + num(c) + '">' + esc(c.label) + "</th>";
      }).join("") +
      "</tr></thead><tbody>" +
      m.rows.map(function (r) {
        return "<tr>" + m.cols.map(function (c) {
          return '<td class="' + num(c) + '">' +
            esc(fmt(r[c.id], c.type, raw && c.type !== "text")) + "</td>";
        }).join("") + "</tr>";
      }).join("") +
      "</tbody><tfoot><tr>" +
      m.cols.map(function (c, i) {
        if (i === 0) return "<td>Итого</td>";
        return '<td class="num">' +
          (c.id in m.totals ? esc(fmt(m.totals[c.id], c.type, raw)) : "") + "</td>";
      }).join("") +
      "</tr></tfoot></table>";
  }

  /* табличный отчёт в файле: название и применённые параметры —
     то, что на экране стоит над таблицей */
  function tableFileHtml(m, raw) {
    return '<p class="rdoc-org-name">' + esc(m.title) + "</p>" +
      '<p class="rdoc-cap">' + esc(m.paramsLine) + "</p>" +
      tableHtml(m, raw);
  }

  function bodyHtml(m, raw) {
    return m.kind === "doc" ? docHtml(m, raw) : tableFileHtml(m, raw);
  }

  /* ---- файл для Word / Excel ---- */
  var FILE_CSS = [
    "@page{size:29.7cm 21cm;margin:1.2cm}",
    "body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000}",
    "p{margin:0 0 4pt}",
    "table{border-collapse:collapse;width:100%;margin-bottom:14pt}",
    /* рамки только у таблиц с данными — шапка бланка тоже таблица */
    ".rdoc-table th,.rdoc-table td{border:1px solid #808080;padding:3pt 5pt;" +
      "font-size:9pt;vertical-align:middle}",
    ".rdoc-table th{background:#EFEFEF;font-weight:bold;text-align:left}",
    ".rdoc-top td{border:0;padding:0;vertical-align:top}",
    ".rdoc-org-name{font-size:12pt;font-weight:bold}",
    ".rdoc-cap{font-style:italic;font-weight:bold}",
    ".rdoc-appr{text-align:right;white-space:nowrap}",
    ".rdoc-n{text-align:right}",
    ".rdoc-sub td,.rdoc-tot td{font-weight:bold;background:#F5F5F5}",
    ".rdoc-sign{margin-top:14pt}",
    ".rdoc-sign p{margin:0 0 10pt}",
    /* табличный отчёт (kind:"table") — те же рамки, что у бланка */
    ".rv-table th,.rv-table td{border:1px solid #808080;padding:3pt 5pt;" +
      "font-size:9pt;vertical-align:middle}",
    ".rv-table th{background:#EFEFEF;font-weight:bold;text-align:left}",
    ".rv-table .num{text-align:right}",
    ".rv-table tfoot td{font-weight:bold;background:#F5F5F5}",
  ].join("");

  function fileHtml(m, kind) {
    var xl = kind === "excel";
    var office = xl
      ? "<xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
        "<x:Name>" + esc(sheetName(m)) + "</x:Name>" +
        "<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>" +
        "</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml>"
      : "<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>";

    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:' +
      (xl ? 'x="urn:schemas-microsoft-com:office:excel"' : 'w="urn:schemas-microsoft-com:office:word"') +
      ' xmlns="http://www.w3.org/TR/REC-html40"><head>' +
      '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />' +
      "<title>" + esc(m.title) + "</title>" +
      "<!--[if gte mso 9]>" + office + "<![endif]-->" +
      "<style>" + FILE_CSS + "</style></head><body>" +
      bodyHtml(m, xl) + "</body></html>";
  }

  /* имя листа Excel: у бланка — код отчёта, у таблицы — номер;
     символы \ / ? * [ ] : Excel в имени листа не принимает */
  function sheetName(m) {
    return String(m.kind === "doc" ? m.doc.code : "Отчёт " + m.no).replace(/[\\\/?*\[\]:]/g, "-");
  }

  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  /* otchet-<no>-<YYYY-MM-DD>.<ext>; «/» в номере («120/1») — дефис */
  function fileName(no, ext) {
    return "otchet-" + String(no).replace(/\//g, "-") + "-" + stamp() + "." + ext;
  }

  function save(name, mime, text) {
    /* BOM обязателен: без него Word и Excel читают файл в кодировке
       системы и кириллица превращается в кракозябры */
    var blob = new Blob(["﻿" + text], { type: mime + ";charset=utf-8" });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* ---- CSV ----
     Как в admin-audience-view.js: «;», кавычки по необходимости, числа
     сырыми (без разрядов и «₽»), иначе Excel примет столбец за текст.
     Строки — ровно то, что на экране: данные, пригласительные (если
     показаны отдельно), итог; у бланка после пустой строки — свод. */
  function csvCell(v) {
    var s = v === null || v === undefined ? "" : String(v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csvLine(list) { return list.map(csvCell).join(";"); }

  function csv(m) {
    var cols = m.cols;
    var line = function (r) { return csvLine(cols.map(function (c) { return r[c.id]; })); };
    var out = [csvLine(cols.map(function (c) {
      return (c.group ? c.group + " · " : "") + c.label;
    }))];
    m.rows.forEach(function (r) { out.push(line(r)); });
    if (m.kind === "doc") {
      if (m.invites) out.push(line(m.invites));
      if (m.totals) out.push(line(m.totals));
      if (m.summary) {
        out.push("");
        out.push(csvLine(m.summary.head));
        m.summary.rows.forEach(function (r) { out.push(csvLine([r.label].concat(r.cells))); });
      }
    } else {
      out.push(csvLine(cols.map(function (c, i) {
        return i === 0 ? "Итого" : (c.id in m.totals ? m.totals[c.id] : "");
      })));
    }
    return out.join("\r\n");
  }

  /* ---- модель отчёта ---- */
  function ruDate(v) {
    if (!v) return "";
    var p = String(v).split("-");
    return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : String(v);
  }

  /* варианты списка: строка (значение = подпись) или { value, label } */
  function optionList(f) {
    var o = typeof f.options === "function" ? f.options() : (f.options || []);
    return o.map(function (v) {
      return v && typeof v === "object" ? { value: String(v.value), label: String(v.label) }
                                        : { value: String(v), label: String(v) };
    });
  }
  function isSelect(f) { return f.kind === "select" || (f.kind === "group" && f.control === "select"); }
  function rangeKeys(f) { return f.keys || [f.id + "_from", f.id + "_to"]; }

  /* Значения формы по умолчанию — те же, что ставит страница:
     период операций (keys from/to) — весь журнал AdminReportData.range(),
     чтобы первый «Показать отчёт» сразу дал данные; у «Книги операций»
     период — даты записей бухгалтерии, его не трогаем. Списки — первый
     вариант («Все»), флажки — on, остальное пусто. */
  function defaults(spec) {
    var p = {};
    var span = spec.kind !== "ledger" && window.AdminReportData ? window.AdminReportData.range() : null;
    (spec.fields || []).forEach(function (f) {
      if (!f.id) return;
      if (f.kind === "group" && f.control === "daterange") {
        var k = rangeKeys(f), full = span && k[0] === "from";
        p[k[0]] = full ? span.min : "";
        p[k[1]] = full ? span.max : "";
      } else if (f.kind === "check") {
        p[f.id] = !!f.on;
      } else if (isSelect(f)) {
        var o = optionList(f);
        p[f.id] = o.length ? o[0].value : "";
      } else {
        p[f.id] = "";
      }
    });
    return p;
  }

  /* применённые параметры одной строкой — под заголовком результата.
     «Все» / «не выбрано» (первый вариант списка) не пишем. */
  function paramsLine(spec, p) {
    var out = [];
    (spec.fields || []).forEach(function (f) {
      if (!f.id || f.kind === "check" || f.kind === "or") return;
      var pre = f.addon ? f.addon + ": " : "";
      if (f.control === "daterange") {
        var k = rangeKeys(f), a = p[k[0]], b = p[k[1]];
        if (a || b) out.push(f.addon + (a ? " с " + ruDate(a) : "") + (b ? " по " + ruDate(b) : ""));
        return;
      }
      var v = p[f.id];
      if (isSelect(f)) {
        var o = optionList(f), i = -1;
        o.forEach(function (x, j) { if (i < 0 && x.value === String(v)) i = j; });
        if (i > 0) out.push(pre + o[i].label);
      } else if (v) {
        out.push(pre + (f.control === "date" ? ruDate(v) : v));
      }
    });
    return out.length ? out.join(" · ") : "Все данные";
  }

  /* строка под названием бланка: мероприятие, по которому он построен
     (выбранное или первое подходящее — см. doc.eventOf), и период
     «Диапазон событий», если задан */
  function eventLine(d, p) {
    var parts = [];
    var e = d.eventOf ? d.eventOf(p) : null;
    if (e) parts.push(ruDate(e.date) + " · " + e.title + " · " + e.hall);
    if (p.eventFrom || p.eventTo) {
      parts.push("Диапазон событий" + (p.eventFrom ? " с " + ruDate(p.eventFrom) : "") +
        (p.eventTo ? " по " + ruDate(p.eventTo) : ""));
    }
    return parts.join(" · ");
  }

  /* o = { no, title, params, cols } — cols: видимые столбцы спеки */
  function model(spec, o) {
    var p = o.params || {};
    var m = { no: o.no, title: o.title, cols: o.cols, org: ORG, params: p };
    if (spec.doc) {
      var d = spec.doc;
      var rows = spec.rows(p);
      var inv  = d.invites ? d.invites(p) : null;
      /* пригласительные всегда входят в «Всего:» и в свод; флажок решает
         только, показывать ли их отдельной строкой */
      var all  = inv ? rows.concat([inv]) : rows;
      m.kind = "doc";
      m.doc = d;
      m.eventLine = eventLine(d, p);
      m.rows = rows;
      m.invites = p.invites ? inv : null;
      m.totals  = d.totals  ? d.totals(all, p)  : null;
      m.summary = d.summary ? d.summary(all, p) : null;
    } else {
      m.kind = "table";
      m.rows = spec.rows(p);
      m.paramsLine = paramsLine(spec, p);
      /* «Итого» — суммы int/money, кроме total:false (цены); доли %
         и сальдо считает сама спека в total(rows) */
      var totals = {};
      o.cols.forEach(function (c) {
        if ((c.type === "int" || c.type === "money") && c.total !== false) {
          totals[c.id] = m.rows.reduce(function (a, r) { return a + (r[c.id] || 0); }, 0);
        }
      });
      if (spec.total) {
        var extra = spec.total(m.rows) || {};
        o.cols.forEach(function (c) { if (c.id in extra) totals[c.id] = extra[c.id]; });
      }
      m.totals = totals;
    }
    m.empty = !m.rows.length;
    return m;
  }

  window.AdminReportDoc = {
    org: ORG,
    defaults: defaults,
    paramsLine: paramsLine,
    model: model,
    csv: csv,
    fileName: fileName,

    /* экран: бланк — в .rdoc, таблица — в .table-wrap */
    render: function (host, m) {
      host.innerHTML = m.kind === "doc"
        ? '<div class="rdoc">' + docHtml(m, false) + "</div>"
        : '<div class="table-wrap">' + tableHtml(m, false) + "</div>";
    },

    download: function (m, kind) {
      var xl = kind === "excel";
      save(fileName(m.no, xl ? "xls" : "doc"),
           xl ? "application/vnd.ms-excel" : "application/msword",
           fileHtml(m, kind));
    },

    downloadCsv: function (m) {
      save(fileName(m.no, "csv"), "text/csv", csv(m));
    },

    /* Сборка вне страницы отчёта (каталог «↓ Выгрузить»): та же модель,
       что на экране, с теми же значениями формы по умолчанию; params
       перекрывают их. Все столбцы — как в меню по умолчанию (on).
       Отчёта или спеки нет → null. html — разметка, как на экране. */
    build: function (no, params) {
      var rep  = window.AdminReports && window.AdminReports.find(no);
      var spec = window.AdminReportSpecs && window.AdminReportSpecs.get(no);
      if (!rep || !spec) return null;
      var title = spec.title || rep.name;
      var p = Object.assign(defaults(spec), params || {});
      var cols = (spec.columns || []).filter(function (c) { return c.on !== false; });
      var m = model(spec, { no: no, title: title, params: p, cols: cols });
      return {
        title: title,
        html: m.kind === "doc" ? docHtml(m, false) : tableFileHtml(m, false),
        csv: csv(m),
        empty: m.empty,
        model: m,
      };
    },
  };
})();
