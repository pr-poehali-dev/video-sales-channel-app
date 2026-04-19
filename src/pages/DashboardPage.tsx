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
import DashboardShopTab from "./dashboard/DashboardShopTab";
import MyPurchasesTab from "./dashboard/MyPurchasesTab";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface DashboardPageProps {
  setPage: (p: Page) => void;
}

const TABS = ["Заказы от покупателей", "Мои покупки", "Товары", "Магазин", "Мои эфиры", "Статистика"];
const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

export default function DashboardPage({ setPage }: DashboardPageProps) {
  const { user } = useAuth();
  const { updateStream, reload, getSellerProducts, getSellerStreams } = useStore();

  const products = user ? getSellerProducts(user.id) : [];
  const myStreams = user ? getSellerStreams(user.id) : [];
  const activeStream = myStreams.find(s => s.isLive) ?? null;

  const [tab, setTab] = useState("Заказы от покупателей");
  const [stoppingStream, setStoppingStream] = useState<string | null>(null);

  // Профиль
  const { logout, updateUser } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  const [pName, setPName] = useState(user?.name ?? "");
  const [pPhone, setPPhone] = useState(user?.phone ?? "");
  const [pCity, setPCity] = useState(user?.city ?? "");
  const [profileSaved, setProfileSaved] = useState(false);

  const handleSaveProfile = async () => {
    await updateUser({ name: pName.trim(), phone: pPhone.trim(), city: pCity.trim() });
    setEditingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };
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

      {/* ── Шапка: аватар + имя + выход ─────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/20 text-primary text-xl font-bold flex items-center justify-center font-oswald flex-shrink-0">
          {user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-oswald text-xl font-semibold text-foreground tracking-wide truncate">{user.name}</h1>
          <div className="flex flex-wrap gap-x-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{user.email}</span>
            {user.city && <span className="text-xs text-muted-foreground">· {user.city}</span>}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors flex-shrink-0"
          title="Выйти"
        >
          <Icon name="LogOut" size={15} className="text-destructive" />
        </button>
      </div>

      {/* ── Карточки: данные + реквизиты + статистика ────────────── */}
      {profileSaved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-2.5 rounded-xl mb-4 animate-fade-in">
          <Icon name="CircleCheck" size={14} />
          Данные профиля сохранены
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {/* Мои данные */}
        <button
          onClick={() => { setEditingProfile(!editingProfile); setPName(user.name); setPPhone(user.phone); setPCity(user.city); }}
          className={`bg-card border rounded-xl p-4 text-left hover:border-primary/40 transition-colors ${editingProfile ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}
        >
          <Icon name="User" size={16} className="text-muted-foreground mb-2" />
          <div className="font-oswald text-base font-semibold text-foreground truncate">{user.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Мои данные</div>
        </button>

        {/* Реквизиты */}
        <button
          onClick={() => setPage("seller-register" as Page)}
          className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary/40 transition-colors"
        >
          <Icon name="FileText" size={16} className="text-muted-foreground mb-2" />
          <div className="font-oswald text-base font-semibold text-foreground">Реквизиты</div>
          <div className="text-xs text-muted-foreground mt-0.5">Магазин · ИП / ООО</div>
        </button>

        {/* Товаров */}
        <div className="bg-card border border-border rounded-xl p-4">
          <Icon name="Package" size={16} className="text-muted-foreground mb-2" />
          <div className="font-oswald text-xl font-semibold text-foreground">{products.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Товаров</div>
        </div>

        {/* Эфиров */}
        <div className="bg-card border border-border rounded-xl p-4">
          <Icon name="Radio" size={16} className="text-muted-foreground mb-2" />
          <div className="font-oswald text-xl font-semibold text-foreground">{myStreams.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Эфиров</div>
        </div>

        {/* Продаж */}
        <div className="bg-card border border-border rounded-xl p-4">
          <Icon name="ShoppingBag" size={16} className="text-muted-foreground mb-2" />
          <div className="font-oswald text-xl font-semibold text-foreground">0</div>
          <div className="text-xs text-muted-foreground mt-0.5">Продаж</div>
        </div>

        {/* Выручка */}
        <div className="bg-card border border-border rounded-xl p-4">
          <Icon name="Wallet" size={16} className="text-muted-foreground mb-2" />
          <div className="font-oswald text-xl font-semibold text-foreground">0 ₽</div>
          <div className="text-xs text-muted-foreground mt-0.5">Выручка</div>
        </div>
      </div>

      {/* Форма редактирования (раскрывается под карточками) */}
      {editingProfile && (
        <div className="bg-card border border-primary/30 rounded-2xl p-4 mb-6 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm text-foreground">Редактировать данные</span>
            <button onClick={() => setEditingProfile(false)}>
              <Icon name="X" size={14} className="text-muted-foreground" />
            </button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Имя</label>
            <input value={pName} onChange={e => setPName(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Телефон</label>
              <input value={pPhone} onChange={e => setPPhone(e.target.value)} placeholder="+7 900 000-00-00"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Город</label>
              <input value={pCity} onChange={e => setPCity(e.target.value)} placeholder="Москва"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={handleSaveProfile}
              className="bg-primary text-primary-foreground font-semibold px-5 py-2 rounded-xl hover:opacity-90 transition-opacity text-sm">
              Сохранить
            </button>
            <button onClick={() => setEditingProfile(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* ── Заголовок кабинета + кнопки ──────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide">Мой кабинет</h2>
        <div className="flex items-center gap-2">
          {isSupported && pushStatus !== "denied" && (
            <button
              onClick={async () => {
                setPushLoading(true);
                if (subscribed) await unsubscribe();
                else await subscribe();
                setPushLoading(false);
              }}
              disabled={pushLoading}
              title={subscribed ? "Уведомления включены — нажми чтобы отключить" : "Включить уведомления о заказах"}
              className={`relative p-2.5 rounded-xl border transition-colors disabled:opacity-50 ${
                subscribed
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {pushLoading
                ? <Icon name="Loader" size={16} className="animate-spin" />
                : <Icon name={subscribed ? "BellRing" : "BellOff"} size={16} />
              }
              {subscribed && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
              )}
            </button>
          )}
          {activeStream ? (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-4 py-2.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-live-pulse flex-shrink-0" />
              <span className="text-sm font-semibold text-red-500 truncate max-w-[120px]">{activeStream.title}</span>
              <button
                onClick={() => handleStopStream(activeStream.id)}
                disabled={stoppingStream === activeStream.id}
                className="ml-1 text-xs font-semibold text-red-500 border border-red-500/40 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
              >
                {stoppingStream === activeStream.id
                  ? <Icon name="Loader" size={12} className="animate-spin" />
                  : <Icon name="Square" size={12} />}
                Стоп
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPage("broadcast")}
              className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
              Начать эфир
            </button>
          )}
        </div>
      </div>

      {/* Табы */}
      <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-hide bg-secondary rounded-xl p-1 w-fit max-w-full">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative flex-shrink-0 px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Заказы от покупателей" && <DashboardOrdersTab />}
      {tab === "Мои покупки" && <MyPurchasesTab />}
      {tab === "Товары" && <DashboardProductsTab warehouses={warehouses} />}
      {tab === "Магазин" && <DashboardShopTab />}
      {tab === "Мои эфиры" && <DashboardStreamsTab setPage={setPage} />}
      {tab === "Статистика" && (
        <div className="animate-fade-in text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="BarChart2" size={24} className="text-muted-foreground opacity-40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Статистика появится после первых продаж</h3>
          <p className="text-sm text-muted-foreground">Добавь товары и запусти эфир</p>
        </div>
      )}
    </div>
  );
}