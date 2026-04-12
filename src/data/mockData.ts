export const STREAM_THUMB = "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/fae8a48f-bc29-425d-9378-19525bb12ba6.jpg";
export const STREAM_THUMB_2 = "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/b79dcc45-c2cb-4e16-b7a3-63ff51054172.jpg";
export const STREAM_THUMB_3 = "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/4cfa10ce-0501-4940-b39e-22fb497be014.jpg";

const IMG_RING = "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/6c15c83b-4532-407a-a0e5-d7c0afa45793.jpg";
const IMG_CREAM = "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/df82fa5c-8e50-489a-9b0d-064c8b556643.jpg";
const IMG_BAG = "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/0313d4b4-04de-4ce7-bb45-608e9f663d27.jpg";

export const streams = [
  {
    id: 1,
    title: "Серебряные украшения ручной работы — новая коллекция",
    host: "Анна Белова",
    avatar: "АБ",
    viewers: 1547,
    isLive: true,
    category: "Украшения",
    thumb: STREAM_THUMB,
    rating: 4.9,
    products: 14,
    startedAt: "2 ч назад",
  },
  {
    id: 2,
    title: "Натуральная косметика из берёзового сока — распродажа",
    host: "Мария Иванова",
    avatar: "МИ",
    viewers: 932,
    isLive: true,
    category: "Красота",
    thumb: STREAM_THUMB_2,
    rating: 4.8,
    products: 10,
    startedAt: "40 мин назад",
  },
  {
    id: 3,
    title: "Умная техника для дома — обзор и живые цены",
    host: "Дмитрий Орлов",
    avatar: "ДО",
    viewers: 674,
    isLive: true,
    category: "Электроника",
    thumb: STREAM_THUMB_3,
    rating: 4.7,
    products: 8,
    startedAt: "1 ч назад",
  },
  {
    id: 4,
    title: "Льняная одежда — летняя коллекция",
    host: "Дарья Смирнова",
    avatar: "ДС",
    viewers: 0,
    isLive: false,
    category: "Одежда",
    thumb: STREAM_THUMB_2,
    rating: 4.6,
    products: 18,
    startedAt: "вчера",
  },
  {
    id: 5,
    title: "Кожаные сумки и ремни — российское производство",
    host: "Алексей Кузнецов",
    avatar: "АК",
    viewers: 0,
    isLive: false,
    category: "Аксессуары",
    thumb: STREAM_THUMB,
    rating: 4.7,
    products: 12,
    startedAt: "2 дня назад",
  },
  {
    id: 6,
    title: "Уход за кожей — органика и травы",
    host: "Ольга Петрова",
    avatar: "ОП",
    viewers: 0,
    isLive: false,
    category: "Красота",
    thumb: STREAM_THUMB_2,
    rating: 4.5,
    products: 7,
    startedAt: "3 дня назад",
  },
];

export const products = [
  { id: 1, name: "Серебряное кольцо с голубым топазом", price: 3400, oldPrice: 4800, category: "Украшения", rating: 4.9, reviews: 143, image: IMG_RING, isFav: false, isNew: true },
  { id: 2, name: "Сыворотка с берёзовым соком и гиалуроном", price: 1690, oldPrice: null, category: "Красота", rating: 4.8, reviews: 108, image: IMG_CREAM, isFav: true, isNew: false },
  { id: 3, name: "Льняная рубашка ручной вышивки", price: 4200, oldPrice: 6000, category: "Одежда", rating: 4.6, reviews: 75, image: STREAM_THUMB_2, isFav: false, isNew: false },
  { id: 4, name: "Умная колонка Яндекс Станция Макс", price: 9990, oldPrice: null, category: "Электроника", rating: 4.8, reviews: 234, image: STREAM_THUMB_3, isFav: false, isNew: true },
  { id: 5, name: "Кожаная сумка бордо — ручная работа", price: 11800, oldPrice: 15500, category: "Аксессуары", rating: 4.7, reviews: 52, image: IMG_BAG, isFav: true, isNew: false },
  { id: 6, name: "Крем с ромашкой и мёдом SPF 30", price: 890, oldPrice: null, category: "Красота", rating: 4.5, reviews: 197, image: IMG_CREAM, isFav: false, isNew: false },
  { id: 7, name: "Золотые серьги с янтарём 585 проба", price: 8200, oldPrice: 10400, category: "Украшения", rating: 4.9, reviews: 88, image: IMG_RING, isFav: false, isNew: false },
  { id: 8, name: "Беспроводные наушники SberSound Air", price: 3800, oldPrice: null, category: "Электроника", rating: 4.6, reviews: 167, image: STREAM_THUMB_3, isFav: false, isNew: true },
];

export const CATEGORIES = ["Все", "Украшения", "Красота", "Одежда", "Электроника", "Аксессуары"];

export const chatMessages = [
  { id: 1, user: "Катя_М", text: "Это кольцо есть в 17 размере?", time: "14:32", isHost: false },
  { id: 2, user: "Анна Белова", text: "Да, есть! Последний экземпляр 🔥", time: "14:32", isHost: true },
  { id: 3, user: "user_vika", text: "Доставляете в Краснодар?", time: "14:33", isHost: false },
  { id: 4, user: "Иван_К", text: "Взял сразу два, подарю жене!", time: "14:33", isHost: false },
  { id: 5, user: "Светлана_НН", text: "Можно оплатить через СБП?", time: "14:34", isHost: false },
  { id: 6, user: "Анна Белова", text: "Конечно! СБП, карта — всё доступно.", time: "14:34", isHost: true },
  { id: 7, user: "Nastya_shop", text: "Очень красиво, беру в подарок маме 🎁", time: "14:35", isHost: false },
];
