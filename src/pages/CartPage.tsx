import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import type { CartItem } from "@/App";
import CdekDelivery from "@/components/CdekDelivery";
import { useAuth } from "@/context/AuthContext";
import { usePriceMode } from "@/context/PriceModeContext";
import CartSellerGroup, { isSellerWholesaleReached, getEffectiveItemPrice } from "./cart/CartSellerGroup";
import CartOrderSummary from "./cart/CartOrderSummary";
import CartOrderDone from "./cart/CartOrderDone";

const STORE_API   = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const CDEK_API    = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";
const PAYMENT_API = "https://functions.poehali.dev/1c026af5-a39b-454b-96bb-cc77b21ee685";

interface CartPageProps {
  cart: CartItem[];
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
}

interface SelectedDelivery {
  tariff: { code: string; name: string; price: number; days_min: number; days_max: number; provider?: string; delivery_to?: "pvz" | "courier" } | null;
  city: { code: string; city: string; region: string; guid?: string } | null;
}

type DeliveryType  = "cdek_pvz" | "cdek_courier";

function getItemPrice(item: CartItem, mode: "retail" | "wholesale"): number {
  const hasWholesale = item.wholesalePrice != null && item.wholesalePrice > 0;
  if (!hasWholesale) return item.price;
  if (mode === "wholesale") return item.wholesalePrice!;
  return Math.round(item.wholesalePrice! * (1 + (item.retailMarkupPct ?? 0) / 100));
}

