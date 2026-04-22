import Icon from "@/components/ui/icon";
import type { StoreProduct } from "@/context/StoreContext";

interface ProductListProps {
  products: StoreProduct[];
  confirmDelete: string | null;
  onOpenAddForm: () => void;
  onOpenEditForm: (id: string) => void;
  onSetConfirmDelete: (id: string | null) => void;
  onDelete: (id: string) => void;
}

export default function ProductList({
  products,
  confirmDelete,
  onOpenAddForm,
  onOpenEditForm,
  onSetConfirmDelete,
  onDelete,
}: ProductListProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {products.length > 0
            ? `${products.length} товар${products.length === 1 ? "" : products.length < 5 ? "а" : "ов"}`
            : "Нет товаров"}
        </span>
        <button
          onClick={onOpenAddForm}
          className="flex items-center gap-1.5 text-sm text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors font-medium"
        >
          <Icon name="Plus" size={14} /> Добавить товар
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="Package" size={24} className="text-muted-foreground opacity-40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Товаров пока нет</h3>
          <p className="text-sm text-muted-foreground">Нажмите «+ Добавить товар» выше, чтобы начать продавать</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary flex-shrink-0 relative">
                {(p as { videoUrl?: string }).videoUrl ? (
                  <>
                    <video
                      src={(p as { videoUrl?: string }).videoUrl}
                      autoPlay loop muted playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0.5 right-0.5 bg-orange-500 rounded-full p-0.5">
                      <Icon name="Video" size={8} className="text-white" />
                    </div>
                  </>
                ) : p.images.length > 0
                  ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <Icon name="ImageOff" size={20} className="text-muted-foreground opacity-40" />
                    </div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="font-oswald text-sm font-semibold text-primary">{p.price.toLocaleString("ru")} ₽</span>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">{p.category}</span>
                  {(p as { videoUrl?: string }).videoUrl && (
                    <span className="text-xs text-orange-500 flex items-center gap-0.5">
                      <Icon name="Video" size={11} />видео
                    </span>
                  )}
                </div>
                {p.moderationStatus === "pending" && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full mt-1">
                    <Icon name="Clock" size={10} />На проверке
                  </span>
                )}
                {p.moderationStatus === "rejected" && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full mt-1" title={p.moderationComment ?? ""}>
                    <Icon name="XCircle" size={10} />Отклонён{p.moderationComment ? `: ${p.moderationComment}` : ""}
                  </span>
                )}
                {p.moderationStatus === "approved" && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full mt-1">
                    <Icon name="CheckCircle" size={10} />Одобрен
                  </span>
                )}
              </div>
              <button
                onClick={() => onOpenEditForm(p.id)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0"
              >
                <Icon name="Pencil" size={16} className="text-muted-foreground" />
              </button>
              <button
                onClick={() => onSetConfirmDelete(p.id)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0"
              >
                <Icon name="Trash2" size={16} className="text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Подтверждение удаления */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-destructive" />
            </div>
            <h3 className="font-oswald text-lg font-semibold text-foreground text-center mb-2">Удалить товар?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">Это действие нельзя отменить</p>
            <div className="flex gap-3">
              <button
                onClick={() => onSetConfirmDelete(null)}
                className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl hover:bg-secondary transition-colors text-sm"
              >
                Отмена
              </button>
              <button
                onClick={() => onDelete(confirmDelete)}
                className="flex-1 bg-destructive text-white font-semibold py-2.5 rounded-xl hover:opacity-90 text-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}