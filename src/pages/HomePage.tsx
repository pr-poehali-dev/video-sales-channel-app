import { lazy, Suspense, useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { Page, CartItem } from "@/App";
import { useAuth } from "@/context/AuthContext";
import { useStore, type StoreStream } from "@/context/StoreContext";
import ProductCard from "@/components/ProductCard";

const StreamWatchPage = lazy(() => import("@/pages/StreamWatchPage"));

function VideoPreview({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const tryPlay = () => { v.play().catch(() => {}); setReady(true); };
    v.addEventListener("loadedmetadata", tryPlay);
    return () => v.removeEventListener("loadedmetadata", tryPlay);
  }, [src]);
  return (
    <>
      {!ready && <div className="absolute inset-0 bg-secondary animate-pulse" />}
      <video
        ref={videoRef}
        src={src}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: ready ? 1 : 0 }}
        preload="auto"
        playsInline
        muted
        loop
        autoPlay
      />
    </>
  );
}

interface HomePageProps {
  setPage: (p: Page) => void;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  updateQty?: (id: string, qty: number) => void;
  cart?: CartItem[];
  onProductClick: (productId: string) => void;
}

function fmtDuration(sec?: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Горизонтальный скролл-слайдер
function HScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {children}
    </div>
  );
}

// Баннер-слайдер
const BANNERS = [
  {
    id: 1,
    img: "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/c61d0408-abb0-4444-b44d-9593a0754067.jpg",
    badge: "🔥 Скоро жара",
    title: "Лето 2026",
    sub: "Товары для отдыха и пляжа",
    btn: "Смотреть",
    page: "catalog" as Page,
    gradient: "from-orange-600/80 via-orange-500/60",
  },
  {
    id: 2,
    img: "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/e6ba48ee-6837-4504-a386-f309efaab31f.jpg",
    badge: "📦 Оптовым покупателям",
    title: "Покупай\nоптом",
    sub: "Цены ниже при заказе от партии",
    btn: "В каталог",
    page: "catalog" as Page,
    gradient: "from-blue-900/85 via-blue-800/60",
  },
  {
    id: 3,
    img: "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/51fde6a3-c803-413d-9cf1-f88856da8400.jpg",
    badge: "📡 Прямо в эфире",
    title: "Живые\nэфиры",
    sub: "Смотри и покупай не выходя из дома",
    btn: "Эфиры",
    page: "streams" as Page,
    gradient: "from-red-700/85 via-red-600/60",
  },
];

