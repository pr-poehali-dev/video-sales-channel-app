import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type StoreProduct } from "@/context/StoreContext";
import type { Page } from "@/App";

interface Props {
  setPage: (p: Page) => void;
}

export default function AdminProductsPage({ setPage }: Props) {
  const { user } = useAuth();
  const { products, deleteProduct, reload, moderateProduct, getPendingProducts } = useStore();

  const [tab, setTab] = useState<"moderation" | "all">("moderation");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "with_video" | "no_video">("all");
  const [pendingProducts, setPendingProducts] = useState<StoreProduct[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [moderating, setModerating] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  async function loadPending() {
    setPendingLoading(true);
    try {
      const data = await getPendingProducts();
      setPendingProducts(data);
    } finally {
      setPendingLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);
  useEffect(() => { loadPending(); }, []);

  const noVideoCount = useMemo(() => products.filter(p => !p.videoUrl).length, [products]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products
      .filter(p => {
        if (filter === "with_video") return !!p.videoUrl;
        if (filter === "no_video") return !p.videoUrl;
        return true;
      })
      .filter(p =>
        !q || p.name.toLowerCase().includes(q) || p.sellerName.toLowerCase().includes(q)
      );
  }, [products, filter, search]);

  if (!user || user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <Icon name="ShieldOff" size={36} className="mx-auto mb-4 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">Нет доступа</p>
        <button onClick={() => setPage("home")} className="mt-4 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold">
          На главную
        </button>
      </div>
    );
  }

  const handleApprove = async (id: string) => {
    setModerating(id);
    try {
      await moderateProduct(id, "approved");
      setPendingProducts(prev => prev.filter(p => p.id !== id));
    } finally { setModerating(null); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setModerating(rejectModal);
    try {
      await moderateProduct(rejectModal, "rejected", rejectComment);
      setPendingProducts(prev => prev.filter(p => p.id !== rejectModal));
      setRejectModal(null);
      setRejectComment("");
    } finally { setModerating(null); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteProduct(id);
      setPendingProducts(prev => prev.filter(p => p.id !== id));
      setConfirmDel(null);
    } finally { setDeleting(null); }
  };

  const handleBulkDelete = async () => {
    const ids = products.filter(p => !p.videoUrl).map(p => p.id);
    setBulkConfirm(false);
    setBulkProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      try { await deleteProduct(ids[i]); } catch { /* ignore */ }
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkProgress(null);
  };

  function ProductPreview({ p }: { p: StoreProduct }) {
    return (
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary flex-shrink-0 relative">
        {p.videoUrl ? (
          <video className="w-full h-full object-cover" autoPlay playsInline muted loop src={p.videoUrl} poster={p.images?.[0]}
            onCanPlay={e => (e.currentTarget as HTMLVideoElement).play().catch(() => {})} />
        ) : p.images?.[0] ? (
          <img src={p.images[0]} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="ImageOff" size={18} className="text-muted-foreground opacity-30" />
          </div>
        )}
        {p.videoUrl && (
          <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded px-1">
            <Icon name="Video" size={9} className="text-white" />
          </div>
        )}
      </div>
    );
  }

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
            <h1 className="font-oswald text-lg font-semibold text-foreground leading-tight">Управление товарами</h1>
            <p className="text-[11px] text-muted-foreground">Модерация и удаление</p>
          </div>
          {pendingProducts.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 text-xs font-semibold px-3 py-1.5 rounded-full">
              <Icon name="Clock" size={12} />
              {pendingProducts.length} на проверке
            </div>
          )}
        </div>

        {/* Вкладки */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-1 bg-secondary rounded-xl p-1">
            <button
              onClick={() => setTab("moderation")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === "moderation" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Icon name="ShieldCheck" size={14} />
              Модерация
              {pendingProducts.length > 0 && (
                <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {pendingProducts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("all")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Icon name="Package" size={14} />
              Все товары
              <span className="bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {products.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">

        {/* ── МОДЕРАЦИЯ ── */}
        {tab === "moderation" && (
          <>
            {pendingLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-card border border-border rounded-2xl h-28 animate-pulse" />
                ))}
              </div>
            ) : pendingProducts.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckCircle2" size={36} className="text-green-500" />
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-1">Всё проверено!</h3>
                <p className="text-sm text-muted-foreground">Новых товаров на модерацию нет</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground font-medium">
                  {pendingProducts.length} {pendingProducts.length === 1 ? "товар ожидает" : pendingProducts.length < 5 ? "товара ожидают" : "товаров ожидают"} проверки
                </p>
                {pendingProducts.map(p => (
                  <div key={p.id} className="bg-card border-2 border-amber-400/40 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex gap-3 p-4">
                      <ProductPreview p={p} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{p.name}</p>
                          <span className="flex-shrink-0 text-[10px] bg-amber-500/10 text-amber-600 font-semibold px-2 py-0.5 rounded-full">
                            На проверке
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <div className="w-4 h-4 rounded-full bg-primary/20 text-[9px] font-bold flex items-center justify-center text-primary">
                            {p.sellerAvatar || p.sellerName[0]}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">{p.sellerName}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                          <span className="font-bold text-foreground text-sm">{p.price.toLocaleString("ru-RU")} ₽</span>
                          {p.category && <span className="text-muted-foreground">{p.category}</span>}
                          {!p.videoUrl && (
                            <span className="text-orange-500 flex items-center gap-0.5">
                              <Icon name="VideoOff" size={10} />нет видео
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{p.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Изображения если нет видео */}
                    {!p.videoUrl && p.images && p.images.length > 1 && (
                      <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
                        {p.images.slice(0, 5).map((img, i) => (
                          <img key={i} src={img} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-border" />
                        ))}
                      </div>
                    )}

                    <div className="flex border-t border-border">
                      <button
                        onClick={() => handleApprove(p.id)}
                        disabled={moderating === p.id}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-green-600 hover:bg-green-500/5 transition-colors disabled:opacity-50"
                      >
                        <Icon name="Check" size={15} />
                        Одобрить
                      </button>
                      <div className="w-px bg-border" />
                      <button
                        onClick={() => { setRejectModal(p.id); setRejectComment(""); }}
                        disabled={moderating === p.id}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
                      >
                        <Icon name="X" size={15} />
                        Отклонить
                      </button>
                      <div className="w-px bg-border" />
                      <button
                        onClick={() => setConfirmDel(p.id)}
                        disabled={moderating === p.id}
                        className="flex items-center justify-center px-4 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                      >
                        <Icon name="Trash2" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ВСЕ ТОВАРЫ ── */}
        {tab === "all" && (
          <>
            {/* Статистика */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {[
                { label: "Всего", value: products.length, icon: "Package", color: "text-foreground" },
                { label: "С видео", value: products.length - noVideoCount, icon: "Video", color: "text-green-500" },
                { label: "Без видео", value: noVideoCount, icon: "VideoOff", color: "text-red-500" },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3 text-center">
                  <Icon name={s.icon} size={16} className={`${s.color} mx-auto mb-1`} />
                  <div className="font-oswald text-xl font-bold">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Поиск */}
            <div className="relative mb-3">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Название, продавец, категория..."
                className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary/50"
              />
            </div>

            {/* Фильтры */}
            <div className="flex gap-1.5 mb-3">
              {([["all", "Все"], ["with_video", "С видео"], ["no_video", "Без видео"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                    filter === key ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground bg-secondary"
                  }`}>
                  {label}
                  {key === "no_video" && noVideoCount > 0 && (
                    <span className="ml-1 bg-red-500/15 text-red-500 text-[10px] px-1.5 rounded-full">{noVideoCount}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Массовое удаление */}
            {noVideoCount > 0 && (
              <button onClick={() => setBulkConfirm(true)} disabled={!!bulkProgress}
                className="w-full mb-4 flex items-center justify-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl py-2.5 text-xs font-semibold disabled:opacity-50">
                <Icon name="Trash2" size={13} />
                {bulkProgress ? `Удаление: ${bulkProgress.done} / ${bulkProgress.total}` : `Удалить все без видео (${noVideoCount})`}
              </button>
            )}

            {/* Список */}
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <Icon name="Package" size={32} className="mx-auto mb-3 text-muted-foreground opacity-20" />
                <p className="text-sm text-muted-foreground">Товаров не найдено</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filtered.map(p => (
                  <div key={p.id} className={`bg-card border rounded-2xl overflow-hidden ${
                    p.moderationStatus === "pending" ? "border-amber-400/40" :
                    p.moderationStatus === "rejected" ? "border-destructive/30" : "border-border"
                  }`}>
                    <div className="flex gap-3 p-3">
                      <ProductPreview p={p} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-4 h-4 rounded-full bg-primary/20 text-[9px] font-bold flex items-center justify-center text-primary">
                            {p.sellerAvatar || p.sellerName[0]}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">{p.sellerName}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                          <span className="font-bold text-foreground">{p.price.toLocaleString("ru-RU")} ₽</span>
                          {p.moderationStatus === "pending" && (
                            <span className="text-amber-600 flex items-center gap-0.5"><Icon name="Clock" size={10} />на проверке</span>
                          )}
                          {p.moderationStatus === "rejected" && (
                            <span className="text-destructive flex items-center gap-0.5"><Icon name="XCircle" size={10} />отклонён</span>
                          )}
                          {!p.videoUrl && (
                            <span className="text-red-500 flex items-center gap-0.5"><Icon name="VideoOff" size={10} />нет видео</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex border-t border-border">
                      {p.moderationStatus === "pending" && (
                        <>
                          <button onClick={() => handleApprove(p.id)} disabled={moderating === p.id}
                            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-green-600 hover:bg-green-500/5 transition-colors disabled:opacity-50">
                            <Icon name="Check" size={12} />Одобрить
                          </button>
                          <div className="w-px bg-border" />
                        </>
                      )}
                      <button onClick={() => setConfirmDel(p.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                        <Icon name="Trash2" size={12} />Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Модал: отклонить */}
      {rejectModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setRejectModal(null); }}>
          <div className="bg-background rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-base mb-1">Причина отклонения</h3>
            <p className="text-xs text-muted-foreground mb-3">Продавец получит уведомление</p>
            <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)}
              placeholder="Например: нарушение правил, некачественные фото..."
              rows={3}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/50 resize-none mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 text-sm font-medium bg-secondary rounded-xl">Отмена</button>
              <button onClick={handleReject} disabled={moderating === rejectModal}
                className="flex-1 py-2.5 text-sm font-semibold bg-destructive text-destructive-foreground rounded-xl disabled:opacity-50">
                Отклонить
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Модал: удалить */}
      {confirmDel && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setConfirmDel(null); }}>
          <div className="bg-background rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-base mb-1">Удалить товар?</h3>
            <p className="text-xs text-muted-foreground mb-4">Это действие нельзя отменить</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 py-2.5 text-sm font-medium bg-secondary rounded-xl">Отмена</button>
              <button onClick={() => handleDelete(confirmDel)} disabled={deleting === confirmDel}
                className="flex-1 py-2.5 text-sm font-semibold bg-destructive text-destructive-foreground rounded-xl disabled:opacity-50">
                {deleting === confirmDel ? "Удаляем..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Модал: массовое удаление */}
      {bulkConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setBulkConfirm(false); }}>
          <div className="bg-background rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-base mb-1">Удалить {noVideoCount} товаров без видео?</h3>
            <p className="text-xs text-muted-foreground mb-4">Это действие нельзя отменить</p>
            <div className="flex gap-2">
              <button onClick={() => setBulkConfirm(false)}
                className="flex-1 py-2.5 text-sm font-medium bg-secondary rounded-xl">Отмена</button>
              <button onClick={handleBulkDelete}
                className="flex-1 py-2.5 text-sm font-semibold bg-destructive text-destructive-foreground rounded-xl">
                Удалить всё
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}