/* ============================================================
   ТБДТ · Кабинет администратора — карточка реферальной метки
   referral.html?id=<id> — правка, без id — новая метка.

   Поле на форме одно, «Название»: краткое название и ссылка
   выводятся из него транслитом (правило в admin-referrals.js) и
   показываются тут же, до сохранения. Иначе пришлось бы жать
   «Сохранить», возвращаться в список и там впервые видеть, во что
   превратилось название.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var R = window.AdminReferrals;
  var esc = R.esc;

  var idParam = new URLSearchParams(location.search).get("id");
  var item = idParam ? R.find(idParam) : null;
  var isNew = !idParam;

  /* ---- метки нет ---- */
  if (!isNew && !item) {
    $("#refTitle").textContent = "Метка не найдена";
    document.title = "ТБДТ · Кабинет администратора · Метка не найдена";
    $("#refCrumbTail").textContent = "Метка не найдена";
    $("#refBody").innerHTML =
      '<section class="panel pad stub">' +
      '<div class="stub-mark" aria-hidden="true">⊕</div>' +
      "<h2>Такой метки нет</h2>" +
      "<p>Реферальная метка с номером «" + esc(idParam) + "» отсутствует. " +
      "Возможно, её удалили из другой вкладки.</p>" +
      '<a class="stub-back" href="referrals.html">← Ко всем меткам</a></section>';
    return;
  }

  var title = isNew ? "Новая метка" : "Метка «" + item.name + "»";
  $("#refTitle").textContent = title;
  $("#refCrumbTail").textContent = isNew ? "Новая метка" : item.name;
  document.title = "ТБДТ · Кабинет администратора · " + title;

  var nameEl = $("#refName");
  nameEl.value = isNew ? "" : item.name;

  /* ---- живой предпросмотр ---- */
  function preview() {
    var name = nameEl.value.trim();
    var slug = R.slugify(name);
    var link = slug ? R.linkOf({ slug: slug }) : "";

    $("#refSlug").textContent = slug || "—";
    $("#refLink").textContent = link ||
      (slug ? "укажите адрес страницы с виджетом в списке меток" : "—");
    return { name: name, slug: slug };
  }

  function err(msg) {
    var box = $("#refErr");
    box.textContent = msg || "";
    box.hidden = !msg;
    $("#refName").setAttribute("aria-invalid", msg ? "true" : "false");
    $("#refName").classList.toggle("is-bad", !!msg);
  }

  nameEl.addEventListener("input", function () { preview(); err(""); markDirty(); });

  /* ---- проверка и сохранение ---- */
  function check(v) {
    if (!v.name) return "Введите название метки.";
    /* из названия вроде «???» транслит даёт пустую строку — ссылку
       из такого не собрать */
    if (!v.slug) return "Из этого названия не получается краткое название: " +
      "добавьте буквы или цифры.";
    if (R.slugTaken(v.slug, item ? item.id : -1)) {
      return "Краткое название «" + v.slug + "» уже занято другой меткой — " +
        "ссылки совпали бы, и статистика склеилась.";
    }
    return "";
  }

  function saveAll() {
    var v = preview();
    var msg = check(v);
    if (msg) { err(msg); nameEl.focus(); return false; }

    window.AdminStore.update(function (st) {
      if (isNew) {
        var id = R.nextId();
        st.REFERRALS.items.unshift({ id: id, name: v.name, slug: v.slug });
        /* дальше правим уже существующую запись, а не плодим копии
           при повторном нажатии «Сохранить» */
        idParam = String(id);
        item = { id: id, name: v.name, slug: v.slug };
        isNew = false;
      } else {
        var t = st.REFERRALS.items.filter(function (r) { return r.id === item.id; })[0];
        if (t) { t.name = v.name; t.slug = v.slug; }
        item.name = v.name;
        item.slug = v.slug;
      }
    });

    $("#refTitle").textContent = "Метка «" + v.name + "»";
    $("#refCrumbTail").textContent = v.name;
    markClean();
    return true;
  }

  $("#refSave").addEventListener("click", function () {
    if (saveAll()) toast("Метка сохранена");
  });

  $("#refSaveClose").addEventListener("click", function () {
    if (saveAll()) location.href = "referrals.html";
  });

  /* ---- несохранённые правки ---- */
  var dirty = false;

  function markDirty() {
    if (dirty) return;
    dirty = true;
    $("#refDirty").hidden = false;
  }

  function markClean() {
    dirty = false;
    $("#refDirty").hidden = true;
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

  preview();
})();
