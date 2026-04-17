import Icon from "@/components/ui/icon";
import type { CartItem } from "@/App";

const WHOLESALE_MIN = 5000;

export function isSellerWholesaleReached(items: CartItem[]): boolean {
  const total = items.reduce((s, c) => {
    const wp = c.wholesalePrice;
    return s + (wp != null && wp > 0 ? wp : c.price) * c.qty;
  }, 0);
  return total >= WHOLESALE_MIN;
}

export function getEffectiveItemPrice(item: CartItem, sellerWholesaleReached: boolean): number {
  const hasWholesale = item.wholesalePrice != null && item.wholesalePrice > 0;
  if (!hasWholesale) return item.price;
  if (sellerWholesaleReached) return item.wholesalePrice!;
  return Math.round(item.wholesalePrice! * (1 + (item.retailMarkupPct ?? 0) / 100));
}

interface CartSellerGroupProps {
  sellerId: string;
  sellerName: string;
  items: CartItem[];
  selectedIds: Set<string>;
  sellerDeliveryCosts: Record<string, number | null>;
  sellerDeliveryLoading: Record<string, boolean>;
  hasCitySelected: boolean;
  onToggleSeller: (items: CartItem[]) => void;
  onToggleItem: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

export default function CartSellerGroup({
  sellerId,
  sellerName,
  items,
  selectedIds,
  sellerDeliveryCosts,
  sellerDeliveryLoading,
  hasCitySelected,
  onToggleSeller,
  onToggleItem,
  onUpdateQty,
  onRemove,
}: CartSellerGroupProps) {
  const allSellerSelected  = items.every(i => selectedIds.has(i.id));
  const someSellerSelected = items.some(i => selectedIds.has(i.id));
  const wholesaleReached   = isSellerWholesaleReached(items);

  const selectedGroupTotal = items
    .filter(i => selectedIds.has(i.id))
    .reduce((s, c) => s + getEffectiveItemPrice(c, wholesaleReached) * c.qty, 0);

  // Оптовый минимум
  const sellerWholesaleTotal = items.reduce((s, c) => {
    const wp = c.wholesalePrice;
    return s + (wp != null && wp > 0 ? wp : c.price) * c.qty;
  }, 0);
  const remaining = WHOLESALE_MIN - sellerWholesaleTotal;
  const pct = Math.min(100, Math.round((sellerWholesaleTotal / WHOLESALE_MIN) * 100));

  // Итого по продавцу
  const sellerGoods = items
    .filter(i => selectedIds.has(i.id))
    .reduce((s, c) => s + getEffectiveItemPrice(c, wholesaleReached) * c.qty, 0);
  const sellerWeightG = items
    .filter(i => selectedIds.has(i.id))
    .reduce((s, c) => s + c.qty * (c.weightG ?? 300), 0);
  const deliveryCostForSeller = sellerDeliveryCosts[sellerId] ?? null;
  const isLoadingDelivery     = sellerDeliveryLoading[sellerId] ?? false;
  const weightLabel = sellerWeightG >= 1000
    ? `${(sellerWeightG / 1000).toFixed(sellerWeightG % 1000 === 0 ? 0 : 1)} кг`
    : `${sellerWeightG} г`;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Шапка продавца */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/40">
        <button onClick={() => onToggleSeller(items)} className="flex-shrink-0">
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            allSellerSelected ? "bg-primary border-primary" : someSellerSelected ? "border-primary bg-primary/20" : "border-muted-foreground"
          }`}>
            {allSellerSelected && <Icon name="Check" size={11} className="text-white" />}
            {!allSellerSelected && someSellerSelected && <div className="w-2 h-0.5 bg-primary rounded-full" />}
          </span>
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name="Store" size={13} className="text-primary flex-shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">{sellerName}</span>
        </div>
        <span className="text-xs text-muted-foreground font-medium flex-shrink-0">
          {selectedGroupTotal.toLocaleString("ru")} ₽
        </span>
      </div>

      {/* Оптовый минимум */}
      <div className={`px-4 py-2 border-b border-border flex items-center gap-3 ${wholesaleReached ? "bg-primary/5" : "bg-secondary/30"}`}>
        <Icon name="Layers" size={12} className={wholesaleReached ? "text-primary flex-shrink-0" : "text-muted-foreground flex-shrink-0"} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`text-[10px] font-medium truncate ${wholesaleReached ? "text-primary" : "text-muted-foreground"}`}>
              {wholesaleReached ? "Оптовый минимум достигнут!" : `До опта ${remaining.toLocaleString("ru")} ₽`}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{pct}%</span>
          </div>
          <div className="w-full bg-border rounded-full h-1 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${wholesaleReached ? "bg-primary" : "bg-primary/40"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Товары продавца */}
      <div className="divide-y divide-border">
        {items.map(item => {
          const isSelected = selectedIds.has(item.id);
          return (
            <div key={item.id} className={`p-4 flex gap-3 items-center transition-all ${isSelected ? "" : "opacity-40"}`}>
              <button onClick={() => onToggleItem(item.id)} className="flex-shrink-0">
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                }`}>
                  {isSelected && <Icon name="Check" size={11} className="text-white" />}
                </span>
              </button>
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
                {item.videoUrl ? (
                  <video src={item.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                ) : item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground opacity-30">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-2">{item.name}</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="font-oswald text-base font-semibold text-foreground">
                    {getEffectiveItemPrice(item, wholesaleReached).toLocaleString("ru")} ₽
                  </p>
                  {wholesaleReached && item.wholesalePrice != null && item.wholesalePrice > 0 && (
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">опт</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => onUpdateQty(item.id, item.qty - 1)}
                  className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors">
                  <Icon name="Minus" size={13} />
                </button>
                <span className="w-6 text-center text-sm font-medium text-foreground">{item.qty}</span>
                <button onClick={() => onUpdateQty(item.id, item.qty + 1)}
                  className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors">
                  <Icon name="Plus" size={13} />
                </button>
                <button onClick={() => onRemove(item.id)}
                  className="w-7 h-7 rounded-lg ml-1 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Итого по продавцу */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <div className="px-3 py-3">
          <p className="text-[10px] text-muted-foreground mb-0.5">Товары</p>
          <p className="font-oswald text-sm font-semibold text-foreground">{sellerGoods.toLocaleString("ru")} ₽</p>
        </div>
        <div className="px-3 py-3">
          <p className="text-[10px] text-muted-foreground mb-0.5">Вес</p>
          <p className="font-oswald text-sm font-semibold text-foreground">{weightLabel}</p>
        </div>
        <div className="px-3 py-3">
          <p className="text-[10px] text-muted-foreground mb-0.5">Доставка (мин.)</p>
          {isLoadingDelivery ? (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">считаем...</span>
            </div>
          ) : (
            <p className="font-oswald text-sm font-semibold text-foreground">
              {deliveryCostForSeller !== null
                ? `от ${deliveryCostForSeller.toLocaleString("ru")} ₽`
                : <span className="text-muted-foreground font-normal text-xs">{hasCitySelected ? "нет тарифов" : "укажите город"}</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
