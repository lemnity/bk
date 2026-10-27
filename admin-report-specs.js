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
       eventOf(params) — мероприятие бланка {id,title,date,hall} | null
       invites(params) — строка «Всего пригласительных:»
       totals(rows, params)  — строка «Всего:» (проценты не суммируются,
                       считаются отдельно, поэтому это функция)
       summary(rows, params) — свод «Аншлаг / Реализовано»

   Отчёта нет в этой таблице → спеку строит admin-report-kinds.js
   по виду отчёта (по мероприятиям, по датам, по каналам…). Только
   если номер не найден и там, страница покажет универсальную форму
   и честно скажет, что параметры ещё не заведены.
   ============================================================ */
(function () {
  "use strict";

  function D() { return window.AdminReportData; }

  var SHOWS = [
    "Все",
    "Прощальные гастроли",
    "Гамлет",
    "Чайка",
    "Вишнёвый сад",
    "Ревизор",
    "Щелкунчик",
  ];

  /* Аншлаг — зал целиком, по зонам S.TIERS (сейчас в admin-store.js:
       партер    166 × 3500 =   581 000
       амфитеатр 300 × 2200 =   660 000
       балкон    120 × 1200 =   144 000
       ложа       24 × 5000 =   120 000
                  610          1 505 000).
     Считаем из хранилища: правка зон в «Ценах» меняет и свод. */
  function house() {
    var S = window.AdminStore && window.AdminStore.state;
    var seats = 0, sum = 0;
    ((S && S.TIERS) || []).forEach(function (t) {
      seats += +t.seats || 0;
      sum += (+t.seats || 0) * (+t.price || 0);
    });
    return { seats: seats, sum: sum };
  }

  function ruDate(iso) {
    var p = String(iso || "").split("-");
    return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : String(iso || "");
  }

  /* Мероприятие бланка. Выбрано в списке — оно. Не выбрано — первое
     из афиши, подходящее под «Диапазон событий» и «Выберите
     мероприятие» (так и диапазон, и название реально фильтруют).
     Ничего не подошло → null, страница покажет пустое состояние. */
  function pickEvent(p) {
    p = p || {};
    var list = D().events();
    if (p.event) {
      return list.filter(function (e) { return e.id === p.event; })[0] || null;
    }
    return list.filter(function (e) {
      if (p.eventFrom && e.date < p.eventFrom) return false;
      if (p.eventTo && e.date > p.eventTo) return false;
      if (p.show && p.show !== "Все" && e.title !== p.show) return false;
      return true;
    })[0] || null;
  }

  /* продажи и возвраты выбранного мероприятия: бронь и приглашения
     денег не несут (у приглашений служебная «оплата» Сертификат) */
  function eventOps(p, kinds) {
    var e = pickEvent(p);
    return e ? D().ops({ eventId: e.id, kind: kinds || ["sale", "refund"] }) : [];
  }

  /* «Продавец» бланка — канал продажи журнала. Уполномоченный
     подписывается своим именем, без служебной приставки. */
  function sellerName(ch) {
    if (ch === "Касса") return "Касса театра";
    if (ch === "Интернет") return "Сайт театра";
    return ch.replace(/^Уполномоченный:\s*/, "");
  }
  /* вознаграждение продавца, % от баланса продажи: своя касса — без
     вознаграждения, сайт — эквайринг и билетная система, уполномоченные —
     агентское. Ставки демонстрационные, требуют сверки с договорами. */
  function feePct(ch) {
    if (ch === "Касса") return 0;
    if (ch === "Интернет") return 6;
    return 12;
  }

  function eventOptions() {
    return [{ value: "", label: "Событие не выбрано" }].concat(D().events().map(function (e) {
      return { value: e.id, label: e.title + " · " + e.date + " · " + e.hall };
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
      { kind: "group",  id: "range",  col: "right", addon: "Диапазон событий", control: "daterange",
        keys: ["eventFrom", "eventTo"] },
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
    /* Строки — продавцы (каналы продажи журнала AdminReportData) по
       выбранному мероприятию: продано / возвращено / баланс считаются
       из операций, а не задаются. Продаж и возвратов нет → []. */
    rows: function (p) {
      var ops = eventOps(p);
      if (!ops.length) return [];
      var g = D().groupBy(ops, function (o) { return o.channel; });
      return D().channels().map(function (c) {
        var list = g.get(c.value) || [];
        var s = list.filter(function (o) { return o.kind === "sale"; });
        var r = list.filter(function (o) { return o.kind === "refund"; });
        var soldCnt = s.length;
        var refCnt  = r.length;
        var soldSum = D().sum(s, "amount");
        var refSum  = 0 - D().sum(r, "amount") || 0; /* без «-0 ₽» */
        var balCnt  = soldCnt - refCnt;
        var balSum  = soldSum - refSum;
        var pct     = feePct(c.value);
        var fee     = Math.round(balSum * pct / 100);
        /* формулы 193-ФЗ взяты из прежней версии спеки как есть и
           требуют сверки с рабочей системой: «вкл. 193-ФЗ» у
           вознаграждения прибавляет удержание, у дохода — вычитает */
        var fz193   = Math.round(balSum * 0.02);
        return {
          seller: sellerName(c.value),
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
      /* мероприятие, по которому построен бланк, — для строки шапки */
      eventOf: pickEvent,
      /* пригласительные того же мероприятия; бесплатные → суммы нулевые */
      invites: function (p) {
        var n = eventOps(p, "invite").length;
        return {
          seller: "Всего пригласительных:",
          soldCnt: n, soldSum: 0,
          balCnt: n,  balSum: 0,
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
        var h     = house();
        return {
          head: ["", "Аншлаг", "Реализовано", "Реализовано вкл. 193-ФЗ", "%"],
          rows: [
            { label: "Кол-во мест", type: "int",
              cells: [h.seats, seats, seats, h.seats ? Math.round(seats / h.seats * 100) : 0] },
            { label: "На сумму", type: "money",
              cells: [h.sum, money, money + fz, h.sum ? Math.round(money / h.sum * 100) : 0] },
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
          return [{ value: "", label: "Не выбрано" }].concat(eventOptions().slice(1));
        } },
      { kind: "or",                  col: "mid" },
      { kind: "group", id: "range",  col: "right", addon: "Диапазон событий", control: "daterange",
        keys: ["eventFrom", "eventTo"] },
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
    /* Строка — выбранное мероприятие (см. pickEvent), суммы — чистые
       (продажи минус возвраты) по типам оплаты журнала. «Безналичный
       расчёт» — оплата сертификатом: другого безнала в журнале нет;
       соответствие типов столбцам требует сверки с рабочей системой. */
    rows: function (p) {
      var ops = eventOps(p);
      if (!ops.length) return [];
      var by = function (pay) {
        return D().sum(ops.filter(function (o) { return o.pay === pay; }), "amount");
      };
      var sold = 0;
      ops.forEach(function (o) { sold += o.kind === "sale" ? 1 : -1; });
      var cash = by("Наличные"), card = by("Карта"), sbp = by("СБП"),
          pushkin = by("Пушкинская карта"), cashless = by("Сертификат");
      return [{ show: ops[0].eventTitle + " · " + ruDate(ops[0].eventDate), sold: sold,
                cash: cash, card: card, sbp: sbp, pushkin: pushkin, cashless: cashless,
                total: D().sum(ops, "amount") }];
    },
    /* Бланк тот же, что у № 3 — шапка, подписи, код. Строки
       «Всего пригласительных:» и свода «Аншлаг» здесь НЕТ: на снимке
       этого отчёта результат не виден, выдумывать их нельзя. */
    doc: {
      code: "PPr2",
      caption: "Отчет о продаже билетов по мероприятию " +
               "с разбивкой оплаты в кассе по типам",
      ticketSet: 16,
      /* мероприятие, по которому построен бланк, — для строки шапки */
      eventOf: pickEvent,
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
