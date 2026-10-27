# Architecture — устройство проекта

Обновлено: 2026-10-27. Требования — [PRD.md](PRD.md), правила — [rules.md](rules.md).

## 1. Принципы

- **Статика без сборки.** HTML + CSS + vanilla JS. Нет npm, бандлера, фреймворков и внешних скриптов
  (кроме Google Fonts). Каждый модуль — обычный `<script>` с IIFE и `"use strict"`, наружу отдаёт один
  объект `window.<Имя>`.
- **Одна модель — много выводов.** Экран, Word, Excel, CSV и печать отчёта строятся из одной модели;
  копирование, скачивание и отправка письма — из одного `toHtml`.
- **Детерминированные демо-данные.** Генерация без `Math.random`/`Date.now`: сидированный ГПСЧ
  (mulberry32), сид — хеш исходных данных.
- **Пользовательский HTML — только в песочнице** (`<iframe sandbox="">`, без `allow-scripts`).

## 2. Стек и окружение

| Слой | Решение |
|---|---|
| Разметка/стили | HTML5, CSS custom properties (токены в `:root`), шрифт Rubik (Google Fonts) |
| Логика | ES5/ES2015 в IIFE, без модулей |
| Хранение | `localStorage` (ключ `tbdt_admin_v1`) + `BroadcastChannel("tbdt-admin")` для синхронизации вкладок |
| Тесты | Python Playwright (sync API) + Chromium, файлы `tests/smoke_*.py` |
| Хостинг | GitHub Pages из `main` (https://lemnity.github.io/bk/); `vercel.json` (cleanUrls, rewrites) — заготовка под Vercel |

## 3. Карта файлов

### Публичная часть
| Файл | Назначение |
|---|---|
| `index.html` + `afisha.js` + `afisha.css` | Афиша: карточки, фильтр, модальное окно покупки (сеанс → места → оформление → билет) |
| `show.html` | Страница спектакля; собирается в `afisha.js` по `?id=`; план зала встроен в страницу |
| `promo.html` + `app.js` | Прежняя промо-страница одного спектакля со схемой зала (вне навигации) |
| `styles.css` | Токены и компоненты публичной части |

Данные афиши — массив `RAW_SHOWS` в `afisha.js` (перенесён из `trds/src/modules/shows/demo-data.ts`):
спектакли, площадки (`VENUES`), показы. Прошедшие показы скрываются по текущей дате.

### Кабинет администратора
| Файл | Назначение |
|---|---|
| `admin.css` | Токены и компоненты кабинета (см. [admin-design-system.md](admin-design-system.md)) |
| `admin-store.js` | `window.AdminStore = {state, save, update(fn), subscribe(fn)}` — общее состояние |
| `admin-nav.js` | Дерево меню; активный пункт по `<body data-page>`; пункты без страницы → `section.html?s=` |
| `admin-dialog.js` | `window.AdminDialog.open/confirm` — модальные диалоги |
| `admin.js` | Консоль, цены, залы, события, актёры, аренда, аналитика, бухгалтерия (демо-логика) |
| `admin-day-tasks.js` | «Задачи на день» на консоли — вычисляются из состояния кабинета |
| `admin-venues.js` | Площадки: CRUD с мягким удалением |
| `admin-reports.js` | Каталог отчётов `CATALOG` (~150 номеров), избранное, `window.AdminReports` |
| `admin-report-data.js` | Движок данных отчётов `window.AdminReportData` (журнал операций) |
| `admin-report-kinds.js` | Виды отчётов и классификатор номер → вид `window.AdminReportKinds` |
| `admin-report-specs.js` | Спеки отчётов; ручные «3», «3а» (бланк PPr2), остальные — из видов |
| `admin-report-doc.js` | Модель и вывод отчёта: экран, Word/Excel (office-HTML), CSV, `build(no, params)` |
| `admin-report-view.js` | Страница `report.html?no=`: форма, проверка, снимок показанной модели `lastModel` |
| `admin-letter.js` | Конструктор письма `window.AdminLetter` (блоки, HTML-режим, линтер, переменные, импорт/экспорт, тест) |
| `admin-mailings.js` / `admin-mailing-view.js` | Список рассылок и модель раздела / страница рассылки |
| `admin-audiences.js` / `admin-audience-view.js` | Аудитории (выгрузки контактов, CSV) |
| `admin-referrals.js` / `admin-referral-view.js` | Реферальные метки, ссылка = база + `utm_source` |
| `admin-ticket-ads.js` | Реклама на билетах: макеты двух пропорций, привязка к представлениям |
| `admin-integration.js` | Счётчики Метрики/GA/пикселей, код виджета |

### Прочее
`assets/` (логотип, обложки), `docs/` (эта документация, шаблон PDF бухгалтерии и генератор
`otchet-generator.py`, `superpowers/` — спецификации и планы), `tests/` (смоуки).

## 4. Состояние кабинета (`AdminStore`)

`DEFAULTS` в `admin-store.js` — сиды коллекций: `TIERS` (зоны и цены), `LEDGER` (книга операций),
`EVENTS`, `ACTORS`, `RENTALS`, `HALLS`, `VENUES`, `REPORT_FAVS`, `INTEGRATION`, `DAY_TASKS`, `MAILINGS`,
`TICKET_ADS`, `REFERRALS`. `update(mutator)` сохраняет, уведомляет подписчиков и рассылает изменения
в другие вкладки. Сиды применяются, только если в localStorage ещё ничего нет — правка сидов не доходит
до уже открывавших кабинет браузеров.

## 5. Отчёты

```
AdminStore (EVENTS, TIERS, LEDGER…)
   └─► AdminReportData.ops(filter)        журнал операций: sale/refund/reserve/invite,
          │                               канал, тип оплаты, место; детерминированный
          ▼
AdminReportKinds.specFor(no)  ──►  AdminReportSpecs.get(no)  (ручные «3», «3а» имеют приоритет)
          │
          ▼
AdminReportDoc.model(spec, params) ──► экран (report.html) / Word / Excel / CSV / печать
          └─► AdminReportDoc.build(no, params) — то же без страницы («↓» в каталоге)
```

- Фильтр `ops(filter)`: `from, to` (дата операции, включительно), `eventFrom, eventTo`, `eventId`,
  `channel`, `pay`, `kind`, `pk`.
- 13 видов: byEvent, byOpDate, byChannel, byPay, occupancy, refunds, reserves, pushkin, opsJournal,
  museum, orders, events, ledger. Классификатор — регулярные выражения по названию и категории
  + таблица `OVERRIDES`.
- Выгрузки берут **снимок показанной модели** (`lastModel`), а не текущую форму: экран = файл.
- Б-1 «Книга операций»: записи сортируются по дате, сальдо нарастающим итогом с начала книги.

## 6. Письма

Модель письма: `{style, blocks[], mode: "blocks"|"html", html, tests[], …}`; `normalize` сохраняет
неизвестные поля. Хранится в `S.MAILINGS.items[i].letter`.

- `toHtml(L)`: в режиме blocks — табличная вёрстка 600px с инлайн-стилями; в режиме html — `L.html`.
  Если нет `{{unsubscribe_url}}`, добавляется строка отписки.
- `richText` — мини-разметка (`**`, `_`, `[текст](url)`, `- `), экранирование до разметки; ссылки только
  `http(s)`, `mailto`, `{{переменная}}` (`safeHref`, то же для кнопок и картинок).
- `renderVars` подставляет демо-значения только в предпросмотрах; код, файл, копия и хранилище —
  с плейсхолдерами.
- `lintHtml` / `LINT_RULES` — правила данных (нет таблиц, `<script>`, `href="#"`, data-URL, ширина > 600,
  неизвестные `{{…}}`, нет `</body>`).
- Импорт: HTML-файл / вставка кода → режим html (блоки сохраняются); шаблон `.json`. Экспорт: HTML-файл,
  копия, шаблон `.json`. Замена непустого письма — через `AdminDialog.confirm`.
- Тестовая отправка: `letter.tests` (до 20), у сохранённой рассылки пишется в стор сразу.

## 7. Тесты

`tests/smoke_*.py` — каждый сам поднимает `http.server` на свободном порту, открывает страницы в headless
Chromium, проверяет поведение и отсутствие ошибок консоли (кроме загрузки Google Fonts), печатает
`PASS`/`FAIL` и выходит с кодом 0/1. Запуск всех: `for t in tests/*.py; do python3 $t; done`.

## 8. Развёртывание

Пуш в `main` → GitHub Pages публикует корень репозитория (1–2 минуты). Кеш браузера сбрасывается
параметрами `?v=N` у подключаемых файлов (см. [rules.md](rules.md) §2).
