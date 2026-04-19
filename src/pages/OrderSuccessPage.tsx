import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";
import type { Page } from "@/App";

const PAYMENT_STATUS_API = "https://functions.poehali.dev/3a9c558b-1be6-4879-8ab4-4ecffee2ce4a";

interface OrderSuccessPageProps {
  setPage: (p: Page) => void;
  clearCart: () => void;
}

export default function OrderSuccessPage({ setPage, clearCart }: OrderSuccessPageProps) {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order_id") || "";
  const paymentId = params.get("payment_id") || "";

  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "failed">("loading");

  useEffect(() => {
    clearCart();

    const check = async () => {
      if (!paymentId && !orderId) {
        setStatus("paid");
        return;
      }
      try {
        const res = await fetch(
          `${PAYMENT_STATUS_API}?payment_id=${paymentId}&order_id=${orderId}`
        );
        const data = await res.json();
        if (data.paid) {
          setStatus("paid");
        } else if (data.status === "CANCELED" || data.status === "REJECTED") {
          setStatus("failed");
        } else {
          setStatus("pending");
        }
      } catch {
        setStatus("paid");
      }
    };

    check();

    // Очищаем URL от параметров
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      {status === "loading" && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm">Проверяем статус оплаты…</p>
        </div>
      )}

      {status === "paid" && (
        <div className="animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
            <Icon name="PackageCheck" size={42} className="text-green-400" />
          </div>
          <h2 className="font-oswald text-2xl font-semibold text-foreground mb-2">Оплата прошла!</h2>
          {orderId && (
            <p className="text-xs text-muted-foreground mb-4">Заказ № {orderId}</p>
          )}
          <p className="text-muted-foreground text-sm mb-6">
            Продавец получил уведомление и начнёт собирать заказ. Трек-номер придёт в SMS или email.
          </p>
          <button
            onClick={() => setPage("catalog")}
            className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            Продолжить покупки
          </button>
        </div>
      )}

      {status === "pending" && (
        <div className="animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto mb-5">
            <Icon name="Clock" size={42} className="text-yellow-400" />
          </div>
          <h2 className="font-oswald text-2xl font-semibold text-foreground mb-2">Платёж обрабатывается</h2>
          {orderId && (
            <p className="text-xs text-muted-foreground mb-4">Заказ № {orderId}</p>
          )}
          <p className="text-muted-foreground text-sm mb-6">
            Банк ещё обрабатывает платёж. Заказ появится в личном кабинете как только оплата подтвердится.
          </p>
          <button
            onClick={() => setPage("profile")}
            className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            Мои заказы
          </button>
        </div>
      )}

      {status === "failed" && (
        <div className="animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-5">
            <Icon name="XCircle" size={42} className="text-red-400" />
          </div>
          <h2 className="font-oswald text-2xl font-semibold text-foreground mb-2">Оплата не прошла</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Платёж был отклонён или отменён. Попробуй оформить заказ снова.
          </p>
          <button
            onClick={() => setPage("cart")}
            className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            Вернуться в корзину
          </button>
        </div>
      )}
    </div>
  );
}
