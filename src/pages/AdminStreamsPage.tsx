import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { Page } from "@/App";

interface Props {
  setPage: (p: Page) => void;
}

function fmtDur(sec?: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AdminStreamsPage({ setPage }: Props) {
  const { user } = useAuth();
  const { streams, deleteStream, updateStream, reload } = useStore();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);

  useEffect(() => { reload(); }, []);

  const live = useMemo(() => streams.filter(s => s.isLive), [streams]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return streams
      .filter(s => {
        if (filter === "live") return s.isLive;
        if (filter === "ended") return !s.isLive;
        return true;
      })
      .filter(s =>
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.sellerName.toLowerCase().includes(q)
      );
  }, [streams, filter, search]);

  if (!user || user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <Icon name="ShieldOff" size={36} className="mx-auto mb-4 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">Нет доступа</p>
        <button onClick={() => setPage("home")}
          className="mt-4 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold">
          На главную
        </button>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Шапка */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setPage("dashboard")}
            className="p-2 rounded-xl hover:bg-secondary transition-colors">
            <Icon name="ArrowLeft" size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="font-oswald text-lg font-semibold text-foreground leading-tight">Управление эфирами</h1>
            <p className="text-[11px] text-muted-foreground">Просмотр, остановка и удаление</p>
          </div>
          {live.length > 0 && (
            <div className="flex items-center gap-1.5 bg-red-500/10 text-red-500 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {live.length} в эфире
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Статистика */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { label: "Всего эфиров", value: streams.length, icon: "PlayCircle", color: "text-foreground" },
            { label: "Сейчас живут", value: live.length, icon: "Radio", color: "text-red-500" },
            { label: "Завершённых", value: streams.filter(s => !s.isLive).length, icon: "CheckCircle", color: "text-green-500" },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-3 text-center">
              <Icon name={s.icon} size={16} className={`${s.color} mx-auto mb-1`} />
              <div className="font-oswald text-xl font-bold">{s.value}</div>
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
          {([
            ["all", "Все"],
            ["live", "Сейчас"],
            ["ended", "Завершённые"],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                filter === key
                  ? key === "live"
                    ? "bg-red-500 text-white"
                    : "bg-card text-foreground shadow-sm border border-border"
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
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="Radio" size={32} className="text-muted-foreground opacity-30" />
            </div>
            <p className="text-sm text-muted-foreground">Эфиров не найдено</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(s => (
              <div key={s.id} className={`bg-card border rounded-2xl overflow-hidden shadow-sm ${s.isLive ? "border-red-500/40" : "border-border"}`}>
                <div className="flex gap-3 p-4">
                  {/* Превью */}
                  <div className="w-20 h-14 rounded-xl overflow-hidden bg-secondary flex-shrink-0 relative">
                    {!s.isLive && s.videoUrl ? (
                      <video
                        className="w-full h-full object-cover"
                        autoPlay playsInline muted loop src={s.videoUrl}
                        onCanPlay={e => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                      />
                    ) : s.thumbnail ? (
                      <img src={s.thumbnail} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name={s.isLive ? "Radio" : "PlayCircle"} size={22}
                          className={s.isLive ? "text-red-400" : "text-muted-foreground opacity-30"} />
                      </div>
                    )}
                    {s.isLive && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="flex items-center gap-1 text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />LIVE
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
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Icon name="Eye" size={10} />{s.viewers}
                      </span>
                      {s.duration && (
                        <span className="flex items-center gap-1">
                          <Icon name="Clock" size={10} />{fmtDur(s.duration)}
                        </span>
                      )}
                      {s.startedAt && (
                        <span className="flex items-center gap-1">
                          <Icon name="Calendar" size={10} />{s.startedAt}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Действия */}
                <div className="flex border-t border-border">
                  {s.isLive ? (
                    <>
                      <button
                        onClick={() => setPage("streams")}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Icon name="Eye" size={13} />
                        Смотреть
                      </button>
                      <div className="w-px bg-border" />
                      <button
                        onClick={() => handleStop(s.id)}
                        disabled={stopping === s.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                      >
                        {stopping === s.id
                          ? <Icon name="Loader" size={13} className="animate-spin" />
                          : <Icon name="Square" size={13} />}
                        Завершить
                      </button>
                      <div className="w-px bg-border" />
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setPage("streams")}
                        className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <Icon name="PlayCircle" size={13} />
                        Открыть
                      </button>
                      <div className="w-px bg-border" />
                    </>
                  )}
                  <button
                    onClick={() => setConfirmDel(s.id)}
                    className="flex items-center justify-center gap-1.5 px-5 py-3 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <Icon name="Trash2" size={13} />
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модал подтверждения */}
      {confirmDel && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setConfirmDel(null); }}
        >
          <div className="bg-background rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-base mb-1">Удалить эфир?</h3>
            <p className="text-xs text-muted-foreground mb-4">Запись и все данные будут удалены безвозвратно</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDel(null)}
                className="flex-1 py-2.5 text-sm font-medium bg-secondary rounded-xl hover:bg-secondary/80 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDelete(confirmDel)}
                disabled={deleting === confirmDel}
                className="flex-1 py-2.5 text-sm font-semibold bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting === confirmDel ? "Удаляем..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