export default function CartPage({ cart, removeFromCart, updateQty }: CartPageProps) {
  const { user, updateUser } = useAuth();
  const { mode } = usePriceMode();

  // ── Выбор товаров ─────────────────────────────────────────────────────────
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

  // ── Доставка ──────────────────────────────────────────────────────────────
  const [delivery, setDelivery] = useState<SelectedDelivery>({ tariff: null, city: null });
  const [sellerDeliveryCosts, setSellerDeliveryCosts]     = useState<Record<string, number | null>>({});
  const [sellerDeliveryLoading, setSellerDeliveryLoading] = useState<Record<string, boolean>>({});
  const calcTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const recalcSellerDelivery = useCallback((sellerId: string, fromCityCode: string, weightG: number, toCityCode: string, toCityGuid?: string) => {
    if (!toCityCode) return;
    if (calcTimers.current[sellerId]) clearTimeout(calcTimers.current[sellerId]);
    setSellerDeliveryLoading(prev => ({ ...prev, [sellerId]: true }));
    calcTimers.current[sellerId] = setTimeout(async () => {
      try {
        const guidParam   = toCityGuid    ? `&city_guid=${toCityGuid}` : "";
        const fromParam   = fromCityCode  ? `&from_city_code=${encodeURIComponent(fromCityCode)}` : "";
        const sellerParam = sellerId      ? `&seller_id=${sellerId}` : "";
        const res  = await fetch(`${CDEK_API}?action=calc&city_code=${encodeURIComponent(toCityCode)}&weight=${weightG}${guidParam}${fromParam}${sellerParam}`);
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
  }, []);

  const [deliveryType, setDeliveryType]   = useState<DeliveryType>("cdek_pvz");
  const [cdekPvzCode, setCdekPvzCode]     = useState<string | undefined>(undefined);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const cartQtyKey = cart.map(c => `${c.id}:${c.qty}:${selectedIds.has(c.id) ? 1 : 0}`).join(",");
  useEffect(() => {
    if (!delivery.city) return;
    const groups: Record<string, { fromCityCode: string; sellerId: string; weight: number }> = {};
    cart.filter(item => selectedIds.has(item.id)).forEach(item => {
      const sid = item.sellerId || "__unknown__";
      if (!groups[sid]) groups[sid] = { fromCityCode: item.fromCityCode ?? "", sellerId: sid, weight: 0 };
      groups[sid].weight += item.qty * (item.weightG ?? 300);
    });
    Object.values(groups).forEach(g => {
      recalcSellerDelivery(g.sellerId, g.fromCityCode, g.weight, delivery.city!.code, delivery.city!.guid);
    });
    const activeSellers = new Set(Object.keys(groups));
    setSellerDeliveryCosts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(sid => { if (!activeSellers.has(sid)) delete next[sid]; });
      return next;
    });
  }, [delivery.city, cartQtyKey, recalcSellerDelivery]);

  // ── Итоги ─────────────────────────────────────────────────────────────────
  const goodsTotal = (() => {
    const byseller: Record<string, CartItem[]> = {};
    selectedCart.forEach(c => {
      const sid = c.sellerId || "__unknown__";
      if (!byseller[sid]) byseller[sid] = [];
      byseller[sid].push(c);
    });
    return Object.entries(byseller).reduce((total, [, items]) => {
      const wr = isSellerWholesaleReached(items);
      return total + items.reduce((s, c) => s + getEffectiveItemPrice(c, wr) * c.qty, 0);
    }, 0);
  })();

  const selectedSellerIds = new Set(selectedCart.map(c => c.sellerId || "__unknown__"));
  const sellerDeliveryTotal = Object.entries(sellerDeliveryCosts)
    .filter(([sid]) => selectedSellerIds.has(sid))
    .reduce<number>((s, [, v]) => s + (v ?? 0), 0);
  const anySellerLoading = Object.entries(sellerDeliveryLoading)
    .filter(([sid]) => selectedSellerIds.has(sid))
    .some(([, v]) => v);
  const deliveryCost = delivery.city
    ? (anySellerLoading ? null : (sellerDeliveryTotal > 0 ? sellerDeliveryTotal : null))
    : null;
  const orderTotal   = goodsTotal + (deliveryCost ?? 0);
  const totalWeight  = selectedCart.reduce((s, c) => s + c.qty * (c.weightG ?? 300), 0);
  const fromCityCode = (selectedCart[0] ?? cart[0])?.fromCityCode ?? "";
  const sellerIdForDelivery = cart[0]?.sellerId ?? "";

  // ── Контакты и оплата ─────────────────────────────────────────────────────
  const [buyerName,  setBuyerName]  = useState(user?.name  || "");
  const [buyerPhone, setBuyerPhone] = useState(() => {
    const raw = user?.phone || "";
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const norm = digits.startsWith("8") ? "7" + digits.slice(1) : digits.startsWith("7") ? digits : "7" + digits;
    const d = norm.slice(0, 11);
    let fmt = "+7";
    if (d.length > 1) fmt += " (" + d.slice(1, 4);
    if (d.length >= 4) fmt += ") " + d.slice(4, 7);
    if (d.length >= 7) fmt += "-" + d.slice(7, 9);
    if (d.length >= 9) fmt += "-" + d.slice(9, 11);
    return fmt;
  });
  const [buyerEmail, setBuyerEmail] = useState(user?.email || "");
  const [orderDone,  setOrderDone]  = useState(false);
  const [orderId,    setOrderId]    = useState<string | null>(null);
  const [cdekTrack,  setCdekTrack]  = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const contactFilled = buyerName.trim() && buyerPhone.trim();

  // ── Оформление заказа ─────────────────────────────────────────────────────
  const createOrder = async (): Promise<string | null> => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const orderPayload = {
        buyer_id:             user?.id || "",
        buyer_name:           buyerName.trim(),
        buyer_phone:          buyerPhone.trim(),
        buyer_email:          buyerEmail.trim(),
        delivery_type:        deliveryType,
        delivery_city_code:   delivery.city?.code,
        delivery_city_name:   delivery.city ? `${delivery.city.city}${delivery.city.region ? ", " + delivery.city.region : ""}` : "",
        delivery_address:     deliveryAddress.trim(),
        delivery_tariff_code: delivery.tariff?.code,
        delivery_tariff_name: delivery.tariff?.name || "",
        delivery_cost:        deliveryCost || 0,
        cdek_pvz_code:        cdekPvzCode || "",
        items: selectedCart.map(c => ({ id: c.id, name: c.name, price: getItemPrice(c, mode), qty: c.qty, image: c.image, videoUrl: c.videoUrl || "", sellerId: c.sellerId || "" })),
        payment_method: "",
        goods_total:    goodsTotal,
        order_total:    orderTotal,
      };

      const res  = await fetch(`${STORE_API}?action=create_order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка оформления заказа");
      const oid = data.order_id as string;
      setOrderId(oid);

      try {
        const cdekRes  = await fetch(`${CDEK_API}?action=create_order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: oid, ...orderPayload, weight_g: totalWeight, length_cm: 20, width_cm: 15, height_cm: 10 }),
        });
        const cdekData = await cdekRes.json();
        if (cdekData.track_number)  setCdekTrack(cdekData.track_number);
        else if (cdekData.cdek_uuid) setCdekTrack(cdekData.cdek_uuid);
      } catch { /* СДЭК недоступен — заказ всё равно создан */ }

      // Сохраняем телефон в профиль, если его ещё нет
      if (user && !user.phone && buyerPhone.trim()) {
        updateUser({ phone: buyerPhone.trim() }).catch(() => {});
      }

      return oid;
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Ошибка оформления заказа");
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setValidationError(null);
    if (!contactFilled) {
      setValidationError(!buyerName.trim() ? "Введите имя получателя" : "Введите номер телефона");
      return;
    }
    if (deliveryCost === null) {
      setValidationError("Выберите город и способ доставки");
      return;
    }
    const oid = await createOrder();
    if (!oid) return;

    // Получаем seller_account первого продавца для Мультирасчётов
    const sellerIds = [...new Set(selectedCart.map(c => c.sellerId).filter(Boolean))];
    const sellerAccount = sellerIds.length === 1 ? sellerIds[0] : "";

    try {
      const payRes = await fetch(PAYMENT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: oid,
          amount: orderTotal,
          description: `Заказ ${oid}`,
          return_url: `${window.location.origin}/order-success?order_id=${oid}&payment_id={PaymentId}`,
          email: buyerEmail.trim(),
          phone: buyerPhone.replace(/\D/g, "").replace(/^8/, "7"),
          delivery_cost: deliveryCost || 0,
          seller_account: sellerAccount,
          platform_fee_pct: 10,
          items: selectedCart.map(c => ({
            name: c.name,
            price: getItemPrice(c, mode),
            qty: c.qty,
          })),
        }),
      });
      const payData = await payRes.json();
      if (payData.payment_url) {
        window.location.href = payData.payment_url;
      } else {
        const errMsg = payData.error || "Не удалось создать платёж";
        setSubmitError(errMsg);
        setSubmitting(false);
      }
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Ошибка при создании платежа");
      setSubmitting(false);
    }
  };

  // ── Guard screens ─────────────────────────────────────────────────────────
  if (orderDone) return <CartOrderDone orderId={orderId} cdekTrack={cdekTrack} />;

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Icon name="ShoppingCart" size={56} className="mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="font-oswald text-2xl font-semibold text-foreground mb-2">Корзина пуста</h2>
        <p className="text-muted-foreground text-sm">Добавь товары из каталога или прямо из эфира</p>
      </div>
    );
  }

  // ── Группы продавцов ──────────────────────────────────────────────────────
  const groups: { sellerId: string; sellerName: string; items: CartItem[] }[] = [];
  cart.forEach(item => {
    const sid   = item.sellerId   || "__unknown__";
    const sname = item.sellerName || "Продавец";
    const existing = groups.find(g => g.sellerId === sid);
    if (existing) existing.items.push(item);
    else groups.push({ sellerId: sid, sellerName: sname, items: [item] });
  });

  const stickyLabel = submitting ? null : "Оформить заказ";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28">
      <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide mb-6">
        Корзина <span className="text-muted-foreground font-normal text-lg">({cart.length})</span>
      </h1>

      {/* Sticky-кнопка снизу */}
      {!orderDone && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto space-y-2">
            {validationError && (
              <div
                className="flex items-center gap-2 bg-destructive text-white text-sm font-medium px-4 py-2.5 rounded-2xl shadow-lg"
                onClick={() => setValidationError(null)}
              >
                <Icon name="AlertCircle" size={15} className="flex-shrink-0" />
                {validationError}
              </div>
            )}
            <button
              onClick={handleCheckout}
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-lg hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[10px] text-primary-foreground/70 leading-none mb-0.5">
                  {deliveryCost !== null ? `доставка ${deliveryCost.toLocaleString("ru")} ₽` : "доставка не выбрана"}
                </span>
                <span className="font-oswald text-base font-bold leading-none">
                  {orderTotal.toLocaleString("ru")} ₽
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 pl-3">
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Icon name="ShoppingBag" size={15} />
                    <span className="font-semibold text-sm">{stickyLabel}</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Левая колонка */}
        <div className="flex-1 space-y-4">

          {/* Доставка */}
          <div className="bg-card border border-border rounded-xl p-4">
            <CdekDelivery
              weightGrams={totalWeight}
              fromCityCode={fromCityCode}
              sellerId={sellerIdForDelivery}
              savedCity={user?.city || ""}
              savedPvz={user?.savedPvz}
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
              onClearCity={() => { if (user) updateUser({ city: "", savedPvz: null }); }}
              onClearPvz={()  => { if (user) updateUser({ savedPvz: null }); }}
              onSavePvz={(pvz) => { if (user) updateUser({ savedPvz: pvz }); }}
            />
          </div>

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

          {/* Товары по продавцам */}
          <div className="space-y-4">
            {groups.map(group => (
              <CartSellerGroup
                key={group.sellerId}
                sellerId={group.sellerId}
                sellerName={group.sellerName}
                items={group.items}
                selectedIds={selectedIds}
                sellerDeliveryCosts={sellerDeliveryCosts}
                sellerDeliveryLoading={sellerDeliveryLoading}
                hasCitySelected={!!delivery.city}
                onToggleSeller={toggleSeller}
                onToggleItem={toggleItem}
                onUpdateQty={updateQty}
                onRemove={removeFromCart}
              />
            ))}
          </div>

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
                  onBlur={e => { if (e.target.value.trim().length > 0 && e.target.value.trim().length < 3) setBuyerName(e.target.value.trim() + " (получатель)"); }}
                  placeholder="Иван Иванов"
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Телефон *</label>
                <input
                  value={buyerPhone}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, "");
                    if (digits.length === 0) { setBuyerPhone(""); return; }
                    const normalized = digits.startsWith("8") ? "7" + digits.slice(1) : digits.startsWith("7") ? digits : "7" + digits;
                    const d = normalized.slice(0, 11);
                    let formatted = "+7";
                    if (d.length > 1) formatted += " (" + d.slice(1, 4);
                    if (d.length >= 4) formatted += ") " + d.slice(4, 7);
                    if (d.length >= 7) formatted += "-" + d.slice(7, 9);
                    if (d.length >= 9) formatted += "-" + d.slice(9, 11);
                    setBuyerPhone(formatted);
                  }}
                  placeholder="+7 (900) 000-00-00"
                  inputMode="tel"
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

        {/* Правая колонка */}
        <CartOrderSummary
          cartLength={cart.length}
          selectedCount={selectedCart.reduce((s, c) => s + c.qty, 0)}
          goodsTotal={goodsTotal}
          deliveryCost={deliveryCost}
          orderTotal={orderTotal}
          delivery={delivery}
          contactFilled={contactFilled}
          submitting={submitting}
          submitError={submitError}
          onCheckout={handleCheckout}
        />
      </div>
    </div>
  );
}