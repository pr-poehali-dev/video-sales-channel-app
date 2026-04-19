import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { StoreProduct } from "@/context/StoreContext";

interface FavoritesContextType {
  favorites: StoreProduct[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (product: StoreProduct) => void;
  favCount: number;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  isFavorite: () => false,
  toggleFavorite: () => {},
  favCount: 0,
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<StoreProduct[]>(() => {
    try {
      const raw = localStorage.getItem("favorites");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }, [favorites]);

  const isFavorite = useCallback((id: string) => favorites.some(f => f.id === id), [favorites]);

  const toggleFavorite = useCallback((product: StoreProduct) => {
    setFavorites(prev =>
      prev.some(f => f.id === product.id)
        ? prev.filter(f => f.id !== product.id)
        : [product, ...prev]
    );
  }, []);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, favCount: favorites.length }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);
