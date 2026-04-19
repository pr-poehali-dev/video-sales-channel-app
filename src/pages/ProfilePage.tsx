import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { Page } from "@/App";
import { useAuth } from "@/context/AuthContext";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new:       { label: "Ожидает оплаты", color: "text-yellow-500" },
  paid:      { label: "Оплачен",         color: "text-green-500" },
  shipped:   { label: "В доставке",      color: "text-blue-500"  },
  delivered: { label: "Доставлен",       color: "text-green-600" },
  cancelled: { label: "Отменён",         color: "text-red-400"   },
};

interface OrderItem {
  id: string; name: string; price: number; qty: number; image?: string;
}
interface Order {
  id: string;
  status: string;
  items: OrderItem[];
  goodsTotal: number;
  orderTotal: number;
  deliveryCityName: string;
  createdAt: string;
}

interface ProfilePageProps {
  setPage: (p: Page) => void;
}

export default function ProfilePage({ setPage }: ProfilePageProps) {
  const { user, logout, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [saved, setSaved] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setOrdersLoading(true);
    fetch(`${STORE_API}?action=get_orders&buyer_id=${user.id}`)
      .then(r => r.json())
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [user?.id]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
          <Icon name="User" size={28} className="text-muted-foreground opacity-40" />
        </div>
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Вы не вошли</h2>
        <p className="text-muted-foreground text-sm mb-6">Войдите или зарегистрируйтесь, чтобы видеть профиль</p>
        <button
          onClick={() => setPage("auth")}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  const handleSave = async () => {
    await updateUser({ name: name.trim(), phone: phone.trim(), city: city.trim() });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogout = () => {
    logout();
    setPage("home");
  };

  const roleLabel = user.role === "admin" ? "Администратор" : "Пользователь";
  const roleColor = user.role === "admin" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      {/* Шапка */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/20 text-primary text-2xl font-bold flex items-center justify-center font-oswald flex-shrink-0">
          {user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide truncate">{user.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-sm font-medium ${roleColor}`}>{roleLabel}</span>
            {user.city && <span className="text-sm text-muted-foreground">· {user.city}</span>}
            <span className="text-xs text-muted-foreground">· с {user.joinedAt}</span>
          </div>
        </div>
        <button
          onClick={() => { setEditing(!editing); setName(user.name); setPhone(user.phone); setCity(user.city); }}
          className="p-2 rounded-xl border border-border hover:bg-secondary transition-colors"
        >
          <Icon name={editing ? "X" : "Pencil"} size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Уведомление о сохранении */}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-3 rounded-xl mb-5 animate-fade-in">
          <Icon name="CircleCheck" size={15} />
          Данные сохранены
        </div>
      )}

      {/* Форма редактирования */}
      {editing ? (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5 space-y-4 animate-fade-in">
          <h3 className="font-semibold text-foreground">Редактировать профиль</h3>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Имя и фамилия</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Телефон</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+7 900 000-00-00"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Город</label>
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Москва"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Сохранить
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5 space-y-3">
          <h3 className="font-semibold text-foreground mb-4">Данные аккаунта</h3>
          {[
            { label: "Email", value: user.email, icon: "Mail" },
            { label: "Телефон", value: user.phone || "Не указан", icon: "Phone" },
            { label: "Город", value: user.city || "Не указан", icon: "MapPin" },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <Icon name={row.icon} size={14} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="text-sm text-foreground">{row.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Быстрый доступ в кабинет — для всех пользователей */}
      {user.role !== "admin" && (
        <button
          onClick={() => setPage("dashboard")}
          className="w-full flex items-center justify-between bg-card border border-border rounded-2xl p-4 mb-3 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="LayoutDashboard" size={16} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Мой кабинет</p>
              <p className="text-xs text-muted-foreground">Товары, эфиры, статистика</p>
            </div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
        </button>
      )}

      {/* Для admin — быстрый доступ */}
      {user.role === "admin" && (
        <button
          onClick={() => setPage("admin")}
          className="w-full flex items-center justify-between bg-card border border-destructive/30 rounded-2xl p-4 mb-3 hover:border-destructive/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Icon name="ShieldCheck" size={16} className="text-destructive" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Панель администратора</p>
              <p className="text-xs text-muted-foreground">Пользователи, модерация</p>
            </div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
        </button>
      )}

      {/* Покупки */}
      <div className="mb-5">
        <h3 className="font-oswald text-lg font-semibold text-foreground mb-3 tracking-wide">Покупки</h3>

        {ordersLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            Загружаем...
          </div>
        )}

        {!ordersLoading && orders.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <Icon name="ShoppingBag" size={32} className="mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Покупок пока нет</p>
          </div>
        )}

        {!ordersLoading && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map(order => {
              const st = STATUS_LABEL[order.status] ?? { label: order.status, color: "text-muted-foreground" };
              const date = order.createdAt || "";
              const isOpen = expandedOrder === order.id;
              const preview = order.items?.[0];

              return (
                <div key={order.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpandedOrder(isOpen ? null : order.id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors text-left"
                  >
                    {preview?.image ? (
                      <img src={preview.image} alt={preview.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-secondary" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                        <Icon name="Package" size={20} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">№ {order.id.replace("order_", "")}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {Number(order.orderTotal).toLocaleString("ru-RU")} ₽
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                        {date && <span className="text-xs text-muted-foreground">· {date}</span>}
                        {order.deliveryCityName && (
                          <span className="text-xs text-muted-foreground">· {order.deliveryCityName}</span>
                        )}
                      </div>
                    </div>
                    <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground flex-shrink-0" />
                  </button>

                  {isOpen && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-2 animate-fade-in">
                      {order.items?.map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-9 h-9 rounded-lg object-cover bg-secondary flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-secondary flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.qty} шт. × {Number(item.price).toLocaleString("ru-RU")} ₽</p>
                          </div>
                          <p className="text-sm font-semibold text-foreground flex-shrink-0">
                            {(item.qty * item.price).toLocaleString("ru-RU")} ₽
                          </p>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-border flex justify-between text-sm">
                        <span className="text-muted-foreground">Итого с доставкой</span>
                        <span className="font-semibold text-foreground">{Number(order.orderTotal).toLocaleString("ru-RU")} ₽</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Выход */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 text-destructive border border-destructive/20 rounded-2xl p-4 hover:bg-destructive/5 transition-colors mt-2"
      >
        <Icon name="LogOut" size={16} />
        <span className="text-sm font-medium">Выйти из аккаунта</span>
      </button>
    </div>
  );
}