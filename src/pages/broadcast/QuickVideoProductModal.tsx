import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";

const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

async function grabThumbFromBlob(blobUrl: string): Promise<string | null> {
  return new Promise(resolve => {
    const vid = document.createElement("video");
    vid.src = blobUrl;
    vid.muted = true;
    vid.playsInline = true;
    vid.currentTime = 0.5;
    vid.onloadeddata = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = vid.videoWidth || 640;
        canvas.height = vid.videoHeight || 640;
        canvas.getContext("2d")?.drawImage(vid, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch { resolve(null); }
    };
    vid.onerror = () => resolve(null);
  });
}

interface QuickVideoProductModalProps {
  videoBlobUrl: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  defaultWarehouse?: { cityCode: number; cityName: string; name: string } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function QuickVideoProductModal({ videoBlobUrl, sellerId, sellerName, sellerAvatar, defaultWarehouse, onClose, onSaved }: QuickVideoProductModalProps) {
  const { addProduct } = useStore();
  const [name, setName]         = useState("");
  const [price, setPrice]       = useState("");
  const [stock, setStock]       = useState("10");
  const [weightG, setWeightG]   = useState("500");
  const [lengthCm, setLengthCm] = useState("20");
  const [widthCm, setWidthCm]   = useState("15");
  const [heightCm, setHeightCm] = useState("10");
  const [saving, setSaving]     = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Параллельно: захват превью и загрузка видео
        const [thumbDataUrl, blob] = await Promise.all([
          grabThumbFromBlob(videoBlobUrl),
          fetch(videoBlobUrl).then(r => r.blob()),
        ]);

        // Загружаем превью
        if (thumbDataUrl) {
          fetch(`${API}?action=upload_image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data_url: thumbDataUrl }),
          }).then(r => r.json()).then(d => { if (d.url) setThumbUrl(d.url); }).catch(() => {});
        }

        // Загружаем видео напрямую в S3 через presigned URL
        const mimeType = blob.type || "video/mp4";
        const urlResp = await fetch(`${API}?action=get_video_upload_url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mime: mimeType }),
        });
        const { upload_url, cdn_url } = await urlResp.json();
        await fetch(upload_url, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: blob,
        });
        setVideoUrl(cdn_url);
      } catch { /* ignore */ }
    })();
  }, [videoBlobUrl]);

  const save = async () => {
    if (!name.trim() || !price || saving) return;
    setSaving(true);
    try {
      await addProduct({
        name: name.trim(),
        price: parseFloat(price),
        category: "Разное",
        description: "",
        images: thumbUrl ? [thumbUrl] : [],
        videoUrl: videoUrl ?? undefined,
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
          <p className="font-semibold text-white text-sm">Видео-товар из эфира</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10">
            <Icon name="X" size={14} className="text-white" />
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-black border border-orange-500/40 relative">
            <video
              src={videoBlobUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 right-1 bg-orange-500 rounded-full p-0.5">
              <Icon name="Video" size={9} className="text-white" />
            </div>
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

        {!videoUrl && (
          <p className="text-[11px] text-orange-400/70 text-center mb-3">Загружаю видео...</p>
        )}

        <button
          onClick={save}
          disabled={!name.trim() || !price || saving}
          className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Plus" size={15} />}
          {saving ? "Сохраняю..." : "Добавить видео-товар"}
        </button>
      </div>
    </div>
  );
}