/* ============================================================
   ТБДТ · Кабинет администратора — раздел «Площадки»
   Справочник площадок: фильтры, таблица, добавление/правка,
   копирование и мягкое удаление.

   Живёт отдельно от admin.js: тот уже обслуживает семь разделов,
   восьмой CRUD в нём был бы лишним весом. Данные — общие,
   через AdminStore (localStorage + синхронизация между вкладками).
   ============================================================ */
(function () {
  "use strict";

  const $ = sel => document.querySelector(sel);
  const body = $("#venueBody");
  if (!body) return;                       // страница не «Площадки»

  const S = window.AdminStore.state;
  const VENUES = () => S.VENUES;

  /* мягко удалённая площадка не исчезает, а уходит под фильтр
     «Только удалённые» — иначе этому фильтру нечего показывать */
  const DEFAULT_FILTERS = { id: "", name: "", altName: "", address: "", base: "", deleted: "no", layoutId: "" };
  let filters = { ...DEFAULT_FILTERS };
  let editId = null;                        // id правимой площадки, null = добавление

  /* ---------- утилиты ---------- */

  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const has = (hay, needle) =>
    String(hay || "").toLowerCase().includes(String(needle).trim().toLowerCase());

  const nextId = () => VENUES().reduce((max, v) => Math.max(max, +v.id || 0), 165453) + 1;

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---------- фильтрация ---------- */

  function matches(v) {
    if (filters.deleted === "yes" ? !v.deleted : !!v.deleted) return false;
    if (filters.base === "yes" && !v.base) return false;
    if (filters.base === "no" && v.base) return false;
    if (filters.id && !String(v.id).includes(filters.id.trim())) return false;
    if (filters.name && !has(v.name, filters.name)) return false;
    if (filters.altName && !has(v.altName, filters.altName)) return false;
    if (filters.address && !(has(v.address, filters.address) || has(v.buildingAddress, filters.address))) return false;
    if (filters.layoutId) {
      const q = filters.layoutId.trim();
      if (!(v.layoutIds || []).some(x => String(x).includes(q))) return false;
    }
    return true;
  }

  function readFilters() {
    const f = new FormData($("#venueFilters"));
    filters = {
      id: f.get("id") || "", name: f.get("name") || "", altName: f.get("altName") || "",
      address: f.get("address") || "", base: f.get("base") || "",
      deleted: f.get("deleted") || "no", layoutId: f.get("layoutId") || "",
    };
  }

  /* ---------- рендер ---------- */

  function render() {
    const rows = VENUES().filter(matches);

    /* считаем в пределах той же выборки (удалённые / неудалённые): иначе на
       чистых фильтрах выходило «Показано 8 из 9», хотя девятая просто удалена */
    const pool = VENUES().filter(v => filters.deleted === "yes" ? v.deleted : !v.deleted);
    $("#venueTotal").textContent = rows.length === pool.length
      ? `${pool.length} ${plural(pool.length, "площадка", "площадки", "площадок")}`
      : `Показано ${rows.length} из ${pool.length}`;

    body.innerHTML = rows.length ? rows.map(rowHtml).join("") : `
      <tr class="v-empty"><td colspan="12">
        Ничего не найдено. Измените условия фильтра или нажмите «Сбросить».
      </td></tr>`;

    renderCopySource();
    renderCityList();
  }

  function rowHtml(v) {
    const layouts = (v.layoutIds || []).length;
    return `
      <tr data-id="${v.id}"${v.deleted ? ' class="is-deleted"' : ""}>
        <td class="num v-id">${v.id}</td>
        <td class="v-name c-wrap">${esc(v.name)}</td>
        <td class="c-wrap">${esc(v.altName)}</td>
        <td class="c-wrap">${esc(v.address)}</td>
        <td class="c-wrap">${esc(v.building)}</td>
        <td class="c-wrap">${esc(v.buildingAddress)}</td>
        <td>${esc(v.city)}</td>
        <td class="num"><button type="button" class="link-count" data-act="sectors">${v.sectors} ${plural(v.sectors, "сектор", "сектора", "секторов")}</button></td>
        <td><button type="button" class="link-count" data-act="layouts">Список распоясовок (${layouts})</button></td>
        <td><span class="tag ${v.base ? "tag-yes" : "tag-no"}">${v.base ? "Да" : "Нет"}</span></td>
        <td>${esc(v.acceptor)}</td>
        <td class="acts">
          <button type="button" class="rowact" data-act="edit"    title="Редактировать" aria-label="Редактировать">✎</button>
          <button type="button" class="rowact" data-act="copy"    title="Скопировать"   aria-label="Скопировать">⧉</button>
          <button type="button" class="rowact" data-act="sectors" title="Секторы"       aria-label="Секторы">▦</button>
          ${v.deleted
            ? `<button type="button" class="rowact" data-act="restore" title="Восстановить" aria-label="Восстановить">↺</button>`
            : `<button type="button" class="rowact danger" data-act="delete" title="Удалить" aria-label="Удалить">✕</button>`}
        </td>
      </tr>`;
  }

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    return b === 1 ? one : many;
  }

  function renderCopySource() {
    const sel = $("#copySource");
    const keep = sel.value;
    const live = VENUES().filter(v => !v.deleted);
    sel.innerHTML = live.length
      ? live.map(v => `<option value="${v.id}">${esc(v.name)} · ${v.id}</option>`).join("")
      : `<option value="">— нет площадок —</option>`;
    if (keep && live.some(v => String(v.id) === keep)) sel.value = keep;
  }

  function renderCityList() {
    const cities = [...new Set(VENUES().map(v => v.city).filter(Boolean))].sort();
    $("#cityList").innerHTML = cities.map(c => `<option value="${esc(c)}"></option>`).join("");
  }

  /* ---------- форма ---------- */

  const form = $("#venueForm");

  function openForm(venue) {
    editId = venue ? venue.id : null;
    form.reset();
    if (venue) {
      form.name.value = venue.name || "";
      form.altName.value = venue.altName || "";
      form.address.value = venue.address || "";
      form.building.value = venue.building || "";
      form.buildingAddress.value = venue.buildingAddress || "";
      form.city.value = venue.city || "";
      form.sectors.value = venue.sectors ?? 0;
      form.acceptor.value = venue.acceptor || "";
      form.base.checked = !!venue.base;
    }
    $("#venueFormTitle").textContent = venue ? `Правка · ${venue.name}` : "Новая площадка";
    $("#venueSubmit").textContent = venue ? "Сохранить" : "Добавить площадку";
    form.hidden = false;
    form.name.focus();
  }

  function closeForm() {
    form.hidden = true;
    editId = null;
  }

  function formValues() {
    return {
      name: form.name.value.trim(),
      altName: form.altName.value.trim(),
      address: form.address.value.trim(),
      building: form.building.value.trim(),
      buildingAddress: form.buildingAddress.value.trim(),
      city: form.city.value.trim(),
      sectors: Math.max(0, +form.sectors.value || 0),
      acceptor: form.acceptor.value.trim(),
      base: form.base.checked,
    };
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const vals = formValues();
    if (!vals.name) return;

    if (editId != null) {
      AdminStore.update(s => {
        const v = s.VENUES.find(x => x.id === editId);
        if (v) Object.assign(v, vals);
      });
      toast(`Площадка «${vals.name}» сохранена`);
    } else {
      const id = nextId();
      AdminStore.update(s => {
        s.VENUES.push({ id, ...vals, layoutIds: [], deleted: false });
      });
      toast(`Площадка «${vals.name}» добавлена · id ${id}`);
    }
    closeForm();
    render();
  });

  $("#venueCancel").addEventListener("click", closeForm);
  $("#newVenueBtn").addEventListener("click", () => {
    if (!form.hidden && editId == null) closeForm();
    else openForm(null);
  });

  /* ---------- копирование ---------- */

  function copyVenue(src) {
    if (!src) return;
    const id = nextId();
    AdminStore.update(s => {
      s.VENUES.push({
        ...JSON.parse(JSON.stringify(src)),
        id, name: `${src.name} (Копия)`,
        layoutIds: [], base: false, deleted: false,
      });
    });
    render();
    toast(`Создана копия «${src.name}» · id ${id}`);
  }

  $("#copyVenueBtn").addEventListener("click", () => {
    const id = +$("#copySource").value;
    copyVenue(VENUES().find(v => v.id === id));
  });

  /* ---------- действия в строке ---------- */

  body.addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = +btn.closest("tr").dataset.id;
    const v = VENUES().find(x => x.id === id);
    if (!v) return;

    switch (btn.dataset.act) {
      case "edit":
        openForm(v);
        form.scrollIntoView({ block: "nearest", behavior: "smooth" });
        break;
      case "copy":
        copyVenue(v);
        break;
      case "sectors":
      case "layouts":
        // экраны секторов и распоясовок делаются отдельно
        toast("Экран секторов и распоясовок появится позже");
        break;
      case "delete":
        AdminStore.update(s => {
          const t = s.VENUES.find(x => x.id === id);
          if (t) t.deleted = true;
        });
        if (editId === id) closeForm();
        render();
        toast(`«${v.name}» удалена · ищите её под фильтром «Только удалённые»`);
        break;
      case "restore":
        AdminStore.update(s => {
          const t = s.VENUES.find(x => x.id === id);
          if (t) t.deleted = false;
        });
        render();
        toast(`«${v.name}» восстановлена`);
        break;
    }
  });

  /* ---------- фильтры ---------- */

  $("#venueFilters").addEventListener("submit", e => {
    e.preventDefault();
    readFilters();
    render();
  });

  $("#venueResetBtn").addEventListener("click", () => {
    $("#venueFilters").reset();
    filters = { ...DEFAULT_FILTERS };
    render();
  });

  /* правки из других вкладок */
  AdminStore.subscribe(render);

  render();
})();
