import Icon from "@/components/ui/icon";
import type { Page } from "@/App";
import { useAuth } from "@/context/AuthContext";

interface NavBarProps {
  page: Page;
  setPage: (p: Page) => void;
  cartCount: number;
}

export default function NavBar({ page, setPage, cartCount }: NavBarProps) {
  const { user } = useAuth();

  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: "home", label: "Главная", icon: "Home" },
    { id: "streams", label: "Эфиры", icon: "Radio" },
    { id: "catalog", label: "Каталог", icon: "ShoppingBag" },
    ...(user?.role === "seller" ? [{ id: "dashboard" as Page, label: "Кабинет", icon: "LayoutDashboard" }] : []),
    ...(user?.role === "admin" ? [{ id: "admin" as Page, label: "Админ", icon: "ShieldCheck" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => setPage("home")}
          className="font-oswald text-xl font-semibold tracking-wider text-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          <span className="text-primary">ЮГА</span><span>ЗИН</span>
          <span className="text-[10px] font-normal text-muted-foreground">.рф</span>
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

        <div className="flex items-center gap-1">
          {/* Кнопка эфира для продавца */}
          {user?.role === "seller" && (
            <button
              onClick={() => setPage("broadcast")}
              className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                page === "broadcast" ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />
              Эфир
            </button>
          )}

          {/* Корзина */}
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

          {/* Профиль / Вход */}
          <button
            onClick={() => setPage(user ? "profile" : "auth")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              page === "profile" || page === "auth"
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {user ? (
              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                {user.avatar}
              </div>
            ) : (
              <Icon name="User" size={18} />
            )}
            <span className="hidden md:inline">{user ? user.name.split(" ")[0] : "Войти"}</span>
          </button>
        </div>
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
        <button
          onClick={() => setPage(user ? "profile" : "auth")}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
            page === "profile" || page === "auth" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {user ? (
            <div className="w-[18px] h-[18px] rounded-full bg-primary/20 text-primary text-[8px] font-bold flex items-center justify-center">
              {user.avatar}
            </div>
          ) : (
            <Icon name="User" size={18} />
          )}
          {user ? "Профиль" : "Войти"}
        </button>
      </div>
    </header>
  );
}
