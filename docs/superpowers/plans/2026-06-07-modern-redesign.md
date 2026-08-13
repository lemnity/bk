# Современный редизайн ТБДТ — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пересобрать дизайн публичной страницы и кабинета администратора ТБДТ в современном светлом стиле (navy + gold, Manrope + Unbounded, сдержанные плавные анимации), не сломав существующую функциональность.

**Architecture:** Чистая переработка CSS обеих страниц поверх общего набора дизайн-токенов в `:root`. Удаление винтажного слоя (grain/vignette, засечные шрифты). Тонкий слой анимаций через CSS-переходы + один общий IntersectionObserver-хелпер для scroll-reveal. Все функциональные `id`/классы DOM, на которые завязаны `app.js` и `admin.js`, сохраняются без изменений.

**Tech Stack:** Статический HTML/CSS/Vanilla JS. Шрифты Google Fonts (Manrope, Unbounded). IntersectionObserver для reveal.

**Спецификация:** `docs/superpowers/specs/2026-06-07-modern-redesign-design.md`

---

## Способ проверки (важно — здесь нет юнит-тестов)

Проект статический. «Тест» каждой задачи — **визуальная и функциональная проверка в браузере**:

- Запуск локального сервера: `python3 -m http.server 8080` в корне проекта (`/Users/thesimakov/Documents/GitHub/bk`).
- Публичная: `http://localhost:8080/index.html` — проверить, что страница рендерится без ошибок в консоли, выбор мест работает, корзина пересчитывается, модалка открывается, экран успеха показывается.
- Админка: `http://localhost:8080/admin.html` — переключение вкладок, баннер, KPI, графики, таблицы цен/бухгалтерии, редактор зала.
- При наличии — использовать skill `webapp-testing` (Playwright) для скриншотов и проверки консоли; иначе открыть вручную и проверить DevTools Console на отсутствие ошибок.
- Проверять `prefers-reduced-motion` (DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce) — анимации должны выключаться.

**Контракт неизменности:** перед любой правкой HTML сверяться с `app.js` / `admin.js` (`document.querySelector`/`getElementById`/`classList`), чтобы не переименовать/не удалить используемые `id` и классы. Менять можно: визуальные стили, обёрточную разметку, добавление data-атрибутов для reveal.

---

## Task 1: Общие дизайн-токены и подключение шрифтов

**Files:**
- Modify: `index.html` (head: блок `<link>` шрифтов)
- Modify: `admin.html` (head: блок `<link>` шрифтов; удалить `<div class="grain">`)
- Modify: `styles.css:1-67` (блок `:root` и `body`, удалить `.grain`/`.vignette` стили)
- Modify: `admin.css` (блок `:root`/`body`, удалить `.grain`)

- [ ] **Step 1: Заменить подключение шрифтов в обоих HTML**

В `index.html` и `admin.html` заменить текущий Google Fonts `<link>` (Rubik + Unbounded) на:

