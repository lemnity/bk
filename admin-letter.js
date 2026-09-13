/* ============================================================
   Технологии творчества · Кабинет — КОНСТРУКТОР ПИСЬМА
   Виджет для «Текста письма» в Email-рассылках: палитра блоков,
   холст, панель «Стиль / Свойства», режимы «редактор / превью /
   HTML», ширина десктоп-мобильный, выгрузка и загрузка шаблона.

   Письмо хранится ДЕРЕВОМ БЛОКОВ, а не готовым HTML. HTML для
   отправки собирается из дерева (toHtml). Так письмо можно открыть
   и поправить через полгода, а не переверстывать заново; и так
   разметка под почтовые клиенты — таблицы, инлайновые стили —
   лежит в одном месте, а не размазана по сохранённым письмам.

   Превью намеренно живёт в <iframe> с тем же HTML, что уйдёт
   подписчику: стили кабинета не должны подкрашивать письмо и
   создавать ложное впечатление, что вёрстка в порядке.

   Наружу: window.AdminLetter.create(opts) и .toHtml(letter).
   ============================================================ */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var FONTS = {
    modern: { label: "Modern sans", css: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
    system: { label: "Системный",   css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" },
    book:   { label: "Book serif",  css: "Georgia, 'Times New Roman', Times, serif" },
    mono:   { label: "Monospace",   css: "'Courier New', Courier, monospace" },
  };

  function fontCss(id) { return (FONTS[id] || FONTS.modern).css; }

  /* Ширина письма — 600px: исторический предел, за которым Outlook и
     почтовые приложения начинают резать вёрстку по горизонтали. */
  var PAGE_W = 600;
  var PHONE_W = 375;

  /* ------------------------------------------------------------
     Блоки
     ------------------------------------------------------------
     У каждого типа: как его создать (make), какие поля показывать
     в «Свойствах» (fields) и во что он превращается в письме (html).
     Поля описаны данными, поэтому панель свойств одна на все типы —
     новый блок не требует своей формы. */

  function pad(b) {
    var v = b.pad === undefined ? 12 : b.pad;
    return v + "px 24px";
  }

  var TYPES = {
    heading: {
      label: "Заголовок", icon: "H",
      make: function () { return { t: "heading", text: "Заголовок письма", size: 28, align: "center", color: "", pad: 14 }; },
      fields: [
        { k: "text",  kind: "textarea", label: "Текст" },
        { k: "size",  kind: "range", label: "Размер", min: 14, max: 44, unit: "px" },
        { k: "align", kind: "align", label: "Выравнивание" },
        { k: "color", kind: "color", label: "Цвет текста", empty: "как у письма" },
        { k: "pad",   kind: "range", label: "Отступы", min: 0, max: 48, unit: "px" },
      ],
      html: function (b, st) {
        return '<div style="padding:' + pad(b) + ";text-align:" + b.align +
          ";font-size:" + b.size + "px;line-height:1.25;font-weight:600;color:" +
          (b.color || st.ink) + '">' + esc(b.text).replace(/\n/g, "<br />") + "</div>";
      },
    },

    text: {
      label: "Текст", icon: "≡",
      make: function () { return { t: "text", text: "Здесь — текст письма. Расскажите, что происходит в театре.", size: 15, align: "left", color: "", pad: 10 }; },
      fields: [
        { k: "text",  kind: "textarea", label: "Текст", rows: 7 },
        { k: "size",  kind: "range", label: "Размер", min: 11, max: 24, unit: "px" },
        { k: "align", kind: "align", label: "Выравнивание" },
        { k: "color", kind: "color", label: "Цвет текста", empty: "как у письма" },
        { k: "pad",   kind: "range", label: "Отступы", min: 0, max: 48, unit: "px" },
      ],
      html: function (b, st) {
        return '<div style="padding:' + pad(b) + ";text-align:" + b.align +
          ";font-size:" + b.size + "px;line-height:1.6;color:" + (b.color || st.ink) + '">' +
          esc(b.text).replace(/\n/g, "<br />") + "</div>";
      },
    },

    button: {
      label: "Кнопка", icon: "▭",
      make: function () { return { t: "button", text: "Смотреть афишу", href: "", bg: "#173A6D", color: "#FFFFFF", align: "center", radius: 6, pad: 14 }; },
      fields: [
        { k: "text",   kind: "text",  label: "Надпись" },
        { k: "href",   kind: "url",   label: "Ссылка", placeholder: "https://example.com" },
        { k: "bg",     kind: "color", label: "Цвет кнопки" },
        { k: "color",  kind: "color", label: "Цвет надписи" },
        { k: "radius", kind: "range", label: "Скругление", min: 0, max: 24, unit: "px" },
        { k: "align",  kind: "align", label: "Выравнивание" },
        { k: "pad",    kind: "range", label: "Отступы", min: 0, max: 48, unit: "px" },
      ],
      html: function (b) {
        /* ссылкой, а не <button>: кнопки в письмах не работают */
        return '<div style="padding:' + pad(b) + ";text-align:" + b.align + '">' +
          '<a href="' + esc(b.href || "#") + '" style="display:inline-block;padding:12px 26px;' +
          "background:" + b.bg + ";color:" + b.color + ";border-radius:" + b.radius +
          'px;font-size:15px;font-weight:600;text-decoration:none">' + esc(b.text) + "</a></div>";
      },
    },

    image: {
      label: "Картинка", icon: "▨",
      make: function () { return { t: "image", src: "", alt: "", href: "", width: 100, align: "center", pad: 10 }; },
      fields: [
        { k: "src",   kind: "url",   label: "Адрес картинки", placeholder: "https://…/banner.jpg" },
        { k: "alt",   kind: "text",  label: "Подпись (alt)", hint: "Её увидят те, у кого картинки отключены." },
        { k: "href",  kind: "url",   label: "Ссылка с картинки", placeholder: "https://example.com" },
        { k: "width", kind: "range", label: "Ширина", min: 20, max: 100, unit: "%" },
        { k: "align", kind: "align", label: "Выравнивание" },
        { k: "pad",   kind: "range", label: "Отступы", min: 0, max: 48, unit: "px" },
      ],
      html: function (b) {
        var img = b.src
          ? '<img src="' + esc(b.src) + '" alt="' + esc(b.alt) + '" width="' +
            Math.round(PAGE_W * b.width / 100) + '" style="width:' + b.width +
            '%;max-width:100%;height:auto;display:inline-block;border:0" />'
          : '<div style="padding:28px;background:#E9EEF6;color:#596A82;font-size:13px">' +
            "Картинка не выбрана</div>";
        return '<div style="padding:' + pad(b) + ";text-align:" + b.align + '">' +
          (b.href ? '<a href="' + esc(b.href) + '" style="text-decoration:none">' + img + "</a>" : img) +
          "</div>";
      },
    },

    divider: {
      label: "Линия", icon: "—",
      make: function () { return { t: "divider", color: "#DCE3ED", thickness: 1, pad: 8 }; },
      fields: [
        { k: "color",     kind: "color", label: "Цвет линии" },
        { k: "thickness", kind: "range", label: "Толщина", min: 1, max: 8, unit: "px" },
        { k: "pad",       kind: "range", label: "Отступы", min: 0, max: 48, unit: "px" },
      ],
      html: function (b) {
        return '<div style="padding:' + pad(b) + '"><div style="font-size:0;line-height:0;' +
          "border-top:" + b.thickness + "px solid " + b.color + '"></div></div>';
      },
    },

    spacer: {
      label: "Отступ", icon: "↕",
      make: function () { return { t: "spacer", height: 24 }; },
      fields: [{ k: "height", kind: "range", label: "Высота", min: 4, max: 96, unit: "px" }],
      html: function (b) {
        return '<div style="height:' + b.height + 'px;font-size:0;line-height:0">&nbsp;</div>';
      },
    },

    html: {
      label: "Html", icon: "HTML",
      make: function () { return { t: "html", code: "<!-- свой HTML -->" }; },
      fields: [{ k: "code", kind: "textarea", label: "HTML", rows: 12, mono: true,
                 hint: "Вставляется в письмо как есть. Почтовые клиенты понимают не всё: таблицы и инлайновые стили надёжнее." }],
      /* намеренно без экранирования: в этом и смысл блока */
      html: function (b) { return b.code || ""; },
    },

    columns: {
      label: "Колонки", icon: "▥",
      slots: function (b) { return b.cols.map(function (_, i) { return "c" + i; }); },
      make: function () { return { t: "columns", cols: [[], []], gap: 16, pad: 8 }; },
      fields: [
        { k: "count", kind: "select", label: "Сколько колонок",
          options: [["2", "две"], ["3", "три"]] },
        { k: "gap", kind: "range", label: "Зазор", min: 0, max: 40, unit: "px" },
        { k: "pad", kind: "range", label: "Отступы", min: 0, max: 48, unit: "px" },
      ],
      html: function (b, st) {
        var n = b.cols.length;
        var w = Math.floor(100 / n);
        /* таблица, а не flex: Outlook не умеет ни flex, ни grid */
        return '<div style="padding:' + pad(b) + '"><table role="presentation" width="100%" ' +
          'cellpadding="0" cellspacing="0" border="0"><tr>' +
          b.cols.map(function (col, i) {
            return '<td width="' + w + '%" valign="top" style="width:' + w + "%;padding:0 " +
              (i < n - 1 ? Math.round(b.gap / 2) : 0) + "px 0 " +
              (i > 0 ? Math.round(b.gap / 2) : 0) + 'px">' +
              col.map(function (kid) { return blockHtml(kid, st); }).join("") + "</td>";
          }).join("") + "</tr></table></div>";
      },
    },

    container: {
      label: "Контейнер", icon: "⊞",
      slots: function () { return ["k"]; },
      make: function () { return { t: "container", kids: [], bg: "#F7F9FC", radius: 8, inner: 16, pad: 8 }; },
      fields: [
        { k: "bg",     kind: "color", label: "Цвет фона", empty: "прозрачный" },
        { k: "radius", kind: "range", label: "Скругление", min: 0, max: 24, unit: "px" },
        { k: "inner",  kind: "range", label: "Внутренние поля", min: 0, max: 40, unit: "px" },
        { k: "pad",    kind: "range", label: "Внешние отступы", min: 0, max: 48, unit: "px" },
      ],
      html: function (b, st) {
        return '<div style="padding:' + pad(b) + '"><div style="' +
          (b.bg ? "background:" + b.bg + ";" : "") + "border-radius:" + b.radius +
          "px;padding:" + b.inner + 'px">' +
          (b.kids.length ? b.kids.map(function (kid) { return blockHtml(kid, st); }).join("")
                         : '<div style="color:#596A82;font-size:13px">Контейнер пуст</div>') +
          "</div></div>";
      },
    },
  };

  /* Порядок палитры — как на экране добавления блока */
  var PALETTE = ["heading", "text", "button", "image", "divider", "spacer", "html", "columns", "container"];

  /* Вложенные блоки сами контейнерами быть не могут: колонки в
     колонках в письме верстаются нечитаемо, а почтовые клиенты
     ломают их первыми. Ограничение продуктовое, не техническое. */
  var NESTABLE = PALETTE.filter(function (t) { return t !== "columns" && t !== "container"; });

  function slotsOf(b) {
    var T = TYPES[b.t];
    return T && T.slots ? T.slots(b) : [];
  }

  function slotList(b, slot) {
    return slot === "k" ? b.kids : b.cols[Number(slot.slice(1))];
  }

  function blockHtml(b, st) {
    var T = TYPES[b.t];
    return T ? T.html(b, st) : "";
  }

  /* ------------------------------------------------------------
     HTML письма
     ------------------------------------------------------------ */
  function toHtml(L) {
    var st = L.style;
    var frame = st.border ? "border:1px solid " + st.border + ";" : "";
    return '<!DOCTYPE html>\n<html lang="ru"><head><meta charset="utf-8" />' +
      '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<meta name="x-apple-disable-message-reformatting" />' +
      "<title>Письмо</title></head>" +
      '<body style="margin:0;padding:0;background:' + st.bg + ';">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
      'style="background:' + st.bg + '"><tr><td align="center" style="padding:24px 12px">' +
      '<table role="presentation" width="' + PAGE_W + '" cellpadding="0" cellspacing="0" border="0" ' +
      'style="width:' + PAGE_W + "px;max-width:100%;background:" + st.canvas + ";" + frame +
      "border-radius:" + st.radius + "px;font-family:" + fontCss(st.font) +
      ";color:" + st.ink + '"><tr><td style="padding:16px 0">' +
      (L.blocks.length ? L.blocks.map(function (b) { return blockHtml(b, st); }).join("")
                       : '<div style="padding:48px 24px;text-align:center;color:#596A82">Письмо пустое</div>') +
      "</td></tr></table></td></tr></table></body></html>";
  }

  /* ------------------------------------------------------------
     Виджет
     ------------------------------------------------------------ */
  function create(opts) {
    var host = opts.mount;
    var onChange = opts.onChange || function () {};
    var L = normalize(opts.value);

    var mode = "edit";       /* edit | preview | code */
    var width = "desktop";   /* desktop | phone */
    var tab = "style";       /* style | props */
    var sel = null;          /* путь к выбранному блоку, массив */
    var adder = null;        /* где открыта палитра: {path, slot, index} */
    var sideOpen = true;

    function normalize(v) {
      var d = { style: { bg: "#F2F5F9", canvas: "#FFFFFF", border: "", radius: 0, font: "modern", ink: "#132437" }, blocks: [] };
      if (!v || typeof v !== "object") return d;
      return { style: Object.assign({}, d.style, v.style || {}),
               blocks: Array.isArray(v.blocks) ? JSON.parse(JSON.stringify(v.blocks)) : [] };
    }

    /* ---- адресация ----
       Путь — массив вида [3] или [3,"c0",1]: индекс, слот, индекс.
       В data-атрибут кладём строкой через «|». */
    function keyOf(path) { return path.join("|"); }
    function pathOf(key) {
      return key === "" ? [] : key.split("|").map(function (s, i) {
        return i % 2 === 0 ? Number(s) : s;
      });
    }

    function listAt(path) {
      var arr = L.blocks;
      for (var i = 0; i + 1 < path.length; i += 2) {
        arr = slotList(arr[path[i]], path[i + 1]);
      }
      return arr;
    }
    function blockAt(path) {
      if (!path || !path.length) return null;
      var arr = listAt(path);
      return arr ? arr[path[path.length - 1]] : null;
    }
    function samePath(a, b) { return a && b && keyOf(a) === keyOf(b); }

    function commit(label) {
      onChange(get(), label);
      draw();
    }

    /* ---- рисование ---- */
    function stageStyle() {
      var st = L.style;
      return "background:" + st.canvas + ";" +
        (st.border ? "border:1px solid " + st.border + ";" : "") +
        "border-radius:" + st.radius + "px;font-family:" + fontCss(st.font) +
        ";color:" + st.ink + ";width:" + (width === "phone" ? PHONE_W : PAGE_W) + "px";
    }

    function adderHtml(path, slot, index) {
      var open = adder && adder.key === keyOf(path) + "@" + slot + "@" + index;
      var allow = path.length ? NESTABLE : PALETTE;
      return '<div class="lt-add' + (open ? " is-open" : "") + '">' +
        '<button type="button" class="lt-add-btn" data-add="' + keyOf(path) + "@" + slot + "@" + index +
        '" title="Добавить блок"><span class="vh">Добавить блок</span>+</button>' +
        (open ? '<div class="lt-palette">' + allow.map(function (t) {
          return '<button type="button" class="lt-pal" data-make="' + t + '">' +
            '<span class="lt-pal-i">' + esc(TYPES[t].icon) + "</span>" +
            "<span>" + esc(TYPES[t].label) + "</span></button>";
        }).join("") + "</div>" : "") + "</div>";
    }

    function blockShell(b, path) {
      var on = samePath(sel, path);
      var inner;

      if (b.t === "columns" || b.t === "container") {
        inner = slotsOf(b).map(function (slot) {
          var kids = slotList(b, slot);
          return '<div class="lt-slot" data-slot="' + slot + '">' +
            kids.map(function (kid, i) {
              return adderHtml(path, slot, i) + blockShell(kid, path.concat([slot, i]));
            }).join("") +
            adderHtml(path, slot, kids.length) + "</div>";
        }).join("");
        inner = '<div class="lt-slots lt-slots-' + (b.t === "columns" ? b.cols.length : 1) +
          '" style="gap:' + (b.gap || 0) + 'px">' + inner + "</div>";
        inner = '<div class="lt-nest" style="' +
          (b.bg ? "background:" + b.bg + ";" : "") +
          "border-radius:" + (b.radius || 0) + "px;padding:" + (b.inner || 0) + 'px">' + inner + "</div>";
      } else {
        inner = blockHtml(b, L.style);
      }

      return '<div class="lt-b' + (on ? " is-sel" : "") + '" data-b="' + keyOf(path) + '">' +
        '<div class="lt-b-tools">' +
          '<button type="button" data-move="-1" title="Выше"><span class="vh">Выше</span>↑</button>' +
          '<button type="button" data-move="1" title="Ниже"><span class="vh">Ниже</span>↓</button>' +
          '<button type="button" data-dup="1" title="Дублировать"><span class="vh">Дублировать</span>⧉</button>' +
          '<button type="button" data-kill="1" class="danger" title="Удалить"><span class="vh">Удалить</span>✕</button>' +
        "</div>" +
        '<div class="lt-b-in">' + inner + "</div></div>";
    }

    function canvasHtml() {
      return L.blocks.map(function (b, i) {
        return adderHtml([], "root", i) + blockShell(b, [i]);
      }).join("") + adderHtml([], "root", L.blocks.length);
    }

    /* ---- панель ---- */
    function fieldHtml(f, val, scope) {
      var id = "lf_" + scope + "_" + f.k;
      var head = '<label class="lt-f"><span class="lt-f-l">' + esc(f.label) + "</span>";
      var tail = (f.hint ? '<span class="lt-f-h">' + esc(f.hint) + "</span>" : "") + "</label>";
      var attr = 'id="' + id + '" data-f="' + esc(f.k) + '" data-scope="' + scope + '"';

      if (f.kind === "textarea") {
        return head + "<textarea " + attr + ' rows="' + (f.rows || 4) + '"' +
          (f.mono ? ' class="lt-mono" spellcheck="false"' : "") + ">" + esc(val) + "</textarea>" + tail;
      }
      if (f.kind === "color") {
        return head + '<span class="lt-color"><input type="color" ' + attr +
          ' value="' + esc(val || "#000000") + '" />' +
          (f.empty ? '<button type="button" class="lt-clear" data-clear="' + esc(f.k) +
            '" data-scope="' + scope + '">' + esc(val ? "сбросить" : f.empty) + "</button>" : "") +
          "</span>" + tail;
      }
      if (f.kind === "range") {
        return head + '<span class="lt-range"><input type="range" ' + attr +
          ' min="' + f.min + '" max="' + f.max + '" value="' + esc(val) + '" />' +
          '<b class="lt-range-v">' + esc(val) + esc(f.unit || "") + "</b></span>" + tail;
      }
      if (f.kind === "align") {
        return head + '<span class="lt-align">' +
          [["left", "◧"], ["center", "▣"], ["right", "◨"]].map(function (a) {
            return '<button type="button" data-align="' + a[0] + '" data-f="' + esc(f.k) +
              '" data-scope="' + scope + '"' + (val === a[0] ? ' class="is-on"' : "") +
              ' title="' + (a[0] === "left" ? "По левому краю" : a[0] === "center" ? "По центру" : "По правому краю") +
              '">' + a[1] + "</button>";
          }).join("") + "</span>" + tail;
      }
      if (f.kind === "select") {
        return head + "<select " + attr + ">" + f.options.map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (String(val) === o[0] ? " selected" : "") +
            ">" + esc(o[1]) + "</option>";
        }).join("") + "</select>" + tail;
      }
      return head + '<input type="' + (f.kind === "url" ? "url" : "text") + '" ' + attr +
        ' value="' + esc(val) + '" placeholder="' + esc(f.placeholder || "") +
        '" autocomplete="off" />' + tail;
    }

    var STYLE_FIELDS = [
      { k: "bg",     kind: "color",  label: "Цвет фона" },
      { k: "canvas", kind: "color",  label: "Цвет холста" },
      { k: "border", kind: "color",  label: "Цвет рамки", empty: "без рамки" },
      { k: "radius", kind: "range",  label: "Радиус рамки", min: 0, max: 24, unit: "px" },
      { k: "font",   kind: "select", label: "Шрифт",
        options: Object.keys(FONTS).map(function (id) { return [id, FONTS[id].label]; }) },
      { k: "ink",    kind: "color",  label: "Цвет текста" },
    ];

    function paneHtml() {
      if (tab === "style") {
        return '<p class="lt-group">Основные</p>' +
          STYLE_FIELDS.map(function (f) { return fieldHtml(f, L.style[f.k], "style"); }).join("");
      }
      var b = blockAt(sel);
      if (!b) {
        return '<p class="lt-empty">Выберите блок на холсте — здесь появятся его свойства.</p>';
      }
      var T = TYPES[b.t];
      return '<p class="lt-group">' + esc(T.label) + "</p>" +
        T.fields.map(function (f) {
          var v = f.k === "count" ? String(b.cols.length) : b[f.k];
          return fieldHtml(f, v, "block");
        }).join("");
    }

    function draw() {
      var stage = mode === "edit"
        ? '<div class="lt-page"><div class="lt-canvas" style="' + stageStyle() + '">' +
          canvasHtml() + "</div></div>"
        : mode === "preview"
          ? '<iframe class="lt-frame" title="Предпросмотр письма" style="width:' +
            (width === "phone" ? PHONE_W : PAGE_W + 48) + 'px" srcdoc="' + esc(toHtml(L)) + '"></iframe>'
          : '<div class="lt-code"><button type="button" class="btn btn-plain lt-copy">Скопировать</button>' +
            "<textarea readonly spellcheck=\"false\">" + esc(toHtml(L)) + "</textarea></div>";

      host.innerHTML =
        '<div class="lt' + (sideOpen ? "" : " lt-narrow") + '">' +
          '<div class="lt-bar">' +
            '<div class="lt-modes">' +
              btn("mode", "edit", "✎", "Редактор", mode === "edit") +
              btn("mode", "preview", "◉", "Предпросмотр", mode === "preview") +
              btn("mode", "code", "<>", "HTML письма", mode === "code") +
            "</div>" +
            '<div class="lt-tools">' +
              btn("act", "down", "⤓", "Выгрузить шаблон", false) +
              btn("act", "up", "⤒", "Загрузить шаблон", false) +
              '<span class="lt-sep"></span>' +
              btn("width", "desktop", "▭", "Компьютер", width === "desktop") +
              btn("width", "phone", "▯", "Телефон", width === "phone") +
              '<span class="lt-sep"></span>' +
              btn("act", "side", sideOpen ? "›|" : "|‹", sideOpen ? "Свернуть панель" : "Развернуть панель", false) +
            "</div>" +
          "</div>" +
          '<div class="lt-body">' +
            '<div class="lt-stage" data-mode="' + mode + '">' + stage + "</div>" +
            '<aside class="lt-side">' +
              '<div class="lt-tabs">' +
                '<button type="button" data-tab="style"' + (tab === "style" ? ' class="is-on"' : "") + ">Стиль</button>" +
                '<button type="button" data-tab="props"' + (tab === "props" ? ' class="is-on"' : "") + ">Свойства</button>" +
              "</div>" +
              '<div class="lt-pane">' + paneHtml() + "</div>" +
            "</aside>" +
          "</div>" +
          '<input type="file" class="lt-file" accept="application/json,.json" hidden />' +
        "</div>";
    }

    function btn(kind, val, icon, title, on) {
      return '<button type="button" data-' + kind + '="' + val + '"' + (on ? ' class="is-on"' : "") +
        ' title="' + esc(title) + '"><span class="vh">' + esc(title) + "</span>" + esc(icon) + "</button>";
    }

    /* ---- события ---- */
    host.addEventListener("click", function (e) {
      var t = e.target.closest("button");

      /* выбор блока — по клику мимо кнопок */
      if (!t) {
        var box = e.target.closest(".lt-b");
        if (box) { sel = pathOf(box.dataset.b); tab = "props"; adder = null; draw(); }
        return;
      }

      if (t.dataset.mode)  { mode = t.dataset.mode; adder = null; draw(); return; }
      if (t.dataset.width) { width = t.dataset.width; draw(); return; }
      if (t.dataset.tab)   { tab = t.dataset.tab; draw(); return; }

      if (t.dataset.act === "side") { sideOpen = !sideOpen; draw(); return; }
      if (t.dataset.act === "down") { download(); return; }
      if (t.dataset.act === "up")   { host.querySelector(".lt-file").click(); return; }
      if (t.classList.contains("lt-copy")) { copyCode(t); return; }

      if (t.dataset.add) {
        var key = t.dataset.add;
        adder = (adder && adder.key === key) ? null : { key: key };
        draw();
        return;
      }

      if (t.dataset.make) { addBlock(t.dataset.make); return; }
      if (t.dataset.clear) { clearField(t); return; }
      if (t.dataset.align) { setField(t.dataset.scope, t.dataset.f, t.dataset.align); return; }

      var host_b = t.closest(".lt-b");
      if (!host_b) return;
      var path = pathOf(host_b.dataset.b);

      if (t.dataset.move) { move(path, Number(t.dataset.move)); return; }
      if (t.dataset.dup)  { duplicate(path); return; }
      if (t.dataset.kill) { kill(path); return; }
    });

    host.addEventListener("input", function (e) {
      var el = e.target;
      if (!el.dataset || !el.dataset.f || !el.dataset.scope) return;

      /* ползунок и цвет отдают значение на каждый шаг — их показываем
         сразу, но перерисовываем только цифру рядом, иначе потеряется
         захват мыши */
      var v = el.type === "range" ? Number(el.value) : el.value;
      apply(el.dataset.scope, el.dataset.f, v);

      if (el.type === "range") {
        var out = el.parentNode.querySelector(".lt-range-v");
        var f = findField(el.dataset.scope, el.dataset.f);
        if (out) out.textContent = v + ((f && f.unit) || "");
      }
      livePaint();
      onChange(get(), "field");
    });

    host.addEventListener("change", function (e) {
      var el = e.target;
      if (el.classList && el.classList.contains("lt-file")) { upload(el); return; }
      if (!el.dataset || !el.dataset.f || !el.dataset.scope) return;
      if (el.type === "range" || el.type === "color") { draw(); return; }
      apply(el.dataset.scope, el.dataset.f, el.value);
      commit("field");
    });

    function findField(scope, k) {
      if (scope === "style") return STYLE_FIELDS.filter(function (f) { return f.k === k; })[0];
      var b = blockAt(sel);
      return b ? TYPES[b.t].fields.filter(function (f) { return f.k === k; })[0] : null;
    }

    /* Перерисовываем только холст: полный draw() на каждый символ
       отбирал бы фокус у поля, в котором сейчас печатают. */
    function livePaint() {
      var canvas = host.querySelector(".lt-canvas");
      if (!canvas) return;
      canvas.setAttribute("style", stageStyle());
      canvas.innerHTML = canvasHtml();
    }

    function apply(scope, k, v) {
      if (scope === "style") { L.style[k] = v; return; }
      var b = blockAt(sel);
      if (!b) return;
      if (k === "count") { setColumns(b, Number(v)); return; }
      b[k] = v;
    }

    function setField(scope, k, v) { apply(scope, k, v); commit("field"); }

    function clearField(t) {
      var k = t.dataset.clear;
      var scope = t.dataset.scope;
      var cur = scope === "style" ? L.style[k] : (blockAt(sel) || {})[k];
      apply(scope, k, cur ? "" : "#000000");
      commit("field");
    }

    /* Колонки не пересоздаём: при уменьшении содержимое последней
       колонки переезжает в предыдущую, а не пропадает молча. */
    function setColumns(b, n) {
      while (b.cols.length > n) {
        var tailCol = b.cols.pop();
        b.cols[b.cols.length - 1] = b.cols[b.cols.length - 1].concat(tailCol);
      }
      while (b.cols.length < n) b.cols.push([]);
    }

    function addBlock(type) {
      if (!adder) return;
      var parts = adder.key.split("@");
      var path = pathOf(parts[0]);
      var slot = parts[1];
      var index = Number(parts[2]);
      var arr = slot === "root" ? L.blocks : slotList(blockAt(path), slot);
      var made = TYPES[type].make();
      arr.splice(index, 0, made);
      sel = slot === "root" ? [index] : path.concat([slot, index]);
      tab = "props";
      adder = null;
      commit("add");
    }

    function move(path, dir) {
      var arr = listAt(path);
      var i = path[path.length - 1];
      var j = i + dir;
      if (j < 0 || j >= arr.length) return;
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      sel = path.slice(0, -1).concat([j]);
      commit("move");
    }

    function duplicate(path) {
      var arr = listAt(path);
      var i = path[path.length - 1];
      arr.splice(i + 1, 0, JSON.parse(JSON.stringify(arr[i])));
      sel = path.slice(0, -1).concat([i + 1]);
      commit("dup");
    }

    function kill(path) {
      var arr = listAt(path);
      arr.splice(path[path.length - 1], 1);
      sel = null;
      tab = "style";
      commit("kill");
    }

    /* ---- шаблон файлом ---- */
    function download() {
      var blob = new Blob([JSON.stringify(get(), null, 2)], { type: "application/json;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "letter-template.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      onChange(get(), "download");
    }

    function upload(input) {
      var file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        var parsed;
        try { parsed = JSON.parse(String(fr.result)); } catch (_) { parsed = null; }
        /* чужой json не должен превращать письмо в пустой холст молча */
        if (!parsed || !Array.isArray(parsed.blocks)) {
          onChange(get(), "upload-bad");
          return;
        }
        L = normalize(parsed);
        sel = null;
        tab = "style";
        commit("upload");
      };
      fr.readAsText(file);
    }

    function copyCode(btnEl) {
      var ta = host.querySelector(".lt-code textarea");
      if (!ta) return;
      var done = function (ok) { btnEl.textContent = ok ? "Скопировано" : "Не удалось"; 
        setTimeout(function () { btnEl.textContent = "Скопировать"; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(function () { done(true); }, function () { done(false); });
        return;
      }
      ta.removeAttribute("readonly");
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
      ta.setAttribute("readonly", "");
      done(ok);
    }

    function get() { return JSON.parse(JSON.stringify(L)); }

    draw();

    return {
      get: get,
      html: function () { return toHtml(L); },
      isEmpty: function () { return !L.blocks.length; },
      set: function (v) { L = normalize(v); sel = null; tab = "style"; draw(); },
    };
  }

  window.AdminLetter = {
    create: create,
    toHtml: toHtml,
    TYPES: TYPES,
    PALETTE: PALETTE,
    FONTS: FONTS,
  };
})();
