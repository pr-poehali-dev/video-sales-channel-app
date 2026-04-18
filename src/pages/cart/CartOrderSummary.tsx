import Icon from "@/components/ui/icon";

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
  contactFilled: boolean | string;
  submitting: boolean;
  submitError: string | null;
  onCheckout: () => void;
}

export default function CartOrderSummary({
  cartLength,
  selectedCount,
  goodsTotal,
  deliveryCost,
  orderTotal,
  delivery,
  contactFilled,
  submitting,
  submitError,
  onCheckout,
}: CartOrderSummaryProps) {
  return (
    <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
      {submitError && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg">
          <Icon name="AlertCircle" size={13} />
          {submitError}
        </div>
      )}

      <button
        onClick={onCheckout}
        disabled={submitting || !contactFilled || deliveryCost === null}
        className="w-full bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-xl disabled:opacity-40 transition-all hover:opacity-90 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Icon name="ShoppingBag" size={15} />
            Оформить заказ
          </>
        )}
      </button>
    </div>
  );
}
