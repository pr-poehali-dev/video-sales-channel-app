import { useState, useEffect, useMemo } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";

export default function AdminProductsTab() {
  const { products, deleteProduct, reload } = useStore();
  const [filter, setFilter] = useState<"all" | "with_video" | "no_video">("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => { reload(); }, []);

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
    } catch { /* ignore */ }
    finally { setDeleting(null); }
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

  return (
    <div className="animate-fade-in">
      {/* Статистика */}
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

      {/* Поиск */}
      <div className="relative mb-3">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию, продавцу, категории..."
          className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary/50"
        />
      </div>

      {/* Фильтры */}
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

      {/* Массовое удаление без видео */}
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

      {/* Список */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="Package" size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Товаров не найдено</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex gap-3 p-3">
                {/* Превью */}
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary flex-shrink-0 relative">
                  {p.images?.[0]
                    ? <img src={p.images[0]} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <Icon name="ImageOff" size={18} className="text-muted-foreground opacity-40" />
                      </div>
                  }
                  {p.videoUrl && (
                    <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded px-1 py-0.5">
                      <Icon name="Video" size={9} className="text-white" />
                    </div>
                  )}
                </div>
                {/* Инфо */}
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
                    {!p.videoUrl && (
                      <span className="flex items-center gap-1 text-red-500"><Icon name="VideoOff" size={10} />нет видео</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Действия */}
              <div className="flex border-t border-border">
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

      {/* Модалка подтверждения одного товара */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmDel(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
            <Icon name="AlertTriangle" size={28} className="text-destructive mb-3" />
            <h3 className="font-oswald text-lg font-semibold mb-2">Удалить товар?</h3>
            <p className="text-sm text-muted-foreground mb-6">Действие нельзя отменить. Товар исчезнет из каталога.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDel(null)}
                className="flex-1 border border-border py-2.5 rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDelete(confirmDel)}
                disabled={deleting === confirmDel}
                className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deleting === confirmDel ? <Icon name="Loader" size={13} className="animate-spin" /> : <Icon name="Trash2" size={13} />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка массового удаления */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setBulkConfirm(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
            <Icon name="AlertTriangle" size={28} className="text-destructive mb-3" />
            <h3 className="font-oswald text-lg font-semibold mb-2">Удалить все товары без видео?</h3>
            <p className="text-sm text-muted-foreground mb-6">Будет удалено <b className="text-foreground">{noVideoCount}</b> товаров. Действие нельзя отменить.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkConfirm(false)}
                className="flex-1 border border-border py-2.5 rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleBulkDeleteNoVideo}
                className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
              >
                <Icon name="Trash2" size={13} />
                Удалить всё
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}