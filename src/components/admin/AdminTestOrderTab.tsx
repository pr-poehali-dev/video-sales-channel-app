import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  sellerId: string;
  sellerName: string;
  inStock: number;
}

interface OrderItem {
  product: Product;
  qty: number;
}

export default function AdminTestOrderTab() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [buyerName, setBuyerName] = useState(user?.name || "Тест Администратор");
  const [buyerPhone, setBuyerPhone] = useState(user?.phone || "+70000000000");
  const [buyerEmail, setBuyerEmail] = useState(user?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ orderId: string; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${STORE_API}?action=get_products`)
      .then(r => r.json())
      .then(data => {
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sellerName.toLowerCase().includes(search.toLowerCase())
  );

  const addItem = (product: Product) => {
    setItems(prev => {
      const ex = prev.find(i => i.product.id === product.id);
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.product.id !== id));

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) return removeItem(id);
    setItems(prev => prev.map(i => i.product.id === id ? { ...i, qty } : i));
  };

  const goodsTotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);

  const handleSubmit = async () => {
    if (!items.length) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        buyer_id: user?.id || "",
        buyer_name: buyerName.trim() || "Администратор (тест)",
        buyer_phone: buyerPhone.trim() || "+70000000000",
        buyer_email: buyerEmail.trim(),
        delivery_type: "cdek_pvz",
        delivery_city_code: null,
        delivery_city_name: "Тестовый город",
        delivery_address: "",
        delivery_tariff_code: null,
        delivery_tariff_name: "Тестовая доставка",
        delivery_cost: 0,
        cdek_pvz_code: "",
        payment_method: "test",
        goods_total: goodsTotal,
        order_total: goodsTotal,
        items: items.map(i => ({
          id: i.product.id,
          name: i.product.name,
          price: i.product.price,
          qty: i.qty,
          image: i.product.images?.[0] || "",
          sellerId: i.product.sellerId,
        })),
      };

      const res = await fetch(`${STORE_API}?action=create_order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания заказа");
      setResult({ orderId: data.order_id, total: data.order_total });
      setItems([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
          <Icon name="PackageCheck" size={40} className="text-green-400" />
        </div>
        <h2 className="font-oswald text-2xl font-semibold text-foreground mb-1">Тестовый заказ создан!</h2>
        <p className="text-xs text-muted-foreground mb-4">№ {result.orderId}</p>
        <div className="bg-secondary rounded-xl px-5 py-3 mb-6 inline-block">
          <p className="text-sm text-muted-foreground">Сумма заказа</p>
          <p className="font-oswald text-2xl font-semibold text-foreground">{result.total.toLocaleString("ru")} ₽</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-600 mb-6">
          <Icon name="Info" size={14} className="inline mr-1.5 mb-0.5" />
          Заказ создан без оплаты. Продавец получил уведомление.
        </div>
        <button onClick={() => setResult(null)}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
          Создать ещё один заказ
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
        <Icon name="FlaskConical" size={15} className="mt-0.5 flex-shrink-0" />
        <span>Тестовый режим: заказ создаётся без оплаты и без СДЭК. Продавец получит уведомление о новом заказе.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Каталог товаров */}
        <div>
          <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Icon name="Package" size={15} className="text-muted-foreground" />
            Выбери товары
          </p>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск товара..."
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors mb-3"
          />
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Загрузка товаров...</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {filtered.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">Товары не найдены</div>
              )}
              {filtered.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                        <Icon name="Package" size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sellerName}</p>
                    <p className="font-oswald text-sm font-semibold text-foreground mt-0.5">{p.price.toLocaleString("ru")} ₽</p>
                  </div>
                  <button onClick={() => addItem(p)}
                    className="w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors flex-shrink-0">
                    <Icon name="Plus" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Правая колонка: корзина + данные + кнопка */}
        <div className="space-y-4">
          {/* Выбранные товары */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Icon name="ShoppingCart" size={15} className="text-muted-foreground" />
              Заказ
              {items.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{items.length}</span>
              )}
            </p>
            {items.length === 0 ? (
              <div className="bg-secondary rounded-xl py-8 text-center text-sm text-muted-foreground">
                Добавь товары из каталога
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(i => (
                  <div key={i.product.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 animate-fade-in">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{i.product.name}</p>
                      <p className="text-xs text-muted-foreground">{(i.product.price * i.qty).toLocaleString("ru")} ₽</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => updateQty(i.product.id, i.qty - 1)}
                        className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors">
                        <Icon name="Minus" size={12} />
                      </button>
                      <span className="w-5 text-center text-sm font-medium">{i.qty}</span>
                      <button onClick={() => updateQty(i.product.id, i.qty + 1)}
                        className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors">
                        <Icon name="Plus" size={12} />
                      </button>
                      <button onClick={() => removeItem(i.product.id)}
                        className="w-7 h-7 rounded-lg ml-1 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                        <Icon name="X" size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Данные покупателя */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Icon name="User" size={14} className="text-muted-foreground" />
              Данные покупателя
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Имя</label>
              <input value={buyerName} onChange={e => setBuyerName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Телефон</label>
              <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)}
                placeholder="необязательно"
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
          </div>

          {/* Итого + кнопка */}
          {items.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Товары</span>
                <span className="text-foreground font-medium">{goodsTotal.toLocaleString("ru")} ₽</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-muted-foreground">Доставка</span>
                <span className="text-green-500 font-medium">Без расчёта</span>
              </div>
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm rounded-xl px-3 py-2 mb-3">
                  {error}
                </div>
              )}
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? (
                  <><Icon name="Loader2" size={16} className="animate-spin" /> Создаём заказ...</>
                ) : (
                  <><Icon name="FlaskConical" size={16} /> Создать тестовый заказ</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
