import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { CartItem } from "@/App";
import type { StoreProduct } from "@/context/StoreContext";

interface ProductCardProps {
  product: StoreProduct;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onClick?: () => void;
}

export default function ProductCard({ product, addToCart, onClick }: ProductCardProps) {
  const [added, setAdded] = useState(false);

  const coverImage = product.images[0] ?? null;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: coverImage ?? "",
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      onClick={onClick}
      className={`bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all group ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {coverImage ? (
          <img
            src={coverImage}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            width={300}
            height={300}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="Package" size={36} className="text-muted-foreground opacity-30" />
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-1">{product.name}</p>
        <p className="text-xs text-muted-foreground mb-2">{product.sellerName}</p>

        <div className="flex items-center justify-between">
          <span className="font-oswald text-base font-semibold text-foreground">
            {product.price.toLocaleString("ru")} ₽
          </span>
          <button
            onClick={handleAdd}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
              added
                ? "bg-green-500/20 text-green-600"
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