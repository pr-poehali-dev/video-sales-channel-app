import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import type { CartItem } from "@/App";
import CdekDelivery from "@/components/CdekDelivery";
import SbpPayment from "@/components/SbpPayment";
import { useAuth } from "@/context/AuthContext";
import { usePriceMode } from "@/context/PriceModeContext";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const CDEK_API = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";

interface CartPageProps {
  cart: CartItem[];
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
}

interface SelectedDelivery {
  tariff: { code: string; name: string; price: number; days_min: number; days_max: number; provider?: string; delivery_to?: "pvz" | "courier" } | null;
  city: { code: string; city: string; region: string; guid?: string } | null;
}

type PaymentMethod = "sbp" | "card" | null;
type DeliveryType = "cdek_pvz" | "cdek_courier";

function getItemPrice(item: CartItem, mode: "retail" | "wholesale"): number {
  const hasWholesale = item.wholesalePrice != null && item.wholesalePrice > 0;
  if (!hasWholesale) return item.price;
  if (mode === "wholesale") return item.wholesalePrice!;
  return Math.round(item.wholesalePrice! * (1 + (item.retailMarkupPct ?? 0) / 100));
}

export default function CartPage({ cart, removeFromCart, updateQty }: CartPageProps) {
  const { user, updateUser } = useAuth();
  const { mode } = usePriceMode();

  // Выбор товаров (по умолчанию все выбраны)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(cart.map(c => c.id)));

  const toggleItem = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });

  const toggleSeller = (sellerItems: CartItem[]) => {
    const ids = sellerItems.map(i => i.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === cart.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(cart.map(c => c.id)));
  };

  const selectedCart = cart.filter(c => selectedIds.has(c.id));

  const [delivery, setDelivery] = useState<SelectedDelivery>({ tariff: null, city: null });

  // Стоимость доставки отдельно для каждого продавца
  const [sellerDeliveryCosts, setSellerDeliveryCosts] = useState<Record<string, number | null>>({});
  const [sellerDeliveryLoading, setSellerDeliveryLoading] = useState<Record<string, boolean>>({});
  const calcTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Пересчёт доставки для продавца при изменении города или веса его товаров
  const recalcSellerDelivery = (sellerId: string, fromCityCode: string, weightG: number, toCityCode: string, toCityGuid?: string) => {
    if (!toCityCode) return;
    if (calcTimers.current[sellerId]) clearTimeout(calcTimers.current[sellerId]);
    setSellerDeliveryLoading(prev => ({ ...prev, [sellerId]: true }));
    calcTimers.current[sellerId] = setTimeout(async () => {
      try {
        const guidParam = toCityGuid ? `&city_guid=${toCityGuid}` : "";
        const fromParam = fromCityCode ? `&from_city_code=${encodeURIComponent(fromCityCode)}` : "";
        const sellerParam = sellerId ? `&seller_id=${sellerId}` : "";
        const res = await fetch(`${CDEK_API}?action=calc&city_code=${encodeURIComponent(toCityCode)}&weight=${weightG}${guidParam}${fromParam}${sellerParam}`);
        const data = await res.json();
        const tariffs: { price: number }[] = Array.isArray(data) ? data : (data.tariffs ?? []);
        const minPrice = tariffs.length > 0 ? Math.min(...tariffs.map(t => t.price)) : null;
        setSellerDeliveryCosts(prev => ({ ...prev, [sellerId]: minPrice }));
      } catch {
        setSellerDeliveryCosts(prev => ({ ...prev, [sellerId]: null }));
      } finally {
        setSellerDeliveryLoading(prev => ({ ...prev, [sellerId]: false }));
      }
    }, 400);
  };
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("cdek_pvz");
  const [cdekPvzCode, setCdekPvzCode] = useState<string | undefined>(undefined);
  const [payMethod, setPayMethod] = useState<PaymentMethod>(null);
  const [showSbp, setShowSbp] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cdekTrack, setCdekTrack] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Контактные данные
  const [buyerName, setBuyerName] = useState(user?.name || "");
  const [buyerPhone, setBuyerPhone] = useState(user?.phone || "");
  const [buyerEmail, setBuyerEmail] = useState(user?.email || "");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Пересчёт доставки по каждому продавцу при изменении города или количества
  const cartQtyKey = cart.map(c => `${c.id}:${c.qty}`).join(",");
  useEffect(() => {
    if (!delivery.city) return;
    const groups: Record<string, { fromCityCode: string; sellerId: string; weight: number }> = {};
    cart.forEach(item => {
      const sid = item.sellerId || "__unknown__";
      if (!groups[sid]) groups[sid] = { fromCityCode: item.fromCityCode ?? "", sellerId: sid, weight: 0 };
      groups[sid].weight += item.qty * (item.weightG ?? 300);
    });
    Object.values(groups).forEach(g => {
      recalcSellerDelivery(g.sellerId, g.fromCityCode, g.weight, delivery.city!.code, delivery.city!.guid);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery.city, cartQtyKey]);

  const goodsTotal = selectedCart.reduce((s, c) => s + getItemPrice(c, mode) * c.qty, 0);
  const sellerDeliveryTotal = Object.values(sellerDeliveryCosts).reduce<number>((s, v) => s + (v ?? 0), 0);
  const deliveryCost = delivery.city ? sellerDeliveryTotal || null : (delivery.tariff?.price ?? null);
  const orderTotal = goodsTotal + (deliveryCost ?? 0);
  const totalWeight = selectedCart.reduce((s, c) => s + c.qty * (c.weightG ?? 300), 0);
  const fromCityCode = (selectedCart[0] ?? cart[0])?.fromCityCode ?? "";
  const sellerIdForDelivery = cart[0]?.sellerId ?? "";

  const contactFilled = buyerName.trim() && buyerPhone.trim();
  const canCheckout = deliveryCost !== null && payMethod !== null && !!contactFilled;

  const createOrder = async (): Promise<string | null> => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const orderPayload = {
        buyer_id: user?.id || "",
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone.trim(),
        buyer_email: buyerEmail.trim(),
        delivery_type: deliveryType,
        delivery_city_code: delivery.city?.code,
        delivery_city_name: delivery.city ? `${delivery.city.city}${delivery.city.region ? ", " + delivery.city.region : ""}` : "",
        delivery_address: deliveryAddress.trim(),
        delivery_tariff_code: delivery.tariff?.code,
        delivery_tariff_name: delivery.tariff?.name || "",
        delivery_cost: deliveryCost || 0,
        cdek_pvz_code: cdekPvzCode || "",
        items: selectedCart.map(c => ({ id: c.id, name: c.name, price: getItemPrice(c, mode), qty: c.qty, image: c.image, videoUrl: c.videoUrl || "" })),
        payment_method: payMethod || "",
        goods_total: goodsTotal,
        order_total: orderTotal,
      };

      // 1. Сохраняем заказ в нашу БД
      const res = await fetch(`${STORE_API}?action=create_order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка оформления заказа");
      const oid = data.order_id as string;
      setOrderId(oid);

      // 2. Создаём заказ в СДЭК (не блокируем при ошибке)
      try {
        const cdekRes = await fetch(`${CDEK_API}?action=create_order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: oid,
            ...orderPayload,
            weight_g: totalWeight,
            length_cm: 20,
            width_cm: 15,
            height_cm: 10,
          }),
        });
        const cdekData = await cdekRes.json();
        if (cdekData.track_number) {
          setCdekTrack(cdekData.track_number);
        } else if (cdekData.cdek_uuid) {
          setCdekTrack(cdekData.cdek_uuid);
        }
      } catch {
        // СДЭК недоступен — заказ всё равно создан в нашей системе
      }

      return oid;
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Ошибка оформления заказа");
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    if (payMethod === "sbp") {
      const oid = await createOrder();
      if (oid) setShowSbp(true);
    } else if (payMethod === "card") {
      const oid = await createOrder();
      if (oid) setOrderDone(true);
    }
  };

  if (orderDone) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
          <Icon name="PackageCheck" size={42} className="text-green-400" />
        </div>
        <h2 className="font-oswald text-2xl font-semibold text-foreground mb-1">Заказ оформлен!</h2>
        {orderId && (
          <p className="text-xs text-muted-foreground mb-4">№ {orderId}</p>
        )}

        {cdekTrack ? (
          <div className="bg-card border border-border rounded-2xl p-5 mb-4 text-left">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="Truck" size={18} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">Информация о доставке</span>
            </div>
            <div className="bg-secondary rounded-xl px-4 py-3 mb-3">
              <p className="text-xs text-muted-foreground mb-0.5">Трек-номер</p>
              <p className="font-oswald text-xl font-semibold text-foreground tracking-widest">{cdekTrack}</p>
            </div>
            <a
              href={`https://apiship.ru/tracking/${cdekTrack}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-primary/10 text-primary font-semibold py-2.5 rounded-xl hover:bg-primary/20 transition-colors text-sm"
            >
              <Icon name="ExternalLink" size={15} />
              Отследить посылку
            </a>
          </div>
        ) : (
          <div className="bg-secondary rounded-xl px-4 py-3 mb-4 text-sm text-muted-foreground">
            <Icon name="Clock" size={14} className="inline mr-1.5 mb-0.5" />
            Трек-номер появится в течение нескольких минут
          </div>
        )}

        <p className="text-muted-foreground text-sm">
          Ожидайте SMS или email с уведомлением о передаче посылки в службу доставки.
        </p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Icon name="ShoppingCart" size={56} className="mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="font-oswald text-2xl font-semibold text-foreground mb-2">Корзина пуста</h2>
        <p className="text-muted-foreground text-sm">Добавь товары из каталога или прямо из эфира</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide mb-6">
        Корзина <span className="text-muted-foreground font-normal text-lg">({cart.length})</span>
      </h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Левая колонка: товары + контакты + доставка */}
        <div className="flex-1 space-y-4">

          {/* Доставка — вверху */}
          <div className="bg-card border border-border rounded-xl p-4">
            <CdekDelivery
              weightGrams={totalWeight}
              fromCityCode={fromCityCode}
              sellerId={sellerIdForDelivery}
              savedCity={user?.city || ""}
              onSelect={(tariff, city, pvzCode, pvzAddress) => {
                setDelivery({ tariff, city });
                setCdekPvzCode(pvzCode);
                setDeliveryType(tariff?.delivery_to === "pvz" ? "cdek_pvz" : "cdek_courier");
                if (pvzAddress) setDeliveryAddress(pvzAddress);
                if (city && user) {
                  const cityLabel = `${city.city}${city.region ? ", " + city.region : ""}`;
                  updateUser({ city: cityLabel });
                }
              }}
            />
          </div>

          {/* Баннер оптового минимума */}
          {(() => {
            const WHOLESALE_MIN = 5000;
            const wholesaleTotal = cart.reduce((s, c) => {
              const wp = c.wholesalePrice;
              return s + (wp != null && wp > 0 ? wp : c.price) * c.qty;
            }, 0);
            const remaining = WHOLESALE_MIN - wholesaleTotal;
            const pct = Math.min(100, Math.round((wholesaleTotal / WHOLESALE_MIN) * 100));
            const reached = remaining <= 0;
            return (
              <div className={`rounded-xl border px-4 py-3 ${reached ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Icon name="Layers" size={14} className={reached ? "text-primary" : "text-muted-foreground"} />
                    <span className={`text-xs font-semibold ${reached ? "text-primary" : "text-foreground"}`}>
                      {reached ? "Оптовый минимум достигнут!" : `До оптового заказа осталось ${remaining.toLocaleString("ru")} ₽`}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">{pct}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${reached ? "bg-primary" : "bg-primary/50"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {!reached && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Минимальная сумма оптового заказа — {WHOLESALE_MIN.toLocaleString("ru")} ₽
                  </p>
                )}
              </div>
            );
          })()}

          {/* Выбрать все */}
          <div className="flex items-center gap-3 px-1">
            <button onClick={toggleAll} className="flex items-center gap-2 group">
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                selectedIds.size === cart.length ? "bg-primary border-primary" : selectedIds.size > 0 ? "border-primary bg-primary/20" : "border-muted-foreground"
              }`}>
                {selectedIds.size === cart.length && <Icon name="Check" size={11} className="text-white" />}
                {selectedIds.size > 0 && selectedIds.size < cart.length && <div className="w-2 h-0.5 bg-primary rounded-full" />}
              </span>
              <span className="text-sm text-foreground font-medium">Выбрать все</span>
            </button>
            {selectedIds.size > 0 && selectedIds.size < cart.length && (
              <span className="text-xs text-muted-foreground">({selectedIds.size} из {cart.length})</span>
            )}
          </div>

          {/* Товары сгруппированы по продавцам */}
          {(() => {
            const groups: { sellerId: string; sellerName: string; items: CartItem[] }[] = [];
            cart.forEach(item => {
              const sid = item.sellerId || "__unknown__";
              const sname = item.sellerName || "Продавец";
              const existing = groups.find(g => g.sellerId === sid);
              if (existing) existing.items.push(item);
              else groups.push({ sellerId: sid, sellerName: sname, items: [item] });
            });
            return (
              <div className="space-y-4">
                {groups.map(group => {
                  const allSellerSelected = group.items.every(i => selectedIds.has(i.id));
                  const someSellerSelected = group.items.some(i => selectedIds.has(i.id));
                  const selectedGroupTotal = group.items
                    .filter(i => selectedIds.has(i.id))
                    .reduce((s, c) => s + getItemPrice(c, mode) * c.qty, 0);
                  return (
                    <div key={group.sellerId} className="bg-card border border-border rounded-xl overflow-hidden">
                      {/* Шапка продавца */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/40">
                        <button onClick={() => toggleSeller(group.items)} className="flex-shrink-0">
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            allSellerSelected ? "bg-primary border-primary" : someSellerSelected ? "border-primary bg-primary/20" : "border-muted-foreground"
                          }`}>
                            {allSellerSelected && <Icon name="Check" size={11} className="text-white" />}
                            {!allSellerSelected && someSellerSelected && <div className="w-2 h-0.5 bg-primary rounded-full" />}
                          </span>
                        </button>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Icon name="Store" size={13} className="text-primary flex-shrink-0" />
                          <span className="text-sm font-semibold text-foreground truncate">{group.sellerName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium flex-shrink-0">
                          {selectedGroupTotal.toLocaleString("ru")} ₽
                        </span>
                      </div>
                      {/* Товары продавца */}
                      <div className="divide-y divide-border">
                        {group.items.map(item => {
                          const isSelected = selectedIds.has(item.id);
                          return (
                            <div key={item.id} className={`p-4 flex gap-3 items-center transition-all ${isSelected ? "" : "opacity-40"}`}>
                              {/* Чекбокс товара */}
                              <button onClick={() => toggleItem(item.id)} className="flex-shrink-0">
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
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground line-clamp-2">{item.name}</p>
                                <p className="font-oswald text-base font-semibold text-foreground mt-0.5">
                                  {getItemPrice(item, mode).toLocaleString("ru")} ₽
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button onClick={() => updateQty(item.id, item.qty - 1)}
                                  className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors">
                                  <Icon name="Minus" size={13} />
                                </button>
                                <span className="w-6 text-center text-sm font-medium text-foreground">{item.qty}</span>
                                <button onClick={() => updateQty(item.id, item.qty + 1)}
                                  className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors">
                                  <Icon name="Plus" size={13} />
                                </button>
                                <button onClick={() => removeFromCart(item.id)}
                                  className="w-7 h-7 rounded-lg ml-1 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                                  <Icon name="Trash2" size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Итого по продавцу */}
                      {(() => {
                        const sellerGoods = group.items
                          .filter(i => selectedIds.has(i.id))
                          .reduce((s, c) => s + getItemPrice(c, mode) * c.qty, 0);
                        const sid = group.sellerId;
                        const deliveryCostForSeller = sellerDeliveryCosts[sid] ?? null;
                        const isLoadingDelivery = sellerDeliveryLoading[sid] ?? false;
                        return (
                          <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
                            <div className="px-4 py-3">
                              <p className="text-[10px] text-muted-foreground mb-0.5">Товары</p>
                              <p className="font-oswald text-sm font-semibold text-foreground">
                                {sellerGoods.toLocaleString("ru")} ₽
                              </p>
                            </div>
                            <div className="px-4 py-3">
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
                                    : <span className="text-muted-foreground font-normal text-xs">{delivery.city ? "нет тарифов" : "укажите город"}</span>}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Контактные данные */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icon name="User" size={15} className="text-muted-foreground" />
              Контактные данные
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Имя *</label>
                <input value={buyerName} onChange={e => setBuyerName(e.target.value)}
                  placeholder="Иван Иванов"
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Телефон *</label>
                <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)}
                  placeholder="+7 900 000-00-00"
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
          </div>

        </div>

        {/* Правая колонка: расчёт + оплата */}
        <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
          {/* Способ оплаты */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Способ оплаты</p>
            {[
              { id: "sbp" as PaymentMethod, icon: "⚡", label: "СБП", sub: "Через приложение банка" },
              { id: "card" as PaymentMethod, icon: "💳", label: "Карта", sub: "Visa, MasterCard, Мир" },
            ].map(m => (
              <button key={m.id} onClick={() => setPayMethod(m.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                  payMethod === m.id ? "border-primary bg-primary/8" : "border-border bg-secondary hover:border-border/60"
                }`}>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  payMethod === m.id ? "border-primary" : "border-muted-foreground"
                }`}>
                  {payMethod === m.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <span className="text-lg leading-none">{m.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Итого */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Товары ({selectedCart.reduce((s, c) => s + c.qty, 0)} шт.)</span>
                <span>{goodsTotal.toLocaleString("ru")} ₽</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Доставка</span>
                {deliveryCost === null ? (
                  <span className="text-muted-foreground italic text-xs">не выбрана</span>
                ) : (
                  <span className="text-foreground">{deliveryCost.toLocaleString("ru")} ₽</span>
                )}
              </div>
              {delivery.city && delivery.tariff && (
                <div className="bg-secondary rounded-lg px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Icon name="MapPin" size={11} />
                    {delivery.city.city}{delivery.city.region ? `, ${delivery.city.region}` : ""}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon name={delivery.tariff.delivery_to === "pvz" ? "Store" : "Truck"} size={11} />
                    {delivery.tariff.delivery_to === "pvz" ? "Самовывоз из пункта" : "Курьер до двери"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon name="Clock" size={11} />
                    {delivery.tariff.days_min === delivery.tariff.days_max
                      ? `${delivery.tariff.days_min} дн.`
                      : `${delivery.tariff.days_min}–${delivery.tariff.days_max} дн.`}
                  </div>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span className="text-foreground">Итого</span>
                <span className="font-oswald text-lg text-foreground">{orderTotal.toLocaleString("ru")} ₽</span>
              </div>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg mb-3">
                <Icon name="AlertCircle" size={13} />
                {submitError}
              </div>
            )}

            {showSbp ? (
              <SbpPayment
                amount={orderTotal}
                description={`Заказ — ${cart.length} товар${cart.length > 1 ? "а" : ""}`}
                onSuccess={() => setOrderDone(true)}
                onCancel={() => setShowSbp(false)}
              />
            ) : (
              <>
                <button
                  disabled={!canCheckout || submitting}
                  onClick={handleCheckout}
                  className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : payMethod === "sbp" ? (
                    <><span>⚡</span> Оплатить через СБП</>
                  ) : payMethod === "card" ? (
                    <><Icon name="CreditCard" size={18} /> Оплатить картой</>
                  ) : (
                    <><Icon name="ShoppingBag" size={18} /> Оформить заказ</>
                  )}
                </button>

                {!canCheckout && !submitting && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {!contactFilled
                      ? "Заполните контактные данные"
                      : deliveryCost === null
                      ? "Выберите город и способ доставки"
                      : "Выберите способ оплаты"}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}