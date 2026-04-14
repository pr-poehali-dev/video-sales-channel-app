import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";

const CATEGORIES = [
  "Украшения", "Одежда", "Красота", "Аксессуары",
  "Электроника", "Дом и сад", "Детские товары", "Другое",
];

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const CDEK_API = "https://functions.poehali.dev/937e27f3-191a-445d-b034-61bd84ed5381";

interface CdekCity { code: number; city: string; region: string; }

interface Props {
  warehouses: { id: string; cityCode: number; cityName: string; isDefault: boolean; }[];
}

export default function DashboardProductsTab({ warehouses }: Props) {
  const { user } = useAuth();
  const { addProduct, updateProduct, deleteProduct, getSellerProducts } = useStore();

  const products = user ? getSellerProducts(user.id) : [];

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [fName, setFName] = useState("");
  const [fPrice, setFPrice] = useState("");
  const [fCategory, setFCategory] = useState(CATEGORIES[0]);
  const [fDesc, setFDesc] = useState("");
  const [fImages, setFImages] = useState<string[]>([]);
  const [fError, setFError] = useState<string | null>(null);
  const [fWeightG, setFWeightG] = useState("500");
  const [fLengthCm, setFLengthCm] = useState("20");
  const [fWidthCm, setFWidthCm] = useState("15");
  const [fHeightCm, setFHeightCm] = useState("10");
  const [fCdek, setFCdek] = useState(true);
  const [fNalog, setFNalog] = useState(false);
  const [fFitting, setFFitting] = useState(false);
  const [fInStock, setFInStock] = useState("1");
  const [fFromCityCode, setFFromCityCode] = useState(0);
  const [fFromCityName, setFFromCityName] = useState("");
  const [fCityQuery, setFCityQuery] = useState("");
  const [fCitySuggestions, setFCitySuggestions] = useState<CdekCity[]>([]);
  const [fCityLoading, setFCityLoading] = useState(false);

  useEffect(() => {
    if (fCityQuery.length < 2) { setFCitySuggestions([]); return; }
    if (fFromCityName && fCityQuery === fFromCityName) return;
    const t = setTimeout(async () => {
      setFCityLoading(true);
      try {
        const r = await fetch(`${CDEK_API}?action=cities&q=${encodeURIComponent(fCityQuery)}`);
        setFCitySuggestions(await r.json());
      } catch { setFCitySuggestions([]); } finally { setFCityLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [fCityQuery, fFromCityName]);

  const resetForm = () => {
    setFName(""); setFPrice(""); setFCategory(CATEGORIES[0]); setFDesc(""); setFImages([]); setFError(null);
    setFWeightG("500"); setFLengthCm("20"); setFWidthCm("15"); setFHeightCm("10");
    setFCdek(true); setFNalog(false); setFFitting(false);
    setFInStock("1"); setFFromCityCode(0); setFFromCityName(""); setFCityQuery(""); setFCitySuggestions([]);
  };

  const openAddForm = () => {
    setEditId(null);
    resetForm();
    const def = warehouses.find(w => w.isDefault) ?? warehouses[0] ?? null;
    if (def) {
      setFFromCityCode(def.cityCode);
      setFFromCityName(def.cityName);
      setFCityQuery(def.cityName);
    }
    setShowForm(true);
  };

  const openEditForm = (id: string) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    setEditId(id);
    setFName(p.name); setFPrice(String(p.price)); setFCategory(p.category);
    setFDesc(p.description); setFImages(p.images); setFError(null);
    setFWeightG(String((p as { weightG?: number }).weightG ?? 500));
    setFLengthCm(String((p as { lengthCm?: number }).lengthCm ?? 20));
    setFWidthCm(String((p as { widthCm?: number }).widthCm ?? 15));
    setFHeightCm(String((p as { heightCm?: number }).heightCm ?? 10));
    setFCdek((p as { cdekEnabled?: boolean }).cdekEnabled ?? true);
    setFNalog((p as { nalogEnabled?: boolean }).nalogEnabled ?? false);
    setFFitting((p as { fittingEnabled?: boolean }).fittingEnabled ?? false);
    const stock = (p as { inStock?: number }).inStock ?? 1;
    setFInStock(String(stock));
    const cityCode = (p as { fromCityCode?: number }).fromCityCode ?? 0;
    const cityName = (p as { fromCityName?: string }).fromCityName ?? "";
    setFFromCityCode(cityCode);
    setFFromCityName(cityName);
    setFCityQuery(cityName);
    setFCitySuggestions([]);
    setShowForm(true);
  };

  const handleSave = () => {
    setFError(null);
    if (!fName.trim()) { setFError("Введите название товара"); return; }
    const priceNum = Number(fPrice.replace(/\s/g, "").replace(",", "."));
    if (!fPrice.trim() || isNaN(priceNum) || priceNum <= 0) { setFError("Введите корректную цену"); return; }
    if (fCdek && !fFromCityCode) { setFError("Укажите склад отправления для доставки СДЭК"); return; }

    const extraFields = {
      weightG: Number(fWeightG) || 500,
      lengthCm: Number(fLengthCm) || 20,
      widthCm: Number(fWidthCm) || 15,
      heightCm: Number(fHeightCm) || 10,
      cdekEnabled: fCdek,
      nalogEnabled: fNalog,
      fittingEnabled: fFitting,
      fromCityCode: fFromCityCode,
      fromCityName: fFromCityName,
      inStock: Number(fInStock) || 1,
    };

    if (editId) {
      updateProduct(editId, {
        name: fName.trim(), price: priceNum, category: fCategory,
        description: fDesc.trim(), images: fImages, ...extraFields,
      });
    } else {
      addProduct({
        name: fName.trim(), price: priceNum, category: fCategory,
        description: fDesc.trim(), images: fImages,
        sellerId: user!.id, sellerName: user!.name, sellerAvatar: user!.avatar,
        ...extraFields,
      });
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    deleteProduct(id);
    setConfirmDelete(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {products.length > 0 ? `${products.length} товар${products.length === 1 ? "" : products.length < 5 ? "а" : "ов"}` : "Нет товаров"}
        </span>
        <button onClick={openAddForm}
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
          <button onClick={openAddForm}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 text-sm">
            <Icon name="Plus" size={15} /> Добавить товар
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {products.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary flex-shrink-0 relative">
                {(p as { videoUrl?: string }).videoUrl ? (
                  <>
                    <video src={(p as { videoUrl?: string }).videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
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
              </div>
              <button onClick={() => openEditForm(p.id)} className="p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0">
                <Icon name="Pencil" size={16} className="text-muted-foreground" />
              </button>
              <button onClick={() => setConfirmDelete(p.id)} className="p-2 hover:bg-secondary rounded-lg transition-colors flex-shrink-0">
                <Icon name="Trash2" size={16} className="text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Форма товара */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 animate-fade-in" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
              <h3 className="font-oswald text-lg font-semibold text-foreground tracking-wide">
                {editId ? "Редактировать товар" : "Новый товар"}
              </h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70">
                <Icon name="X" size={15} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">

              {/* Название */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Название *</label>
                <input value={fName} onChange={e => setFName(e.target.value)}
                  placeholder="Например: Серьги золотые с жемчугом"
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
              </div>

              {/* Цена и категория */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Цена, ₽ *</label>
                  <input value={fPrice} onChange={e => setFPrice(e.target.value)}
                    placeholder="1990" inputMode="decimal"
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Категория</label>
                  <select value={fCategory} onChange={e => setFCategory(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Описание */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)}
                  placeholder="Материал, размер, особенности..." rows={3}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors resize-none" />
              </div>

              {/* Количество и склад */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Количество, шт *</label>
                  <input
                    value={fInStock}
                    onChange={e => setFInStock(e.target.value.replace(/\D/g, ""))}
                    placeholder="1" inputMode="numeric"
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div className="relative">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Город отправки {fCdek && <span className="text-destructive">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      value={fCityQuery}
                      onChange={e => { setFCityQuery(e.target.value); setFFromCityCode(0); setFFromCityName(""); }}
                      placeholder="Например: Москва"
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors pr-8"
                    />
                    {fCityLoading && <Icon name="Loader" size={14} className="absolute right-3 top-3 text-muted-foreground animate-spin" />}
                    {fFromCityCode > 0 && !fCityLoading && <Icon name="CheckCircle" size={14} className="absolute right-3 top-3 text-green-500" />}
                  </div>
                  {fCitySuggestions.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 bg-card border border-border rounded-xl shadow-xl mt-1 overflow-hidden">
                      {fCitySuggestions.map(c => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => { setFFromCityCode(c.code); setFFromCityName(c.city); setFCityQuery(c.city); setFCitySuggestions([]); }}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border/50 last:border-0"
                        >
                          <span className="font-medium text-foreground">{c.city}</span>
                          <span className="text-muted-foreground text-xs ml-1">{c.region}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Вес и габариты */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Вес и габариты (для расчёта доставки)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Вес, г", val: fWeightG, set: setFWeightG, placeholder: "500" },
                    { label: "Дл., см", val: fLengthCm, set: setFLengthCm, placeholder: "20" },
                    { label: "Шир., см", val: fWidthCm, set: setFWidthCm, placeholder: "15" },
                    { label: "Выс., см", val: fHeightCm, set: setFHeightCm, placeholder: "10" },
                  ].map(({ label, val, set, placeholder }) => (
                    <div key={label}>
                      <label className="text-[10px] text-muted-foreground mb-1 block">{label}</label>
                      <input value={val} onChange={e => set(e.target.value.replace(/\D/g, ""))}
                        placeholder={placeholder} inputMode="numeric"
                        className="w-full bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground text-center outline-none focus:border-primary/50 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Опции */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Опции доставки и оплаты</label>
                <div className="space-y-2">
                  {[
                    { key: "cdek" as const, label: "Доставка СДЭК", sub: "Покупатель выбирает ПВЗ или курьер", state: fCdek, setter: setFCdek },
                    { key: "nalog" as const, label: "Безопасная сделка (Наложка)", sub: "Оплата при получении", state: fNalog, setter: setFNalog },
                    { key: "fitting" as const, label: "Возможность примерки", sub: "Перед оплатой на ПВЗ", state: fFitting, setter: setFFitting },
                  ].map(({ key, label, sub, state, setter }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group bg-secondary rounded-xl px-3 py-2.5">
                      <div
                        onClick={() => setter(!state)}
                        className={`w-10 h-5 rounded-full transition-all flex-shrink-0 relative ${state ? "bg-primary" : "bg-border"}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${state ? "left-5" : "left-0.5"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{sub}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {fError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 text-sm text-destructive">{fError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={handleSave}
                  className="flex-1 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm">
                  {editId ? "Сохранить" : "Добавить товар"}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-5 border border-border text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm">
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Подтверждение удаления товара */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-destructive" />
            </div>
            <h3 className="font-oswald text-lg font-semibold text-foreground text-center mb-2">Удалить товар?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">Это действие нельзя отменить</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl hover:bg-secondary transition-colors text-sm">
                Отмена
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
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