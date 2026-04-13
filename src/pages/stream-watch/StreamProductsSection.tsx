import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type Review, type StoreProduct } from "@/context/StoreContext";
import type { CartItem } from "@/App";

// ── Stars ─────────────────────────────────────────────────────────────────────
export function Stars({ value, max = 5, size = 14, interactive = false, onChange }: {
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

// ── ProductReviewsBlock ───────────────────────────────────────────────────────
function ProductReviewsBlock({ product, addToCart, onClose }: {
  product: StoreProduct;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { getProductReviews, addReview } = useStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    getProductReviews(product.id).then(d => {
      setReviews(d.reviews); setAvg(d.avg); setCount(d.count);
      if (user) setAlreadyReviewed(d.reviews.some(r => r.userId === user.id));
    });
  }, [product.id]);

  const submit = async () => {
    if (!user || rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      const r = await addReview({ productId: product.id, userId: user.id, userName: user.name, userAvatar: user.avatar, rating, text });
      setReviews(prev => [r, ...prev]);
      setAvg(prev => parseFloat(((prev * count + rating) / (count + 1)).toFixed(1)));
      setCount(c => c + 1);
      setAlreadyReviewed(true);
      setRating(0); setText("");
    } catch { /* уже написал */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="bg-background border border-border rounded-2xl overflow-hidden">
      {/* Шапка товара */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        {product.images[0]
          ? <img src={product.images[0]} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
          : <div className="w-14 h-14 rounded-xl bg-secondary flex-shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{product.name}</p>
          <p className="text-primary font-bold text-sm">{product.price.toLocaleString("ru-RU")} ₽</p>
          {count > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Stars value={avg} size={12} />
              <span className="text-xs text-muted-foreground">{avg} ({count})</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button onClick={() => addToCart({ id: product.id, name: product.name, price: product.price, image: product.images[0] ?? "" })}
            className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg">
            В корзину
          </button>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground text-center">Закрыть</button>
        </div>
      </div>

      {/* Форма отзыва */}
      {user && !alreadyReviewed && (
        <div className="p-4 border-b border-border bg-secondary/30">
          <p className="text-sm font-semibold mb-2">Оставить отзыв</p>
          <div className="flex items-center gap-2 mb-2">
            <Stars value={rating} interactive onChange={setRating} />
            {rating > 0 && <span className="text-xs text-muted-foreground">{["", "Плохо", "Не очень", "Нормально", "Хорошо", "Отлично"][rating]}</span>}
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={500}
            placeholder="Расскажите о товаре..." rows={2}
            className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/50 resize-none"
          />
          <button onClick={submit} disabled={rating === 0 || submitting}
            className="mt-2 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40">
            {submitting ? "Отправляем..." : "Отправить"}
          </button>
        </div>
      )}

      {/* Список отзывов */}
      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {reviews.length === 0
          ? <p className="text-center text-muted-foreground text-xs py-8">Отзывов пока нет</p>
          : reviews.map(r => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">{r.userAvatar}</div>
                <span className="text-xs font-semibold">{r.userName}</span>
                <Stars value={r.rating} size={11} />
                <span className="text-[10px] text-muted-foreground ml-auto">{r.createdAt}</span>
              </div>
              {r.text && <p className="text-xs text-muted-foreground leading-relaxed">{r.text}</p>}
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── StreamProductsSection ─────────────────────────────────────────────────────
interface Props {
  products: StoreProduct[];
  addToCart: (item: Omit<CartItem, "qty">) => void;
  addedId: string | null;
  setAddedId: (id: string | null) => void;
  reviewProduct: StoreProduct | null;
  setReviewProduct: (p: StoreProduct | null) => void;
}

export default function StreamProductsSection({
  products, addToCart, addedId, setAddedId, reviewProduct, setReviewProduct,
}: Props) {
  if (products.length === 0) return null;

  return (
    <>
      {/* Товары под видео */}
      <div className="bg-background px-4 py-6">
        <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
          <Icon name="ShoppingBag" size={16} className="text-primary" />
          Товары продавца
          <span className="text-xs text-muted-foreground font-normal">({products.length})</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map(p => (
            <div key={p.id}
              className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => setReviewProduct(p)}
            >
              <div className="aspect-square bg-secondary overflow-hidden">
                {p.images[0]
                  ? <img src={p.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <div className="w-full h-full flex items-center justify-center"><Icon name="Package" size={24} className="text-muted-foreground opacity-30" /></div>
                }
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-primary font-bold text-sm mt-0.5">{p.price.toLocaleString("ru-RU")} ₽</p>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    addToCart({ id: p.id, name: p.name, price: p.price, image: p.images[0] ?? "" });
                    setAddedId(p.id);
                    setTimeout(() => setAddedId(null), 1500);
                  }}
                  className={`mt-2 w-full py-1.5 rounded-xl text-xs font-bold transition-colors ${addedId === p.id ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"}`}>
                  {addedId === p.id ? "✓ Добавлено" : "В корзину"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Попап отзывов на товар */}
      {reviewProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0"
          onClick={() => setReviewProduct(null)}>
          <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <ProductReviewsBlock product={reviewProduct} addToCart={addToCart} onClose={() => setReviewProduct(null)} />
          </div>
        </div>
      )}
    </>
  );
}
