import Icon from "@/components/ui/icon";
import type { Page } from "@/App";

interface Props {
  setPage: (p: Page) => void;
}

export default function WelcomePage({ setPage }: Props) {
  return (
    <div className="min-h-[90vh] flex items-center justify-center px-4 py-12 animate-fade-in">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon name="PartyPopper" size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Добро пожаловать!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Аккаунт создан. Что хотите делать?
          </p>
        </div>

        <div className="space-y-3">
          {/* Купить */}
          <button
            onClick={() => setPage("catalog")}
            className="w-full bg-card border border-border rounded-2xl p-5 text-left hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <Icon name="ShoppingBag" size={22} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-base">Хочу купить</p>
                <p className="text-xs text-muted-foreground mt-0.5">Смотри эфиры и заказывай товары</p>
              </div>
              <Icon name="ChevronRight" size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </button>

          {/* Продать */}
          <button
            onClick={() => setPage("seller-register")}
            className="w-full bg-primary text-primary-foreground rounded-2xl p-5 text-left hover:opacity-90 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon name="Store" size={22} className="text-primary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-primary-foreground text-base">Хочу продавать</p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">Зарегистрируй магазин и начни торговать</p>
              </div>
              <Icon name="ChevronRight" size={18} className="text-primary-foreground/70 group-hover:text-primary-foreground transition-colors" />
            </div>
          </button>
        </div>

        <button
          onClick={() => setPage("home")}
          className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Пропустить — разберусь сам
        </button>
      </div>
    </div>
  );
}
