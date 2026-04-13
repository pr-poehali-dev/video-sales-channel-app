import {
  createContext, useContext, useState,
  useCallback, useEffect, type ReactNode,
} from "react";

const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

async function api(action: string, method: "GET" | "POST" | "PATCH" = "GET", body?: object) {
  const url = `${API}?action=${action}`;
  const opts: RequestInit = { method };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  return res.json();
}

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
  weightG?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  cdekEnabled?: boolean;
  nalogEnabled?: boolean;
  fittingEnabled?: boolean;
  fromCityCode?: number;
  fromCityName?: string;
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
  videoUrl?: string | null;
  thumbnail?: string | null;
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

export interface SellerReview {
  id: string;
  sellerId: string;
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
  loading: boolean;
  reload: () => void;
  addProduct: (data: Omit<StoreProduct, "id" | "createdAt">) => Promise<StoreProduct>;
  updateProduct: (id: string, data: Partial<StoreProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addStream: (data: Omit<StoreStream, "id" | "startedAt">) => Promise<StoreStream>;
  updateStream: (id: string, data: Partial<StoreStream> & { duration_sec?: number }) => Promise<void>;
  deleteStream: (id: string) => Promise<void>;
  getSellerProducts: (sellerId: string) => StoreProduct[];
  getSellerStreams: (sellerId: string) => StoreStream[];
  getStreamMessages: (streamId: string) => Promise<ChatMessage[]>;
  addChatMessage: (msg: Omit<ChatMessage, "id" | "sentAt">) => Promise<ChatMessage>;
  getProductReviews: (productId: string) => Promise<{ reviews: Review[]; avg: number; count: number }>;
  addReview: (data: Omit<Review, "id" | "createdAt">) => Promise<Review>;
  hasUserReviewed: (productId: string, userId: string) => boolean;
  getSellerReviews: (sellerId: string) => Promise<{ reviews: SellerReview[]; avg: number; count: number }>;
  addSellerReview: (data: Omit<SellerReview, "id" | "createdAt">) => Promise<SellerReview>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [streams, setStreams]   = useState<StoreStream[]>([]);
  const [loading, setLoading]   = useState(true);
  // кэш: productId → userId[] (для hasUserReviewed до первого запроса)
  const [reviewedCache, setReviewedCache] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, strs] = await Promise.all([
        api("get_products"),
        api("get_streams"),
      ]);
      setProducts(prods);
      setStreams(strs);
    } catch (e) {
      console.error("StoreContext load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── PRODUCTS ── */
  const addProduct = useCallback(async (data: Omit<StoreProduct, "id" | "createdAt">) => {
    const p = await api("add_product", "POST", {
      name: data.name, price: data.price, category: data.category,
      description: data.description, images: data.images,
      seller_id: data.sellerId, seller_name: data.sellerName,
      seller_avatar: data.sellerAvatar, in_stock: data.inStock,
    });
    setProducts(prev => [p, ...prev]);
    return p;
  }, []);

  const updateProduct = useCallback(async (id: string, data: Partial<StoreProduct>) => {
    const updated = await api("update_product", "PATCH", { id, ...data });
    setProducts(prev => prev.map(p => p.id === id ? updated : p));
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await api("delete_product", "POST", { id });
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  /* ── STREAMS ── */
  const addStream = useCallback(async (data: Omit<StoreStream, "id" | "startedAt">) => {
    const s = await api("add_stream", "POST", {
      title: data.title, seller_id: data.sellerId,
      seller_name: data.sellerName, seller_avatar: data.sellerAvatar,
    });
    setStreams(prev => [s, ...prev]);
    return s;
  }, []);

  const updateStream = useCallback(async (id: string, data: Partial<StoreStream> & { duration_sec?: number }) => {
    const updated = await api("update_stream", "PATCH", { id, ...data,
      is_live: data.isLive,
      duration_sec: data.duration_sec ?? data.duration,
    });
    setStreams(prev => prev.map(s => s.id === id ? updated : s));
  }, []);

  const deleteStream = useCallback(async (id: string) => {
    await api("delete_stream", "POST", { id });
    setStreams(prev => prev.filter(s => s.id !== id));
  }, []);

  /* ── SELECTORS ── */
  const getSellerProducts = useCallback((sellerId: string) =>
    products.filter(p => p.sellerId === sellerId), [products]);

  const getSellerStreams = useCallback((sellerId: string) =>
    streams.filter(s => s.sellerId === sellerId), [streams]);

  /* ── CHAT ── */
  const getStreamMessages = useCallback(async (streamId: string): Promise<ChatMessage[]> => {
    return api(`get_chat&stream_id=${streamId}`);
  }, []);

  const addChatMessage = useCallback(async (msg: Omit<ChatMessage, "id" | "sentAt">) => {
    return api("add_chat", "POST", {
      stream_id: msg.streamId, user_id: msg.userId,
      user_name: msg.userName, user_avatar: msg.userAvatar, text: msg.text,
    });
  }, []);

  /* ── REVIEWS ── */
  const getProductReviews = useCallback(async (productId: string) => {
    const data = await api(`get_reviews&product_id=${productId}`);
    // обновляем кэш
    setReviewedCache(prev => ({
      ...prev,
      [productId]: data.reviews.map((r: Review) => r.userId),
    }));
    return data;
  }, []);

  const addReview = useCallback(async (data: Omit<Review, "id" | "createdAt">) => {
    const r = await api("add_review", "POST", {
      product_id: data.productId, user_id: data.userId,
      user_name: data.userName, user_avatar: data.userAvatar,
      rating: data.rating, text: data.text,
    });
    setReviewedCache(prev => ({
      ...prev,
      [data.productId]: [...(prev[data.productId] ?? []), data.userId],
    }));
    return r;
  }, []);

  const hasUserReviewed = useCallback((productId: string, userId: string) =>
    (reviewedCache[productId] ?? []).includes(userId), [reviewedCache]);

  const getSellerReviews = useCallback(async (sellerId: string) => {
    return api(`get_seller_reviews&seller_id=${sellerId}`);
  }, []);

  const addSellerReview = useCallback(async (data: Omit<SellerReview, "id" | "createdAt">) => {
    return api("add_seller_review", "POST", {
      seller_id: data.sellerId, user_id: data.userId,
      user_name: data.userName, user_avatar: data.userAvatar,
      rating: data.rating, text: data.text,
    });
  }, []);

  return (
    <StoreContext.Provider value={{
      products, streams, loading, reload: load,
      addProduct, updateProduct, deleteProduct,
      addStream, updateStream, deleteStream,
      getSellerProducts, getSellerStreams,
      getStreamMessages, addChatMessage,
      getProductReviews, addReview, hasUserReviewed,
      getSellerReviews, addSellerReview,
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