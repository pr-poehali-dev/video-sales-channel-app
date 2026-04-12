import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { CartItem } from "@/App";
import CdekDelivery from "@/components/CdekDelivery";
import SbpPayment from "@/components/SbpPayment";

interface CartPageProps {
  cart: CartItem[];
  removeFromCart: (id: number) => void;
  updateQty: (id: number, qty: number) => void;
}

interface SelectedDelivery {
  tariff: { code: number; name: string; price: number; days_min: number; days_max: number } | null;
  city: { code: number; city: string; region: string } | null;
}

type PaymentMethod = "sbp" | "card" | null;

export default function CartPage({ cart, removeFromCart, updateQty }: CartPageProps) {
  const [delivery, setDelivery] = useState<SelectedDelivery>({ tariff: null, city: null });
  const [payMethod, setPayMethod] = useState<PaymentMethod>(null);
  const [showSbp, setShowSbp] = useState(false);
  const [orderDone, setOrderDone] = useState(false);

  const goodsTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const deliveryCost = delivery.tariff?.price ?? null;
  const orderTotal = goodsTotal + (deliveryCost ?? 0);
  const totalWeight = cart.reduce((s, c) => s + c.qty * 300, 0);
  const canCheckout = deliveryCost !== null && payMethod !== null;

  if (orderDone) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
          <Icon name="PackageCheck" size={42} className="text-green-400" />
        </div>
        <h2 className="font-oswald text-2xl font-semibold text-foreground mb-2">Заказ оформлен!</h2>
        <p className="text-muted-foreground text-sm">Мы уже передали его в обработку. Ожидайте уведомления о доставке.</p>
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
        {/* Items */}
        <div className="flex-1 space-y-3">
          {cart.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-xl p-4 flex gap-4 items-center animate-fade-in">
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-2">{item.name}</p>
                <p className="font-oswald text-base font-semibold text-foreground mt-1">
                  {item.price.toLocaleString("ru")} ₽
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => updateQty(item.id, item.qty - 1)}
                  className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
                >
                  <Icon name="Minus" size={13} />
                </button>
                <span className="w-6 text-center text-sm font-medium text-foreground">{item.qty}</span>
                <button
                  onClick={() => updateQty(item.id, item.qty + 1)}
                  className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
                >
                  <Icon name="Plus" size={13} />
                </button>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="w-7 h-7 rounded-lg ml-1 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Icon name="Trash2" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
          {/* CDEK */}
          <div className="bg-card border border-border rounded-xl p-4">
            <CdekDelivery
              weightGrams={totalWeight}
              onSelect={(tariff, city) => setDelivery({ tariff, city })}
            />
          </div>

          {/* Payment method */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Способ оплаты</p>
            {[
              { id: "sbp" as PaymentMethod, icon: "⚡", label: "СБП", sub: "Оплата через приложение банка" },
              { id: "card" as PaymentMethod, icon: "💳", label: "Карта", sub: "Visa, MasterCard, Мир" },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setPayMethod(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                  payMethod === m.id
                    ? "border-primary bg-primary/8"
                    : "border-border bg-secondary hover:border-border/60"
                }`}
              >
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

          {/* Order total */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Товары ({cart.reduce((s, c) => s + c.qty, 0)} шт.)</span>
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
                <div className="bg-secondary rounded-lg px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon name="MapPin" size={11} />
                    {delivery.city.city}{delivery.city.region ? `, ${delivery.city.region}` : ""}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon name="Clock" size={11} />
                    {delivery.tariff.days_min === delivery.tariff.days_max
                      ? `${delivery.tariff.days_min} дней`
                      : `${delivery.tariff.days_min}–${delivery.tariff.days_max} дней`}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span className="text-foreground">Итого</span>
                <span className="font-oswald text-lg text-foreground">{orderTotal.toLocaleString("ru")} ₽</span>
              </div>
            </div>

            {/* SBP inline flow */}
            {showSbp ? (
              <SbpPayment
                amount={orderTotal}
                description={`Заказ LiveShop — ${cart.length} товара`}
                onSuccess={() => setOrderDone(true)}
                onCancel={() => setShowSbp(false)}
              />
            ) : (
              <>
                <button
                  disabled={!canCheckout}
                  onClick={() => payMethod === "sbp" ? setShowSbp(true) : undefined}
                  className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {payMethod === "sbp" ? (
                    <><span>⚡</span> Оплатить через СБП</>
                  ) : payMethod === "card" ? (
                    <><Icon name="CreditCard" size={18} /> Оплатить картой</>
                  ) : (
                    <><Icon name="CreditCard" size={18} /> Оформить заказ</>
                  )}
                </button>

                {!canCheckout && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {deliveryCost === null
                      ? "Выберите способ доставки"
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