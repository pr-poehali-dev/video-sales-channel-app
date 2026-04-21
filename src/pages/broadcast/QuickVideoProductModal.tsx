import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/context/StoreContext";
import ProductFormModal from "@/pages/dashboard/products/ProductFormModal";
import ProductCameraModal from "@/pages/dashboard/products/ProductCameraModal";

const UPLOAD_IMAGE_API = "https://functions.poehali.dev/746ac9d7-8e84-4d88-ae53-5ed67f533bf6";
const UPLOAD_VIDEO_API = "https://functions.poehali.dev/c69feec2-8522-4f96-aca5-363656289751";

async function grabThumbFromBlob(blobUrl: string): Promise<string | null> {
  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve(null), 3000);
    const vid = document.createElement("video");
    vid.src = blobUrl;
    vid.muted = true;
    vid.playsInline = true;
    vid.currentTime = 0.5;
    const done = (result: string | null) => { clearTimeout(timeout); resolve(result); };
    vid.onloadeddata = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = vid.videoWidth || 320;
        canvas.height = vid.videoHeight || 320;
        canvas.getContext("2d")?.drawImage(vid, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/jpeg", 0.7));
      } catch { done(null); }
    };
    vid.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = vid.videoWidth || 320;
        canvas.height = vid.videoHeight || 320;
        canvas.getContext("2d")?.drawImage(vid, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/jpeg", 0.7));
      } catch { done(null); }
    };
    vid.onerror = () => done(null);
    vid.load();
  });
}

interface QuickVideoProductModalProps {
  videoBlobUrl: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  defaultWarehouse?: { cityCode: string; cityName: string; name: string } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function QuickVideoProductModal({
  videoBlobUrl, sellerId, sellerName, sellerAvatar, defaultWarehouse, onClose, onSaved,
}: QuickVideoProductModalProps) {
  const { addProduct } = useStore();

  const [fName, setFName] = useState("");
  const [fCategory, setFCategory] = useState("Другое");
  const [fDesc, setFDesc] = useState("");
  const [fImages, setFImages] = useState<string[]>([]);
  const [fWholesalePrice, setFWholesalePrice] = useState("");
  const [fRetailMarkup, setFRetailMarkup] = useState("0");
  const [fInStock, setFInStock] = useState("1");
  const [fWeightG, setFWeightG] = useState("500");
  const [fLengthCm, setFLengthCm] = useState("20");
  const [fWidthCm, setFWidthCm] = useState("15");
  const [fHeightCm, setFHeightCm] = useState("10");
  const [fIsUsed, setFIsUsed] = useState(false);
  const [fError, setFError] = useState<string | null>(null);
  const [fSaving, setFSaving] = useState(false);
  const [camOpen, setCamOpen] = useState(false);

  // Видео из эфира
  const [fVideoUrl, setFVideoUrl] = useState<string | null>(null);
  const [fVideoBlobUrl, setFVideoBlobUrl] = useState<string | null>(null);
  const [camUploading, setCamUploading] = useState(true);
  const camUploadingRef = useRef(true);

  const camVideoRef = useRef<HTMLVideoElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const camRecorderRef = useRef<MediaRecorder | null>(null);

  const fromCityCode = defaultWarehouse?.cityCode ?? "";
  const fromCityName = defaultWarehouse?.cityName ?? "";

  // Загружаем видео из эфира + делаем превью
  useEffect(() => {
    setFVideoBlobUrl(videoBlobUrl);

    grabThumbFromBlob(videoBlobUrl).then(async thumbDataUrl => {
      if (!thumbDataUrl) return;
      try {
        const res = await fetch(thumbDataUrl);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = async ev => {
          const dataUrl = ev.target?.result as string;
          const resp = await fetch(UPLOAD_IMAGE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data_url: dataUrl }) });
          const data = await resp.json();
          if (data.url) setFImages(prev => prev.includes(data.url) ? prev : [data.url, ...prev]);
        };
        reader.readAsDataURL(blob);
      } catch { /* ignore */ }
    });

