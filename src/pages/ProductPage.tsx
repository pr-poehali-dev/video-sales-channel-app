import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";
import type { CartItem } from "@/App";
import { usePriceMode } from "@/context/PriceModeContext";

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
  const { mode } = usePriceMode();
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

  const hasWholesale = product.wholesalePrice != null && product.wholesalePrice > 0;
  const retailPrice = hasWholesale
    ? Math.round(product.wholesalePrice! * (1 + (product.retailMarkupPct ?? 0) / 100))
    : product.price;
  const displayPrice = hasWholesale
    ? (mode === "wholesale" ? product.wholesalePrice! : retailPrice)
    : product.price;

  const handleAdd = () => {
    addToCart({
      id: product.id,
      name: product.name,
      price: displayPrice,
      image: product.images[0] ?? "",
      sellerId: product.sellerId,
      sellerName: product.sellerName,
      fromCityCode: product.fromCityCode ?? 0,
      weightG: product.weightG ?? 500,
      videoUrl: product.videoUrl,
      wholesalePrice: product.wholesalePrice,
      retailMarkupPct: product.retailMarkupPct,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    /* Мобильный: fixed full-screen; Десктоп: обычный поток с max-w */
    <div className="md:static md:inset-auto fixed inset-x-0 top-14 bottom-0 flex flex-col animate-fade-in md:max-w-2xl md:mx-auto md:pb-8" style={{ bottom: "4rem" }}>

      {/* ── ВЕРХНЯЯ ПОЛОВИНА: видео + кнопка ── */}
      <div className="flex-shrink-0 bg-background md:h-auto" style={{ height: "50%" }}>
        {/* Кнопка назад */}
        <div className="px-4 pt-2 pb-1">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="ArrowLeft" size={15} />
            Назад
          </button>
        </div>

        {/* Медиа */}
        <div className="px-4 relative md:h-auto" style={{ height: "calc(100% - 5.5rem)" }}>
          <div className="w-full h-full md:h-auto md:aspect-[4/3] md:max-h-[480px] rounded-xl overflow-hidden bg-secondary relative border border-border">
            {showVideo && videoUrl ? (
              <video src={videoUrl} autoPlay loop muted playsInline controls className="w-full h-full object-cover" />
            ) : product.images.length > 0 ? (
              <img src={product.images[activeImg]} alt={product.name} className="w-full h-full object-cover" decoding="async" fetchPriority="high" />
            ) : videoUrl ? (
              <video src={videoUrl} autoPlay loop muted playsInline controls className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon name="Package" size={60} className="text-muted-foreground opacity-30" />
              </div>
            )}

            {/* Переключатели поверх видео снизу-слева */}
            {(product.images.length > 1 || videoUrl) && (
              <div className="absolute bottom-2 left-2 flex gap-1.5">
                {product.images.map((img, i) => (
                  <button key={i} onClick={() => { setActiveImg(i); setShowVideo(false); }}
                    className={`w-10 h-10 rounded-lg overflow-hidden border-2 flex-shrink-0 ${!showVideo && activeImg === i ? "border-primary" : "border-white/60"}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" width={40} height={40} />
                  </button>
                ))}
                {videoUrl && (
                  <button onClick={() => setShowVideo(true)}
                    className={`w-10 h-10 rounded-lg border-2 flex-shrink-0 flex items-center justify-center bg-black/80 ${showVideo ? "border-primary" : "border-white/60"}`}>
                    <Icon name="Play" size={16} className="text-white" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Кнопка В корзину */}
        <div className="px-4 pt-2 pb-1">
          <button
            onClick={handleAdd}
            className={`w-full flex items-center justify-between px-5 py-3 rounded-xl font-semibold transition-all ${
              added ? "bg-green-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon name={added ? "Check" : "ShoppingCart"} size={18} />
              {added ? "Добавлено!" : "В корзину"}
            </span>
            {hasWholesale ? (
              <span className="flex flex-col items-end leading-none">
                <span className="font-oswald text-base">{product.wholesalePrice!.toLocaleString("ru")} ₽ <span className="text-[10px] opacity-70">опт</span></span>
                <span className="font-oswald text-xs opacity-70">{retailPrice.toLocaleString("ru")} ₽ розница</span>
              </span>
            ) : (
              <span className="font-oswald text-lg">{displayPrice.toLocaleString("ru")} ₽</span>
            )}
          </button>
        </div>
      </div>

      {/* ── НИЖНЯЯ ПОЛОВИНА: скролл ── */}
      <div className="flex-1 overflow-y-auto md:overflow-visible bg-background border-t border-border">
        <div className="px-4 py-3 pb-6">
          {/* Название и цена */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-block mb-1">{product.category}</span>
              <h1 className="font-oswald text-xl font-semibold text-foreground leading-tight">{product.name}</h1>
            </div>
            <div className="flex-shrink-0 text-right">
              {hasWholesale ? (
                <>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="font-oswald text-2xl font-bold text-foreground">{retailPrice.toLocaleString("ru")} ₽</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">розница</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span className="font-oswald text-base text-muted-foreground">{product.wholesalePrice!.toLocaleString("ru")} ₽</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">опт</span>
                  </div>
                </>
              ) : (
                <span className="font-oswald text-2xl font-bold text-foreground">{displayPrice.toLocaleString("ru")} ₽</span>
              )}
            </div>
          </div>

          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{product.description}</p>
          )}

          {/* Продавец */}
          <button
            onClick={() => onSellerClick(product.sellerId)}
            className="w-full flex items-center gap-3 bg-secondary rounded-xl p-3 hover:bg-secondary/70 transition-colors text-left mb-3"
          >
            <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center font-oswald flex-shrink-0">
              {product.sellerAvatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{product.sellerName}</p>
              <p className="text-xs text-muted-foreground">Посмотреть все товары продавца</p>
            </div>
            <Icon name="ChevronRight" size={16} className="text-muted-foreground flex-shrink-0" />
          </button>

          <div className="mb-4 text-xs text-muted-foreground">Добавлен: {product.createdAt}</div>

          {/* Ещё от продавца */}
          {sellerProducts.length > 0 && (
            <div>
              <h2 className="font-oswald text-base font-semibold text-foreground tracking-wide mb-3">
                Ещё от {product.sellerName}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {sellerProducts.map(p => (
                  <div key={p.id}
                    className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/40 transition-all"
                    onClick={() => onSellerClick(product.sellerId)}>
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