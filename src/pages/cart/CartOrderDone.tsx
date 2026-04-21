import Icon from "@/components/ui/icon";

interface CartOrderDoneProps {
  orderId: string | null;
  cdekTrack: string | null;
  paymentMethod?: "card" | "sbp" | "invoice";
  invoiceOrgName?: string;
  invoiceInn?: string;
  invoiceKpp?: string;
  orderTotal?: number;
  buyerEmail?: string;
}

const PLATFORM_BANK = {
  name: "ООО «Стримбазар»",
  inn: "7700000000",
  kpp: "770001001",
  account: "40702810000000000000",
  bank: "АО «Тинькофф Банк»",
  bik: "044525974",
  corrAccount: "30101810145250000974",
};

export default function CartOrderDone({
  orderId,
  cdekTrack,
  paymentMethod,
  invoiceOrgName,
  invoiceInn,
  orderTotal,
  buyerEmail,
}: CartOrderDoneProps) {
  const isInvoice = paymentMethod === "invoice";
  const orderNum = orderId ? orderId.replace("order_", "") : "";

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  if (isInvoice) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 animate-scale-in">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-4">
            <Icon name="FileText" size={42} className="text-blue-500" />
          </div>
          <h2 className="font-oswald text-2xl font-semibold text-foreground mb-1">Заказ оформлен!</h2>
          {orderId && <p className="text-xs text-muted-foreground">№ {orderId}</p>}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 mb-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Icon name="Building2" size={16} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">Реквизиты для оплаты</span>
          </div>

          {[
            { label: "Получатель", value: PLATFORM_BANK.name },
            { label: "ИНН", value: PLATFORM_BANK.inn },
            { label: "КПП", value: PLATFORM_BANK.kpp },
            { label: "Расчётный счёт", value: PLATFORM_BANK.account },
            { label: "Банк", value: PLATFORM_BANK.bank },
            { label: "БИК", value: PLATFORM_BANK.bik },
            { label: "Корр. счёт", value: PLATFORM_BANK.corrAccount },
            ...(orderTotal ? [{ label: "Сумма", value: `${orderTotal.toLocaleString("ru")} ₽` }] : []),
            { label: "Назначение платежа", value: `Оплата заказа № ${orderNum}${invoiceInn ? `, ИНН плательщика ${invoiceInn}` : ""}` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <span className="text-[11px] text-muted-foreground flex-shrink-0 w-36 leading-tight pt-0.5">{label}</span>
              <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                <span className="text-sm text-foreground font-medium text-right leading-tight break-all">{value}</span>
                <button
                  type="button"
                  onClick={() => copyText(value)}
                  className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Icon name="Copy" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {(invoiceOrgName || invoiceInn) && (
          <div className="bg-secondary rounded-xl px-4 py-3 mb-4 space-y-1">
            <p className="text-[11px] text-muted-foreground font-medium">Плательщик</p>
            {invoiceOrgName && <p className="text-sm text-foreground">{invoiceOrgName}</p>}
            {invoiceInn && <p className="text-xs text-muted-foreground">ИНН: {invoiceInn}</p>}
          </div>
        )}

        <div className="flex items-start gap-2 bg-amber-500/10 text-amber-700 text-[11px] px-3 py-2.5 rounded-xl mb-4">
          <Icon name="Clock" size={12} className="flex-shrink-0 mt-0.5" />
          <span>Отгрузка — после поступления оплаты на расчётный счёт. {buyerEmail && `Копия реквизитов отправлена на ${buyerEmail}.`}</span>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          После оплаты продавец получит уведомление и начнёт сборку заказа
        </p>
      </div>
    );
  }

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
