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

   Письмо можно перевести в режим HTML (letter.mode = "html"): тогда
   оно уходит тем кодом, что написан во вкладке «HTML письма» (плюс
   строка отписки перед </body>, если в коде нет {{unsubscribe_url}}),
   а блоки лежат рядом нетронутыми до «Вернуться к блокам».

   Наружу: window.AdminLetter.create(opts) и .toHtml(letter),
   .lintHtml(html) — замечания к HTML письма, .richText(s) — мини-
   разметка текста, .renderVars(html, sample) — подстановка {{…}}.
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

  /* ------------------------------------------------------------
     Мини-разметка текста
     ------------------------------------------------------------
     **жирный**, _курсив_, [текст](https://…), строки с «- » — список.
     Сначала экранируем ВСЁ, потом размечаем: так в письмо не попадёт
     ни один тег, кроме наших. Ссылки — только http(s), mailto и
     переменная {{…}}; javascript: и прочее остаётся текстом.
     Текст без разметки даёт ровно прежний рендер (экранирование и
     <br /> вместо переводов строк) — старые письма не меняются. */
  var LINK_STYLE = "color:inherit;text-decoration:underline";
  var UL_STYLE = "margin:0;padding:0 0 0 22px";
  var LI_STYLE = "margin:0 0 4px";
  var WORD = "0-9A-Za-zА-Яа-яЁё";

  function safeHref(u) {
    return /^(https?:\/\/|mailto:)\S+$/i.test(u) || /^\{\{\s*\w+\s*\}\}$/.test(u);
  }

  function inlineMarks(s) {
    /* ссылки и {{…}} прячем, чтобы «_» в адресе или в {{event_title}}
       не превратились в курсив */
    var keep = [];
    function hold(html) { keep.push(html); return "\u0000" + (keep.length - 1) + "\u0000"; }
    s = s.replace(/\[([^\]\n]+)\]\(([^()\s]+)\)/g, function (m, text, url) {
      if (!safeHref(url)) return m;
      return hold('<a href="' + url + '" style="' + LINK_STYLE + '">' + emph(text) + "</a>");
    });
    s = s.replace(/\{\{[^{}\n]*\}\}/g, hold);
    s = emph(s);
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return keep[Number(i)]; });
  }

  function emph(s) {
    s = s.replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, "<strong>$1</strong>");
    return s.replace(new RegExp("(^|[^" + WORD + "])_(?=\\S)([^_\\n]*?\\S)_(?![" + WORD + "])", "g"),
      "$1<em>$2</em>");
  }

  function richText(s) {
    var lines = esc(s).split("\n");
    var out = [], text = [], items = [];
    function flushText() { if (text.length) { out.push(text.join("<br />")); text = []; } }
    function flushList() {
      if (!items.length) return;
      out.push('<ul style="' + UL_STYLE + '">' + items.map(function (it) {
        return '<li style="' + LI_STYLE + '">' + it + "</li>";
      }).join("") + "</ul>");
      items = [];
    }
    lines.forEach(function (line) {
      if (/^- /.test(line)) { flushText(); items.push(inlineMarks(line.slice(2))); }
      else { flushList(); text.push(inlineMarks(line)); }
    });
    flushText(); flushList();
    return out.join("");
  }

  /* ------------------------------------------------------------
     Переменные
     ------------------------------------------------------------
     В письме лежат плейсхолдеры {{…}}; подставляет их отправка.
     Здесь подстановка нужна только предпросмотру — демо-значениями. */
  var VARS = [
    { k: "name",            label: "Имя получателя" },
    { k: "email",           label: "Email" },
    { k: "event_title",     label: "Мероприятие" },
    { k: "unsubscribe_url", label: "Ссылка отписки" },
  ];
  var VAR_KEYS = VARS.map(function (v) { return v.k; });

  function demoVars() {
    var S = window.AdminStore && window.AdminStore.state;
    var ev = S && S.EVENTS && S.EVENTS[0];
    return {
      name: "Анна",
      email: "anna@example.ru",
      event_title: ev ? ev.title : "",
      unsubscribe_url: "https://tvorchestvo.ru/unsubscribe?u=demo",
    };
  }

  function renderVars(html, sample) {
    var v = sample || demoVars();
    return String(html == null ? "" : html).replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(v, k) ? esc(v[k]) : m;
    });
  }

  /* Строка отписки: без неё рассылку легко принять за спам, а адрес
     подставит отправка. Добавляется, только если автор не поставил
     {{unsubscribe_url}} сам. */
  var UNSUB_TEXT = 'Вы получили это письмо, потому что подписаны на рассылку. ' +
    '<a href="{{unsubscribe_url}}">Отписаться</a>';
  var UNSUB_STYLE = "padding:12px 24px 20px;font-size:12px;line-height:1.5;color:#596A82;text-align:center";
  var HAS_UNSUB = /\{\{\s*unsubscribe_url\s*\}\}/;

  /* Ширина письма — 600px: исторический предел, за которым Outlook и
     почтовые приложения начинают резать вёрстку по горизонтали. */
  var PAGE_W = 600;
  var PHONE_W = 375;

  /* ---- загрузка картинок ----
     Картинка ложится в письмо как data-URL: файлового хранилища у
     витрины нет. Поэтому её ужимаем до двойной ширины письма и
     держим общий бюджет на письмо — localStorage около пяти
     мегабайт на весь кабинет, и одно письмо не должно его съесть.

     ВАЖНО для боевой отправки: Gmail и Outlook НЕ показывают
     картинки из data-URL. В рабочей системе загрузка должна класть
     файл на сервер и возвращать обычный https-адрес — тогда здесь
     меняется только тело uploadImage(). */
  var IMG_MAX_BYTES = 512 * 1024;
  var IMG_MAX_W = 1200;
  var LETTER_BUDGET = 1200 * 1024;

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
        { k: "text",  kind: "textarea", label: "Текст", rich: true },
        { k: "size",  kind: "range", label: "Размер", min: 14, max: 44, unit: "px" },
        { k: "align", kind: "align", label: "Выравнивание" },
        { k: "color", kind: "color", label: "Цвет текста", empty: "как у письма" },
        { k: "pad",   kind: "range", label: "Отступы", min: 0, max: 48, unit: "px" },
      ],
      html: function (b, st) {
        return '<div style="padding:' + pad(b) + ";text-align:" + b.align +
          ";font-size:" + b.size + "px;line-height:1.25;font-weight:600;color:" +
          (b.color || st.ink) + '">' + richText(b.text) + "</div>";
      },
    },

    text: {
      label: "Текст", icon: "≡",
      make: function () { return { t: "text", text: "Здесь — текст письма. Расскажите, что происходит в театре.", size: 15, align: "left", color: "", pad: 10 }; },
      fields: [
        { k: "text",  kind: "textarea", label: "Текст", rows: 7, rich: true },
        { k: "size",  kind: "range", label: "Размер", min: 11, max: 24, unit: "px" },
        { k: "align", kind: "align", label: "Выравнивание" },
        { k: "color", kind: "color", label: "Цвет текста", empty: "как у письма" },
        { k: "pad",   kind: "range", label: "Отступы", min: 0, max: 48, unit: "px" },
      ],
      html: function (b, st) {
        return '<div style="padding:' + pad(b) + ";text-align:" + b.align +
          ";font-size:" + b.size + "px;line-height:1.6;color:" + (b.color || st.ink) + '">' +
          richText(b.text) + "</div>";
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
        /* ссылкой, а не <button>: кнопки в письмах не работают. Без адреса —
           <span> того же вида: href="#" в письме ведёт в никуда */
        var look = 'style="display:inline-block;padding:12px 26px;' +
          "background:" + b.bg + ";color:" + b.color + ";border-radius:" + b.radius +
          'px;font-size:15px;font-weight:600;text-decoration:none">' + esc(b.text);
        var href = String(b.href || "").trim();
        return '<div style="padding:' + pad(b) + ";text-align:" + b.align + '">' +
          (href ? '<a href="' + esc(href) + '" ' + look + "</a>" : "<span " + look + "</span>") +
          "</div>";
      },
    },

    image: {
      label: "Картинка", icon: "▨",
      make: function () { return { t: "image", src: "", alt: "", href: "", width: 100, align: "center", pad: 10 }; },
      fields: [
        { k: "src",   kind: "image", label: "Картинка" },
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
    /* письмо в режиме HTML уходит ровно тем кодом, что написал человек */
    if (L && L.mode === "html") {
      var src = String(L.html || "");
      if (HAS_UNSUB.test(src)) return src;
      /* перед последним </body>; без </body> вставить некуда — код
         уходит как написан (линтер про незакрытый документ напомнит) */
      var at = src.search(/<\/body\s*>(?![\s\S]*<\/body\s*>)/i);
      if (at < 0) return src;
      return src.slice(0, at) + '<div style="' + UNSUB_STYLE + '">' + UNSUB_TEXT + "</div>" + src.slice(at);
    }
    var st = L.style;
    var body = L.blocks.length ? L.blocks.map(function (b) { return blockHtml(b, st); }).join("")
                               : '<div style="padding:48px 24px;text-align:center;color:#596A82">Письмо пустое</div>';
    var unsub = HAS_UNSUB.test(body) ? ""
      : '<tr><td style="' + UNSUB_STYLE + '">' + UNSUB_TEXT + "</td></tr>";
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
      body + "</td></tr>" + unsub + "</table></td></tr></table></body></html>";
  }

  /* ------------------------------------------------------------
     Проверка HTML письма
     ------------------------------------------------------------
     Правила — данными: каждое смотрит на исходник и говорит, есть ли
     проблема. Новое правило — ещё одна запись в LINT_RULES. Это не
     валидатор HTML, а напоминание о том, что ломается в почтовиках. */
  var GMAIL_CLIP = 102 * 1024; /* больше — Gmail прячет хвост под «Показать полностью» */

  function tableTooWide(html) {
    var re = /<table\b[^>]*>/gi, m;
    while ((m = re.exec(html))) {
      var tag = m[0];
      var a = /\bwidth\s*=\s*["']?\s*(\d+)/i.exec(tag);
      var s = /style\s*=\s*["'][^"']*\bwidth\s*:\s*(\d+)px/i.exec(tag);
      if ((a && Number(a[1]) > PAGE_W) || (s && Number(s[1]) > PAGE_W)) return true;
    }
    return false;
  }

  var LINT_RULES = [
    { level: "warn", text: "Нет табличного каркаса — Outlook может разъехаться",
      test: function (h) { return !/<table\b/i.test(h); } },
    { level: "error", text: "В письме есть <script> — почтовики вырезают скрипты, а часть писем с ними отправляет в спам",
      test: function (h) { return /<script\b/i.test(h); } },
    { level: "warn", text: "Внешние стили (<link rel=\"stylesheet\">, @import) почтовики не подгружают — задавайте стили прямо в тегах",
      test: function (h) {
        return /<link\b[^>]*rel\s*=\s*["']?stylesheet/i.test(h) || /@import\b/i.test(h);
      } },
    { level: "warn", text: "Пустая ссылка (href=\"#\" или без адреса) — укажите, куда она ведёт",
      test: function (h) {
        return /\bhref\s*=\s*(["'])\s*#?\s*\1/i.test(h) ||  /* href="#", href="" */
          /\bhref\s*=\s*(?:#(?=[\s>\/])|(?=>))/i.test(h) ||  /* href=# без кавычек */
          /<a\b[^>]*\shref(?=[\s>]|\/>)(?!\s*=)/i.test(h);     /* <a href> без значения */
      } },
    { level: "warn", text: "Картинки data-URL не показываются в Gmail/Outlook",
      test: function (h) {
        return /\b(?:src|background)\s*=\s*["']?\s*data:/i.test(h) || /url\(\s*["']?\s*data:/i.test(h);
      } },
    { level: "warn", text: "Неизвестная переменная в {{…}} — она уйдёт подписчику как есть. " +
        "Доступны: " + VAR_KEYS.map(function (k) { return "{{" + k + "}}"; }).join(", "),
      test: function (h) {
        var re = /\{\{\s*([^{}]*?)\s*\}\}/g, m;
        while ((m = re.exec(h))) if (VAR_KEYS.indexOf(m[1]) < 0) return true;
        return false;
      } },
    { level: "warn", text: "Таблица шире " + PAGE_W + "px — в Outlook и на телефоне письмо поедет вбок",
      test: tableTooWide },
    { level: "warn", text: "Нет </body> или </html> — документ письма не закрыт",
      test: function (h) { return !/<\/body\s*>/i.test(h) || !/<\/html\s*>/i.test(h); } },
  ];

  function lintHtml(html) {
    var h = String(html || "");
    return LINT_RULES.filter(function (r) { return r.test(h); })
      .map(function (r) { return { level: r.level, text: r.text }; });
  }

  function byteSize(s) {
    return new Blob([String(s || "")]).size;
  }

  /* ------------------------------------------------------------
     Журнал тестовых отправок: letter.tests = [{to:[…], at:ISO}]
     ------------------------------------------------------------ */
  var TEST_MAX = 5, TEST_KEEP = 20;
  var MAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function pluralRu(n, f) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    return b === 1 ? f[0] : f[2];
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function ruStamp(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return String(iso || "");
    return pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + "." + d.getFullYear() +
      " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function parseTo(raw) {
    var seen = {}, out = [];
    String(raw || "").split(/[,;\n]+/).forEach(function (x) {
      x = x.trim();
      if (x && !seen[x.toLowerCase()]) { seen[x.toLowerCase()] = 1; out.push(x); }
    });
    return out;
  }
  /* «Последний тест: 27.10.2026 14:05, a@x.ru, b@x.ru» или "" */
  function lastTest(letter) {
    var t = letter && Array.isArray(letter.tests) && letter.tests.length ? letter.tests[letter.tests.length - 1] : null;
    if (!t || !Array.isArray(t.to)) return "";
    return "Последний тест: " + ruStamp(t.at) + ", " + t.to.join(", ");
  }

  /* ------------------------------------------------------------
     Виджет
     ------------------------------------------------------------ */
  function create(opts) {
    var host = opts.mount;
    var onChange = opts.onChange || function () {};
    var L = normalize(opts.value);

    var mode = L.mode === "html" ? "code" : "edit";  /* edit | preview | code */
    var width = "desktop";   /* desktop | phone */
    var tab = "style";       /* style | props */
    var sel = null;          /* путь к выбранному блоку, массив */
    var adder = null;        /* где открыта палитра: {path, slot, index} */
    var sideOpen = true;
    var liveTimer = null;    /* отложенное обновление предпросмотра HTML */
    var tabOut = false;      /* после Esc клавиша Tab уводит фокус из редактора */

    /* Незнакомые поля письма сохраняем как есть: их добавляют другие
       части кабинета, и конструктор не должен их терять. */
    function normalize(v) {
      var d = { style: { bg: "#F2F5F9", canvas: "#FFFFFF", border: "", radius: 0, font: "modern", ink: "#132437" },
                blocks: [], mode: "blocks", html: "" };
      if (!v || typeof v !== "object") return d;
      var out = JSON.parse(JSON.stringify(v));
      out.style = Object.assign({}, d.style, v.style || {});
      out.blocks = Array.isArray(v.blocks) ? out.blocks : [];
      out.mode = v.mode === "html" ? "html" : "blocks";
      out.html = typeof v.html === "string" ? v.html : "";
      return out;
    }

    function isHtml() { return L.mode === "html"; }

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

    /* Панель форматирования над полем. target — id поля, в которое
       вставляем; full=false — только «Переменная» (редактор HTML). */
    function fmtBarHtml(target, full) {
      var b = function (fmt, icon, label) {
        return '<button type="button" data-fmt="' + fmt + '" data-for="' + target + '" aria-label="' +
          label + '" title="' + label + '">' + icon + "</button>";
      };
      return '<div class="lt-fmt" role="toolbar" aria-label="Форматирование">' +
        (full ? b("b", "<b>Ж</b>", "Жирный") + b("i", "<i>К</i>", "Курсив") +
                b("link", "Ссылка", "Ссылка") + b("list", "Список", "Список") : "") +
        '<span class="lt-var">' +
          '<button type="button" class="lt-var-btn" data-varmenu="' + target + '" aria-label="Переменная" ' +
            'aria-haspopup="true" aria-expanded="false">{{ }} Переменная</button>' +
          '<span class="lt-var-menu" role="menu" hidden>' + VARS.map(function (v) {
            return '<button type="button" role="menuitem" data-var="' + v.k + '" data-for="' + target + '">' +
              "<code>{{" + v.k + "}}</code> " + esc(v.label) + "</button>";
          }).join("") + "</span>" +
        "</span></div>";
    }

    function fieldHtml(f, val, scope) {
      var id = "lf_" + scope + "_" + f.k;
      var head = '<label class="lt-f"><span class="lt-f-l">' + esc(f.label) + "</span>";
      var tail = (f.hint ? '<span class="lt-f-h">' + esc(f.hint) + "</span>" : "") + "</label>";
      var attr = 'id="' + id + '" data-f="' + esc(f.k) + '" data-scope="' + scope + '"';

      if (f.kind === "textarea") {
        if (f.rich) {
          /* панель — вне <label>: иначе клик по кнопке уводил бы фокус в поле */
          return '<div class="lt-f"><label class="lt-f-l" for="' + id + '">' + esc(f.label) + "</label>" +
            fmtBarHtml(id, true) +
            "<textarea " + attr + ' rows="' + (f.rows || 4) + '">' + esc(val) + "</textarea>" +
            '<span class="lt-f-h">**жирный**, _курсив_, [текст](https://…), строка с «- » — пункт списка.</span></div>';
        }
        return head + "<textarea " + attr + ' rows="' + (f.rows || 4) + '"' +
          (f.mono ? ' class="lt-mono" spellcheck="false"' : "") + ">" + esc(val) + "</textarea>" + tail;
      }
      if (f.kind === "image") {
        return head + '<span class="lt-img">' +
          (val
            ? '<img class="lt-img-p" src="' + esc(val) + '" alt="Загруженная картинка" />'
            : '<span class="lt-img-none">картинка не выбрана</span>') +
          '<span class="lt-img-row">' +
            '<label class="lt-img-up">' + (val ? "Заменить" : "Загрузить картинку") +
              '<input type="file" accept="image/jpeg,image/png" data-img="' + esc(f.k) +
              '" data-scope="' + esc(scope) + '" hidden /></label>' +
            (val ? '<button type="button" class="lt-clear" data-imgoff="' + esc(f.k) +
                   '" data-scope="' + esc(scope) + '">убрать</button>' : "") +
          "</span>" +
          '<span class="lt-f-h">JPG или PNG, до 500 Кб. Картинка ужимается до ' +
          IMG_MAX_W + ' px по ширине.</span></span>' + tail;
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
        (b.t === "button" ? btnWarnHtml(b) : "") +
        T.fields.map(function (f) {
          var v = f.k === "count" ? String(b.cols.length) : b[f.k];
          return fieldHtml(f, v, "block");
        }).join("");
    }

    function btnWarnHtml(b) {
      return '<p class="lt-warn" role="status"' + (String(b.href || "").trim() ? " hidden" : "") +
        ">Добавьте ссылку — без неё кнопка не кликается</p>";
    }

    /* Предпросмотр — всегда в песочнице без allow-scripts: HTML письма
       может прийти откуда угодно, и в кабинете он исполняться не должен. */
    function frameHtml(cls, w, prop) {
      return '<iframe class="' + cls + '" sandbox="" title="Предпросмотр письма" style="' + (prop || "width") +
        ":" + w + 'px" srcdoc="' + esc(renderVars(toHtml(L))) + '"></iframe>';
    }

    function codeBarHtml() {
      return '<div class="lt-code-bar">' +
        (isHtml()
          ? '<button type="button" class="btn btn-plain lt-to-blocks">Вернуться к блокам</button>' +
            '<span class="lt-size"></span>'
          : '<button type="button" class="btn btn-plain lt-to-html">Редактировать как HTML</button>') +
        '<span class="lt-code-sp"></span>' +
        '<button type="button" class="btn btn-plain lt-dl-html">Скачать .html</button>' +
        '<button type="button" class="btn btn-plain lt-copy">Скопировать</button>' +
        "</div>";
    }

    function codeHtml() {
      if (!isHtml()) {
        return '<div class="lt-code">' + codeBarHtml() +
          '<textarea readonly spellcheck="false" aria-label="HTML письма">' + esc(toHtml(L)) + "</textarea></div>";
      }
      return '<div class="lt-code lt-code-html">' + codeBarHtml() +
        '<div class="lt-split">' +
          '<div class="lt-src-wrap">' + fmtBarHtml("ltSrc", false) +
            '<textarea class="lt-src" id="ltSrc" spellcheck="false" autocomplete="off" autocapitalize="off" ' +
              'aria-label="HTML-код письма" aria-describedby="ltSrcHint">' + esc(L.html) + "</textarea>" +
            '<p class="lt-f-h" id="ltSrcHint">Tab — отступ в 2 пробела, Shift+Tab — снять отступ. ' +
              "Чтобы уйти из редактора клавиатурой: Esc, затем Tab.</p>" +
          "</div>" +
          frameHtml("lt-frame lt-live", width === "phone" ? PHONE_W : PAGE_W + 48, "max-width") +
        "</div>" +
        '<ul class="lt-lint" aria-live="polite"></ul>' +
        "</div>";
    }

    function draw() {
      /* поле с фокусом отпускаем ДО замены разметки: его blur/change
         иначе сработает посреди innerHTML и перерисует виджет вложенно */
      var ae = document.activeElement;
      if (ae && ae !== document.body && host.contains(ae) && ae.blur) ae.blur();
      if (isHtml() && mode === "edit") mode = "code";
      var stage = mode === "edit"
        ? '<div class="lt-page"><div class="lt-canvas" style="' + stageStyle() + '">' +
          canvasHtml() + "</div></div>"
        : mode === "preview"
          ? frameHtml("lt-frame", width === "phone" ? PHONE_W : PAGE_W + 48)
          : codeHtml();

      var side = isHtml()
        ? '<div class="lt-tabs">' +
            '<button type="button" disabled>Стиль</button><button type="button" disabled>Свойства</button>' +
          "</div>" +
          '<div class="lt-pane"><p class="lt-empty">Письмо в режиме HTML: оформление и содержимое ' +
            "задаются в коде. Блоки, стиль и свойства вернутся по кнопке «Вернуться к блокам» " +
            "во вкладке «HTML письма».</p></div>"
        : '<div class="lt-tabs">' +
            '<button type="button" data-tab="style"' + (tab === "style" ? ' class="is-on"' : "") + ">Стиль</button>" +
            '<button type="button" data-tab="props"' + (tab === "props" ? ' class="is-on"' : "") + ">Свойства</button>" +
          "</div>" +
          '<div class="lt-pane">' + paneHtml() + "</div>";

      host.innerHTML =
        '<div class="lt' + (sideOpen ? "" : " lt-narrow") + '">' +
          '<div class="lt-bar">' +
            '<div class="lt-modes">' +
              (isHtml()
                ? '<button type="button" disabled title="Редактор блоков недоступен в режиме HTML">' +
                  '<span class="vh">Редактор блоков недоступен в режиме HTML</span>✎</button>'
                : btn("mode", "edit", "✎", "Редактор", mode === "edit")) +
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
            '<aside class="lt-side">' + side + "</aside>" +
          "</div>" +
          '<div class="lt-test">' +
            '<button type="button" class="btn btn-plain lt-test-btn" aria-describedby="ltTestNote">Тестовая отправка</button>' +
            '<span class="lt-test-note" id="ltTestNote"></span>' +
          "</div>" +
          '<input type="file" class="lt-file" accept="application/json,.json" hidden />' +
        "</div>";
      paintTest();
      if (isHtml() && mode === "code") paintLive(false);
    }

    /* ---- тестовая отправка ----
       Почтового сервера нет: «отправка» — запись в журнал L.tests
       (последние 20), который уходит в стор вместе с письмом. */
    function paintTest() {
      var btnEl = host.querySelector(".lt-test-btn");
      var note = host.querySelector(".lt-test-note");
      if (!btnEl || !note) return;
      var empty = L.mode === "html" ? !L.html.trim() : !L.blocks.length;
      btnEl.disabled = empty;
      if (empty) { btnEl.title = "Сначала составьте письмо"; }
      else btnEl.removeAttribute("title");
      note.textContent = empty
        ? "Письмо пустое — добавьте содержимое, тогда можно отправить тест."
        : lastTest(L);
    }

    function testDialog() {
      if (!window.AdminDialog) return;
      var last = Array.isArray(L.tests) && L.tests.length ? L.tests[L.tests.length - 1] : null;
      var found = null;
      window.AdminDialog.open({
        title: "Тестовая отправка",
        body: '<div class="lt-f">' +
          '<label class="lt-f-l" for="ltTestTo">Адреса (от 1 до ' + TEST_MAX + ')</label>' +
          '<textarea id="ltTestTo" rows="3" spellcheck="false" autocomplete="off" aria-describedby="ltTestHint ltTestErr">' +
            esc(last && Array.isArray(last.to) ? last.to.join(", ") : "") + "</textarea>" +
          '<span class="lt-f-h" id="ltTestHint">Через запятую или с новой строки.</span>' +
          '<p class="lt-test-err" id="ltTestErr" role="alert" hidden></p></div>' +
          '<p class="lt-f-h">Реальной отправки нет: кабинет работает без почтового сервера — письмо попадёт в журнал тестов.</p>',
        actions: [
          { label: "Отмена", kind: "plain", value: false },
          { label: "Отправить тест", kind: "primary", value: "send", validate: function (root) {
              var ta = root.querySelector("#ltTestTo"), er = root.querySelector("#ltTestErr");
              var list = parseTo(ta.value), msg = "";
              var bad = list.filter(function (x) { return !MAIL_RE.test(x); });
              if (!list.length) msg = "Укажите хотя бы один адрес.";
              else if (bad.length) msg = "Не похоже на адрес: " + bad.slice(0, 3).join(", ") +
                (bad.length > 3 ? " и ещё " + (bad.length - 3) : "") + ".";
              else if (list.length > TEST_MAX) msg = "Не больше " + TEST_MAX + " адресов за раз, сейчас " + list.length + ".";
              er.textContent = msg; er.hidden = !msg;
              if (msg) { ta.setAttribute("aria-invalid", "true"); ta.focus(); return false; }
              ta.removeAttribute("aria-invalid");
              found = list;
              return true;
            } }
        ],
      }).then(function (v) {
        if (v !== "send" || !found) return;
        L.tests = (Array.isArray(L.tests) ? L.tests : []).concat([{ to: found, at: new Date().toISOString() }]).slice(-TEST_KEEP);
        onChange(get(), "test");
        onChange(get(), "msg:Тест отправлен на " + found.length + " " + pluralRu(found.length, ["адрес", "адреса", "адресов"]));
        paintTest();
        var b2 = host.querySelector(".lt-test-btn"); if (b2) b2.focus();
      });
    }

    /* Размер, замечания и (по желанию) живой предпросмотр — без полной
       перерисовки, чтобы не сбивать курсор в редакторе. */
    function paintLive(withFrame) {
      paintTest();
      var size = host.querySelector(".lt-size");
      if (size) {
        var bytes = byteSize(L.html);
        var big = bytes > GMAIL_CLIP;
        size.className = "lt-size" + (big ? " is-warn" : "");
        size.textContent = (bytes / 1024).toFixed(1).replace(".", ",") + " КБ" +
          (big ? " — больше 102 КБ, Gmail обрежет письмо" : "");
      }
      var list = host.querySelector(".lt-lint");
      if (list) {
        var notes = lintHtml(L.html);
        var next = notes.length
          ? notes.map(function (n) {
              return '<li class="lt-lint-i is-' + n.level + '"><b>' +
                (n.level === "error" ? "Ошибка" : "Внимание") + "</b> " + esc(n.text) + "</li>";
            }).join("")
          : '<li class="lt-lint-i is-ok">Замечаний нет</li>';
        /* список озвучивается (aria-live) — трогаем, только если он изменился */
        if (list.getAttribute("data-k") !== next) { list.setAttribute("data-k", next); list.innerHTML = next; }
      }
      var frame = withFrame && host.querySelector(".lt-live");
      if (frame) frame.setAttribute("srcdoc", renderVars(toHtml(L)));
    }

    function btn(kind, val, icon, title, on) {
      return '<button type="button" data-' + kind + '="' + val + '"' + (on ? ' class="is-on"' : "") +
        ' title="' + esc(title) + '"><span class="vh">' + esc(title) + "</span>" + esc(icon) + "</button>";
    }

    /* ---- события ---- */
    host.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t || !t.closest(".lt-var")) closeVarMenus();

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
      if (t.classList.contains("lt-test-btn")) { testDialog(); return; }
      if (t.classList.contains("lt-copy")) { copyCode(t); return; }
      if (t.classList.contains("lt-dl-html")) { downloadHtml(); return; }
      if (t.classList.contains("lt-to-html")) { toHtmlMode(); return; }
      if (t.classList.contains("lt-to-blocks")) { toBlocksMode(); return; }

      if (t.dataset.add) {
        var key = t.dataset.add;
        adder = (adder && adder.key === key) ? null : { key: key };
        draw();
        return;
      }

      if (t.dataset.varmenu) { toggleVarMenu(t); return; }
      if (t.dataset.var) { closeVarMenus(); insertAt(t.dataset.for, "{{" + t.dataset.var + "}}", null); return; }
      if (t.dataset.fmt) { closeVarMenus(); format(t.dataset.for, t.dataset.fmt); return; }

      if (t.dataset.make) { addBlock(t.dataset.make); return; }
      if (t.dataset.clear) { clearField(t); return; }
      if (t.dataset.imgoff) { setField(t.dataset.scope, t.dataset.imgoff, ""); return; }
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
      if (el.classList && el.classList.contains("lt-src")) { srcInput(el); return; }
      if (!el.dataset || !el.dataset.f || !el.dataset.scope) return;

      /* ползунок и цвет отдают значение на каждый шаг — их показываем
         сразу, но перерисовываем только цифру рядом, иначе потеряется
         захват мыши */
      var v = el.type === "range" ? Number(el.value) : el.value;
      apply(el.dataset.scope, el.dataset.f, v);
      if (el.dataset.f === "href") {
        var warn = host.querySelector(".lt-warn");
        if (warn) warn.hidden = !!String(v).trim();
      }

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
      if (el.dataset && el.dataset.img) { uploadImage(el); return; }
      if (!el.dataset || !el.dataset.f || !el.dataset.scope) return;
      if (el.type === "range" || el.type === "color") { draw(); return; }
      apply(el.dataset.scope, el.dataset.f, el.value);
      /* Текст уже на холсте (input → livePaint), а панель от него не
         зависит. Полная перерисовка здесь срабатывала бы на blur — и
         съедала клик по «Ж»/«Переменной» и фокус при Shift+Tab к панели. */
      if (el.tagName === "TEXTAREA") { livePaint(); onChange(get(), "field"); return; }
      commit("field");
    });

    /* Кнопки панели форматирования не забирают фокус у поля: выделение
       остаётся на месте, и ничто не перерисовывается под указателем. */
    host.addEventListener("mousedown", function (e) {
      if (e.target.closest && e.target.closest(".lt-fmt button")) e.preventDefault();
    });

    /* ---- режим HTML ---- */
    function srcInput(el) {
      L.html = el.value;
      onChange(get(), "html");
      paintLive(false);
      clearTimeout(liveTimer);
      liveTimer = setTimeout(function () { paintLive(true); }, 300);
    }

    /* Tab в редакторе кода — отступ, а не уход фокуса. Чтобы клавиатура
       не застревала, Esc «отпускает» следующий Tab. */
    host.addEventListener("keydown", function (e) {
      var ta = e.target;
      if (e.key === "Escape" && ta.closest && ta.closest(".lt-var")) {
        var vb = ta.closest(".lt-var").querySelector(".lt-var-btn");
        closeVarMenus(); vb.focus(); return;
      }
      if (!ta.classList || !ta.classList.contains("lt-src")) return;
      /* Shift/Ctrl/Alt/Meta сами по себе не сбрасывают «отпускание»:
         иначе после Esc не сработал бы Shift+Tab */
      if (/^(Shift|Control|Alt|Meta)$/.test(e.key)) return;
      if (e.key === "Escape") { tabOut = true; return; }
      if (e.key !== "Tab") { tabOut = false; return; }
      if (tabOut) { tabOut = false; return; }
      e.preventDefault();
      var v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
      if (!e.shiftKey) {
        ta.value = v.slice(0, a) + "  " + v.slice(b);
        ta.selectionStart = ta.selectionEnd = a + 2;
      } else {
        var ls = v.lastIndexOf("\n", a - 1) + 1;
        var cut = /^ {1,2}/.exec(v.slice(ls));
        if (!cut) return;
        var n = cut[0].length;
        ta.value = v.slice(0, ls) + v.slice(ls + n);
        ta.selectionStart = Math.max(ls, a - n);
        ta.selectionEnd = Math.max(ls, b - n);
      }
      srcInput(ta);
    });

    /* ---- переменные и форматирование ---- */
    function closeVarMenus() {
      host.querySelectorAll(".lt-var-menu").forEach(function (m) { m.hidden = true; });
      host.querySelectorAll(".lt-var-btn").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    }

    function toggleVarMenu(b) {
      var menu = b.parentNode.querySelector(".lt-var-menu");
      var open = menu.hidden;
      closeVarMenus();
      menu.hidden = !open;
      b.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) menu.querySelector("button").focus();
    }

    /* Вставка в поле на место выделения. sel — что выделить после
       вставки: [от, до] относительно начала вставки; null — курсор в конец. */
    function insertAt(id, text, selAfter, from, to) {
      var ta = document.getElementById(id);
      if (!ta) return;
      var v = ta.value;
      var a = from != null ? from : ta.selectionStart;
      var b = to != null ? to : ta.selectionEnd;
      ta.value = v.slice(0, a) + text + v.slice(b);
      ta.focus();
      ta.selectionStart = a + (selAfter ? selAfter[0] : text.length);
      ta.selectionEnd = a + (selAfter ? selAfter[1] : text.length);
      fieldChanged(ta);
    }

    function fieldChanged(ta) {
      if (ta.classList.contains("lt-src")) { srcInput(ta); return; }
      apply(ta.dataset.scope, ta.dataset.f, ta.value);
      livePaint();
      onChange(get(), "field");
    }

    function format(id, fmt) {
      var ta = document.getElementById(id);
      if (!ta) return;
      var v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
      var picked = v.slice(a, b);
      if (fmt === "b" || fmt === "i") {
        var m = fmt === "b" ? "**" : "_";
        var word = picked || (fmt === "b" ? "жирный" : "курсив");
        insertAt(id, m + word + m, [m.length, m.length + word.length]);
        return;
      }
      if (fmt === "link") {
        var txt = picked || "текст ссылки";
        var link = "[" + txt + "](https://)";
        /* курсор — после «https://», чтобы сразу дописать адрес */
        insertAt(id, link, [link.length - 1, link.length - 1]);
        return;
      }
      if (fmt === "list") {
        var ls = v.lastIndexOf("\n", a - 1) + 1;
        var le = v.indexOf("\n", Math.max(a, b - 1));
        if (le < 0) le = v.length;
        var block = v.slice(ls, le).split("\n").map(function (line) {
          return /^- /.test(line) ? line : "- " + line;
        }).join("\n");
        insertAt(id, block, [0, block.length], ls, le);
      }
    }

    function toHtmlMode() {
      window.AdminDialog.confirm({
        title: "Редактировать как HTML?",
        text: "Письмо превратится в HTML-код. Блоки можно будет вернуть, но правки кода тогда пропадут.",
        ok: "Редактировать как HTML",
      }).then(function (yes) {
        if (!yes) return;
        /* блоки остаются в письме нетронутыми — к ним можно вернуться */
        L.html = toHtml(L);
        L.mode = "html";
        sel = null; adder = null; tab = "style";
        mode = "code";
        commit("mode");
      });
    }

    function toBlocksMode() {
      window.AdminDialog.confirm({
        title: "Вернуться к блокам?",
        text: "Письмо снова соберётся из блоков, а правки HTML-кода пропадут.",
        ok: "Вернуться к блокам",
        danger: true,
      }).then(function (yes) {
        if (!yes) return;
        clearTimeout(liveTimer);
        L.mode = "blocks";
        L.html = "";
        mode = "edit";
        commit("mode");
      });
    }

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

    /* ---- картинка файлом ---- */
    function uploadImage(input) {
      var file = input.files && input.files[0];
      var key = input.dataset.img;
      var scope = input.dataset.scope;
      input.value = "";
      if (!file) return;

      if (!/^image\/(jpeg|png)$/.test(file.type)) {
        onChange(get(), "msg:Поддерживаются только JPG и PNG");
        return;
      }
      if (file.size > IMG_MAX_BYTES) {
        onChange(get(), "msg:Файл весит " + Math.round(file.size / 1024) +
          " Кб — больше допустимых 500 Кб");
        return;
      }

      var fr = new FileReader();
      fr.onerror = function () { onChange(get(), "msg:Не удалось прочитать файл"); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { onChange(get(), "msg:Файл повреждён — это не картинка"); };
        img.onload = function () {
          var packed = shrink(img);
          /* бюджет считаем ДО записи: иначе письмо молча перестанет
             сохраняться, и человек узнает об этом при перезагрузке */
          var probe = JSON.parse(JSON.stringify(L));
          var target = scope === "style" ? probe.style : null;
          if (!target) {
            /* блок ищем по тому же пути, что и в живом письме */
            var arr = probe.blocks, pth = sel || [];
            for (var i = 0; i + 1 < pth.length; i += 2) {
              var b = arr[pth[i]];
              arr = pth[i + 1] === "k" ? b.kids : b.cols[Number(String(pth[i + 1]).slice(1))];
            }
            target = arr[pth[pth.length - 1]];
          }
          if (!target) return;
          target[key] = packed;
          if (JSON.stringify(probe).length > LETTER_BUDGET) {
            onChange(get(), "msg:Письмо стало бы слишком тяжёлым. Удалите одну из картинок " +
              "или возьмите файл полегче");
            return;
          }
          apply(scope, key, packed);
          commit("img");
          onChange(get(), "msg:Картинка загружена");
        };
        img.src = String(fr.result);
      };
      fr.readAsDataURL(file);
    }

    /* Не растим сверх исходника: апскейл только портит картинку
       и раздувает запись. */
    function shrink(img) {
      var w = Math.min(img.naturalWidth || IMG_MAX_W, IMG_MAX_W);
      var h = Math.round(w * (img.naturalHeight || 1) / (img.naturalWidth || 1));
      var cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      var ctx = cv.getContext("2d");
      /* белая подложка: прозрачный PNG иначе ляжет на чёрное */
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return cv.toDataURL("image/jpeg", 0.82);
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
        var ok = parsed && (Array.isArray(parsed.blocks) ||
          (parsed.mode === "html" && typeof parsed.html === "string"));
        if (!ok) {
          onChange(get(), "upload-bad");
          return;
        }
        L = normalize(parsed);
        sel = null;
        tab = "style";
        mode = isHtml() ? "code" : "edit";
        commit("upload");
      };
      fr.readAsText(file);
    }

    /* Файл письма: тот же HTML, что во вкладке «HTML письма». */
    function downloadHtml() {
      var id = typeof opts.id === "function" ? opts.id() : opts.id;
      var name = "pismo-" + (id != null && id !== "" ? String(id).replace(/[^\w.-]+/g, "_") : "shablon") + ".html";
      var blob = new Blob([toHtml(L)], { type: "text/html;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      onChange(get(), "download-html");
    }

    /* Копируем то же, что уходит в файл и в отправку, — toHtml(L), а не
       текст поля: в режиме HTML к нему добавляется строка отписки. */
    function copyCode(btnEl) {
      var text = toHtml(L);
      var done = function (ok) { btnEl.textContent = ok ? "Скопировано" : "Не удалось";
        setTimeout(function () { btnEl.textContent = "Скопировать"; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        return;
      }
      var tmp = document.createElement("textarea");
      tmp.value = text;
      tmp.setAttribute("readonly", "");
      tmp.style.position = "fixed"; tmp.style.left = "-9999px";
      document.body.appendChild(tmp);
      tmp.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
      tmp.remove();
      btnEl.focus();
      done(ok);
    }

    function get() { return JSON.parse(JSON.stringify(L)); }

    draw();

    return {
      get: get,
      html: function () { return toHtml(L); },
      isEmpty: function () { return isHtml() ? !L.html.trim() : !L.blocks.length; },
      set: function (v) {
        L = normalize(v); sel = null; tab = "style";
        if (isHtml()) mode = "code";
        draw();
      },
    };
  }

  window.AdminLetter = {
    create: create,
    toHtml: toHtml,
    lintHtml: lintHtml,
    LINT_RULES: LINT_RULES,
    richText: richText,
    renderVars: renderVars,
    lastTest: lastTest,
    VARS: VARS,
    TYPES: TYPES,
    PALETTE: PALETTE,
    FONTS: FONTS,
  };
})();
