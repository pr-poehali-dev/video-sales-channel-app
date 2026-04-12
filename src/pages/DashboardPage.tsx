import { useState } from "react";
import Icon from "@/components/ui/icon";
import { streams, products } from "@/data/mockData";

const TABS = ["Мои эфиры", "Товары", "Статистика"];

interface DashboardPageProps {
  setPage: (p: import("@/App").Page) => void;
}

export default function DashboardPage({ setPage: _setPage }: DashboardPageProps) {
  const [tab, setTab] = useState("Мои эфиры");
  const myStreams = streams.slice(0, 4);
  const myProducts = products.slice(0, 6);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Личный кабинет</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Управляй эфирами и товарами</p>
        </div>
        <button className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm flex items-center gap-2">
          <Icon name="Video" size={15} />
          Начать эфир
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: "Eye", value: "18 430", label: "Просмотров", change: "+12%" },
          { icon: "Users", value: "2 104", label: "Подписчиков", change: "+8%" },
          { icon: "ShoppingBag", value: "341", label: "Продаж", change: "+23%" },
          { icon: "Wallet", value: "94 200 ₽", label: "Выручка", change: "+17%" },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 animate-fade-in" style={{ opacity: 0, animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between mb-2">
              <Icon name={stat.icon} size={16} className="text-muted-foreground" />
              <span className="text-[11px] text-green-400 font-medium">{stat.change}</span>
            </div>
            <div className="font-oswald text-xl font-semibold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-secondary rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* My streams */}
      {tab === "Мои эфиры" && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">{myStreams.length} эфиров</span>
            <button className="text-sm text-primary hover:opacity-80 flex items-center gap-1 transition-opacity">
              <Icon name="Plus" size={14} />
              Запланировать
            </button>
          </div>
          {myStreams.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex gap-4 items-center hover:border-border/80 transition-colors">
              <div className="w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 relative">
                <img src={s.thumb} alt={s.title} className="w-full h-full object-cover" />
                {s.isLive && (
                  <div className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-white animate-live-pulse" />
                    LIVE
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-1">{s.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Icon name="Eye" size={11} />{s.viewers || "—"}</span>
                  <span className="flex items-center gap-1"><Icon name="ShoppingBag" size={11} />{s.products} товаров</span>
                  <span>{s.startedAt}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors">
                  <Icon name="Pencil" size={13} className="text-muted-foreground" />
                </button>
                <button className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors">
                  <Icon name="MoreHorizontal" size={13} className="text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Products */}
      {tab === "Товары" && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">{myProducts.length} товаров</span>
            <button className="text-sm text-primary hover:opacity-80 flex items-center gap-1 transition-opacity">
              <Icon name="Plus" size={14} />
              Добавить товар
            </button>
          </div>
          <div className="space-y-2">
            {myProducts.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex gap-3 items-center">
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-oswald text-sm font-semibold text-foreground">{p.price.toLocaleString("ru")} ₽</span>
                    <span className="text-xs text-muted-foreground">{p.category}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                  <Icon name="Star" size={11} />
                  {p.rating}
                </div>
                <div className="flex items-center gap-1.5">
                  <button className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors">
                    <Icon name="Pencil" size={13} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {tab === "Статистика" && (
        <div className="animate-fade-in space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <Icon name="TrendingUp" size={16} className="text-primary" />
              Продажи по категориям
            </h3>
            {[
              { name: "Украшения", value: 45, amount: "42 390 ₽" },
              { name: "Красота", value: 30, amount: "28 260 ₽" },
              { name: "Одежда", value: 15, amount: "14 130 ₽" },
              { name: "Аксессуары", value: 10, amount: "9 420 ₽" },
            ].map(cat => (
              <div key={cat.name} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground">{cat.name}</span>
                  <span className="text-muted-foreground">{cat.amount}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${cat.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Средний чек</p>
              <p className="font-oswald text-2xl font-semibold text-foreground">2 760 ₽</p>
              <p className="text-xs text-green-400 mt-1">↑ +340 ₽ за месяц</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Конверсия</p>
              <p className="font-oswald text-2xl font-semibold text-foreground">6.8%</p>
              <p className="text-xs text-green-400 mt-1">↑ +1.2% за месяц</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}