```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Удалить винтажную атмосферу из разметки**

В `index.html` удалить строки:
```html
<div class="grain" aria-hidden="true"></div>
<div class="vignette" aria-hidden="true"></div>
```
В `admin.html` удалить:
```html
<div class="grain" aria-hidden="true"></div>
```

- [ ] **Step 3: Задать общий `:root` в `styles.css`**

Заменить текущий `:root` на единый токен-набор (тот же блок продублировать в `admin.css`, чтобы страницы были консистентны):

```css
:root{
  --bg:        #FAFAF8;
  --surface:   #FFFFFF;
  --surface-2: #F4F3EF;

  --ink:       #16161A;
  --ink-2:     #6B6B73;
  --ink-mute:  #9A9AA2;

  --navy:      #1E2042;
  --navy-hi:   #2C2E5C;
  --gold:      #E6B81C;
  --gold-deep: #A8810F;

  --line:      rgba(20,20,30,.08);
  --line-2:    rgba(20,20,30,.14);

  --ok:        #2f9e5e;
  --warn:      #c0492f;

  --font-disp: "Unbounded", system-ui, sans-serif;
  --font-ui:   "Manrope", system-ui, sans-serif;

  --r-sm: 10px;
  --r:    14px;
  --r-lg: 20px;

  --maxw: 1280px;
  --gutter: clamp(20px, 4vw, 44px);

  --ease: cubic-bezier(.22,.61,.36,1);
  --t-fast: .18s;
  --t: .32s;

  --sh-sm: 0 1px 2px rgba(20,20,30,.05), 0 2px 8px -4px rgba(20,20,30,.10);
  --sh-md: 0 4px 12px -4px rgba(20,20,30,.10), 0 16px 40px -24px rgba(20,20,30,.22);
  --sh-lg: 0 24px 70px -40px rgba(20,20,30,.35);
}
```

- [ ] **Step 4: Обновить `body` и убрать grain/vignette CSS**

В обоих CSS заменить фон `body` на чистый светлый и удалить правила `.grain`/`.vignette`:

```css
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  font-family:var(--font-ui);
  background:var(--bg);
  color:var(--ink);
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
}
a{color:inherit;text-decoration:none}
::selection{background:var(--navy);color:#fff}
```

- [ ] **Step 5: Добавить глобальный reduced-motion и базовый reveal-класс (в оба CSS)**

```css
[data-reveal]{opacity:0;transform:translateY(16px);transition:opacity .5s var(--ease), transform .5s var(--ease)}
[data-reveal].is-in{opacity:1;transform:none}
@media (prefers-reduced-motion: reduce){
  *{animation:none !important;transition:none !important;scroll-behavior:auto !important}
  [data-reveal]{opacity:1;transform:none}
}
```

- [ ] **Step 6: Проверка**

Запустить `python3 -m http.server 8080`, открыть обе страницы. Ожидается: текст рендерится новыми шрифтами (Manrope в теле), фон чистый светлый без зерна, нет ошибок в консоли. Вёрстка пока «сырая» — это нормально.

- [ ] **Step 7: Commit**

```bash
git add index.html admin.html styles.css admin.css
git commit -m "feat(design): shared light tokens, Manrope+Unbounded fonts, remove grain"
```

---

## Task 2: Общие компоненты публичной страницы (kicker, section-head, кнопки)

**Files:**
- Modify: `styles.css` (правила `.kicker`, `.section-head`, `.section-eyebrow`, `.se-num`, `.section-title`, `.section-note`, `.btn*`)

- [ ] **Step 1: Переработать заголовки секций и кикеры**

```css
.kicker{font-family:var(--font-ui);font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;color:var(--navy);font-weight:700}
.kicker-dark{color:var(--gold-deep)}
.section-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px 28px;margin-bottom:36px;padding-bottom:18px;border-bottom:1px solid var(--line)}
.sh-left{display:flex;flex-direction:column;gap:12px}
.section-eyebrow{display:inline-flex;align-items:center;gap:12px;font-family:var(--font-ui);font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-deep);font-weight:700}
.se-num{font-size:.66rem;color:var(--navy);background:rgba(30,32,66,.07);border:1px solid var(--line);border-radius:6px;padding:3px 7px;letter-spacing:.05em}
.section-title{font-family:var(--font-disp);font-weight:600;font-size:clamp(1.9rem,4.4vw,2.9rem);letter-spacing:-.01em;color:var(--ink);line-height:1.02}
.section-note{font-family:var(--font-ui);font-size:1rem;color:var(--ink-2)}
```

- [ ] **Step 2: Переработать кнопки (без uppercase-трекинга «плаката», современная пилюля)**

```css
.btn{font-family:var(--font-ui);font-weight:600;font-size:.92rem;letter-spacing:.01em;border:none;cursor:pointer;border-radius:999px;padding:14px 26px;display:inline-flex;align-items:center;gap:.55em;transition:transform var(--t) var(--ease), box-shadow var(--t) var(--ease), background var(--t-fast)}
.btn:active{transform:translateY(1px)}
.btn-primary{background:var(--navy);color:#fff;box-shadow:var(--sh-sm)}
.btn-primary:hover{background:var(--navy-hi);transform:translateY(-2px);box-shadow:var(--sh-md)}
.btn-primary:disabled{background:#D9D9D2;color:#9A9AA2;cursor:not-allowed;box-shadow:none;transform:none}
.btn-ghost{background:transparent;color:var(--navy);border:1px solid var(--line-2)}
.btn-ghost:hover{background:var(--surface-2);border-color:var(--navy)}
.btn-block{width:100%;justify-content:center}
```

- [ ] **Step 3: Проверка** — открыть `index.html`, убедиться: заголовки секций, кикеры и кнопки выглядят чисто и современно, hover-подъём кнопок плавный.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "feat(design): modern section headers and buttons (public)"
```

---

## Task 3: Хедер и hero публичной страницы

**Files:**
- Modify: `styles.css` (`.site-head`, `.head-*`, `.brand*`, `.hero*`, `.ht-line`)
- Modify: `index.html` (добавить `data-reveal` на `.hero-copy` детей при необходимости — без удаления существующих классов)

- [ ] **Step 1: Хедер**

```css
.site-head{position:sticky;top:0;z-index:200;backdrop-filter:blur(12px);background:rgba(250,250,248,.78);border-bottom:1px solid var(--line);transition:background var(--t), box-shadow var(--t)}
.site-head.scrolled{background:rgba(250,250,248,.95);box-shadow:var(--sh-sm)}
.head-inner{max-width:var(--maxw);margin:0 auto;padding:14px var(--gutter);display:flex;align-items:center;gap:32px}
.brand{display:flex;align-items:center;gap:14px}
.brand-logo{height:38px;width:auto;display:block}
.head-nav{display:flex;gap:28px;margin-left:auto;font-weight:500;font-size:.95rem}
.head-nav a{position:relative;color:var(--ink-2);transition:color var(--t-fast)}
.head-nav a::after{content:"";position:absolute;left:0;right:100%;bottom:-6px;height:2px;background:var(--gold);transition:right var(--t) var(--ease)}
.head-nav a:hover{color:var(--ink)}
.head-nav a:hover::after{right:0}
.nav-admin{color:var(--navy);font-weight:600}
.head-cart{position:relative;display:inline-flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line-2);border-radius:999px;padding:9px 14px;cursor:pointer;transition:transform var(--t-fast),box-shadow var(--t-fast)}
.head-cart:hover{transform:translateY(-1px);box-shadow:var(--sh-sm)}
.hc-count{min-width:20px;height:20px;display:inline-grid;place-items:center;background:var(--gold);color:var(--navy);font-weight:700;font-size:.78rem;border-radius:999px;padding:0 5px}
```

- [ ] **Step 2: Hero**

```css
.hero{position:relative;min-height:clamp(540px,72vh,760px);display:flex;align-items:center;overflow:hidden}
.hero-photo{position:absolute;inset:0;background:url("assets/cover.webp") center/cover no-repeat;transform:scale(1.06);animation:heroZoom 1.4s var(--ease) forwards}
@keyframes heroZoom{to{transform:scale(1)}}
.hero-scrim{position:absolute;inset:0;background:linear-gradient(100deg, rgba(250,250,248,.96) 0%, rgba(250,250,248,.86) 34%, rgba(250,250,248,.25) 66%, transparent 100%)}
.hero-inner{position:relative;max-width:var(--maxw);margin:0 auto;padding:0 var(--gutter);width:100%}
.hero-copy{max-width:560px;display:flex;flex-direction:column;gap:20px}
.hero-title{font-family:var(--font-disp);font-weight:700;line-height:.98;letter-spacing:-.02em;font-size:clamp(2.8rem,8vw,5.4rem);color:var(--ink)}
.ht-line{display:block;opacity:0;transform:translateY(20px);animation:heroLine .7s var(--ease) forwards}
.ht-1{animation-delay:.15s}.ht-2{animation-delay:.28s;color:var(--navy)}
@keyframes heroLine{to{opacity:1;transform:none}}
.hero-author{font-size:1.05rem;color:var(--ink-2)}
.hero-actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:4px}
.hero-facts{display:flex;flex-wrap:wrap;gap:24px 36px;margin-top:14px;padding-top:20px;border-top:1px solid var(--line)}
.hero-facts dt{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);font-weight:600}
.hero-facts dd{font-family:var(--font-disp);font-weight:500;font-size:1.1rem;color:var(--ink);margin-top:4px}
```

- [ ] **Step 3: Проверка** — hero рендерится: фото с лёгким зумом, заголовок «выезжает» построчно, скрим читаемый слева, факты в строку. Хедер «уплотняется» при скролле (класс `.scrolled` появится в Task 8; пока проверить статичный вид).

- [ ] **Step 4: Commit**

```bash
git add styles.css index.html
git commit -m "feat(design): modern header and hero (public)"
```

---

## Task 4: Лента дат и session-bar

**Files:**
- Modify: `styles.css` (`.dates`, `.date-rail`, `.date-card`/динамические классы, `.session-bar`, `.session-info`, `.session-times`)

**Перед началом:** проверить в `app.js`, какие классы навешиваются на карточки дат и кнопки времени (искать `dateRail`, `sessionTimes`, `classList.add`), и стилизовать именно их.

- [ ] **Step 1: Секция и контейнеры**

```css
.dates{max-width:var(--maxw);margin:0 auto;padding:clamp(56px,9vw,96px) var(--gutter) 0}
.date-rail{display:flex;gap:14px;overflow-x:auto;padding:4px 0 18px;scroll-snap-type:x mandatory}
```

- [ ] **Step 2: Карточки дат (таблетки) — использовать фактические классы из `app.js`**

Стилизовать карточку-кнопку даты (контур, число крупно Unbounded, месяц/день мелко); активное состояние — navy-заливка + золотая нижняя метка:

```css
.date-card{flex:0 0 auto;scroll-snap-align:start;min-width:92px;background:var(--surface);border:1px solid var(--line-2);border-radius:var(--r);padding:14px 16px;cursor:pointer;text-align:center;transition:transform var(--t-fast),border-color var(--t-fast),box-shadow var(--t-fast)}
.date-card:hover{transform:translateY(-2px);box-shadow:var(--sh-sm);border-color:var(--navy)}
.date-card .dc-num{font-family:var(--font-disp);font-weight:600;font-size:1.6rem;display:block}
.date-card .dc-mon,.date-card .dc-dow{font-size:.74rem;color:var(--ink-2);text-transform:uppercase;letter-spacing:.08em}
.date-card.active{background:var(--navy);color:#fff;border-color:var(--navy)}
.date-card.active .dc-mon,.date-card.active .dc-dow{color:rgba(255,255,255,.7)}
.date-card.active::after{content:"";display:block;height:3px;width:28px;margin:8px auto 0;background:var(--gold);border-radius:2px}
```

> Если в `app.js` классы названы иначе (например `dc`/`is-active`), привести селекторы к фактическим именам — НЕ менять JS.

- [ ] **Step 3: Session-bar**

```css
.session-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-top:22px;padding:18px 22px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh-sm)}
.session-info{display:flex;flex-direction:column;gap:2px}
.si-date{font-family:var(--font-disp);font-weight:500;font-size:1.1rem}
.si-hall{font-size:.85rem;color:var(--ink-2)}
.session-times{display:flex;gap:10px;flex-wrap:wrap}
.session-times button{font-family:var(--font-ui);font-weight:600;border:1px solid var(--line-2);background:var(--surface);border-radius:999px;padding:9px 16px;cursor:pointer;transition:all var(--t-fast)}
.session-times button:hover{border-color:var(--navy)}
.session-times button.active{background:var(--navy);color:#fff;border-color:var(--navy)}
```

- [ ] **Step 4: Проверка** — даты прокручиваются, активная подсвечена navy+gold, клик меняет активную и session-bar, времена-чипы переключаются.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "feat(design): date rail and session bar (public)"
```

---

## Task 5: Зал, схема мест и корзина заказа

**Files:**
- Modify: `styles.css` (`.hall*`, `.legend`, `.stage*`, `.screen-glow`, `.seatmap-scroll`, `.hall-plan`, места, `.hall-hint`, `.order*`, `.ot-*`, `.seat-tip`)

**Перед началом:** в `app.js` найти, какие классы у мест (свободно/выбрано/занято) и у элементов списка заказа — стилизовать фактические имена.

- [ ] **Step 1: Каркас зала и тулбар**

```css
.hall{max-width:var(--maxw);margin:0 auto;padding:clamp(56px,9vw,96px) var(--gutter) 0}
.hall-shell{display:grid;grid-template-columns:1fr 360px;gap:28px;align-items:start}
.hall-main{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:22px;box-shadow:var(--sh-sm)}
.hall-toolbar{display:flex;justify-content:flex-end;margin-bottom:12px}
.hall-expand{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-ui);font-weight:600;font-size:.85rem;border:1px solid var(--line-2);background:var(--surface);border-radius:999px;padding:8px 14px;cursor:pointer;transition:all var(--t-fast)}
.hall-expand:hover{border-color:var(--navy)}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
```

- [ ] **Step 2: Сцена (тонкая дуга + мягкое свечение вместо неона)**

```css
.stage-wrap{position:relative;display:flex;justify-content:center;margin:8px 0 26px}
.screen-glow{position:absolute;top:50%;left:50%;width:70%;height:120px;transform:translate(-50%,-40%);background:radial-gradient(60% 100% at 50% 0%, rgba(230,184,28,.18), transparent 70%);filter:blur(6px);pointer-events:none}
.stage{position:relative;font-family:var(--font-disp);font-weight:500;letter-spacing:.3em;text-transform:uppercase;font-size:.8rem;color:var(--ink-2);padding:10px 60px;border:1px solid var(--line-2);border-radius:0 0 100px 100px/0 0 40px 40px;background:var(--surface-2)}
```

- [ ] **Step 3: Места — состояния (привести к фактическим классам из `app.js`)**

```css
.seatmap-scroll{overflow:auto;padding:6px}
.hall-plan{display:flex;flex-direction:column;gap:7px;align-items:center;min-width:max-content}
.seat{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--line-2);background:var(--surface);cursor:pointer;transition:transform var(--t-fast) var(--ease),background var(--t-fast),border-color var(--t-fast)}
.seat:hover{border-color:var(--gold);transform:scale(1.18)}
.seat.selected{background:var(--navy);border-color:var(--navy);transform:scale(1.12)}
.seat.busy{background:#E3E3DE;border-color:#E3E3DE;cursor:not-allowed;opacity:.7}
```

> Заменить `.seat`/`.selected`/`.busy` на реальные классы, если в `app.js` они иные. Цвета зон-тарифов в `app.js` задаются инлайн — их не трогаем; состояние «выбрано/занято» переопределяет вид.

- [ ] **Step 4: Подсказка-легенда и floating tooltip**

```css
.hall-hint{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:18px;font-size:.85rem;color:var(--ink-2)}
.hint-dot{width:12px;height:12px;border-radius:50%;display:inline-block}
.dot-free{border:1.5px solid var(--line-2)}.dot-sel{background:var(--navy)}.dot-busy{background:#E3E3DE}
.hall-hint em{margin-left:auto;font-style:normal;color:var(--ink-mute)}
.seat-tip{position:fixed;z-index:9000;pointer-events:none;background:var(--navy);color:#fff;font-size:.78rem;font-weight:600;padding:6px 10px;border-radius:8px;opacity:0;transform:translateY(4px);transition:opacity var(--t-fast),transform var(--t-fast);box-shadow:var(--sh-md)}
.seat-tip.show{opacity:1;transform:none}
```

> Проверить в `app.js` имя класса-модификатора показа tooltip (например `show`/`is-visible`) и привести селектор к нему.

- [ ] **Step 5: Корзина заказа (sticky)**

```css
.order{position:sticky;top:90px}
.order-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh-md);padding:22px;display:flex;flex-direction:column;gap:18px}
.order-head h3{font-family:var(--font-disp);font-weight:600;font-size:1.3rem}
.order-show{font-size:.85rem;color:var(--ink-2)}
.order-list{list-style:none;display:flex;flex-direction:column;gap:10px;min-height:80px}
.order-list li{animation:orderIn .3s var(--ease)}
@keyframes orderIn{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
.order-empty{color:var(--ink-mute);font-size:.9rem;text-align:center;padding:18px 0}
.oe-mark{display:block;font-size:1.6rem;color:var(--gold);margin-bottom:8px}
.order-totals{display:flex;flex-direction:column;gap:8px;padding-top:16px;border-top:1px solid var(--line)}
.ot-row{display:flex;justify-content:space-between;font-size:.95rem;color:var(--ink-2)}
.ot-grand{font-family:var(--font-disp);font-weight:600;font-size:1.25rem;color:var(--ink);padding-top:8px;border-top:1px solid var(--line)}
.order-fineprint{font-size:.78rem;color:var(--ink-mute);text-align:center}
```

- [ ] **Step 6: Адаптив зала**

```css
@media (max-width:920px){.hall-shell{grid-template-columns:1fr}.order{position:static}}
```

- [ ] **Step 7: Проверка** — выбрать несколько мест: они подсвечиваются navy с pop-эффектом, попадают в корзину со slide-in, итоги пересчитываются, занятые места не кликаются, tooltip показывается при hover, кнопка «Оформить» активируется.

- [ ] **Step 8: Commit**

```bash
git add styles.css
git commit -m "feat(design): hall seat map and order summary (public)"
```

---

## Task 6: Блок «О театре» и футер

**Files:**
- Modify: `styles.css` (`.about*`, `.site-foot`, `.foot-dot`)

- [ ] **Step 1: О театре**

```css
.about{max-width:var(--maxw);margin:0 auto;padding:clamp(56px,9vw,96px) var(--gutter)}
.about-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:40px;align-items:start}
.about-quote{font-family:var(--font-disp);font-weight:500;font-size:clamp(1.4rem,2.6vw,2rem);line-height:1.25;letter-spacing:-.01em;color:var(--ink)}
.about-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.about-cols h4{font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-deep);font-weight:700;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--line)}
.about-cols p{font-size:.92rem;color:var(--ink-2);line-height:1.6}
@media (max-width:760px){.about-grid{grid-template-columns:1fr}.about-cols{grid-template-columns:1fr 1fr}}
```

- [ ] **Step 2: Футер**

```css
.site-foot{max-width:var(--maxw);margin:0 auto;padding:28px var(--gutter);display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;border-top:1px solid var(--line);color:var(--ink-mute);font-size:.85rem}
.foot-dot{color:var(--gold)}
```

- [ ] **Step 3: Проверка** — блок «о театре» и футер выглядят чисто, колонки выравниваются, адаптив работает.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "feat(design): about section and footer (public)"
```

