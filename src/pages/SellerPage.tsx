import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";
import ProductCard from "@/components/ProductCard";
import type { CartItem } from "@/App";

interface SellerPageProps {
  sellerId: string;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onBack: () => void;
  onProductClick: (productId: string) => void;
}

export default function SellerPage({ sellerId, addToCart, onBack, onProductClick }: SellerPageProps) {
  const { getSellerProducts, getSellerStreams } = useStore();
  const products = getSellerProducts(sellerId);
  const streams = getSellerStreams(sellerId);

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <Icon name="ArrowLeft" size={16} />
        Назад
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
          </div>
        </div>
      </div>

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
        <div>
          <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide mb-4">
            Эфиры <span className="text-muted-foreground font-normal text-base">({pastStreams.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastStreams.map(s => (
              <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                  <Icon name="PlayCircle" size={20} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.startedAt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
