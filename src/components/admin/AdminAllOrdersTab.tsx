import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

const LEGAL_TYPE_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  individual:    { label: "Физлицо",    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",   icon: "User" },
  self_employed: { label: "Самозанятый", color: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: "Briefcase" },
  ip:            { label: "ИП",          color: "bg-amber-500/10 text-amber-600 border-amber-500/20",   icon: "Building" },
  ooo:           { label: "ООО / ЗАО",  color: "bg-green-500/10 text-green-600 border-green-500/20",   icon: "Building2" },
};

const PAYOUT_LABEL: Record<string, string> = {
  individual:    "Карта",
  self_employed: "Карта",
  ip:            "Расч. счёт",
  ooo:           "Расч. счёт",
};

interface Requisites {
  payoutMethod?: string;
  cardNumber?: string;
  bankAccount?: string;
  bik?: string;
  corrAccount?: string;
  bankName?: string;
  legalName?: string;
  inn?: string;
}

interface Order {
  id: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  goodsTotal: number;
  orderTotal: number;
  deliveryCost: number;
  deliveryCityName: string;
  status: string;
  sellerStatus: string;
  sellerId: string;
  sellerLegalType: string;
  sellerRequisites: Requisites;
  paymentMethod: string;
  createdAt: string;
  items: { name: string; price: number; qty?: number; quantity?: number }[];
}

function maskCard(n: string) {
  if (!n) return "—";
  const d = n.replace(/\D/g, "");
  if (d.length < 4) return n;
  return "**** **** **** " + d.slice(-4);
}

function maskAccount(n: string) {
  if (!n) return "—";
  return n.slice(0, 6) + "..." + n.slice(-4);
}

export default function AdminAllOrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "individual" | "self_employed" | "ip" | "ooo">("all");

  useEffect(() => {
    setLoading(true);
    fetch(`${STORE_API}?action=get_orders`)
      .then(r => r.json())
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all"
    ? orders
    : orders.filter(o => o.sellerLegalType === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-oswald text-xl font-semibold text-foreground">Все заказы</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Реквизиты продавца по типу</p>
        </div>
        <span className="text-xs bg-secondary text-muted-foreground px-3 py-1 rounded-full font-medium">
          {filtered.length} заказов
        </span>
      </div>

      {/* Фильтр по типу */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {(["all", "individual", "self_employed", "ip", "ooo"] as const).map(key => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition-all ${
              filter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {key === "all" ? "Все" : LEGAL_TYPE_LABEL[key].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Заказов нет</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const lt = order.sellerLegalType;
            const typeInfo = LEGAL_TYPE_LABEL[lt];
            const req = order.sellerRequisites || {};
            const isCard = lt === "individual" || lt === "self_employed";
            const isOpen = expanded === order.id;

            return (
              <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Заголовок строки */}
                <button
                  className="w-full text-left px-4 py-3 flex items-center gap-3"
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                >
                  {/* Тип продавца */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shrink-0 ${typeInfo?.color || "bg-secondary text-muted-foreground border-border"}`}>
                    {typeInfo && <Icon name={typeInfo.icon as "User"} size={11} />}
                    {typeInfo?.label || "Не указан"}
                  </div>

                  {/* Номер заказа + дата */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      #{order.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">{order.buyerName} · {order.createdAt}</p>
                  </div>

                  {/* Сумма */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">{order.orderTotal.toLocaleString("ru-RU")} ₽</p>
                    <p className="text-xs text-muted-foreground">{PAYOUT_LABEL[lt] || "—"}</p>
                  </div>

                  <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground shrink-0" />
                </button>

                {/* Развёрнутые детали */}
                {isOpen && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">

                    {/* Реквизиты продавца */}
                    <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Icon name="Landmark" size={13} />
                        Реквизиты продавца
                      </p>
                      {!lt ? (
                        <p className="text-xs text-muted-foreground">Тип продавца не определён</p>
                      ) : isCard ? (
                        <div className="space-y-1">
                          <Row label="Тип" value={typeInfo?.label} />
                          <Row label="Выплата" value="На карту" />
                          <Row label="Номер карты" value={maskCard(req.cardNumber || "")} mono />
                          {req.legalName && <Row label="ФИО" value={req.legalName} />}
                          {req.inn && <Row label="ИНН" value={req.inn} />}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Row label="Тип" value={typeInfo?.label} />
                          <Row label="Выплата" value="На расчётный счёт" />
                          <Row label="Р/счёт" value={maskAccount(req.bankAccount || "")} mono />
                          <Row label="БИК" value={req.bik || "—"} mono />
                          {req.corrAccount && <Row label="К/счёт" value={req.corrAccount} mono />}
                          {req.bankName && <Row label="Банк" value={req.bankName} />}
                          {req.legalName && <Row label="Наименование" value={req.legalName} />}
                          {req.inn && <Row label="ИНН" value={req.inn} />}
                        </div>
                      )}
                    </div>

                    {/* Покупатель */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Icon name="User" size={13} />
                        Покупатель
                      </p>
                      <Row label="Имя" value={order.buyerName} />
                      <Row label="Телефон" value={order.buyerPhone} />
                      <Row label="Email" value={order.buyerEmail} />
                      <Row label="Город" value={order.deliveryCityName} />
                    </div>

                    {/* Товары */}
                    <div>
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                        <Icon name="ShoppingBag" size={13} />
                        Товары
                      </p>
                      <div className="space-y-1">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs text-muted-foreground">
                            <span className="truncate mr-2">{item.name}</span>
                            <span className="shrink-0">{(item.qty || item.quantity || 1)} × {item.price.toLocaleString("ru-RU")} ₽</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Итоги */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">Товары + доставка</span>
                      <span className="text-sm font-bold text-foreground">{order.orderTotal.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-foreground text-right ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}