---

## Task 7: Модалка оформления, билет и тост (публичная)

**Files:**
- Modify: `styles.css` (`.modal*`, `.ck-*`, `.field*`, `.pay*`, `.agree`, `.ticket*`, `.success-msg`, `.toast`)

- [ ] **Step 1: Оверлей и панель с плавным появлением**

```css
.modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;visibility:hidden;opacity:0;transition:opacity var(--t),visibility var(--t)}
.modal.open{visibility:visible;opacity:1}
.modal-backdrop{position:absolute;inset:0;background:rgba(20,20,30,.45);backdrop-filter:blur(3px)}
.modal-panel{position:relative;width:min(880px,100%);max-height:90vh;overflow:auto;background:var(--surface);border-radius:var(--r-lg);box-shadow:var(--sh-lg);padding:34px;transform:translateY(16px) scale(.98);transition:transform var(--t) var(--ease)}
.modal.open .modal-panel{transform:none}
.modal-x{position:absolute;top:16px;right:16px;width:38px;height:38px;border-radius:50%;border:1px solid var(--line-2);background:var(--surface);cursor:pointer;font-size:1rem;transition:all var(--t-fast)}
.modal-x:hover{background:var(--surface-2);transform:rotate(90deg)}
.modal-title{font-family:var(--font-disp);font-weight:600;font-size:clamp(1.6rem,3vw,2.2rem);margin:6px 0 22px}
```

