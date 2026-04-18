import Icon from "@/components/ui/icon";
import SbpPayment from "@/components/SbpPayment";

type PaymentMethod = "sbp" | "card" | null;

interface SelectedDelivery {
  tariff: { code: string; name: string; price: number; days_min: number; days_max: number; provider?: string; delivery_to?: "pvz" | "courier" } | null;
  city: { code: string; city: string; region: string; guid?: string } | null;
}

interface CartOrderSummaryProps {
  cartLength: number;
  selectedCount: number;
  goodsTotal: number;
  deliveryCost: number | null;
  orderTotal: number;
  delivery: SelectedDelivery;
  payMethod: PaymentMethod;
  canCheckout: boolean;
  contactFilled: boolean | string;
  submitting: boolean;
  submitError: string | null;
  showSbp: boolean;
  onSetPayMethod: (m: PaymentMethod) => void;
  onCheckout: () => void;
  onSbpSuccess: () => void;
  onSbpCancel: () => void;
}

export default function CartOrderSummary({
  cartLength,
  selectedCount,
  goodsTotal,
  deliveryCost,
  orderTotal,
  delivery,
  payMethod,
  canCheckout,
  contactFilled,
  submitting,
  submitError,
  showSbp,
  onSetPayMethod,
  onCheckout,
  onSbpSuccess,
  onSbpCancel,
}: CartOrderSummaryProps) {
  return (
    <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
      {/* Способ оплаты */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Способ оплаты</p>
        {([
          { id: "sbp" as PaymentMethod, icon: "⚡", label: "СБП", sub: "Через приложение банка" },
          { id: "card" as PaymentMethod, icon: "💳", label: "Карта", sub: "Visa, MasterCard, Мир" },
        ] as const).map(m => (
          <button key={m.id} onClick={() => onSetPayMethod(m.id)}
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

      {submitError && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg">
          <Icon name="AlertCircle" size={13} />
          {submitError}
        </div>
      )}

      {showSbp && (
        <div className="bg-card border border-border rounded-xl p-4">
          <SbpPayment
            amount={orderTotal}
            description={`Заказ — ${cartLength} товар${cartLength > 1 ? "а" : ""}`}
            onSuccess={onSbpSuccess}
            onCancel={onSbpCancel}
          />
        </div>
      )}
    </div>
  );
}