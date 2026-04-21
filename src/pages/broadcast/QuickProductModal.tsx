import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";
import { DimensionPicker } from "@/components/ui/scroll-picker";

const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const UPLOAD_IMAGE_API = "https://functions.poehali.dev/746ac9d7-8e84-4d88-ae53-5ed67f533bf6";

interface QuickProductModalProps {
  imageDataUrl: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  defaultWarehouse?: { cityCode: string; cityName: string; name: string } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function QuickProductModal({ imageDataUrl, sellerId, sellerName, sellerAvatar, defaultWarehouse, onClose, onSaved }: QuickProductModalProps) {
  const { addProduct } = useStore();
  const [name, setName]             = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [retailMarkup, setRetailMarkup]     = useState("0");
  const [stock, setStock]           = useState("10");
  const [weightG, setWeightG] = useState("500");
  const [lengthCm, setLengthCm] = useState("20");
  const [widthCm, setWidthCm]   = useState("15");
  const [heightCm, setHeightCm] = useState("10");
  const [saving, setSaving]       = useState(false);
  const [imgUrl, setImgUrl]       = useState<string | null>(null);
  const [extraImgs, setExtraImgs] = useState<string[]>([]);
  const [imgUploading, setImgUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const resp = await fetch(`${UPLOAD_IMAGE_API}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_url: dataUrl }),
        });
        const data = await resp.json();
        if (data.url) newUrls.push(data.url);
      }
      setExtraImgs(prev => [...prev, ...newUrls]);
    } finally {
      setImgUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${UPLOAD_IMAGE_API}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_url: imageDataUrl }),
        });
        const data = await resp.json();
        if (data.url) setImgUrl(data.url);
      } catch { /* ignore */ }
    })();
  }, [imageDataUrl]);

  const wholesaleNum = wholesalePrice ? Number(wholesalePrice.replace(/\s/g, "").replace(",", ".")) : 0;
  const markupNum = Number(retailMarkup) || 0;
  const retailNum = wholesaleNum > 0 ? Math.round(wholesaleNum * (1 + markupNum / 100)) : 0;

  const handleWholesaleChange = (v: string) => {
    setWholesalePrice(v);
  };
  const handleMarkupChange = (v: string) => {
    setRetailMarkup(v.replace(/\D/g, ""));
  };

  const save = async () => {
    if (!name.trim() || !wholesaleNum || saving) return;
    setSaving(true);
    try {
      await addProduct({
        name: name.trim(),
        price: retailNum || wholesaleNum,
        wholesalePrice: wholesaleNum,
        retailMarkupPct: markupNum,
        category: "Разное",
        description: "",
        images: [imgUrl, ...extraImgs].filter(Boolean) as string[],
        sellerId,
        sellerName,
        sellerAvatar,
        inStock: parseInt(stock) || 0,
        weightG: parseInt(weightG) || 500,
        lengthCm: parseInt(lengthCm) || 20,
        widthCm: parseInt(widthCm) || 15,
        heightCm: parseInt(heightCm) || 10,
        cdekEnabled: !!defaultWarehouse,
        fromCityCode: defaultWarehouse?.cityCode ?? "",
        fromCityName: defaultWarehouse?.cityName ?? "",
      } as never);
      onSaved();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-zinc-900 rounded-t-2xl p-4"
        style={{ paddingBottom: "calc(2rem + 56px + env(safe-area-inset-bottom, 0px))" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-white text-sm">Быстрый товар из эфира</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10">
            <Icon name="X" size={14} className="text-white" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotoUpload}
        />

        <div className="flex gap-3 mb-4">
          <div className="flex flex-col gap-1.5">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
              <img src={imageDataUrl} className="w-full h-full object-cover" />
            </div>
            {extraImgs.map((url, i) => (
              <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
                <img src={url} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setExtraImgs(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <Icon name="X" size={9} className="text-white" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imgUploading}
              className="w-20 h-8 rounded-xl border border-dashed border-white/20 flex items-center justify-center gap-1 hover:border-primary/50 transition-colors disabled:opacity-40"
            >
              {imgUploading
                ? <Icon name="Loader" size={12} className="text-white/40 animate-spin" />
                : <><Icon name="Plus" size={12} className="text-white/40" /><span className="text-[10px] text-white/40">фото</span></>
              }
            </button>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Название товара..."
              className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/60 w-full"
              style={{ fontSize: 16 }}
              autoFocus
            />
            <div className="relative w-24">
              <input
                value={stock}
                onChange={e => setStock(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Кол-во"
                inputMode="numeric"
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/60 w-full pr-7"
                style={{ fontSize: 16 }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 text-[10px]">шт</span>
            </div>
          </div>
        </div>

        {/* Цены */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-3 space-y-2">
          <p className="text-[11px] font-medium text-white/60 flex items-center gap-1.5">
            <Icon name="Layers" size={12} className="text-primary" />
            Цены
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-white/40 mb-1">Оптовая цена, ₽ *</p>
              <input
                value={wholesalePrice}
                onChange={e => handleWholesaleChange(e.target.value)}
                placeholder="Введите стоимость"
                inputMode="decimal"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/60"
                style={{ fontSize: 16 }}
              />
            </div>
            <div>
              <p className="text-[10px] text-white/40 mb-1">Наценка для розницы, %</p>
              <input
                value={retailMarkup}
                onChange={e => handleMarkupChange(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/60"
                style={{ fontSize: 16 }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-white/40 mb-0.5">Оптом</p>
              <p className="font-oswald text-sm font-semibold text-white">
                {wholesaleNum > 0 ? `${wholesaleNum.toLocaleString("ru")} ₽` : "—"}
              </p>
            </div>
            <div className="bg-primary/20 rounded-lg px-3 py-2 text-center">
              <p className="text-[10px] text-white/40 mb-0.5">В розницу</p>
              <p className="font-oswald text-sm font-semibold text-primary">
                {retailNum > 0 ? `${retailNum.toLocaleString("ru")} ₽` : "—"}
              </p>
            </div>
          </div>
        </div>

        {defaultWarehouse ? (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 mb-3">
            <Icon name="Warehouse" size={13} className="text-white/40 flex-shrink-0" />
            <span className="text-[11px] text-white/50">Склад:</span>
            <span className="text-[11px] text-white/80 font-medium truncate">{defaultWarehouse.name} · {defaultWarehouse.cityName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 mb-3">
            <Icon name="AlertTriangle" size={13} className="text-yellow-400 flex-shrink-0" />
            <span className="text-[11px] text-yellow-400">Склад не задан — доставка СДЭК не будет рассчитана</span>
          </div>
        )}

        <div className="mb-3">
          <p className="text-[11px] text-white/40 mb-2">Вес и габариты (для доставки)</p>
          <DimensionPicker
            weightG={weightG} setWeightG={setWeightG}
            lengthCm={lengthCm} setLengthCm={setLengthCm}
            widthCm={widthCm} setWidthCm={setWidthCm}
            heightCm={heightCm} setHeightCm={setHeightCm}
            dark
          />
        </div>

        {!imgUrl && (
          <p className="text-[11px] text-white/30 text-center mb-3">Загружаю фото...</p>
        )}

        <button
          onClick={save}
          disabled={!name.trim() || !wholesaleNum || saving}
          className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Plus" size={15} />}
          {saving ? "Сохраняю..." : "Добавить в магазин"}
        </button>
      </div>
    </div>
  );
}