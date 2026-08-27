/* ============================================================
   ТБДТ · Кабинет администратора — раздел «Рефералы»
   Метки партнёров: у каждой своё название, краткое название и
   готовая ссылка для размещения. Ссылка нигде не хранится — она
   собирается из базового адреса виджета и краткого названия:
       <база>?utm_source=<краткое название>
   Иначе при смене адреса виджета половина выданных партнёрам
   ссылок осталась бы со старым адресом и молча вела в никуда.

   Краткое название НЕ вводится руками — оно транслитерируется из
   названия («Школа111» → shkola111, «инструкция» → instruktsiya).
   Это единственное место, где живёт правило транслита, поэтому оно
   же отдаётся наружу: форма показывает будущий slug ещё до
   сохранения, а список проверяет по нему дубликаты.

   Каталог и правило отдаются как window.AdminReferrals — форма
   (referral.html) подключает этот же файл, а не свою копию.
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

  /* ---- транслит ----
     Таблица подобрана под то, как краткие названия выглядят в
     рабочей системе: ц → ts, щ → sch, я → ya. Твёрдый и мягкий
     знак выпадают. Латиница и цифры проходят как есть. */
  var TR = { а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"e", ж:"zh", з:"z",
             и:"i", й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r",
             с:"s", т:"t", у:"u", ф:"f", х:"h", ц:"ts", ч:"ch", ш:"sh",
             щ:"sch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya" };

  function slugify(name) {
    return String(name).toLowerCase().split("").map(function (c) {
      if (TR[c] !== undefined) return TR[c];
      return /[a-z0-9]/.test(c) ? c : "";
    }).join("");
  }

  /* ---- доступ к состоянию ---- */
  function ref() {
    if (!S.REFERRALS) S.REFERRALS = { base: "", items: [] };
    if (!Array.isArray(S.REFERRALS.items)) S.REFERRALS.items = [];
    return S.REFERRALS;
  }

  function linkOf(item, base) {
    var b = (base === undefined ? ref().base : base).trim();
    if (!b || !item.slug) return "";
    /* у адреса может уже быть свой параметр — тогда клеим через & */
    return b + (b.indexOf("?") === -1 ? "?" : "&") + "utm_source=" +
      encodeURIComponent(item.slug);
  }

  function nextId() {
    return ref().items.reduce(function (a, r) { return Math.max(a, r.id); }, 0) + 1;
  }

  /* slug занят другой меткой — ссылки бы совпали и статистика
     склеилась; собственную запись при правке не считаем */
  function slugTaken(slug, exceptId) {
    return ref().items.some(function (r) {
      return r.slug === slug && r.id !== exceptId;
    });
  }

  window.AdminReferrals = {
    slugify: slugify,
    linkOf: linkOf,
    nextId: nextId,
    slugTaken: slugTaken,
    all: function () { return ref().items; },
    base: function () { return ref().base; },
    find: function (id) {
      return ref().items.filter(function (r) { return String(r.id) === String(id); })[0] || null;
    },
    esc: esc,
  };

  /* ---- список (referrals.html) ---- */
  var host = $("#refList");
  if (!host) return;

  /* ---- демо-статистика ----
     Переходов и заказов в состоянии нет и взяться им неоткуда:
     это витрина, а не рабочая система. Числа детерминированы от id,
     чтобы не прыгали при каждом открытии. Состав столбцов сводки
     на снимке не виден — выведен из смысла раздела и требует
     сверки с рабочей системой. */
  function stats(id) {
    var s = (id * 1103515245 + 12345) & 0x7fffffff;
    var nx = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    var clicks = 40 + Math.floor(nx() * 960);
    var orders = Math.floor(clicks * (0.02 + nx() * 0.09));
    var tickets = orders ? orders + Math.floor(nx() * orders * 1.4) : 0;
    return { clicks: clicks, orders: orders, tickets: tickets,
             sum: tickets * (1200 + Math.floor(nx() * 2400)) };
  }

  var nf = new Intl.NumberFormat("ru-RU");
  var showStats = false;
  var pendingDelete = null;   /* id метки, у которой открыт вопрос «удалить?» */

  function rowHtml(r) {
    var link = linkOf(r);
    var acts = pendingDelete === r.id
      ? '<span class="ref-confirm">Удалить?' +
        '<button class="btn btn-mini danger" data-act="delete-yes" type="button">Да</button>' +
        '<button class="btn btn-mini" data-act="delete-no" type="button">Отмена</button></span>'
      : '<button class="rowact" data-act="copy" type="button" title="Скопировать ссылку">' +
          '<span class="vh">Скопировать ссылку</span>⧉</button>' +
        '<button class="rowact" data-act="edit" type="button" title="Изменить">' +
          '<span class="vh">Изменить</span>✎</button>' +
        '<button class="rowact danger" data-act="delete" type="button" title="Удалить">' +
          '<span class="vh">Удалить</span>🗑</button>';

    var st = showStats ? stats(r.id) : null;

    return '<tr data-id="' + r.id + '">' +
      '<td class="ref-id">' + r.id + "</td>" +
      "<td>" + esc(r.name) + "</td>" +
      '<td class="ref-slug">' + esc(r.slug) + "</td>" +
      '<td class="ref-link">' + (link
        ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(link) + "</a>"
        : '<span class="ref-nolink">укажите адрес страницы с виджетом</span>') + "</td>" +
      (st ? '<td class="num">' + nf.format(st.clicks) + "</td>" +
            '<td class="num">' + nf.format(st.orders) + "</td>" +
            '<td class="num">' + nf.format(st.tickets) + "</td>" +
            '<td class="num">' + nf.format(st.sum) + " ₽</td>" +
            '<td class="num">' + (st.clicks ? Math.round(st.orders / st.clicks * 100) : 0) + " %</td>"
          : "") +
      '<td class="acts">' + acts + "</td></tr>";
  }

  function render() {
    var items = ref().items;

    $("#refBase").value = ref().base;
    $("#refStatsBtn").setAttribute("aria-pressed", showStats ? "true" : "false");
    $("#refStatsBtn").classList.toggle("is-on", showStats);

    if (!items.length) {
      host.innerHTML = '<p class="rep-empty">Меток пока нет. Нажмите «Добавить» — ' +
        "и получите готовую ссылку для партнёра.</p>";
      return;
    }

    host.innerHTML =
      '<div class="table-wrap"><table class="dtable ref-table"><thead><tr>' +
      '<th class="ref-id">id</th><th>Название</th><th>Краткое название</th>' +
      "<th>Ссылка для размещения</th>" +
      (showStats
        ? '<th class="num">Переходов</th><th class="num">Заказов</th>' +
          '<th class="num">Билетов</th><th class="num">Сумма</th><th class="num">Конверсия</th>'
        : "") +
      '<th class="acts">Действия</th></tr></thead><tbody>' +
      items.map(rowHtml).join("") + "</tbody></table></div>";
  }

  /* ---- базовый адрес ---- */
  $("#refApply").addEventListener("click", function () {
    var v = $("#refBase").value.trim();
    if (v && !/^https?:\/\/.+/i.test(v)) {
      toast("Адрес должен начинаться с http:// или https://");
      $("#refBase").focus();
      return;
    }
    window.AdminStore.update(function (st) { st.REFERRALS.base = v; });
    render();
    toast(v ? "Ссылки пересобраны" : "Адрес очищен — ссылки не собираются");
  });

  $("#refBase").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); $("#refApply").click(); }
  });

  /* ---- статистика ---- */
  $("#refStatsBtn").addEventListener("click", function () {
    showStats = !showStats;
    render();
  });

  $("#refAdd").addEventListener("click", function () {
    location.href = "referral.html";
  });

  /* ---- действия в строках ---- */
  host.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = Number(btn.closest("tr").dataset.id);
    var act = btn.dataset.act;

    if (act === "edit") { location.href = "referral.html?id=" + id; return; }

    if (act === "delete")     { pendingDelete = id;  render(); return; }
    if (act === "delete-no")  { pendingDelete = null; render(); return; }

    if (act === "delete-yes") {
      var gone = window.AdminReferrals.find(id);
      pendingDelete = null;
      window.AdminStore.update(function (st) {
        st.REFERRALS.items = st.REFERRALS.items.filter(function (r) { return r.id !== id; });
      });
      render();
      toast("Метка «" + (gone ? gone.name : id) + "» удалена");
      return;
    }

    if (act === "copy") {
      var item = window.AdminReferrals.find(id);
      var link = item ? linkOf(item) : "";
      if (!link) { toast("Сначала укажите адрес страницы с виджетом"); return; }
      copy(link);
    }
  });

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast("Ссылка скопирована"); },
        function () { toast("Не удалось скопировать — выделите ссылку вручную"); }
      );
      return;
    }
    /* Clipboard API нет (старый браузер или страница без https) —
       падаем на выделение во временном поле */
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    ta.remove();
    toast(ok ? "Ссылка скопирована" : "Не удалось скопировать — выделите ссылку вручную");
  }

  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* соседняя вкладка изменила метки — перерисуемся */
  window.AdminStore.subscribe(function () { pendingDelete = null; render(); });

  render();
})();
