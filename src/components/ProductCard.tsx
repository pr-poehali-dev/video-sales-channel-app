import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { CartItem } from "@/App";

interface Product {
  id: number;
  name: string;
  price: number;
  oldPrice: number | null;
  category: string;
  rating: number;
  reviews: number;
  image: string;
  isFav: boolean;
  isNew: boolean;
}

interface ProductCardProps {
  product: Product;
  addToCart: (item: Omit<CartItem, "qty">) => void;
}

export default function ProductCard({ product, addToCart }: ProductCardProps) {
  const [fav, setFav] = useState(product.isFav);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addToCart({ id: product.id, name: product.name, price: product.price, image: product.image });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all group">
      <div className="relative aspect-square overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
        />
        {product.isNew && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded">
            NEW
          </div>
        )}
        {product.oldPrice && (
          <div className="absolute top-2 right-8 bg-destructive text-white text-[10px] font-bold px-2 py-0.5 rounded">
            -{Math.round((1 - product.price / product.oldPrice) * 100)}%
          </div>
        )}
        <button
          onClick={() => setFav(!fav)}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <Icon name={fav ? "Heart" : "Heart"} size={14} className={fav ? "text-red-400 fill-red-400" : "text-white"} />
        </button>
      </div>

      <div className="p-3">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-2">{product.name}</p>

        <div className="flex items-center gap-1 mb-3">
          <Icon name="Star" size={12} className="text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-muted-foreground">{product.rating} ({product.reviews})</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="font-oswald text-base font-semibold text-foreground">
              {product.price.toLocaleString("ru")} ₽
            </span>
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground line-through ml-1.5">
                {product.oldPrice.toLocaleString("ru")} ₽
              </span>
            )}
          </div>
          <button
            onClick={handleAdd}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
              added
                ? "bg-green-500/20 text-green-400"
                : "bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground"
            }`}
          >
            <Icon name={added ? "Check" : "Plus"} size={13} />
            {added ? "Добавлено" : "В корзину"}
          </button>
        </div>
      </div>
    </div>
  );
}
