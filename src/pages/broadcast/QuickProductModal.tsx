import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";

const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

interface QuickProductModalProps {
  imageDataUrl: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  defaultWarehouse?: { cityCode: number; cityName: string; name: string } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function QuickProductModal({ imageDataUrl, sellerId, sellerName, sellerAvatar, defaultWarehouse, onClose, onSaved }: QuickProductModalProps) {
  const { addProduct } = useStore();
  const [name, setName]       = useState("");
  const [price, setPrice]     = useState("");
  const [stock, setStock]     = useState("10");
  const [weightG, setWeightG] = useState("500");
  const [lengthCm, setLengthCm] = useState("20");
  const [widthCm, setWidthCm]   = useState("15");
  const [heightCm, setHeightCm] = useState("10");
  const [saving, setSaving]   = useState(false);
  const [imgUrl, setImgUrl]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API}?action=upload_image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_url: imageDataUrl }),
        });
        const data = await resp.json();
        if (data.url) setImgUrl(data.url);
      } catch { /* ignore */ }
    })();
  }, [imageDataUrl]);

  const save = async () => {
    if (!name.trim() || !price || saving) return;
    setSaving(true);
    try {
      await addProduct({
        name: name.trim(),
        price: parseFloat(price),
        category: "Разное",
        description: "",
        images: imgUrl ? [imgUrl] : [],
        sellerId,
        sellerName,
        sellerAvatar,
        inStock: parseInt(stock) || 0,
        weightG: parseInt(weightG) || 500,
        lengthCm: parseInt(lengthCm) || 20,
        widthCm: parseInt(widthCm) || 15,
        heightCm: parseInt(heightCm) || 10,
        cdekEnabled: !!defaultWarehouse,
        fromCityCode: defaultWarehouse?.cityCode ?? 0,
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

        <div className="flex gap-3 mb-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
            <img src={imageDataUrl} className="w-full h-full object-cover" />
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
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  value={price}
                  onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="Цена"
                  type="number"
                  className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/60 w-full pr-6"
                  style={{ fontSize: 16 }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">₽</span>
              </div>
              <div className="relative w-20">
                <input
                  value={stock}
                  onChange={e => setStock(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Кол-во"
                  type="number"
                  className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/60 w-full pr-5"
                  style={{ fontSize: 16 }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 text-[10px]">шт</span>
              </div>
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
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "Вес, г", val: weightG, set: setWeightG },
              { label: "Дл., см", val: lengthCm, set: setLengthCm },
              { label: "Шир., см", val: widthCm, set: setWidthCm },
              { label: "Выс., см", val: heightCm, set: setHeightCm },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <p className="text-[9px] text-white/30 mb-1 text-center">{label}</p>
                <input
                  value={val}
                  onChange={e => set(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-2 py-2 text-sm text-white text-center outline-none focus:border-primary/50 transition-colors"
                  style={{ fontSize: 15 }}
                />
              </div>
            ))}
          </div>
        </div>

        {!imgUrl && (
          <p className="text-[11px] text-white/30 text-center mb-3">Загружаю фото...</p>
        )}

        <button
          onClick={save}
          disabled={!name.trim() || !price || saving}
          className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Plus" size={15} />}
          {saving ? "Сохраняю..." : "Добавить в магазин"}
        </button>
      </div>
    </div>
  );
}