    (async () => {
      try {
        const blob = await fetch(videoBlobUrl).then(r => r.blob());
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader(); r.onload = e => res(e.target?.result as string); r.onerror = rej; r.readAsDataURL(blob);
        });
        const resp = await fetch(UPLOAD_VIDEO_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data_url: dataUrl, folder: "products" }) });
        const data = await resp.json();
        if (data.url) setFVideoUrl(data.url);
      } catch (e) { console.error("[quickvideo] error:", e); }
      finally { setCamUploading(false); camUploadingRef.current = false; }
    })();
  }, [videoBlobUrl]);

  const wholesaleNum = fWholesalePrice ? Number(fWholesalePrice.replace(/\s/g, "").replace(",", ".")) : 0;
  const markupNum = Number(fRetailMarkup) || 0;
  const retailNum = wholesaleNum > 0 ? Math.round(wholesaleNum * (1 + markupNum / 100)) : 0;
  const fPrice = retailNum > 0 ? String(retailNum) : fWholesalePrice;

  const stopCamStream = useCallback(() => {
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current = null;
  }, []);

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      camStreamRef.current = stream;
      setCamOpen(true);
      setTimeout(() => {
        if (camVideoRef.current) {
          camVideoRef.current.srcObject = stream;
          camVideoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      alert("Нет доступа к камере. Разрешите в настройках браузера.");
    }
  };

  const closeCamera = useCallback(() => {
    stopCamStream();
    setCamOpen(false);
  }, [stopCamStream]);

  const handleSave = async () => {
    setFError(null);
    if (!fName.trim()) { setFError("Введите название товара"); return; }
    if (!wholesaleNum || wholesaleNum <= 0) { setFError("Введите оптовую цену"); return; }
    if (camUploadingRef.current) {
      await new Promise<void>(resolve => {
        const check = setInterval(() => { if (!camUploadingRef.current) { clearInterval(check); resolve(); } }, 300);
      });
    }
    setFSaving(true);
    try {
      await addProduct({
        name: fName.trim(),
        price: retailNum || wholesaleNum,
        wholesalePrice: wholesaleNum,
        retailMarkupPct: markupNum,
        category: fCategory,
        description: fDesc,
        images: fImages,
        videoUrl: fVideoUrl ?? undefined,
        sellerId,
        sellerName,
        sellerAvatar,
        inStock: parseInt(fInStock) || 1,
        weightG: parseInt(fWeightG) || 500,
        lengthCm: parseInt(fLengthCm) || 20,
        widthCm: parseInt(fWidthCm) || 15,
        heightCm: parseInt(fHeightCm) || 10,
        cdekEnabled: !!defaultWarehouse,
        fromCityCode,
        fromCityName,
        isUsed: fIsUsed,
      } as never);
      onSaved();
    } catch { setFError("Ошибка сохранения, попробуйте ещё раз"); }
    finally { setFSaving(false); }
  };

  return (
    <>
      <ProductFormModal
        editId={null}
        fVideoBlobUrl={fVideoBlobUrl}
        fVideoUrl={fVideoUrl}
        camUploading={camUploading}
        onOpenCamera={openCamera}
        onClearVideo={() => { setFVideoBlobUrl(null); setFVideoUrl(null); }}
        fName={fName} setFName={setFName}
        fCategory={fCategory} setFCategory={setFCategory}
        fDesc={fDesc} setFDesc={setFDesc}
        fWholesalePrice={fWholesalePrice}
        fRetailMarkup={fRetailMarkup}
        fPrice={fPrice}
        onWholesalePriceChange={setFWholesalePrice}
        onRetailMarkupChange={v => setFRetailMarkup(v.replace(/\D/g, ""))}
        fInStock={fInStock} setFInStock={setFInStock}
        fFromCityName={fromCityName}
        fWeightG={fWeightG} setFWeightG={setFWeightG}
        fLengthCm={fLengthCm} setFLengthCm={setFLengthCm}
        fWidthCm={fWidthCm} setFWidthCm={setFWidthCm}
        fHeightCm={fHeightCm} setFHeightCm={setFHeightCm}
        fImages={fImages} setFImages={setFImages}
        fIsUsed={fIsUsed} setFIsUsed={setFIsUsed}
        fError={fError}
        saving={fSaving}
        onSave={handleSave}
        onClose={onClose}
      />
      {camOpen && (
        <ProductCameraModal
          camVideoRef={camVideoRef}
          onClose={closeCamera}
          onVideoReady={(blobUrl, uploadUrl) => {
            setFVideoBlobUrl(blobUrl);
            setFVideoUrl(uploadUrl);
            closeCamera();
          }}
          camStreamRef={camStreamRef}
          camRecorderRef={camRecorderRef}
        />
      )}
    </>
  );
}
