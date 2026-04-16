import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";
import type { Page } from "@/App";

function fmtDur(sec?: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface AdminStreamsTabProps {
  setPage: (p: Page) => void;
}

export default function AdminStreamsTab({ setPage }: AdminStreamsTabProps) {
  const { streams, updateStream, deleteStream, reload } = useStore();
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");
  const [stopping, setStopping] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { reload(); }, []);

  const handleStop = async (id: string) => {
    setStopping(id);
    try {
      await updateStream(id, { isLive: false } as never);
      await reload();
    } catch { /* ignore */ }
    finally { setStopping(null); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteStream(id);
      setConfirmDel(null);
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  const live = streams.filter(s => s.isLive);
  const filtered = streams.filter(s => {
    if (filter === "live") return s.isLive;
    if (filter === "ended") return !s.isLive;
    return true;
  }).filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.sellerName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Всего эфиров", value: streams.length, icon: "PlayCircle", color: "text-muted-foreground" },
          { label: "Сейчас в эфире", value: live.length, icon: "Radio", color: "text-red-500" },
          { label: "Завершённых", value: streams.filter(s => !s.isLive).length, icon: "CheckCircle", color: "text-green-500" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 text-center">
            <Icon name={s.icon} size={16} className={`${s.color} mx-auto mb-1`} />
            <div className="font-oswald text-xl font-semibold">{s.value}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Поиск */}
      <div className="relative mb-3">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию или продавцу..."
          className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary/50"
        />
      </div>

      {/* Фильтры */}
      <div className="flex gap-1.5 mb-4">
        {([["all", "Все"], ["live", "Сейчас"], ["ended", "Завершённые"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              filter === key
                ? key === "live" ? "bg-red-500 text-white" : "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground bg-secondary"
            }`}>
            {label}
            {key === "live" && live.length > 0 && (
              <span className="ml-1 bg-white/30 text-inherit text-[10px] px-1 rounded-full">{live.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Список */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="Radio" size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Эфиров не найдено</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(s => (
            <div key={s.id} className={`bg-card border rounded-xl overflow-hidden ${s.isLive ? "border-red-500/40" : "border-border"}`}>
              <div className="flex gap-3 p-3">
                {/* Превью */}
                <div
                  className="w-20 h-14 rounded-lg overflow-hidden bg-black flex-shrink-0 relative cursor-pointer"
                >
                  {!s.isLive && s.videoUrl ? (
                    <video
                      key={s.videoUrl}
                      className="w-full h-full object-cover"
                      autoPlay
                      playsInline
                      muted
                      loop
                      preload="auto"
                      src={s.videoUrl}
                      onLoadedMetadata={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
                      onCanPlay={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
                    />
                  ) : s.thumbnail ? (
                    <img src={s.thumbnail} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <Icon name={s.isLive ? "Radio" : "PlayCircle"} size={20} className={s.isLive ? "text-red-400" : "text-muted-foreground opacity-40"} />
                    </div>
                  )}
                  {s.isLive && (
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                      <span className="flex items-center gap-1 text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                        <span className="w-1 h-1 rounded-full bg-white animate-live-pulse" />LIVE
                      </span>
                    </div>
                  )}
                </div>
                {/* Инфо */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-4 h-4 rounded-full bg-primary/20 text-[9px] font-bold flex items-center justify-center text-primary flex-shrink-0">
                      {s.sellerAvatar || s.sellerName[0]}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{s.sellerName}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Icon name="Calendar" size={10} />{s.scheduledAt ? new Date(s.scheduledAt).toLocaleDateString("ru") : "—"}</span>
                    {s.duration && <span className="flex items-center gap-1"><Icon name="Clock" size={10} />{fmtDur(s.duration)}</span>}
                    <span className="flex items-center gap-1"><Icon name="Eye" size={10} />{s.viewers}</span>
                  </div>
                </div>
              </div>

              {/* Действия */}
              <div className="flex border-t border-border">
                {s.isLive ? (
                  <>
                    <button
                      onClick={() => setPage("streams")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Icon name="Eye" size={12} />
                      Смотреть
                    </button>
                    <div className="w-px bg-border" />
                    <button
                      onClick={() => handleStop(s.id)}
                      disabled={stopping === s.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                    >
                      {stopping === s.id ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Square" size={12} />}
                      Завершить
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setPage("streams")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Icon name="Play" size={12} />
                      Смотреть
                    </button>
                    <div className="w-px bg-border" />
                    <button
                      onClick={() => setConfirmDel(s.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <Icon name="Trash2" size={12} />
                      Удалить
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-destructive" />
            </div>
            <h3 className="font-oswald text-lg font-semibold text-center mb-2">Удалить эфир?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">Запись и все данные эфира будут удалены.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 border border-border font-semibold py-2.5 rounded-xl hover:bg-secondary text-sm">
                Отмена
              </button>
              <button
                onClick={() => handleDelete(confirmDel)}
                disabled={deleting === confirmDel}
                className="flex-1 bg-destructive text-white font-semibold py-2.5 rounded-xl hover:opacity-90 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {deleting === confirmDel ? <Icon name="Loader" size={14} className="animate-spin" /> : null}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}