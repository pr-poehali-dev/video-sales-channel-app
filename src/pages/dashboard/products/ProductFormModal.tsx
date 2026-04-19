import { createPortal, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

const UPLOAD_IMAGE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

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
  // Ошибка и действия
  fError: string | null;
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
  fError,
  onSave, onClose,
}: ProductFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imgUploading, setImgUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setImgUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const resp = await fetch(`${UPLOAD_IMAGE_API}?action=upload_image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_url: dataUrl }),
        });
        const data = await resp.json();
        if (data.url) newUrls.push(data.url);
      }
      setFImages([...fImages, ...newUrls]);
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
            <label className="text-xs text-muted-foreground mb-1 block">Название *</label>
            <input value={fName} onChange={e => setFName(e.target.value)}
              placeholder="Например: Серьги золотые с жемчугом"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
          </div>

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
                <label className="text-xs text-muted-foreground mb-1 block">Оптовая цена, ₽ *</label>
                <input value={fWholesalePrice} onChange={e => onWholesalePriceChange(e.target.value)}
                  placeholder="400" inputMode="decimal"
                  className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
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
              <label className="text-xs text-muted-foreground mb-1 block">Количество, шт *</label>
              <input
                value={fInStock}
                onChange={e => setFInStock(e.target.value.replace(/\D/g, ""))}
                placeholder="1" inputMode="numeric"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
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
            <label className="text-xs text-muted-foreground mb-2 block">Вес и габариты (для расчёта доставки)</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Вес, г",    val: fWeightG,  set: setFWeightG,  placeholder: "500" },
                { label: "Дл., см",   val: fLengthCm, set: setFLengthCm, placeholder: "20" },
                { label: "Шир., см",  val: fWidthCm,  set: setFWidthCm,  placeholder: "15" },
                { label: "Выс., см",  val: fHeightCm, set: setFHeightCm, placeholder: "10" },
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

          {fError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 text-sm text-destructive">{fError}</div>
          )}
        </div>

        {/* Зафиксированные кнопки снизу */}
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "16px 20px", display: "flex", gap: 12, background: "var(--card)" }}>
          <button onClick={onSave}
            className="flex-1 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm">
            {editId ? "Сохранить" : "Добавить товар"}
          </button>
          <button onClick={onClose}
            className="px-5 border border-border text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm">
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}