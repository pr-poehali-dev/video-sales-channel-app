import { useState } from "react";
import Icon from "@/components/ui/icon";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const ADMIN_KEY = "STRIM_ADMIN_2025";

export default function AdminOrdersTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ deleted: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClear = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${STORE_API}?action=clear_orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_key: ADMIN_KEY }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setResult(data);
      setConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="font-oswald text-xl font-semibold text-foreground mb-1">Управление заказами</h2>
      <p className="text-sm text-muted-foreground mb-6">Опасная зона — действия необратимы</p>

      <div className="bg-card border border-destructive/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon name="Trash2" size={18} className="text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Удалить все заказы</p>
            <p className="text-xs text-muted-foreground mt-0.5">Удалит все заказы покупателей и продавцов из базы данных. Это действие невозможно отменить.</p>
          </div>
        </div>

        {result && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-green-600 text-sm font-medium">
            <Icon name="CircleCheck" size={16} />
            Удалено заказов: {result.deleted}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-destructive text-sm">
            <Icon name="CircleAlert" size={16} />
            {error}
          </div>
        )}

        {!confirm ? (
          <button
            onClick={() => { setConfirm(true); setResult(null); setError(null); }}
            className="w-full bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            Очистить все заказы
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-center text-foreground font-medium">Вы уверены? Все заказы будут удалены навсегда.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(false)}
                className="flex-1 bg-secondary text-foreground font-semibold text-sm py-3 rounded-xl transition-colors hover:bg-secondary/80"
              >
                Отмена
              </button>
              <button
                onClick={handleClear}
                disabled={loading}
                className="flex-1 bg-destructive text-white font-semibold text-sm py-3 rounded-xl transition-colors hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Icon name="Trash2" size={15} />
                )}
                Да, удалить всё
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}