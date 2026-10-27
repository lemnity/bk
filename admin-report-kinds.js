/* ============================================================
   Технологии творчества · Кабинет администратора — ВИДЫ ОТЧЁТОВ
   window.AdminReportKinds = { KINDS, kindOf(no), specFor(no) }

   В каталоге ~150 номеров, а по смыслу они сводятся к десятку
   «видов» (по мероприятиям, по датам, по каналам, заполняемость…).
   Здесь — построитель спеки каждого вида (формат AdminReportSpecs,
   см. шапку admin-report-specs.js) и классификатор «номер → вид»:
   по категории и ключевым словам названия, плюс OVERRIDES там, где
   слова ошибаются.

   Порядок подключения на report.html:
     admin-store.js → admin-report-data.js → admin-report-kinds.js →
     admin-reports.js → admin-report-specs.js → admin-report-doc.js →
     admin-report-view.js
   При загрузке файл ничего не вызывает: AdminReportData и
   AdminReports.find нужны только в момент kindOf/specFor/rows, поэтому
   kinds может стоять и до каталога.

   Поля формы — из общего набора, имена параметров совпадают с ключами
   фильтра AdminReportData.ops: from/to (период операций), eventFrom/
   eventTo (период мероприятий), eventId, channel, pay. У daterange
   имена параметров задаёт keys: [от, до]. Пустое значение = «Все».
   ============================================================ */
