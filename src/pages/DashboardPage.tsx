import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { Page } from "@/App";
import DashboardProductsTab from "./dashboard/DashboardProductsTab";
import DashboardStreamsTab from "./dashboard/DashboardStreamsTab";
import DashboardWarehousesTab, { type Warehouse } from "./dashboard/DashboardWarehousesTab";
import DashboardOrdersTab from "./dashboard/DashboardOrdersTab";

interface DashboardPageProps {
  setPage: (p: Page) => void;
}

const TABS = ["Заказы", "Товары", "Склады", "Мои эфиры", "Статистика"];
const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

export default function DashboardPage({ setPage }: DashboardPageProps) {
  const { user } = useAuth();
  const { updateStream, reload, getSellerProducts, getSellerStreams } = useStore();

  const products = user ? getSellerProducts(user.id) : [];
  const myStreams = user ? getSellerStreams(user.id) : [];
  const activeStream = myStreams.find(s => s.isLive) ?? null;

  const [tab, setTab] = useState("Заказы");
  const [stoppingStream, setStoppingStream] = useState<string | null>(null);

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
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Мой кабинет</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user.name}{user.city ? ` · ${user.city}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage("seller-register" as Page)}
            className="border border-border text-muted-foreground font-medium px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors text-sm flex items-center gap-2"
          >
            <Icon name="FileText" size={15} />
            Реквизиты
          </button>
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

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: "Package", value: String(products.length), label: "Товаров" },
          { icon: "Radio", value: String(myStreams.length), label: "Эфиров" },
          { icon: "ShoppingBag", value: "0", label: "Продаж" },
          { icon: "Wallet", value: "0 ₽", label: "Выручка" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <Icon name={s.icon} size={16} className="text-muted-foreground mb-2" />
            <div className="font-oswald text-xl font-semibold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
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

      {tab === "Заказы" && <DashboardOrdersTab />}
      {tab === "Товары" && <DashboardProductsTab warehouses={warehouses} />}
      {tab === "Склады" && <DashboardWarehousesTab warehouses={warehouses} setWarehouses={setWarehouses} whLoading={whLoading} />}
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