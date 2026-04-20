import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const TRANSACTIONS_API = "https://functions.poehali.dev/428178e1-40e9-4d49-b142-85b62be936a7";

interface Transaction {
  id: string;
  order_id: string;
  seller_id: string;
  full_amount: number;
  seller_amount: number;
  marketplace_fee: number;
  status: string;
  payment_id: string;
  hold_date: string;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

interface Summary {
  total_orders: number;
  total_turnover: number;
  total_fee: number;
  total_seller_payout: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  hold:      { label: "Холд",     color: "text-yellow-600 bg-yellow-500/10" },
  paid:      { label: "Выплачено", color: "text-green-600 bg-green-500/10" },
  cancelled: { label: "Возврат",   color: "text-red-600 bg-red-500/10" },
  refund:    { label: "Возврат",   color: "text-red-600 bg-red-500/10" },
  error:     { label: "Ошибка",    color: "text-destructive bg-destructive/10" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminTransactionsTab() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(firstDay);
  const [toDate, setToDate] = useState(todayStr);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${TRANSACTIONS_API}?action=report&from=${fromDate}&to=${toDate}`);
      const data = await r.json();
      setRows(data.rows || []);
      setSummary(data.summary || null);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const downloadCSV = () => {
    if (!rows.length) return;
    const headers = ["Дата", "Заказ", "Продавец", "Сумма заказа", "Выплата продавцу", "Комиссия (10%)", "Статус", "Payment ID"];
    const lines = [
      headers.join(";"),
      ...rows.map(r => [
        fmtDate(r.created_at),
        r.order_id,
        r.seller_id,
        r.full_amount.toString().replace(".", ","),
        r.seller_amount.toString().replace(".", ","),
        r.marketplace_fee.toString().replace(".", ","),
        STATUS_LABELS[r.status]?.label || r.status,
        r.payment_id,
      ].join(";")),
    ];
    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `комиссии_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Фильтр дат + кнопки */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">С</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">По</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-xl text-sm hover:bg-primary/90 transition-all disabled:opacity-50">
          {loading ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Search" size={15} />}
          Загрузить
        </button>
        <button onClick={downloadCSV} disabled={!rows.length}
          className="flex items-center gap-2 bg-green-600 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:bg-green-700 transition-all disabled:opacity-40">
          <Icon name="Download" size={15} />
          Скачать Excel/CSV
        </button>
      </div>

      {/* Сводка */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Заказов", value: summary.total_orders.toString(), icon: "ShoppingBag", color: "text-primary" },
            { label: "Оборот", value: fmt(summary.total_turnover), icon: "TrendingUp", color: "text-blue-500" },
            { label: "Комиссия (доход ИП)", value: fmt(summary.total_fee), icon: "Percent", color: "text-green-600" },
            { label: "Выплачено продавцам", value: fmt(summary.total_seller_payout), icon: "Wallet", color: "text-purple-500" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon name={s.icon} size={14} className={s.color} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Icon name="FileSearch" size={32} className="mx-auto mb-3 opacity-30" />
          За выбранный период транзакций нет
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Дата</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Заказ</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Сумма</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium text-green-600">Комиссия 10%</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Продавцу 90%</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const st = STATUS_LABELS[row.status] || { label: row.status, color: "text-muted-foreground bg-secondary" };
                  return (
                    <tr key={row.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.created_at)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground max-w-[120px] truncate">{row.order_id}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{fmt(row.full_amount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">{fmt(row.marketplace_fee)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{fmt(row.seller_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {summary && (
                <tfoot>
                  <tr className="bg-green-500/5 border-t-2 border-green-500/20">
                    <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-foreground">ИТОГО за период</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(summary.total_turnover)}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{fmt(summary.total_fee)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-muted-foreground">{fmt(summary.total_seller_payout)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{summary.total_orders} заказов</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}