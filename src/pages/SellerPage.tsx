import { useState, useEffect, lazy, Suspense } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type SellerReview, type StoreStream } from "@/context/StoreContext";
import ProductCard from "@/components/ProductCard";
import type { CartItem, Page } from "@/App";

const StreamWatchPage = lazy(() => import("@/pages/StreamWatchPage"));

interface SellerPageProps {
  sellerId: string;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  updateQty?: (id: string, qty: number) => void;
  cart?: CartItem[];
  onBack: () => void;
  onProductClick: (productId: string) => void;
  setPage?: (p: Page) => void;
}

function Stars({ value, max = 5, size = 14, interactive = false, onChange }: {
  value: number; max?: number; size?: number; interactive?: boolean; onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = interactive ? (hovered || value) > i : value > i;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`${filled ? "text-yellow-400" : "text-muted-foreground/40"} ${interactive ? "cursor-pointer" : ""}`}
            onMouseEnter={() => interactive && setHovered(i + 1)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => interactive && onChange?.(i + 1)}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      })}
    </div>
  );
}

export default function SellerPage({ sellerId, addToCart, updateQty, cart = [], onBack, onProductClick, setPage }: SellerPageProps) {
  const { user } = useAuth();
  const { getSellerProducts, getSellerStreams, getSellerReviews, addSellerReview } = useStore();
  const products = getSellerProducts(sellerId).filter(p => !p.moderationStatus || p.moderationStatus === "approved");
  const streams = getSellerStreams(sellerId);

  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [watchingStream, setWatchingStream] = useState<StoreStream | null>(null);

  useEffect(() => {
    getSellerReviews(sellerId).then(d => {
      setReviews(d.reviews); setAvg(d.avg); setCount(d.count);
      if (user) setAlreadyReviewed(d.reviews.some(r => r.userId === user.id));
    });
  }, [sellerId, user]);

  const submit = async () => {
    if (!user || rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      const r = await addSellerReview({ sellerId, userId: user.id, userName: user.name, userAvatar: user.avatar, rating, text });
      setReviews(prev => [r, ...prev]);
      setAvg(prev => parseFloat(((prev * count + rating) / (count + 1)).toFixed(1)));
      setCount(c => c + 1);
      setAlreadyReviewed(true);
      setShowReviewForm(false);
      setRating(0); setText("");
    } catch { /* уже оставил */ }
    finally { setSubmitting(false); }
  };

  const seller = products[0] ?? streams[0];

  if (!seller) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <Icon name="User" size={40} className="mx-auto mb-4 text-muted-foreground opacity-40" />
        <h2 className="font-oswald text-xl font-semibold text-foreground mb-2">Продавец не найден</h2>
        <button onClick={onBack} className="text-primary hover:underline text-sm">Вернуться назад</button>
      </div>
    );
  }

  const sellerName = seller.sellerName;
  const sellerAvatar = seller.sellerAvatar;
  const pastStreams = streams.filter(s => !s.isLive);

  if (watchingStream) {
    return (
      <Suspense fallback={null}>
        <StreamWatchPage
          stream={watchingStream}
          setPage={(p) => { setWatchingStream(null); setPage?.(p); }}
          addToCart={addToCart}
          onProductClick={onProductClick}
        />
      </Suspense>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <Icon name="ArrowLeft" size={16} />Назад
      </button>

      {/* Шапка продавца */}
      <div className="flex items-center gap-5 mb-8 bg-card border border-border rounded-2xl p-5">
        <div className="w-16 h-16 rounded-full bg-primary/20 text-primary text-2xl font-bold flex items-center justify-center font-oswald flex-shrink-0">
          {sellerAvatar}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-oswald text-xl font-semibold text-foreground tracking-wide">{sellerName}</h1>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Icon name="Package" size={12} />
              {products.length} товар{products.length === 1 ? "" : products.length < 5 ? "а" : "ов"}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="Radio" size={12} />
              {streams.length} эфир{streams.length === 1 ? "" : streams.length < 5 ? "а" : "ов"}
            </span>
            {count > 0 && (
              <span className="flex items-center gap-1.5">
                <Stars value={avg} size={12} />
                <span>{avg} ({count} отзыв{count === 1 ? "" : count < 5 ? "а" : "ов"})</span>
              </span>
            )}
          </div>
        </div>
        {user && !alreadyReviewed && (
          <button onClick={() => setShowReviewForm(v => !v)}
            className="flex-shrink-0 flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-2 rounded-xl hover:bg-secondary transition-colors">
            <Icon name="Star" size={14} />Оценить
          </button>
        )}
      </div>

      {/* Форма отзыва на продавца */}
      {showReviewForm && user && !alreadyReviewed && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-8">
          <h3 className="font-semibold mb-3">Ваш отзыв о продавце</h3>
          <div className="flex items-center gap-3 mb-3">
            <Stars value={rating} interactive onChange={setRating} size={24} />
            {rating > 0 && <span className="text-sm text-muted-foreground">{["", "Плохо", "Не очень", "Нормально", "Хорошо", "Отлично"][rating]}</span>}
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={500}
            placeholder="Расскажите о своём опыте с продавцом..." rows={3}
            className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2.5 outline-none focus:border-primary/50 resize-none"
          />
          <div className="flex gap-2 mt-3">
            <button onClick={submit} disabled={rating === 0 || submitting}
              className="bg-primary text-primary-foreground font-semibold text-sm px-5 py-2 rounded-xl disabled:opacity-40">
              {submitting ? "Отправляем..." : "Отправить"}
            </button>
            <button onClick={() => setShowReviewForm(false)}
              className="border border-border text-sm font-semibold px-5 py-2 rounded-xl hover:bg-secondary">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Товары */}
      {products.length > 0 ? (
        <div className="mb-10">
          <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide mb-4">
            Товары <span className="text-muted-foreground font-normal text-base">({products.length})</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                addToCart={addToCart}
                updateQty={updateQty}
                cartQty={cart.find(c => c.id === p.id)?.qty ?? 0}
                onClick={() => onProductClick(p.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-card border border-border rounded-2xl mb-8">
          <Icon name="Package" size={32} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">У этого продавца пока нет товаров</p>
        </div>
      )}

      {/* Прошедшие эфиры */}
      {pastStreams.length > 0 && (
        <div className="mb-10">
          <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide mb-4">
            Эфиры <span className="text-muted-foreground font-normal text-base">({pastStreams.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastStreams.map(s => (
              <button
                key={s.id}
                onClick={() => setWatchingStream(s)}
                className="bg-card border border-border rounded-xl overflow-hidden flex items-center gap-3 hover:border-primary/40 transition-all text-left group w-full"
              >
                <div className="w-20 h-14 flex-shrink-0 bg-secondary relative overflow-hidden">
                  {s.thumbnail ? (
                    <img src={s.thumbnail} alt={s.title} className="w-full h-full object-cover" />
                  ) : s.videoUrl ? (
                    <video src={s.videoUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="PlayCircle" size={22} className="text-muted-foreground opacity-50" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center">
                      <Icon name="Play" size={13} className="text-foreground ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0 py-3 pr-3">
                  <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.startedAt}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Отзывы на продавца */}
      <div>
        <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide mb-4">
          Отзывы о продавце
          {count > 0 && (
            <span className="text-muted-foreground font-normal text-base ml-2">({count})</span>
          )}
        </h2>

        {reviews.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <Icon name="Star" size={32} className="mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Отзывов пока нет. Будьте первым!</p>
            {user && !alreadyReviewed && (
              <button onClick={() => setShowReviewForm(true)}
                className="mt-4 inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-semibold text-sm px-5 py-2.5 rounded-xl">
                <Icon name="Star" size={14} />Оставить отзыв
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="bg-card border border-border rounded-2xl px-5 py-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {r.userAvatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{r.userName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Stars value={r.rating} size={13} />
                      <span className="text-xs text-muted-foreground">{r.createdAt}</span>
                    </div>
                  </div>
                </div>
                {r.text && <p className="text-sm text-muted-foreground leading-relaxed">{r.text}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}