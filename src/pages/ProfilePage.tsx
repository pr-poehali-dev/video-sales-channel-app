import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { Page } from "@/App";
import { streams, products } from "@/data/mockData";

interface ProfilePageProps {
  setPage: (p: Page) => void;
}

const TABS = ["Профиль", "Покупки", "Избранное", "История эфиров"];

export default function ProfilePage({ setPage }: ProfilePageProps) {
  const [tab, setTab] = useState("Профиль");
  const [name, setName] = useState("Екатерина Смирнова");
  const [email, setEmail] = useState("kate@example.com");
  const [phone, setPhone] = useState("+7 912 345-67-89");

  const favProducts = products.filter(p => p.isFav);
  const watchedStreams = streams.filter(s => !s.isLive);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-primary/20 text-primary text-2xl font-bold flex items-center justify-center font-oswald">
          ЕС
        </div>
        <div>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">{name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Покупатель · с апреля 2024</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
              12 заказов
            </span>
            <span className="text-xs text-yellow-400 flex items-center gap-1">
              <Icon name="Star" size={11} />
              4.8 рейтинг
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-secondary rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Profile edit */}
      {tab === "Профиль" && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="font-medium text-foreground">Личные данные</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Имя</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Телефон</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <button className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
              Сохранить изменения
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-medium text-foreground mb-3">Адрес доставки</h3>
            <p className="text-sm text-muted-foreground">Москва, ул. Арбат, д. 12, кв. 45</p>
            <button className="text-sm text-primary hover:opacity-80 transition-opacity mt-2 flex items-center gap-1">
              <Icon name="Plus" size={13} />
              Добавить адрес
            </button>
          </div>
        </div>
      )}

      {/* Orders */}
      {tab === "Покупки" && (
        <div className="space-y-3 animate-fade-in">
          {[
            { id: "#LS-2401", date: "10 апр 2026", items: 3, total: 8650, status: "Доставлен" },
            { id: "#LS-2389", date: "2 апр 2026", items: 1, total: 3200, status: "В пути" },
            { id: "#LS-2312", date: "18 мар 2026", items: 2, total: 5400, status: "Доставлен" },
          ].map(order => (
            <div key={order.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-foreground text-sm">{order.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  order.status === "Доставлен" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
                }`}>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{order.date} · {order.items} товара</span>
                <span className="font-oswald text-foreground">{order.total.toLocaleString("ru")} ₽</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Favorites */}
      {tab === "Избранное" && (
        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          {favProducts.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              <Icon name="Heart" size={36} className="mx-auto mb-3 opacity-30" />
              <p>Нет избранных товаров</p>
            </div>
          ) : (
            favProducts.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-xl p-3">
                <div className="aspect-square rounded-lg overflow-hidden mb-2">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <p className="text-xs font-medium text-foreground line-clamp-2">{p.name}</p>
                <p className="font-oswald text-sm font-semibold text-foreground mt-1">{p.price.toLocaleString("ru")} ₽</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Watch history */}
      {tab === "История эфиров" && (
        <div className="space-y-3 animate-fade-in">
          {watchedStreams.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-xl p-3 flex gap-3">
              <div className="w-20 h-12 rounded overflow-hidden flex-shrink-0">
                <img src={s.thumb} alt={s.title} className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground line-clamp-1">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.host} · {s.startedAt}</p>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icon key={i} name="Star" size={10} className={i < Math.floor(s.rating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
