import Icon from "@/components/ui/icon";
import type { CartItem } from "@/App";

interface CartPageProps {
  cart: CartItem[];
  removeFromCart: (id: number) => void;
  updateQty: (id: number, qty: number) => void;
}

export default function CartPage({ cart, removeFromCart, updateQty }: CartPageProps) {
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Icon name="ShoppingCart" size={56} className="mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="font-oswald text-2xl font-semibold text-foreground mb-2">Корзина пуста</h2>
        <p className="text-muted-foreground text-sm">Добавь товары из каталога или прямо из эфира</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide mb-6">
        Корзина <span className="text-muted-foreground font-normal text-lg">({cart.length})</span>
      </h1>

      <div className="space-y-3 mb-6">
        {cart.map(item => (
          <div key={item.id} className="bg-card border border-border rounded-xl p-4 flex gap-4 items-center animate-fade-in">
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground line-clamp-2">{item.name}</p>
              <p className="font-oswald text-base font-semibold text-foreground mt-1">
                {item.price.toLocaleString("ru")} ₽
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => updateQty(item.id, item.qty - 1)}
                className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
              >
                <Icon name="Minus" size={13} />
              </button>
              <span className="w-6 text-center text-sm font-medium text-foreground">{item.qty}</span>
              <button
                onClick={() => updateQty(item.id, item.qty + 1)}
                className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
              >
                <Icon name="Plus" size={13} />
              </button>
              <button
                onClick={() => removeFromCart(item.id)}
                className="w-7 h-7 rounded-lg ml-1 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
              >
                <Icon name="Trash2" size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Товары ({cart.reduce((s, c) => s + c.qty, 0)} шт.)</span>
            <span>{total.toLocaleString("ru")} ₽</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Доставка</span>
            <span className="text-green-400">Бесплатно</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between font-semibold">
            <span className="text-foreground">Итого</span>
            <span className="font-oswald text-lg text-foreground">{total.toLocaleString("ru")} ₽</span>
          </div>
        </div>
        <button className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <Icon name="CreditCard" size={18} />
          Оформить заказ
        </button>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Оплата картой, СБП, наличными при получении
        </p>
      </div>
    </div>
  );
}
