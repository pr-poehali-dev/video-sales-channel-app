import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const CREATE_URL = "https://functions.poehali.dev/1c026af5-a39b-454b-96bb-cc77b21ee685";
const STATUS_URL = "https://functions.poehali.dev/3a9c558b-1be6-4879-8ab4-4ecffee2ce4a";

interface SbpPaymentProps {
  amount: number;
  description: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = "idle" | "creating" | "waiting" | "success" | "error";

export default function SbpPayment({ amount, description, onSuccess, onCancel }: SbpPaymentProps) {
  const [step, setStep] = useState<Step>("idle");
  const [paymentId, setPaymentId] = useState("");
  const [confirmUrl, setConfirmUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => () => stopPolling(), []);

  const startPolling = (pid: string) => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${STATUS_URL}?payment_id=${pid}`);
        const data = await r.json();
        if (data.status === "succeeded" || data.paid) {
          stopPolling();
          setStep("success");
          setTimeout(onSuccess, 1800);
        } else if (data.status === "canceled") {
          stopPolling();
          setErrorMsg("Платёж отменён. Попробуй снова.");
          setStep("error");
        }
      } catch (_) { /* ignore polling errors */ }
    }, 3000);
  };

  const createPayment = async () => {
    setStep("creating");
    setErrorMsg("");
    try {
      const r = await fetch(CREATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          description,
          return_url: window.location.href,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setPaymentId(data.payment_id);
      setConfirmUrl(data.confirmation_url);
      setStep("waiting");
      startPolling(data.payment_id);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Ошибка создания платежа");
      setStep("error");
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (step === "idle") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-4 bg-secondary rounded-xl border border-border">
          <div className="w-10 h-10 rounded-xl bg-[#1DB954]/15 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">⚡</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Система быстрых платежей</p>
            <p className="text-xs text-muted-foreground mt-0.5">Оплата через приложение вашего банка</p>
          </div>
          <span className="font-oswald text-base font-semibold text-foreground">
            {amount.toLocaleString("ru")} ₽
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { icon: "Zap", label: "Мгновенно" },
            { icon: "Shield", label: "Безопасно" },
            { icon: "Smartphone", label: "Любой банк" },
          ].map(f => (
            <div key={f.label} className="bg-secondary rounded-xl p-2.5">
              <Icon name={f.icon} size={16} className="mx-auto mb-1 text-primary" />
              <p className="text-[11px] text-muted-foreground">{f.label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={createPayment}
          className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm"
        >
          <span className="text-base">⚡</span>
          Оплатить через СБП
        </button>
        <button onClick={onCancel} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          Отмена
        </button>
      </div>
    );
  }

  if (step === "creating") {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-foreground">Создаём платёж...</p>
        <p className="text-xs text-muted-foreground mt-1">Это займёт несколько секунд</p>
      </div>
    );
  }

  if (step === "waiting") {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">⚡</span>
          </div>
          <p className="font-medium text-foreground">Ожидаем оплату через СБП</p>
          <p className="text-xs text-muted-foreground mt-1">
            Перейдите в приложение банка и подтвердите платёж
          </p>
        </div>

        <div className="bg-secondary rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Сумма к оплате</p>
            <p className="font-oswald text-xl font-semibold text-foreground">{amount.toLocaleString("ru")} ₽</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Ожидаем</p>
            <p className="font-oswald text-xl text-primary">{fmt(elapsed)}</p>
          </div>
        </div>

        {confirmUrl && (
          <a
            href={confirmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm"
          >
            <Icon name="ExternalLink" size={16} />
            Открыть страницу оплаты
          </a>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
          <div className="w-3 h-3 rounded-full border border-primary border-t-transparent animate-spin flex-shrink-0" />
          Автоматически проверяем статус оплаты...
        </div>

        <button
          onClick={() => { stopPolling(); onCancel(); }}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          Отменить платёж
        </button>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="text-center py-8 animate-scale-in">
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
          <Icon name="CheckCircle" size={36} className="text-green-400" />
        </div>
        <p className="font-oswald text-xl font-semibold text-foreground">Оплата прошла!</p>
        <p className="text-sm text-muted-foreground mt-1">
          {amount.toLocaleString("ru")} ₽ успешно списаны
        </p>
        <p className="text-xs text-muted-foreground mt-3">Заказ передан в обработку</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
            <Icon name="AlertCircle" size={32} className="text-destructive" />
          </div>
          <p className="font-medium text-foreground">Ошибка оплаты</p>
          <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
        </div>
        <button
          onClick={() => setStep("idle")}
          className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm"
        >
          Попробовать снова
        </button>
        <button onClick={onCancel} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
          Отмена
        </button>
      </div>
    );
  }

  return null;
}