> Проверить в `app.js`, как открывается модалка (класс `open`/`is-open`/атрибут `aria-hidden`). Если используется `aria-hidden`, добавить селектор `.modal[aria-hidden="false"]` вместо/вместе с `.open`.

- [ ] **Step 2: Форма и оплата**

```css
.modal-cols{display:grid;grid-template-columns:1.3fr 1fr;gap:30px}
.ck-form{display:flex;flex-direction:column;gap:16px}
.field{display:flex;flex-direction:column;gap:6px}
.field>span{font-size:.78rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.field input{font-family:var(--font-ui);font-size:1rem;padding:12px 14px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--surface);transition:border-color var(--t-fast),box-shadow var(--t-fast)}
.field input:focus{outline:none;border-color:var(--navy);box-shadow:0 0 0 3px rgba(30,32,66,.12)}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pay{border:1px solid var(--line);border-radius:var(--r);padding:16px;display:flex;flex-direction:column;gap:10px}
.pay legend{font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);padding:0 6px}
.pay-opt{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.95rem}
.agree{display:flex;align-items:flex-start;gap:10px;font-size:.88rem;color:var(--ink-2)}
@media (max-width:720px){.modal-cols{grid-template-columns:1fr}.field-row{grid-template-columns:1fr}}
```

- [ ] **Step 3: Сводка и билет**

