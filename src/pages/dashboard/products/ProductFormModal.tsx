import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { DimensionPicker } from "@/components/ui/scroll-picker";

const UPLOAD_IMAGE_API = "https://functions.poehali.dev/746ac9d7-8e84-4d88-ae53-5ed67f533bf6";

const CATEGORIES = [
  "Украшения", "Одежда", "Красота", "Аксессуары",
  "Электроника", "Дом и сад", "Детские товары", "Другое",
];

interface ProductFormModalProps {
  editId: string | null;
  // Видео
  fVideoBlobUrl: string | null;
  fVideoUrl: string | null;
  camUploading: boolean;
  onOpenCamera: () => void;
  onClearVideo: () => void;
  // Основные поля
  fName: string; setFName: (v: string) => void;
  fCategory: string; setFCategory: (v: string) => void;
  fDesc: string; setFDesc: (v: string) => void;
  // Цены
  fWholesalePrice: string;
  fRetailMarkup: string;
  fPrice: string;
  onWholesalePriceChange: (v: string) => void;
  onRetailMarkupChange: (v: string) => void;
  // Количество и город
  fInStock: string; setFInStock: (v: string) => void;
  fFromCityName: string;
  // Вес и габариты
  fWeightG: string; setFWeightG: (v: string) => void;
  fLengthCm: string; setFLengthCm: (v: string) => void;
  fWidthCm: string; setFWidthCm: (v: string) => void;
  fHeightCm: string; setFHeightCm: (v: string) => void;
  // Фото
  fImages: string[];
  setFImages: (v: string[]) => void;
  // Опции (скрыты из UI, значения управляются снаружи)
  fCdek?: boolean;
  fNalog?: boolean;
  fFitting?: boolean;
  setFCdek?: (v: boolean) => void;
  setFNalog?: (v: boolean) => void;
  setFFitting?: (v: boolean) => void;
  // Б/у
  fIsUsed: boolean;
  setFIsUsed: (v: boolean) => void;
  isIndividual?: boolean;
  // Ошибка и действия
  fError: string | null;
  saving?: boolean;
  onSave: () => void;
  onClose: () => void;
}

