import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";
import type { CartItem } from "@/App";

function VideoPreview({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const onReady = () => { v.play().catch(() => {}); setReady(true); };
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
        playsInline muted loop autoPlay preload="auto"
      />
      <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1">
        <Icon name="Video" size={11} className="text-white" />
      </div>
    </div>
  );
}

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

  const videoUrl = product.videoUrl ?? null;

  const sellerProducts = getSellerProducts(product.sellerId)
    .filter(p => p.id !== product.id)
    .slice(0, 4);

  const handleAdd = () => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0] ?? "",
      fromCityCode: product.fromCityCode ?? 0,
      weightG: product.weightG ?? 500,
      videoUrl: product.videoUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* Кнопка назад */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="ArrowLeft" size={16} />
          Назад
        </button>
      </div>

      {/* На мобиле — sticky верх (видео + кнопка), прокручивается контент */}
      <div className="flex flex-col md:grid md:grid-cols-2 md:gap-8 flex-1 overflow-hidden">

        {/* Sticky левая колонка: медиа + кнопка В корзину */}
        <div className="flex-shrink-0 md:sticky md:top-0 md:self-start md:max-h-screen md:overflow-y-auto px-4 pb-0 md:py-4">
          {/* Медиа */}
          <div className="aspect-square rounded-2xl overflow-hidden border border-border mb-3 bg-secondary relative">
            {showVideo && videoUrl ? (
              <video
                src={videoUrl}
                autoPlay loop muted playsInline controls
                className="w-full h-full object-cover"
              />
            ) : product.images.length > 0 ? (
              <img
                src={product.images[activeImg]}
                alt={product.name}
                className="w-full h-full object-cover"
                width={800} height={800}
                decoding="async"
                fetchPriority="high"
              />
            ) : videoUrl ? (
              <video
                src={videoUrl}
                autoPlay loop muted playsInline controls
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon name="Package" size={60} className="text-muted-foreground opacity-30" />
              </div>
            )}
          </div>

          {/* Переключатели фото/видео */}
          <div className="flex gap-2 flex-wrap mb-4">
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

          {/* Кнопка В корзину — sticky снизу на мобиле */}
          <div className="sticky bottom-0 bg-background pb-3 pt-2 md:static md:pb-0 md:pt-0 md:bg-transparent">
            <button
              onClick={handleAdd}
              className={`w-full flex items-center justify-center gap-2 font-semibold py-4 rounded-xl transition-all text-base ${
                added
                  ? "bg-green-500 text-white"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              <Icon name={added ? "Check" : "ShoppingCart"} size={20} />
              {added ? "Добавлено в корзину!" : "В корзину"}
            </button>
          </div>
        </div>

        {/* Прокручиваемая правая колонка: инфо + продавец + ещё от продавца */}
        <div className="overflow-y-auto px-4 py-4 md:py-4 pb-20 md:pb-6">
          <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full w-fit mb-3 inline-block">{product.category}</span>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide leading-tight mb-3">{product.name}</h1>

          <div className="flex items-baseline gap-3 mb-4">
            <span className="font-oswald text-3xl font-bold text-foreground">{product.price.toLocaleString("ru")} ₽</span>
          </div>

          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">{product.description}</p>
          )}

          {/* Продавец */}
          <button
            onClick={() => onSellerClick(product.sellerId)}
            className="w-full flex items-center gap-3 bg-secondary rounded-xl p-4 hover:bg-secondary/70 transition-colors text-left mb-4"
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

          <div className="mb-6 text-xs text-muted-foreground">Добавлен: {product.createdAt}</div>

          {/* Ещё от продавца */}
          {sellerProducts.length > 0 && (
            <div>
              <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide mb-4">
                Ещё от {product.sellerName}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {sellerProducts.map(p => (
                  <div
                    key={p.id}
                    className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 transition-all"
                    onClick={() => onSellerClick(product.sellerId)}
                  >
                    <div className="relative aspect-square bg-secondary overflow-hidden">
                      {p.videoUrl ? (
                        <VideoPreview src={p.videoUrl} poster={p.images[0]} />
                      ) : p.images[0] ? (
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
      </div>
    </div>
  );
}
