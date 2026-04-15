import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";

const STREAM_THUMBNAIL = "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/bucket/stream-placeholder.jpg";

function fmtDuration(sec?: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Props {
  setPage: (p: Page) => void;
}

export default function DashboardStreamsTab({ setPage }: Props) {
  const { user } = useAuth();
  const { deleteStream, updateStream, reload, getSellerStreams } = useStore();

  const myStreams = user ? getSellerStreams(user.id) : [];
  const activeStream = myStreams.find(s => s.isLive) ?? null;

  const [stoppingStream, setStoppingStream] = useState<string | null>(null);
  const [editStreamId, setEditStreamId] = useState<string | null>(null);
  const [editStreamTitle, setEditStreamTitle] = useState("");
  const [savingStreamTitle, setSavingStreamTitle] = useState(false);
  const [confirmDeleteStream, setConfirmDeleteStream] = useState<string | null>(null);

  const handleStopStream = async (id: string) => {
    setStoppingStream(id);
    try {
      await updateStream(id, { isLive: false });
      await reload();
    } catch { /* ignore */ }
    finally { setStoppingStream(null); }
  };

  const handleSaveStreamTitle = async (id: string) => {
    if (!editStreamTitle.trim()) return;
    setSavingStreamTitle(true);
    try {
      await updateStream(id, { title: editStreamTitle.trim() } as never);
      await reload();
      setEditStreamId(null);
    } catch { /* ignore */ }
    finally { setSavingStreamTitle(false); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {myStreams.length > 0 ? `${myStreams.length} эфир${myStreams.length === 1 ? "" : myStreams.length < 5 ? "а" : "ов"}` : "Нет эфиров"}
        </span>
        <div className="flex items-center gap-2">
          {activeStream && (
            <button
              onClick={() => handleStopStream(activeStream.id)}
              disabled={stoppingStream === activeStream.id}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {stoppingStream === activeStream.id
                ? <Icon name="Loader" size={12} className="animate-spin" />
                : <Icon name="Square" size={12} />}
              Завершить эфир
            </button>
          )}
          {!activeStream && (
            <button onClick={() => setPage("broadcast")}
              className="flex items-center gap-1.5 text-sm text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors font-medium">
              <Icon name="Video" size={13} />
              Начать эфир
            </button>
          )}
        </div>
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
        <div className="flex flex-col gap-3">
          {myStreams.map(s => (
            <div key={s.id} className={`bg-card border rounded-xl overflow-hidden transition-all ${s.isLive ? "border-red-500/40 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]" : "border-border"}`}>
              <div className="flex gap-3 p-3">
                {/* Превью */}
                <div className="w-20 h-14 rounded-lg overflow-hidden bg-secondary flex-shrink-0 relative">
                  {s.thumbnail
                    ? <img src={s.thumbnail} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <Icon name={s.isLive ? "Radio" : "PlayCircle"} size={20} className={s.isLive ? "text-red-400" : "text-muted-foreground opacity-40"} />
                      </div>
                  }
                  {s.isLive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="flex items-center gap-1 text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                        <span className="w-1 h-1 rounded-full bg-white animate-live-pulse" />LIVE
                      </span>
                    </div>
                  )}
                </div>

                {/* Инфо */}
                <div className="flex-1 min-w-0">
                  {editStreamId === s.id ? (
                    <div className="flex gap-1.5 items-center mb-1">
                      <input
                        value={editStreamTitle}
                        onChange={e => setEditStreamTitle(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSaveStreamTitle(s.id)}
                        className="flex-1 text-sm bg-secondary border border-border rounded-lg px-2 py-1 outline-none focus:border-primary/50 min-w-0"
                        autoFocus
                      />
                      <button onClick={() => handleSaveStreamTitle(s.id)} disabled={savingStreamTitle}
                        className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                        {savingStreamTitle ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Check" size={12} />}
                      </button>
                      <button onClick={() => setEditStreamId(null)} className="p-1.5 rounded-lg hover:bg-secondary">
                        <Icon name="X" size={12} className="text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate flex-1">{s.title}</p>
                      <button
                        onClick={() => { setEditStreamId(s.id); setEditStreamTitle(s.title); }}
                        className="p-1 rounded hover:bg-secondary flex-shrink-0"
                      >
                        <Icon name="Pencil" size={11} className="text-muted-foreground" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {s.isLive ? (
                      <span className="flex items-center gap-1 text-red-500 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />
                        Идёт сейчас
                      </span>
                    ) : (
                      <span>{s.startedAt ? new Date(s.startedAt).toLocaleDateString("ru", { day: "numeric", month: "short" }) : ""}</span>
                    )}
                    {s.duration && (
                      <span className="flex items-center gap-1">
                        <Icon name="Clock" size={10} />{fmtDuration(s.duration)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Icon name="Eye" size={10} />{s.viewers ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Кнопки действий */}
              <div className="flex border-t border-border">
                {s.isLive ? (
                  <>
                    <button
                      onClick={() => setPage("broadcast")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Icon name="Radio" size={13} />
                      Управление
                    </button>
                    <div className="w-px bg-border" />
                    <button
                      onClick={() => handleStopStream(s.id)}
                      disabled={stoppingStream === s.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                    >
                      {stoppingStream === s.id
                        ? <Icon name="Loader" size={13} className="animate-spin" />
                        : <Icon name="Square" size={13} />}
                      Завершить эфир
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setPage("streams")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Icon name="Play" size={13} />
                      Смотреть
                    </button>
                    <div className="w-px bg-border" />
                    <button
                      onClick={() => setConfirmDeleteStream(s.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <Icon name="Trash2" size={13} />
                      Удалить
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Подтверждение удаления эфира */}
      {confirmDeleteStream && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-destructive" />
            </div>
            <h3 className="font-oswald text-lg font-semibold text-foreground text-center mb-2">Удалить эфир?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">Запись будет удалена и больше не будет видна зрителям</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteStream(null)}
                className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl hover:bg-secondary transition-colors text-sm">
                Отмена
              </button>
              <button onClick={() => { deleteStream(confirmDeleteStream); setConfirmDeleteStream(null); }}
                className="flex-1 bg-destructive text-white font-semibold py-2.5 rounded-xl hover:opacity-90 text-sm">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}