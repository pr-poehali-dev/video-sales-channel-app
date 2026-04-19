import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
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
  deliveryAddress: string;
  deliveryType: string;
  cdekTrackNumber?: string;
  createdAt: string;
}

export default function MyPurchasesTab() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const loadOrders = () => {
    if (!user?.id) return;
    setLoading(true);
    fetch(`${STORE_API}?action=get_orders&buyer_id=${user.id}`)
      .then(r => r.json())
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        Загружаем...
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="animate-fade-in text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
          <Icon name="ShoppingBag" size={24} className="text-muted-foreground opacity-40" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Покупок пока нет</h3>
        <p className="text-sm text-muted-foreground">Здесь появятся ваши заказы</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">{orders.length} заказ{orders.length === 1 ? "" : orders.length < 5 ? "а" : "ов"}</p>
        <button onClick={loadOrders} className="text-muted-foreground hover:text-foreground transition-colors">
          <Icon name="RefreshCw" size={16} />
        </button>
      </div>

      {orders.map(order => {
        const st = STATUS_LABEL[order.status] ?? { label: order.status, color: "text-muted-foreground" };
        const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "";
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
                <p className="text-xs text-muted-foreground mb-0.5">№ {order.id.replace("order_", "").toUpperCase().slice(0, 8)}</p>
                <p className="text-sm font-semibold text-foreground">
                  {Number(order.orderTotal).toLocaleString("ru-RU")} ₽
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    · {order.items?.length ?? 0} товар{(order.items?.length ?? 0) === 1 ? "" : (order.items?.length ?? 0) < 5 ? "а" : "ов"}
                  </span>
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                  {date && <span className="text-xs text-muted-foreground">· {date}</span>}
                  {order.deliveryCityName && (
                    <span className="text-xs text-muted-foreground">· {order.deliveryCityName.split(",")[0]}</span>
                  )}
                </div>
              </div>
              <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground flex-shrink-0" />
            </button>

            {isOpen && (
              <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 animate-fade-in">
                {order.items?.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-10 h-10 rounded-xl object-cover bg-secondary flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-secondary flex-shrink-0" />
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
  );
}
