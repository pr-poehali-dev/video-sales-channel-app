import Icon from "@/components/ui/icon";
import type { Page, CartItem } from "@/App";
import { streams, products } from "@/data/mockData";
import StreamCard from "@/components/StreamCard";
import ProductCard from "@/components/ProductCard";

interface HomePageProps {
  setPage: (p: Page) => void;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onProductClick: (productId: number) => void;
}

export default function HomePage({ setPage, addToCart, onProductClick }: HomePageProps) {
  const liveStreams = streams.filter(s => s.isLive);
  const featuredProducts = products.slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Hero */}
      <section className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 bg-red-500/15 text-red-400 text-xs font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse inline-block" />
                В ЭФИРЕ
              </span>
              <span className="text-muted-foreground text-sm">{liveStreams.length} активных трансляции</span>
            </div>
            <h1 className="font-oswald text-3xl md:text-4xl font-semibold text-foreground tracking-wide">
              Живые покупки <span className="text-primary">прямо сейчас</span>
            </h1>
          </div>
          <button
            onClick={() => setPage("streams")}
            className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Все эфиры <Icon name="ChevronRight" size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {liveStreams.map((stream, i) => (
            <div key={stream.id} className={`animate-fade-in delay-${(i + 1) * 100}`} style={{ opacity: 0 }}>
              <StreamCard stream={stream} />
            </div>
          ))}
        </div>
      </section>

      {/* Stats bar */}
      <section className="animate-fade-in delay-300" style={{ opacity: 0 }}>
        <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
          {[
            { icon: "Users", value: "12 400+", label: "Покупателей" },
            { icon: "Video", value: "340+", label: "Эфиров в месяц" },
            { icon: "Package", value: "8 500+", label: "Товаров" },
          ].map((stat, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 text-center">
              <Icon name={stat.icon} size={20} className="mx-auto mb-2 text-primary" />
              <div className="font-oswald text-xl font-semibold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Recommended products */}
      <section className="animate-fade-in delay-400" style={{ opacity: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">
            Рекомендуемые товары
          </h2>
          <button
            onClick={() => setPage("catalog")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Весь каталог <Icon name="ChevronRight" size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {featuredProducts.map((product, i) => (
            <div key={product.id} className={`animate-fade-in delay-${(i + 1) * 100}`} style={{ opacity: 0 }}>
              <ProductCard product={product} addToCart={addToCart} onClick={() => onProductClick(product.id)} />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="animate-fade-in delay-500" style={{ opacity: 0 }}>
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-oswald text-2xl font-semibold text-foreground mb-2 tracking-wide">
              Хочешь продавать в эфире?
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Зарегистрируйся как участник и начни вести собственные прямые трансляции с продажами уже сегодня.
            </p>
          </div>
          <button
            onClick={() => setPage("dashboard")}
            className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap flex items-center gap-2"
          >
            <Icon name="Zap" size={16} />
            Начать продавать
          </button>
        </div>
      </section>
    </div>
  );
}