```css
.ck-summary{background:var(--surface-2);border-radius:var(--r);padding:20px;align-self:start}
.ck-summary h4{font-family:var(--font-disp);font-weight:600;margin-bottom:12px}
.ck-seatlist{list-style:none;display:flex;flex-direction:column;gap:8px;font-size:.9rem}
.ck-total{display:flex;justify-content:space-between;align-items:baseline;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
.ck-total strong{font-family:var(--font-disp);font-weight:600;font-size:1.3rem}
.ck-note{font-size:.78rem;color:var(--ink-mute);margin-top:10px}
.ticket{display:grid;grid-template-columns:1.4fr 1fr;background:var(--navy);color:#fff;border-radius:var(--r-lg);overflow:hidden}
.ticket-perf{padding:26px}
.ticket-perf h2{font-family:var(--font-disp);font-weight:600;font-size:1.6rem;margin:8px 0}
.ticket-tear{width:0;border-left:2px dashed rgba(255,255,255,.4)}
.ticket-seats{padding:26px;background:rgba(255,255,255,.06)}
.ts-label{font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.ts-list{font-family:var(--font-disp);font-size:1.2rem;margin:6px 0 16px}
.ts-paid{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid rgba(255,255,255,.18);padding-top:12px}
.ts-paid strong{font-family:var(--font-disp);color:var(--gold)}
.success-msg{text-align:center;color:var(--ink-2);margin:22px 0}
@media (max-width:560px){.ticket{grid-template-columns:1fr}.ticket-tear{display:none}}
```

- [ ] **Step 4: Тост**

```css
.toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,20px);z-index:1200;background:var(--navy);color:#fff;font-weight:600;font-size:.92rem;padding:13px 22px;border-radius:999px;box-shadow:var(--sh-lg);opacity:0;visibility:hidden;transition:all var(--t) var(--ease)}
.toast.show{opacity:1;visibility:visible;transform:translate(-50%,0)}
```

> Привести `.show`/`.open` к фактическим классам из `app.js`.

- [ ] **Step 5: Проверка** — оформить заказ: модалка плавно появляется (панель подъезжает), поля имеют navy focus-кольцо, сводка корректна; после отправки показывается «билет», тост всплывает снизу и скрывается.

- [ ] **Step 6: Commit**

```bash
git add styles.css
git commit -m "feat(design): checkout modal, ticket and toast (public)"
```

---

## Task 8: Слой анимаций публичной страницы (scroll-reveal + sticky header)

**Files:**
- Modify: `app.js` (добавить в конце IIFE блок инициализации reveal и scrolled-хедера)
- Modify: `index.html` (добавить атрибут `data-reveal` на секции/карточки, которые должны появляться)

- [ ] **Step 1: Добавить `data-reveal` в разметку**

В `index.html` добавить `data-reveal` на: `.section-head` каждой секции, `.session-bar`, `.hall-main`, `.order`, `.about-quote`, каждый `.about-cols > div`. Существующие классы/`id` не трогать.

- [ ] **Step 2: Добавить reveal-наблюдатель и scrolled-хедер в `app.js`**

В конце IIFE (перед закрывающим `})();`) добавить:

```js
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
```

- [ ] **Step 3: Проверка** — при скролле секции плавно появляются (fade+slide, лёгкий stagger), хедер уплотняется (тень) после прокрутки. Включить `prefers-reduced-motion: reduce` — всё видно сразу, без движения.

- [ ] **Step 4: Commit**

```bash
git add app.js index.html
git commit -m "feat(design): scroll-reveal and condensing header (public)"
```

---

## Task 9: Админка — каркас, сайдбар, топ-бар, общие компоненты

**Files:**
- Modify: `admin.css` (`:root` уже из Task 1; `.admin`, `.side*`, `.main`, `.top*`, `.crumb`, `.period`, `.panel*`, `.btn*`, `.dtable`, `.table-wrap`)

- [ ] **Step 1: Каркас и сайдбар**

```css
body.admin{display:grid;grid-template-columns:264px 1fr;min-height:100vh}
.side{position:sticky;top:0;height:100vh;background:var(--surface);border-right:1px solid var(--line);display:flex;flex-direction:column;gap:22px;padding:24px 20px}
.side-brand{display:flex;align-items:center;gap:12px}
.side-brand img{height:34px}
.sb-cap{font-size:.72rem;line-height:1.2;color:var(--ink-2);font-weight:600;text-transform:uppercase;letter-spacing:.08em}
.side-profile{display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface-2);border-radius:var(--r)}
.avatar{width:42px;height:42px;border-radius:50%;background:var(--gold);color:var(--navy);font-weight:700;display:grid;place-items:center;font-size:.9rem}
.sp-info b{display:block;font-size:.92rem}
.sp-info em{font-style:normal;font-size:.78rem;color:var(--ink-2)}
.side-nav{display:flex;flex-direction:column;gap:4px;margin-top:6px}
.side-nav a{position:relative;display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:var(--r-sm);color:var(--ink-2);font-weight:600;font-size:.95rem;transition:background var(--t-fast),color var(--t-fast)}
.side-nav a .ni{width:18px;text-align:center;color:var(--ink-mute)}
.side-nav a:hover{background:var(--surface-2);color:var(--ink)}
.side-nav a.active{background:var(--navy);color:#fff}
.side-nav a.active .ni{color:var(--gold)}
.side-nav a.active::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;background:var(--gold);border-radius:2px}
.side-back{margin-top:auto;font-size:.85rem;color:var(--ink-2)}
.side-back:hover{color:var(--navy)}
```

- [ ] **Step 2: Топ-бар и сегмент-контрол периода**

