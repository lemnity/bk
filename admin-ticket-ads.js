/* ============================================================
   Технологии творчества · Кабинет администратора — раздел «Реклама на билетах»
   Макеты, которые печатаются на билете: загрузка, привязка к
   представлениям, ссылка и журнал правок.

   Билет бывает двух раскладок, и у каждой своё место под рекламу:
   у вертикального билета — широкая полоса, у горизонтального —
   узкая колонка. Поэтому принимаются ровно две пропорции (см.
   FORMATS). Требования к загрузке и проверка при загрузке берутся
   ИЗ ОДНОГО места: подсказка на экране не может разойтись с тем,
   что модуль на самом деле пропускает.

   Файлового хранилища у витрины нет — картинка живёт в состоянии
   как data-URL. Поэтому загруженный файл пережимается под размер
   билетного макета: 500-килобайтная фотография в base64 занимает
   680 Кб, а весь localStorage — около пяти мегабайт. Перед записью
   место проверяется явно: AdminStore.save() глотает ошибку квоты,
   и без проверки картинка молча пропадала бы при перезагрузке.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var S = window.AdminStore.state;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ------------------------------------------------------------
     Требования к макету
     ------------------------------------------------------------ */
  var MAX_BYTES = 500 * 1024;

  var FORMATS = [
    { id: "v", title: "Для вертикального билета",   label: "вертикальный билет",
      w: 1200, h: 402,  minW: 1000, minH: 335 },
    { id: "h", title: "Для горизонтального билета", label: "горизонтальный билет",
      w: 420,  h: 1120, minW: 210,  minH: 560 },
  ];

  /* пропорцию сверяем с допуском: у реальных макетов после обрезки
     редко получается ровно 1200×402, промах в пиксель — не ошибка */
  var RATIO_TOLERANCE = 0.02;

  function fmtById(id) {
    return FORMATS.filter(function (f) { return f.id === id; })[0] || FORMATS[0];
  }

  function classify(w, h) {
    return FORMATS.filter(function (f) {
      var want = f.w / f.h;
      return Math.abs(w / h - want) / want <= RATIO_TOLERANCE &&
             w >= f.minW && h >= f.minH;
    })[0] || null;
  }

  /* Пропорцию показываем целыми, когда они короткие (4:3), и десятичной
     дробью, когда сокращение даёт бессмыслицу: 1200×402 — это «200:67»,
     из чего человек ничего не поймёт, а «2,99 : 1» читается сразу. */
  function ratioStr(w, h) {
    var g = (function gcd(a, b) { return b ? gcd(b, a % b) : a; })(w, h);
    var a = w / g, b = h / g;
    if (a <= 20 && b <= 20) return a + ":" + b;
    return (w >= h)
      ? (w / h).toFixed(2).replace(".", ",") + " : 1"
      : "1 : " + (h / w).toFixed(2).replace(".", ",");
  }

  function kb(bytes) { return Math.round(bytes / 1024) + " Кб"; }

  /* ------------------------------------------------------------
     Представления, к которым можно привязать макет
     ------------------------------------------------------------ */
  function showList() {
    var seen = {};
    var out = [];
    var push = function (title, hall) {
      if (!title || !hall) return;
      var s = title + " — " + hall;
      if (seen[s]) return;
      seen[s] = true;
      out.push(s);
    };
    (S.EVENTS || []).forEach(function (e) { push(e.title, e.hall); });
    (S.RENTALS || []).forEach(function (r) { if (r.type === "own") push(r.title, r.hall); });
    return out.sort(function (a, b) { return a.localeCompare(b, "ru"); });
  }

  /* ------------------------------------------------------------
     Состояние
     ------------------------------------------------------------ */
  function ads() {
    if (!S.TICKET_ADS) S.TICKET_ADS = { log: [], items: [] };
    if (!Array.isArray(S.TICKET_ADS.items)) S.TICKET_ADS.items = [];
    if (!Array.isArray(S.TICKET_ADS.log)) S.TICKET_ADS.log = [];
    return S.TICKET_ADS;
  }

  function find(id) {
    return ads().items.filter(function (a) { return a.id === id; })[0] || null;
  }

  var LOG_CAP = 200;   /* журнал не должен съедать место, отведённое макетам */

  function log(what) {
    ads().log.unshift({ at: new Date().toISOString(), what: what });
    ads().log.length = Math.min(ads().log.length, LOG_CAP);
  }

  /* ---- квота ----
     AdminStore.save() гасит исключение, поэтому спрашиваем место
     заранее: пишем предполагаемое состояние во временный ключ. */
  var PROBE = "tbdt_admin_v1:probe";

  function roomFor(mutate) {
    var next;
    try {
      next = JSON.parse(JSON.stringify(S));
    } catch (_) { return true; }
    try { mutate(next); } catch (_) { return true; }
    try {
      localStorage.setItem(PROBE, JSON.stringify(next));
      localStorage.removeItem(PROBE);
      return true;
    } catch (_) {
      try { localStorage.removeItem(PROBE); } catch (__) {}
      return false;
    }
  }

  /* ------------------------------------------------------------
     Загрузка
     ------------------------------------------------------------ */
  var fileEl = $("#adFile");

  function uploadErr(msg) {
    var box = $("#adUploadErr");
    box.innerHTML = msg || "";
    box.hidden = !msg;
  }

  function measure(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("broken")); };
      img.src = dataUrl;
    });
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result)); };
      fr.onerror = function () { reject(new Error("read")); };
      fr.readAsDataURL(file);
    });
  }

  /* Пережимаем под билетный макет. Больше канонического размера
     не растим — апскейл только портит картинку и раздувает запись. */
  function repack(img, fmt) {
    var w = Math.min(img.naturalWidth, fmt.w);
    var h = Math.round(w * fmt.h / fmt.w);
    var cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    var ctx = cv.getContext("2d");
    /* белая подложка: на билете печатают по бумаге, и прозрачный
       PNG иначе лёг бы на чёрное */
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { src: cv.toDataURL("image/jpeg", 0.82), w: w, h: h };
  }

  function mismatch(w, h) {
    return "Макет " + w + "×" + h + " (" + ratioStr(w, h) + ") не подходит ни под одну " +
      "раскладку билета.<br>" + FORMATS.map(function (f) {
        return "· " + f.title.toLowerCase() + " — " + f.w + "×" + f.h +
          " или та же пропорция " + ratioStr(f.w, f.h) +
          ", но не меньше " + f.minW + "×" + f.minH;
      }).join("<br>");
  }

  function addImage() {
    uploadErr("");
    var file = fileEl.files && fileEl.files[0];

    if (!file) { uploadErr("Сначала выберите файл."); return; }
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      uploadErr("Поддерживаются только JPG и PNG. Выбран файл типа «" +
        esc(file.type || "неизвестный") + "».");
      return;
    }
    if (file.size > MAX_BYTES) {
      uploadErr("Файл весит " + kb(file.size) + " — больше допустимых 500 Кб.");
      return;
    }

    readFile(file).then(measure).then(function (img) {
      var w = img.naturalWidth, h = img.naturalHeight;
      var fmt = classify(w, h);
      if (!fmt) { uploadErr(mismatch(w, h)); return; }

      var packed = repack(img, fmt);
      var id = ads().items.reduce(function (a, x) { return Math.max(a, x.id); }, 0) + 1;
      var item = { id: id, kind: fmt.id, w: packed.w, h: packed.h, src: packed.src,
                   forShows: false, shows: [], link: "" };

      if (!roomFor(function (n) { n.TICKET_ADS.items.unshift(item); })) {
        uploadErr("В хранилище браузера не осталось места под ещё один макет. " +
          "Удалите ненужные изображения и повторите загрузку.");
        return;
      }

      window.AdminStore.update(function () {
        ads().items.unshift(item);
        log("Добавлено изображение Id: " + id);
      });
      fileEl.value = "";
      render();
      toast("Изображение добавлено · Id: " + id);
    }).catch(function () {
      uploadErr("Не удалось прочитать файл — возможно, он повреждён.");
    });
  }

  /* ------------------------------------------------------------
     Сетка
     ------------------------------------------------------------ */
  var filter = "all";        /* all | common | shows */
  var pendingDelete = null;  /* id макета с открытым вопросом «удалить?» */

  function matches(a) {
    if (filter === "common") return !a.forShows;
    if (filter === "shows")  return !!a.forShows;
    return true;
  }

  function chipsHtml(a) {
    var all = showList();
    var free = all.filter(function (s) { return a.shows.indexOf(s) === -1; });

    var chips = a.shows.map(function (s) {
      return '<span class="ad-chip">' + esc(s) +
        '<button type="button" data-act="unpin" data-show="' + esc(s) + '" ' +
        'title="Убрать представление"><span class="vh">Убрать ' + esc(s) + '</span>×</button></span>';
    }).join("");

    /* Отмеченный флажок без единого представления — тихая поломка:
       макет никуда не попадёт. Говорим об этом прямо. */
    var warn = a.forShows && !a.shows.length
      ? '<p class="ad-warn">Не выбрано ни одного представления — макет не попадёт ни на один билет.</p>'
      : "";

    var picker = free.length
      ? '<select class="ad-pick" data-act="pin"' + (a.forShows ? "" : " disabled") +
        ' aria-label="Добавить представление"><option value="">+ добавить представление</option>' +
        free.map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("") + "</select>"
      : '<p class="ad-warn">Все представления уже выбраны.</p>';

    return '<div class="ad-shows' + (a.forShows ? "" : " is-off") + '">' +
      (chips ? '<div class="ad-chips">' + chips + "</div>" : "") + warn + picker + "</div>";
  }

  function cardHtml(a) {
    var f = fmtById(a.kind);
    var foot = pendingDelete === a.id
      ? '<span class="ad-confirm">Удалить?' +
        '<button class="btn-mini danger" data-act="del-yes" type="button">Да</button>' +
        '<button class="btn-mini" data-act="del-no" type="button">Отмена</button></span>'
      : '<button class="btn btn-plain ad-del" data-act="del" type="button">Удалить</button>';

    return '<article class="ad-card" data-id="' + a.id + '">' +
      '<p class="ad-cap">Id: ' + a.id +
        ' <span class="ad-cap-x">· ' + esc(f.label) + ' · ' + a.w + "×" + a.h + "</span></p>" +
      '<div class="ad-shot ad-shot-' + esc(a.kind) + '">' +
        '<img src="' + esc(a.src) + '" alt="Макет рекламы ' + a.w + "×" + a.h +
        ", " + esc(f.label) + '" loading="lazy" /></div>' +
      '<label class="ad-check"><input type="checkbox" data-act="mode"' +
        (a.forShows ? " checked" : "") + " /><span>только для представлений</span></label>" +
      chipsHtml(a) +
      '<label class="ad-link"><span>Ссылка для рекламы</span>' +
        '<input type="url" data-act="link" inputmode="url" autocomplete="off" spellcheck="false" ' +
        'placeholder="https://example.com" value="' + esc(a.link || "") + '" /></label>' +
      '<p class="ad-err" data-err hidden></p>' +
      '<div class="ad-foot">' + foot + "</div></article>";
  }

  function render() {
    var items = ads().items.filter(matches);
    var host = $("#adGrid");

    [].forEach.call(document.querySelectorAll("#adFilter input"), function (r) {
      r.checked = r.value === filter;
    });

    if (!items.length) {
      host.innerHTML = '<p class="rep-empty">' + (ads().items.length
        ? "В этой группе макетов нет. Смените фильтр над сеткой."
        : "Макетов пока нет. Загрузите первое изображение — форма выше.") + "</p>";
      return;
    }
    host.innerHTML = '<div class="ad-grid">' + items.map(cardHtml).join("") + "</div>";
  }

  function recard(id) {
    var a = find(id);
    var el = document.querySelector('.ad-card[data-id="' + id + '"]');
    /* карточка могла выпасть из текущего фильтра — тогда перерисуем всё */
    if (!a || !el || !matches(a)) { render(); return; }
    el.outerHTML = cardHtml(a);
  }

  /* ------------------------------------------------------------
     Правки в карточках
     ------------------------------------------------------------ */
  function cardErr(el, msg) {
    var box = el.querySelector("[data-err]");
    box.textContent = msg || "";
    box.hidden = !msg;
    el.querySelector('[data-act="link"]').classList.toggle("is-bad", !!msg);
  }

  var grid = $("#adGrid");

  grid.addEventListener("change", function (e) {
    var el = e.target.closest(".ad-card");
    if (!el) return;
    var id = Number(el.dataset.id);
    var act = e.target.dataset.act;

    if (act === "mode") {
      var on = e.target.checked;
      window.AdminStore.update(function () {
        var a = find(id);
        if (a) a.forShows = on;
        log("Id: " + id + " — " + (on ? "только для представлений" : "общая реклама"));
      });
      recard(id);
      return;
    }

    if (act === "pin") {
      var show = e.target.value;
      if (!show) return;
      window.AdminStore.update(function () {
        var a = find(id);
        if (a && a.shows.indexOf(show) === -1) a.shows.push(show);
        log("Id: " + id + " — добавлено представление «" + show + "»");
      });
      recard(id);
      return;
    }

    if (act === "link") saveLink(el, id);
  });

  /* Ссылку пишем по уходу из поля, а не на каждый символ: иначе
     перерисовка соседней вкладки прилетала бы прямо во время набора. */
  grid.addEventListener("blur", function (e) {
    if (e.target.dataset && e.target.dataset.act === "link") {
      saveLink(e.target.closest(".ad-card"), Number(e.target.closest(".ad-card").dataset.id));
    }
  }, true);

  function saveLink(el, id) {
    var input = el.querySelector('[data-act="link"]');
    var v = input.value.trim();
    var a = find(id);
    if (!a) return;

    if (v && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(v)) {
      cardErr(el, "Ссылка должна начинаться с http:// или https://");
      return;
    }
    cardErr(el, "");
    if (v === (a.link || "")) return;

    window.AdminStore.update(function () {
      var t = find(id);
      if (t) t.link = v;
      log("Id: " + id + " — " + (v ? "изменена ссылка" : "ссылка убрана"));
    });
    toast(v ? "Ссылка сохранена" : "Ссылка убрана");
  }

  grid.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn || btn.tagName === "INPUT" || btn.tagName === "SELECT") return;
    var el = btn.closest(".ad-card");
    if (!el) return;
    var id = Number(el.dataset.id);
    var act = btn.dataset.act;

    if (act === "unpin") {
      var show = btn.dataset.show;
      window.AdminStore.update(function () {
        var a = find(id);
        if (a) a.shows = a.shows.filter(function (s) { return s !== show; });
        log("Id: " + id + " — убрано представление «" + show + "»");
      });
      recard(id);
      return;
    }

    if (act === "del")     { pendingDelete = id;   recard(id); return; }
    if (act === "del-no")  { pendingDelete = null; recard(id); return; }

    if (act === "del-yes") {
      pendingDelete = null;
      window.AdminStore.update(function () {
        ads().items = ads().items.filter(function (a) { return a.id !== id; });
        log("Удалено изображение Id: " + id);
      });
      render();
      toast("Изображение Id: " + id + " удалено");
    }
  });

  /* ------------------------------------------------------------
     Фильтр, логи, загрузка
     ------------------------------------------------------------ */
  $("#adFilter").addEventListener("change", function (e) {
    if (!e.target.name) return;
    filter = e.target.value;
    pendingDelete = null;
    render();
  });

  $("#adAdd").addEventListener("click", addImage);
  fileEl.addEventListener("change", function () { uploadErr(""); });

  function renderLogs() {
    var rows = ads().log;
    $("#adLogCount").textContent = rows.length
      ? rows.length + " " + plural(rows.length, ["запись", "записи", "записей"]) : "";
    $("#adLogs").innerHTML = rows.length
      ? '<div class="table-wrap"><table class="dtable ad-log"><thead><tr>' +
        "<th>Когда</th><th>Что</th></tr></thead><tbody>" +
        rows.map(function (r) {
          return '<tr><td class="ad-log-at">' + esc(when(r.at)) + "</td><td>" + esc(r.what) + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : '<p class="rep-empty">Журнал пуст.</p>';
  }

  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function plural(n, forms) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  }

  $("#adLogsBtn").addEventListener("click", function () {
    var wrap = $("#adLogsWrap");
    var open = wrap.hidden;
    wrap.hidden = !open;
    this.setAttribute("aria-expanded", open ? "true" : "false");
    this.classList.toggle("is-on", open);
    if (open) { renderLogs(); wrap.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  });

  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---- требования к макету печатаем из FORMATS ---- */
  $("#adSpecs").innerHTML = FORMATS.map(function (f) {
    return '<div class="ad-spec"><p class="ad-spec-t">' + esc(f.title) + "</p>" +
      "<p>Ширина: " + f.w + "px · Высота: " + f.h + "px</p>" +
      '<p class="ad-spec-x">(либо пропорциональное соотношение сторон, минимально ' +
      f.minW + "×" + f.minH + ")</p></div>";
  }).join("");

  /* соседняя вкладка изменила макеты — перерисуемся */
  window.AdminStore.subscribe(function () {
    pendingDelete = null;
    render();
    if (!$("#adLogsWrap").hidden) renderLogs();
  });

  render();
})();
