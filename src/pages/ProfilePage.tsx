import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { Page } from "@/App";
import { useAuth } from "@/context/AuthContext";
import SellerRegisterPage from "./SellerRegisterPage";

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

// ============================================================================
// !! ВНИМАНИЕ: ProfilePage — это кабинет ПОКУПАТЕЛЯ (заказы + аккаунт) !!
// Кабинет АДМИНИСТРАТОРА и ПРОДАВЦА живёт в DashboardPage.tsx — НЕ СЮДА!
// Роутинг: admin → "dashboard", продавец → "dashboard", покупатель → "profile"
// Не добавляй сюда admin-блоки — они сломаются при редактировании этого файла.
// ============================================================================
export default function ProfilePage({ setPage }: ProfilePageProps) {
  const { user, logout, updateUser } = useAuth();
  type ProfileMode = "personal" | "legal";
  const [mode, setMode] = useState<ProfileMode>("personal");

  // ── Данные аккаунта ──
  const [editing, setEditing] = useState(false);
  const [name,  setName]  = useState(user?.name  ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city,  setCity]  = useState(user?.city  ?? "");
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
    if (!user?.id || mode !== "personal") return;
    setOrdersLoading(true);
    fetch(`${STORE_API}?action=get_orders&buyer_id=${user.id}`)
      .then(r => r.json())
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [user?.id, mode]);

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

  const inputCls = "w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";

  return (
    <div className="max-w-xl mx-auto px-4 animate-fade-in pb-28">

      {/* ── Sticky переключатель режима ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pt-4 pb-3 -mx-4 px-4 border-b border-border/60 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setMode("personal")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              mode === "personal"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name="User" size={15} />
            Физ. лицо
          </button>
          <button
            onClick={() => setMode("legal")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              mode === "legal"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon name="Building2" size={15} />
            Юр. лицо
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          РЕЖИМ: ФИЗИЧЕСКОЕ ЛИЦО
      ══════════════════════════════════════════ */}
      {mode === "personal" && (
        <div className="space-y-4 animate-fade-in">

          {/* Шапка */}
          <div className="flex items-center gap-4">
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

          {/* Данные аккаунта */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="UserCog" size={15} className="text-muted-foreground" />
                Личные данные
              </p>
              <button onClick={() => { setEditing(!editing); if (!editing) { setName(user.name); setPhone(user.phone); setCity(user.city); } }}
                className="text-xs text-primary font-medium hover:opacity-80 transition-opacity">
                {editing ? "Отмена" : "Редактировать"}
              </button>
            </div>

            {editing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">Имя</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">Телефон</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (900) 000-00-00" className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">Город</label>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Москва" className={inputCls} />
                </div>
                <button onClick={handleSave}
                  className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm mt-1">
                  Сохранить
                </button>
                {saved && <p className="text-xs text-green-600 text-center flex items-center justify-center gap-1"><Icon name="CheckCircle" size={12} />Сохранено</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "Email",    value: user.email },
                  { label: "Имя",      value: user.name  || "—" },
                  { label: "Телефон",  value: user.phone || "—" },
                  { label: "Город",    value: user.city  || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-sm text-foreground font-medium">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Смена пароля */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="Lock" size={15} className="text-muted-foreground" />
                Пароль
              </p>
              <button onClick={() => setChangingPass(!changingPass)}
                className="text-xs text-primary font-medium hover:opacity-80 transition-opacity">
                {changingPass ? "Отмена" : "Изменить"}
              </button>
            </div>
            {passSaved && <p className="text-xs text-green-600 flex items-center gap-1"><Icon name="CheckCircle" size={12} />Пароль изменён</p>}
            {changingPass && (
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">Текущий пароль</label>
                  <div className="relative">
                    <input type={showOld ? "text" : "password"} value={oldPass} onChange={e => setOldPass(e.target.value)} placeholder="••••••" className={inputCls + " pr-9"} />
                    <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Icon name={showOld ? "EyeOff" : "Eye"} size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">Новый пароль</label>
                  <div className="relative">
                    <input type={showNew ? "text" : "password"} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Минимум 6 символов" className={inputCls + " pr-9"} />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Icon name={showNew ? "EyeOff" : "Eye"} size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">Повторите новый пароль</label>
                  <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} placeholder="••••••" className={inputCls} />
                </div>
                {passError && <p className="text-xs text-destructive flex items-center gap-1"><Icon name="AlertCircle" size={12} />{passError}</p>}
                <button onClick={handleChangePassword}
                  className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
                  Сохранить пароль
                </button>
              </div>
            )}
          </div>

          {/* Мои покупки */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground px-1 flex items-center gap-2">
              <Icon name="ShoppingBag" size={15} className="text-muted-foreground" />
              Мои покупки
            </p>
            {ordersLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Загружаем...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
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
                <p className="text-xs text-muted-foreground">{orders.length} заказ{orders.length === 1 ? "" : orders.length < 5 ? "а" : "ов"}</p>
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

        </div>
      )}

      {/* ── Fixed-кнопка продавца (только физ. лицо) ── */}
      {mode === "personal" && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 pointer-events-none">
          <div className="max-w-xl mx-auto pointer-events-auto">
            <button
              onClick={() => isSeller ? setPage("dashboard") : setPage("seller-register")}
              className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 shadow-lg hover:border-primary/40 transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Icon name="Store" size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">
                  {isSeller ? user.shopName : "Стать продавцом"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSeller ? "Перейти в кабинет продавца" : "Продавай новые и б/у товары в эфире"}
                </p>
              </div>
              <Icon name="ChevronRight" size={16} className="text-muted-foreground flex-shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          РЕЖИМ: ЮР. ЛИЦО / ПРОДАВЕЦ
      ══════════════════════════════════════════ */}
      {mode === "legal" && (
        <div className="animate-fade-in">
          {isSeller ? (
            <div className="mb-4">
              <button onClick={() => setPage("dashboard")}
                className="w-full flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3.5 hover:border-primary/40 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Icon name="Store" size={16} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">{user.shopName}</p>
                  <p className="text-xs text-muted-foreground">Перейти в кабинет продавца</p>
                </div>
                <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
              </button>
            </div>
          ) : null}
          <SellerRegisterPage setPage={setPage} embedded />
        </div>
      )}

    </div>
  );
}