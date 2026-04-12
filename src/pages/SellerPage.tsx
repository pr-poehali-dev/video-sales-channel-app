import Icon from "@/components/ui/icon";
import { sellers, products } from "@/data/mockData";
import type { CartItem } from "@/App";

interface SellerPageProps {
  sellerId: number;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onBack: () => void;
  onProductClick: (productId: number) => void;
}

export default function SellerPage({ sellerId, addToCart, onBack, onProductClick }: SellerPageProps) {
  const seller = sellers.find(s => s.id === sellerId);
  const sellerProducts = products.filter(p => p.sellerId === sellerId);

  if (!seller) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <Icon name="ArrowLeft" size={16} />
        Назад
      </button>

      {/* Шапка продавца */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="font-oswald text-2xl font-bold text-primary">{seller.avatar}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">{seller.name}</h1>
              {seller.isVerified && (
                <Icon name="BadgeCheck" size={20} className="text-accent" />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
              <Icon name="MapPin" size={14} />
              {seller.city} · на платформе с {seller.joinedAt}
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed mb-4">{seller.bio}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Рейтинг", value: seller.rating, icon: "Star" },
                { label: "Отзывов", value: seller.reviews, icon: "MessageSquare" },
                { label: "Подписчиков", value: seller.subscribers.toLocaleString("ru"), icon: "Users" },
                { label: "Продаж", value: seller.sales.toLocaleString("ru"), icon: "ShoppingBag" },
              ].map(stat => (
                <div key={stat.label} className="bg-secondary rounded-xl p-3 text-center">
                  <Icon name={stat.icon} size={16} className="mx-auto mb-1 text-primary" />
                  <div className="font-oswald text-base font-semibold text-foreground">{stat.value}</div>
                  <div className="text-[11px] text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Товары продавца */}
      <div>
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-4">
          Товары продавца · {sellerProducts.length}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {sellerProducts.map((product, i) => {
            const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : null;
            return (
              <div
                key={product.id}
                onClick={() => onProductClick(product.id)}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all cursor-pointer group animate-fade-in"
                style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
              >
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {product.isNew && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded">NEW</div>
                  )}
                  {discount && (
                    <div className="absolute top-2 right-2 bg-destructive text-white text-[10px] font-bold px-2 py-0.5 rounded">-{discount}%</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground line-clamp-2 mb-2">{product.name}</p>
                  <div className="flex items-center gap-1 mb-2">
                    <Icon name="Star" size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-muted-foreground">{product.rating} ({product.reviews})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-oswald text-base font-semibold text-foreground">{product.price.toLocaleString("ru")} ₽</span>
                      {product.oldPrice && (
                        <span className="text-xs text-muted-foreground line-through ml-1">{product.oldPrice.toLocaleString("ru")} ₽</span>
                      )}
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        addToCart({ id: product.id, name: product.name, price: product.price, image: product.image });
                      }}
                      className="bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                    >
                      <Icon name="Plus" size={12} />
                      В корзину
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
