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
    if (type === "money") return nf.format(Math.round(v)) + " ₽";
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
  ].join("");

  function fileHtml(m, kind) {
    var xl = kind === "excel";
    var office = xl
      ? "<xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
        "<x:Name>" + esc(m.doc.code) + "</x:Name>" +
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
      docHtml(m, xl) + "</body></html>";
  }

  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function save(name, mime, html) {
    /* BOM обязателен: без него Word и Excel читают файл в кодировке
       системы и кириллица превращается в кракозябры */
    var blob = new Blob(["\uFEFF" + html], { type: mime + ";charset=utf-8" });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  window.AdminReportDoc = {
    org: ORG,

    render: function (host, model) {
      host.innerHTML = '<div class="rdoc">' + docHtml(model, false) + "</div>";
    },

    download: function (model, kind) {
      var xl = kind === "excel";
      save(model.doc.code + "_" + stamp() + (xl ? ".xls" : ".doc"),
           xl ? "application/vnd.ms-excel" : "application/msword",
           fileHtml(model, kind));
    },
  };
})();
