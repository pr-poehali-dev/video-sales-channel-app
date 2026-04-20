import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { useStore, type StoreProduct } from "@/context/StoreContext";

export default function AdminProductsTab() {
  const { products, deleteProduct, reload, moderateProduct, getPendingProducts } = useStore();
  const [tab, setTab] = useState<"moderation" | "all">("moderation");
  const [filter, setFilter] = useState<"all" | "with_video" | "no_video">("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [pendingProducts, setPendingProducts] = useState<StoreProduct[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [moderating, setModerating] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");

  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (tab === "moderation") loadPending();
  }, [tab]);

  async function loadPending() {
    setPendingLoading(true);
    try {
      const data = await getPendingProducts();
      setPendingProducts(data);
    } finally {
      setPendingLoading(false);
    }
  }

  const noVideoCount = useMemo(
    () => products.filter(p => !p.videoUrl).length,
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products
      .filter(p => {
        if (filter === "with_video") return !!p.videoUrl;
        if (filter === "no_video") return !p.videoUrl;
        return true;
      })
      .filter(p =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sellerName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
  }, [products, filter, search]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteProduct(id);
      setConfirmDel(null);
      setPendingProducts(prev => prev.filter(p => p.id !== id));
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  const handleApprove = async (id: string) => {
    setModerating(id);
    try {
      await moderateProduct(id, "approved");
      setPendingProducts(prev => prev.filter(p => p.id !== id));
    } finally {
      setModerating(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setModerating(rejectModal);
    try {
      await moderateProduct(rejectModal, "rejected", rejectComment);
      setPendingProducts(prev => prev.filter(p => p.id !== rejectModal));
      setRejectModal(null);
      setRejectComment("");
    } finally {
      setModerating(null);
    }
  };

  const handleBulkDeleteNoVideo = async () => {
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
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-black flex-shrink-0 relative">
        {p.videoUrl ? (
          <video
            key={p.videoUrl}
            className="w-full h-full object-cover"
            autoPlay playsInline muted loop preload="auto"
            src={p.videoUrl} poster={p.images?.[0]}
            onLoadedMetadata={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
            onCanPlay={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
          />
        ) : p.images?.[0] ? (
          <img src={p.images[0]} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <Icon name="ImageOff" size={18} className="text-muted-foreground opacity-40" />
          </div>
        )}
        {p.videoUrl && (
          <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded px-1 py-0.5">
            <Icon name="Video" size={9} className="text-white" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Вкладки */}
      <div className="flex gap-1.5 mb-4 bg-secondary rounded-xl p-1">
        {([
          ["moderation", "Модерация", pendingProducts.length],
          ["all", "Все товары", products.length],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                key === "moderation" && count > 0
                  ? "bg-amber-500/15 text-amber-600"
                  : "bg-muted text-muted-foreground"
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ВКЛАДКА МОДЕРАЦИЯ ── */}
      {tab === "moderation" && (
        <div>
          {pendingLoading ? (
            <div className="flex flex-col gap-2.5">
              {[1,2,3].map(i => (
                <div key={i} className="bg-card border border-border rounded-xl p-3 h-24 animate-pulse" />
              ))}
            </div>
          ) : pendingProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Icon name="CheckCircle" size={28} className="text-green-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">Всё проверено!</p>
              <p className="text-xs text-muted-foreground mt-1">Новых товаров на модерацию нет</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {pendingProducts.length} {pendingProducts.length === 1 ? "товар ожидает" : "товаров ожидают"} проверки
              </p>
              <div className="flex flex-col gap-3">
                {pendingProducts.map(p => (
                  <div key={p.id} className="bg-card border-2 border-amber-400/30 rounded-xl overflow-hidden">
                    <div className="flex gap-3 p-3">
                      <ProductPreview p={p} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-4 h-4 rounded-full bg-primary/20 text-[9px] font-bold flex items-center justify-center text-primary flex-shrink-0">
                            {p.sellerAvatar || p.sellerName[0]}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">{p.sellerName}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="font-semibold text-foreground">{p.price} ₽</span>
                          {p.category && <span className="flex items-center gap-1"><Icon name="Tag" size={10} />{p.category}</span>}
                          <span className="text-amber-600 flex items-center gap-1">
                            <Icon name="Clock" size={10} />на проверке
                          </span>
                        </div>
                        {p.description && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex border-t border-border">
                      <button
                        onClick={() => handleApprove(p.id)}
                        disabled={moderating === p.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-green-600 hover:bg-green-500/5 transition-colors disabled:opacity-50"
                      >
                        <Icon name="Check" size={13} />
                        Одобрить
                      </button>
                      <div className="w-px bg-border" />
                      <button
                        onClick={() => { setRejectModal(p.id); setRejectComment(""); }}
                        disabled={moderating === p.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
                      >
                        <Icon name="X" size={13} />
                        Отклонить
                      </button>
                      <div className="w-px bg-border" />
                      <button
                        onClick={() => setConfirmDel(p.id)}
                        disabled={moderating === p.id}
                        className="flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
                      >
                        <Icon name="Trash2" size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ВКЛАДКА ВСЕ ТОВАРЫ ── */}
      {tab === "all" && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Всего товаров", value: products.length, icon: "Package", color: "text-muted-foreground" },
              { label: "С видео", value: products.length - noVideoCount, icon: "Video", color: "text-green-500" },
              { label: "Без видео", value: noVideoCount, icon: "VideoOff", color: "text-red-500" },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-3 text-center">
                <Icon name={s.icon} size={16} className={`${s.color} mx-auto mb-1`} />
                <div className="font-oswald text-xl font-semibold">{s.value}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="relative mb-3">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по названию, продавцу..."
              className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex gap-1.5 mb-3 flex-wrap">
            {([
              ["all", "Все"],
              ["with_video", "С видео"],
              ["no_video", "Без видео"],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  filter === key
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground bg-secondary"
                }`}>
                {label}
                {key === "no_video" && noVideoCount > 0 && (
                  <span className="ml-1 bg-red-500/15 text-red-500 text-[10px] px-1.5 rounded-full">{noVideoCount}</span>
                )}
              </button>
            ))}
          </div>

          {noVideoCount > 0 && (
            <button
              onClick={() => setBulkConfirm(true)}
              disabled={!!bulkProgress}
              className="w-full mb-4 flex items-center justify-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl py-2.5 text-xs font-semibold hover:bg-destructive/15 transition-colors disabled:opacity-50"
            >
              <Icon name="Trash2" size={13} />
              {bulkProgress
                ? `Удаление: ${bulkProgress.done} / ${bulkProgress.total}`
                : `Удалить все товары без видео (${noVideoCount})`}
            </button>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="Package" size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Товаров не найдено</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filtered.map(p => (
                <div key={p.id} className={`bg-card border rounded-xl overflow-hidden ${
                  p.moderationStatus === "pending" ? "border-amber-400/40" :
                  p.moderationStatus === "rejected" ? "border-destructive/30" :
                  "border-border"
                }`}>
                  <div className="flex gap-3 p-3">
                    <ProductPreview p={p} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-4 h-4 rounded-full bg-primary/20 text-[9px] font-bold flex items-center justify-center text-primary flex-shrink-0">
                          {p.sellerAvatar || p.sellerName[0]}
                        </div>
                        <span className="text-xs text-muted-foreground truncate">{p.sellerName}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="font-semibold text-foreground">{p.price} ₽</span>
                        {p.category && <span className="flex items-center gap-1"><Icon name="Tag" size={10} />{p.category}</span>}
                        <span className="flex items-center gap-1"><Icon name="Package" size={10} />{p.inStock}</span>
                        {p.moderationStatus === "pending" && (
                          <span className="flex items-center gap-1 text-amber-600"><Icon name="Clock" size={10} />на проверке</span>
                        )}
                        {p.moderationStatus === "rejected" && (
                          <span className="flex items-center gap-1 text-destructive"><Icon name="XCircle" size={10} />отклонён</span>
                        )}
                        {!p.videoUrl && (
                          <span className="flex items-center gap-1 text-red-500"><Icon name="VideoOff" size={10} />нет видео</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex border-t border-border">
                    {p.moderationStatus === "pending" && (
                      <>
                        <button
                          onClick={() => handleApprove(p.id)}
                          disabled={moderating === p.id}
                          className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-green-600 hover:bg-green-500/5 transition-colors disabled:opacity-50"
                        >
                          <Icon name="Check" size={12} />Одобрить
                        </button>
                        <div className="w-px bg-border" />
                      </>
                    )}
                    <button
                      onClick={() => setConfirmDel(p.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <Icon name="Trash2" size={12} />
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Модал отклонения */}
      {rejectModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setRejectModal(null); }}>
          <div className="bg-background rounded-2xl p-5 w-full max-w-sm">
            <h3 className="font-semibold text-base mb-1">Отклонить товар</h3>
            <p className="text-xs text-muted-foreground mb-4">Укажите причину отклонения (необязательно)</p>
            <textarea
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              placeholder="Причина отклонения..."
              rows={3}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/50 resize-none mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 text-sm font-medium bg-secondary rounded-xl hover:bg-secondary/80 transition-colors">
                Отмена
              </button>
              <button onClick={handleReject} disabled={moderating === rejectModal}
                className="flex-1 py-2.5 text-sm font-semibold bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 transition-colors disabled:opacity-50">
                Отклонить
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Модал подтверждения удаления */}
      {confirmDel && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setConfirmDel(null); }}>
          <div className="bg-background rounded-2xl p-5 w-full max-w-sm">
            <h3 className="font-semibold text-base mb-1">Удалить товар?</h3>
            <p className="text-xs text-muted-foreground mb-4">Это действие нельзя отменить</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 py-2.5 text-sm font-medium bg-secondary rounded-xl hover:bg-secondary/80 transition-colors">
                Отмена
              </button>
              <button onClick={() => handleDelete(confirmDel)} disabled={deleting === confirmDel}
                className="flex-1 py-2.5 text-sm font-semibold bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 transition-colors disabled:opacity-50">
                {deleting === confirmDel ? "Удаляем..." : "Удалить"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Модал массового удаления */}
      {bulkConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setBulkConfirm(false); }}>
          <div className="bg-background rounded-2xl p-5 w-full max-w-sm">
            <h3 className="font-semibold text-base mb-1">Удалить {noVideoCount} товаров?</h3>
            <p className="text-xs text-muted-foreground mb-4">Все товары без видео будут удалены</p>
            <div className="flex gap-2">
              <button onClick={() => setBulkConfirm(false)}
                className="flex-1 py-2.5 text-sm font-medium bg-secondary rounded-xl">Отмена</button>
              <button onClick={handleBulkDeleteNoVideo}
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