export default function HomePage({ setPage, addToCart, updateQty, cart = [], onProductClick }: HomePageProps) {
  const { user } = useAuth();
  const { products, streams } = useStore();
  const [watchingId, setWatchingId] = useState<string | null>(null);
  const [activeBanner, setActiveBanner] = useState(0);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Автопролистывание баннеров
  useEffect(() => {
    const t = setInterval(() => {
      setActiveBanner(prev => (prev + 1) % BANNERS.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (bannerRef.current) {
      bannerRef.current.scrollTo({ left: activeBanner * bannerRef.current.offsetWidth, behavior: "smooth" });
    }
  }, [activeBanner]);

  const watching = watchingId ? (streams.find(s => s.id === watchingId) ?? null) : null;
  if (watching) {
    return (
      <Suspense fallback={null}>
        <StreamWatchPage
          stream={watching}
          setPage={(p) => { setWatchingId(null); setPage(p); }}
          addToCart={addToCart}
          onProductClick={onProductClick}
        />
      </Suspense>
    );
  }

  const liveStreams = streams.filter(s => s.isLive).slice(0, 6);
  const recordedStreams = streams.filter(s => !s.isLive && s.videoUrl).slice(0, 6);
  const latestProducts = products.slice(0, 12);

  const StreamCard = ({ s, onWatch }: { s: StoreStream; onWatch: (id: string) => void }) => (
    <div
      onClick={() => onWatch(s.id)}
      className="flex-shrink-0 w-52 snap-start bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all cursor-pointer group"
    >
      <div className="relative aspect-video bg-secondary overflow-hidden">
        {s.thumbnail ? (
          <img src={s.thumbnail} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : s.videoUrl ? (
          <VideoPreview src={s.videoUrl} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary text-lg font-bold flex items-center justify-center font-oswald">{s.sellerAvatar}</div>
          </div>
        )}
        {s.isLive ? (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse inline-block" />LIVE
          </div>
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-black/50 group-hover:bg-black/70 flex items-center justify-center transition-colors">
                <Icon name="Play" size={16} className="text-white ml-0.5" />
              </div>
            </div>
            {s.duration && (
              <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                {fmtDuration(s.duration)}
              </div>
            )}
          </>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-foreground text-xs line-clamp-2 leading-snug">{s.title}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{s.sellerName}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-28 animate-fade-in">

      {/* ── БАННЕР-СЛАЙДЕР ─────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div
          ref={bannerRef}
          className="flex overflow-x-hidden"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {BANNERS.map((b) => (
            <div
              key={b.id}
              className="flex-shrink-0 w-full relative"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="relative h-52 overflow-hidden">
                <img src={b.img} alt={b.title} className="absolute inset-0 w-full h-full object-cover" />
                <div className={`absolute inset-0 bg-gradient-to-r ${b.gradient} to-transparent`} />
                <div className="absolute inset-0 px-5 py-5 flex flex-col justify-between">
                  <span className="text-white/90 text-[11px] font-semibold bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full w-fit">
                    {b.badge}
                  </span>
                  <div>
                    <h2 className="font-oswald text-2xl font-bold text-white leading-tight whitespace-pre-line mb-1">
                      {b.title}
                    </h2>
                    <p className="text-white/75 text-xs mb-3">{b.sub}</p>
                    <button
                      onClick={() => setPage(b.page)}
                      className="bg-white text-gray-900 font-semibold text-xs px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
                    >
                      {b.btn} →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Точки */}
        <div className="absolute bottom-3 right-4 flex gap-1.5">
          {BANNERS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveBanner(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeBanner ? "bg-white w-4" : "bg-white/50"}`}
            />
          ))}
        </div>
      </div>

      {/* ── БЫСТРЫЕ КАТЕГОРИИ ─────────────────────────────── */}
      <div className="px-4 pt-4">
        <HScroll>
          {[
            { icon: "Shirt", label: "Одежда", color: "bg-purple-100 text-purple-700" },
            { icon: "Smartphone", label: "Электроника", color: "bg-blue-100 text-blue-700" },
            { icon: "Sparkles", label: "Красота", color: "bg-pink-100 text-pink-700" },
            { icon: "Gem", label: "Украшения", color: "bg-amber-100 text-amber-700" },
            { icon: "Home", label: "Дом", color: "bg-green-100 text-green-700" },
            { icon: "Dumbbell", label: "Спорт", color: "bg-orange-100 text-orange-700" },
            { icon: "Baby", label: "Детям", color: "bg-rose-100 text-rose-700" },
          ].map(cat => (
            <button
              key={cat.label}
              onClick={() => setPage("catalog")}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 snap-start"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${cat.color}`}>
                <Icon name={cat.icon as "Shirt"} size={24} />
              </div>
              <span className="text-[11px] text-foreground font-medium whitespace-nowrap">{cat.label}</span>
            </button>
          ))}
        </HScroll>
      </div>

      {/* ── ПРОМО-ПОЛОСКА: ЛЕТО / ЖАРА ────────────────────── */}
      <div className="mx-4 mt-4 rounded-2xl overflow-hidden bg-gradient-to-r from-orange-500 to-yellow-400 p-4 flex items-center justify-between">
        <div>
          <p className="text-white font-oswald text-lg font-bold leading-tight">🔥 Скоро жара!</p>
          <p className="text-white/85 text-xs mt-0.5">Товары для лета и активного отдыха</p>
        </div>
        <button
          onClick={() => setPage("catalog")}
          className="flex-shrink-0 bg-white text-orange-600 font-bold text-xs px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
        >
          Смотреть
        </button>
      </div>

      {/* ── ПРЕИМУЩЕСТВА (горизонтальный скролл) ─────────── */}
      <div className="px-4 mt-4">
        <HScroll>
          {[
            { icon: "ShieldCheck", title: "Безопасная сделка", desc: "Деньги хранятся у нас до получения товара", color: "bg-green-50 border-green-200 text-green-700" },
            { icon: "Zap", title: "Оплата СБП", desc: "Быстро и без комиссии через Систему Быстрых Платежей", color: "bg-blue-50 border-blue-200 text-blue-700" },
            { icon: "Truck", title: "Доставка СДЭК, ПЭК", desc: "Несколько транспортных компаний на выбор", color: "bg-purple-50 border-purple-200 text-purple-700" },
            { icon: "TrendingDown", title: "Покупай оптом", desc: "Специальные оптовые цены при заказе от партии", color: "bg-amber-50 border-amber-200 text-amber-700" },
            { icon: "Video", title: "Живые эфиры", desc: "Смотри товар вживую до покупки — без сюрпризов", color: "bg-red-50 border-red-200 text-red-700" },
          ].map(f => (
            <div key={f.title} className={`flex-shrink-0 w-44 snap-start border rounded-2xl p-3.5 ${f.color}`}>
              <Icon name={f.icon as "ShieldCheck"} size={22} className="mb-2" />
              <p className="font-semibold text-sm leading-tight mb-1">{f.title}</p>
              <p className="text-[11px] opacity-80 leading-snug">{f.desc}</p>
            </div>
          ))}
        </HScroll>
      </div>

      {/* ── АКТИВНЫЕ ЭФИРЫ ────────────────────────────────── */}
      {liveStreams.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 bg-red-500/15 text-red-500 text-xs font-bold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse inline-block" />
                LIVE
              </span>
              <h2 className="font-oswald text-base font-semibold text-foreground tracking-wide">Сейчас в эфире</h2>
            </div>
            <button onClick={() => setPage("streams")} className="text-xs text-primary font-medium">Все →</button>
          </div>
          <HScroll>
            {liveStreams.map(s => <StreamCard key={s.id} s={s} onWatch={setWatchingId} />)}
          </HScroll>
        </section>
      )}

      {/* ── НОВЫЕ ТОВАРЫ ──────────────────────────────────── */}
      {latestProducts.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-oswald text-base font-semibold text-foreground tracking-wide">Новые товары</h2>
            <button onClick={() => setPage("catalog")} className="text-xs text-primary font-medium">Все →</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {latestProducts.map((p, i) => (
              <div key={p.id} className="animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                <ProductCard
                  product={p}
                  addToCart={addToCart}
                  updateQty={updateQty}
                  cartQty={cart.find(c => c.id === p.id)?.qty ?? 0}
                  onClick={() => onProductClick(p.id)}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setPage("catalog")}
            className="w-full mt-4 border border-border text-foreground font-semibold text-sm py-3 rounded-2xl hover:bg-secondary transition-colors"
          >
            Смотреть все товары
          </button>
        </section>
      )}

      {/* ── БАННЕР: КАК ЭТО РАБОТАЕТ ─────────────────────── */}
      <section className="mx-4 mt-6 bg-card border border-border rounded-2xl p-5">
        <h2 className="font-oswald text-lg font-semibold text-foreground mb-4 tracking-wide">Как это работает?</h2>
        <div className="space-y-4">
          {[
            { num: "1", icon: "Search", title: "Найди товар", desc: "В каталоге или прямо в эфире продавца" },
            { num: "2", icon: "ShoppingCart", title: "Добавь в корзину", desc: "Выбери количество и оформи заказ" },
            { num: "3", icon: "CreditCard", title: "Оплати через СБП", desc: "Быстро и безопасно — без комиссии" },
            { num: "4", icon: "Package", title: "Получи доставку", desc: "СДЭК, ПЭК или Почта России — на выбор" },
          ].map(step => (
            <div key={step.num} className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground font-oswald font-bold text-sm flex items-center justify-center flex-shrink-0">
                {step.num}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── БАННЕР: СТАТЬ ПРОДАВЦОМ ───────────────────────── */}
      {!user?.shopName && (
        <section className="mx-4 mt-4 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 p-5">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Для продавцов</p>
          <h2 className="font-oswald text-xl font-bold text-white mb-2 leading-tight">Начни продавать\nсегодня</h2>
          <p className="text-white/70 text-xs mb-4 leading-relaxed">
            Физлицо, самозанятый, ИП или ООО — регистрируйся и выходи в эфир. Без абонентской платы.
          </p>
          <div className="flex gap-2 flex-wrap mb-4">
            {["Без абонплаты", "Живые эфиры", "Оптовые цены", "СДЭК доставка"].map(t => (
              <span key={t} className="bg-white/10 text-white/80 text-[10px] px-2.5 py-1 rounded-full">{t}</span>
            ))}
          </div>
          <button
            onClick={() => setPage("profile")}
            className="w-full bg-primary text-white font-bold text-sm py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Стать продавцом →
          </button>
        </section>
      )}

      {/* ── ЗАПИСИ ЭФИРОВ ─────────────────────────────────── */}
      {recordedStreams.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-oswald text-base font-semibold text-foreground tracking-wide">Записи эфиров</h2>
            <button onClick={() => setPage("streams")} className="text-xs text-primary font-medium">Все →</button>
          </div>
          <HScroll>
            {recordedStreams.map(s => <StreamCard key={s.id} s={s} onWatch={setWatchingId} />)}
          </HScroll>
        </section>
      )}

      {/* ── ГАРАНТИИ ──────────────────────────────────────── */}
      <section className="mx-4 mt-6 grid grid-cols-2 gap-3">
        {[
          { icon: "ShieldCheck", title: "Безопасная сделка", desc: "Эскроу — деньги у нас до получения", bg: "bg-green-500" },
          { icon: "Zap", title: "СБП без комиссии", desc: "Оплата за секунды", bg: "bg-blue-500" },
          { icon: "RotateCcw", title: "Возврат", desc: "Если товар не соответствует", bg: "bg-amber-500" },
          { icon: "Headphones", title: "Поддержка 24/7", desc: "Всегда на связи", bg: "bg-purple-500" },
        ].map(g => (
          <div key={g.title} className="bg-card border border-border rounded-2xl p-4">
            <div className={`w-9 h-9 ${g.bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon name={g.icon as "ShieldCheck"} size={18} className="text-white" />
            </div>
            <p className="font-semibold text-sm text-foreground">{g.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{g.desc}</p>
          </div>
        ))}
      </section>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className="px-4 mt-8 pb-4 text-center">
        <p className="font-oswald text-lg font-semibold text-foreground mb-1">стримБАЗАР.РФ</p>
        <p className="text-xs text-muted-foreground mb-3">Живой торг без посредников</p>
        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          <button onClick={() => setPage("offer" as Page)} className="hover:text-foreground transition-colors">Оферта продавца</button>
          <button onClick={() => setPage("terms" as Page)} className="hover:text-foreground transition-colors">Условия использования</button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-4">© 2026 стримБАЗАР.РФ · Все права защищены</p>
      </footer>
    </div>
  );
}