/* ============================================================
   Технологии творчества · Кабинет администратора — СПЕКИ ОТЧЁТОВ
   У каждого отчёта свой набор параметров и свой набор столбцов,
   поэтому здесь таблица «номер отчёта → спека», а не одна общая
   форма. Заводим по одному отчёту за раз.

   Спека:
     title    — заголовок страницы. Если не задан, берётся из
                каталога (admin-reports.js). Нужен там, где рабочее
                название отличается от строки в списке.
     fields[] — параметры формы, сверху вниз. У каждого поля
                col: "left" | "right" — в какую колонку класть.
       kind:"select" — обычный список
       kind:"group"  — список/поле с серой приставкой слева (addon);
                       control: "select" | "text" | "date" | "daterange"
                       ("daterange" — два поля с календарём, от и до)
       kind:"check"  — флажок
       kind:"or"     — разделитель «или» между колонками
     columns[]— столбцы результата: { id, label, type, on }
                type: "text" | "int" | "money" | "pct"
                on:false — столбец есть, но по умолчанию снят
     rows(params) — данные таблицы (детерминированные); params —
                значения формы по ключам полей (у daterange — keys)
     total(rows)  — необязательно: значения строки «Итого» для
                столбцов, которые не суммируются (доли %, сальдо)
     columns[].total:false — столбец не суммируется в «Итого»
     doc      — бланк документа (admin-report-doc.js): шапка,
                строки итогов, свод, код отчёта. Нет doc →
                результат покажется обычной таблицей.
       code       — код отчёта в подвале бланка («PPr2»)
       caption    — подзаголовок под наименованием театра
       ticketSet  — номер билетного комплекта
       invites()  — строка «Всего пригласительных:»
       totals(rows)  — строка «Всего:» (проценты не суммируются,
                       считаются отдельно, поэтому это функция)
       summary(rows) — свод «Аншлаг / Реализовано»

   Отчёта нет в этой таблице → спеку строит admin-report-kinds.js
   по виду отчёта (по мероприятиям, по датам, по каналам…). Только
   если номер не найден и там, страница покажет универсальную форму
   и честно скажет, что параметры ещё не заведены.
   ============================================================ */
