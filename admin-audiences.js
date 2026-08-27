/* ============================================================
   ТБДТ · Кабинет администратора — раздел «Аудитории»
   Отбор аудитории: пять выгрузок контактов для рассылок. Каталог,
   спеки и демо-контакты лежат здесь; страница выгрузки
   (audience.html?no=…) подключает этот же файл и берёт спеку
   отсюда, а не свою копию — иначе список и заголовок разъедутся
   при первом переименовании.

   Контакты у всех пяти выгрузок ОДНИ И ТЕ ЖЕ: один набор людей
   с их заказами, а выгрузка — это способ его отфильтровать и
   посчитать. Поэтому rows(p) у спеки получает параметры формы и
   честно считает по заказам, а не отдаёт заранее слепленную
   таблицу: иначе фильтры были бы декорацией.

   Спека:
     no       — номер выгрузки (он же в ссылке audience.html?no=)
     name     — строка каталога и заголовок страницы
     fields[] — числовые параметры формы: { id, label, value }
     columns[]— столбцы результата: { id, label, type }
                type: "text" | "int" | "money"
     rows(p)  — строки по параметрам p:
                { <id поля>: число|null, from: "ГГГГ-ММ-ДД"|"",
                  to: "ГГГГ-ММ-ДД"|"" }
                Пустой диапазон дат = за всё время.

   Состав столбцов у выгрузки № 1 виден на снимке экрана
   (email, Телефон, ФИО, Количество билетов), у остальных четырёх
   выведен из названия и требует сверки с рабочей системой.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* детерминированный ПСЧ: контакты не должны меняться при каждом
     открытии страницы, иначе демо выглядит сломанным */
  function seeded(seed) {
    var s = seed;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /* ------------------------------------------------------------
     Демо-контакты
     ------------------------------------------------------------ */

  var LAST = ["Соколов", "Кузнецов", "Морозов", "Лебедев", "Волков", "Зайцев",
              "Гусев", "Беляев", "Орлов", "Крылов", "Титов", "Мельников",
              "Щербаков", "Данилов", "Фомин", "Киселёв", "Дьяконов", "Панкратов"];
  var FIRST_M = ["Александр", "Дмитрий", "Максим", "Сергей", "Андрей", "Алексей",
                 "Артём", "Илья", "Кирилл", "Михаил", "Никита", "Егор", "Роман"];
  var FIRST_F = ["Анна", "Мария", "Елена", "Ольга", "Наталья", "Ирина",
                 "Екатерина", "Татьяна", "Юлия", "Дарья", "Ксения", "Полина", "Вера"];
  var MID_M = ["Петрович", "Сергеевич", "Иванович", "Андреевич", "Николаевич", "Викторович"];
  var MID_F = ["Петровна", "Сергеевна", "Ивановна", "Андреевна", "Николаевна", "Викторовна"];
  var DOMAINS = ["mail.ru", "yandex.ru", "gmail.com", "list.ru", "inbox.ru"];

  var SHOWS = ["Прощальные гастроли", "Гамлет", "Чайка", "Вишнёвый сад",
               "Ревизор", "Щелкунчик", "Горе от ума"];

  /* email собираем транслитом из фамилии — так адрес выглядит
     живым, а не «user17@» */
  var TR = { а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"e", ж:"zh", з:"z",
             и:"i", й:"y", к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r",
             с:"s", т:"t", у:"u", ф:"f", х:"h", ц:"ts", ч:"ch", ш:"sh",
             щ:"sch", ъ:"", ы:"y", ь:"", э:"e", ю:"yu", я:"ya" };

  function tr(s) {
    return s.toLowerCase().split("").map(function (c) {
      return TR[c] !== undefined ? TR[c] : c;
    }).join("");
  }

  /* заказы разложены от этой даты — она же нижняя граница периода */
  var DAY0 = Date.UTC(2026, 0, 10);

  function dayStr(offset) {
    var d = new Date(DAY0 + offset * 86400000);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
  }

  var CONTACTS = (function () {
    var rnd = seeded(40260827);
    var used = {};
    var out = [];

    for (var i = 0; i < 36; i++) {
      var female = i % 2 === 1;
      var last  = LAST[i % LAST.length] + (female ? "а" : "");
      var first = (female ? FIRST_F : FIRST_M)[i % 13];
      var mid   = (female ? MID_F : MID_M)[i % 6];

      var box = tr(first).charAt(0) + "." + tr(last);
      if (used[box]) box += (i + 1);          /* тёзки не должны слипнуться */
      used[box] = true;

      var phone = "+7 (9" + (10 + Math.floor(rnd() * 89)) + ") " +
        (100 + Math.floor(rnd() * 900)) + "-" +
        (10 + Math.floor(rnd() * 90)) + "-" +
        (10 + Math.floor(rnd() * 90));

      var orders = [];
      var n = 1 + Math.floor(rnd() * 5);
      for (var k = 0; k < n; k++) {
        var tickets = 1 + Math.floor(rnd() * 4);
        var price   = 800 + Math.floor(rnd() * 3400);
        orders.push({
          date: dayStr(Math.floor(rnd() * 220)),
          show: SHOWS[Math.floor(rnd() * SHOWS.length)],
          tickets: tickets,
          price: price,                        /* цена одного билета в заказе */
          sum: tickets * price,
          /* примерно каждый шестой заказ брошен на полпути */
          done: rnd() > 0.17,
        });
      }

      out.push({
        fio: last + " " + first + " " + mid,
        email: box + "@" + DOMAINS[i % DOMAINS.length],
        phone: phone,
        orders: orders,
      });
    }
    return out;
  })();

  /* ------------------------------------------------------------
     Отбор
     ------------------------------------------------------------ */

  /* Пустая граница диапазона не сужает выборку: незаполненный
     период читается как «за всё время», а не как «ничего». */
  function inRange(o, p) {
    if (p.from && o.date < p.from) return false;
    if (p.to   && o.date > p.to)   return false;
    return true;
  }

  function ordersOf(c, p, onlyDone) {
    return c.orders.filter(function (o) {
      return inRange(o, p) && (!onlyDone || o.done);
    });
  }

  /* Незаполненный минимум/максимум тоже не сужает выборку. */
  function between(v, min, max) {
    if (min !== null && v < min) return false;
    if (max !== null && v > max) return false;
    return true;
  }

  function head(c) { return { email: c.email, phone: c.phone, fio: c.fio }; }

  /* Ровно те же три столбца открывают все пять выгрузок —
     это контакты для рассылки, ради них всё и затевалось. */
  var CONTACT_COLS = [
    { id: "email", label: "email",   type: "text" },
    { id: "phone", label: "Телефон", type: "text" },
    { id: "fio",   label: "ФИО",     type: "text" },
  ];

  function cols(extra) { return CONTACT_COLS.concat(extra); }

  var SPECS = [
    {
      no: 1,
      name: "Контакты пользователей по количеству билетов за все время",
      fields: [
        { id: "min", label: "минимальное количество билетов", value: 1 },
        { id: "max", label: "максимальное количество билетов", value: 8 },
      ],
      columns: cols([{ id: "tickets", label: "Количество билетов", type: "int" }]),
      rows: function (p) {
        return CONTACTS.map(function (c) {
          var t = ordersOf(c, p, true).reduce(function (a, o) { return a + o.tickets; }, 0);
          return t ? Object.assign(head(c), { tickets: t }) : null;
        }).filter(function (r) { return r && between(r.tickets, p.min, p.max); });
      },
    },

    {
      no: 2,
      name: "Контакты пользователей по количеству посещённых мероприятий за период",
      fields: [
        { id: "min", label: "минимальное количество мероприятий", value: 1 },
        { id: "max", label: "максимальное количество мероприятий", value: 4 },
      ],
      columns: cols([{ id: "events", label: "Посещено мероприятий", type: "int" }]),
      rows: function (p) {
        return CONTACTS.map(function (c) {
          /* мероприятия считаем РАЗНЫЕ: два билета на одного «Гамлета» —
             это одно посещение, а не два */
          var seen = {};
          ordersOf(c, p, true).forEach(function (o) { seen[o.show] = true; });
          var n = Object.keys(seen).length;
          return n ? Object.assign(head(c), { events: n }) : null;
        }).filter(function (r) { return r && between(r.events, p.min, p.max); });
      },
    },

    {
      no: 3,
      name: "Контакты пользователей по среднему чеку за период",
      fields: [
        { id: "min", label: "минимальный средний чек", value: 1000 },
        { id: "max", label: "максимальный средний чек", value: 12000 },
      ],
      columns: cols([
        { id: "orders", label: "Заказов",     type: "int"   },
        { id: "avg",    label: "Средний чек", type: "money" },
      ]),
      rows: function (p) {
        return CONTACTS.map(function (c) {
          var os = ordersOf(c, p, true);
          if (!os.length) return null;
          var sum = os.reduce(function (a, o) { return a + o.sum; }, 0);
          return Object.assign(head(c), {
            orders: os.length,
            avg: Math.round(sum / os.length),
          });
        }).filter(function (r) { return r && between(r.avg, p.min, p.max); });
      },
    },

    {
      no: 4,
      name: "Контакты пользователей по незавершённым заказам за период",
      /* Порогов на снимке не видно — оставляем один, по числу
         брошенных заказов: без него выгрузка не отбирает, а просто
         перечисляет всех, у кого хоть что-то не оплачено. */
      fields: [
        { id: "min", label: "минимальное количество незавершённых заказов", value: 1 },
        { id: "max", label: "максимальное количество незавершённых заказов", value: null },
      ],
      columns: cols([
        { id: "pending", label: "Незавершённых заказов", type: "int"   },
        { id: "sum",     label: "Сумма",                 type: "money" },
      ]),
      rows: function (p) {
        return CONTACTS.map(function (c) {
          var os = c.orders.filter(function (o) { return inRange(o, p) && !o.done; });
          if (!os.length) return null;
          return Object.assign(head(c), {
            pending: os.length,
            sum: os.reduce(function (a, o) { return a + o.sum; }, 0),
          });
        }).filter(function (r) { return r && between(r.pending, p.min, p.max); });
      },
    },

    {
      no: 5,
      name: "Контакты пользователей по мин/макс стоимости билета за период",
      fields: [
        { id: "min", label: "минимальная стоимость билета", value: 2000 },
        { id: "max", label: "максимальная стоимость билета", value: 4200 },
      ],
      columns: cols([
        { id: "minPrice", label: "Мин. стоимость билета",  type: "money" },
        { id: "maxPrice", label: "Макс. стоимость билета", type: "money" },
      ]),
      rows: function (p) {
        return CONTACTS.map(function (c) {
          var os = ordersOf(c, p, true);
          if (!os.length) return null;
          var prices = os.map(function (o) { return o.price; });
          return Object.assign(head(c), {
            minPrice: Math.min.apply(null, prices),
            maxPrice: Math.max.apply(null, prices),
          });
        }).filter(function (r) {
          /* попадание по вилке цен: человек нужен, если хоть один его
             билет уложился в заданный коридор */
          if (!r) return false;
          if (p.min !== null && r.maxPrice < p.min) return false;
          if (p.max !== null && r.minPrice > p.max) return false;
          return true;
        });
      },
    },
  ];

  /* ------------------------------------------------------------
     Наружу — до рендера списка: страница выгрузки подключает этот
     файл только ради каталога
     ------------------------------------------------------------ */
  window.AdminAudiences = {
    SPECS: SPECS,
    find: function (no) {
      return SPECS.filter(function (s) { return String(s.no) === String(no); })[0] || null;
    },
    esc: esc,
  };

  /* ---- список выгрузок (audiences.html) ---- */
  var host = $("#audList");
  if (!host) return;

  host.innerHTML =
    '<div class="table-wrap"><table class="dtable aud-table">' +
    "<thead><tr><th class=\"aud-no\">#</th><th>Название выгрузки</th></tr></thead><tbody>" +
    SPECS.map(function (s) {
      return '<tr><td class="aud-no">' + s.no + "</td>" +
        '<td><a class="rep-link" href="audience.html?no=' + encodeURIComponent(s.no) + '">' +
        esc(s.name) + "</a></td></tr>";
    }).join("") +
    "</tbody></table></div>";
})();
