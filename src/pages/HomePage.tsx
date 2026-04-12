import Icon from "@/components/ui/icon";
import type { Page, CartItem } from "@/App";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import ProductCard from "@/components/ProductCard";

interface HomePageProps {
  setPage: (p: Page) => void;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onProductClick: (productId: string) => void;
}

export default function HomePage({ setPage, addToCart, onProductClick }: HomePageProps) {
  const { user } = useAuth();
  const { products, streams } = useStore();

  const liveStreams = streams.filter(s => s.isLive).slice(0, 3);
  const latestProducts = products.slice(0, 8);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-14 animate-fade-in">

      {/* Hero */}
      <section className="text-center py-10">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-live-pulse inline-block" />
          Живые покупки онлайн
        </div>
        <h1 className="font-oswald text-4xl md:text-5xl font-semibold text-foreground tracking-wide mb-4 leading-tight">
          Покупай у живых людей<br />
          <span className="text-primary">прямо в эфире</span>
        </h1>
        <p className="text-muted-foreground text-base max-w-xl mx-auto mb-8">
          Смотри прямые трансляции, задавай вопросы продавцам и покупай уникальные товары не выходя из дома.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setPage("streams")}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            <Icon name="Radio" size={16} />
            Смотреть эфиры
          </button>
          <button
            onClick={() => setPage("catalog")}
            className="flex items-center gap-2 border border-border text-foreground font-semibold px-6 py-3 rounded-xl hover:bg-secondary transition-colors"
          >
            <Icon name="ShoppingBag" size={16} />
            Каталог товаров
          </button>
        </div>
      </section>

      {/* Активные эфиры */}
      {liveStreams.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 bg-red-500/15 text-red-500 text-xs font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse inline-block" />
                В ЭФИРЕ
              </span>
              <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide">Сейчас идут трансляции</h2>
            </div>
            <button onClick={() => setPage("streams")} className="text-sm text-primary hover:underline">Все эфиры</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {liveStreams.map(s => (
              <div key={s.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all cursor-pointer" onClick={() => setPage("streams")}>
                <div className="relative aspect-video bg-secondary flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-primary/20 text-primary text-xl font-bold flex items-center justify-center font-oswald mx-auto mb-2">{s.sellerAvatar}</div>
                    <p className="text-xs text-muted-foreground">{s.sellerName}</p>
                  </div>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse inline-block" />LIVE
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-foreground text-sm line-clamp-1">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.sellerName}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Новые товары */}
      {latestProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide">Новые товары</h2>
            <button onClick={() => setPage("catalog")} className="text-sm text-primary hover:underline">Все товары</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {latestProducts.map((p, i) => (
              <div key={p.id} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                <ProductCard product={p} addToCart={addToCart} onClick={() => onProductClick(p.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Фичи */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: "Video", title: "Живые эфиры", desc: "Продавцы показывают товар вживую — вы видите всё честно, без фотошопа" },
            { icon: "ShoppingCart", title: "Удобная корзина", desc: "Добавляйте товары прямо из эфира и оплачивайте в один клик" },
            { icon: "ShieldCheck", title: "Безопасные покупки", desc: "Каждый пользователь верифицирован. Возврат гарантирован." },
          ].map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Icon name={f.icon} size={22} className="text-primary" />
              </div>
              <h3 className="font-oswald text-lg font-semibold text-foreground tracking-wide mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-oswald text-2xl font-semibold text-foreground mb-2 tracking-wide">
              {user ? "Готов начать эфир?" : "Хочешь продавать в эфире?"}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              {user
                ? "Перейди в кабинет, добавь товары и запусти прямую трансляцию прямо с телефона."
                : "Зарегистрируйся и начни вести собственные прямые трансляции с продажами уже сегодня."
              }
            </p>
          </div>
          <button
            onClick={() => setPage(user ? "dashboard" : "auth")}
            className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap flex items-center gap-2"
          >
            <Icon name="Zap" size={16} />
            {user ? "В кабинет" : "Начать продавать"}
          </button>
        </div>
      </section>

    </div>
  );
}