(function () {
  "use strict";

  function D() { return window.AdminReportData; }
  function S() { return (window.AdminStore && window.AdminStore.state) || {}; }

  function ruDate(iso) {
    if (!iso) return "";
    var p = String(iso).split("-");
    return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : String(iso);
  }
  function empty(v) { return v === undefined || v === null || v === ""; }
  function inRange(iso, from, to) {
    if (!empty(from) && iso < from) return false;
    if (!empty(to) && iso > to) return false;
    return true;
  }
  function pct(part, whole) { return whole ? Math.round(part / whole * 1000) / 10 : 0; }
  function place(o) { return o.zone + ", ряд " + o.row + ", место " + o.seat; }

  /* фильтр движка из параметров формы: только ключи, которые есть у вида */
  function filterOf(p, extra) {
    p = p || {};
    var f = {};
    ["from", "to", "eventFrom", "eventTo", "eventId", "channel", "pay"].forEach(function (k) {
      if (!empty(p[k])) f[k] = p[k];
    });
    return Object.assign(f, extra || {});
  }

  /* ---------------- общий набор полей ---------------- */
  function allOpt(list) { return [{ value: "", label: "Все" }].concat(list); }

  var F = {
    period: { kind: "group", id: "period", keys: ["from", "to"], col: "left",
              addon: "Период операций", control: "daterange" },
    eventPeriod: { kind: "group", id: "eventPeriod", keys: ["eventFrom", "eventTo"], col: "left",
                   addon: "Период мероприятий", control: "daterange" },
    event: { kind: "group", id: "eventId", col: "right", addon: "Мероприятие", control: "select",
             options: function () {
               return allOpt(D().events().map(function (e) {
                 return { value: e.id, label: e.title + " · " + ruDate(e.date) + " · " + e.hall };
               }));
             } },
    channel: { kind: "group", id: "channel", col: "right", addon: "Канал продажи", control: "select",
               options: function () { return allOpt(D().channels()); } },
    pay: { kind: "group", id: "pay", col: "right", addon: "Тип оплаты", control: "select",
           options: function () { return allOpt(D().payTypes()); } },
  };
  function fields() {
    return Array.prototype.map.call(arguments, function (k) { return F[k]; });
  }

  /* ---------------- построители видов ---------------- */

  function byEvent() {
    return {
      fields: fields("period", "eventPeriod", "event", "channel", "pay"),
      columns: [
        { id: "date",    label: "Дата",          type: "text" },
        { id: "title",   label: "Мероприятие",   type: "text", fixed: true },
        { id: "hall",    label: "Зал",           type: "text" },
        { id: "sold",    label: "Продано, шт.",  type: "int" },
        { id: "refCnt",  label: "Возвращено, шт.", type: "int" },
        { id: "revenue", label: "Выручка",       type: "money" },
        { id: "refSum",  label: "Возвраты",      type: "money" },
        { id: "total",   label: "Итог",          type: "money" },
      ],
      rows: function (p) {
        var ops = D().ops(filterOf(p, { kind: ["sale", "refund"] }));
        var out = [];
        D().groupBy(ops, function (o) { return o.eventId; }).forEach(function (list) {
          var s = list.filter(function (o) { return o.kind === "sale"; });
          var r = list.filter(function (o) { return o.kind === "refund"; });
          var rev = D().sum(s, "amount"), ref = -D().sum(r, "amount");
          out.push({ _sort: list[0].eventDate, date: ruDate(list[0].eventDate), title: list[0].eventTitle,
                     hall: list[0].hall, sold: s.length, refCnt: r.length,
                     revenue: rev, refSum: ref, total: rev - ref });
        });
        return out.sort(function (a, b) { return a._sort < b._sort ? -1 : a._sort > b._sort ? 1 : 0; });
      },
    };
  }

  function byOpDate() {
    return {
      fields: fields("period", "event", "channel", "pay"),
      columns: [
        { id: "date",    label: "Дата операции",  type: "text", fixed: true },
        { id: "soldCnt", label: "Продажи, шт.",   type: "int" },
        { id: "soldSum", label: "Продажи, ₽",     type: "money" },
        { id: "refCnt",  label: "Возвраты, шт.",  type: "int" },
        { id: "refSum",  label: "Возвраты, ₽",    type: "money" },
        { id: "total",   label: "Итог",           type: "money" },
      ],
      rows: function (p) {
        var ops = D().ops(filterOf(p, { kind: ["sale", "refund"] }));
        var out = [];
        D().groupBy(ops, function (o) { return o.opDate; }).forEach(function (list, day) {
          var s = list.filter(function (o) { return o.kind === "sale"; });
          var r = list.filter(function (o) { return o.kind === "refund"; });
          var ss = D().sum(s, "amount"), rs = -D().sum(r, "amount");
          out.push({ date: ruDate(day), soldCnt: s.length, soldSum: ss,
                     refCnt: r.length, refSum: rs, total: ss - rs });
        });
        return out; /* журнал уже отсортирован по дате операции */
      },
    };
  }

  function byChannel() {
    return {
      fields: fields("period", "eventPeriod", "event"),
      columns: [
        { id: "channel", label: "Канал продажи", type: "text", fixed: true },
        { id: "sold",    label: "Продано, шт.",  type: "int" },
        { id: "refCnt",  label: "Возвраты, шт.", type: "int" },
        { id: "revenue", label: "Выручка",       type: "money" },
        { id: "share",   label: "Доля",          type: "pct" },
      ],
      rows: function (p) {
        var ops = D().ops(filterOf(p, { kind: ["sale", "refund"] }));
        var all = D().sum(ops, "amount");
        var g = D().groupBy(ops, function (o) { return o.channel; });
        return D().channels().filter(function (c) { return g.has(c.value); }).map(function (c) {
          var list = g.get(c.value);
          var rev = D().sum(list, "amount");
          return { channel: c.label,
                   sold: list.filter(function (o) { return o.kind === "sale"; }).length,
                   refCnt: list.filter(function (o) { return o.kind === "refund"; }).length,
                   revenue: rev, share: pct(rev, all) };
        });
      },
      total: function (rows) { return rows.length ? { share: 100 } : {}; },
    };
  }

  /* типы оплаты — только продажи и возвраты: у брони и приглашений в
     журнале служебная «оплата» с нулевой суммой */
  function byPay() {
    return {
      fields: fields("period", "event", "channel"),
      columns: [
        { id: "pay",   label: "Тип оплаты", type: "text", fixed: true },
        { id: "cnt",   label: "Операций",   type: "int" },
        { id: "sum",   label: "Сумма",      type: "money" },
        { id: "share", label: "Доля",       type: "pct" },
      ],
      rows: function (p) {
        var ops = D().ops(filterOf(p, { kind: ["sale", "refund"] }));
        var all = D().sum(ops, "amount");
        var g = D().groupBy(ops, function (o) { return o.pay; });
        return D().payTypes().filter(function (t) { return g.has(t.value); }).map(function (t) {
          var list = g.get(t.value), s = D().sum(list, "amount");
          return { pay: t.label, cnt: list.length, sum: s, share: pct(s, all) };
        });
      },
      total: function (rows) { return rows.length ? { share: 100 } : {}; },
    };
  }

  function occupancy() {
    return {
      fields: fields("eventPeriod", "event"),
      columns: [
        { id: "title",   label: "Мероприятие",  type: "text", fixed: true },
        { id: "zone",    label: "Зона",         type: "text" },
        { id: "seats",   label: "Мест",         type: "int" },
        { id: "sold",    label: "Продано",      type: "int" },
        { id: "reserve", label: "Бронь",        type: "int" },
        { id: "invite",  label: "Приглашения",  type: "int" },
        { id: "free",    label: "Свободно",     type: "int" },
        { id: "fill",    label: "Заполняемость", type: "pct" },
      ],
      rows: function (p) {
        p = p || {};
        var tiers = S().TIERS || [];
        var ops = D().ops(filterOf({ eventId: p.eventId, eventFrom: p.eventFrom, eventTo: p.eventTo }));
        var out = [];
        D().events().forEach(function (e) {
          if (!empty(p.eventId) && p.eventId !== e.id) return;
          if (!inRange(e.date, p.eventFrom, p.eventTo)) return;
          tiers.forEach(function (t) {
            var list = ops.filter(function (o) { return o.eventId === e.id && o.zone === t.zone; });
            var n = function (k) { return list.filter(function (o) { return o.kind === k; }).length; };
            var seats = +t.seats || 0, sold = n("sale"), res = n("reserve"), inv = n("invite");
            var free = Math.max(0, seats - sold - res - inv);
            out.push({ title: e.title + " · " + ruDate(e.date), zone: t.zone, seats: seats, sold: sold,
                       reserve: res, invite: inv, free: free, fill: pct(seats - free, seats) });
          });
        });
        return out;
      },
      total: function (rows) {
        var seats = 0, free = 0;
        rows.forEach(function (r) { seats += r.seats; free += r.free; });
        return rows.length ? { fill: pct(seats - free, seats) } : {};
      },
    };
  }

  function refunds() {
    return {
      fields: fields("period", "event", "channel", "pay"),
      columns: [
        { id: "date",    label: "Дата",        type: "text" },
        { id: "title",   label: "Мероприятие", type: "text", fixed: true },
        { id: "place",   label: "Место",       type: "text" },
        { id: "sum",     label: "Сумма",       type: "money" },
        { id: "channel", label: "Канал",       type: "text" },
        { id: "cashier", label: "Кассир",      type: "text" },
      ],
      rows: function (p) {
        return D().ops(filterOf(p, { kind: "refund" })).map(function (o) {
          return { date: ruDate(o.opDate) + " " + o.opTime, title: o.eventTitle + " · " + ruDate(o.eventDate),
                   place: place(o), sum: -o.amount, channel: o.channel, cashier: o.cashier };
        });
      },
    };
  }

  function reserves() {
    var LBL = { reserve: "Бронь", invite: "Приглашение" };
    return {
      fields: fields("period", "event", "channel"),
      columns: [
        { id: "date",    label: "Дата",        type: "text" },
        { id: "title",   label: "Мероприятие", type: "text", fixed: true },
        { id: "place",   label: "Место",       type: "text" },
        { id: "kind",    label: "Вид",         type: "text" },
        { id: "channel", label: "Канал",       type: "text" },
      ],
      rows: function (p) {
        return D().ops(filterOf(p, { kind: ["reserve", "invite"] })).map(function (o) {
          return { date: ruDate(o.opDate) + " " + o.opTime, title: o.eventTitle + " · " + ruDate(o.eventDate),
                   place: place(o), kind: LBL[o.kind], channel: o.channel };
        });
      },
    };
  }

  function pushkin() {
    return {
      fields: fields("period", "eventPeriod", "event", "channel"),
      columns: [
        { id: "title", label: "Мероприятие", type: "text", fixed: true },
        { id: "date",  label: "Дата",        type: "text" },
        { id: "cnt",   label: "Билетов",     type: "int" },
        { id: "sum",   label: "Сумма",       type: "money" },
      ],
      rows: function (p) {
        /* только продажи и возвраты: возврат уменьшает и билеты, и сумму */
        var ops = D().ops(filterOf(p, { kind: ["sale", "refund"], pk: true }));
        var out = [];
        D().groupBy(ops, function (o) { return o.eventId; }).forEach(function (list) {
          var cnt = 0;
          list.forEach(function (o) { cnt += o.kind === "sale" ? 1 : -1; });
          out.push({ _sort: list[0].eventDate, title: list[0].eventTitle, date: ruDate(list[0].eventDate),
                     cnt: cnt, sum: D().sum(list, "amount") });
        });
        return out.sort(function (a, b) { return a._sort < b._sort ? -1 : a._sort > b._sort ? 1 : 0; });
      },
    };
  }

  function opsJournal() {
    var LBL = {};
    return {
      fields: fields("period", "event", "channel", "pay"),
      columns: [
        { id: "date",    label: "Дата и время", type: "text", fixed: true },
        { id: "kind",    label: "Операция",     type: "text" },
        { id: "title",   label: "Мероприятие",  type: "text" },
        { id: "place",   label: "Место",        type: "text" },
        { id: "price",   label: "Цена",         type: "money", total: false },
        { id: "amount",  label: "Сумма",        type: "money" },
        { id: "pay",     label: "Оплата",       type: "text" },
        { id: "channel", label: "Канал",        type: "text" },
        { id: "cashier", label: "Кассир",       type: "text" },
      ],
      rows: function (p) {
        if (!LBL.sale) D().kinds().forEach(function (k) { LBL[k.value] = k.label; });
        return D().ops(filterOf(p)).map(function (o) {
          return { date: ruDate(o.opDate) + " " + o.opTime, kind: LBL[o.kind] || o.kind,
                   title: o.eventTitle + " · " + ruDate(o.eventDate), place: place(o),
                   price: o.price, amount: o.amount, pay: o.pay, channel: o.channel, cashier: o.cashier };
        });
      },
    };
  }

  /* музей: те же операции, подписи по-музейному; посетитель — это
     проданный или пригласительный билет, возврат посетителя убирает */
  function museum() {
    return {
      fields: fields("period", "event"),
      columns: [
        { id: "date",     label: "Дата",                      type: "text" },
        { id: "title",    label: "Экспозиция / мероприятие",  type: "text", fixed: true },
        { id: "visitors", label: "Посетителей",               type: "int" },
        { id: "revenue",  label: "Выручка",                   type: "money" },
      ],
      rows: function (p) {
        var ops = D().ops(filterOf(p, { kind: ["sale", "refund", "invite"] }));
        var out = [];
        D().groupBy(ops, function (o) { return o.opDate + "|" + o.eventId; }).forEach(function (list) {
          var v = 0;
          list.forEach(function (o) { v += o.kind === "refund" ? -1 : 1; });
          out.push({ date: ruDate(list[0].opDate), title: list[0].eventTitle, visitors: v,
                     revenue: D().sum(list, "amount") });
        });
        return out;
      },
    };
  }

  /* приказы о ценах: по приказу на мероприятие, строка на зону.
     Дата приказа — за 30 дней до показа (как открытие продаж в журнале) */
  function orders() {
    return {
      fields: fields("eventPeriod", "event"),
      columns: [
        { id: "num",     label: "№ приказа",   type: "text", fixed: true },
        { id: "date",    label: "Дата",        type: "text" },
        { id: "subject", label: "Предмет",     type: "text" },
        { id: "title",   label: "Мероприятие", type: "text" },
        { id: "zone",    label: "Зона",        type: "text" },
        { id: "seats",   label: "Мест",        type: "int" },
        { id: "price",   label: "Цена",        type: "money", total: false },
      ],
      rows: function (p) {
        p = p || {};
        var tiers = S().TIERS || [], out = [];
        D().events().forEach(function (e, i) {
          if (!empty(p.eventId) && p.eventId !== e.id) return;
          if (!inRange(e.date, p.eventFrom, p.eventTo)) return;
          var d = new Date(e.date + "T00:00:00Z");
          d.setUTCDate(d.getUTCDate() - 30);
          var od = d.toISOString().slice(0, 10);
          tiers.forEach(function (t) {
            out.push({ num: (i + 1) + "-Ц/" + e.date.slice(0, 4), date: ruDate(od),
                       subject: "Расстановка и расценка мест", title: e.title + " · " + ruDate(e.date),
                       zone: t.zone, seats: +t.seats || 0, price: +t.price || 0 });
          });
        });
        return out;
      },
    };
  }

  /* мероприятия; у «Репертуара» добавляются гастроли и аренда (июнь 2026,
     как в разделе «Аренда») */
  var RENT_TYPE = { own: "Свой репертуар", tour: "Гастроли", rent: "Аренда" };
  var STATUS = { sale: "В продаже", soon: "Скоро" };
  function eventsKind(withRentals) {
    return {
      fields: fields("eventPeriod"),
      columns: [
        { id: "date",  label: "Дата",        type: "text" },
        { id: "title", label: "Мероприятие", type: "text", fixed: true },
        { id: "genre", label: withRentals ? "Жанр / вид" : "Жанр", type: "text" },
        { id: "hall",  label: "Зал",         type: "text" },
        { id: "age",   label: "Возраст",     type: "text" },
        { id: "note",  label: withRentals ? "Статус / организатор" : "Статус", type: "text" },
      ],
      rows: function (p) {
        p = p || {};
        var out = (S().EVENTS || []).map(function (e) {
          return { _sort: e.date, date: ruDate(e.date), title: e.title, genre: e.genre || "",
                   hall: e.hall || "", age: e.age || "", note: STATUS[e.status] || e.status || "" };
        });
        if (withRentals) {
          (S().RENTALS || []).forEach(function (r) {
            if (r.type === "own") return; /* свой репертуар уже в афише */
            var iso = "2026-06-" + (r.start < 10 ? "0" : "") + r.start;
            out.push({ _sort: iso, date: ruDate(iso) + (r.days > 1 ? " (" + r.days + " дн.)" : ""),
                       title: r.title, genre: RENT_TYPE[r.type] || r.type, hall: r.hall || "",
                       age: "", note: r.org || "" });
          });
        }
        return out.filter(function (r) { return inRange(r._sort, p.eventFrom, p.eventTo); })
          .sort(function (a, b) { return a._sort < b._sort ? -1 : a._sort > b._sort ? 1 : 0; });
      },
    };
  }

  /* «Книга операций» из S.LEDGER. Дата записи — «DD.MM», год 2026 */
  function ledger() {
    return {
      fields: fields("period"),
      columns: [
        { id: "date",    label: "Дата",     type: "text" },
        { id: "op",      label: "Операция", type: "text", fixed: true },
        { id: "cat",     label: "Статья",   type: "text" },
        { id: "income",  label: "Доход",    type: "money" },
        { id: "expense", label: "Расход",   type: "money" },
        { id: "saldo",   label: "Сальдо",   type: "money" },
      ],
      rows: function (p) {
        p = p || {};
        var bal = 0;
        return (S().LEDGER || []).map(function (l) {
          var dm = String(l.date || "").split(".");
          var iso = "2026-" + dm[1] + "-" + dm[0];
          var amt = +l.amount || 0;
          return { iso: iso, date: ruDate(iso), op: l.op, cat: l.cat,
                   income: amt > 0 ? amt : 0, expense: amt < 0 ? -amt : 0 };
        }).filter(function (r) { return inRange(r.iso, p.from, p.to); })
          .map(function (r) { bal += r.income - r.expense; r.saldo = bal; return r; });
      },
      /* сальдо нарастающим итогом не суммируется: в «Итого» — доходы − расходы */
      total: function (rows) {
        var t = 0;
        rows.forEach(function (r) { t += r.income - r.expense; });
        return { saldo: t };
      },
    };
  }

  var KINDS = {
    byEvent:    { label: "По мероприятиям",          build: byEvent },
    byOpDate:   { label: "По датам операций",        build: byOpDate },
    byChannel:  { label: "По каналам продажи",       build: byChannel },
    byPay:      { label: "По типам оплаты",          build: byPay },
    occupancy:  { label: "Заполняемость",            build: occupancy },
    refunds:    { label: "Журнал возвратов",         build: refunds },
    reserves:   { label: "Брони и приглашения",      build: reserves },
    pushkin:    { label: "Пушкинская карта",         build: pushkin },
    opsJournal: { label: "Журнал операций",          build: opsJournal },
    museum:     { label: "Посещения (музей)",        build: museum },
    orders:     { label: "Приказы о ценах",          build: orders },
    events:     { label: "Мероприятия и репертуар",  build: function (no) {
      var r = window.AdminReports && window.AdminReports.find(no);
      return eventsKind(!!(r && /репертуар/i.test(r.name)));
    } },
    ledger:     { label: "Книга операций",           build: ledger },
  };

  /* Номера, где ключевые слова названия ведут не туда (каталог
     просмотрен целиком; причины — в отчёте задачи 3). */
  var OVERRIDES = {
    /* «возврат» в названии, но это сводки по каналам/агентам */
    "48": "byChannel", "49": "byChannel", "49а": "byChannel", "49б": "byChannel",
    "90": "opsJournal",
    /* «возвращённые» не ловится словом «возврат» */
    "121": "refunds",
    /* «реализованные и забронированные места» — заполняемость, не журнал броней */
    "32": "occupancy", "32а": "occupancy",
    "92": "occupancy",
    "102": "occupancy", "103": "occupancy", "104": "occupancy",
    /* способы оплаты / банковские карты / сертификаты */
    "91": "byPay", "31": "byPay", "104М": "byPay",
    /* каналы и группы продаж без слов «агент/уполномоч» */
    "114": "byChannel", "70": "byChannel", "43": "byChannel", "49в": "byChannel", "65": "byChannel",
    /* по датам продажи */
    "44": "byOpDate", "52": "byOpDate", "109": "byOpDate", "118н": "byOpDate",
    /* «за период», но группировка по мероприятиям */
    "82": "byEvent", "213": "byEvent",
    /* проводки — бухгалтерская книга */
    "210": "ledger",
    /* приказы в разделе «Общие» */
    "41": "orders", "60": "orders", "60W": "orders", "63": "orders", "67": "orders",
    "68": "orders", "68М": "orders",
    /* выгрузки операций (1С, транзакции) */
    "61": "opsJournal", "116": "opsJournal", "118": "opsJournal",
    "Б-1": "ledger",
  };

  var RULES = [
    [/возврат/i, "refunds"],
    [/брон|приглаш/i, "reserves"],
    [/пушкин/i, "pushkin"],
    [/оплат.*тип|тип.*оплат|безнал|эквайр/i, "byPay"],
    [/уполномоч|агент|распростран|мест выдачи/i, "byChannel"],
    [/заполн|реализованн.*мест|свободн.*мест/i, "occupancy"],
    [/по дат.*операц|за период|по дням/i, "byOpDate"],
    [/репертуар|^мероприятия$/i, "events"],
  ];

  function kindOf(no) {
    if (Object.prototype.hasOwnProperty.call(OVERRIDES, no)) return OVERRIDES[no];
    var r = window.AdminReports && window.AdminReports.find(no);
    if (!r) return null;
    var name = String(r.name || "").trim();
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(name)) return RULES[i][1];
    if (r.cat === "museum") return "museum";
    if (r.cat === "orders") return "orders";
    if (r.cat === "cash") return "opsJournal";
    return "byEvent";
  }

  function specFor(no) {
    var k = kindOf(no);
    if (!k) return null;
    var spec = KINDS[k].build(no);
    spec.kind = k;
    return spec;
  }

  window.AdminReportKinds = { KINDS: KINDS, OVERRIDES: OVERRIDES, kindOf: kindOf, specFor: specFor };
})();
