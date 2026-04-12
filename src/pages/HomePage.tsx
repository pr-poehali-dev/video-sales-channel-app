import Icon from "@/components/ui/icon";
import type { Page, CartItem } from "@/App";
import { useAuth } from "@/context/AuthContext";

interface HomePageProps {
  setPage: (p: Page) => void;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onProductClick: (productId: number) => void;
}

export default function HomePage({ setPage }: HomePageProps) {
  const { user } = useAuth();

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

      {/* Фичи */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: "Video", title: "Живые эфиры", desc: "Продавцы показывают товар вживую — вы видите всё честно, без фотошопа" },
            { icon: "MessageSquare", title: "Общение в чате", desc: "Задавайте вопросы прямо во время трансляции и получайте ответы сразу" },
            { icon: "ShieldCheck", title: "Безопасные покупки", desc: "Проверенные продавцы и защита покупателей на каждом этапе" },
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

      {/* CTA для продавца */}
      <section>
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-oswald text-2xl font-semibold text-foreground mb-2 tracking-wide">
              {user?.role === "seller" ? "Готов начать эфир?" : "Хочешь продавать в эфире?"}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              {user?.role === "seller"
                ? "Перейди в кабинет, добавь товары и запусти прямую трансляцию прямо с телефона."
                : "Зарегистрируйся как продавец и начни вести собственные прямые трансляции с продажами уже сегодня."
              }
            </p>
          </div>
          <button
            onClick={() => setPage(user?.role === "seller" ? "dashboard" : "auth")}
            className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap flex items-center gap-2"
          >
            <Icon name="Zap" size={16} />
            {user?.role === "seller" ? "В кабинет" : "Начать продавать"}
          </button>
        </div>
      </section>

    </div>
  );
}
