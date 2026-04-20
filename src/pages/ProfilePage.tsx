import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { Page } from "@/App";
import { useAuth } from "@/context/AuthContext";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const AUTH_API  = "https://functions.poehali.dev/f78c2cf9-b718-4a63-9473-a8f6bcff11f4";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new:       { label: "Ожидает оплаты", color: "text-yellow-500" },
  paid:      { label: "Оплачен",        color: "text-green-500"  },
  shipped:   { label: "В доставке",     color: "text-blue-500"   },
  delivered: { label: "Доставлен",      color: "text-green-600"  },
  cancelled: { label: "Отменён",        color: "text-red-400"    },
};

interface OrderItem { id: string; name: string; price: number; qty: number; image?: string; }
interface Order {
  id: string; status: string; items: OrderItem[];
  goodsTotal: number; orderTotal: number;
  deliveryCityName: string; deliveryAddress: string;
  deliveryType: string; cdekTrackNumber?: string; createdAt: string;
}

interface ProfilePageProps { setPage: (p: Page) => void; }

type Tab = "orders" | "account";

export default function ProfilePage({ setPage }: ProfilePageProps) {
  const { user, logout, updateUser } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");

  // ── Данные аккаунта ──
  const [editing, setEditing] = useState(false);
  const [name,  setName]  = useState(user?.name  ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city,  setCity]  = useState(user?.city  ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saved, setSaved] = useState(false);

  // Смена пароля
  const [changingPass, setChangingPass] = useState(false);
  const [oldPass,  setOldPass]  = useState("");
  const [newPass,  setNewPass]  = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [passError, setPassError] = useState<string | null>(null);
  const [passSaved, setPassSaved] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // ── Покупки ──
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || tab !== "orders") return;
    setOrdersLoading(true);
    fetch(`${STORE_API}?action=get_orders&buyer_id=${user.id}`)
      .then(r => r.json())
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [user?.id, tab]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
          <Icon name="User" size={28} className="text-muted-foreground opacity-40" />
        </div>
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Вы не вошли</h2>
        <p className="text-muted-foreground text-sm mb-6">Войдите или зарегистрируйтесь, чтобы видеть профиль</p>
        <button onClick={() => setPage("auth")}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
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

  const handleChangePassword = async () => {
    setPassError(null);
    if (!oldPass) { setPassError("Введите текущий пароль"); return; }
    if (newPass.length < 6) { setPassError("Новый пароль — минимум 6 символов"); return; }
    if (newPass !== newPass2) { setPassError("Пароли не совпадают"); return; }
    const res = await fetch(`${AUTH_API}?action=change_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, old_password: oldPass, new_password: newPass }),
    });
    const data = await res.json();
    if (data.error) { setPassError(data.error); return; }
    setChangingPass(false); setOldPass(""); setNewPass(""); setNewPass2("");
    setPassSaved(true);
    setTimeout(() => setPassSaved(false), 2500);
  };

  const handleLogout = () => { logout(); setPage("home"); };

  const isSeller = !!(user.shopName);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 animate-fade-in">

      {/* Шапка */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/20 text-primary text-xl font-bold flex items-center justify-center font-oswald flex-shrink-0">
          {user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-oswald text-xl font-semibold text-foreground tracking-wide truncate">{user.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Покупатель · с {user.joinedAt}</p>
        </div>
        <button onClick={handleLogout}
          className="p-2.5 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors" title="Выйти">
          <Icon name="LogOut" size={15} className="text-destructive" />
        </button>
      </div>

      {/* Кабинет продавца — переход */}
      {isSeller && (
        <button onClick={() => setPage("dashboard")}
          className="w-full flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3.5 mb-4 hover:border-primary/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Icon name="Store" size={16} className="text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-foreground">{user.shopName}</p>
            <p className="text-xs text-muted-foreground">Перейти в кабинет продавца</p>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
        </button>
      )}

      {/* Вкладки */}
      <div className="flex bg-secondary rounded-xl p-1 mb-5">
        {([["orders", "Мои покупки", "ShoppingBag"], ["account", "Мой аккаунт", "User"]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon name={icon} size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── МОИ ПОКУПКИ ── */}
      {tab === "orders" && (
        <div className="animate-fade-in">
          {ordersLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Загружаем...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                <Icon name="ShoppingBag" size={24} className="text-muted-foreground opacity-40" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Покупок пока нет</h3>
              <p className="text-sm text-muted-foreground mb-4">Здесь появятся ваши заказы</p>
              <button onClick={() => setPage("catalog")}
                className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
                Перейти в каталог
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{orders.length} заказ{orders.length === 1 ? "" : orders.length < 5 ? "а" : "ов"}</p>
              {orders.map(order => {
                const st = STATUS_LABEL[order.status] ?? { label: order.status, color: "text-muted-foreground" };
                const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "";
                const isOpen = expandedOrder === order.id;
                const preview = order.items?.[0];
                return (
                  <div key={order.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                    <button onClick={() => setExpandedOrder(isOpen ? null : order.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors text-left">
                      {preview?.image ? (
                        <img src={preview.image} alt={preview.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-secondary" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                          <Icon name="Package" size={20} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">№ {order.id.replace("order_", "").toUpperCase().slice(0, 8)}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {Number(order.orderTotal).toLocaleString("ru-RU")} ₽
                          <span className="text-xs font-normal text-muted-foreground ml-1">· {order.items?.length ?? 0} товар{(order.items?.length ?? 0) === 1 ? "" : (order.items?.length ?? 0) < 5 ? "а" : "ов"}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                          {date && <span className="text-xs text-muted-foreground">· {date}</span>}
                          {order.deliveryCityName && <span className="text-xs text-muted-foreground">· {order.deliveryCityName.split(",")[0]}</span>}
                        </div>
                      </div>
                      <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground flex-shrink-0" />
                    </button>
                    {isOpen && (
                      <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 animate-fade-in">
                        {order.items?.map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            {item.image ? <img src={item.image} alt={item.name} className="w-10 h-10 rounded-xl object-cover bg-secondary flex-shrink-0" /> : <div className="w-10 h-10 rounded-xl bg-secondary flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.qty} шт. × {Number(item.price).toLocaleString("ru-RU")} ₽</p>
                            </div>
                            <p className="text-sm font-semibold text-foreground flex-shrink-0">{(item.qty * item.price).toLocaleString("ru-RU")} ₽</p>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-border space-y-1">
                          {order.deliveryCityName && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Icon name="MapPin" size={12} />
                              <span>{order.deliveryCityName}{order.deliveryAddress ? `, ${order.deliveryAddress}` : ""}</span>
                            </div>
                          )}
                          {order.cdekTrackNumber && (
                            <div className="flex items-center gap-2 text-xs text-blue-500">
                              <Icon name="Truck" size={12} />
                              <span>Трек: {order.cdekTrackNumber}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm pt-1">
                            <span className="text-muted-foreground">Итого с доставкой</span>
                            <span className="font-semibold text-foreground">{Number(order.orderTotal).toLocaleString("ru-RU")} ₽</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── МОЙ АККАУНТ ── */}
      {tab === "account" && (
        <div className="animate-fade-in space-y-4">
          {saved && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-3 rounded-xl animate-fade-in">
              <Icon name="CircleCheck" size={15} /> Данные сохранены
            </div>
          )}
          {passSaved && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-3 rounded-xl animate-fade-in">
              <Icon name="CircleCheck" size={15} /> Пароль изменён
            </div>
          )}

          {/* Данные */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Личные данные</h3>
              <button onClick={() => { setEditing(!editing); setName(user.name); setPhone(user.phone); setCity(user.city); }}
                className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors">
                <Icon name={editing ? "X" : "Pencil"} size={14} className="text-muted-foreground" />
              </button>
            </div>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Имя и фамилия</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Телефон</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 900 000-00-00"
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Город</label>
                    <input value={city} onChange={e => setCity(e.target.value)} placeholder="Москва"
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={handleSave}
                    className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
                    Сохранить
                  </button>
                  <button onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Email", value: email || user.email, icon: "Mail" },
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
          </div>

          {/* Стать продавцом */}
          {!isSeller && (
            <button onClick={() => setPage("seller-register")}
              className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon name="Store" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">Стать продавцом</p>
                <p className="text-xs text-muted-foreground">Открой свой магазин и продавай в эфире</p>
              </div>
              <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}