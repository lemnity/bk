/* ============================================================
   Технологии творчества · Кабинет — добавление и правка рассылки
   mailing.html — новая рассылка, mailing.html?id=<id> — правка.

   Отправленную рассылку править нельзя: письмо уже у подписчиков,
   и подмена текста задним числом сделала бы отчётность враньём.
   Такая запись открывается только на чтение.

   «Сохранить черновик» и «Отправить рассылку» — два разных
   действия, и проверки у них разные: черновику достаточно
   названия, отправке нужны и письмо, и адресаты, и разрешение
   по правилу «раз в 7 дней».
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var M = window.AdminMailings;
  var esc = M.esc;

  var idParam = new URLSearchParams(location.search).get("id");
  var rec = idParam ? M.find(idParam) : null;
  var isNew = !idParam;
  var readOnly = !!rec && rec.status !== "draft";

  /* ---- рассылки нет ---- */
  if (!isNew && !rec) {
    $("#mvTitle").textContent = "Рассылка не найдена";
    document.title = "Технологии творчества · Кабинет администратора · Рассылка не найдена";
    $("#mvCrumbTail").textContent = "Не найдена";
    $("#mvBody").innerHTML =
      '<section class="panel pad stub">' +
      '<div class="stub-mark" aria-hidden="true">✉</div>' +
      "<h2>Такой рассылки нет</h2>" +
      "<p>Рассылка с номером «" + esc(idParam) + "» отсутствует. " +
      "Возможно, её удалили из архива.</p>" +
      '<a class="stub-back" href="mailings.html">← Ко всем рассылкам</a></section>';
    return;
  }

  var title = isNew ? "Добавить Email рассылку"
                    : (readOnly ? "Рассылка «" + rec.name + "»" : "Черновик «" + rec.name + "»");
  $("#mvTitle").textContent = title;
  $("#mvCrumbTail").textContent = isNew ? "Добавление" : String(rec.id);
  document.title = "Технологии творчества · Кабинет администратора · " + title;

  /* ---- поля ---- */
  var nameEl  = $("#mvName");
  var audEl   = $("#mvAud");
  var listEl  = $("#mvEmails");
  var distEl  = $("#mvDist");
  var promoEl = $("#mvPromo");
  var whenEl  = $("#mvWhen");

  promoEl.innerHTML = Object.keys(M.PROMO).map(function (k) {
    return '<option value="' + esc(k) + '">' + esc(M.PROMO[k]) + "</option>";
  }).join("");

  function localNow(plusMin) {
    var d = new Date(Date.now() + (plusMin || 0) * 60000);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  nameEl.value  = rec ? rec.name : "";
  audEl.value   = rec ? rec.audience : "all";
  listEl.value  = rec ? rec.emails : "";
  distEl.checked = rec ? !!rec.distributors : false;
  promoEl.value = rec ? rec.promo : "any";
  whenEl.value  = rec && rec.at ? String(rec.at).replace(" ", "T").slice(0, 16) : localNow(30);

  /* ---- конструктор письма ---- */
  var dirty = false;
  var letter = window.AdminLetter.create({
    mount: $("#mvLetter"),
    value: rec ? rec.letter : { blocks: [] },
    /* имя файла «Скачать .html»: у несохранённой рассылки номера ещё нет */
    id: function () { return rec ? rec.id : null; },
    onChange: function (_, what) {
      /* конструктор сам формулирует сообщения о загрузке картинок */
      if (what && what.indexOf("msg:") === 0) { toast(what.slice(4)); return; }
      if (what === "upload-bad") { toast("Это не шаблон письма — в файле нет блоков"); return; }
      if (what === "download") { toast("Шаблон выгружен"); return; }
      if (what === "download-html") { toast("HTML письма скачан"); return; }
      if (what === "upload") { toast("Шаблон загружен"); }
      markDirty();
    },
  });

  /* ---- счётчик подписчиков и правило 7 дней ---- */
  function syncAudience() {
    var all = audEl.value === "all";
    $("#mvListWrap").hidden = all;

    var t = M.throttle();
    $("#mvCount").textContent = all
      ? "Подписчиков: " + t.total
      : "Адресов: " + M.emailList(listEl.value).length;

    var warn = $("#mvThrottle");
    if (all && t.until) {
      warn.hidden = false;
      warn.textContent = "По всей базе уже отправляли «" + t.last.name + "» " +
        M.ruDateTime(t.last.at) + ". Следующая рассылка по всем подписчикам возможна с " +
        M.ruDate(t.until) + ".";
    } else {
      warn.hidden = true;
    }
  }

  audEl.addEventListener("change", function () { syncAudience(); markDirty(); });
  listEl.addEventListener("input", function () { syncAudience(); markDirty(); });
  [nameEl, distEl, promoEl, whenEl].forEach(function (el) {
    el.addEventListener("input", markDirty);
    el.addEventListener("change", markDirty);
  });

  /* ---- только чтение ---- */
  if (readOnly) {
    [nameEl, audEl, listEl, distEl, promoEl, whenEl].forEach(function (el) { el.disabled = true; });
    $("#mvActions").hidden = true;
    $("#mvRo").hidden = false;
    $("#mvRo").textContent = "Рассылка уже " +
      (rec.status === "queue" ? "поставлена в очередь" : "отправлена") +
      " — письмо и параметры больше не редактируются. " +
      "Чтобы отправить похожее, создайте новую и загрузите в неё шаблон.";
  }

  /* ---- проверки ---- */
  function err(msg) {
    var box = $("#mvErr");
    box.textContent = msg || "";
    box.hidden = !msg;
    if (msg) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return !msg;
  }

  function checkDraft() {
    if (!nameEl.value.trim()) return err("Введите заголовок письма — по нему рассылка ищется в списке.");
    return err("");
  }

  function checkSend() {
    if (!checkDraft()) return false;
    if (letter.isEmpty()) {
      return err(letter.get().mode === "html"
        ? "Письмо пустое. Впишите HTML-код письма во вкладке «HTML письма»."
        : "Письмо пустое. Добавьте хотя бы один блок в «Текст письма».");
    }

    if (audEl.value === "all") {
      var t = M.throttle();
      if (t.until) {
        return err("Рассылка по всем подписчикам возможна только с " + M.ruDate(t.until) +
          ": правило «не чаще раза в " + M.THROTTLE_DAYS + " дней».");
      }
      if (!t.total) return err("В базе нет ни одного подписчика.");
    } else {
      var list = M.emailList(listEl.value);
      if (!list.length) return err("Укажите хотя бы один адрес получателя.");
      var bad = list.filter(function (e) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
      if (bad.length) return err("Не похоже на адреса: " + bad.slice(0, 3).join(", ") +
        (bad.length > 3 ? " и ещё " + (bad.length - 3) : "") + ".");
    }
    return err("");
  }

  /* ---- сохранение ---- */
  function collect(status) {
    var list = audEl.value === "all"
      ? M.subscribers().map(function (c) { return c.email; })
      : M.emailList(listEl.value);
    var total = status === "draft" ? 0 : list.length;

    return {
      id: rec ? rec.id : M.nextId(),
      at: whenEl.value.replace("T", " ") + ":00",
      name: nameEl.value.trim(),
      audience: audEl.value,
      emails: audEl.value === "all" ? "" : list.join(", "),
      total: total, queued: total, sent: 0, read: 0, clicks: 0, unsub: 0, invalid: 0,
      status: status, archived: false,
      distributors: !!distEl.checked,
      promo: promoEl.value,
      letter: letter.get(),
    };
  }

  function save(status) {
    var data = collect(status);
    window.AdminStore.update(function (st) {
      var i = st.MAILINGS.items.findIndex(function (m) { return m.id === data.id; });
      if (i >= 0) st.MAILINGS.items[i] = data;
      else st.MAILINGS.items.unshift(data);
    });
    rec = M.find(data.id);
    isNew = false;
    markClean();
    return data;
  }

  $("#mvDraft").addEventListener("click", function () {
    if (!checkDraft()) return;
    var d = save("draft");
    $("#mvTitle").textContent = "Черновик «" + d.name + "»";
    $("#mvCrumbTail").textContent = String(d.id);
    toast("Черновик сохранён · id " + d.id);
  });

  $("#mvSend").addEventListener("click", function () {
    if (!checkSend()) return;
    /* Ставим в очередь, а не «отправлено»: витрина писем не шлёт,
       и рисовать отправку, которой не было, нельзя. */
    var d = save("queue");
    toast("Рассылка поставлена в очередь · " + d.total + " " +
      M.plural(d.total, ["адрес", "адреса", "адресов"]));
    setTimeout(function () { location.href = "mailings.html"; }, 700);
  });

  /* ---- несохранённые правки ---- */
  function markDirty() {
    if (dirty || readOnly) return;
    dirty = true;
    $("#mvDirty").hidden = false;
  }
  function markClean() {
    dirty = false;
    $("#mvDirty").hidden = true;
  }
  window.addEventListener("beforeunload", function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  syncAudience();
  markClean();
})();
