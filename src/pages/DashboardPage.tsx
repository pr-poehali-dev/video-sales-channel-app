import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";

interface DashboardPageProps {
  setPage: (p: Page) => void;
}

const TABS = ["Мои эфиры", "Товары", "Статистика"];

export default function DashboardPage({ setPage }: DashboardPageProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState("Мои эфиры");

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
          <Icon name="LayoutDashboard" size={28} className="text-muted-foreground opacity-40" />
        </div>
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Войдите в аккаунт</h2>
        <p className="text-muted-foreground text-sm mb-6">Для доступа к кабинету необходимо войти или зарегистрироваться</p>
        <button
          onClick={() => setPage("auth")}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  if (user.role !== "seller") {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
          <Icon name="Video" size={28} className="text-muted-foreground opacity-40" />
        </div>
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Кабинет продавца</h2>
        <p className="text-muted-foreground text-sm mb-6">
          У вас аккаунт покупателя. Чтобы продавать товары и вести эфиры — зарегистрируйте новый аккаунт продавца.
        </p>
        <button
          onClick={() => setPage("auth")}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          Создать аккаунт продавца
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Кабинет продавца</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user.name}{user.city ? ` · ${user.city}` : ""}
          </p>
        </div>
        <button
          onClick={() => setPage("broadcast")}
          className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
          Начать эфир
        </button>
      </div>

      {/* Статистика — пустая, т.к. данных нет */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: "Eye", value: "0", label: "Просмотров" },
          { icon: "Users", value: "0", label: "Подписчиков" },
          { icon: "ShoppingBag", value: "0", label: "Продаж" },
          { icon: "Wallet", value: "0 ₽", label: "Выручка" },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon name={stat.icon} size={16} className="text-muted-foreground" />
            </div>
            <div className="font-oswald text-xl font-semibold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Табы */}
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

      {/* Мои эфиры — пусто */}
      {tab === "Мои эфиры" && (
        <div className="animate-fade-in">
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <Icon name="Radio" size={24} className="text-muted-foreground opacity-40" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Эфиров пока нет</h3>
            <p className="text-sm text-muted-foreground mb-5">Запусти первую трансляцию прямо с телефона</p>
            <button
              onClick={() => setPage("broadcast")}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              <Icon name="Video" size={15} />
              Начать первый эфир
            </button>
          </div>
        </div>
      )}

      {/* Товары — пусто */}
      {tab === "Товары" && (
        <div className="animate-fade-in">
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <Icon name="Package" size={24} className="text-muted-foreground opacity-40" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Товаров пока нет</h3>
            <p className="text-sm text-muted-foreground mb-5">Добавь первый товар, чтобы начать продавать</p>
            <button className="inline-flex items-center gap-2 border border-primary text-primary font-semibold px-5 py-2.5 rounded-xl hover:bg-primary/5 transition-colors text-sm">
              <Icon name="Plus" size={15} />
              Добавить товар
            </button>
          </div>
        </div>
      )}

      {/* Статистика — пусто */}
      {tab === "Статистика" && (
        <div className="animate-fade-in">
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <Icon name="BarChart2" size={24} className="text-muted-foreground opacity-40" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Статистика появится после первых продаж</h3>
            <p className="text-sm text-muted-foreground">Запусти эфир и добавь товары, чтобы увидеть аналитику</p>
          </div>
        </div>
      )}
    </div>
  );
}
