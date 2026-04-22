import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { StoreProduct, StoreStream } from "@/context/StoreContext";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

interface Order {
  id: string;
  sellerTotal: number;
  status: string;
  sellerStatus: string;
  createdAt: string;
  sellerItems: { name: string; qty?: number; quantity?: number; price: number }[];
}

interface DashboardStatsTabProps {
  products: StoreProduct[];
  streams: StoreStream[];
  sellerId: string;
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon name={icon as "Package"} size={15} className="text-primary" />
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="font-oswald text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardStatsTab({ products, streams, sellerId }: DashboardStatsTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${STORE_API}?action=get_seller_orders&seller_id=${sellerId}`)
      .then(r => r.json())
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [sellerId]);

  const completedOrders = orders.filter(o => o.sellerStatus === "completed");
  const activeOrders = orders.filter(o => !["completed", "cancelled"].includes(o.sellerStatus));
  const revenue = completedOrders.reduce((s, o) => s + (o.sellerTotal ?? 0), 0);
  const avgOrder = completedOrders.length > 0 ? Math.round(revenue / completedOrders.length) : 0;

  const totalViewers = streams.reduce((s, st) => s + (st.viewers ?? 0), 0);

  if (loading) {
    return (
      <div className="animate-fade-in py-12 text-center">
        <Icon name="Loader" size={28} className="mx-auto text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4 mt-2">
      <h2 className="font-oswald text-base font-semibold text-foreground tracking-wide">Статистика магазина</h2>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon="TrendingUp"
          label="Выручка (выполненные)"
          value={`${revenue.toLocaleString("ru")} ₽`}
          sub={completedOrders.length > 0 ? `${completedOrders.length} заказ${completedOrders.length < 5 ? "а" : "ов"}` : "Пока нет продаж"}
        />
        <StatCard
          icon="ShoppingBag"
          label="Активных заказов"
          value={String(activeOrders.length)}
          sub={orders.length > 0 ? `Всего ${orders.length} заказ${orders.length < 5 ? "а" : "ов"}` : "Заказов пока нет"}
        />
        <StatCard
          icon="Package"
          label="Товаров в магазине"
          value={String(products.length)}
          sub={products.length > 0 ? "Активны в каталоге" : "Добавьте первый товар"}
        />
        <StatCard
          icon="Radio"
          label="Эфиров проведено"
          value={String(streams.length)}
          sub={totalViewers > 0 ? `${totalViewers} просмотр${totalViewers < 5 ? "а" : "ов"} всего` : ""}
        />
      </div>

      {avgOrder > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
          <Icon name="BarChart2" size={20} className="text-primary flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-foreground">Средний чек</div>
            <div className="font-oswald text-xl font-bold text-primary">{avgOrder.toLocaleString("ru")} ₽</div>
          </div>
        </div>
      )}

      {orders.length === 0 && products.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Статистика появится после первых продаж
        </div>
      )}
    </div>
  );
}
