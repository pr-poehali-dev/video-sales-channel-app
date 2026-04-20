import { useRef, useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import type { CartItem } from "@/App";
import type { StoreProduct } from "@/context/StoreContext";
import { usePriceMode } from "@/context/PriceModeContext";
import { useFavorites } from "@/context/FavoritesContext";

interface ProductCardProps {
  product: StoreProduct;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  updateQty?: (id: string, qty: number) => void;
  cartQty?: number;
  onClick?: () => void;
}

function VideoPreview({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const onReady = () => {
      v.play().catch(() => {});
      setReady(true);
    };
    v.addEventListener("loadeddata", onReady);
    return () => v.removeEventListener("loadeddata", onReady);
  }, [src]);

  return (
    <div className="absolute inset-0">
      {poster && !ready && (
        <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <video
        ref={videoRef}
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: ready ? 1 : 0 }}
        playsInline
        muted
        loop
        autoPlay
        preload="auto"
      />
      <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
        <Icon name="Video" size={11} className="text-white" />
      </div>
    </div>
  );
}

export default function ProductCard({ product, addToCart, updateQty, cartQty = 0, onClick }: ProductCardProps) {
  const { mode } = usePriceMode();
  const { isFavorite, toggleFavorite } = useFavorites();

  const coverImage = product.images[0] ?? null;
  const videoUrl = product.videoUrl || null;
  const inStock = product.inStock ?? 99;

  const hasWholesale = product.wholesalePrice != null && product.wholesalePrice > 0;
  const retailPrice = hasWholesale
    ? Math.round(product.wholesalePrice! * (1 + (product.retailMarkupPct ?? 0) / 100))
    : product.price;

  const displayPrice = hasWholesale
    ? (mode === "wholesale" ? product.wholesalePrice! : retailPrice)
    : product.price;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart({
      id: product.id,
      name: product.name,
      price: displayPrice,
      image: coverImage ?? "",
      sellerId: product.sellerId,
      sellerName: product.sellerName,
      fromCityCode: product.fromCityCode ?? 0,
      weightG: product.weightG ?? 500,
      videoUrl: product.videoUrl,
      wholesalePrice: product.wholesalePrice,
      retailMarkupPct: product.retailMarkupPct,
    });
  };

  const handleMinus = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateQty?.(product.id, cartQty - 1);
  };

  const handlePlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart({
      id: product.id,
      name: product.name,
      price: displayPrice,
      image: coverImage ?? "",
      sellerId: product.sellerId,
      sellerName: product.sellerName,
      fromCityCode: product.fromCityCode ?? 0,
      weightG: product.weightG ?? 500,
      videoUrl: product.videoUrl,
      wholesalePrice: product.wholesalePrice,
      retailMarkupPct: product.retailMarkupPct,
    });
  };

  return (
    <div
      onClick={onClick}
      className={`bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all group ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {videoUrl ? (
          <VideoPreview src={videoUrl} poster={coverImage ?? undefined} />
        ) : coverImage ? (
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
        {/* Кнопка избранного */}
        <button
          onClick={e => { e.stopPropagation(); toggleFavorite(product); }}
          className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm transition-transform active:scale-90"
          aria-label="В избранное"
        >
          <Icon
            name="Heart"
            size={15}
            className={isFavorite(product.id) ? "text-red-500 fill-red-500" : "text-muted-foreground"}
            style={isFavorite(product.id) ? { fill: "currentColor" } : {}}
          />
        </button>

        {product.isUsed && (
          <div className="absolute top-2 left-2 z-10 bg-orange-500/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            б/у
          </div>
        )}
        {!product.isUsed && inStock > 0 && inStock <= 5 && (
          <div className="absolute top-2 left-2 bg-orange-500/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Осталось {inStock} шт.
          </div>
        )}
        {inStock === 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-black/70 text-white text-xs font-semibold px-3 py-1.5 rounded-full">Нет в наличии</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-1">{product.name}</p>
        <p className="text-xs text-muted-foreground mb-2">{product.sellerName}</p>

        <div className="flex flex-col gap-2">
          {hasWholesale ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-oswald text-base font-semibold text-foreground leading-none">{retailPrice.toLocaleString("ru")} ₽</span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">розница</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-oswald text-sm text-muted-foreground leading-none">{product.wholesalePrice!.toLocaleString("ru")} ₽</span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">опт</span>
              </div>
            </div>
          ) : (
            <span className="font-oswald text-base font-semibold text-foreground">
              {displayPrice.toLocaleString("ru")} ₽
            </span>
          )}

          {cartQty > 0 ? (
            <div className="flex items-center justify-between w-full bg-primary/10 rounded-lg overflow-hidden h-8">
              <button
                onClick={handleMinus}
                className="flex items-center justify-center w-9 h-full text-primary hover:bg-primary/20 transition-colors text-lg font-bold"
              >
                −
              </button>
              <span className="font-oswald font-semibold text-sm text-primary">{cartQty}</span>
              <button
                onClick={handlePlus}
                disabled={inStock !== 99 && cartQty >= inStock}
                className="flex items-center justify-center w-9 h-full text-primary hover:bg-primary/20 transition-colors text-lg font-bold disabled:opacity-40"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              disabled={inStock === 0}
              className="w-full flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Icon name="Plus" size={13} />
              {inStock === 0 ? "Нет в наличии" : "В корзину"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}