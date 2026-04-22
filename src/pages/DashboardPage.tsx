import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { Page } from "@/App";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new:       { label: "Ожидает оплаты", color: "text-yellow-500" },
  paid:      { label: "Оплачен",         color: "text-green-500" },
  shipped:   { label: "В доставке",      color: "text-blue-500"  },
  delivered: { label: "Доставлен",       color: "text-green-600" },
  cancelled: { label: "Отменён",         color: "text-red-400"   },
};
void STATUS_LABEL;
import DashboardProductsTab from "./dashboard/DashboardProductsTab";
import DashboardStreamsTab from "./dashboard/DashboardStreamsTab";
import DashboardWarehousesTab, { type Warehouse } from "./dashboard/DashboardWarehousesTab";
import DashboardOrdersTab from "./dashboard/DashboardOrdersTab";
import DashboardStatsTab from "./dashboard/DashboardStatsTab";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface DashboardPageProps {
  setPage: (p: Page) => void;
  openAddProduct?: boolean;
  onAutoOpenDone?: () => void;
}


const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

export default function DashboardPage({ setPage, openAddProduct, onAutoOpenDone }: DashboardPageProps) {
  const { user } = useAuth();
  const { updateStream, reload, getSellerProducts, getSellerStreams } = useStore();

  const products = user ? getSellerProducts(user.id) : [];
  const myStreams = user ? getSellerStreams(user.id) : [];
  const activeStream = myStreams.find(s => s.isLive) ?? null;

  const [tab, setTab] = useState<string | null>("Товары");
  const [stoppingStream, setStoppingStream] = useState<string | null>(null);

  // Профиль
  const { logout } = useAuth();
  const handleLogout = () => { logout(); setPage("home"); };
  const { subscribed, isSupported, subscribe, unsubscribe, status: pushStatus } = usePushNotifications(user?.id ?? null);
  const [pushLoading, setPushLoading] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [whLoading, setWhLoading] = useState(false);

  const loadWarehouses = async (uid: string) => {
    setWhLoading(true);
    try {
      const r = await fetch(`${STORE_API}?action=get_warehouses&seller_id=${uid}`);
      setWarehouses(await r.json());
    } catch { /* ignore */ } finally { setWhLoading(false); }
  };

  useEffect(() => {
    if (user) loadWarehouses(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (user && tab === "Склады") loadWarehouses(user.id);
  }, [tab]);

  // Навигация к заказам при клике на push-уведомление
  useEffect(() => {
    const handler = () => setTab("Заказы");
    window.addEventListener("navigate-orders", handler);
    return () => window.removeEventListener("navigate-orders", handler);
  }, []);

  const handleStopStream = async (id: string) => {
    setStoppingStream(id);
    try {
      await updateStream(id, { isLive: false });
      await reload();
    } catch { /* ignore */ }
    finally { setStoppingStream(null); }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
          <Icon name="LayoutDashboard" size={28} className="text-muted-foreground opacity-40" />
        </div>
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Войдите в аккаунт</h2>
        <p className="text-muted-foreground text-sm mb-6">Для доступа к кабинету необходимо войти</p>
        <button
          onClick={() => setPage("auth")}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">


      {/* Шапка продавца */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-primary/20 text-primary text-lg font-bold flex items-center justify-center font-oswald flex-shrink-0">
          {user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-oswald text-lg font-semibold text-foreground tracking-wide truncate">{user.shopName || user.name}</h1>
          <p className="text-xs text-muted-foreground">Кабинет продавца</p>
        </div>
        <button onClick={() => setPage("profile")} title="Кабинет покупателя"
          className="p-2 rounded-xl border border-border hover:bg-secondary transition-colors">
          <Icon name="User" size={15} className="text-muted-foreground" />
        </button>
      </div>

      {/* ── Грид карточек ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 mb-2">
        {/* Данные и реквизиты */}
        <button onClick={() => setPage("seller-register")}
          className="bg-card border border-primary/30 rounded-xl p-2.5 text-left hover:border-primary/60 transition-colors col-span-1">
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center mb-1.5 font-oswald">
            {user.avatar}
          </div>
          <div className="font-oswald text-[10px] font-semibold text-foreground leading-tight truncate">{(user.shopName || user.name).slice(0,8)}...</div>
          <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">Данные и реквизиты</div>
        </button>

        {/* Товары */}
        <button onClick={() => setTab(tab === "Товары" ? null : "Товары")}
          className={`bg-card border rounded-xl p-2.5 text-left hover:border-primary/40 transition-colors ${tab === "Товары" ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
          <Icon name="Package" size={13} className="text-muted-foreground mb-1.5" />
          <div className="font-oswald text-sm font-semibold text-foreground">{products.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Товары</div>
        </button>

        {/* Эфиры */}
        <button onClick={() => setTab(tab === "Мои эфиры" ? null : "Мои эфиры")}
          className={`bg-card border rounded-xl p-2.5 text-left hover:border-primary/40 transition-colors ${tab === "Мои эфиры" ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
          <Icon name="Radio" size={13} className="text-muted-foreground mb-1.5" />
          <div className="font-oswald text-sm font-semibold text-foreground">{myStreams.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Эфиры</div>
        </button>

        {/* Статистика */}
        <button onClick={() => setTab(tab === "Статистика" ? null : "Статистика")}
          className={`bg-card border rounded-xl p-2.5 text-left hover:border-primary/40 transition-colors ${tab === "Статистика" ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
          <Icon name="BarChart2" size={13} className="text-muted-foreground mb-1.5" />
          <div className="font-oswald text-sm font-semibold text-foreground">{products.length + myStreams.length}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Статистика</div>
        </button>
      </div>

      {/* Заказы — отдельная строка */}
      <div className="grid grid-cols-1 gap-2 mb-3">
        <button onClick={() => setTab(tab === "Заказы от покупателей" ? null : "Заказы от покупателей")}
          className={`bg-card border rounded-xl p-2.5 text-left hover:border-primary/40 transition-colors flex items-center gap-3 ${tab === "Заказы от покупателей" ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
          <Icon name="ShoppingBag" size={16} className="text-muted-foreground" />
          <div>
            <div className="font-oswald text-sm font-semibold text-foreground">Заказы от покупателей</div>
            <div className="text-[10px] text-muted-foreground">Управление и отправка</div>
          </div>
        </button>
      </div>

      {/* ====================================================================
          !! ADMIN PANEL — НЕ ТРОГАТЬ ПРИ ПРАВКАХ ProfilePage !!
          Этот блок — кабинет администратора (Товары/Эфиры/Пользователи).
          Живёт ТОЛЬКО здесь, в DashboardPage. ProfilePage — отдельный файл.
          Роутинг для admin: NavBar → "dashboard" (не "profile")!
          ==================================================================== */}
      {user.role === "admin" && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={() => setPage("admin-products")}
            className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 text-left hover:border-primary/40 transition-colors flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Icon name="Package" size={14} className="text-primary" />
            </div>
            <div>
              <div className="font-oswald text-sm font-semibold text-foreground leading-tight">Товары</div>
              <div className="text-[10px] text-muted-foreground">Модерация и удаление</div>
            </div>
          </button>
          <button onClick={() => setPage("admin-streams")}
            className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 text-left hover:border-primary/40 transition-colors flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Icon name="Radio" size={14} className="text-primary" />
            </div>
            <div>
              <div className="font-oswald text-sm font-semibold text-foreground leading-tight">Эфиры</div>
              <div className="text-[10px] text-muted-foreground">Управление и удаление</div>
            </div>
          </button>
          <button onClick={() => setPage("admin-users")}
            className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 text-left hover:border-primary/40 transition-colors flex items-center gap-2.5 col-span-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Icon name="Users" size={14} className="text-primary" />
            </div>
            <div>
              <div className="font-oswald text-sm font-semibold text-foreground leading-tight">Пользователи</div>
              <div className="text-[10px] text-muted-foreground">Управление и удаление</div>
            </div>
          </button>
        </div>
      )}

      {/* Кнопка эфира + уведомления */}
      <div className="flex items-center gap-2 mb-4">
        {isSupported && pushStatus !== "denied" && (
          <button
            onClick={async () => { setPushLoading(true); if (subscribed) await unsubscribe(); else await subscribe(); setPushLoading(false); }}
            disabled={pushLoading}
            title={subscribed ? "Уведомления включены" : "Включить уведомления о заказах"}
            className={`relative p-2.5 rounded-xl border transition-colors disabled:opacity-50 ${subscribed ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            {pushLoading ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name={subscribed ? "BellRing" : "BellOff"} size={16} />}
            {subscribed && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />}
          </button>
        )}
        {activeStream ? (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-4 py-2.5 rounded-xl flex-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-live-pulse flex-shrink-0" />
            <span className="text-sm font-semibold text-red-500 truncate flex-1">{activeStream.title}</span>
            <button onClick={() => handleStopStream(activeStream.id)} disabled={stoppingStream === activeStream.id}
              className="text-xs font-semibold text-red-500 border border-red-500/40 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-1">
              {stoppingStream === activeStream.id ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Square" size={12} />}
              Стоп
            </button>
          </div>
        ) : (
          <button onClick={() => setPage("broadcast")}
            className="flex-1 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
            Начать эфир
          </button>
        )}
        <button onClick={handleLogout} className="p-2.5 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors" title="Выйти">
          <Icon name="LogOut" size={15} className="text-destructive" />
        </button>
      </div>

      {/* ── Контент раздела ──────────────────────────────────────── */}
      {tab === "Заказы от покупателей" && <DashboardOrdersTab />}
      {tab === "Товары" && <DashboardProductsTab warehouses={warehouses} onGoToProfile={() => setPage("seller-register")} autoOpenForm={openAddProduct} onAutoOpenDone={onAutoOpenDone} />}
      {tab === "Мои эфиры" && <DashboardStreamsTab setPage={setPage} />}
      {tab === "Статистика" && (
        <DashboardStatsTab products={products} streams={myStreams} sellerId={user.id} />
      )}
    </div>
  );
}