```css
.main{padding:28px clamp(20px,3vw,40px);min-width:0}
.top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:24px}
.crumb{font-size:.8rem;color:var(--ink-2);letter-spacing:.04em}
.top-title h1{font-family:var(--font-disp);font-weight:600;font-size:clamp(1.7rem,3vw,2.4rem);letter-spacing:-.01em;margin-top:4px}
.period{display:inline-flex;background:var(--surface);border:1px solid var(--line-2);border-radius:999px;padding:4px}
.period button{font-family:var(--font-ui);font-weight:600;font-size:.88rem;border:none;background:transparent;color:var(--ink-2);padding:8px 18px;border-radius:999px;cursor:pointer;transition:color var(--t-fast),background var(--t-fast)}
.period button.active{background:var(--navy);color:#fff}
```

- [ ] **Step 3: Панели, кнопки админки, таблицы (общие)**

```css
.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh-sm)}
.panel.pad{padding:24px}
.panel-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:22px;margin-bottom:22px}
.panel-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
.panel-head h2{font-family:var(--font-disp);font-weight:600;font-size:1.2rem}
.panel-note{font-size:.88rem;color:var(--ink-2);margin-bottom:16px}
.ph-total{font-family:var(--font-disp);font-weight:600;color:var(--navy)}
.btn{font-family:var(--font-ui);font-weight:600;font-size:.9rem;border:none;cursor:pointer;border-radius:999px;padding:10px 18px;display:inline-flex;align-items:center;gap:.5em;transition:transform var(--t-fast),box-shadow var(--t-fast),background var(--t-fast)}
.btn-gold{background:var(--gold);color:var(--navy)}
.btn-gold:hover{background:var(--gold-deep);color:#fff;transform:translateY(-1px);box-shadow:var(--sh-sm)}
.btn-plain{background:var(--surface-2);color:var(--ink-2)}
.btn-plain:hover{background:#E9E8E2}
.table-wrap{overflow-x:auto}
.dtable{width:100%;border-collapse:collapse;font-size:.92rem}
.dtable th{text-align:left;font-size:.74rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute);font-weight:700;padding:10px 12px;border-bottom:1px solid var(--line-2)}
.dtable td{padding:12px;border-bottom:1px solid var(--line)}
.dtable .num{text-align:right}
.dtable tbody tr{transition:background var(--t-fast)}
.dtable tbody tr:hover{background:var(--surface-2)}
@media (max-width:880px){body.admin{grid-template-columns:1fr}.side{position:static;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center}.panel-grid{grid-template-columns:1fr}}
```

- [ ] **Step 4: Проверка** — открыть `admin.html`: сайдбар чистый, активный пункт navy+золотая метка, топ-бар с сегмент-контролом периода, панели/таблицы стилизованы, переключение вкладок и периодов работает.

- [ ] **Step 5: Commit**

```bash
git add admin.css
git commit -m "feat(design): admin shell, sidebar, topbar, shared panels (admin)"
```

---

## Task 10: Админка — баннер финстатуса и вкладка «Обзор»

**Files:**
- Modify: `admin.css` (`.status-banner`, `.sb-*`, `.kpis`, KPI-карточки, `.chart*`, `.gauge`, `.occ-list`)

**Перед началом:** в `admin.js` найти, как формируются KPI-карточки, столбики `revChart` и гейдж `occGauge` (какие классы/инлайн-стили) — стилизовать фактические имена; высоты/значения, задаваемые инлайн в JS, не трогать.

- [ ] **Step 1: Баннер финстатуса с цвет-кодировкой**

```css
.status-banner{display:flex;align-items:center;gap:18px;padding:20px 24px;border-radius:var(--r-lg);margin-bottom:22px;border:1px solid var(--line);background:var(--surface);box-shadow:var(--sh-sm)}
.status-banner[data-state="up"]{border-left:4px solid var(--ok)}
.status-banner[data-state="down"]{border-left:4px solid var(--warn)}
.status-banner[data-state="flat"]{border-left:4px solid var(--navy)}
.sb-mark{font-size:1.4rem}
.status-banner[data-state="up"] .sb-mark{color:var(--ok)}
.status-banner[data-state="down"] .sb-mark{color:var(--warn)}
.sb-text{display:flex;flex-direction:column;gap:2px}
.sb-text strong{font-family:var(--font-disp);font-weight:600;font-size:1.05rem}
.sb-text span{font-size:.88rem;color:var(--ink-2)}
.sb-fig{margin-left:auto;text-align:right}
.sb-fig b{font-family:var(--font-disp);font-weight:600;font-size:1.5rem}
.sb-fig em{font-style:normal;font-size:.78rem;color:var(--ink-2)}
```

- [ ] **Step 2: KPI-карточки (привести к фактическим классам из `admin.js`)**

```css
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:22px}
.kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:20px;box-shadow:var(--sh-sm)}
.kpi .k-label{font-size:.76rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute);font-weight:600}
.kpi .k-val{font-family:var(--font-disp);font-weight:600;font-size:1.8rem;margin-top:8px}
.kpi .k-delta{font-size:.82rem;margin-top:6px;font-weight:600}
.kpi .k-delta.up{color:var(--ok)}.kpi .k-delta.down{color:var(--warn)}
@media (max-width:1000px){.kpis{grid-template-columns:repeat(2,1fr)}}
```

> Использовать реальные имена классов из `admin.js`; если KPI рендерятся одной строкой разметки, привести селекторы к ней.

- [ ] **Step 3: График столбиков с анимацией «вырастания»**

```css
.chart{display:flex;align-items:flex-end;gap:8px;height:220px;padding-top:10px}
.chart .bar{flex:1;background:linear-gradient(180deg,var(--navy),var(--navy-hi));border-radius:6px 6px 0 0;transform-origin:bottom;animation:barGrow .6s var(--ease) both}
.chart .bar:hover{background:var(--gold)}
@keyframes barGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
```

> Если бар-элементы имеют другой класс — привести. Инлайн-высоту баров (из JS) не трогать; анимация только по `scaleY`.

- [ ] **Step 4: Гейдж заполняемости и список зон**

```css
.gauge{display:grid;place-items:center;padding:10px 0}
.occ-list{list-style:none;display:flex;flex-direction:column;gap:10px;margin-top:14px}
.occ-list li{display:flex;justify-content:space-between;font-size:.9rem;color:var(--ink-2);padding-bottom:8px;border-bottom:1px solid var(--line)}
```

> Если гейдж рисуется через `conic-gradient`/SVG в `admin.js` — добавить плавный переход заполнения (`transition`) к фактическому элементу, не меняя расчёт.

