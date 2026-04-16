import { useState, lazy, Suspense, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type StoreStream } from "@/context/StoreContext";
import type { Page, CartItem } from "@/App";

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

interface StreamsPageProps {
  setPage: (p: Page) => void;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onProductClick: (id: string) => void;
}

function fmtDuration(sec?: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function StreamsPage({ setPage, addToCart, onProductClick }: StreamsPageProps) {
  const { user } = useAuth();
  const { streams, loading } = useStore();
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center animate-fade-in">
        <Icon name="Loader" size={36} className="mx-auto mb-4 text-muted-foreground animate-spin" />
        <p className="text-muted-foreground text-sm">Загружаем эфиры...</p>
      </div>
    );
  }

  const liveStreams = streams.filter(s => s.isLive);
  const recordedStreams = streams.filter(s => !s.isLive);

  if (streams.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Эфиры</h1>
          {user && (
            <button onClick={() => setPage("broadcast")}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
              <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
              Начать эфир
            </button>
          )}
        </div>
        <div className="text-center py-24">
          <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
            <Icon name="Radio" size={36} className="text-muted-foreground opacity-40" />
          </div>
          <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Эфиров пока нет</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">Никто ещё не запустил трансляцию</p>
        </div>
      </div>
    );
  }

  const StreamCard = ({ s }: { s: StoreStream }) => (
    <div
      onClick={() => setWatchingId(s.id)}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-all cursor-pointer group"
    >
      <div className="relative aspect-video bg-secondary flex items-center justify-center overflow-hidden">
        {s.thumbnail ? (
          <img src={s.thumbnail} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : s.videoUrl ? (
          <VideoPreview src={s.videoUrl} />
        ) : (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-primary/20 text-primary text-xl font-bold flex items-center justify-center font-oswald mx-auto mb-2">
              {s.sellerAvatar}
            </div>
            <p className="text-xs text-muted-foreground">{s.sellerName}</p>
          </div>
        )}
        {s.isLive ? (
          <>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse inline-block" />LIVE
            </div>
            <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <Icon name="Eye" size={11} />{s.viewers}
            </div>
          </>
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/40 group-hover:bg-black/60 flex items-center justify-center transition-colors">
                <Icon name="Play" size={20} className="text-white ml-0.5" />
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
        <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">{s.title}</h3>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{s.sellerName}</p>
          <p className="text-xs text-muted-foreground">{s.startedAt}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Эфиры</h1>
        {user && (
          <button onClick={() => setPage("broadcast")}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
            <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
            Начать эфир
          </button>
        )}
      </div>

      {liveStreams.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center gap-1.5 bg-red-500/15 text-red-500 text-xs font-semibold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse inline-block" />В ЭФИРЕ
            </span>
            <span className="text-sm text-muted-foreground">{liveStreams.length} трансляций</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveStreams.map(s => <StreamCard key={s.id} s={s} />)}
          </div>
        </div>
      )}

      {recordedStreams.length > 0 && (
        <div>
          <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide mb-4">
            История эфиров
            <span className="text-sm font-normal text-muted-foreground ml-2">{recordedStreams.length} записей</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recordedStreams.map(s => <StreamCard key={s.id} s={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}