import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import ProductList from "./products/ProductList";
import ProductFormModal from "./products/ProductFormModal";
import ProductCameraRecorder from "./products/ProductCameraRecorder";
import Icon from "@/components/ui/icon";
import { useSellerProfileCheck } from "@/hooks/useSellerProfileCheck";
import type { SellerProfileIssue } from "@/hooks/useSellerProfileCheck";

const CATEGORIES = [
  "Украшения", "Одежда", "Красота", "Аксессуары",
  "Электроника", "Дом и сад", "Детские товары", "Другое",
];

const UPLOAD_VIDEO_API = "https://functions.poehali.dev/c69feec2-8522-4f96-aca5-363656289751";
const CDEK_API = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";

interface CdekCity { code: string; city: string; region: string; }

interface Props {
  warehouses: { id: string; cityCode: string; cityName: string; isDefault: boolean; }[];
  onGoToProfile?: () => void;
  autoOpenForm?: boolean;
  onAutoOpenDone?: () => void;
}

export default function DashboardProductsTab({ warehouses, onGoToProfile, autoOpenForm, onAutoOpenDone }: Props) {
  const { user } = useAuth();
  const { addProduct, updateProduct, deleteProduct, getSellerProducts } = useStore();
  const { check, checking } = useSellerProfileCheck(user?.id);

  const products = user ? getSellerProducts(user.id) : [];

  const [showForm,       setShowForm]       = useState(false);
  const [editId,         setEditId]         = useState<string | null>(null);
  const [confirmDelete,  setConfirmDelete]  = useState<string | null>(null);
  const [profileIssues,  setProfileIssues]  = useState<SellerProfileIssue[] | null>(null);
  const [profileExists,  setProfileExists]  = useState(true);
  const [sellerLegalType, setSellerLegalType] = useState<string>("");

  // ── Поля формы ────────────────────────────────────────────────────────────
  const [fName,          setFName]          = useState("");
  const [fPrice,         setFPrice]         = useState("");
  const [fCategory,      setFCategory]      = useState(CATEGORIES[0]);
  const [fDesc,          setFDesc]          = useState("");
  const [fImages,        setFImages]        = useState<string[]>([]);
  const [fError,         setFError]         = useState<string | null>(null);
  const [fWeightG,       setFWeightG]       = useState("500");
  const [fLengthCm,      setFLengthCm]      = useState("20");
  const [fWidthCm,       setFWidthCm]       = useState("15");
  const [fHeightCm,      setFHeightCm]      = useState("10");
  const [fCdek,          setFCdek]          = useState(true);
  const [fNalog,         setFNalog]         = useState(false);
  const [fFitting,       setFFitting]       = useState(false);
  const [fInStock,       setFInStock]       = useState("1");
  const [fFromCityCode,  setFFromCityCode]  = useState("");
  const [fFromCityName,  setFFromCityName]  = useState("");
  const [fCityQuery,     setFCityQuery]     = useState("");
  const [fCitySuggestions, setFCitySuggestions] = useState<CdekCity[]>([]);
  const [fCityLoading,   setFCityLoading]   = useState(false);
  const [fWholesalePrice, setFWholesalePrice] = useState("");
  const [fRetailMarkup,  setFRetailMarkup]  = useState("0");
  const [fIsUsed,        setFIsUsed]        = useState(false);
  const [fSaving,        setFSaving]        = useState(false);

  // ── Видео/камера ──────────────────────────────────────────────────────────
  const [fVideoUrl,      setFVideoUrl]      = useState<string | null>(null);
  const [fVideoBlobUrl,  setFVideoBlobUrl]  = useState<string | null>(null);
  const [camOpen,        setCamOpen]        = useState(false);
  const [camRecording,   setCamRecording]   = useState(false);
  const [camCountdown,   setCamCountdown]   = useState(0);
  const [camUploading,   setCamUploading]   = useState(false);
  const camUploadingRef = useRef(false);
  const camVideoRef    = useRef<HTMLVideoElement>(null);
  const camStreamRef   = useRef<MediaStream | null>(null);
  const camRecorderRef = useRef<MediaRecorder | null>(null);

  // ── Поиск города (для cityQuery, не используется в UI, но useEffect работает) ──
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

  // Подавляем предупреждение об unused vars
  void fCitySuggestions; void fCityLoading;

  // ── Камера ────────────────────────────────────────────────────────────────
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
      document.body.style.overflow = "hidden";
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
    document.body.style.overflow = "";
  }, [stopCamStream]);

  const startRecording = () => {
    if (!camStreamRef.current || camRecording) return;
    const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
      ? "video/mp4;codecs=avc1"
      : MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";
    const recorder = new MediaRecorder(camStreamRef.current, { mimeType, videoBitsPerSecond: 500000 });
    camRecorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      stopCamStream();
      setCamOpen(false);
      setCamRecording(false);
      setCamCountdown(0);
      document.body.style.overflow = "";
      const blob = new Blob(chunks, { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      setFVideoBlobUrl(blobUrl);
      camUploadingRef.current = true;
      setCamUploading(true);
      try {
        const dataUrl = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = ev => res(ev.target?.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
        const resp = await fetch(UPLOAD_VIDEO_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_url: dataUrl, folder: "products" }),
        });
        const data = await resp.json();
        if (data.url) setFVideoUrl(data.url);
      } catch (e) {
        console.error("[video upload] catch:", e);
      } finally {
        camUploadingRef.current = false;
        setCamUploading(false);
      }
    };
    setCamRecording(true);
    setCamCountdown(10);
    recorder.start(100);
    const startedAt = Date.now();
    const DURATION = 10000;
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const rem = Math.max(0, Math.ceil((DURATION - elapsed) / 1000));
      setCamCountdown(rem);
      if (elapsed >= DURATION) { clearInterval(tick); recorder.stop(); }
    }, 200);
    setTimeout(() => { clearInterval(tick); if (recorder.state === "recording") recorder.stop(); }, DURATION + 300);
  };

  // ── Форма ─────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFName(""); setFPrice(""); setFCategory(CATEGORIES[0]); setFDesc(""); setFImages([]); setFError(null);
    setFWeightG("500"); setFLengthCm("20"); setFWidthCm("15"); setFHeightCm("10");
    setFCdek(true); setFNalog(false); setFFitting(false);
    setFInStock("1"); setFFromCityCode(""); setFFromCityName(""); setFCityQuery(""); setFCitySuggestions([]);
    setFWholesalePrice(""); setFRetailMarkup("0");
    setFIsUsed(false);
    setFVideoUrl(null);
    if (fVideoBlobUrl) { URL.revokeObjectURL(fVideoBlobUrl); setFVideoBlobUrl(null); }
  };

  const openAddForm = async () => {
    const result = await check();
    if (!result.ok) {
      setProfileExists(result.profileExists);
      setProfileIssues(result.issues);
      return;
    }
    setEditId(null);
    resetForm();
    setSellerLegalType(result.legalType || "");
    if (result.legalType === "individual") setFIsUsed(true);
    if (user?.shopCityCode) {
      setFFromCityCode(user.shopCityCode);
      setFFromCityName(user.shopCityName || "");
      setFCityQuery(user.shopCityName || "");
    } else {
      const def = warehouses.find(w => w.isDefault) ?? warehouses[0] ?? null;
      if (def) {
        setFFromCityCode(def.cityCode);
        setFFromCityName(def.cityName);
        setFCityQuery(def.cityName);
      }
    }
    setShowForm(true);
    document.body.style.overflow = "hidden";
  };

  // Авто-открытие формы при переходе из экрана успеха регистрации продавца
  useEffect(() => {
    if (autoOpenForm && warehouses !== undefined) {
      const t = setTimeout(() => { openAddForm(); onAutoOpenDone?.(); }, 300);
      return () => clearTimeout(t);
    }
  }, [autoOpenForm]);

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
    const cityCode = (p as { fromCityCode?: string }).fromCityCode ?? "";
    const cityName = (p as { fromCityName?: string }).fromCityName ?? "";
    setFFromCityCode(cityCode);
    setFFromCityName(cityName);
    setFCityQuery(cityName);
    setFCitySuggestions([]);
    setFVideoUrl((p as { videoUrl?: string }).videoUrl ?? null);
    setFWholesalePrice(p.wholesalePrice != null ? String(p.wholesalePrice) : "");
    setFRetailMarkup(String(p.retailMarkupPct ?? 0));
    setFIsUsed(p.isUsed ?? false);
    setFVideoBlobUrl(null);
    setShowForm(true);
    document.body.style.overflow = "hidden";
  };

  const closeForm = () => {
    setShowForm(false);
    document.body.style.overflow = "";
  };

  const handleSave = async () => {
    setFError(null);
    if (!fName.trim()) { setFError("Введите название товара"); return; }
    const wholesaleNum = fWholesalePrice.trim() ? Number(fWholesalePrice.replace(/\s/g, "").replace(",", ".")) : null;
    if (!wholesaleNum || wholesaleNum <= 0) { setFError("Введите оптовую цену"); return; }
    const priceNum = Number(fPrice.replace(/\s/g, "").replace(",", ".")) || wholesaleNum;
    if (fCdek && !fFromCityCode) { setFError("Укажите склад отправления для доставки СДЭК"); return; }
    // Ждём завершения загрузки видео если оно ещё идёт
    if (camUploadingRef.current) {
      await new Promise<void>(resolve => {
        const check = setInterval(() => { if (!camUploadingRef.current) { clearInterval(check); resolve(); } }, 300);
      });
    }
    setFSaving(true);
    try {
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
        wholesalePrice: wholesaleNum,
        retailMarkupPct: Number(fRetailMarkup) || 0,
        isUsed: fIsUsed,
      };
      if (editId) {
        await updateProduct(editId, {
          name: fName.trim(), price: priceNum, category: fCategory,
          description: fDesc.trim(), images: fImages, videoUrl: fVideoUrl ?? "", ...extraFields,
        } as never);
      } else {
        await addProduct({
          name: fName.trim(), price: priceNum, category: fCategory,
          description: fDesc.trim(), images: fImages, videoUrl: fVideoUrl ?? "",
          sellerId: user!.id, sellerName: user!.name, sellerAvatar: user!.avatar,
          ...extraFields,
        } as never);
      }
      if (fVideoBlobUrl) URL.revokeObjectURL(fVideoBlobUrl);
      closeForm();
    } catch (e) {
      setFError("Ошибка сохранения. Попробуйте ещё раз.");
    } finally {
      setFSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteProduct(id);
    setConfirmDelete(null);
  };

  // ── Обработчики цен для передачи в форму ──────────────────────────────────
  const handleWholesalePriceChange = (v: string) => {
    setFWholesalePrice(v);
    if (!fRetailMarkup || fRetailMarkup === "0") {
      setFPrice(v);
    } else {
      const w = Number(v.replace(/\s/g, "").replace(",", "."));
      if (w > 0) setFPrice(String(Math.round(w * (1 + Number(fRetailMarkup) / 100))));
    }
  };

  const handleRetailMarkupChange = (v: string) => {
    const clean = v.replace(/\D/g, "");
    setFRetailMarkup(clean);
    const w = Number(fWholesalePrice.replace(/\s/g, "").replace(",", "."));
    if (w > 0) setFPrice(String(Math.round(w * (1 + Number(clean) / 100))));
  };

  // ── Рендер ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <ProductList
        products={products}
        confirmDelete={confirmDelete}
        onOpenAddForm={openAddForm}
        onOpenEditForm={openEditForm}
        onSetConfirmDelete={setConfirmDelete}
        onDelete={handleDelete}
      />

      {showForm && (
        <ProductFormModal
          editId={editId}
          fVideoBlobUrl={fVideoBlobUrl}
          fVideoUrl={fVideoUrl}
          camUploading={camUploading}
          onOpenCamera={openCamera}
          onClearVideo={() => { if (fVideoBlobUrl) URL.revokeObjectURL(fVideoBlobUrl); setFVideoBlobUrl(null); setFVideoUrl(null); }}
          fName={fName} setFName={setFName}
          fCategory={fCategory} setFCategory={setFCategory}
          fDesc={fDesc} setFDesc={setFDesc}
          fWholesalePrice={fWholesalePrice}
          fRetailMarkup={fRetailMarkup}
          fPrice={fPrice}
          onWholesalePriceChange={handleWholesalePriceChange}
          onRetailMarkupChange={handleRetailMarkupChange}
          fInStock={fInStock} setFInStock={setFInStock}
          fFromCityName={fFromCityName}
          fWeightG={fWeightG} setFWeightG={setFWeightG}
          fLengthCm={fLengthCm} setFLengthCm={setFLengthCm}
          fWidthCm={fWidthCm} setFWidthCm={setFWidthCm}
          fHeightCm={fHeightCm} setFHeightCm={setFHeightCm}
          fImages={fImages} setFImages={setFImages}
          fCdek={fCdek} setFCdek={setFCdek}
          fNalog={fNalog} setFNalog={setFNalog}
          fFitting={fFitting} setFFitting={setFFitting}
          fIsUsed={fIsUsed} setFIsUsed={setFIsUsed}
          isIndividual={sellerLegalType === "individual"}
          fError={fError}
          saving={fSaving}
          onSave={handleSave}
          onClose={closeForm}
        />
      )}

      {camOpen && (
        <ProductCameraRecorder
          camVideoRef={camVideoRef}
          camRecording={camRecording}
          camCountdown={camCountdown}
          onClose={closeCamera}
          onStartRecording={startRecording}
        />
      )}

      {profileIssues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setProfileIssues(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Icon name="TriangleAlert" size={20} className="text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  {profileExists ? "Профиль заполнен не полностью" : "Заполните профиль продавца"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {profileExists
                    ? "Для корректного расчёта и выплат нужно дополнить профиль"
                    : "Для добавления товаров необходимо заполнить профиль продавца"}
                </p>
              </div>
            </div>

            {profileExists && profileIssues.length > 0 && (
              <div className="bg-secondary rounded-xl p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Не заполнено:</p>
                {profileIssues.map(issue => (
                  <div key={issue.field} className="flex items-center gap-2 text-xs text-foreground">
                    <Icon name="CircleX" size={13} className="text-red-400 flex-shrink-0" />
                    {issue.label}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setProfileIssues(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => { setProfileIssues(null); onGoToProfile?.(); }}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Перейти в профиль
              </button>
            </div>
          </div>
        </div>
      )}

      {checking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-card rounded-2xl px-6 py-4 flex items-center gap-3 shadow-xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-foreground">Проверка профиля…</span>
          </div>
        </div>
      )}
    </div>
  );
}