/* ============================================================
   Движок данных отчётов (window.AdminReportData).

   Единый источник операций продажи для всех отчётов каталога.
   Журнал детерминированный: ГПСЧ засевается хешем S.EVENTS + S.TIERS,
   поэтому одни и те же данные всегда дают одни и те же строки, а
   смена афиши или зон — новый журнал. Кеш сбрасывается подпиской
   на AdminStore.
   ============================================================ */
(function () {
  "use strict";

  var CHANNELS = [
    "Касса",
    "Интернет",
    "Уполномоченный: ТЦ \"Гудвин\"",
    "Уполномоченный: Агентство \"Афиша-Сибирь\"",
  ];
  var CHANNEL_W = [0.4, 0.4, 0.1, 0.1];
  var CASHIERS = ["Иванова Е.", "Петров А.", "Сидорова М."];
  var PAYS = ["Наличные", "Карта", "СБП", "Пушкинская карта", "Сертификат"];
  var KINDS = [
    { value: "sale", label: "Продажа" },
    { value: "refund", label: "Возврат" },
    { value: "reserve", label: "Бронь" },
    { value: "invite", label: "Приглашение" },
  ];
  var DAYS = 30;

  var cache = null;

  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return h & 0x7fffffff || 1;
  }

  function seeded(seed) {
    var s = seed;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  function st() {
    return (window.AdminStore && window.AdminStore.state) || { EVENTS: [], TIERS: [] };
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* дата YYYY-MM-DD минус n дней (UTC, без сдвигов часового пояса) */
  function shiftDate(iso, n) {
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] - n));
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  function pick(rnd, weights) {
    var r = rnd(), acc = 0;
    for (var i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (r < acc) return i;
    }
    return weights.length - 1;
  }

  function build() {
    var S = st();
    var events = S.EVENTS || [], tiers = S.TIERS || [];
    var rnd = seeded(hash(JSON.stringify([S.EVENTS, S.TIERS])));
    var soldSum = 0;
    tiers.forEach(function (t) { soldSum += +t.sold || 0; });
    var base = soldSum * events.length;
    var target = Math.min(1500, Math.max(300, base * 0.6));
    var k = base ? target / base : 0;
    var out = [];
    var n = 0;

    events.forEach(function (ev, ei) {
      tiers.forEach(function (t) {
        var seats = Math.max(1, +t.seats || 1);
        var cnt = Math.min(seats, Math.round((+t.sold || 0) * k));
        var perRow = seats <= 40 ? 6 : 20;
        /* места без повторов: перемешиваем индексы и берём первые cnt */
        var idx = [], i;
        for (i = 0; i < seats; i++) idx.push(i);
        for (i = seats - 1; i > 0; i--) {
          var j = Math.floor(rnd() * (i + 1));
          var tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
        }
        for (i = 0; i < cnt; i++) {
          var kind = KINDS[pick(rnd, [0.85, 0.05, 0.06, 0.04])].value;
          var ch = CHANNELS[pick(rnd, CHANNEL_W)];
          var pk = false, pay = "";
          if (kind === "sale" || kind === "refund") {
            var older = /^(12|16)\+/.test(ev.age || "");
            if (older && rnd() < 0.15) { pay = "Пушкинская карта"; pk = true; }
            else {
              var r = rnd();
              pay = r < 0.3 ? "Наличные" : r < 0.75 ? "Карта" : r < 0.92 ? "СБП" : "Сертификат";
            }
          } else {
            pay = kind === "invite" ? "Сертификат" : "Наличные";
          }
          var price = +t.price || 0;
          var amount = kind === "sale" ? price : kind === "refund" ? -price : 0;
          if (kind === "invite") price = 0;
          var back = Math.floor(rnd() * (DAYS + 1)); /* 0..30 дней до показа */
          n++;
          out.push({
            id: "op-" + (1000 + n),
            opDate: shiftDate(ev.date, back),
            opTime: pad(9 + Math.floor(rnd() * 12)) + ":" + pad(Math.floor(rnd() * 60)),
            eventId: "ev-" + ei,
            eventTitle: ev.title,
            eventDate: ev.date,
            hall: ev.hall,
            genre: ev.genre,
            zone: t.zone,
            row: Math.floor(idx[i] / perRow) + 1,
            seat: (idx[i] % perRow) + 1,
            price: price,
            amount: amount,
            kind: kind,
            channel: ch,
            cashier: ch === "Интернет" ? "Сайт" : CASHIERS[Math.floor(rnd() * CASHIERS.length)],
            pay: pay,
            pk: pk,
          });
        }
      });
    });

    out.sort(function (a, b) {
      return a.opDate < b.opDate ? -1 : a.opDate > b.opDate ? 1 :
        a.opTime < b.opTime ? -1 : a.opTime > b.opTime ? 1 :
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return out;
  }

  function journal() {
    if (!cache) cache = build();
    return cache;
  }

  function empty(v) { return v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length); }

  function ops(f) {
    f = f || {};
    var kinds = empty(f.kind) ? null : [].concat(f.kind);
    return journal().filter(function (o) {
      if (!empty(f.from) && o.opDate < f.from) return false;
      if (!empty(f.to) && o.opDate > f.to) return false;
      if (!empty(f.eventFrom) && o.eventDate < f.eventFrom) return false;
      if (!empty(f.eventTo) && o.eventDate > f.eventTo) return false;
      if (!empty(f.eventId) && o.eventId !== f.eventId) return false;
      if (!empty(f.channel) && o.channel !== f.channel) return false;
      if (!empty(f.pay) && o.pay !== f.pay) return false;
      if (kinds && kinds.indexOf(o.kind) < 0) return false;
      if (f.pk !== undefined && f.pk !== null && f.pk !== "" && o.pk !== (f.pk === true || f.pk === "true")) return false;
      return true;
    }).map(function (o) { return Object.assign({}, o); });
  }

  function events() {
    return (st().EVENTS || []).map(function (e, i) {
      return { id: "ev-" + i, title: e.title, date: e.date, hall: e.hall, genre: e.genre, age: e.age };
    });
  }

  function channels() { return CHANNELS.map(function (c) { return { value: c, label: c }; }); }
  function payTypes() { return PAYS.map(function (c) { return { value: c, label: c }; }); }
  function kinds() { return KINDS.map(function (k) { return { value: k.value, label: k.label }; }); }

  function range() {
    var j = journal();
    if (!j.length) return { min: "", max: "" };
    return { min: j[0].opDate, max: j[j.length - 1].opDate };
  }

  function sum(rows, key) {
    var s = 0;
    (rows || []).forEach(function (r) { s += +r[key] || 0; });
    return s;
  }
  function count(rows) { return (rows || []).length; }
  function groupBy(rows, keyFn) {
    var m = new Map();
    (rows || []).forEach(function (r) {
      var key = keyFn(r);
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(r);
    });
    return m;
  }

  if (window.AdminStore && window.AdminStore.subscribe) {
    window.AdminStore.subscribe(function () { cache = null; });
  }

  window.AdminReportData = {
    ops: ops, events: events, channels: channels, payTypes: payTypes, kinds: kinds,
    range: range, sum: sum, count: count, groupBy: groupBy,
  };
})();