export default function ProductFormModal({
  editId,
  fVideoBlobUrl, fVideoUrl, camUploading, onOpenCamera, onClearVideo,
  fName, setFName,
  fCategory, setFCategory,
  fDesc, setFDesc,
  fWholesalePrice, fRetailMarkup, fPrice,
  onWholesalePriceChange, onRetailMarkupChange,
  fInStock, setFInStock,
  fFromCityName,
  fWeightG, setFWeightG,
  fLengthCm, setFLengthCm,
  fWidthCm, setFWidthCm,
  fHeightCm, setFHeightCm,
  fImages, setFImages,
  fIsUsed, setFIsUsed,
  isIndividual,
  fError,
  saving,
  onSave, onClose,
}: ProductFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imgUploading, setImgUploading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const fieldError = (field: string): string | null => {
    if (!touched[field]) return null;
    if (field === "name" && !fName.trim()) return "Введите название товара";
    if (field === "price" && (!fWholesalePrice.trim() || Number(fWholesalePrice.replace(/\s/g, "").replace(",", ".")) <= 0)) return "Введите оптовую цену";
    if (field === "stock" && (!fInStock || Number(fInStock) <= 0)) return "Укажите количество товара";
    return null;
  };

  const handleSaveWithValidation = () => {
    setTouched({ name: true, price: true, stock: true });
    onSave();
  };

  const compressToBlob = (file: File, maxPx = 1200, quality = 0.82): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("canvas error")), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = url;
    });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setImgUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const blob = await compressToBlob(file);
        const dataUrl = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = ev => res(ev.target?.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
        const resp = await fetch(UPLOAD_IMAGE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_url: dataUrl }),
        });
        const data = await resp.json();
        if (data.url) newUrls.push(data.url);
      }
      setFImages([...fImages, ...newUrls]);
    } catch (err) {
      console.error("[UPLOAD_IMAGE] error", err);
      alert("Не удалось загрузить фото. Попробуйте ещё раз.");
    } finally {
      setImgUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: "hsl(var(--card))", display: "flex", flexDirection: "column" }}>
      <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

        {/* Шапка */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <h3 className="font-oswald text-lg font-semibold text-foreground tracking-wide">
            {editId ? "Редактировать товар" : "Новый товар"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70">
            <Icon name="X" size={15} className="text-muted-foreground" />
          </button>
        </div>

        {/* Прокручиваемый контент */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Видео товара */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Видео товара</label>
            {fVideoBlobUrl || fVideoUrl ? (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-orange-500/40">
                <video
                  src={fVideoBlobUrl ?? fVideoUrl ?? ""}
                  autoPlay loop muted playsInline
                  className="w-full h-full object-cover"
                />
                {camUploading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <Icon name="Loader" size={20} className="text-white animate-spin" />
                    <span className="text-white text-xs">Загружаю видео...</span>
                  </div>
                )}
                {!camUploading && (
                  <div className="absolute top-2 right-2 flex gap-2">
                    {fVideoUrl && (
                      <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Загружено</span>
                    )}
                    <button
                      type="button"
                      onClick={onClearVideo}
                      className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <Icon name="X" size={12} className="text-white" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenCamera}
                className="w-full aspect-video rounded-xl border-2 border-dashed border-border hover:border-orange-500/50 bg-secondary flex flex-col items-center justify-center gap-2 transition-colors group"
              >
                <div className="w-12 h-12 rounded-full bg-orange-500/10 group-hover:bg-orange-500/20 flex items-center justify-center transition-colors">
                  <Icon name="Video" size={22} className="text-orange-500" />
                </div>
                <span className="text-sm font-medium text-foreground">Снять видео товара</span>
                <span className="text-xs text-muted-foreground">5 секунд с камеры</span>
              </button>
            )}
          </div>

          {/* Фото товара */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Фото товара</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <div className="flex gap-2 flex-wrap">
              {fImages.map((url, i) => (
                <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden bg-secondary border border-border flex-shrink-0">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFImages(fImages.filter((_, j) => j !== i))}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <Icon name="X" size={10} className="text-white" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imgUploading}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-secondary flex flex-col items-center justify-center gap-1 transition-colors group flex-shrink-0 disabled:opacity-50"
              >
                {imgUploading ? (
                  <Icon name="Loader" size={18} className="text-muted-foreground animate-spin" />
                ) : (
                  <>
                    <Icon name="Camera" size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-[10px] text-muted-foreground">Добавить</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Название */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Название <span className="text-destructive">*</span></label>
            <input value={fName} onChange={e => { setFName(e.target.value); setTouched(t => ({ ...t, name: true })); }}
              onBlur={() => setTouched(t => ({ ...t, name: true }))}
              placeholder="Например: Серьги золотые с жемчугом"
              className={`w-full bg-secondary border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors ${fieldError("name") ? "border-destructive bg-destructive/5" : "border-border"}`} />
            {fieldError("name") && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><span>⚠</span>{fieldError("name")}</p>}
          </div>

          {/* Б/у */}
          <button type="button" onClick={() => !isIndividual && setFIsUsed(!fIsUsed)}
            disabled={isIndividual}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
              fIsUsed ? "border-orange-500/50 bg-orange-500/8" : "border-border bg-secondary hover:border-border/80"
            } ${isIndividual ? "opacity-70 cursor-not-allowed" : ""}`}>
            <div className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
              fIsUsed ? "bg-orange-500 border-orange-500" : "border-border"
            }`}>
              {fIsUsed && <Icon name="Check" size={12} className="text-white" />}
            </div>
            <div>
              <p className={`text-sm font-medium ${fIsUsed ? "text-orange-700" : "text-foreground"}`}>Товар б/у (бывший в употреблении)</p>
              <p className="text-[11px] text-muted-foreground">
                {isIndividual ? "Физлицам разрешено продавать только б/у товары" : "На карточке появится пометка «б/у»"}
              </p>
            </div>
          </button>

          {/* Категория */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Категория</label>
            <select value={fCategory} onChange={e => setFCategory(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Цены */}
          <div className="bg-secondary/60 border border-border rounded-xl p-3 space-y-3">
            <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Icon name="Layers" size={13} className="text-primary" />
              Цены
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Оптовая цена, ₽ <span className="text-destructive">*</span></label>
                <input value={fWholesalePrice} onChange={e => { onWholesalePriceChange(e.target.value); setTouched(t => ({ ...t, price: true })); }}
                  onBlur={() => setTouched(t => ({ ...t, price: true }))}
                  placeholder="400" inputMode="decimal"
                  className={`w-full bg-card border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors ${fieldError("price") ? "border-destructive bg-destructive/5" : "border-border"}`} />
                {fieldError("price") && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><span>⚠</span>{fieldError("price")}</p>}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Наценка для розницы, %</label>
                <input value={fRetailMarkup} onChange={e => onRetailMarkupChange(e.target.value)}
                  placeholder="0" inputMode="numeric"
                  className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-card rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Оптом</p>
                <p className="font-oswald text-base font-semibold text-foreground">
                  {fWholesalePrice ? `${Number(fWholesalePrice.replace(/\s/g, "").replace(",", ".")).toLocaleString("ru")} ₽` : "—"}
                </p>
              </div>
              <div className="flex-1 bg-primary/10 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">В розницу</p>
                <p className="font-oswald text-base font-semibold text-primary">
                  {fPrice && Number(fPrice) > 0 ? `${Number(fPrice).toLocaleString("ru")} ₽` : "—"}
                </p>
              </div>
            </div>

          </div>

          {/* Описание */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
            <textarea value={fDesc} onChange={e => setFDesc(e.target.value)}
              placeholder="Материал, размер, особенности..." rows={3}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors resize-none" />
          </div>

          {/* Количество и город отправки */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Количество, шт <span className="text-destructive">*</span></label>
              <input
                value={fInStock}
                onChange={e => { setFInStock(e.target.value.replace(/\D/g, "")); setTouched(t => ({ ...t, stock: true })); }}
                onBlur={() => setTouched(t => ({ ...t, stock: true }))}
                placeholder="1" inputMode="numeric"
                className={`w-full bg-secondary border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors ${fieldError("stock") ? "border-destructive bg-destructive/5" : "border-border"}`}
              />
              {fieldError("stock") && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><span>⚠</span>{fieldError("stock")}</p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Город отправки</label>
              <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5 min-h-[42px]">
                <Icon name="MapPin" size={13} className="text-primary flex-shrink-0" />
                <span className="text-sm text-foreground truncate">
                  {fFromCityName || <span className="text-muted-foreground text-xs">Не задан — настрой в «Магазин»</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Вес и габариты */}
          <div>
            <label className="text-xs text-muted-foreground mb-3 block">Вес и габариты (для расчёта доставки)</label>
            <DimensionPicker
              weightG={fWeightG} setWeightG={setFWeightG}
              lengthCm={fLengthCm} setLengthCm={setFLengthCm}
              widthCm={fWidthCm} setWidthCm={setFWidthCm}
              heightCm={fHeightCm} setHeightCm={setFHeightCm}
            />
          </div>

          {fError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 text-sm text-destructive">{fError}</div>
          )}
        </div>

        {/* Зафиксированные кнопки снизу */}
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "16px 20px", display: "flex", gap: 12, background: "var(--card)" }}>
          <button
            onClick={handleSaveWithValidation}
            disabled={imgUploading || camUploading || saving}
            className="flex-1 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {(imgUploading || saving) && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {imgUploading ? "Загрузка фото..." : saving ? "Сохраняем..." : camUploading ? "Загрузка видео..." : editId ? "Сохранить" : "Добавить товар"}
          </button>
          <button onClick={onClose} disabled={saving}
            className="px-5 border border-border text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm disabled:opacity-40">
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}