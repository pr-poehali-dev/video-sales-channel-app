import Icon from "@/components/ui/icon";
import { streams } from "@/data/mockData";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";

interface StreamsPageProps {
  setPage: (p: Page) => void;
}

export default function StreamsPage({ setPage }: StreamsPageProps) {
  const { user } = useAuth();
  const liveStreams = streams.filter(s => s.isLive);
  const recordedStreams = streams.filter(s => !s.isLive);

  if (streams.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Эфиры</h1>
          {user?.role === "seller" && (
            <button
              onClick={() => setPage("broadcast")}
              className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
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
          <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
            Продавцы ещё не запустили ни одной трансляции. Подпишись и получи уведомление, когда начнётся первый эфир.
          </p>
          {user?.role === "seller" && (
            <button
              onClick={() => setPage("broadcast")}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              <Icon name="Video" size={16} />
              Запустить первый эфир
            </button>
          )}
          {!user && (
            <button
              onClick={() => setPage("auth")}
              className="inline-flex items-center gap-2 border border-border text-foreground font-semibold px-6 py-3 rounded-xl hover:bg-secondary transition-colors"
            >
              <Icon name="UserPlus" size={16} />
              Войти и следить за эфирами
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Эфиры</h1>
        {user?.role === "seller" && (
          <button
            onClick={() => setPage("broadcast")}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
            Начать эфир
          </button>
        )}
      </div>

      {liveStreams.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center gap-1.5 bg-red-500/15 text-red-500 text-xs font-semibold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse inline-block" />
              В ЭФИРЕ
            </span>
            <span className="text-sm text-muted-foreground">{liveStreams.length} трансляций</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveStreams.map(s => (
              <div key={s.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all">
                <div className="relative aspect-video bg-secondary">
                  <img src={s.thumb} alt={s.title} className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse inline-block" />
                    LIVE
                  </div>
                  <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <Icon name="Eye" size={11} />
                    {s.viewers.toLocaleString("ru")}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground">{s.host} · {s.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recordedStreams.length > 0 && (
        <div>
          <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide mb-4">Записи эфиров</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recordedStreams.map(s => (
              <div key={s.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all">
                <div className="relative aspect-video bg-secondary">
                  <img src={s.thumb} alt={s.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center">
                      <Icon name="Play" size={20} className="text-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground">{s.host} · {s.startedAt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
