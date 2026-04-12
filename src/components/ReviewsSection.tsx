import { useState } from "react";
import Icon from "@/components/ui/icon";
import { reviews } from "@/data/mockData";
import type { Review } from "@/data/mockData";

interface ReviewsSectionProps {
  productId: number;
  totalRating: number;
  totalCount: number;
}

export default function ReviewsSection({ productId, totalRating, totalCount }: ReviewsSectionProps) {
  const [localReviews, setLocalReviews] = useState<Review[]>(
    reviews.filter(r => r.productId === productId)
  );
  const [helpfulSet, setHelpfulSet] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [newText, setNewText] = useState("");
  const [newName, setNewName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: localReviews.filter(r => r.rating === star).length,
  }));

  const handleHelpful = (id: number) => {
    if (helpfulSet.has(id)) return;
    setHelpfulSet(prev => new Set([...prev, id]));
    setLocalReviews(prev => prev.map(r => r.id === id ? { ...r, helpful: r.helpful + 1 } : r));
  };

  const handleSubmit = () => {
    if (!newText.trim() || !newName.trim()) return;
    const review: Review = {
      id: Date.now(),
      productId,
      author: newName.trim(),
      avatar: newName.trim().slice(0, 2).toUpperCase(),
      rating: newRating,
      text: newText.trim(),
      date: new Date().toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }),
      helpful: 0,
    };
    setLocalReviews(prev => [review, ...prev]);
    setShowForm(false);
    setNewText("");
    setNewName("");
    setNewRating(5);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="mt-10">
      <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-6">
        Отзывы покупателей
      </h2>

      {/* Сводка рейтинга */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6 flex flex-col sm:flex-row gap-6">
        <div className="flex flex-col items-center justify-center min-w-[100px]">
          <span className="font-oswald text-5xl font-bold text-foreground">{totalRating}</span>
          <div className="flex mt-1 mb-1">
            {[1,2,3,4,5].map(s => (
              <Icon key={s} name="Star" size={14} className={s <= Math.round(totalRating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"} />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">{totalCount} отзывов</span>
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          {ratingCounts.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-3">{star}</span>
              <Icon name="Star" size={11} className="text-yellow-400 fill-yellow-400" />
              <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{ width: localReviews.length ? `${(count / localReviews.length) * 100}%` : "0%" }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center sm:items-end justify-center">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            <Icon name="PenLine" size={15} />
            Написать отзыв
          </button>
        </div>
      </div>

      {/* Форма отзыва */}
      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 animate-scale-in">
          <h3 className="font-semibold text-foreground mb-4">Ваш отзыв</h3>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Ваше имя"
            className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 mb-3"
          />
          <div className="flex items-center gap-1 mb-3">
            <span className="text-sm text-muted-foreground mr-2">Оценка:</span>
            {[1,2,3,4,5].map(s => (
              <button
                key={s}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setNewRating(s)}
              >
                <Icon
                  name="Star"
                  size={22}
                  className={s <= (hoverRating || newRating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}
                />
              </button>
            ))}
          </div>
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Поделитесь впечатлениями о товаре..."
            rows={4}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none mb-4"
          />
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={!newText.trim() || !newName.trim()}
              className="bg-primary text-primary-foreground font-semibold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Опубликовать
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {submitted && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-3 rounded-xl mb-4 animate-fade-in">
          <Icon name="CircleCheck" size={16} />
          Спасибо! Ваш отзыв опубликован.
        </div>
      )}

      {/* Список отзывов */}
      {localReviews.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Icon name="MessageSquare" size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Пока отзывов нет</p>
          <p className="text-sm mt-1">Будьте первым, кто оставит отзыв!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {localReviews.map(review => (
            <div key={review.id} className="bg-card border border-border rounded-2xl p-5 animate-fade-in">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{review.avatar}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{review.author}</div>
                    <div className="text-xs text-muted-foreground">{review.date}</div>
                  </div>
                </div>
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <Icon key={s} name="Star" size={13} className={s <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">{review.text}</p>
              <button
                onClick={() => handleHelpful(review.id)}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  helpfulSet.has(review.id) ? "text-accent font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon name="ThumbsUp" size={13} />
                Полезно ({review.helpful})
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
