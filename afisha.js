/* ============================================================
   Технологии творчества · Афиша
   Карточки спектаклей → «Подробнее» (модалка с описанием и
   расписанием) и «Купить билет» (модалка: выбор сеанса и мест
   на схеме зала → оформление → билет).
   Схема зала и тарифы — те же, что на главной (app.js).
   ============================================================ */
(() => {
  "use strict";

  /* ---------- тарифы (₽) → цвет; шкала и контраст — см. app.js ---------- */
  const TIERS = [
    { price: 1000, color: "#E0ECF0" },
    { price: 1500, color: "#D2E2EC" },
    { price: 2000, color: "#C4DAE9" },
    { price: 2500, color: "#B6CFE8" },
    { price: 3000, color: "#AAC5E8" },
    { price: 3500, color: "#A0BBE7" },
    { price: 4000, color: "#99B1E7" },
    { price: 4500, color: "#95A5E6" },
    { price: 5000, color: "#929BE4" },
    { price: 5500, color: "#9290E1" },
    { price: 6000, color: "#9785DD" },
  ];
  const SERVICE_FEE = 200;  // ₽ за билет
  const BONUS_RATE = 0.05;  // 5% бонусов от стоимости билетов
  const MAX_SEATS = 12;

  const fmt = (n) => n.toLocaleString("ru-RU") + " ₽";
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const $ = (s) => document.querySelector(s);

  const WD_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const MON_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const MON_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

  /* ============================================================
     РЕПЕРТУАР — модный театр TURDUS.
     Спектакли, площадки, даты, тексты и составы взяты из демо-набора
     trds (src/modules/shows/demo-data.ts, источник — teatrturdus.ru,
     14.10.2026). Цены театр ещё не утвердил: тарифы мест ниже —
     демонстрационные, как и схема зала.
     shift — сдвиг тарифной сетки вверх, поэтому «от» = TIERS[shift].
     ============================================================ */
  const TDC = "https://static.tildacdn.com/";

  const VENUES = {
    "dk":            { title: "Бар «Дом Культуры»", address: "ул. Бажова, 193", kind: "Бар" },
    "vysota":        { title: "Ресторан «Высота 5642»", address: "ул. Воеводина, 8, 9 этаж, ТЦ Limerance Fashion Center", kind: "Ресторан" },
    "leburg":        { title: "Ресторан «Ле Бург»", address: "ул. Вайнера, 9, 4 этаж, ТЦ «Пассаж»", kind: "Ресторан" },
    "baton":         { title: "Лофт «Батон», Хлебозавод №6", address: "ул. 8 Марта, 203", kind: "Лофт" },
    "flat":          { title: "Квартира", address: "ул. Юмашева, 10, кв. 149 (3 подъезд, 6 этаж)", kind: "Квартира" },
    "dom-aktera":    { title: "Дом актёра", address: "ул. 8 Марта, 8", kind: "Сцена" },
    "central-hotel": { title: "Отель «Центральный» — старт прогулки", address: "ул. Малышева, 74, ресепшен", kind: "Город" },
  };

  const EVENT_TYPE = {
    spectacle: "Спектакль",
    immersive: "Иммерсивный",
    performance: "Перформанс",
    concert: "Концерт, кабаре",
    promenade: "Променад",
  };

  const RAW_SHOWS = [
    {
      id: "three-poets", type: "promenade", title: "Три поэта", genre: "Аудиоспектакль-променад", age: 16, minutes: 60,
      lead: "Иммерсивный аудиоспектакль-променад по Екатеринбургу: спектакль в наушниках, 20 зрителей.",
      text: [
        "«Три поэта» — это возможность увидеть Екатеринбург глазами трех великих авторов: Владимира Маяковского, Иосифа Бродского и Бориса Рыжего. Надев наушники, зрители отправляются в неспешную прогулку по центру города, где привычные улицы становятся декорациями, а голоса поэтов переплетаются с реальностью, открывая новые смыслы знакомых мест.",
        "Маршрут проходит от Центральной Гостиницы по улице Малышева, через набережную и мост, сопровождаемый интерактивными сценами и небольшими уличными перформансами. Каждый становится не просто зрителем, а частью спектакля, проживая эту историю в собственном ритме.",
        "Всё действие сопровождается модератором, который мягко ведёт группу по маршруту, помогает с техникой и обеспечивает комфортное восприятие на протяжении всего спектакля.",
      ],
      credits: [],
      img: "tild3138-3832-4733-b836-653066323964/19201080.jpg", hue: ["#132437", "#44556E"], shift: 0,
      gallery: [],
      shows: [["central-hotel", "2026-10-06", "19:00"], ["central-hotel", "2026-10-20", "19:00"], ["central-hotel", "2026-11-03", "19:00"], ["central-hotel", "2026-11-10", "19:00"]],
    },
    {
      id: "vbare2", type: "immersive", title: "Секс в большом баре 2.0", genre: "Иммерсивная стендап-комедия", age: 18, minutes: null,
      lead: "Бар «Дом Культуры» и модный театр TURDUS представят жителям Екатеринбурга иммерсивный спектакль в стиле стендап!",
      text: [
        "Вечер пройдет в формате стендап от четырех обворожительных девушек. Уникальность проекта в полном погружении зрителей в действие: сцена – везде, актеры свободно перемещаются от барной стойки к танцполу, общаются как с персоналом, так и с гостями, показывая моменты из жизни заведения.",
        "Пять подруг (среди которых психолог/сексолог) – собирательные образы очаровательных женщин, которые за барной стойкой делятся со зрителями своими курьезными барными историями, яркими желаниями, легкими мечтами и отвечают на актуальные вопросы завсегдатаев ночной жизни.",
      ],
      credits: [
        ["Режиссер", "Артём Аксёнов"],
        ["Автор", "Татьяна Усова"],
        ["В ролях", "Татьяна Пискун / Екатерина Никольская, Яна Шайдетская / Елена Руссу, Александра Рейн / Валерия Розенблит, Татьяна Усова, Елена Чупахина (психолог/сексолог)"],
        ["Хореограф", "Владислав Каримов"],
      ],
      img: "tild3331-6665-4238-b238-323232326463/DSCF0142_1.jpg", hue: ["#2A2F55", "#5F659A"], shift: 1,
      gallery: ["tild3331-6665-4238-b238-323232326463/DSCF0142_1.jpg", "tild3631-6463-4262-b231-373339343131/DSCF0140.jpg", "tild3837-6535-4736-b764-316361636264/DSCF0363.jpg", "tild3334-3033-4665-b463-623932663166/DSCF0375.jpg", "tild6362-6234-4035-b334-373565663665/DSCF0343.jpg", "tild3934-3466-4561-b232-396539386137/DSCF0448.jpg"],
      shows: [["dk", "2026-10-15", "19:00"]],
    },
    {
      id: "guests", type: "performance", title: "Гости", genre: "Перформанс-беседа", age: 18, minutes: 150,
      lead: "Театральный перформанс в жанре беседы за столом, в котором главные герои — гости.",
      text: [
        "Добрая традиция ходить друг к другу в гости. Застольные беседы отличаются искренностью и душевностью, хозяйка дома проявляет свое радушие и обязательно угостит своим фирменным блюдом, а хозяин задает тон вечера и создает атмосферу гостеприимства. Предлагаем укреплять эту традицию и встретиться!",
        "Хозяин вечера – руководитель модного театра «TURDUS», актер и режиссер Артем Аксенов. Все зрители – приглашенные гости, которые могут быть активными участниками беседы или просто наблюдателями.",
        "Перформанс обладает терапевтическим действием, предлагает погрузиться в себя, задаться, возможно, неудобными вопросами и найти свои собственные ответы на них. Повод встретиться и насладиться глубоким общением. Приходите в гости!",
      ],
      credits: [["Хозяин вечера", "Артём Аксёнов"]],
      img: "tild6231-6239-4632-a265-373364393765/2023_0205-1.jpg", hue: ["#0F2A53", "#3E67A8"], shift: 1,
      gallery: ["tild6231-6239-4632-a265-373364393765/2023_0205-1.jpg", "tild3931-3564-4261-b734-633965326561/2023_0205-2.jpg", "tild6134-6230-4463-a361-336632643335/2023_0205-3.jpg", "tild6334-6666-4238-b964-326630333132/2023_0205-4.jpg", "tild6136-3862-4361-b164-336633333633/2023_0205-6.jpg", "tild6637-6630-4737-b736-626438336538/2023_0205-7.jpg"],
      shows: [["vysota", "2026-10-04", "18:00"], ["vysota", "2026-10-18", "18:00"], ["vysota", "2026-11-01", "18:00"], ["vysota", "2026-11-15", "18:00"]],
    },
    {
      id: "8women", type: "spectacle", title: "8 любящих женщин", genre: "Комедийный детектив", age: 16, minutes: 140,
      lead: "Комедийный детектив по пьесе Робера Тома в новом прочтении режиссера Ирины Павловой.",
      text: [
        "Как всякий хороший детектив спектакль начинается с обнаружения трупа. Глава семейства убит в собственном доме! Конечно, кроме восьми самых близких ему женщин, сделать этого никто не мог. Непогода отрезает героинь от внешнего мира и изолирует в шикарном семейном особняке во французской глубинке выяснять кто из них совершил преступление.",
        "Спектакль отличается тонким юмором и стильной подачей. Высокую оценку получила работа художника по костюмам Анны Слепых за детальную проработку образов и точную передачу творческого замысла режиссера.",
        "Спектакль может сопровождаться тифлокомментированием при заявке от 10 человек.",
      ],
      credits: [
        ["Режиссер", "Ирина Павлова"],
        ["Художник", "Анна Слепых"],
        ["В ролях", "Габи — Надежда Ускова; Бабушка — Марина Шуранова; Огюстина — Елена Руссу; Сюзон — Кристина Русанова / Юлия Штенцель; Катрин — Ольга Тренбач; Пьеретта — Валерия Розенблит / Татьяна Усова; Шанель — Яна Шайдетская; Луиза — Анастасия Нохова / Татьяна Усова"],
      ],
      img: "tild3735-3062-4464-b334-653263313861/DSCF0508_1.jpg", hue: ["#173A6D", "#5B7BB5"], shift: 0,
      gallery: ["tild3735-3062-4464-b334-653263313861/DSCF0508_1.jpg", "tild3965-6335-4265-b963-373531666633/DSCF0405_1.jpg", "tild3034-3930-4531-a232-323436343738/DSCF0438_1.jpg", "tild3665-3938-4630-b761-666231643936/DSCF0452_1.jpg", "tild6630-6537-4339-a262-613737386562/DSCF0458_1.jpg", "tild3931-6438-4637-b637-383835396664/DSCF0498_1.jpg"],
      shows: [["dom-aktera", "2026-10-20", "19:00"]],
    },
    {
      id: "normalflight", type: "immersive", title: "Полёт нормальный: история одной любви", genre: "Иммерсивный музыкальный спектакль", age: null, minutes: null,
      lead: "Пространство бара «Дом Культуры» превращается в салон самолёта: на борту — три стюардессы, капитан и одна история любви.",
      text: [
        "Действие начинается с найденной записки с признанием — и каждая из героинь решает, что она адресована именно ей. Пока за иллюминатором непогода, на борту продолжается жизнь: музыка, живое общение, внимание к каждому гостю и неожиданные повороты сюжета, в которых проявляются характер и чувства героев. Но финал расставит всё по своим местам.",
        "Сюжет спектакля построен на реальных историях стюардесс которые происходили с ними и пассажирами в полете. Гастрономическая часть вечера - все как на борту - напитки (вода, чай, сок) на выбор, причем в таких же стаканчиках.",
      ],
      credits: [
        ["Режиссер и продюсер", "Артём Аксёнов"],
        ["Хореограф", "Владислав Каримов"],
        ["Действующие лица", "Венера — Татьяна Пискун / Мария Хвастова; Анфиса — Елена Руссу / Валерия Розенблит; Гера, старшая стюардесса — Яна Шайдетская; Александр Парисов, командир корабля — Максим Тихонов / Денис Денисов"],
      ],
      img: "tild6666-3562-4563-b466-613939313134/200523_turdus-8722.jpg", hue: ["#0F2A53", "#5F659A"], shift: 1,
      gallery: ["tild6666-3562-4563-b466-613939313134/200523_turdus-8722.jpg", "tild3339-3837-4466-b663-366336363831/200523_turdus-8646.jpg", "tild6237-3332-4461-b366-656531336439/200523_turdus-8689.jpg", "tild3765-3130-4839-a337-383365396666/200523_turdus-8738.jpg", "tild6133-6438-4533-b065-626564303132/200523_turdus-8755.jpg", "tild3633-6131-4339-b366-643036373737/200523_turdus-9032.jpg"],
      shows: [["dk", "2026-10-22", "19:00"]],
    },
    {
      id: "playapt", type: "spectacle", premiere: true, title: "История одной девочки", genre: "Спектакль в квартире", age: null, minutes: null,
      lead: "Впервые в Екатеринбурге спектакль пройдет не в театральном зале, а в реальной квартире.",
      text: [
        "«История одной девочки» — это камерный моноспектакль о детстве, которое пришлось на совсем не детское время. Это не рассказ о 90-х как об эпохе. Это история ребенка, который каждый день открывает для себя мир — со страхами и радостями, первыми разочарованиями, мечтами и вопросами, на которые взрослые не всегда находят ответы.",
        "Зрители окажутся не просто рядом с героиней, а внутри этой истории. Настоящая квартира станет пространством воспоминаний, где можно будет вновь почувствовать то самое ощущение из детства — когда мир был огромным, неизведанным и полным тайн.",
        "Спектакль основан на пьесе Елены Руссу и рассказывает личную историю взросления — честную, трогательную и очень узнаваемую.",
      ],
      credits: [["Автор пьесы", "Елена Руссу"]],
      img: "tild3961-3634-4164-a434-643435313665/_2026-08-04_15131423.png", hue: ["#132437", "#3E67A8"], shift: 1,
      gallery: [],
      shows: [["flat", "2026-10-09", "19:30"], ["flat", "2026-10-10", "18:00"], ["flat", "2026-10-23", "19:30"], ["flat", "2026-10-30", "19:30"], ["flat", "2026-10-31", "18:00"]],
    },
    {
      id: "shakespeare", type: "spectacle", premiere: true, title: "Весь Шекспир за 1,5 часа", genre: "Спектакль", age: null, minutes: 90,
      lead: "Мы запускаем столкновение великих пьес Уильяма Шекспира с сегодняшним днем на скорости, от которой захватывает дух.",
      text: [
        "Это не просто спектакль. Это карнавал, площадной буфф и бешеная энергия. За непочтительной, дерзкой формой скрывается превосходное знание материала и не показная, а очень личная любовь к Великому драматургу!",
        "Вы увидите «ускоренного Гамлета», танцующего заколотого Тибальта и Джульетту, которую играет... мужчина. Всё по канонам театра слуг лорда-камергера, но с драйвом XXI века.",
        "Это интерактив! Здесь нет четвертой стены - есть общее дыхание площадного театра. Вы не просто смотрите - вы становитесь частью толпы зевак в самом лучшем смысле этого слова.",
      ],
      credits: [
        ["Режиссер", "Ирина Павлова"],
        ["В ролях", "Виталий Корбесашвили, Борис Зырянов, Сергей Молочков"],
        ["Звук, свет", "Елизавета Чичиланова"],
      ],
      img: "tild6131-6230-4138-b262-343166333939/__1242800.jpg", hue: ["#2A2F55", "#5F659A"], shift: 0,
      gallery: [],
      shows: [["baton", "2026-10-24", "18:00"]],
    },
    {
      id: "facetoface", type: "performance", premiere: true, title: "Лицом к лицу", genre: "Перформанс-эксперимент", age: 16, minutes: 90,
      lead: "Пара конвертов, несколько вопросов и немного смелости — всё, что нужно, чтобы увидеть человека по-настоящему.",
      text: [
        "Можно ли за один вечер почувствовать, что рядом — «свой» человек? «Лицом к Лицу» — это не игра и не свидание, а возможность заглянуть в мысли другого через письменно оформленные ответы.",
        "Пары формируются из людей, которые не знают друг друга. Даже если гости приходят вместе, участвовать они будут раздельно — в разных парах.",
        "Каждому участнику выдаётся конверт с вопросами — не о повседневном, а о том, что заставляет задуматься и вспомнить важное. Финальный момент — обмен записями и впечатлениями, когда слова становятся тише, а впечатления — ярче.",
      ],
      credits: [["Режиссер, продюсер", "Артём Аксёнов"]],
      img: "tild6661-3666-4363-a138-306139333566/DSCF2054.jpg", hue: ["#173A6D", "#5B7BB5"], shift: 1,
      gallery: ["tild6661-3666-4363-a138-306139333566/DSCF2054.jpg", "tild6339-3136-4533-b163-316137626662/DSCF1948.jpg", "tild3762-3434-4632-a339-356166366266/DSCF1869.jpg", "tild3237-6230-4031-a361-333132346235/DSCF1804.jpg", "tild3461-3633-4466-b432-623539613331/DSCF1976.jpg", "tild6236-3866-4237-b937-333764626430/DSCF2019.jpg"],
      shows: [["leburg", "2026-10-11", "18:00"], ["leburg", "2026-10-25", "18:00"]],
    },
    {
      id: "concertsp", type: "concert", title: "В бананово-лимонном Сингапуре", genre: "Иммерсивное кабаре", age: 18, minutes: 100,
      lead: "Иммерсивный концерт-спектакль, посвящённый творчеству Александра Вертинского.",
      text: [
        "Ностальгия по двадцатому веку, желание погрузиться в глубину мыслей и чувств талантливого артиста, возродить традицию светских вечеров – лейтмотив создания серии иммерсивных концертов. Зритель - участник события, где нет четкого разграничения между сценой и залом.",
        "В программе вечера: песни и стихи Вертинского в исполнении артистов театра «TURDUS», отрывки из спектакля «В бананово-лимонном Сингапуре», факты из жизни и творчества кумира российской эстрады первой половины XX века. Все это под аккомпанемент живой музыки в атмосфере светского салона с напитками и приятным общением.",
        "Спектакль адаптирован для незрячих и слабовидящих зрителей, благодаря грантовой поддержке программы «Особый взгляд» благотворительного фонда «Искусство, наука и спорт» и при организационной поддержке АНО «Ген Гуманизма».",
      ],
      credits: [["Режиссер", "Артём Аксёнов"]],
      img: "tild6535-3734-4035-b437-626537323832/_2025-12-07_14075159.png", hue: ["#0F2A53", "#3E67A8"], shift: 2,
      gallery: ["tild6535-3734-4035-b437-626537323832/_2025-12-07_14075159.png", "tild3463-3438-4630-b033-643238373162/_2025-12-07_14080024.png", "tild3064-3534-4739-b662-643339363539/_2025-12-07_14083392.png", "tild3062-3563-4031-a165-313038343939/_2025-12-07_14072830.png", "tild3433-6563-4839-a339-643164323336/_2025-12-07_14073738.png", "tild6365-3331-4836-b965-323934343032/_2025-12-07_14074299.png"],
      shows: [["dk", "2026-11-05", "19:00"]],
    },
    {
      id: "taro", type: "immersive", title: "Таро", genre: "Музыкальная мистерия", age: 16, minutes: null,
      lead: "Воссоздаем атмосферу мистического салона. Рассадка гостей за столиками, обслуживание через официантов.",
      text: [
        "В новой постановке модного театра «TURDUS» порассуждают персонажи Старших арканов Таро. Шут, Звезда, Луна и даже Смерть не просто «оживут» перед зрителями, но и поведают о загадочных событиях из жизни реальных исторических личностей.",
        "Дресс-код – наряды, вдохновленные эстетикой карт Таро. Модный театр «TURDUS» - повод выйти в свет!",
      ],
      credits: [
        ["Режиссер", "Анастасия Нохова"],
        ["Сценарист", "Татьяна Усова"],
        ["В ролях", "Шут — Максим Тихонов; Луна — Валерия Розенблит; Звезда — Татьяна Пискун / Татьяна Усова; Справедливость — Елена Руссу; Смерть — Яна Шайдетская"],
      ],
      img: "tild3533-6132-4638-a564-323037613063/DSCF0068_1.jpg", hue: ["#2A2F55", "#5F659A"], shift: 1,
      gallery: ["tild3533-6132-4638-a564-323037613063/DSCF0068_1.jpg", "tild3637-6436-4233-a638-353837383136/DSCF0212.jpg", "tild3732-3661-4862-b538-656163313064/DSCF0234.jpg", "tild3061-3663-4266-b861-636437396436/DSCF0264_1.jpg", "tild3931-3030-4834-b631-323939396335/DSCF0268_2.jpg", "tild3332-3363-4838-a132-326232626332/DSCF0301.jpg"],
      shows: [["dk", "2026-10-08", "19:00"]],
    },
  ];

  // показы ниже этой даты уже прошли и в продаже не участвуют
  const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  const formatDuration = (min) => {
    if (min == null) return "";
    const h = Math.floor(min / 60), m = min % 60;
    return h === 0 ? `${m} мин` : m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
  };

  // сырые показы [площадка, дата, время] → сеансы по датам { d, m, y, venue, times }
  function toSessions(list) {
    const byDay = new Map();
    list.forEach(([venueId, iso, time]) => {
      const [y, mo, d] = iso.split("-").map(Number);
      if (new Date(y, mo - 1, d) < TODAY) return;
      const key = `${iso}|${venueId}`;
      if (!byDay.has(key)) byDay.set(key, { y, m: mo - 1, d, venue: VENUES[venueId], venueId, times: [] });
      byDay.get(key).times.push(time);
    });
    return [...byDay.values()].sort((a, b) => new Date(a.y, a.m, a.d) - new Date(b.y, b.m, b.d));
  }

  const SHOWS = RAW_SHOWS.map((r) => {
    const sessions = toSessions(r.shows);
    const lead = r.credits.find(([role]) => /режисс/i.test(role)) || r.credits[0];
    return {
      ...r,
      typeLabel: EVENT_TYPE[r.type],
      age: r.age == null ? "" : `${r.age}+`,
      duration: formatDuration(r.minutes),
      director: lead ? lead[1] : "",
      directorRole: lead ? lead[0] : "",
      img: r.img ? TDC + r.img : "",
      flag: r.premiere ? "Премьера" : "",
      gallery: (r.gallery || []).map((u) => TDC + u),
      sessions,
      // в Доме актёра — зал со сценой; остальные площадки камерные
      hall: sessions.some((s) => s.venueId === "dom-aktera") ? "big" : "small",
    };
  }).filter((s) => s.sessions.length); // без будущих показов карточку не выводим

  /* ============================================================ helpers */
  const dateOf = (s) => new Date(s.y, s.m, s.d);
  const wdOf = (s) => dateOf(s).getDay();
  const dayLong = (s) => `${s.d} ${MON_GEN[s.m]}`;
  const sessionLabel = (s, t) => `${dayLong(s)}, ${WD_SHORT[wdOf(s)]} · ${t}`;
  const minPrice = (show) => TIERS[clamp(show.shift, 0, TIERS.length - 1)].price;
  const showById = (id) => SHOWS.find((s) => s.id === id);

  function posterHTML(show, cls = "") {
    return `<div class="poster ${cls}" style="--h1:${show.hue[0]};--h2:${show.hue[1]}">
      <span class="poster-mark" aria-hidden="true">${show.title.charAt(0)}</span>
      ${show.img ? `<img src="${show.img}" alt="" loading="lazy" onerror="this.remove()">` : ""}
    </div>`;
  }

  const ICON = {
    cal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`,
  };

  /* ============================================================ CARDS */
  const showUrl = (id) => `show.html?id=${encodeURIComponent(id)}`;

  function cardHTML(show, i) {
    const first = show.sessions[0];
    const dates = show.sessions.slice(0, 4).map((s) =>
      `<span class="af-date">${s.d} ${MON_SHORT[s.m]}</span>`).join("");
    const rest = show.sessions.length - 4;
    return `
      <article class="af-card" style="animation-delay:${i * 50}ms">
        <a class="af-poster-btn" href="${showUrl(show.id)}" tabindex="-1" aria-hidden="true">
          ${posterHTML(show, "af-poster")}
          ${show.age ? `<span class="badge badge-age">${show.age}</span>` : ""}
          ${show.flag ? `<span class="badge badge-flag">${show.flag}</span>` : ""}
        </a>
        <div class="af-body">
          <span class="af-genre">${show.genre}</span>
          <h2 class="af-title"><a href="${showUrl(show.id)}">${show.title}</a></h2>
          <p class="af-lead">${show.lead}</p>
          <ul class="af-meta">
            <li>${ICON.cal}<span>${sessionLabel(first, first.times.join(", "))}</span></li>
            <li>${ICON.pin}<span>${first.venue.title}</span></li>
            ${show.duration ? `<li>${ICON.clock}<span>${show.duration}</span></li>` : ""}
          </ul>
          <div class="af-dates" aria-label="Даты показов">${dates}${rest > 0 ? `<span class="af-date more">+${rest}</span>` : ""}</div>
          <div class="af-foot">
            <span class="af-price">Билеты от<b>${fmt(minPrice(show))}</b></span>
            <div class="af-actions">
              <a class="btn btn-ghost" href="${showUrl(show.id)}" aria-label="Подробнее о спектакле «${show.title}»">Подробнее</a>
              <button class="btn btn-primary" type="button" data-buy="${show.id}">Купить билет</button>
            </div>
          </div>
        </div>
      </article>`;
  }

  /* ---------- главная: сетка афиши с фильтром ---------- */
  const grid = $("#afGrid");
  const chipsEl = $("#genreChips");
  let genre = "Все";

  function buildChips() {
    const counts = SHOWS.reduce((acc, s) => (acc[s.typeLabel] = (acc[s.typeLabel] || 0) + 1, acc), {});
    const list = [["Все", SHOWS.length], ...Object.entries(counts)];
    chipsEl.innerHTML = list.map(([g, n]) =>
      `<button class="chip" type="button" data-genre="${g}" aria-pressed="${g === genre}">${g}<span class="chip-n">${n}</span></button>`
    ).join("");
  }

  function renderCards() {
    const list = SHOWS.filter((s) => genre === "Все" || s.typeLabel === genre);
    grid.innerHTML = list.map(cardHTML).join("");
    const n = list.length;
    const word = n % 10 === 1 && n % 100 !== 11 ? "спектакль"
      : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "спектакля" : "спектаклей";
    $("#afCount").textContent = `${n} ${word} в афише`;
  }

  if (chipsEl) chipsEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    genre = chip.dataset.genre;
    chipsEl.querySelectorAll(".chip").forEach((c) =>
      c.setAttribute("aria-pressed", String(c.dataset.genre === genre)));
    renderCards();
  });

  // «Купить билет» и кнопки времени сеанса — на любой странице
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-buy]");
    if (!b) return;
    const at = b.dataset.s != null ? { s: +b.dataset.s, t: b.dataset.t } : null;
    if (!buy.inline) return openBuy(b.dataset.buy, at);
    // на странице спектакля план зала встроен: ведём к нему, а не в модалку
    if (b.dataset.buy !== buy.show.id) { location.href = showUrl(b.dataset.buy) + "#hall"; return; }
    if (at) changeSession(at.s, at.t);
    document.getElementById("hall").scrollIntoView({ behavior: "smooth" });
  });

  /* ============================================================ MODALS
     Окно покупки общее для афиши и страницы спектакля — вставляем из шаблона. */
  document.body.insertAdjacentHTML("beforeend", `
<!-- ░░░ BUY MODAL: места → оформление → билет ░░░ -->
<div class="modal" id="buyModal" aria-hidden="true">
  <div class="modal-backdrop" data-close></div>
  <div class="modal-panel buy-panel" role="dialog" aria-modal="true" aria-labelledby="buyTitle" tabindex="-1">
    <button class="modal-x" data-close aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg></button>

    <header class="buy-head">
      <div class="buy-show">
        <div class="buy-thumb" id="buyThumb" aria-hidden="true"></div>
        <div>
          <p class="kicker" id="buyKicker">Покупка билетов</p>
          <h2 class="buy-title" id="buyTitle">—</h2>
          <p class="buy-meta" id="buyMeta">—</p>
        </div>
      </div>
      <ol class="buy-steps" id="buySteps">
        <li data-step="seats">Места</li>
        <li data-step="checkout">Оформление</li>
        <li data-step="done">Билет</li>
      </ol>
    </header>

    <!-- step 1 · seats -->
    <div class="buy-view" id="viewSeats">
      <div class="buy-sessions">
        <div class="bs-group">
          <span class="bs-label">Дата</span>
          <div class="bs-dates" id="bsDates" role="group" aria-label="Дата показа"></div>
        </div>
        <div class="bs-group">
          <span class="bs-label">Время</span>
          <div class="bs-times" id="bsTimes" role="group" aria-label="Время начала"></div>
        </div>
      </div>

      <div class="buy-grid">
        <div class="hall-main">
          <div class="legend" id="legend"></div>
          <div class="stage-wrap">
            <div class="screen-glow" aria-hidden="true"></div>
            <div class="stage">Сцена</div>
          </div>
          <div class="seatmap-scroll" id="seatmapScroll">
            <div class="hall-plan" id="hallPlan" role="group" aria-label="План зала"></div>
          </div>
          <div class="hall-hint">
            <span class="hint-dot dot-free"></span> свободно
            <span class="hint-dot dot-sel"></span> выбрано вами
            <span class="hint-dot dot-busy"></span> занято
            <em>Нажмите на место, чтобы добавить его в заказ</em>
          </div>
        </div>

        <aside class="order-card buy-order" aria-label="Ваш заказ">
          <header class="order-head">
            <h3>Ваш заказ</h3>
            <span class="order-show" id="orderShow">—</span>
          </header>
          <ul class="order-list" id="orderList">
            <li class="order-empty" id="orderEmpty">
              <span class="oe-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" focusable="false"><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg></span>
              Места ещё не выбраны.<br>Коснитесь схемы зала.
            </li>
          </ul>
          <div class="order-totals">
            <div class="ot-row"><span>Билетов</span><span id="totalCount">0</span></div>
            <div class="ot-row ot-fee"><span>Сервисный сбор</span><span id="totalFee">0 ₽</span></div>
            <div class="ot-row ot-grand"><span>Итого</span><span id="totalSum">0 ₽</span></div>
            <div class="ot-row ot-bonus">
              <span class="ot-bonus-label">
                Ваш бонус 5%
                <span class="hint">
                  <button class="hint-btn" type="button" aria-label="Подробнее о бонусах">?</button>
                  <span class="hint-pop" role="tooltip">Бонусы — 5% от стоимости билетов. Их можно потратить при покупке билета: оплатить ими часть следующего заказа.</span>
                </span>
              </span>
              <span id="totalBonus">+0 ₽</span>
            </div>
          </div>
          <button class="btn btn-primary btn-block" id="toCheckoutBtn" type="button" disabled>Оформить заказ</button>
          <p class="order-fineprint">Бронь действует 15&nbsp;минут после оформления</p>
        </aside>
      </div>
    </div>

    <!-- step 2 · checkout -->
    <div class="buy-view" id="viewCheckout" hidden>
      <button class="btn-back" type="button" id="backToSeats">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6"/></svg>
        Изменить места
      </button>
      <div class="modal-cols">
        <form class="ck-form" id="ckForm" novalidate>
          <label class="field">
            <span>Имя и фамилия</span>
            <input type="text" name="name" required autocomplete="name" placeholder="Степан Верховенский" />
          </label>
          <div class="field-row">
            <label class="field">
              <span>E-mail</span>
              <input type="email" name="email" required autocomplete="email" placeholder="you@theatre.ru" />
            </label>
            <label class="field">
              <span>Телефон</span>
              <input type="tel" name="phone" required autocomplete="tel" placeholder="+7 ___ ___-__-__" />
            </label>
          </div>
          <fieldset class="pay">
            <legend>Оплата</legend>
            <label class="pay-opt"><input type="radio" name="pay" value="card" checked /><span>Банковская карта</span></label>
            <label class="pay-opt"><input type="radio" name="pay" value="sbp" /><span>СБП</span></label>
            <label class="pay-opt"><input type="radio" name="pay" value="box" /><span>В кассе театра</span></label>
          </fieldset>
          <label class="agree">
            <input type="checkbox" name="agree" required />
            <span>Согласен с правилами продажи и возврата билетов</span>
          </label>
          <button type="submit" class="btn btn-primary btn-block btn-pay" id="payBtn">
            Оплатить <span id="payAmount">0 ₽</span>
          </button>
        </form>

        <aside class="ck-summary">
          <h4>Ваши места</h4>
          <ul id="ckSeatList" class="ck-seatlist"></ul>
          <div class="ck-total"><span>К оплате</span><strong id="ckTotal">0 ₽</strong></div>
          <p class="ck-note">Электронные билеты придут на почту сразу после оплаты.</p>
        </aside>
      </div>
    </div>

    <!-- step 3 · success -->
    <div class="buy-view modal-success" id="viewDone" hidden>
      <div class="ticket">
        <div class="ticket-perf">
          <span class="kicker kicker-dark">Билет подтверждён</span>
          <h2 id="successTitle">—</h2>
          <p id="successWhen">—</p>
        </div>
        <div class="ticket-tear" aria-hidden="true"></div>
        <div class="ticket-seats">
          <p class="ts-label">Ваши места</p>
          <p class="ts-list" id="successSeats">—</p>
          <p class="ts-paid"><span>Оплачено</span><strong id="successTotal">0 ₽</strong></p>
        </div>
      </div>
      <p class="success-msg">Билеты отправлены на вашу почту. До встречи в зале!</p>
      <button class="btn btn-ghost btn-block" type="button" data-close>Вернуться к афише</button>
    </div>
  </div>
</div>

<div class="seat-tip" id="seatTip" aria-hidden="true"></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
`);

  const buyModal = $("#buyModal");
  const returnFocus = new Map();

  function openModal(m) {
    returnFocus.set(m, document.activeElement);
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const panel = m.querySelector(".modal-panel");
    panel.scrollTop = 0;
    panel.focus({ preventScroll: true });
  }
  function closeModal(m) {
    if (!m.classList.contains("open")) return;
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
    hideTip();
    if (!document.querySelector(".modal.open")) document.body.style.overflow = "";
    const back = returnFocus.get(m);
    if (back && document.contains(back)) back.focus({ preventScroll: true });
  }

  [buyModal].forEach((m) =>
    m.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(m); }));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = [...document.querySelectorAll(".modal.open")].pop();
    if (open) closeModal(open);
  });

  /* ============================================================ SHOW PAGE */
  function renderShowPage(root) {
    const show = showById(new URLSearchParams(location.search).get("id"));
    if (!show) {
      document.title = "Спектакль не найден · Афиша";
      root.innerHTML = `
        <section class="page-head sp-missing">
          <p class="section-eyebrow">Афиша</p>
          <h1 class="page-title">Спектакль не найден</h1>
          <p class="page-lead">Возможно, все показы уже прошли или ссылка устарела.</p>
          <a class="btn btn-primary" href="index.html">Вся афиша</a>
        </section>`;
      return;
    }

    document.title = `${show.title} · Афиша`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = show.lead;

    const first = show.sessions[0];
    const venues = [...new Map(show.sessions.map((s) => [s.venueId, s.venue])).values()];
    const others = SHOWS.filter((s) => s.id !== show.id).slice(0, 3);
    const kicker = [show.typeLabel, show.age, show.flag].filter(Boolean).join(" · ");
    const bg = `${show.img ? `url('${show.img}') center/cover no-repeat, ` : ""}linear-gradient(150deg,${show.hue[0]},${show.hue[1]})`;

    root.innerHTML = `
      <section class="hero sp-hero">
        <div class="hero-photo" style="background:${bg}" aria-hidden="true"></div>
        <div class="hero-scrim" aria-hidden="true"></div>
        <div class="hero-inner">
          <div class="hero-copy">
            <a class="sp-back" href="index.html">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6"/></svg>
              Вся афиша
            </a>
            <p class="kicker">${kicker}</p>
            <h1 class="hero-title sp-title"><span class="ht-line ht-1">${show.title}</span></h1>
            <p class="hero-author">${show.genre}</p>
            <div class="hero-actions">
              <button class="btn btn-primary" type="button" data-buy="${show.id}">Купить билет <span aria-hidden="true">→</span></button>
            </div>
            <dl class="hero-facts">
              <div><dt>Ближайший показ</dt><dd>${dayLong(first)}, ${first.times[0]}</dd></div>
              <div><dt>Площадка</dt><dd>${first.venue.title}</dd></div>
              ${show.duration ? `<div><dt>Длительность</dt><dd>${show.duration}</dd></div>` : ""}
              <div><dt>Билеты</dt><dd>от ${fmt(minPrice(show))}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <div class="sp-body">
        <section class="sp-about" aria-labelledby="spAboutH">
          <p class="section-eyebrow" id="spAboutH">О спектакле</p>
          <p class="sp-lead">${show.lead}</p>
          ${show.text.map((p) => `<p>${p}</p>`).join("")}
        </section>
        <aside class="sp-side">
          ${show.credits.length ? `
            <div class="sp-card">
              <h2 class="sp-h">Создатели</h2>
              <dl class="sp-credits">
                ${show.credits.map(([role, people]) => `<div><dt>${role}</dt><dd>${people}</dd></div>`).join("")}
              </dl>
            </div>` : ""}
          <div class="sp-card">
            <h2 class="sp-h">${venues.length > 1 ? "Площадки" : "Где проходит"}</h2>
            ${venues.map((v) => `<p class="sp-venue">${ICON.pin}<span><b>${v.title}</b>${v.address}</span></p>`).join("")}
          </div>
        </aside>
      </div>

      <section class="sp-section sp-hall" id="hall">
        <div class="section-head">
          <div class="sh-left">
            <p class="section-eyebrow">Билеты</p>
            <h2 class="section-title">Выбор мест</h2>
          </div>
          <p class="section-note" id="spHallNote"></p>
        </div>
        <div id="spHallSlot"></div>
      </section>

      ${show.gallery.length ? `
        <section class="sp-section">
          <div class="section-head"><div class="sh-left">
            <p class="section-eyebrow">Фото</p>
            <h2 class="section-title">Со спектакля</h2>
          </div></div>
          <div class="sp-gallery">
            ${show.gallery.map((u, i) => `<a href="${u}" target="_blank" rel="noopener" class="sp-ph"><img src="${u}" alt="«${show.title}» — фото ${i + 1}" loading="lazy" onerror="this.parentNode.remove()"></a>`).join("")}
          </div>
        </section>` : ""}

      ${others.length ? `
        <section class="sp-section">
          <div class="section-head">
            <div class="sh-left">
              <p class="section-eyebrow">Афиша</p>
              <h2 class="section-title">Ещё спектакли</h2>
            </div>
            <a class="section-note sp-all" href="index.html">Вся афиша →</a>
          </div>
          <div class="af-grid">${others.map(cardHTML).join("")}</div>
        </section>` : ""}`;

    // встраиваем шаг выбора мест из окна покупки прямо в страницу
    $("#spHallSlot").appendChild($("#viewSeats"));
    buy.inline = true;
    loadShow(show, null);
    if (location.hash === "#hall") requestAnimationFrame(() => $("#hall").scrollIntoView());
  }

  /* ============================================================ BUY · state */
  // inline — план зала встроен в страницу спектакля, в модалке только оформление и билет
  const buy = { show: null, sIdx: 0, time: "", selected: new Map(), step: "seats", inline: false };
  const SOLD = new Map(); // ключ сеанса → Set(id мест), купленных в этой вкладке
  const sessionKey = () => `${buy.show.id}|${buy.show.sessions[buy.sIdx].d}.${buy.show.sessions[buy.sIdx].m}|${buy.time}`;

  function openBuy(id, at) {
    const show = showById(id);
    if (!show) return;
    loadShow(show, at);
    setStep("seats");
    openModal(buyModal);
  }

  // состояние покупки для спектакля: сеанс, схема, заказ
  function loadShow(show, at) {
    buy.show = show;
    buy.sIdx = at ? at.s : 0;
    buy.time = at ? at.t : show.sessions[buy.sIdx].times[0];
    buy.selected.clear();

    $("#buyThumb").innerHTML = posterHTML(show, "buy-thumb-in");
    $("#buyTitle").textContent = show.title;
    $("#ckForm").reset();

    renderSessions();
    buildHall();
    renderOrder();
  }

  function setStep(step) {
    buy.step = step;
    if (!buy.inline) $("#viewSeats").hidden = step !== "seats";
    $("#viewCheckout").hidden = step !== "checkout";
    $("#viewDone").hidden = step !== "done";
    const order = ["seats", "checkout", "done"];
    const cur = order.indexOf(step);
    $("#buySteps").querySelectorAll("li").forEach((li) => {
      const i = order.indexOf(li.dataset.step);
      li.classList.toggle("is-current", i === cur);
      li.classList.toggle("is-done", i < cur);
      if (i === cur) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    $("#buyKicker").textContent =
      step === "seats" ? "Шаг 1 из 2 · Выбор мест" :
      step === "checkout" ? "Шаг 2 из 2 · Оформление" : "Готово";
    hideTip();
    buyModal.querySelector(".modal-panel").scrollTop = 0;
  }

  function renderMeta() {
    const s = buy.show.sessions[buy.sIdx];
    const label = `${sessionLabel(s, buy.time)} · ${s.venue.title}, ${s.venue.address}`;
    $("#buyMeta").textContent = label;
    $("#orderShow").textContent = `${buy.show.title} · ${dayLong(s)} ${buy.time}`;
    const note = $("#spHallNote");
    if (note) note.textContent = label;
  }

  /* ============================================================ BUY · sessions */
  function renderSessions() {
    const show = buy.show;
    $("#bsDates").innerHTML = show.sessions.map((s, i) =>
      `<button class="bs-date" type="button" data-i="${i}" aria-pressed="${i === buy.sIdx}">
        <b>${s.d} ${MON_SHORT[s.m]}</b><small>${WD_SHORT[wdOf(s)]}</small>
      </button>`).join("");
    const times = show.sessions[buy.sIdx].times;
    $("#bsTimes").innerHTML = times.map((t) =>
      `<button class="time-chip${t === buy.time ? " active" : ""}" type="button" data-t="${t}" aria-pressed="${t === buy.time}">${t}</button>`).join("");
    renderMeta();
  }

  function changeSession(sIdx, time) {
    if (sIdx === buy.sIdx && time === buy.time) return;
    if (buy.selected.size) toast("Сеанс изменён — выбор мест сброшен");
    buy.sIdx = sIdx;
    buy.time = time;
    buy.selected.clear();
    renderSessions();
    buildHall();
    renderOrder();
  }

  $("#bsDates").addEventListener("click", (e) => {
    const b = e.target.closest(".bs-date");
    if (!b) return;
    const i = +b.dataset.i;
    changeSession(i, buy.show.sessions[i].times[0]);
  });
  $("#bsTimes").addEventListener("click", (e) => {
    const b = e.target.closest(".time-chip");
    if (b) changeSession(buy.sIdx, b.dataset.t);
  });

  /* ============================================================ BUY · hall plan */
  const hallPlan = $("#hallPlan");

  // детерминированный ГПСЧ: у каждого сеанса своя, но стабильная занятость
  function makeRng(str) {
    let seed = 2166136261;
    for (let i = 0; i < str.length; i++) seed = Math.imul(seed ^ str.charCodeAt(i), 16777619);
    seed &= 0x7fffffff;
    return () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
  }

  // тариф места = база блока + центральность − удалённость ряда (+ сдвиг спектакля)
  function tierFor(base, rowIdx, col, width, spread, rowStep, shift) {
    const centre = (width - 1) / 2;
    const centrality = centre === 0 ? 1 : 1 - Math.abs(col - centre) / centre;
    const t = base + Math.round(centrality * spread) - Math.floor(rowIdx * rowStep);
    return clamp(t + shift, 0, TIERS.length - 1);
  }

  function buildHall() {
    const rng = makeRng(sessionKey());
    const sold = SOLD.get(sessionKey()) || new Set();
    const shift = buy.show.shift;
    const used = new Set();

    function makeSeat(section, rowLabel, seatNo, tierIdx) {
      const tier = TIERS[tierIdx];
      used.add(tierIdx);
      const seat = document.createElement("button");
      seat.type = "button";
      seat.className = "seat";
      seat.style.setProperty("--c", tier.color);
      const id = `${section.key}-${rowLabel}-${seatNo}`;
      seat.dataset.id = id;
      seat.dataset.tier = tierIdx;
      seat.dataset.row = rowLabel;
      seat.dataset.no = seatNo;
      seat.dataset.section = section.title;
      const rowText = rowLabel === "ложа" ? "ложа" : `ряд ${rowLabel}`;
      seat.dataset.tip = `${section.title} · ${rowText}, место ${seatNo} — ${fmt(tier.price)}`;
      seat.setAttribute("aria-label", seat.dataset.tip);
      seat.textContent = seatNo;
      // rng() вызываем всегда, чтобы раскладка не «плыла» после покупок
      const busy = rng() < (section.busy ?? 0.42);
      if (busy || sold.has(id)) {
        seat.classList.add("busy");
        seat.disabled = true;
        seat.setAttribute("aria-label", `${section.title} · ${rowText}, место ${seatNo} — занято`);
        seat.removeAttribute("data-tip");
      }
      return seat;
    }

    function block(section) {
      const el = document.createElement("div");
      el.className = "block";
      const t = document.createElement("div");
      t.className = "block-title";
      t.textContent = section.title;
      el.appendChild(t);
      section.rows.forEach((width, r) => {
        const row = document.createElement("div");
        row.className = "seat-row";
        for (let c = 0; c < width; c++) {
          const tierIdx = tierFor(section.base, r, c, width, section.spread, section.rowStep, shift);
          row.appendChild(makeSeat(section, r + 1, c + 1, tierIdx));
        }
        el.appendChild(row);
      });
      return el;
    }

    // ложи — лесенкой по одному месту
    function boxes(section, side) {
      const el = document.createElement("div");
      el.className = "boxes " + side;
      section.steps.forEach((tierIdx, i) => {
        const row = document.createElement("div");
        row.className = "seat-row box-step";
        const indent = side === "left" ? i * 14 : (section.steps.length - 1 - i) * 14;
        row.style.marginLeft = indent + "px";
        row.appendChild(makeSeat(section, "ложа", i + 1, clamp(tierIdx + shift, 0, TIERS.length - 1)));
        el.appendChild(row);
      });
      return el;
    }

    const band = (cls, ...children) => {
      const el = document.createElement("div");
      el.className = "plan-band" + (cls ? " " + cls : "");
      children.forEach((c) => el.appendChild(c));
      return el;
    };

    hallPlan.innerHTML = "";
    if (buy.show.hall === "small") {
      hallPlan.append(
        band("", block({ key: "par", title: "Партер", base: 4, spread: 3, rowStep: 0.5, busy: 0.4,
          rows: [10, 12, 12, 14, 14, 14, 12, 12] })),
        band("", block({ key: "bal", title: "Балкон", base: 0, spread: 2, rowStep: 0.3, busy: 0.35,
          rows: [12, 12] })),
      );
    } else {
      hallPlan.append(
        band("with-sides",
          boxes({ key: "boxL", title: "Ложа лев.", steps: [9, 8, 8, 7, 7, 6], busy: 0.3 }, "left"),
          block({ key: "par", title: "Партер", base: 6, spread: 4, rowStep: 0.5, busy: 0.4,
            rows: [20, 22, 24, 24, 26, 26, 24] }),
          boxes({ key: "boxR", title: "Ложа прав.", steps: [9, 8, 8, 7, 7, 6], busy: 0.3 }, "right")),
        band("",
          block({ key: "amfL", title: "Амфитеатр · левый", base: 2, spread: 3, rowStep: 0.25, busy: 0.45,
            rows: [8, 9, 9, 10, 10, 11, 11, 12] }),
          block({ key: "amfC", title: "Амфитеатр · центр", base: 4, spread: 4, rowStep: 0.4, busy: 0.45,
            rows: [16, 18, 18, 20, 20, 20, 18, 16, 14] }),
          block({ key: "amfR", title: "Амфитеатр · правый", base: 2, spread: 3, rowStep: 0.25, busy: 0.45,
            rows: [8, 9, 9, 10, 10, 11, 11, 12] })),
        band("",
          block({ key: "balL", title: "Балкон · лев.", base: 0, spread: 2, rowStep: 0.2, busy: 0.4, rows: [7, 8, 6] }),
          block({ key: "balC", title: "Балкон · центр", base: 1, spread: 2, rowStep: 0.3, busy: 0.4, rows: [9, 7, 5] }),
          block({ key: "balR", title: "Балкон · прав.", base: 0, spread: 2, rowStep: 0.2, busy: 0.4, rows: [7, 8, 6] })),
      );
    }

    // легенда — только тарифы, которые реально есть в этом зале
    const busySw = `<span class="leg-item busy"><span class="leg-sw"></span>Занято</span>`;
    $("#legend").innerHTML = busySw + [...used].sort((a, b) => a - b).map((i) =>
      `<span class="leg-item"><span class="leg-sw" style="--sw:${TIERS[i].color}"></span>${TIERS[i].price.toLocaleString("ru-RU")}&nbsp;₽</span>`
    ).join("");

    // схема шире модалки — начинаем с центра
    const sc = $("#seatmapScroll");
    requestAnimationFrame(() => { sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; });
  }

  /* ============================================================ BUY · selection */
  hallPlan.addEventListener("click", (e) => {
    const seat = e.target.closest(".seat");
    if (!seat || seat.classList.contains("busy")) return;
    const id = seat.dataset.id;
    if (buy.selected.has(id)) {
      buy.selected.delete(id);
      seat.classList.remove("selected");
      seat.setAttribute("aria-pressed", "false");
    } else {
      if (buy.selected.size >= MAX_SEATS) { toast(`Можно выбрать не более ${MAX_SEATS} мест за раз`); return; }
      const tier = TIERS[+seat.dataset.tier];
      buy.selected.set(id, {
        id, row: seat.dataset.row, no: +seat.dataset.no,
        section: seat.dataset.section, price: tier.price, color: tier.color,
      });
      seat.classList.add("selected");
      seat.setAttribute("aria-pressed", "true");
    }
    renderOrder();
  });

  const seatText = (s) => s.row === "ложа" ? `Ложа, место ${s.no}` : `Ряд ${s.row}, место ${s.no}`;
  const seatShort = (s) => s.row === "ложа" ? `${s.section}, м.${s.no}` : `${s.section}, р.${s.row} м.${s.no}`;

  function totals() {
    const seats = [...buy.selected.values()];
    const subtotal = seats.reduce((a, s) => a + s.price, 0);
    const fee = seats.length * SERVICE_FEE;
    return { seats, subtotal, fee, grand: subtotal + fee, bonus: Math.round(subtotal * BONUS_RATE) };
  }

  const orderList = $("#orderList");
  function renderOrder() {
    const { seats, fee, grand, bonus } = totals();
    orderList.querySelectorAll(".order-item").forEach((n) => n.remove());
    $("#orderEmpty").style.display = seats.length ? "none" : "block";
    seats.forEach((s) => {
      const li = document.createElement("li");
      li.className = "order-item";
      li.innerHTML = `
        <span class="oi-chip" style="background:${s.color}"></span>
        <span class="oi-info">
          <span class="oi-seat">${seatText(s)}</span>
          <span class="oi-zone">${s.section}</span>
        </span>
        <span class="oi-price">${fmt(s.price)}</span>
        <button class="oi-rm" type="button" data-id="${s.id}" aria-label="Убрать: ${seatText(s)}">✕</button>`;
      orderList.appendChild(li);
    });
    $("#totalCount").textContent = seats.length;
    $("#totalFee").textContent = fmt(fee);
    $("#totalSum").textContent = fmt(grand);
    $("#totalBonus").textContent = "+" + fmt(bonus);
    $("#toCheckoutBtn").disabled = seats.length === 0;
  }

  orderList.addEventListener("click", (e) => {
    const btn = e.target.closest(".oi-rm");
    if (!btn) return;
    buy.selected.delete(btn.dataset.id);
    const seat = hallPlan.querySelector(`.seat[data-id="${CSS.escape(btn.dataset.id)}"]`);
    if (seat) { seat.classList.remove("selected"); seat.setAttribute("aria-pressed", "false"); }
    renderOrder();
  });

  /* ---------- tooltip над местом (узел в <body>, чтобы не резался скроллом) ---------- */
  const tipEl = $("#seatTip");
  function showTip(seat) {
    const tip = seat.dataset.tip;
    if (!tip) return;
    const [label, price] = tip.split(" — ");
    tipEl.innerHTML = price ? `${label}<span class="st-price">${price}</span>` : label;
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
  hallPlan.addEventListener("mouseout", (e) => { if (e.target.closest(".seat")) hideTip(); });
  hallPlan.addEventListener("focusin", (e) => {
    const seat = e.target.closest(".seat");
    if (seat && !seat.classList.contains("busy")) showTip(seat);
  });
  hallPlan.addEventListener("focusout", hideTip);
  $("#seatmapScroll").addEventListener("scroll", hideTip, { passive: true });
  buyModal.querySelector(".modal-panel").addEventListener("scroll", hideTip, { passive: true });

  /* ============================================================ BUY · checkout */
  $("#toCheckoutBtn").addEventListener("click", () => {
    const { seats, fee, grand } = totals();
    if (!seats.length) return;
    $("#ckSeatList").innerHTML = seats.map((s) =>
      `<li><span>${seatShort(s)}</span><span class="cs-price">${fmt(s.price)}</span></li>`
    ).join("") + `<li><span>Сервисный сбор × ${seats.length}</span><span class="cs-price">${fmt(fee)}</span></li>`;
    $("#ckTotal").textContent = fmt(grand);
    $("#payAmount").textContent = fmt(grand);
    setStep("checkout");
    if (buy.inline) openModal(buyModal);
    const first = $("#ckForm").querySelector("input");
    if (first) first.focus({ preventScroll: true });
  });

  $("#backToSeats").addEventListener("click", () => {
    if (!buy.inline) return setStep("seats");
    closeModal(buyModal);
    document.getElementById("hall").scrollIntoView({ behavior: "smooth" });
  });

  $("#ckForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const payBtn = $("#payBtn");
    payBtn.disabled = true;
    const label = payBtn.innerHTML;
    payBtn.textContent = "Обработка…";

    setTimeout(() => {
      const { seats, grand } = totals();
      const key = sessionKey();
      const sold = SOLD.get(key) || new Set();
      seats.forEach((s) => sold.add(s.id));
      SOLD.set(key, sold);

      const s = buy.show.sessions[buy.sIdx];
      $("#successTitle").textContent = buy.show.title;
      $("#successWhen").textContent = `${dayLong(s)} ${s.y} · ${buy.time} · ${s.venue.title}`;
      $("#successSeats").textContent = seats.map(seatShort).join("  ·  ");
      $("#successTotal").textContent = fmt(grand);

      buy.selected.clear();
      buildHall();
      renderOrder();
      form.reset();
      payBtn.disabled = false;
      payBtn.innerHTML = label;
      setStep("done");
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

  /* ---------- header condensation ---------- */
  const head = document.querySelector(".site-head");
  const onScroll = () => head.classList.toggle("scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ============================================================ INIT */
  if (grid) { buildChips(); renderCards(); }
  const showRoot = $("#showPage");
  if (showRoot) renderShowPage(showRoot);
  window.addEventListener("scroll", hideTip, { passive: true });

  // глубокая ссылка на покупку: index.html?buy=guests · show.html?id=guests&buy=guests
  const buyId = new URLSearchParams(location.search).get("buy");
  if (buyId && showById(buyId) && !buy.inline) openBuy(buyId);
})();
