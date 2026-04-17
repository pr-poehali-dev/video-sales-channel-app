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
  fromCityCode?: string;
  fromCityName?: string;
  videoUrl?: string;
  wholesalePrice?: number | null;
  retailMarkupPct?: number;
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
  banChatUser: (streamId: string, userId: string, bannedBy: string) => Promise<void>;
  unbanChatUser: (streamId: string, userId: string) => Promise<void>;
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
      weight_g: (data as { weightG?: number }).weightG,
      length_cm: (data as { lengthCm?: number }).lengthCm,
      width_cm: (data as { widthCm?: number }).widthCm,
      height_cm: (data as { heightCm?: number }).heightCm,
      cdek_enabled: (data as { cdekEnabled?: boolean }).cdekEnabled,
      nalog_enabled: (data as { nalogEnabled?: boolean }).nalogEnabled,
      fitting_enabled: (data as { fittingEnabled?: boolean }).fittingEnabled,
      from_city_code: (data as { fromCityCode?: string }).fromCityCode,
      from_city_name: (data as { fromCityName?: string }).fromCityName,
      video_url: data.videoUrl ?? "",
      wholesale_price: (data as { wholesalePrice?: number | null }).wholesalePrice ?? null,
      retail_markup_pct: (data as { retailMarkupPct?: number }).retailMarkupPct ?? 0,
    });
    setProducts(prev => [p, ...prev]);
    return p;
  }, []);

  const updateProduct = useCallback(async (id: string, data: Partial<StoreProduct>) => {
    const d = data as Record<string, unknown>;
    const updated = await api("update_product", "PATCH", {
      id,
      ...(d.name !== undefined && { name: d.name }),
      ...(d.price !== undefined && { price: d.price }),
      ...(d.category !== undefined && { category: d.category }),
      ...(d.description !== undefined && { description: d.description }),
      ...(d.images !== undefined && { images: d.images }),
      ...(d.inStock !== undefined && { in_stock: d.inStock }),
      ...(d.weightG !== undefined && { weight_g: d.weightG }),
      ...(d.lengthCm !== undefined && { length_cm: d.lengthCm }),
      ...(d.widthCm !== undefined && { width_cm: d.widthCm }),
      ...(d.heightCm !== undefined && { height_cm: d.heightCm }),
      ...(d.cdekEnabled !== undefined && { cdek_enabled: d.cdekEnabled }),
      ...(d.nalogEnabled !== undefined && { nalog_enabled: d.nalogEnabled }),
      ...(d.fittingEnabled !== undefined && { fitting_enabled: d.fittingEnabled }),
      ...(d.fromCityCode !== undefined && { from_city_code: d.fromCityCode }),
      ...(d.fromCityName !== undefined && { from_city_name: d.fromCityName }),
      ...(d.videoUrl !== undefined && { video_url: d.videoUrl }),
      ...(d.wholesalePrice !== undefined && { wholesale_price: d.wholesalePrice }),
      ...(d.retailMarkupPct !== undefined && { retail_markup_pct: d.retailMarkupPct }),
    });
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

  const banChatUser = useCallback(async (streamId: string, userId: string, bannedBy: string) => {
    await api("ban_user", "POST", { stream_id: streamId, user_id: userId, banned_by: bannedBy });
  }, []);

  const unbanChatUser = useCallback(async (streamId: string, userId: string) => {
    await api("unban_user", "POST", { stream_id: streamId, user_id: userId });
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
      getStreamMessages, addChatMessage, banChatUser, unbanChatUser,
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