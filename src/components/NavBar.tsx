import Icon from "@/components/ui/icon";
import type { Page } from "@/App";
import { useAuth } from "@/context/AuthContext";
import { usePriceMode } from "@/context/PriceModeContext";

interface NavBarProps {
  page: Page;
  setPage: (p: Page) => void;
  cartCount: number;
}

export default function NavBar({ page, setPage, cartCount }: NavBarProps) {
  const { user } = useAuth();
  const { mode, setMode } = usePriceMode();

  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: "home", label: "Главная", icon: "Home" },
    { id: "streams", label: "Эфиры", icon: "Radio" },
    { id: "catalog", label: "Каталог", icon: "ShoppingBag" },
    ...(user && user.role !== "admin" ? [{ id: "dashboard" as Page, label: "Кабинет", icon: "LayoutDashboard" }] : []),
    ...(user && user.role !== "admin" ? [{ id: "support" as Page, label: "Поддержка", icon: "MessageCircle" }] : []),
    ...(user?.role === "admin" ? [{ id: "admin" as Page, label: "Админ", icon: "ShieldCheck" }] : []),
    ...(user?.role === "admin" ? [{ id: "support-admin" as Page, label: "Чаты", icon: "MessageSquare" }] : []),
  ];

  const mobileItems = [
    { id: "home" as Page, label: "Главная", icon: "Home" },
    { id: "streams" as Page, label: "Эфиры", icon: "Radio" },
    { id: "catalog" as Page, label: "Каталог", icon: "ShoppingBag" },
    { id: "cart" as Page, label: "Корзина", icon: "ShoppingCart" },
    { id: (user ? "profile" : "auth") as Page, label: user ? "Профиль" : "Войти", icon: "User" },
  ];

  return (
    <>
      {/* ── Топ-хедер (десктоп + мобиль) ──────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => setPage("home")}
            className="font-oswald text-xl font-semibold tracking-wider text-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <span className="text-foreground font-light">стрим</span><span className="text-primary">БАЗАР</span>
            <span className="text-[10px] font-normal text-muted-foreground">.рф</span>
          </button>

          {/* Переключатель Опт / Розница */}
          <div className="flex items-center bg-secondary rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setMode("retail")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === "retail"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name="ShoppingCart" size={13} />
              Розница
            </button>
            <button
              onClick={() => setMode("wholesale")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === "wholesale"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name="Layers" size={13} />
              Оптом
            </button>
          </div>

          {/* Десктоп навигация */}
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
            {/* Кнопка эфира — только десктоп */}
            {user && user.role !== "admin" && (
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

            {/* Корзина — десктоп */}
            <button
              onClick={() => setPage("cart")}
              className={`hidden md:flex relative items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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

            {/* Профиль — десктоп */}
            <button
              onClick={() => setPage(user ? "profile" : "auth")}
              className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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
              <span>{user ? user.name.split(" ")[0] : "Войти"}</span>
            </button>

            {/* Поддержка — мобиль (в хедере) */}
            {user && user.role !== "admin" && (
              <button
                onClick={() => setPage("support")}
                className={`md:hidden flex items-center px-2 py-2 rounded-md transition-colors ${
                  page === "support" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon name="MessageCircle" size={22} />
              </button>
            )}

            {/* Корзина — мобиль (в хедере справа) */}
            <button
              onClick={() => setPage("cart")}
              className={`md:hidden relative flex items-center px-2 py-2 rounded-md transition-colors ${
                page === "cart" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon name="ShoppingCart" size={22} />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Эфир — мобиль (в хедере) */}
            {user && user.role !== "admin" && (
              <button
                onClick={() => setPage("broadcast")}
                className={`md:hidden flex items-center px-2 py-2 rounded-md transition-colors ${
                  page === "broadcast" ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-live-pulse" />
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Мобильный таббар (fixed bottom) ──────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {mobileItems.map(item => {
          const isCart = item.id === "cart";
          const isProfile = item.id === "profile" || item.id === "auth";
          const isActive = isProfile
            ? page === "profile" || page === "auth"
            : page === item.id;

          return (
            <button
              key={item.label}
              onClick={() => setPage(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {isProfile && user ? (
                <div className={`w-5 h-5 rounded-full bg-primary/20 text-[9px] font-bold flex items-center justify-center ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {user.avatar}
                </div>
              ) : (
                <Icon name={item.icon} size={20} />
              )}
              {isCart && cartCount > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-14px)] bg-primary text-primary-foreground text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
              <span>{isProfile && user ? "Профиль" : item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}