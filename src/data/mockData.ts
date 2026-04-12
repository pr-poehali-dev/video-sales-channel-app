// Все данные — пустые. Товары и эфиры добавляются продавцами через кабинет.

export interface Seller {
  id: number;
  name: string;
  avatar: string;
  city: string;
  rating: number;
  reviews: number;
  subscribers: number;
  sales: number;
  bio: string;
  isVerified: boolean;
  joinedAt: string;
}

export const sellers: Seller[] = [];

export interface Stream {
  id: number;
  title: string;
  host: string;
  sellerId: number;
  avatar: string;
  viewers: number;
  isLive: boolean;
  category: string;
  thumb: string;
  rating: number;
  products: number;
  startedAt: string;
}

export const streams: Stream[] = [];

export interface Product {
  id: number;
  name: string;
  price: number;
  oldPrice: number | null;
  category: string;
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  isFav: boolean;
  isNew: boolean;
  sellerId: number;
  description: string;
  inStock: number;
}

export const products: Product[] = [];

export const CATEGORIES = ["Все", "Украшения", "Красота", "Одежда", "Электроника", "Аксессуары", "Дом", "Спорт", "Еда"];

export interface Review {
  id: number;
  productId: number;
  author: string;
  avatar: string;
  rating: number;
  text: string;
  date: string;
  helpful: number;
}

export const reviews: Review[] = [];

export const chatMessages: { id: number; user: string; text: string; time: string; isHost: boolean }[] = [];
