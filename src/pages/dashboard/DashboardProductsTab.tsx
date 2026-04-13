import Icon from "@/components/ui/icon";
import type { StoreProduct } from "@/context/StoreContext";

interface DashboardProductsTabProps {
  products: StoreProduct[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function DashboardProductsTab({ products, onAdd, onEdit, onDelete }: DashboardProductsTabProps) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {products.length > 0 ? `${products.length} товар${products.length === 1 ? "" : products.length < 5 ? "а" : "ов"}` : "Нет товаров"}
        </span>
        <button onClick={onAdd}
          className="flex items-center gap-1.5 text-sm text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors font-medium">
          <Icon name="Plus" size={14} /> Добавить товар
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="Package" size={24} className="text-muted-foreground opacity-40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Товаров пока нет</h3>
          <p className="text-sm text-muted-foreground mb-5">Добавь первый товар, чтобы начать продавать</p>
          <button onClick={onAdd}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 text-sm">
            <Icon name="Plus" size={15} /> Добавить товар
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary flex-shrink-0">
                {p.images.length > 0
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
                  {p.images.length > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <Icon name="Image" size={11} />{p.images.length}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => onEdit(p.id)} className="p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0">
                <Icon name="Pencil" size={16} className="text-muted-foreground" />
              </button>
              <button onClick={() => onDelete(p.id)} className="p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0">
                <Icon name="Trash2" size={16} className="text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