- [ ] **Step 5: Проверка** — вкладка «Обзор»: баннер меняет цвет по `data-state`, KPI-карточки выровнены, столбики графика «вырастают» при показе, гейдж и список зон читаемы. Переключение периода обновляет данные.

- [ ] **Step 6: Commit**

```bash
git add admin.css
git commit -m "feat(design): finance banner and overview tab (admin)"
```

---

## Task 11: Админка — вкладка «Цены»

**Files:**
- Modify: `admin.css` (`.price-table`, `.price-foot`, `.pf-*`)

- [ ] **Step 1: Таблица цен и точки зон**

```css
.price-table td .zone-dot{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle}
.price-table input{font-family:var(--font-ui);font-size:.92rem;width:96px;padding:8px 10px;border:1px solid var(--line-2);border-radius:var(--r-sm);text-align:right;transition:border-color var(--t-fast),box-shadow var(--t-fast)}
.price-table input:focus{outline:none;border-color:var(--navy);box-shadow:0 0 0 3px rgba(30,32,66,.12)}
.cell-flash{animation:cellFlash .8s var(--ease)}
@keyframes cellFlash{0%{background:rgba(230,184,28,.35)}100%{background:transparent}}
```

> Имена `.zone-dot`/`.cell-flash` привести к фактическим из `admin.js` (или добавить навешивание класса `cell-flash` на изменившуюся ячейку в JS — допустимая правка для подсветки пересчёта). Если в `admin.js` подсветки нет, добавить в обработчик изменения цены: `el.classList.add('cell-flash'); setTimeout(()=>el.classList.remove('cell-flash'),800);`.

- [ ] **Step 2: Подвал цен (прогноз/план/статус)**

```css
.price-foot{display:flex;flex-wrap:wrap;align-items:center;gap:24px;margin-top:22px;padding-top:20px;border-top:1px solid var(--line)}
.pf-block{display:flex;flex-direction:column;gap:2px}
.pf-block span{font-size:.76rem;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-mute);font-weight:600}
.pf-block b{font-family:var(--font-disp);font-weight:600;font-size:1.3rem}
.pf-status{margin-left:auto;display:flex;align-items:center;gap:8px;font-weight:600;font-size:.92rem}
.pfs-dot{width:10px;height:10px;border-radius:50%}
.pf-status[data-state="up"] .pfs-dot{background:var(--ok)}
.pf-status[data-state="down"] .pfs-dot{background:var(--warn)}
.pf-status[data-state="flat"] .pfs-dot{background:var(--navy)}
```

- [ ] **Step 3: Проверка** — вкладка «Цены»: таблица чистая, точки зон цветные, изменение цены пересчитывает прогноз/план/статус с лёгкой подсветкой ячейки, кнопка «+ Добавить тариф» золотая.

- [ ] **Step 4: Commit**

```bash
git add admin.css admin.js
git commit -m "feat(design): prices tab with recalced totals flash (admin)"
```

---

## Task 12: Админка — вкладка «Залы» (редактор сетки)

**Files:**
- Modify: `admin.css` (`.hall-controls`, `.newhall`, `.palette`, `.halls-layout`, `.seatgrid*`, `.stage-strip`, `.hall-summary`)

**Перед началом:** в `admin.js` найти классы ячеек сетки и чипов палитры — стилизовать фактические; инлайн-цвета зон (из тарифов) не трогать.

- [ ] **Step 1: Контролы и форма нового зала**

```css
.hall-controls{display:flex;gap:10px;flex-wrap:wrap}
.hall-controls select{font-family:var(--font-ui);font-size:.9rem;padding:9px 14px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--surface)}
.newhall{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;padding:18px;background:var(--surface-2);border-radius:var(--r);margin-bottom:18px}
.newhall label{display:flex;flex-direction:column;gap:6px;font-size:.8rem;font-weight:600;color:var(--ink-2)}
.newhall input{font-family:var(--font-ui);padding:9px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm)}
```

- [ ] **Step 2: Палитра тарифов-чипов**

```css
.palette{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.palette .chip{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid var(--line-2);border-radius:999px;cursor:pointer;font-size:.88rem;font-weight:600;transition:all var(--t-fast)}
.palette .chip .sw{width:12px;height:12px;border-radius:50%}
.palette .chip.active{border-color:var(--navy);background:var(--navy);color:#fff;box-shadow:var(--sh-sm)}
```

> `.chip`/`.sw`/`.active` привести к фактическим именам из `admin.js`.

- [ ] **Step 3: Сетка зала и сводка**

```css
.halls-layout{display:grid;grid-template-columns:1fr 280px;gap:22px;align-items:start}
.seatgrid-scroll{overflow:auto;background:var(--surface-2);border-radius:var(--r);padding:18px}
.stage-strip{text-align:center;font-family:var(--font-disp);letter-spacing:.3em;font-size:.74rem;color:var(--ink-2);background:var(--surface);border:1px solid var(--line-2);border-radius:0 0 60px 60px/0 0 24px 24px;padding:8px;margin:0 auto 18px;width:60%}
.seatgrid{display:grid;gap:6px;justify-content:center}
.seatgrid .cell{width:20px;height:20px;border-radius:5px;border:1px solid var(--line-2);background:var(--surface);cursor:pointer;transition:transform var(--t-fast)}
.seatgrid .cell:hover{transform:scale(1.15);border-color:var(--navy)}
.hall-summary{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:18px;box-shadow:var(--sh-sm)}
@media (max-width:900px){.halls-layout{grid-template-columns:1fr}}
```

> `.cell` привести к фактическому классу ячейки из `admin.js`; назначенные зоны (инлайн background) сохранятся поверх.

- [ ] **Step 4: Проверка** — вкладка «Залы»: палитра чипов, активный тариф подсвечен; рисование зон кликом/перетаскиванием работает и красит ячейки; сводка обновляется; форма нового зала создаёт сетку.

- [ ] **Step 5: Commit**

```bash
git add admin.css
git commit -m "feat(design): halls editor tab (admin)"
```

---

## Task 13: Админка — вкладки «Аналитика» и «Бухгалтерия»

**Files:**
- Modify: `admin.css` (`.zonebars`, `.channels`, `.avgChart`/линия, `.ledger-sum`, `.ledger-table`, статус-чипы)

