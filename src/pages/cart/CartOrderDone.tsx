import Icon from "@/components/ui/icon";

interface CartOrderDoneProps {
  orderId: string | null;
  cdekTrack: string | null;
}

export default function CartOrderDone({ orderId, cdekTrack }: CartOrderDoneProps) {
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
