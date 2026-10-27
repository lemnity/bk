# Дизайн-система кабинета администратора

Источник истины — `admin.css` (токены в `:root`, строки ~10–58). Документ фиксирует то, что уже есть;
новые экраны (отчёты, редактор писем) собираются только из этих токенов и компонентов.

## 1. Токены (`:root`)

### Цвет
| Переменная | Значение | Назначение |
|---|---|---|
| `--bg` | `#F2F5F9` | холст страницы |
| `--surface` | `#FFFFFF` | карточки, панели, поля |
| `--surface-2` | `#E9EEF6` | вторичная поверхность: hover, тулбары, итоговые строки |
| `--ink` | `#132437` | основной текст, заголовки (15.7:1 к белому) |
| `--ink-2` | `#44556E` | вторичный текст (7.6:1) |
| `--ink-mute` | `#596A82` | подписи, плейсхолдеры (5.5:1; светлее нельзя — AA упадёт) |
| `--accent` | `#173A6D` | единственный акцент: основная кнопка, ссылки, фокус-рамка полей |
| `--accent-deep` | `#0F2A53` | hover акцента |
| `--accent-tint` | `#E8EDF5` | светлая подложка акцента, кольцо фокуса полей |
| `--line` | `#DCE3ED` | границы карточек и таблиц |
| `--line-2` | `#7A8DAA` | границы полей и вторичных кнопок |
| `--ok` / `--ok-bg` | `#0E7A52` / `rgba(14,122,82,.10)` | успех, «доход» |
| `--warn` | `#8A5B10` | предупреждение |
| `--bad` / `--bad-bg` | `#B3261E` / `rgba(179,38,30,.09)` | ошибка, удаление, «расход» |
| `--focus` | `#2F6FE0` | контур `:focus-visible` |

Совместимость со старыми именами: `--navy`, `--navy-hi`, `--gold`, `--gold-deep` -> акцент; `--gold-hi` `#9FB3DE`;
`--font-acc` -> `--font-ui`. В новом коде используйте `--accent*`.

### Типографика
`--font-disp` и `--font-ui` — Rubik (без засечек и курсива), заголовки medium (500), цифры табличные
(`font-variant-numeric: tabular-nums`). Размеры в `rem`: текст `.85–.92rem`, подписи `.7–.8rem`,
заголовок панели `1.15rem`.

### Радиусы, тени, движение, размеры
| Группа | Токены |
|---|---|
| Радиусы | `--r-sm` 6px (кнопки, поля), `--r` 10px (таблицы, вложенные блоки), `--r-lg` 14px (панели, диалоги) |
| Тени | `--sh-sm` `0 1px 2px rgba(19,36,55,.06)`; `--sh-md` `0 2px 8px -2px rgba(19,36,55,.10)`; `--sh-lg` `0 12px 32px -8px rgba(19,36,55,.16)` |
| Движение | `--ease` `cubic-bezier(.22,.61,.36,1)`; `--t-fast` .18s (hover, цвет); `--t` .32s (появление) |
| Раскладка | `--maxw` 1280px; `--gutter` `clamp(20px,4vw,44px)`; `--side-w` 264px (боковая панель) |

## 2. Компоненты

### Панель
```html
<section class="panel pad">
  <div class="panel-head"><h2>Заголовок</h2><span class="panel-note">пояснение</span></div>
  ...
</section>
```
`.panel` — белая карточка с границей `--line`, `--r-lg`, `--sh-sm`; `.pad` добавляет отступ 22/24px.
Структуру держат края карточек, а не линейки.

### Кнопки
```html
<button class="btn btn-gold">Основная</button>
<button class="btn btn-plain">Вторичная</button>
<button class="btn-mini">Малая</button> <button class="btn-mini danger">Удалить</button>
<button class="rowact" aria-label="Изменить">✎</button>  <!-- 30x30, в строке таблицы -->
<button class="rowact danger" aria-label="Удалить">✕</button>
```
`.btn` — база (Rubik 500, .85rem, `--r-sm`); `.btn-gold` — акцент (белый на `--accent`); `.btn-plain` — рамка
`--line-2`. Опасное действие — `.btn-mini.danger` или `.dlg-danger` (диалог). Только `<button>`/`<a>`.

### Таблица
```html
<div class="table-wrap"><table class="dtable">
  <thead><tr><th>Название</th><th class="num">Сумма</th><th class="acts"></th></tr></thead>
  <tbody><tr><td>…</td><td class="num">1 200</td><td class="acts"><button class="rowact">…</button></td></tr></tbody>
</table></div>
```
`.table-wrap` скроллится по X; `.dtable` — заголовок капсом `.7rem`, hover строки `--bg`; `.num` — число справа.
Отчёты добавляют `.rv-table` (итоговая строка `tfoot`).