**Перед началом:** в `admin.js` найти классы баров (`zoneBars`/`channelBars`) и статус-чипов бухгалтерии — стилизовать фактические; инлайн-ширину баров (из JS) не трогать, анимировать переходом.

- [ ] **Step 1: Горизонтальные бары (зоны/каналы) с анимацией ширины**

```css
.zonebars{list-style:none;display:flex;flex-direction:column;gap:14px}
.zonebars li{display:grid;grid-template-columns:130px 1fr auto;align-items:center;gap:12px;font-size:.9rem}
.zonebars .track{height:10px;background:var(--surface-2);border-radius:999px;overflow:hidden}
.zonebars .fill{height:100%;background:linear-gradient(90deg,var(--navy),var(--navy-hi));border-radius:999px;width:0;transition:width .8s var(--ease)}
.zonebars.channels .fill{background:linear-gradient(90deg,var(--gold),var(--gold-deep))}
```

> `.track`/`.fill` привести к фактическим. Если JS задаёт ширину инлайн при рендере — добавить класс/таймаут для запуска перехода от 0 (или оставить переход, выставив ширину после кадра). Допустимая минимальная правка JS: после вставки бара `requestAnimationFrame(()=>fill.style.width = pct + '%')`.

- [ ] **Step 2: Линия среднего чека** — если `avgChart` рисуется столбиками, переиспользовать стили `.chart .bar` из Task 10 (классы уже общие). Если SVG-линия — задать `stroke:var(--navy);stroke-width:2.5;fill:none` фактическому пути и `stroke-dasharray` анимацию появления:

```css
#avgChart svg path.line{stroke:var(--navy);stroke-width:2.5;fill:none}
#avgChart svg .area{fill:rgba(30,32,66,.08)}
```

> Применять только если в разметке `admin.js` реально SVG; иначе пропустить этот шаг.

- [ ] **Step 3: Бухгалтерия — сводка и статус-чипы**

```css
.ledger-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:22px}
.ledger-sum .ls-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:20px;box-shadow:var(--sh-sm)}
.ledger-sum .ls-label{font-size:.76rem;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-mute);font-weight:600}
.ledger-sum .ls-val{font-family:var(--font-disp);font-weight:600;font-size:1.6rem;margin-top:8px}
.status-chip{display:inline-flex;align-items:center;gap:6px;font-size:.8rem;font-weight:600;padding:4px 10px;border-radius:999px}
.status-chip.paid{background:rgba(47,158,94,.12);color:var(--ok)}
.status-chip.pending{background:rgba(230,184,28,.16);color:var(--gold-deep)}
.status-chip.expense{background:rgba(192,73,47,.12);color:var(--warn)}
@media (max-width:760px){.ledger-sum{grid-template-columns:1fr}}
```

> `.ls-card`/`.status-chip` и модификаторы привести к фактическим именам из `admin.js`.

- [ ] **Step 4: Проверка** — «Аналитика»: бары зон/каналов заполняются анимацией ширины, средний чек отображается. «Бухгалтерия»: сводные карточки, таблица операций со статус-чипами разных цветов, кнопка «+ Добавить расход» золотая.

- [ ] **Step 5: Commit**

```bash
git add admin.css admin.js
git commit -m "feat(design): analytics and ledger tabs (admin)"
```

---

## Task 14: Админка — слой анимаций (reveal вкладок, тост) и финальная проверка

**Files:**
- Modify: `admin.js` (reveal при переключении вкладок + общий тост-стиль уже в Task 9/10)
- Modify: `admin.css` (`.tab` transition, `.toast` — общий со стилем публичной)

- [ ] **Step 1: Плавное появление контента вкладки**

```css
.tab[hidden]{display:none}
.tab{animation:tabIn .35s var(--ease)}
@keyframes tabIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,20px);z-index:1200;background:var(--navy);color:#fff;font-weight:600;font-size:.92rem;padding:13px 22px;border-radius:999px;box-shadow:var(--sh-lg);opacity:0;visibility:hidden;transition:all var(--t) var(--ease)}
.toast.show{opacity:1;visibility:visible;transform:translate(-50%,0)}
```

> `.toast.show` привести к фактическому классу из `admin.js`.

- [ ] **Step 2: Проверка всей админки** — переключение вкладок плавное (контент появляется), баннер/KPI/бары анимируются, тосты всплывают. `prefers-reduced-motion: reduce` — без движения. Консоль без ошибок.

- [ ] **Step 3: Финальная сквозная проверка обеих страниц**

Запустить `python3 -m http.server 8080` и пройти оба сценария полностью:
- Публичная: выбор даты/времени → выбор мест → корзина → оформление → успех/билет → тост.
- Админка: все 5 вкладок, переключение периода, изменение цены (пересчёт), редактор зала.
Проверить адаптив (узкое окно ~390px и ~768px) и DevTools Console (без ошибок).

- [ ] **Step 4: Commit**

```bash
git add admin.css admin.js
git commit -m "feat(design): admin tab transitions and toast; final polish"
```

---

## Самопроверка плана

- **Покрытие спецификации:**
  - §1 токены/шрифты/геометрия/reduced-motion → Task 1 ✓
  - §2 публичная (хедер, hero, даты, зал, о театре, футер, модалка) → Tasks 2–8 ✓
  - §3 админка (сайдбар, топ-бар, баннер, обзор, цены, залы, аналитика, бухгалтерия, тост) → Tasks 9–14 ✓
  - Анимации (reveal, hover, выбор мест, модалки/вкладки) → Tasks 5, 7, 8, 10, 13, 14 ✓
  - prefers-reduced-motion → Task 1 (глобально) ✓
  - Сохранность JS-хуков → отмечено в каждой задаче, где трогается разметка/классы ✓
- **Заглушки:** значения и селекторы конкретны; единственная намеренная вариативность — «привести имена классов к фактическим из app.js/admin.js», что необходимо, т.к. часть классов навешивается из JS и должна быть подтверждена чтением исходника перед стилизацией. Это явная инструкция, не TODO.
- **Согласованность типов/имён:** токены (`--navy`, `--gold`, `--line`, `--ease`, `--t`, тени) определены один раз в Task 1 и используются единообразно; общие классы (`.btn`, `.panel`, `.chart .bar`, `.toast`) определены до переиспользования.
