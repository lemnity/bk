/* ============================================================
   ТБДТ · Кабинет администратора — раздел «Интеграция»
   Счётчики аналитики, произвольный код виджета и справка по
   событиям, которые виджет шлёт в Метрику и GA.

   Значения живут в общем AdminStore (INTEGRATION) — переживают
   перезагрузку и синхронизируются между вкладками, как остальное
   состояние. На экране правится копия: пока не нажали «Сохранить»,
   в хранилище ничего не уходит, иначе полусохранённый счётчик
   уехал бы в соседнюю вкладку прямо во время набора.

   Идентификаторы проверяем по формату. Это не придирка: опечатка
   в счётчике не ломает страницу заметным образом — она просто
   молча не собирает статистику месяцами.
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

  /* ---- поля ----
     hint показывается под полем всегда, err — только при ошибке.
     test(v) получает уже обрезанную строку; пустое поле валидно
     всегда: «счётчик не подключён» — нормальное состояние. */
  var FIELDS = [
    {
      id: "metrika",
      label: "ID счётчика Яндекс Метрики",
      placeholder: "12345678",
      hint: "Номер счётчика из адреса кабинета Метрики — только цифры.",
      err: "Номер счётчика Метрики — это 6–9 цифр без букв и дефисов.",
      test: function (v) { return /^\d{6,9}$/.test(v); },
    },
    {
      id: "ga",
      label: "ID счётчика Google Analytics",
      placeholder: "G-XXXXXXXXXX",
      /* UA-счётчики выключены в 2023-м, но поле оставляем: у старых
         площадок идентификатор до сих пор прописан в этом формате */
      hint: "Формат GA4 — G-XXXXXXXXXX. Старый формат UA-XXXXXXX-X тоже принимается.",
      err: "Ожидается G-XXXXXXXXXX (GA4) или UA-XXXXXXX-X (старый формат).",
      test: function (v) {
        return /^G-[A-Z0-9]{6,12}$/i.test(v) || /^UA-\d{4,10}-\d{1,4}$/.test(v);
      },
    },
    {
      id: "fb",
      label: "ID пикселя Facebook",
      placeholder: "123456789012345",
      hint: "Идентификатор пикселя из Events Manager — 15–16 цифр.",
      err: "Идентификатор пикселя Facebook — это 15–16 цифр.",
      test: function (v) { return /^\d{15,16}$/.test(v); },
    },
    {
      id: "vk",
      label: "ID пикселя VK (только для нового виджета)",
      placeholder: "123456789012345",
      hint: "Старый виджет этот пиксель не отдаёт — событий не будет.",
      err: "Идентификатор пикселя VK — только цифры.",
      test: function (v) { return /^\d{6,20}$/.test(v); },
    },
  ];

  /* ---- события виджета ----
     old — имя, которое виджет слал раньше; на новых площадках его
     уже нет, но в старых целях Метрики оно осталось, поэтому
     показываем оба и старое зачёркиваем. */
  var EVENTS = [
    { act: "Открыл виджет",                          old: "[Listim] open widget",              now: "open_widget" },
    { act: "Открытие экрана выбора места",           old: "",                                  now: "seat_selection" },
    { act: "Выбрал места на схеме",                  old: "[Listim] clicked places on schema", now: "select_seat" },
    { act: "Перешёл на страницу корзины",            old: "[Listim] open basket page",         now: "checkout" },
    { act: "Перешёл на оплату",                      old: "[Listim] clicked pay button",       now: "checkout_buy" },
    { act: "Вернулся на страницу успешной оплаты",   old: "[Listim] visited success page",     now: "success_checkout" },
    /* у этого события нового имени пока нет — на снимке оно единственное
       не зачёркнуто, то есть виджет до сих пор шлёт старое */
    { act: "Вернулся на страницу «оплата не удалась»", old: "",                                now: "[Listim] visited failed page" },
  ];

  /* ---- черновик ----
     Правим копию, а не state: до «Сохранить» хранилище не трогаем. */
  var draft = {};
  function readStore() {
    var src = S.INTEGRATION || {};
    draft = { metrika: src.metrika || "", ga: src.ga || "", fb: src.fb || "",
              vk: src.vk || "", code: src.code || "" };
  }
  readStore();

  /* ---- разметка полей ---- */
  $("#intFields").innerHTML = FIELDS.map(function (f) {
    return '<div class="int-field" data-field="' + esc(f.id) + '">' +
      '<label for="i_' + esc(f.id) + '">' + esc(f.label) + "</label>" +
      '<input id="i_' + esc(f.id) + '" type="text" autocomplete="off" spellcheck="false" ' +
        'placeholder="' + esc(f.placeholder) + '" value="' + esc(draft[f.id]) + '" ' +
        'aria-describedby="h_' + esc(f.id) + '" />' +
      '<p class="int-hint" id="h_' + esc(f.id) + '">' + esc(f.hint) + "</p>" +
      "</div>";
  }).join("");

  /* ---- справка по событиям ---- */
  $("#intEvents").innerHTML =
    '<div class="table-wrap"><table class="dtable int-ev">' +
    "<thead><tr><th>Действие пользователя</th>" +
    "<th>GA Event Action, ID цели Метрики</th></tr></thead><tbody>" +
    EVENTS.map(function (e, i) {
      return "<tr><td>" + (i + 1) + ". " + esc(e.act) + "</td><td>" +
        (e.old ? '<s class="int-ev-old">' + esc(e.old) + "</s>" : "") +
        (e.now ? '<code class="int-ev-now">' + esc(e.now) + "</code>" : "") +
        "</td></tr>";
    }).join("") +
    "</tbody></table></div>";

  /* ---- редактор кода ----
     Нумерация строк — отдельная колонка рядом с textarea: подсветки
     синтаксиса здесь нет и библиотеку ради неё не тянем, а номера
     строк в поле, куда вставляют чужой скрипт, нужны всегда. */
  var code = $("#intCode");
  var gutter = $("#intGutter");
  code.value = draft.code;

  function syncGutter() {
    var n = code.value.split("\n").length;
    var out = "";
    for (var i = 1; i <= n; i++) out += i + "\n";
    gutter.textContent = out;
    gutter.scrollTop = code.scrollTop;
  }

  code.addEventListener("input", function () { draft.code = code.value; syncGutter(); markDirty(); });
  code.addEventListener("scroll", function () { gutter.scrollTop = code.scrollTop; });

  /* Tab внутри поля с кодом должен отбивать отступ, а не уводить
     фокус на кнопку: иначе вставленный скрипт нечем выровнять. */
  code.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    var s = code.selectionStart, t = code.selectionEnd;
    code.value = code.value.slice(0, s) + "  " + code.value.slice(t);
    code.selectionStart = code.selectionEnd = s + 2;
    draft.code = code.value;
    syncGutter();
    markDirty();
  });

  syncGutter();

  /* ---- проверка ---- */
  function validate(showAll) {
    var ok = true;
    FIELDS.forEach(function (f) {
      var box = $('.int-field[data-field="' + f.id + '"]');
      var v = (draft[f.id] || "").trim();
      var bad = v !== "" && !f.test(v);
      if (bad) ok = false;
      /* пока поле не трогали, красным не мигаем: ошибку показываем
         после правки этого поля или после попытки сохранить */
      var show = bad && (showAll || box.dataset.touched === "1");
      box.classList.toggle("is-bad", show);
      var msg = box.querySelector(".int-err");
      if (show && !msg) {
        msg = document.createElement("p");
        msg.className = "int-err";
        msg.setAttribute("role", "alert");
        msg.textContent = f.err;
        box.appendChild(msg);
      } else if (!show && msg) {
        msg.remove();
      }
      $("#i_" + f.id).setAttribute("aria-invalid", show ? "true" : "false");
    });
    return ok;
  }

  $("#intFields").addEventListener("input", function (e) {
    var input = e.target.closest("input[id^='i_']");
    if (!input) return;
    var id = input.id.slice(2);
    draft[id] = input.value;
    input.closest(".int-field").dataset.touched = "1";
    validate(false);
    markDirty();
  });

  /* ---- сохранение ---- */
  var dirty = false;

  function markDirty() {
    if (dirty) return;
    dirty = true;
    $("#intDirty").hidden = false;
  }

  function markClean() {
    dirty = false;
    $("#intDirty").hidden = true;
  }

  function saveAll() {
    if (!validate(true)) {
      toast("Проверьте выделенные поля — счётчик записан не в том формате");
      var bad = $(".int-field.is-bad input");
      if (bad) bad.focus();
      return false;
    }
    window.AdminStore.update(function (st) {
      st.INTEGRATION = {
        /* пробелы по краям — самая частая порча идентификатора при
           копировании из кабинета счётчика, режем их на входе */
        metrika: draft.metrika.trim(),
        ga: draft.ga.trim(),
        fb: draft.fb.trim(),
        vk: draft.vk.trim(),
        code: draft.code,
      };
    });
    markClean();
    return true;
  }

  $("#intSave").addEventListener("click", function () {
    if (saveAll()) toast("Настройки интеграции сохранены");
  });

  $("#intSaveClose").addEventListener("click", function () {
    if (saveAll()) location.href = "admin.html";
  });

  /* уход со страницы с несохранёнными правками — предупреждаем */
  window.addEventListener("beforeunload", function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  /* соседняя вкладка сохранила настройки — подтягиваем, но только
     если здесь ничего не правили: чужое сохранение не должно
     затирать начатый черновик */
  window.AdminStore.subscribe(function () {
    if (dirty) return;
    readStore();
    FIELDS.forEach(function (f) { $("#i_" + f.id).value = draft[f.id]; });
    code.value = draft.code;
    syncGutter();
    validate(false);
  });

  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  validate(false);
})();
