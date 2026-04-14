import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";
import type { CartItem } from "@/App";

interface ProductPageProps {
  productId: string;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onBack: () => void;
  onSellerClick: (sellerId: string) => void;
}

export default function ProductPage({ productId, addToCart, onBack, onSellerClick }: ProductPageProps) {
  const { products, getSellerProducts } = useStore();
  const product = products.find(p => p.id === productId);
  const [activeImg, setActiveImg] = useState(0);
  const [added, setAdded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  if (!product) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <Icon name="PackageX" size={40} className="mx-auto mb-4 text-muted-foreground opacity-40" />
        <h2 className="font-oswald text-xl font-semibold text-foreground mb-2">Товар не найден</h2>
        <button onClick={onBack} className="text-primary hover:underline text-sm">Вернуться назад</button>
      </div>
    );
  }

  const videoUrl = (product as { videoUrl?: string }).videoUrl ?? null;

  const sellerProducts = getSellerProducts(product.sellerId)
    .filter(p => p.id !== product.id)
    .slice(0, 4);

  const handleAdd = () => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0] ?? "",
      fromCityCode: (product as { fromCityCode?: number }).fromCityCode ?? 0,
      weightG: (product as { weightG?: number }).weightG ?? 500,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <Icon name="ArrowLeft" size={16} />
        Назад
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Медиа */}
        <div>
          <div className="aspect-square rounded-2xl overflow-hidden border border-border mb-3 bg-secondary relative">
            {showVideo && videoUrl ? (
              <video
                src={videoUrl}
                autoPlay
                loop
                muted={false}
                playsInline
                controls
                className="w-full h-full object-cover"
              />
            ) : product.images.length > 0 ? (
              <img
                src={product.images[activeImg]}
                alt={product.name}
                className="w-full h-full object-cover"
                width={800}
                height={800}
                decoding="async"
                fetchPriority="high"
              />
            ) : videoUrl ? (
              <video
                src={videoUrl}
                autoPlay
                loop
                muted
                playsInline
                controls
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon name="Package" size={60} className="text-muted-foreground opacity-30" />
              </div>
            )}
          </div>

          {/* Переключатели: фото и видео */}
          <div className="flex gap-2 flex-wrap">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => { setActiveImg(i); setShowVideo(false); }}
                className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                  !showVideo && activeImg === i ? "border-primary" : "border-border hover:border-primary/40"
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" width={64} height={64} />
              </button>
            ))}
            {videoUrl && (
              <button
                onClick={() => setShowVideo(true)}
                className={`w-16 h-16 rounded-xl border-2 transition-all flex-shrink-0 flex items-center justify-center bg-black/80 ${
                  showVideo ? "border-primary" : "border-border hover:border-primary/40"
                }`}
              >
                <Icon name="Play" size={22} className="text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Инфо */}
        <div className="flex flex-col">
          <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full w-fit mb-3">{product.category}</span>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide leading-tight mb-4">{product.name}</h1>

          <div className="flex items-baseline gap-3 mb-6">
            <span className="font-oswald text-3xl font-bold text-foreground">{product.price.toLocaleString("ru")} ₽</span>
          </div>

          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">{product.description}</p>
          )}

          <div className="flex gap-3 mt-auto">
            <button
              onClick={handleAdd}
              className={`flex-1 flex items-center justify-center gap-2 font-semibold py-3.5 rounded-xl transition-all ${
                added
                  ? "bg-green-500 text-white"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              <Icon name={added ? "Check" : "ShoppingCart"} size={18} />
              {added ? "Добавлено в корзину!" : "В корзину"}
            </button>
          </div>

          {/* Продавец */}
          <button
            onClick={() => onSellerClick(product.sellerId)}
            className="mt-5 flex items-center gap-3 bg-secondary rounded-xl p-4 hover:bg-secondary/70 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center font-oswald flex-shrink-0">
              {product.sellerAvatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{product.sellerName}</p>
              <p className="text-xs text-muted-foreground">Посмотреть все товары продавца</p>
            </div>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground flex-shrink-0" />
          </button>

          <div className="mt-4 text-xs text-muted-foreground">Добавлен: {product.createdAt}</div>
        </div>
      </div>

      {/* Другие товары продавца */}
      {sellerProducts.length > 0 && (
        <div>
          <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide mb-4">
            Ещё от {product.sellerName}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {sellerProducts.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 transition-all"
                onClick={() => onSellerClick(product.sellerId)}>
                <div className="aspect-square bg-secondary">
                  {p.images[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="Package" size={24} className="text-muted-foreground opacity-30" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-foreground line-clamp-1">{p.name}</p>
                  <p className="font-oswald text-sm font-semibold text-foreground mt-0.5">{p.price.toLocaleString("ru")} ₽</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}