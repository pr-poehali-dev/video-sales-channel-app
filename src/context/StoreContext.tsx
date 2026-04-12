import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface StoreProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  images: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  createdAt: string;
  inStock: number;
}

export interface StoreStream {
  id: string;
  title: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  isLive: boolean;
  viewers: number;
  startedAt: string;
  endedAt?: string;
  duration?: number;
}

export interface ChatMessage {
  id: string;
  streamId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  sentAt: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  text: string;
  createdAt: string;
}

interface StoreContextType {
  products: StoreProduct[];
  streams: StoreStream[];
  reviews: Review[];
  chatMessages: ChatMessage[];
  addProduct: (product: Omit<StoreProduct, "id" | "createdAt">) => StoreProduct;
  updateProduct: (id: string, data: Partial<StoreProduct>) => void;
  deleteProduct: (id: string) => void;
  addStream: (stream: Omit<StoreStream, "id">) => StoreStream;
  updateStream: (id: string, data: Partial<StoreStream>) => void;
  getSellerProducts: (sellerId: string) => StoreProduct[];
  getSellerStreams: (sellerId: string) => StoreStream[];
  addChatMessage: (msg: Omit<ChatMessage, "id" | "sentAt">) => void;
  getStreamMessages: (streamId: string) => ChatMessage[];
  addReview: (review: Omit<Review, "id" | "createdAt">) => void;
  getProductReviews: (productId: string) => Review[];
  getProductRating: (productId: string) => { avg: number; count: number };
  hasUserReviewed: (productId: string, userId: string) => boolean;
}

const StoreContext = createContext<StoreContextType | null>(null);

const PRODUCTS_KEY = "yugastore_products_v2";
const STREAMS_KEY  = "yugastore_streams_v2";
const CHAT_KEY     = "yugastore_chat_v1";
const REVIEWS_KEY  = "yugastore_reviews_v1";

function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}
function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts]     = useState<StoreProduct[]>(() => load(PRODUCTS_KEY));
  const [streams,  setStreams]       = useState<StoreStream[]>(() => load(STREAMS_KEY));
  const [chatMessages, setChat]     = useState<ChatMessage[]>(() => load(CHAT_KEY));
  const [reviews, setReviews]       = useState<Review[]>(() => load(REVIEWS_KEY));

  /* ── PRODUCTS ── */
  const addProduct = useCallback((data: Omit<StoreProduct, "id" | "createdAt">): StoreProduct => {
    const p: StoreProduct = {
      ...data,
      id: `prod_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }),
    };
    setProducts(prev => { const u = [p, ...prev]; save(PRODUCTS_KEY, u); return u; });
    return p;
  }, []);

  const updateProduct = useCallback((id: string, data: Partial<StoreProduct>) => {
    setProducts(prev => { const u = prev.map(p => p.id === id ? { ...p, ...data } : p); save(PRODUCTS_KEY, u); return u; });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => { const u = prev.filter(p => p.id !== id); save(PRODUCTS_KEY, u); return u; });
  }, []);

  /* ── STREAMS ── */
  const addStream = useCallback((data: Omit<StoreStream, "id">): StoreStream => {
    const s: StoreStream = { ...data, id: `stream_${Date.now()}_${Math.random().toString(36).slice(2)}` };
    setStreams(prev => { const u = [s, ...prev]; save(STREAMS_KEY, u); return u; });
    return s;
  }, []);

  const updateStream = useCallback((id: string, data: Partial<StoreStream>) => {
    setStreams(prev => { const u = prev.map(s => s.id === id ? { ...s, ...data } : s); save(STREAMS_KEY, u); return u; });
  }, []);

  /* ── CHAT ── */
  const addChatMessage = useCallback((msg: Omit<ChatMessage, "id" | "sentAt">) => {
    const m: ChatMessage = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sentAt: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
    };
    setChat(prev => {
      // храним последние 500 сообщений на стрим
      const u = [...prev, m].slice(-500);
      save(CHAT_KEY, u);
      return u;
    });
  }, []);

  const getStreamMessages = useCallback((streamId: string) =>
    chatMessages.filter(m => m.streamId === streamId), [chatMessages]);

  /* ── REVIEWS ── */
  const addReview = useCallback((data: Omit<Review, "id" | "createdAt">) => {
    const r: Review = {
      ...data,
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }),
    };
    setReviews(prev => { const u = [r, ...prev]; save(REVIEWS_KEY, u); return u; });
  }, []);

  const getProductReviews = useCallback((productId: string) =>
    reviews.filter(r => r.productId === productId), [reviews]);

  const getProductRating = useCallback((productId: string) => {
    const pr = reviews.filter(r => r.productId === productId);
    if (pr.length === 0) return { avg: 0, count: 0 };
    return { avg: +(pr.reduce((s, r) => s + r.rating, 0) / pr.length).toFixed(1), count: pr.length };
  }, [reviews]);

  const hasUserReviewed = useCallback((productId: string, userId: string) =>
    reviews.some(r => r.productId === productId && r.userId === userId), [reviews]);

  /* ── SELECTORS ── */
  const getSellerProducts = useCallback((sellerId: string) =>
    products.filter(p => p.sellerId === sellerId), [products]);

  const getSellerStreams = useCallback((sellerId: string) =>
    streams.filter(s => s.sellerId === sellerId), [streams]);

  return (
    <StoreContext.Provider value={{
      products, streams, reviews, chatMessages,
      addProduct, updateProduct, deleteProduct,
      addStream, updateStream,
      getSellerProducts, getSellerStreams,
      addChatMessage, getStreamMessages,
      addReview, getProductReviews, getProductRating, hasUserReviewed,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
