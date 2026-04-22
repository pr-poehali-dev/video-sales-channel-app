import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

type SellerStatus = "new_order" | "assembling" | "ready_to_ship" | "shipped" | "completed" | "cancelled";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty?: number;
  quantity?: number;
  image?: string;
  images?: string[];
  sellerId?: string;
  videoUrl?: string;
}

interface Order {
  id: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  deliveryType: string;
  deliveryCityName: string;
  deliveryAddress: string;
  deliveryTariffName: string;
  deliveryCost: number;
  items: OrderItem[];
  sellerItems: OrderItem[];
  sellerTotal: number;
  goodsTotal: number;
  orderTotal: number;
  status: string;
  sellerStatus: SellerStatus;
  sellerComment: string;
  cdekTrackNumber: string;
  cdekOrderUuid: string;
  paymentMethod: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<SellerStatus, { label: string; color: string; bg: string; icon: string }> = {
  new_order:     { label: "Новый заказ",   color: "text-blue-600",   bg: "bg-blue-50 border-blue-200",   icon: "ShoppingBag" },
  assembling:    { label: "Собирается",    color: "text-orange-600", bg: "bg-orange-50 border-orange-200", icon: "Package" },
  ready_to_ship: { label: "Готов к отправке", color: "text-purple-600", bg: "bg-purple-50 border-purple-200", icon: "PackageCheck" },
  shipped:       { label: "Отправлен",     color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200", icon: "Truck" },
  completed:     { label: "Выполнен",      color: "text-green-600",  bg: "bg-green-50 border-green-200",  icon: "CheckCircle" },
  cancelled:     { label: "Отменён",       color: "text-red-600",    bg: "bg-red-50 border-red-200",     icon: "XCircle" },
};

const NEXT_STEPS: Record<SellerStatus, { status: SellerStatus; label: string; icon: string; primary?: boolean }[]> = {
  new_order:     [{ status: "assembling",    label: "Начать сборку",       icon: "Package",      primary: true  },
                  { status: "cancelled",     label: "Отменить",            icon: "XCircle" }],
  assembling:    [{ status: "ready_to_ship", label: "Собрал, готов к отправке", icon: "PackageCheck", primary: true  },
                  { status: "cancelled",     label: "Отменить",            icon: "XCircle" }],
  ready_to_ship: [{ status: "shipped",       label: "Передал в СДЭК",      icon: "Truck",        primary: true  }],
  shipped:       [{ status: "completed",     label: "Доставлено",          icon: "CheckCircle",  primary: true  }],
  completed:     [],
  cancelled:     [],
};

const FILTER_TABS: { key: SellerStatus | "all"; label: string }[] = [
  { key: "all",          label: "Все" },
  { key: "new_order",    label: "Новые" },
  { key: "assembling",   label: "Сборка" },
  { key: "ready_to_ship",label: "Готовы" },
  { key: "shipped",      label: "В пути" },
  { key: "completed",    label: "Выполнены" },
];

interface Props {
  profileType?: "individual" | "legal";
}

export default function DashboardOrdersTab({ profileType }: Props) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SellerStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [productVideos, setProductVideos] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const profileParam = profileType ? `&profile_type=${profileType}` : "";
      const [ordersRes, productsRes] = await Promise.all([
        fetch(`${STORE_API}?action=get_seller_orders&seller_id=${user.id}${profileParam}`),
        fetch(`${STORE_API}?action=get_products&seller_id=${user.id}&profile_type=${profileType || ""}`),
      ]);
      const data = await ordersRes.json();
      setOrders(Array.isArray(data) ? data : []);
      const prods = await productsRes.json();
      if (Array.isArray(prods)) {
        const map: Record<string, string> = {};
        prods.forEach((p: { id: string; videoUrl?: string }) => { if (p.videoUrl) map[p.id] = p.videoUrl; });
        setProductVideos(map);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user, profileType]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (orderId: string, newStatus: SellerStatus) => {
    if (!user) return;
    setUpdating(orderId);
    try {
      await fetch(`${STORE_API}?action=update_seller_order_status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, seller_id: user.id, seller_status: newStatus }),
      });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, sellerStatus: newStatus } : o));
    } finally {
      setUpdating(null);
    }
  };

  const filtered = filter === "all" ? orders : orders.filter(o => o.sellerStatus === filter);

  const counts: Record<string, number> = {};
  orders.forEach(o => { counts[o.sellerStatus] = (counts[o.sellerStatus] || 0) + 1; });
  const newCount = counts["new_order"] || 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Загружаем заказы...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {orders.length > 0
              ? `${orders.length} заказ${orders.length === 1 ? "" : orders.length < 5 ? "а" : "ов"}`
              : "Нет заказов"}
          </span>
          {newCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              {newCount} новых
            </span>
          )}
        </div>
        <button onClick={load} className="p-2 hover:bg-secondary rounded-lg transition-colors">
          <Icon name="RefreshCw" size={15} className="text-muted-foreground" />
        </button>
      </div>

      {/* Фильтр по статусам */}
      {orders.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-hide">
          {FILTER_TABS.map(tab => {
            const cnt = tab.key === "all" ? orders.length : (counts[tab.key] || 0);
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-secondary"
                }`}
              >
                {tab.label}
                {cnt > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-secondary"}`}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Пустой экран */}
      {orders.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="ShoppingBag" size={24} className="text-muted-foreground opacity-40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Заказов пока нет</h3>
          <p className="text-sm text-muted-foreground">Здесь появятся заказы, как только покупатели оформят их</p>
        </div>
      )}

      {/* Список заказов */}
      <div className="flex flex-col gap-3">
        {filtered.map(order => {
          const cfg = STATUS_CONFIG[order.sellerStatus] || STATUS_CONFIG.new_order;
          const nextSteps = NEXT_STEPS[order.sellerStatus] || [];
          const isExpanded = expanded === order.id;
          const isUpdating = updating === order.id;
          const items = order.sellerItems?.length ? order.sellerItems : order.items;

          return (
            <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Заголовок карточки */}
              <button
                onClick={() => setExpanded(isExpanded ? null : order.id)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-secondary/30 transition-colors"
              >
                {/* Иконка статуса */}
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                  <Icon name={cfg.icon as never} size={16} className={cfg.color} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">#{order.id.slice(-8).toUpperCase()}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} flex-shrink-0`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {order.buyerName} · {order.createdAt}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-medium text-foreground">
                      {(order.sellerTotal || order.goodsTotal).toLocaleString("ru-RU")} ₽
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {items.length} товар{items.length === 1 ? "" : items.length < 5 ? "а" : "ов"}
                    </span>
                  </div>
                </div>

                <Icon
                  name={isExpanded ? "ChevronUp" : "ChevronDown"}
                  size={16}
                  className="text-muted-foreground flex-shrink-0 mt-1"
                />
              </button>

              {/* Раскрытая часть */}
              {isExpanded && (
                <div className="border-t border-border">
                  {/* Товары */}
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Товары</p>
                    {items.map((item, idx) => {
                      const qty = item.qty ?? item.quantity ?? 1;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          {(() => {
                            const videoUrl = item.videoUrl || productVideos[item.id] || "";
                            const imgUrl = item.image || item.images?.[0] || "";
                            return (
                              <div className="w-10 h-10 rounded-lg bg-black flex-shrink-0 overflow-hidden">
                                {videoUrl ? (
                                  <video
                                    key={videoUrl}
                                    className="w-full h-full object-cover"
                                    autoPlay playsInline muted loop preload="auto"
                                    src={videoUrl}
                                    poster={imgUrl || undefined}
                                    onLoadedMetadata={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
                                    onCanPlay={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
                                  />
                                ) : imgUrl ? (
                                  <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                                    <Icon name="Package" size={14} className="text-muted-foreground opacity-40" />
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground line-clamp-1">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{qty} шт. × {item.price.toLocaleString("ru-RU")} ₽</p>
                          </div>
                          <p className="text-sm font-semibold text-foreground flex-shrink-0">
                            {(item.price * qty).toLocaleString("ru-RU")} ₽
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Покупатель и доставка */}
                  <div className="px-4 pb-4 grid grid-cols-1 gap-2">
                    <div className="bg-secondary rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Покупатель</p>
                      <div className="flex items-center gap-2">
                        <Icon name="User" size={13} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-foreground">{order.buyerName}</span>
                      </div>
                      {order.buyerPhone && (
                        <div className="flex items-center gap-2">
                          <Icon name="Phone" size={13} className="text-muted-foreground flex-shrink-0" />
                          <a href={`tel:${order.buyerPhone}`} className="text-sm text-primary">{order.buyerPhone}</a>
                        </div>
                      )}
                      {order.buyerEmail && (
                        <div className="flex items-center gap-2">
                          <Icon name="Mail" size={13} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-sm text-foreground truncate">{order.buyerEmail}</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-secondary rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Доставка</p>
                      <div className="flex items-center gap-2">
                        <Icon name="MapPin" size={13} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-foreground">{order.deliveryCityName}</span>
                      </div>
                      {order.deliveryAddress && (
                        <div className="flex items-center gap-2">
                          <Icon name="Navigation" size={13} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-sm text-foreground text-wrap">{order.deliveryAddress}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Icon name="Truck" size={13} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-foreground">{order.deliveryTariffName || "СДЭК"} · {order.deliveryCost.toLocaleString("ru-RU")} ₽</span>
                      </div>
                      {order.cdekTrackNumber && (
                        <div className="flex items-center gap-2">
                          <Icon name="ScanBarcode" size={13} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-mono text-foreground">{order.cdekTrackNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Кнопки действий */}
                  {nextSteps.length > 0 && (
                    <div className="px-4 pb-4 flex flex-col gap-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Действие</p>
                      {nextSteps.map(step => (
                        <button
                          key={step.status}
                          onClick={() => updateStatus(order.id, step.status)}
                          disabled={isUpdating}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50 ${
                            step.primary
                              ? "bg-primary text-primary-foreground hover:opacity-90"
                              : "border border-border text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {isUpdating
                            ? <Icon name="Loader" size={15} className="animate-spin" />
                            : <Icon name={step.icon as never} size={15} />
                          }
                          {step.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Итог */}
                  <div className="px-4 pb-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">Итого товары</span>
                    <span className="text-sm font-bold text-foreground">
                      {(order.sellerTotal || order.goodsTotal).toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && orders.length > 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground">Нет заказов с таким статусом</p>
          </div>
        )}
      </div>
    </div>
  );
}