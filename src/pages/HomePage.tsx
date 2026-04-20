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

export default function HomePage({ setPage, addToCart, updateQty, cart = [], onProductClick }: HomePageProps) {
  const { user } = useAuth();
  const { products, streams } = useStore();
  const [watchingId, setWatchingId] = useState<string | null>(null);

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

  const liveStreams = streams.filter(s => s.isLive).slice(0, 3);
  const recordedStreams = streams.filter(s => !s.isLive && s.videoUrl).slice(0, 3);
  const latestProducts = products.slice(0, 8);

  const StreamCard = ({ s, onWatch }: { s: StoreStream; onWatch: (id: string) => void }) => (
    <div onClick={() => onWatch(s.id)} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all cursor-pointer group">
      <div className="relative aspect-video bg-secondary flex items-center justify-center overflow-hidden">
        {s.thumbnail ? (
          <img src={s.thumbnail} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : s.videoUrl ? (
          <VideoPreview src={s.videoUrl} />
        ) : (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-primary/20 text-primary text-xl font-bold flex items-center justify-center font-oswald mx-auto mb-2">{s.sellerAvatar}</div>
            <p className="text-xs text-muted-foreground">{s.sellerName}</p>
          </div>
        )}
        {s.isLive ? (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse inline-block" />LIVE
          </div>
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-black/40 group-hover:bg-black/60 flex items-center justify-center transition-colors">
                <Icon name="Play" size={18} className="text-white ml-0.5" />
              </div>
            </div>
            {s.duration && (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                {fmtDuration(s.duration)}
              </div>
            )}
          </>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-foreground text-sm line-clamp-1">{s.title}</p>
        <p className="text-xs text-muted-foreground mt-1">{s.sellerName}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-14 animate-fade-in">

      {/* Hero */}
      <section className="rounded-3xl overflow-hidden relative">
        <div className="relative min-h-[420px] md:min-h-[480px] flex items-center">
          {/* Фоновая картинка */}
          <img
            src="https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/5b3374fe-6838-4c67-b550-089de67a7b0b.jpg"
            alt="БАЗАР.РФ — разнообразие товаров"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Затемнение */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/20" />

          {/* Баннер: сайт в разработке */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-yellow-500/90 backdrop-blur-sm text-yellow-950 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
            <Icon name="Construction" size={13} />
            Сайт в разработке
          </div>

          {/* Контент */}
          <div className="relative z-10 px-8 py-12 md:px-14 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse inline-block" />
              Живые покупки онлайн
            </div>
            <h1 className="font-oswald text-4xl md:text-6xl font-semibold text-white tracking-wide mb-3 leading-tight">
              <span className="font-light">стрим</span>БАЗАР.РФ
            </h1>
            <p className="font-oswald text-xl md:text-2xl text-white/80 tracking-wide mb-2">
              Живой торг — без посредников
            </p>
            <p className="text-white/60 text-sm md:text-base mb-8 max-w-md leading-relaxed">
              Смотри прямые трансляции, торгуйся с продавцами и покупай уникальные товары прямо из эфира.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <button
                onClick={() => setPage("streams")}
                className="flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
              >
                <Icon name="Radio" size={16} />
                Смотреть эфиры
              </button>
              <button
                onClick={() => setPage("catalog")}
                className="flex items-center gap-2 bg-white/15 backdrop-blur text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/25 transition-colors border border-white/20"
              >
                <Icon name="ShoppingBag" size={16} />
                Каталог товаров
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Активные эфиры */}
      {liveStreams.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 bg-red-500/15 text-red-500 text-xs font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse inline-block" />
                В ЭФИРЕ
              </span>
              <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide">Сейчас идут трансляции</h2>
            </div>
            <button onClick={() => setPage("streams")} className="text-sm text-primary hover:underline">Все эфиры</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {liveStreams.map(s => (
              <StreamCard key={s.id} s={s} onWatch={setWatchingId} />
            ))}
          </div>
        </section>
      )}

      {/* Записи эфиров */}
      {recordedStreams.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide">Записи эфиров</h2>
            <button onClick={() => setPage("streams")} className="text-sm text-primary hover:underline">Все записи</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recordedStreams.map(s => (
              <StreamCard key={s.id} s={s} onWatch={setWatchingId} />
            ))}
          </div>
        </section>
      )}

      {/* Новые товары */}
      {latestProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide">Новые товары</h2>
            <button onClick={() => setPage("catalog")} className="text-sm text-primary hover:underline">Все товары</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {latestProducts.map((p, i) => (
              <div key={p.id} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
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
        </section>
      )}

      {/* Фичи */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: "Video", title: "Живые эфиры", desc: "Продавцы показывают товар вживую — вы видите всё честно, без фотошопа" },
            { icon: "ShoppingCart", title: "Удобная корзина", desc: "Добавляйте товары прямо из эфира и оплачивайте в один клик" },
            { icon: "ShieldCheck", title: "Безопасные покупки", desc: "Каждый пользователь верифицирован. Возврат гарантирован." },
          ].map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Icon name={f.icon} size={22} className="text-primary" />
              </div>
              <h3 className="font-oswald text-lg font-semibold text-foreground tracking-wide mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-oswald text-2xl font-semibold text-foreground mb-2 tracking-wide">
              {user ? "Готов начать эфир?" : "Хочешь продавать в эфире?"}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              {user
                ? "Перейди в кабинет, добавь товары и запусти прямую трансляцию прямо с телефона."
                : "Зарегистрируйся и начни вести собственные прямые трансляции с продажами уже сегодня."
              }
            </p>
          </div>
          <button
            onClick={() => setPage(user ? "dashboard" : "auth")}
            className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap flex items-center gap-2"
          >
            <Icon name="Zap" size={16} />
            {user ? "В кабинет" : "Начать продавать"}
          </button>
        </div>
      </section>

      {/* Скоро открытие */}
      <section>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-8 text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-600 text-xs font-semibold px-3 py-1.5 rounded-full">
            <Icon name="Clock" size={13} />
            Скоро открытие
          </div>
          <h3 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">
            Сайт находится в стадии разработки
          </h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Мы активно работаем над запуском. Уже скоро здесь заработает полноценный маркетплейс прямых трансляций. Следите за обновлениями!
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-6 pb-2 border-t border-border mt-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-muted-foreground">© 2024 ИП Буцкий Денис Алексеевич · ИНН 260803860085</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPage("oferta-seller")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
            >
              Оферта для продавцов
            </button>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <button
              onClick={() => setPage("oferta-buyer")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
            >
              Пользовательское соглашение
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}