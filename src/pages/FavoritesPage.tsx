import { useFavorites } from "@/context/FavoritesContext";
import ProductCard from "@/components/ProductCard";
import Icon from "@/components/ui/icon";
import type { CartItem } from "@/App";
import type { StoreProduct } from "@/context/StoreContext";

interface FavoritesPageProps {
  addToCart: (item: Omit<CartItem, "qty">) => void;
  updateQty: (id: string, qty: number) => void;
  cart: CartItem[];
  onProductClick: (id: string) => void;
}

export default function FavoritesPage({ addToCart, updateQty, cart, onProductClick }: FavoritesPageProps) {
  const { favorites, toggleFavorite } = useFavorites();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Избранное</h1>
          {favorites.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{favorites.length} товар{favorites.length === 1 ? "" : favorites.length < 5 ? "а" : "ов"}</p>
          )}
        </div>
        {favorites.length > 0 && (
          <button
            onClick={() => favorites.forEach(p => toggleFavorite(p))}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Очистить
          </button>
        )}
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="Heart" size={28} className="text-muted-foreground opacity-30" />
          </div>
          <h2 className="font-semibold text-foreground mb-1">Список пуст</h2>
          <p className="text-sm text-muted-foreground">Нажимайте ♡ на товарах, чтобы добавить в избранное</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {favorites.map((product: StoreProduct) => {
            const cartQty = cart.find(c => c.id === product.id)?.qty ?? 0;
            return (
              <ProductCard
                key={product.id}
                product={product}
                addToCart={addToCart}
                updateQty={updateQty}
                cartQty={cartQty}
                onClick={() => onProductClick(product.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
