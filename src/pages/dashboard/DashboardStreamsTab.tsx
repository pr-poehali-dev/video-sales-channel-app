import Icon from "@/components/ui/icon";
import type { StoreStream } from "@/context/StoreContext";
import type { Page } from "@/App";

interface DashboardStreamsTabProps {
  myStreams: StoreStream[];
  setPage: (p: Page) => void;
  onDeleteStream: (id: string) => void;
}

function fmtDuration(sec?: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DashboardStreamsTab({ myStreams, setPage, onDeleteStream }: DashboardStreamsTabProps) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {myStreams.length > 0 ? `${myStreams.length} эфир${myStreams.length === 1 ? "" : myStreams.length < 5 ? "а" : "ов"}` : "Нет эфиров"}
        </span>
        <button onClick={() => setPage("broadcast")}
          className="flex items-center gap-1.5 text-sm text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-live-pulse" />
          Начать эфир
        </button>
      </div>

      {myStreams.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="Radio" size={24} className="text-muted-foreground opacity-40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Эфиров пока нет</h3>
          <p className="text-sm text-muted-foreground mb-5">Запусти первую трансляцию прямо с телефона</p>
          <button onClick={() => setPage("broadcast")}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 text-sm">
            <Icon name="Video" size={15} /> Начать эфир
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {myStreams.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.isLive ? "bg-red-500/15" : "bg-secondary"}`}>
                <Icon name={s.isLive ? "Radio" : "PlayCircle"} size={20} className={s.isLive ? "text-red-500" : "text-muted-foreground"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                  {s.isLive && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                      <span className="w-1 h-1 rounded-full bg-red-500 animate-live-pulse" />LIVE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span>{s.startedAt}</span>
                  {s.duration && <span className="flex items-center gap-1"><Icon name="Clock" size={10} />{fmtDuration(s.duration)}</span>}
                  <span className="flex items-center gap-1"><Icon name="Eye" size={10} />{s.viewers}</span>
                </div>
              </div>
              {!s.isLive && (
                <button onClick={() => onDeleteStream(s.id)}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0">
                  <Icon name="Trash2" size={16} className="text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
