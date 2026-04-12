import { useState } from "react";
import Icon from "@/components/ui/icon";
import { products, sellers } from "@/data/mockData";
import type { CartItem } from "@/App";
import ReviewsSection from "@/components/ReviewsSection";

interface ProductPageProps {
  productId: number;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onBack: () => void;
  onSellerClick: (sellerId: number) => void;
}

export default function ProductPage({ productId, addToCart, onBack, onSellerClick }: ProductPageProps) {
  const product = products.find(p => p.id === productId);
  const [activeImg, setActiveImg] = useState(0);
  const [added, setAdded] = useState(false);
  const [fav, setFav] = useState(product?.isFav ?? false);

  if (!product) return null;

  const seller = sellers.find(s => s.id === product.sellerId);
  const sellerProducts = products.filter(p => p.sellerId === product.sellerId && p.id !== product.id).slice(0, 4);
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : null;

  const handleAdd = () => {
    addToCart({ id: product.id, name: product.name, price: product.price, image: product.image });
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
        Назад в каталог
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Фото */}
        <div>
          <div className="aspect-square rounded-2xl overflow-hidden border border-border mb-3 bg-secondary">
            <img
              src={product.images[activeImg]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                    activeImg === i ? "border-primary" : "border-border hover:border-primary/40"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Инфо */}
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex gap-2 flex-wrap">
              {product.isNew && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded">NEW</span>
              )}
              {discount && (
                <span className="bg-destructive text-white text-[10px] font-bold px-2 py-0.5 rounded">-{discount}%</span>
              )}
              <span className="bg-secondary text-secondary-foreground text-[10px] font-medium px-2 py-0.5 rounded">
                {product.category}
              </span>
            </div>
            <button onClick={() => setFav(!fav)} className="p-2 rounded-full hover:bg-secondary transition-colors">
              <Icon name="Heart" size={20} className={fav ? "text-red-500 fill-red-500" : "text-muted-foreground"} />
            </button>
          </div>

          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide mb-3">{product.name}</h1>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex">
              {[1,2,3,4,5].map(s => (
                <Icon key={s} name="Star" size={14} className={s <= Math.round(product.rating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"} />
              ))}
            </div>
            <span className="text-sm font-medium text-foreground">{product.rating}</span>
            <span className="text-sm text-muted-foreground">({product.reviews} отзывов)</span>
          </div>

          <div className="mb-4">
            <span className="font-oswald text-3xl font-semibold text-foreground">
              {product.price.toLocaleString("ru")} ₽
            </span>
            {product.oldPrice && (
              <span className="text-base text-muted-foreground line-through ml-3">
                {product.oldPrice.toLocaleString("ru")} ₽
              </span>
            )}
          </div>

          <p className="text-sm text-foreground/80 leading-relaxed mb-5">{product.description}</p>

          <div className={`flex items-center gap-2 mb-5 text-sm font-medium ${product.inStock > 5 ? "text-green-600" : product.inStock > 0 ? "text-orange-500" : "text-destructive"}`}>
            <Icon name={product.inStock > 0 ? "CircleCheck" : "CircleX"} size={16} />
            {product.inStock > 5 ? "В наличии" : product.inStock > 0 ? `Осталось ${product.inStock} шт.` : "Нет в наличии"}
          </div>

          <button
            onClick={handleAdd}
            disabled={product.inStock === 0}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all mb-3 ${
              added
                ? "bg-green-500 text-white"
                : "bg-primary text-primary-foreground hover:opacity-90"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Icon name={added ? "Check" : "ShoppingCart"} size={16} />
            {added ? "Добавлено в корзину!" : "Добавить в корзину"}
          </button>
        </div>
      </div>

      {/* Продавец */}
      {seller && (
        <div className="bg-card border border-border rounded-2xl p-5 mb-8">
          <h2 className="font-oswald text-lg font-semibold text-foreground mb-4 tracking-wide">Продавец</h2>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="font-oswald text-lg font-bold text-primary">{seller.avatar}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-foreground">{seller.name}</span>
                {seller.isVerified && (
                  <Icon name="BadgeCheck" size={16} className="text-accent" />
                )}
              </div>
              <div className="text-sm text-muted-foreground mb-1">{seller.city}</div>
              <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
                <span className="flex items-center gap-1"><Icon name="Star" size={13} className="text-yellow-400 fill-yellow-400" />{seller.rating}</span>
                <span className="text-muted-foreground">{seller.reviews} отзывов</span>
                <span className="text-muted-foreground">{seller.subscribers.toLocaleString("ru")} подписчиков</span>
              </div>
              <p className="text-sm text-foreground/75 line-clamp-2">{seller.bio}</p>
            </div>
            <button
              onClick={() => onSellerClick(seller.id)}
              className="flex-shrink-0 flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              Профиль <Icon name="ChevronRight" size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Отзывы */}
      <ReviewsSection productId={product.id} totalRating={product.rating} totalCount={product.reviews} />

      {/* Другие товары продавца */}
      {sellerProducts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide">Другие товары продавца</h2>
            {seller && (
              <button onClick={() => onSellerClick(seller.id)} className="text-sm text-accent hover:underline flex items-center gap-1">
                Все товары <Icon name="ChevronRight" size={14} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {sellerProducts.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all">
                <div className="aspect-square overflow-hidden">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-foreground line-clamp-2 mb-1">{p.name}</p>
                  <span className="font-oswald text-sm font-semibold text-foreground">{p.price.toLocaleString("ru")} ₽</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}