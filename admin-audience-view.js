/* ============================================================
   ТБДТ · Кабинет администратора — страница выгрузки аудитории
   audience.html?no=<номер>. Параметры и столбцы берём из спеки
   (admin-audiences.js). Спеки нет → честная плашка, а не пустая
   таблица: выгрузки контактов не взаимозаменяемы.

   «Экспорт в CSV» отдаёт РОВНО то, что на экране: тот же отбор,
   те же столбцы. Разделитель — точка с запятой и BOM в начале,
   иначе русский Excel открывает файл одной колонкой и в кракозябрах.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = window.AdminAudiences.esc;
  var nf = new Intl.NumberFormat("ru-RU");

  var no = new URLSearchParams(location.search).get("no") || "";
  var spec = window.AdminAudiences.find(no);

  /* ---- выгрузки нет ---- */
  if (!spec) {
    $("#audTitle").textContent = "Выгрузка не найдена";
    document.title = "ТБДТ · Кабинет администратора · Выгрузка не найдена";
    $("#audCrumbTail").textContent = "Выгрузка не найдена";
    $("#audBody").innerHTML =
      '<section class="panel pad stub">' +
      '<div class="stub-mark" aria-hidden="true">▩</div>' +
      "<h2>Такой выгрузки нет</h2>" +
      "<p>Выгрузка с номером «" + esc(no) + "» отсутствует в разделе. " +
      "Возможно, ссылка устарела.</p>" +
      '<a class="stub-back" href="audiences.html">← Ко всем выгрузкам</a></section>';
    return;
  }

  $("#audTitle").textContent = spec.name;
  $("#audCrumbTail").textContent = spec.name;
  document.title = "ТБДТ · Кабинет администратора · " + spec.name;

  /* ---- параметры ---- */
  $("#audFields").innerHTML = spec.fields.map(function (f) {
    return '<label class="aud-field"><span>' + esc(f.label) + "</span>" +
      '<input id="p_' + esc(f.id) + '" type="number" inputmode="numeric" min="0" ' +
      'value="' + (f.value === null ? "" : esc(String(f.value))) + '" ' +
      'autocomplete="off" /></label>';
  }).join("");

  /* Пустое поле — это «без ограничения», а не ноль: иначе стёртый
     максимум обнулял бы выборку вместо того, чтобы её раскрыть. */
  function num(id) {
    var el = $("#p_" + id);
    if (!el || el.value.trim() === "") return null;
    var v = Number(el.value);
    return isFinite(v) ? v : null;
  }

  function params() {
    var p = { from: $("#audFrom").value, to: $("#audTo").value };
    spec.fields.forEach(function (f) { p[f.id] = num(f.id); });
    return p;
  }

  /* ---- результат ---- */
  function cell(v, type) {
    if (v === null || v === undefined || v === "") return "";
    if (type === "money") return nf.format(Math.round(v)) + " ₽";
    if (type === "int")   return nf.format(v);
    return String(v);
  }

  var rows = [];

  function render() {
    rows = spec.rows(params());

    if (!rows.length) {
      $("#audResult").innerHTML =
        '<p class="rep-empty">Под заданные условия не подошёл ни один контакт. ' +
        "Расширьте вилку значений или очистите диапазон дат — пустой диапазон " +
        "читается как «за всё время».</p>";
      $("#audCount").textContent = "";
      $("#audCsv").disabled = true;
      return;
    }

    $("#audResult").innerHTML =
      '<div class="table-wrap"><table class="dtable aud-result"><thead><tr>' +
      spec.columns.map(function (c) {
        return '<th class="' + (c.type === "text" ? "" : "num") + '">' + esc(c.label) + "</th>";
      }).join("") +
      "</tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr>" + spec.columns.map(function (c) {
          return '<td class="' + (c.type === "text" ? "" : "num") + '">' +
            esc(cell(r[c.id], c.type)) + "</td>";
        }).join("") + "</tr>";
      }).join("") +
      "</tbody></table></div>";

    $("#audCount").textContent = rows.length + " " +
      plural(rows.length, ["контакт", "контакта", "контактов"]);
    $("#audCsv").disabled = false;
  }

  function plural(n, forms) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  }

  $("#audRun").addEventListener("click", function () {
    render();
    $("#audResultWrap").hidden = false;
    toast("Аудитория отобрана");
  });

  /* ---- CSV ---- */
  function csvCell(v) {
    var s = v === null || v === undefined ? "" : String(v);
    /* кавычки, точку с запятой и перевод строки экранируем — иначе
       ФИО с запятой развалит строку на две колонки */
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csv() {
    var lines = [spec.columns.map(function (c) { return csvCell(c.label); }).join(";")];
    /* числа отдаём сырыми, без разрядов и «₽»: иначе Excel примет
       столбец за текст и не посчитает по нему сумму */
    rows.forEach(function (r) {
      lines.push(spec.columns.map(function (c) {
        return csvCell(r[c.id]);
      }).join(";"));
    });
    return lines.join("\r\n");
  }

  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  $("#audCsv").addEventListener("click", function () {
    if (!rows.length) return;
    /* BOM обязателен: без него Excel читает файл в кодировке системы
       и кириллица превращается в кракозябры */
    var blob = new Blob(["\uFEFF" + csv()], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "audience-" + spec.no + "_" + stamp() + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast("Файл CSV сохранён");
  });

  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* до первого «Показать» выгружать нечего */
  $("#audCsv").disabled = true;
})();
