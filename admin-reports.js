/* ============================================================
   ТБДТ · Кабинет администратора — раздел «Отчёты»
   Каталог отчётов: избранное сверху, фильтр по типу, поиск и
   сгруппированный список. Избранное живёт в общем AdminStore
   (REPORT_FAVS) — переживает перезагрузку и синхронизируется
   между вкладками через BroadcastChannel, как остальное состояние.

   Новый отчёт = одна строка в CATALOG. Номер («№» в таблице) —
   это ИДЕНТИФИКАТОР, а не порядковый счётчик: он нештатный
   («3а», «55-А», «120-1М»), задан извне и совпадать с позицией
   в массиве не обязан. По нему же хранится избранное и по нему же
   страница формирования отчёта находит себя (report.html?no=…).

   Каталог отдаётся наружу как window.AdminReports — страница
   формирования переиспользует ЕГО, а не свою копию: иначе список
   и заголовок отчёта разъедутся при первом же переименовании.
   ============================================================ */
(function () {
  "use strict";

  var S = window.AdminStore.state;

  var CATS = [
    { id: "all",     label: "Все"       },
    { id: "general", label: "Общие"     },
    { id: "cash",    label: "Кассовые"  },
    { id: "museum",  label: "Музейные"  },
    { id: "new",     label: "Новые"     },
    { id: "orders",  label: "Приказы"   },
  ];

  /* pk:true — отчёт помечен в графе «Информация» (программа
     «Пушкинская карта»): в исходном каталоге такие строки выделены. */
  var CATALOG = [
    /* ---------------------------- Общие ---------------------------- */
    { no: "1",    cat: "general", name: "Мероприятия" },
    { no: "2",    cat: "general", name: "Репертуар" },
    { no: "3",    cat: "general", name: "Отчёт о продаже билетов по мероприятию (PPr2)" },
    { no: "3а",   cat: "general", name: "Отчёт о продаже билетов по мероприятию (PPr2) с разбивкой оплаты в кассе по типам", pk: true },
    { no: "4",    cat: "general", name: "Отчёт о продаже билетов по мероприятиям (РРО) с разбивкой оплаты в кассе по типам" },
    { no: "4а",   cat: "general", name: "Отчёт о продаже билетов на события за период (РРО)", pk: true },
    { no: "5",    cat: "general", name: "Отчёт о продаже билетов по дате операции (РРО)" },
    { no: "5w",   cat: "general", name: "Сводный отчёт по продаже билетов на события за период" },
    { no: "6",    cat: "general", name: "Отчёт о продаже билетов за период (РРУТ)", pk: true },
    { no: "7",    cat: "general", name: "Сводный отчёт по реализации билетов за период (БСО)" },
    { no: "8",    cat: "general", name: "Отчёт о продаже билетов уполномоченными (RS)" },
    { no: "11",   cat: "general", name: "Отчёт о продаже билетов через уполномоченных по датам мероприятий" },
    { no: "12",   cat: "general", name: "Отчёт о выдаче билетов уполномоченным" },
    { no: "14",   cat: "general", name: "Общий отчёт об оплате билетов через Интернет" },
    { no: "15",   cat: "general", name: "Отчёт по мероприятиям" },
    { no: "15а",  cat: "general", name: "Отчёт по мероприятиям" },
    { no: "16",   cat: "general", name: "Отчёт о передаче корешков билетов" },
    { no: "18",   cat: "general", name: "Отчёт о продажах по мероприятиям за период (РУТ) без группировки по мероприятиям" },
    { no: "26",   cat: "general", name: "Реализация мест выдачи по датам" },
    { no: "28",   cat: "general", name: "Авторские отчисления" },
    { no: "32",   cat: "general", name: "Сводный отчёт по реализованным и забронированным местам на мероприятие" },
    { no: "32а",  cat: "general", name: "Сводный отчёт по реализованным и забронированным местам с группировкой по представлениям" },
    { no: "33",   cat: "general", name: "Отчёт по реализации билетов на мероприятие" },
    { no: "36",   cat: "general", name: "Отчёт о продаже билетов через уполномоченных по датам продажи" },
    { no: "41",   cat: "general", name: "Отчёт о переоценке мест" },
    { no: "42",   cat: "general", name: "Агентский по распространителям и датам мероприятий (упрощённый)" },
    { no: "42а",  cat: "general", name: "Агентский по распространителям и датам мероприятий" },
    { no: "42b",  cat: "general", name: "Агентский по дате события с группировкой по заказам" },
    { no: "43",   cat: "general", name: "Отчёт о продаже билетов на мероприятия по группам продаж" },
    { no: "44",   cat: "general", name: "Отчёт о продаже билетов по датам продажи" },
    { no: "45",   cat: "general", name: "Сводный отчёт о реализации билетов на мероприятия льготных категорий покупателей (со скидками) за период (БСО)" },
    { no: "47",   cat: "general", name: "Сводный отчёт по скидкам на мероприятия (БСО)" },
    { no: "48",   cat: "general", name: "Агентский по шлюзам с возвратами" },
    { no: "49",   cat: "general", name: "Накладная на выдачу и возврат по шлюзам" },
    { no: "49а",  cat: "general", name: "Накладная на выдачу и возврат по шлюзам" },
    { no: "49б",  cat: "general", name: "Накладная на выдачу по событию (без возвратов)" },
    { no: "49в",  cat: "general", name: "Отчёт по продажам шлюзовых партнёров" },
    { no: "50",   cat: "general", name: "Отчёт о продаже билетов с использованием промокода" },
    { no: "51",   cat: "general", name: "Агентский отчёт о продаже билетов через агрегатор" },
    { no: "52",   cat: "general", name: "Отчёт по дате продажи" },
    { no: "53",   cat: "general", name: "Агентский по дате продажи с группировкой по событию" },
    { no: "53b",  cat: "general", name: "Продажа товаров по дате операции (группировка по заказам и товарам)" },
    { no: "55-А", cat: "general", name: "Отчёт по заказам за период" },
    { no: "55-Б", cat: "general", name: "Сумма продаж по категориям условных скидок" },
    { no: "56",   cat: "general", name: "Отчёт о балансе распространителей" },
    { no: "58",   cat: "general", name: "Отчёт о мероприятиях с забронированными местами" },
    { no: "59",   cat: "general", name: "Отчёт о мероприятиях для РАО" },
    { no: "60",   cat: "general", name: "Приказ о перемещении мест" },
    { no: "60W",  cat: "general", name: "Приказ о перемещении мест" },
    { no: "61",   cat: "general", name: "Отчёт о проведённых операциях для 1С" },
    { no: "63",   cat: "general", name: "Приказ о расстановке и расценке мест на дополнительных спектаклях (№120)" },
    { no: "63а",  cat: "general", name: "Агентский по дате продажи с группировкой по заказам" },
    { no: "67",   cat: "general", name: "Приказ о расстановке и расценке мест на спектакли (№121)" },
    { no: "68",   cat: "general", name: "Отчёт об утверждении аналитической стоимости (№121)" },
    { no: "68М",  cat: "general", name: "Приказ об утверждении аналитической стоимости (№121)" },
    { no: "69",   cat: "general", name: "Сводный отчёт о реализации билетов на мероприятия (со скидками) за период (модифицированный ФХО)" },
    { no: "70",   cat: "general", name: "Сводный отчёт о реализации билетов на мероприятия по группам реализаторов (ФХИ-3)" },
    { no: "71",   cat: "general", name: "Сводный отчёт для руководства (Ф-43)" },
    { no: "73",   cat: "general", name: "Отчёт по реализации ПДО" },
    { no: "82",   cat: "general", name: "Аналитика стоимости мероприятий за период" },
    { no: "83",   cat: "general", name: "Отчёт о продаже билетов" },
    { no: "84",   cat: "general", name: "Отчёт о продаже билетов" },
    { no: "86",   cat: "general", name: "Отчёт о контроле по мероприятиям (nO)" },
    { no: "90",   cat: "general", name: "Отчёт детализации по продажам и возвратам кассиров и агентов" },
    { no: "91",   cat: "general", name: "Отчёт по способам оплаты продажи билетов на мероприятия" },
    { no: "92",   cat: "general", name: "Отчёт о непроданных местах" },
    { no: "106",  cat: "general", name: "Отчёт по балансу продаж агентов на дату операции" },
    { no: "107",  cat: "general", name: "Отчёт о продаже агентами билетов на мероприятия по периоду продаж" },
    { no: "109",  cat: "general", name: "Ежедневный отчёт по продажам" },
    { no: "110",  cat: "general", name: "Сводный отчёт о продаже билетов на событие" },
    { no: "112",  cat: "general", name: "Сводный отчёт о продаже билетов с группировкой по событию" },
    { no: "113",  cat: "general", name: "Отчёт по продажам билетов по мероприятиям" },
    { no: "114",  cat: "general", name: "Отчёт по каналам продажи" },
    { no: "116",  cat: "general", name: "Транзакционный отчёт" },
    { no: "118",  cat: "general", name: "Отчёт для 1С новый" },
    { no: "119",  cat: "general", name: "Отчёт по проданным билетам в рамках программы «Пушкинская карта»", pk: true },
    { no: "121",  cat: "general", name: "Возвращённые места за период" },
    { no: "122",  cat: "general", name: "Отчёт по применённым промокодам за период" },
    { no: "202",  cat: "general", name: "Отчёт по сумме промокода" },
    { no: "204",  cat: "general", name: "Отчёт о мероприятиях для РАО (форма 3024)" },
    { no: "205",  cat: "general", name: "Отчёт об использованных стандартах" },
    { no: "206",  cat: "general", name: "Отчёт работника по экскурсионной нагрузке" },
    { no: "207",  cat: "general", name: "Персональный развёрнутый отчёт по экскурсионной нагрузке" },
    { no: "208",  cat: "general", name: "Отчёт по событиям" },
    { no: "209",  cat: "general", name: "Отчёт о продаже билетов" },
    { no: "210",  cat: "general", name: "Отчёт по проводкам за период" },
    { no: "212",  cat: "general", name: "Отчёт по перемещённым сборам" },
    { no: "213",  cat: "general", name: "Отчёт по мероприятиям для РАО за период" },
    { no: "214",  cat: "general", name: "Отчёт для ТСО" },
    { no: "215",  cat: "general", name: "Отчёт по работе с бланками" },
    { no: "216",  cat: "general", name: "Сводный отчёт о реализации билетов по промокодам" },
    { no: "217",  cat: "general", name: "Реализация билетной кассы" },
    { no: "219",  cat: "general", name: "Приложение к отчёту о мероприятиях о передаче билетных бланков" },
    { no: "221",  cat: "general", name: "Приложение к сводному отчёту о реализации билетов на мероприятия по месту нахождения" },

    /* -------------------------- Кассовые --------------------------- */
    { no: "9",    cat: "cash", name: "Реестр по передаче корешков билетов (RLD) (объединение с 3Бшм)" },
    { no: "10",   cat: "cash", name: "Кассовый отчёт о продаже билетов" },
    { no: "19",   cat: "cash", name: "Сводный кассовый отчёт о продаже билетов" },
    { no: "20",   cat: "cash", name: "Отчёт о проведённых операциях" },
    { no: "21",   cat: "cash", name: "Список билетов" },
    { no: "22",   cat: "cash", name: "Список билетов" },
    { no: "23",   cat: "cash", name: "Отчёт по билетным бланкам" },
    { no: "25",   cat: "cash", name: "Акт на уничтожение испорченных бланков" },
    { no: "26к",  cat: "cash", name: "Акт на уничтожение проданных бланков за период" },
    { no: "27",   cat: "cash", name: "Акт на уничтожение проданных бланков за период" },
    { no: "29",   cat: "cash", name: "Список билетов (группировка по заказам)" },
    { no: "30",   cat: "cash", name: "Кассовый отчёт о продаже билетов по заказам" },
    { no: "31",   cat: "cash", name: "Кассовый отчёт о продаже билетов по банковским картам" },
    { no: "32к",  cat: "cash", name: "Кассовый отчёт о продаже билетов за период" },
    { no: "35",   cat: "cash", name: "Отчёт по использованным бланкам (БО)" },
    { no: "37",   cat: "cash", name: "Отчёт по использованным бланкам (БО)" },
    { no: "38",   cat: "cash", name: "Кассовый отчёт о продаже билетов по ценам КЗ" },
    { no: "39",   cat: "cash", name: "Журнал операций с билетами за мероприятие" },
    { no: "40",   cat: "cash", name: "Отчёт по использованным строкам" },
    { no: "47к",  cat: "cash", name: "Список билетных бланков, выданных на мероприятия" },
    { no: "54",   cat: "cash", name: "Совмещённый отчёт кассира" },
    { no: "62",   cat: "cash", name: "Отчёт для бухгалтерии о продаже билетов кассирами театра (609)" },
    { no: "64",   cat: "cash", name: "Кассовый отчёт о продаже через Интернет билетов по БСО" },
    { no: "65",   cat: "cash", name: "Сводный отчёт по каналам билетных бланков" },
    { no: "66",   cat: "cash", name: "Кассовый отчёт (расширенный)", pk: true },
    { no: "66М",  cat: "cash", name: "Кассовый отчёт (расширенный)", pk: true },
    { no: "85",   cat: "cash", name: "Детальный отчёт по продажам" },
    { no: "87",   cat: "cash", name: "Отчёт об использовании арендных бланков (№1)" },
    { no: "91к",  cat: "cash", name: "Отчёт по продаже билетов кассирами за период" },
    { no: "218",  cat: "cash", name: "Справка о продаже билетов кассирами за период" },

    /* -------------------------- Музейные --------------------------- */
    { no: "73м",  cat: "museum", name: "Отчёт по мероприятиям (Музей)" },
    { no: "74",   cat: "museum", name: "Отчёт по событиям (Музей)" },
    { no: "75",   cat: "museum", name: "Отчёт по бронированию билетов (Музей)" },
    { no: "76",   cat: "museum", name: "Отчёт по проданным билетам групп отчётности (Музей)" },
    { no: "77",   cat: "museum", name: "Справка об отработанном времени экскурсоводами (Музей)" },
    { no: "78",   cat: "museum", name: "Отчёт об объекте посещения (Музей)" },
    { no: "79",   cat: "museum", name: "Отчёт по посещаемости (Музей)" },
    { no: "80",   cat: "museum", name: "Справка об отработанном времени экскурсоводами (Музей)" },
    { no: "81",   cat: "museum", name: "Отчёт по количеству посетителей (Музей)" },
    { no: "88",   cat: "museum", name: "Отчёт по категориям мероприятий (Музей) в НК" },
    { no: "89",   cat: "museum", name: "Отчёт по экскурсионной нагрузке" },
    { no: "202м", cat: "museum", name: "Персональный развёрнутый отчёт по экскурсионной нагрузке" },
    { no: "203",  cat: "museum", name: "Отчёт работника по экскурсионной нагрузке" },

    /* ---------------------------- Новые ---------------------------- */
    { no: "101",  cat: "new", name: "Новый отчёт с разбивкой по ценам" },
    { no: "102",  cat: "new", name: "Новый отчёт с разбивкой по секторам" },
    { no: "103",  cat: "new", name: "Новый отчёт с разбивкой по секторам и ценам" },
    { no: "104",  cat: "new", name: "Новый отчёт с разбивкой по секторам и дням по событию" },
    { no: "104М", cat: "new", name: "По продажам подарочных сертификатов" },
    { no: "105",  cat: "new", name: "Новый отчёт с разбивкой по дням" },
    { no: "108",  cat: "new", name: "Новый отчёт с разбивкой по акциям" },
    { no: "111",  cat: "new", name: "Новый отчёт с разбивкой по мероприятиям" },
    { no: "118н", cat: "new", name: "Динамика продаж билетов по событиям и мероприятиям" },

    /* --------------------------- Приказы --------------------------- */
    { no: "120-Р",  cat: "orders", name: "Приказ о расстановке новый" },
    { no: "120-1М", cat: "orders", name: "Приказ о расстановке новый (только по оплаченным)" },
    { no: "120-2",  cat: "orders", name: "Приказ о расстановке новый" },
    { no: "120-2М", cat: "orders", name: "Приказ о расстановке новый (только по оплаченным)" },
    { no: "149",    cat: "orders", name: "Приказ о расценке новый" },
    { no: "152",    cat: "orders", name: "Приказ об изменении стоимости билетов" },
    { no: "152-2",  cat: "orders", name: "Служебная записка об изменении стоимости билетов" },
  ];

  var $ = function (s, r) { return (r || document).querySelector(s); };

  var state = { cat: "all", q: "" };

  /* ---- избранное ---- */
  function favs() { return Array.isArray(S.REPORT_FAVS) ? S.REPORT_FAVS : []; }
  function isFav(no) { return favs().indexOf(no) !== -1; }
  function toggleFav(no) {
    window.AdminStore.update(function (s) {
      var list = Array.isArray(s.REPORT_FAVS) ? s.REPORT_FAVS.slice() : [];
      var i = list.indexOf(no);
      if (i === -1) list.push(no); else list.splice(i, 1);
      s.REPORT_FAVS = list;
    });
    render();
    toast(isFav(no) ? "Добавлено в избранное" : "Убрано из избранного");
  }

  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---- разметка строки ---- */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function rowHtml(r) {
    var fav = isFav(r.no);
    return '<tr data-no="' + esc(r.no) + '">' +
      '<td class="rep-no">' + esc(r.no) + "</td>" +
      '<td class="rep-name"><a class="rep-link" href="report.html?no=' +
        encodeURIComponent(r.no) + '">' + esc(r.name) + "</a></td>" +
      '<td class="rep-info">' + (r.pk ? '<span class="rep-pk" title="Программа «Пушкинская карта»">ПК</span>' : "") + "</td>" +
      '<td class="acts">' +
        '<button class="rowact rep-star' + (fav ? " is-fav" : "") + '" data-act="fav" type="button" ' +
          'aria-pressed="' + (fav ? "true" : "false") + '" ' +
          'title="' + (fav ? "Убрать из избранного" : "В избранное") + '">' +
          '<span class="vh">' + (fav ? "Убрать из избранного" : "В избранное") + "</span>★</button>" +
        '<button class="rowact" data-act="open" type="button" title="Сформировать отчёт">' +
          '<span class="vh">Сформировать отчёт</span>▷</button>' +
        '<button class="rowact" data-act="export" type="button" title="Выгрузить">' +
          '<span class="vh">Выгрузить</span>↓</button>' +
        '<button class="rowact" data-act="setup" type="button" title="Настроить">' +
          '<span class="vh">Настроить</span>⚙</button>' +
      "</td></tr>";
  }

  function tableHtml(rows) {
    return '<div class="table-wrap"><table class="dtable reports-table">' +
      "<thead><tr><th>№</th><th>Название отчёта</th><th>Информация</th><th class=\"acts\">Действия</th></tr></thead>" +
      "<tbody>" + rows.map(rowHtml).join("") + "</tbody></table></div>";
  }

  function matches(r) {
    if (state.cat !== "all" && r.cat !== state.cat) return false;
    if (!state.q) return true;
    var q = state.q.toLowerCase();
    return r.name.toLowerCase().indexOf(q) !== -1 || r.no.toLowerCase().indexOf(q) !== -1;
  }

  function render() {
    /* избранные — в порядке каталога, а не в порядке добавления:
       так список не «прыгает» при снятии и повторной установке звезды */
    var favRows = CATALOG.filter(function (r) { return isFav(r.no); });
    var favWrap = $("#repFav");
    if (!favWrap) return;
    favWrap.innerHTML = favRows.length
      ? tableHtml(favRows)
      : '<p class="rep-empty">Избранных отчётов пока нет. Отметьте звёздочкой нужные — они закрепятся здесь.</p>';
    $("#repFavCount").textContent = favRows.length
      ? favRows.length + " " + plural(favRows.length, ["отчёт", "отчёта", "отчётов"])
      : "";

    var shown = CATALOG.filter(matches);
    var host = $("#repList");

    if (!shown.length) {
      host.innerHTML = '<p class="rep-empty">Ничего не найдено. Измените запрос или выберите другой тип.</p>';
      $("#repTotal").textContent = "";
      return;
    }

    var groups = CATS.filter(function (c) { return c.id !== "all"; }).map(function (c) {
      return { cat: c, rows: shown.filter(function (r) { return r.cat === c.id; }) };
    }).filter(function (g) { return g.rows.length; });

    host.innerHTML = groups.map(function (g) {
      return '<section class="rep-group">' +
        '<h3 class="rep-group-title">' + esc(g.cat.label) +
          '<span class="rep-group-count">' + g.rows.length + "</span></h3>" +
        tableHtml(g.rows) + "</section>";
    }).join("");

    $("#repTotal").textContent = shown.length + " " + plural(shown.length, ["отчёт", "отчёта", "отчётов"]);
  }

  function plural(n, forms) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  }

  /* ---- фильтр по типу ---- */
  function buildTabs() {
    var host = $("#repFilter");
    host.innerHTML = CATS.map(function (c) {
      var n = c.id === "all" ? CATALOG.length : CATALOG.filter(function (r) { return r.cat === c.id; }).length;
      return '<button type="button" data-cat="' + c.id + '"' +
        (c.id === state.cat ? ' class="active"' : "") + ">" + esc(c.label) +
        '<span class="rep-tab-n">' + n + "</span></button>";
    }).join("");
  }

  /* ---- события ---- */
  document.addEventListener("click", function (e) {
    var tab = e.target.closest("#repFilter button");
    if (tab) {
      state.cat = tab.dataset.cat;
      buildTabs();
      render();
      return;
    }
    var act = e.target.closest(".rowact");
    if (!act) return;
    var no = act.closest("tr").dataset.no;
    var kind = act.dataset.act;
    if (kind === "fav") { toggleFav(no); return; }
    var rep = CATALOG.filter(function (r) { return r.no === no; })[0];
    var label = rep ? "«" + rep.name + "»" : "Отчёт " + no;
    if (kind === "open") { location.href = "report.html?no=" + encodeURIComponent(no); return; }
    if (kind === "export") toast("Выгрузка: " + label);
    if (kind === "setup")  toast("Настройки: " + label);
  });

  var searchEl = $("#repSearch");
  if (searchEl) {
    var t = null;
    searchEl.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () { state.q = searchEl.value.trim(); render(); }, 150);
    });
  }

  /* соседняя вкладка изменила избранное — перерисуемся */
  window.AdminStore.subscribe(function () { if ($("#repList")) render(); });

  /* наружу — до раннего выхода: страница формирования отчёта
     подключает этот же файл только ради каталога */
  window.AdminReports = {
    CATALOG: CATALOG,
    CATS: CATS,
    find: function (no) {
      return CATALOG.filter(function (r) { return r.no === no; })[0] || null;
    },
    catLabel: function (id) {
      var c = CATS.filter(function (x) { return x.id === id; })[0];
      return c ? c.label : "";
    },
    isFav: isFav,
    toggleFav: toggleFav,
    plural: plural,
    esc: esc,
  };

  /* страница формирования отчёта тоже грузит этот файл — там нет
     ни списка, ни фильтра, поэтому рендер списка просто пропускаем */
  if (!$("#repList")) return;

  buildTabs();
  render();
})();
