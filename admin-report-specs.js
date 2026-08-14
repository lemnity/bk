/* ============================================================
   ТБДТ · Кабинет администратора — СПЕКИ ОТЧЁТОВ
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
     rows()   — данные демо-таблицы (детерминированные)

   Отчёта нет в этой таблице → страница покажет универсальную форму
   и честно скажет, что параметры ещё не заведены. Молча
   подставлять чужие столбцы нельзя: отчёты не взаимозаменяемы.
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
      { kind: "check",  id: "invites", col: "right", label: "Показывать пригласительные отдельно" },
    ],
    columns: [
      { id: "seller",   label: "Продавец",              type: "text"  },
      { id: "sold",     label: "Продано",               type: "int"   },
      { id: "balance",  label: "Баланс продажи",        type: "money" },
      { id: "refund",   label: "Возврат",               type: "int"   },
      { id: "fz193",    label: "Уд. по 193-ФЗ",         type: "money" },
      { id: "pct",      label: "%",                     type: "pct"   },
      { id: "fee",      label: "Вознаграж.",            type: "money" },
      { id: "feeFz",    label: "Вознаграж. вкл. 193-ФЗ", type: "money" },
      { id: "income",   label: "Доход",                 type: "money" },
      { id: "incomeFz", label: "Доход вкл. 193-ФЗ",     type: "money" },
    ],
    rows: function () {
      var rnd = seeded(20260608);
      return SELLERS.map(function (name, i) {
        var sold    = 40 + Math.floor(rnd() * 460);
        var refund  = Math.floor(rnd() * Math.max(2, sold * 0.06));
        var avg     = 1200 + Math.floor(rnd() * 2600);
        var balance = (sold - refund) * avg;
        var pct     = [10, 0, 12, 12, 8, 0, 6][i % 7];
        var fee     = Math.round(balance * pct / 100);
        var fz193   = Math.round(balance * 0.02);
        return {
          seller: name,
          sold: sold,
          balance: balance,
          refund: refund,
          fz193: fz193,
          pct: pct,
          fee: fee,
          feeFz: fee + fz193,
          income: balance - fee,
          incomeFz: balance - fee - fz193,
        };
      });
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
      { id: "show",     label: "Мероприятие",        type: "text"  },
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
  };

  window.AdminReportSpecs = {
    /* номер отчёта → спека. Пополняем по одному отчёту. */
    "3": PPR2,
    "3а": PPR2_PAY,

    get: function (no) { return Object.prototype.hasOwnProperty.call(this, no) ? this[no] : null; },
  };
})();
