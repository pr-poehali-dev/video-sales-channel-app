import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/context/StoreContext";
import ProductFormModal from "@/pages/dashboard/products/ProductFormModal";
import ProductCameraModal from "@/pages/dashboard/products/ProductCameraModal";

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

export default function QuickProductModal({
  imageDataUrl, sellerId, sellerName, sellerAvatar, defaultWarehouse, onClose, onSaved,
}: QuickProductModalProps) {
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
  const [imgUploading, setImgUploading] = useState(true);

  // Камера (для кнопки "снять видео" внутри формы)
  const [camOpen, setCamOpen] = useState(false);
  const [camRecording, setCamRecording] = useState(false);
  const [camCountdown, setCamCountdown] = useState(0);
  const camVideoRef = useRef<HTMLVideoElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const camRecorderRef = useRef<MediaRecorder | null>(null);

  const [fVideoUrl, setFVideoUrl] = useState<string | null>(null);
  const [fVideoBlobUrl, setFVideoBlobUrl] = useState<string | null>(null);

  const fromCityCode = defaultWarehouse?.cityCode ?? "";
  const fromCityName = defaultWarehouse?.cityName ?? "";

  // Загружаем скриншот из эфира как первое фото
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(imageDataUrl);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = async ev => {
          const dataUrl = ev.target?.result as string;
          const resp = await fetch(UPLOAD_IMAGE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data_url: dataUrl }) });
          const data = await resp.json();
          if (data.url) setFImages([data.url]);
        };
        reader.readAsDataURL(blob);
      } catch { /* ignore */ }
      finally { setImgUploading(false); }
    })();
  }, [imageDataUrl]);

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
    setCamRecording(false);
    setCamCountdown(0);
  }, [stopCamStream]);

  const handleSave = async () => {
    setFError(null);
    if (!fName.trim()) { setFError("Введите название товара"); return; }
    if (!wholesaleNum || wholesaleNum <= 0) { setFError("Введите оптовую цену"); return; }
    if (imgUploading) {
      await new Promise<void>(resolve => {
        const check = setInterval(() => { if (!imgUploading) { clearInterval(check); resolve(); } }, 300);
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
        camUploading={false}
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
          camOpen={camOpen}
          camRecording={camRecording}
          camCountdown={camCountdown}
          camUploading={false}
          camVideoRef={camVideoRef}
          camStreamRef={camStreamRef}
          camRecorderRef={camRecorderRef}
          setCamOpen={setCamOpen}
          setCamRecording={setCamRecording}
          setCamCountdown={setCamCountdown}
          setCamUploading={() => {}}
          setFVideoBlobUrl={setFVideoBlobUrl}
          setFVideoUrl={setFVideoUrl}
          stopCamStream={stopCamStream}
          closeCamera={closeCamera}
        />
      )}
    </>
  );
}
