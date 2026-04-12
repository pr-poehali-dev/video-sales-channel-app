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

interface StoreContextType {
  products: StoreProduct[];
  streams: StoreStream[];
  addProduct: (product: Omit<StoreProduct, "id" | "createdAt">) => StoreProduct;
  updateProduct: (id: string, data: Partial<StoreProduct>) => void;
  deleteProduct: (id: string) => void;
  addStream: (stream: Omit<StoreStream, "id">) => StoreStream;
  updateStream: (id: string, data: Partial<StoreStream>) => void;
  getSellerProducts: (sellerId: string) => StoreProduct[];
  getSellerStreams: (sellerId: string) => StoreStream[];
}

const StoreContext = createContext<StoreContextType | null>(null);

const PRODUCTS_KEY = "yugastore_products_v2";
const STREAMS_KEY = "yugastore_streams_v2";

function loadProducts(): StoreProduct[] {
  try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "[]"); }
  catch { return []; }
}

function loadStreams(): StoreStream[] {
  try { return JSON.parse(localStorage.getItem(STREAMS_KEY) || "[]"); }
  catch { return []; }
}

function saveProducts(data: StoreProduct[]) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(data));
}

function saveStreams(data: StoreStream[]) {
  localStorage.setItem(STREAMS_KEY, JSON.stringify(data));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<StoreProduct[]>(loadProducts);
  const [streams, setStreams] = useState<StoreStream[]>(loadStreams);

  const addProduct = useCallback((data: Omit<StoreProduct, "id" | "createdAt">): StoreProduct => {
    const product: StoreProduct = {
      ...data,
      id: `prod_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }),
    };
    setProducts(prev => {
      const updated = [product, ...prev];
      saveProducts(updated);
      return updated;
    });
    return product;
  }, []);

  const updateProduct = useCallback((id: string, data: Partial<StoreProduct>) => {
    setProducts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...data } : p);
      saveProducts(updated);
      return updated;
    });
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveProducts(updated);
      return updated;
    });
  }, []);

  const addStream = useCallback((data: Omit<StoreStream, "id">): StoreStream => {
    const stream: StoreStream = {
      ...data,
      id: `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
    setStreams(prev => {
      const updated = [stream, ...prev];
      saveStreams(updated);
      return updated;
    });
    return stream;
  }, []);

  const updateStream = useCallback((id: string, data: Partial<StoreStream>) => {
    setStreams(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, ...data } : s);
      saveStreams(updated);
      return updated;
    });
  }, []);

  const getSellerProducts = useCallback((sellerId: string) =>
    products.filter(p => p.sellerId === sellerId), [products]);

  const getSellerStreams = useCallback((sellerId: string) =>
    streams.filter(s => s.sellerId === sellerId), [streams]);

  return (
    <StoreContext.Provider value={{
      products, streams,
      addProduct, updateProduct, deleteProduct,
      addStream, updateStream,
      getSellerProducts, getSellerStreams,
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
