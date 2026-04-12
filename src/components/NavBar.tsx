import Icon from "@/components/ui/icon";
import type { Page } from "@/App";

interface NavBarProps {
  page: Page;
  setPage: (p: Page) => void;
  cartCount: number;
}

export default function NavBar({ page, setPage, cartCount }: NavBarProps) {
  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: "home", label: "Главная", icon: "Home" },
    { id: "streams", label: "Эфиры", icon: "Radio" },
    { id: "catalog", label: "Каталог", icon: "ShoppingBag" },
    { id: "dashboard", label: "Кабинет", icon: "LayoutDashboard" },
    { id: "profile", label: "Профиль", icon: "User" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => setPage("home")}
          className="font-oswald text-xl font-semibold tracking-wider text-foreground hover:text-primary transition-colors"
        >
          LIVE<span className="text-primary">SHOP</span>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                page === item.id
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon name={item.icon} size={15} />
              {item.label}
            </button>
          ))}
        </nav>

        <button
          onClick={() => setPage("cart")}
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            page === "cart" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          }`}
        >
          <Icon name="ShoppingCart" size={18} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-border flex">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              page === item.id ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </button>
        ))}
        <button
          onClick={() => setPage("cart")}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative ${
            page === "cart" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Icon name="ShoppingCart" size={18} />
          Корзина
          {cartCount > 0 && (
            <span className="absolute top-1 right-3 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