(function () {
  "use strict";

  /* детерминированный ПСЧ: цифры не должны прыгать при каждом
     открытии страницы, иначе демо выглядит сломанным */
  function seeded(seed) {
    var s = seed;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  var SELLERS = [
    "Касса театра",
    "Сайт театра",
    "Агрегатор «Кассир.ру»",
    "Агрегатор «Афиша»",
    "Распространители",
    "Пушкинская карта",
    "Кассы-партнёры",
  ];

  var SHOWS = [
    "Все",
    "Прощальные гастроли",
    "Гамлет",
    "Чайка",
    "Вишнёвый сад",
    "Ревизор",
    "Щелкунчик",
  ];

  /* Аншлаг — зал целиком, по зонам из admin-store.js:
       партер    166 × 3500 =   581 000
       амфитеатр 300 × 2200 =   660 000
       балкон    120 × 1200 =   144 000
       ложа       24 × 5000 =   120 000
                  610          1 505 000
     Средняя цена по залу — 2467 ₽; цены продавцов ходят вокруг неё,
     иначе «реализовано» перевалит за аншлаг и в своде выйдет 104 %. */
  var HOUSE     = 610;
  var HOUSE_SUM = 1505000;

  /* Доли продавцов в проданных местах (в сумме 1) и сколько мест
     ушло всего. Держим ниже аншлага, иначе проценты в своде
     выходят за 100 и бланк выглядит сломанным. */
  var SHARE      = [0.28, 0.22, 0.14, 0.11, 0.12, 0.08, 0.05];
  var SOLD_TOTAL = 556;   /* 91 % аншлага */
  var INVITES    = 24;    /* пригласительные бесплатные → суммы нулевые */

  function eventOptions() {
    var S = window.AdminStore && window.AdminStore.state;
    var ev = (S && Array.isArray(S.EVENTS)) ? S.EVENTS : [];
    return ["Событие не выбрано"].concat(ev.map(function (e) {
      return e.title + " · " + e.date + " · " + e.hall;
    }));
  }

  /* ------------------------------------------------------------
     № 3 — Отчёт о продаже билетов по мероприятию (PPr2)
     Параметры и столбцы — один в один со снимком экрана.
     ------------------------------------------------------------ */
  var PPR2 = {
    title: "Отчёт о продаже билетов по мероприятию (PPr2)",
    fields: [
      { kind: "select", id: "event",  col: "left",  options: eventOptions },
      { kind: "or",                   col: "mid" },
      { kind: "group",  id: "range",  col: "right", addon: "Диапазон событий", control: "daterange" },
      { kind: "group",  id: "show",   col: "left",  addon: "Выберите мероприятие",
        control: "select", options: SHOWS },
      /* флажок управляет бланком: снят — пригласительные не пропадают,
         а сворачиваются в строку «Всего:» */
      { kind: "check",  id: "invites", col: "right", on: true,
        label: "Показывать пригласительные отдельно" },
    ],
    /* Продано / Баланс продажи / Возврат в бланке идут парой
       «Число | Сумма» под общей надстройкой — это group.
       Продавец нельзя снять: без него строки теряют подпись. */
    columns: [
      { id: "seller",   label: "Продавец", type: "text", fixed: true },
      { id: "soldCnt",  group: "Продано",        label: "Число", type: "int"   },
      { id: "soldSum",  group: "Продано",        label: "Сумма", type: "money" },
      { id: "balCnt",   group: "Баланс продажи", label: "Число", type: "int"   },
      { id: "balSum",   group: "Баланс продажи", label: "Сумма", type: "money" },
      { id: "refCnt",   group: "Возврат",        label: "Число", type: "int"   },
      { id: "refSum",   group: "Возврат",        label: "Сумма", type: "money" },
      { id: "fz193",    group: "Уд. по 193-ФЗ",  label: "Сумма", type: "money" },
      { id: "pct",      label: "%",                      type: "pct"   },
      { id: "fee",      label: "Вознаграж.",             type: "money" },
      { id: "feeFz",    label: "Вознаграж. вкл. 193-ФЗ", type: "money" },
      { id: "income",   label: "Доход",                  type: "money" },
      { id: "incomeFz", label: "Доход вкл. 193-ФЗ",      type: "money" },
    ],
    rows: function () {
      var rnd = seeded(20260608);
      return SELLERS.map(function (name, i) {
        var soldCnt = Math.round(SOLD_TOTAL * SHARE[i]);
        /* средний чек продавца пляшет вокруг средней цены зала, а не
           вокруг отдельного числа: иначе «реализовано» в своде легко
           обгоняет аншлаг и процент уходит за 100 */
        var avg     = Math.round(HOUSE_SUM / HOUSE * (0.85 + rnd() * 0.3));
        var refCnt  = Math.floor(rnd() * Math.max(1, soldCnt * 0.05));
        var soldSum = soldCnt * avg;
        var refSum  = refCnt * avg;
        var balCnt  = soldCnt - refCnt;
        var balSum  = soldSum - refSum;
        var pct     = [10, 0, 12, 12, 8, 0, 6][i % 7];
        var fee     = Math.round(balSum * pct / 100);
        /* формулы 193-ФЗ взяты из прежней версии спеки как есть и
           требуют сверки с рабочей системой: «вкл. 193-ФЗ» у
           вознаграждения прибавляет удержание, у дохода — вычитает */
        var fz193   = Math.round(balSum * 0.02);
        return {
          seller: name,
          soldCnt: soldCnt, soldSum: soldSum,
          balCnt: balCnt,   balSum: balSum,
          refCnt: refCnt,   refSum: refSum,
          fz193: fz193,
          pct: pct,
          fee: fee,
          feeFz: fee + fz193,
          income: balSum - fee,
          incomeFz: balSum - fee - fz193,
        };
      });
    },
    doc: {
      code: "PPr2",
      caption: "Отчет о продаже билетов по мероприятию",
      ticketSet: 16,
      invites: function () {
        return {
          seller: "Всего пригласительных:",
          soldCnt: INVITES, soldSum: 0,
          balCnt: INVITES,  balSum: 0,
          refCnt: 0,        refSum: 0,
          fz193: 0, pct: 0, fee: 0, feeFz: 0, income: 0, incomeFz: 0,
        };
      },
      totals: function (rows) {
        var t = { seller: "Всего:" };
        ["soldCnt", "soldSum", "balCnt", "balSum", "refCnt", "refSum",
         "fz193", "fee", "feeFz", "income", "incomeFz"].forEach(function (k) {
          t[k] = rows.reduce(function (a, r) { return a + (r[k] || 0); }, 0);
        });
        /* итоговый % — не сумма процентов, а вознаграждение к балансу */
        t.pct = t.balSum ? Math.round(t.fee / t.balSum * 100) : 0;
        return t;
      },
      summary: function (rows) {
        var seats = rows.reduce(function (a, r) { return a + (r.balCnt || 0); }, 0);
        var money = rows.reduce(function (a, r) { return a + (r.balSum || 0); }, 0);
        var fz    = rows.reduce(function (a, r) { return a + (r.fz193  || 0); }, 0);
        var full  = HOUSE_SUM;
        return {
          head: ["", "Аншлаг", "Реализовано", "Реализовано вкл. 193-ФЗ", "%"],
          rows: [
            { label: "Кол-во мест", type: "int",
              cells: [HOUSE, seats, seats, Math.round(seats / HOUSE * 100)] },
            { label: "На сумму", type: "money",
              cells: [full, money, money + fz, Math.round(money / full * 100)] },
          ],
        };
      },
    },
  };

  /* ------------------------------------------------------------
     № 3а — Отчёт о продаже билетов по мероприятию (PPr2)
            с разбивкой оплаты в кассе по типам
     Отличия от № 3 (со снимка экрана):
       · у события появилась приставка «Выберите событие»,
         значение по умолчанию — «Не выбрано»;
       · кнопки «Выбрать столбцы» НЕТ → pickColumns:false.
     Состав столбцов результата на снимке не виден: он выведен из
     названия отчёта (разбивка по типам оплаты в кассе) и требует
     сверки с рабочей системой.
     ------------------------------------------------------------ */
  var PPR2_PAY = {
    title: "Отчёт о продаже билетов по мероприятию (PPr2)",
    pickColumns: false,
    fields: [
      { kind: "group", id: "event", col: "left", addon: "Выберите событие",
        control: "select", options: function () {
          var S = window.AdminStore && window.AdminStore.state;
          var ev = (S && Array.isArray(S.EVENTS)) ? S.EVENTS : [];
          return ["Не выбрано"].concat(ev.map(function (e) {
            return e.title + " · " + e.date + " · " + e.hall;
          }));
        } },
      { kind: "or",                  col: "mid" },
      { kind: "group", id: "range",  col: "right", addon: "Диапазон событий", control: "daterange" },
      { kind: "group", id: "show",   col: "left",  addon: "Выберите мероприятие",
        control: "select", options: SHOWS },
      { kind: "check", id: "invites", col: "right", label: "Показывать пригласительные отдельно" },
    ],
    columns: [
      { id: "show",     label: "Мероприятие",        type: "text", fixed: true },
      { id: "sold",     label: "Продано",            type: "int"   },
      { id: "cash",     label: "Наличные",           type: "money" },
      { id: "card",     label: "Банковская карта",   type: "money" },
      { id: "sbp",      label: "СБП",                type: "money" },
      { id: "pushkin",  label: "Пушкинская карта",   type: "money" },
      { id: "cashless", label: "Безналичный расчёт", type: "money" },
      { id: "total",    label: "Итого",              type: "money" },
    ],
    rows: function () {
      var rnd = seeded(30260608);
      return SHOWS.slice(1).map(function (name) {
        var sold  = 60 + Math.floor(rnd() * 420);
        var avg   = 1200 + Math.floor(rnd() * 2400);
        var total = sold * avg;
        /* доли типов оплаты; последний тип добираем остатком,
           иначе сумма частей не сойдётся с «Итого» из-за округлений */
        var cash     = Math.round(total * (0.16 + rnd() * 0.12));
        var card     = Math.round(total * (0.30 + rnd() * 0.14));
        var sbp      = Math.round(total * (0.10 + rnd() * 0.10));
        var pushkin  = Math.round(total * (0.05 + rnd() * 0.10));
        var cashless = total - cash - card - sbp - pushkin;
        return { show: name, sold: sold, cash: cash, card: card, sbp: sbp,
                 pushkin: pushkin, cashless: cashless, total: total };
      });
    },
    /* Бланк тот же, что у № 3 — шапка, подписи, код. Строки
       «Всего пригласительных:» и свода «Аншлаг» здесь НЕТ: на снимке
       этого отчёта результат не виден, выдумывать их нельзя. */
    doc: {
      code: "PPr2",
      caption: "Отчет о продаже билетов по мероприятию " +
               "с разбивкой оплаты в кассе по типам",
      ticketSet: 16,
      totals: function (rows) {
        var t = { show: "Всего:" };
        ["sold", "cash", "card", "sbp", "pushkin", "cashless", "total"]
          .forEach(function (k) {
            t[k] = rows.reduce(function (a, r) { return a + (r[k] || 0); }, 0);
          });
        return t;
      },
    },
  };

  window.AdminReportSpecs = {
    /* номер отчёта → спека. Пополняем по одному отчёту. */
    "3": PPR2,
    "3а": PPR2_PAY,

    /* ручная спека («3», «3а» — бланк PPr2), иначе спека вида из
       admin-report-kinds.js. Нет ни той, ни другой → null. */
    get: function (no) {
      if (no !== "get" && Object.prototype.hasOwnProperty.call(this, no)) return this[no];
      return window.AdminReportKinds ? window.AdminReportKinds.specFor(no) : null;
    },
  };
})();