### Бейджи и теги
```html
<span class="badge income">Доход</span> <span class="badge expense">Расход</span>
<span class="badge own">Свой</span> <span class="badge tour">Гастроли</span> <span class="badge rent">Аренда</span>
<span class="tag tag-yes">Да</span> <span class="tag tag-no">Нет</span>
```
Пилюли (`border-radius:999px`); цвет всегда парный — текст `--ok/--bad/--accent` на их `-bg`/`--accent-tint`.

### Поля форм
Отчёты (`rv-`):
```html
<div class="rv-group"><span class="rv-addon">Период</span><select>…</select></div>
<div class="rv-group rv-group-range"><input type="date" class="rv-date"><span class="rv-dash">—</span><input type="date" class="rv-date"></div>
<label class="rv-check"><input type="checkbox"> Подпись</label>
<p class="rv-notice">Предупреждение</p>
```
Рассылки (`mv-`):
```html
<div class="mv-grid"><div class="mv-f">
  <div class="mv-l"><label for="x">Тема</label><span class="mv-count">0 / 120</span></div>
  <input id="x" type="text">
</div></div>
```
Поле: высота 40px, граница `--line-2`, `--r-sm`; фокус — `border-color:--accent` + кольцо `0 0 0 3px --accent-tint`.

### Тост
```html
<div class="toast" id="toast" role="status"></div>   <!-- показ: добавить класс .show, снять через ~2.5с -->
```
Тёмная плашка `--ink` снизу по центру, `z-index:1200`.

### Пустые состояния
```html
<div class="panel stub">
  <div class="stub-mark">✓</div><h2>Нет данных за выбранный период</h2><p>Измените параметры отчёта.</p>
</div>
```
Пустой результат — всегда понятная плашка, не пустая таблица.

### Диалог (`dlg-`)
Файл `admin-dialog.js` -> `window.AdminDialog`. Подключается `<script src="admin-dialog.js?v=1">` до модульных скриптов.

```js
AdminDialog.confirm({ title, text, ok = "Продолжить", cancel = "Отмена", danger = false }) // Promise<boolean>

AdminDialog.open({
  title: "Тестовая отправка",
  body: "<div class=\"mv-f\">…</div>",        // строка-HTML или DOM-узел
  actions: [                                   // kind: "primary" | "plain" | "danger"
    { label: "Отмена",   kind: "plain",   value: false },
    { label: "Отправить", kind: "primary", value: "send", validate: function (root) { return !!root.querySelector("input").value; } }
  ],
  onOpen: function (root) { /* навесить логику на поля */ }
}) // Promise<value нажатой кнопки | null (Esc, подложка, крестик)>
```
- `validate(root) === false` — диалог остаётся открытым.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; фокус на первое поле тела, иначе на первую кнопку;
  Tab зациклен внутри; Esc закрывает верхний диалог; фокус возвращается на открывший элемент;
  `body` блокируется классом `dlg-lock`, пока открыт хотя бы один диалог. Диалоги можно открывать подряд и вложенно.
- Классы: `.dlg-back` (подложка), `.dlg` (панель, ≤480px), `.dlg-head`, `.dlg-title`, `.dlg-x`, `.dlg-body`,
  `.dlg-actions`, `.dlg-danger`. Ширина экрана ≤480px — панель на всю ширину с отступом 16px.
- Не использовать `alert()`/`confirm()`.

## 3. Правила
1. **Никаких новых hex-цветов вне `:root`.** Нужен новый оттенок — сначала токен; смесь — `color-mix()` из токенов.
2. **Префиксы модулей** для новых классов: `rv-` (форма отчёта), `rdoc-` (документ отчёта), `lt-` (редактор письма),
   `rep-` (списки), `dlg-` (диалог), `mv-` (рассылка). Общие классы (`.btn`, `.panel`) не переопределять.
3. **Фокус виден**: `:focus-visible` с контуром `2px solid var(--focus)`; у полей — рамка `--accent` и кольцо `--accent-tint`.
4. **Контраст AA** (≥4.5:1 для текста). Текст светлее `--ink-mute` на белом недопустим.
5. **Интерактив — `<button>`/`<a>`**, с `aria-label` у иконок.
6. **`prefers-reduced-motion`**: глобальное правило отключает анимации и переходы — новые анимации ничего не добавляют сами,
   но не должны нести смысл только движением.
7. **Версии**: при правке `admin.css` или `admin-*.js` увеличивайте `?v=N` во всех подключениях.
8. Тексты интерфейса — по-русски, в тоне кабинета; цифры табличные.
