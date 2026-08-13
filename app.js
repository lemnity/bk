/* ============================================================
   ТБДТ · Театральная касса — interaction logic (light)
   Hall plan reconstructed from the venue layout:
   top parterre + side boxes, three amphitheatre blocks,
   and front balcony clusters.
   ============================================================ */
(() => {
  "use strict";

  /* ---------- price tiers (₽) → colour, matching legend ---------- */
  const TIERS = [
    { price: 1000, color: "#2f37c4" },
    { price: 1500, color: "#3f8fe0" },
    { price: 2000, color: "#46d6e0" },
    { price: 2500, color: "#5fd98a" },
    { price: 3000, color: "#46c35a" },
    { price: 3500, color: "#8ce05f" },
    { price: 4000, color: "#b7e05f" },
    { price: 4500, color: "#e9e15f" },
    { price: 5000, color: "#e8943f" },
    { price: 5500, color: "#e0533f" },
    { price: 6000, color: "#e04f8c" },
  ];
  const SERVICE_FEE = 200; // ₽ per ticket
  const BONUS_RATE = 0.05; // 5% бонусов от стоимости билетов
  const fmt = (n) => n.toLocaleString("ru-RU") + " ₽";
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  /* ---------- seeded PRNG (stable layout) ---------- */
  let _seed = 20260608;
  const rng = () => {
    _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
    return _seed / 0x7fffffff;
  };

  const state = { dateIdx: 1, time: "17:00", selected: new Map() };

  const $ = (s) => document.querySelector(s);
  const hallPlan    = $("#hallPlan");
  const orderListEl = $("#orderList");
  const orderEmpty  = $("#orderEmpty");
  const dateRail    = $("#dateRail");

  /* ============================================================ LEGEND */
  function buildLegend() {
    const el = $("#legend");
    const busy = `<span class="leg-item busy"><span class="leg-sw"></span>Занято</span>`;
    el.innerHTML = busy + TIERS.map(t =>
      `<span class="leg-item"><span class="leg-sw" style="--sw:${t.color}"></span>${t.price.toLocaleString("ru-RU")}&nbsp;₽</span>`
    ).join("");
  }

  /* ============================================================
     HALL PLAN
     A seat's tier = block base + centrality bonus − row penalty,
     so the centre-front is premium and the edges/back get cheaper.
     ============================================================ */
  function tierFor(base, rowIdx, col, width, spread, rowStep) {
    const centre = (width - 1) / 2;
    const centrality = centre === 0 ? 1 : 1 - Math.abs(col - centre) / centre; // 0..1
    let t = base + Math.round(centrality * spread) - Math.floor(rowIdx * rowStep);
    return clamp(t, 0, TIERS.length - 1);
  }

  function makeSeat(section, rowLabel, seatNo, tierIdx) {
    const tier = TIERS[tierIdx];
    const seat = document.createElement("button");
    seat.className = "seat";
    seat.style.setProperty("--c", tier.color);
    const id = `${section.key}-${rowLabel}-${seatNo}`;
    seat.dataset.id = id;
    seat.dataset.tier = tierIdx;
    seat.dataset.row = rowLabel;
    seat.dataset.no = seatNo;
    seat.dataset.section = section.title;
    seat.dataset.tip = `${section.title} · ряд ${rowLabel}, место ${seatNo} — ${fmt(tier.price)}`;
    seat.setAttribute("aria-label", seat.dataset.tip);
    seat.textContent = seatNo;
    if (rng() < (section.busy ?? 0.42)) {
      seat.classList.add("busy");
      seat.removeAttribute("data-tip");
    }
    return seat;
  }

  // a rectangular block of seats
  function buildBlock(section) {
    const block = document.createElement("div");
    block.className = "block";
    if (section.title) {
      const t = document.createElement("div");
      t.className = "block-title";
      t.textContent = section.title;
      block.appendChild(t);
    }
    section.rows.forEach((width, r) => {
      const row = document.createElement("div");
      row.className = "seat-row";
      const rowLabel = r + 1;
      for (let c = 0; c < width; c++) {
        const tierIdx = tierFor(section.base, r, c, width, section.spread, section.rowStep);
        row.appendChild(makeSeat(section, rowLabel, c + 1, tierIdx));
      }
      block.appendChild(row);
    });
    return block;
  }

  // diagonal stack of boxes (ложи) — one seat per step, indented like a staircase
  function buildBoxes(section, side) {
    const box = document.createElement("div");
    box.className = "boxes " + side;
    section.steps.forEach((tierIdx, i) => {
      const row = document.createElement("div");
      row.className = "seat-row box-step";
      const indent = side === "left" ? i * 14 : (section.steps.length - 1 - i) * 14;
      row.style.setProperty("--ml", indent + "px");
      row.style.marginLeft = indent + "px";
      row.appendChild(makeSeat(section, "ложа", i + 1, tierIdx));
      box.appendChild(row);
    });
    return box;
  }

  function buildHall() {
    hallPlan.innerHTML = "";

    /* — Band 1: side boxes + parterre (nearest the stage, premium) — */
    const band1 = document.createElement("div");
    band1.className = "plan-band with-sides";

    band1.appendChild(buildBoxes(
      { key: "boxL", title: "Ложа лев.", steps: [9, 8, 8, 7, 7, 6], busy: 0.3 }, "left"));

    band1.appendChild(buildBlock({
      key: "par", title: "Партер", base: 6, spread: 4, rowStep: 0.5, busy: 0.4,
      rows: [20, 22, 24, 24, 26, 26, 24],
    }));

    band1.appendChild(buildBoxes(
      { key: "boxR", title: "Ложа прав.", steps: [9, 8, 8, 7, 7, 6], busy: 0.3 }, "right"));

    hallPlan.appendChild(band1);

    /* — Band 2: three amphitheatre blocks — */
    const band2 = document.createElement("div");
    band2.className = "plan-band";

    band2.appendChild(buildBlock({
      key: "amfL", title: "Амфитеатр · левый", base: 2, spread: 3, rowStep: 0.25, busy: 0.45,
      rows: [8, 9, 9, 10, 10, 11, 11, 12],
    }));
    band2.appendChild(buildBlock({
      key: "amfC", title: "Амфитеатр · центр", base: 4, spread: 4, rowStep: 0.4, busy: 0.45,
      rows: [16, 18, 18, 20, 20, 20, 18, 16, 14],
    }));
    band2.appendChild(buildBlock({
      key: "amfR", title: "Амфитеатр · правый", base: 2, spread: 3, rowStep: 0.25, busy: 0.45,
      rows: [8, 9, 9, 10, 10, 11, 11, 12],
    }));

    hallPlan.appendChild(band2);

    /* — Band 3: front balcony clusters (farthest, cheapest) — */
    const band3 = document.createElement("div");
    band3.className = "plan-band";

    band3.appendChild(buildBlock({
      key: "balL", title: "Балкон · лев.", base: 0, spread: 2, rowStep: 0.2, busy: 0.4,
      rows: [7, 8, 6],
    }));
    band3.appendChild(buildBlock({
      key: "balC", title: "Балкон · центр", base: 1, spread: 2, rowStep: 0.3, busy: 0.4,
      rows: [9, 7, 5],
    }));
    band3.appendChild(buildBlock({
      key: "balR", title: "Балкон · прав.", base: 0, spread: 2, rowStep: 0.2, busy: 0.4,
      rows: [7, 8, 6],
    }));

    hallPlan.appendChild(band3);
  }

  /* ============================================================ SELECTION */
  hallPlan.addEventListener("click", (e) => {
    const seat = e.target.closest(".seat");
    if (!seat || seat.classList.contains("busy")) return;
    const id = seat.dataset.id;

    if (state.selected.has(id)) {
      state.selected.delete(id);
      seat.classList.remove("selected");
    } else {
      if (state.selected.size >= 12) { toast("Можно выбрать не более 12 мест за раз"); return; }
      const tier = TIERS[+seat.dataset.tier];
      state.selected.set(id, {
        id, row: seat.dataset.row, no: +seat.dataset.no,
        section: seat.dataset.section, price: tier.price, color: tier.color,
      });
      seat.classList.add("selected");
    }
    renderOrder();
  });

  /* ============================================================ TOOLTIP
     A single <body>-level node, positioned above the hovered seat with
     getBoundingClientRect so it overflows the scrollable hall frame.
     ============================================================ */
  const tipEl = $("#seatTip");
  function showTip(seat) {
    const tip = seat.dataset.tip;
    if (!tip) return;
    const [label, price] = tip.split(" — ");
    tipEl.innerHTML = price
      ? `${label}<span class="st-price">${price}</span>` : label;
    const r = seat.getBoundingClientRect();
    tipEl.style.left = r.left + r.width / 2 + "px";
    tipEl.style.top = r.top + "px";
    tipEl.classList.add("show");
  }
  function hideTip() { tipEl.classList.remove("show"); }

  hallPlan.addEventListener("mouseover", (e) => {
    const seat = e.target.closest(".seat");
    if (seat && !seat.classList.contains("busy")) showTip(seat);
  });
  hallPlan.addEventListener("mouseout", (e) => {
    const seat = e.target.closest(".seat");
    if (seat) hideTip();
  });
  hallPlan.addEventListener("focusin", (e) => {
    const seat = e.target.closest(".seat");
    if (seat && !seat.classList.contains("busy")) showTip(seat);
  });
  hallPlan.addEventListener("focusout", hideTip);
  $(".seatmap-scroll").addEventListener("scroll", hideTip, { passive: true });
  window.addEventListener("scroll", hideTip, { passive: true });

  /* ============================================================ EXPAND */
  const expandBtn = $("#expandHallBtn");
  expandBtn.addEventListener("click", () => {
    const wide = document.getElementById("hall").classList.toggle("wide");
    expandBtn.setAttribute("aria-pressed", String(wide));
    expandBtn.querySelector(".he-text").textContent = wide ? "Свернуть" : "Раскрыть по ширине";
    hideTip();
  });

  /* ============================================================ ORDER */
  function renderOrder() {
    const seats = [...state.selected.values()];
    const count = seats.length;

    orderListEl.querySelectorAll(".order-item").forEach((n) => n.remove());
    orderEmpty.style.display = count ? "none" : "block";

    seats.forEach((s) => {
      const li = document.createElement("li");
      li.className = "order-item";
      li.innerHTML = `
        <span class="oi-chip" style="background:${s.color}"></span>
        <span class="oi-info">
          <span class="oi-seat">Ряд ${s.row}, место ${s.no}</span>
          <span class="oi-zone">${s.section}</span>
        </span>
        <span class="oi-price">${fmt(s.price)}</span>
        <button class="oi-rm" data-id="${s.id}" aria-label="Убрать место">✕</button>`;
      orderListEl.appendChild(li);
    });

    const subtotal = seats.reduce((a, s) => a + s.price, 0);
    const fee = count * SERVICE_FEE;
    const bonus = Math.round(subtotal * BONUS_RATE);
    $("#totalCount").textContent = count;
    $("#totalFee").textContent = fmt(fee);
    $("#totalSum").textContent = fmt(subtotal + fee);
    $("#totalBonus").textContent = "+" + fmt(bonus);
    $("#checkoutBtn").disabled = count === 0;

    const badge = $("#headCartCount");
    badge.textContent = count;
    badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump");
  }

  orderListEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".oi-rm");
    if (!btn) return;
    const id = btn.dataset.id;
    state.selected.delete(id);
    const seat = hallPlan.querySelector(`.seat[data-id="${CSS.escape(id)}"]`);
    if (seat) seat.classList.remove("selected");
    renderOrder();
  });

  /* ============================================================ DATES */
  const WD = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
  const MON = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  // left — остаток билетов на дату, cap — вместимость (для шкалы индикатора)
  const DATE_CAP = 200;
  const DATES = [
    { d: 7,  m: 5, wd: 0, times: ["19:00"],          left: 0   },
    { d: 8,  m: 5, wd: 1, times: ["17:00", "21:00"], left: 48, seats: { "17:00": 30, "21:00": 6 } },
    { d: 9,  m: 5, wd: 2, times: ["19:00"],          left: 2   },
    { d: 10, m: 5, wd: 3, times: ["19:00"],          left: 6   },
    { d: 11, m: 5, wd: 4, times: ["19:30"],          left: 27  },
    { d: 14, m: 5, wd: 0, times: ["18:00"],          left: 0   },
    { d: 16, m: 5, wd: 2, times: ["19:00"],          left: 124 },
  ];

  // склонение слова «билет»
  const ticketWord = (n) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return "билетов";
    if (b === 1) return "билет";
    if (b >= 2 && b <= 4) return "билета";
    return "билетов";
  };
  // состояние остатков → класс + подпись
  function availability(left) {
    if (left <= 0)  return { cls: "sold", text: "Билетов нет" };
    if (left <= 10) return { cls: "low",  text: `Осталось ${left} ${ticketWord(left)}` };
    if (left <= 40) return { cls: "mid",  text: `Осталось ${left} ${ticketWord(left)}` };
    return { cls: "ok", text: "Билеты есть" };
  }

  function buildDates() {
    dateRail.innerHTML = "";
    DATES.forEach((dt, i) => {
      const av = availability(dt.left);
      const pct = Math.max(2, Math.min(100, Math.round((dt.left / DATE_CAP) * 100)));
      const card = document.createElement("button");
      card.className = "date-card " + av.cls + (i === state.dateIdx ? " active" : "");
      card.setAttribute("role", "tab");
      if (av.cls === "sold") card.setAttribute("aria-disabled", "true");
      card.dataset.idx = i;
      card.innerHTML = `
        <div class="dc-day"><b>${dt.d}</b> ${MON[dt.m]}</div>
        <div class="dc-wd">${WD[dt.wd]}</div>
        <div class="dc-times">${dt.times.map(t => `<span class="dc-time">${t}</span>`).join("")}</div>
        <div class="dc-avail">
          <span class="dc-bar"><span class="dc-bar-fill" style="width:${av.cls === "sold" ? 0 : pct}%"></span></span>
          <span class="dc-left">${av.text}</span>
        </div>`;
      dateRail.appendChild(card);
    });
  }

  dateRail.addEventListener("click", (e) => {
    const card = e.target.closest(".date-card");
    if (!card) return;
    const idx = +card.dataset.idx;
    if (DATES[idx].left <= 0) { toast("На эту дату билетов нет — выберите другую"); return; }
    state.dateIdx = idx;
    state.time = DATES[state.dateIdx].times[0];
    dateRail.querySelectorAll(".date-card").forEach((c) =>
      c.classList.toggle("active", +c.dataset.idx === state.dateIdx));
    renderSession();
  });

  // остаток билетов на конкретный сеанс (по карте seats или поровну от дневного)
  function seatsForTime(dt, t) {
    if (dt.seats && dt.seats[t] != null) return dt.seats[t];
    return Math.round(dt.left / dt.times.length);
  }

  function renderSession() {
    const dt = DATES[state.dateIdx];
    $("#sessionDate").textContent = `${dt.d} ${MON[dt.m]} '26 в ${state.time}`;
    const multi = dt.times.length >= 2; // индикатор билетов показываем при 2+ сеансах
    const st = $("#sessionTimes");
    st.classList.toggle("with-avail", multi);
    st.innerHTML = dt.times.map(t => {
      const left = seatsForTime(dt, t);
      const av = availability(left);
      const avail = multi
        ? `<span class="time-avail ${av.cls}">${left > 0 ? left + " " + ticketWord(left) : "нет билетов"}</span>`
        : "";
      return `<div class="time-slot">
        <button class="time-chip${t === state.time ? " active" : ""}" data-t="${t}">${t}</button>
        ${avail}
      </div>`;
    }).join("");
  }

  $("#sessionTimes").addEventListener("click", (e) => {
    const chip = e.target.closest(".time-chip");
    if (!chip) return;
    state.time = chip.dataset.t;
    renderSession();
  });

  /* ============================================================ CHECKOUT */
  const modal = $("#checkoutModal");

  function openCheckout() {
    if (!state.selected.size) return;
    const seats = [...state.selected.values()];
    const subtotal = seats.reduce((a, s) => a + s.price, 0);
    const grand = subtotal + seats.length * SERVICE_FEE;

    $("#ckSeatList").innerHTML = seats.map(s =>
      `<li><span>${s.section}, р.${s.row} м.${s.no}</span><span class="cs-price">${fmt(s.price)}</span></li>`
    ).join("") + `<li><span>Сервисный сбор × ${seats.length}</span><span class="cs-price">${fmt(seats.length * SERVICE_FEE)}</span></li>`;
    $("#ckTotal").textContent = fmt(grand);
    $("#payAmount").textContent = fmt(grand);

    $("#checkoutView").hidden = false;
    $("#successView").hidden = true;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal() { modal.classList.remove("open"); document.body.style.overflow = ""; }

  $("#checkoutBtn").addEventListener("click", openCheckout);
  $("#headCartBtn").addEventListener("click", () => {
    if (state.selected.size) openCheckout();
    else document.getElementById("hall").scrollIntoView({ behavior: "smooth" });
  });
  modal.addEventListener("click", (e) => { if (e.target.hasAttribute("data-close")) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
  });

  $("#ckForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const payBtn = $("#payBtn");
    payBtn.disabled = true;
    payBtn.innerHTML = "Обработка…";

    setTimeout(() => {
      const seats = [...state.selected.values()];
      const grand = seats.reduce((a, s) => a + s.price, 0) + seats.length * SERVICE_FEE;

      $("#successSeats").textContent = seats.map(s => `${s.section} р.${s.row} м.${s.no}`).join("  ·  ");
      $("#successTotal").textContent = fmt(grand);
      $("#checkoutView").hidden = true;
      $("#successView").hidden = false;

      seats.forEach((s) => {
        const el = hallPlan.querySelector(`.seat[data-id="${CSS.escape(s.id)}"]`);
        if (el) { el.classList.remove("selected"); el.classList.add("busy"); el.removeAttribute("data-tip"); }
      });
      state.selected.clear();
      renderOrder();

      payBtn.disabled = false;
      payBtn.innerHTML = `Оплатить <span id="payAmount">0 ₽</span>`;
      form.reset();
    }, 1100);
  });

  /* ============================================================ TOAST */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  /* ============================================================ MORE THIS MONTH */
  const REPERTOIRE = [
    { title: "Чайка",        genre: "Комедия",  date: "18 июня · 19:00", hall: "Большой зал", age: "12+", price: 1200, hue: ["#2c2e5c", "#5b5fae"], img: "assets/repertoire/play-1.webp" },
    { title: "Вишнёвый сад", genre: "Драма",    date: "21 июня · 18:00", hall: "Большой зал", age: "12+", price: 1500, hue: ["#7a2f4f", "#e04f8c"], img: "assets/repertoire/play-2.webp" },
    { title: "Ревизор",      genre: "Комедия",  date: "25 июня · 19:00", hall: "Малая сцена", age: "16+", price: 900,  hue: ["#1f5a4c", "#46c35a"], img: "assets/repertoire/play-3.webp" },
    { title: "Щелкунчик",    genre: "Балет",    date: "28 июня · 12:00", hall: "Большой зал", age: "0+",  price: 1800, hue: ["#7a3a1f", "#e9943f"], img: "assets/repertoire/play-4.webp" },
  ];

  function buildMore() {
    const grid = $("#moreGrid");
    if (!grid) return;
    grid.innerHTML = REPERTOIRE.map((s, i) => `
      <article class="show-card">
        <div class="sc-poster" style="background:linear-gradient(150deg,${s.hue[0]},${s.hue[1]})">
          <span class="sc-mark" aria-hidden="true">${s.title.charAt(0)}</span>
          ${s.img ? `<img class="sc-img" src="${s.img}" alt="${s.title}" loading="lazy" onerror="this.remove()">` : ""}
          <span class="sc-age">${s.age}</span>
        </div>
        <div class="sc-body">
          <span class="sc-genre">${s.genre}</span>
          <h3 class="sc-title">${s.title}</h3>
          <p class="sc-meta">${s.date}<br>${s.hall}</p>
          <div class="sc-foot">
            <span class="sc-price">от ${s.price.toLocaleString("ru-RU")} ₽</span>
            <button class="btn sc-btn" data-i="${i}">Билеты</button>
          </div>
        </div>
      </article>`).join("");
  }

  $("#moreGrid").addEventListener("click", (e) => {
    const btn = e.target.closest(".sc-btn");
    if (!btn) return;
    const s = REPERTOIRE[+btn.dataset.i];
    toast(`«${s.title}» · ${s.date} — билеты скоро в продаже`);
  });

  /* ============================================================ INIT */
  buildLegend();
  buildHall();
  buildDates();
  renderSession();
  renderOrder();
  buildMore();

  /* ---------- scroll reveal ---------- */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          e.target.style.transitionDelay = Math.min(i * 60, 240) + "ms";
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- header condensation ---------- */
  const head = document.querySelector(".site-head");
  if (head) {
    const onScroll = () => head.classList.toggle("scrolled", window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
