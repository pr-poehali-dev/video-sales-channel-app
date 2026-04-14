import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { Page } from "@/App";

interface DashboardPageProps {
  setPage: (p: Page) => void;
}

const CATEGORIES = [
  "Украшения", "Одежда", "Красота", "Аксессуары",
  "Электроника", "Дом и сад", "Детские товары", "Другое",
];

const TABS = ["Товары", "Мои эфиры", "Статистика"];

const MAX_IMAGES = 5;
const MAX_SIZE_MB = 2;

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const CDEK_API = "https://functions.poehali.dev/937e27f3-191a-445d-b034-61bd84ed5381";

function fmtDuration(sec?: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface CdekCity { code: number; city: string; region: string; }

// Сжимает до base64, потом загружает в S3, возвращает CDN URL
async function uploadImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const maxPx = 800;
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = blobUrl;
  });
  const res = await fetch(`${STORE_API}?action=upload_image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data_url: dataUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "upload failed");
  return data.url;
}

export default function DashboardPage({ setPage }: DashboardPageProps) {
  const { user } = useAuth();
  const { addProduct, updateProduct, deleteProduct, deleteStream, updateStream, reload, getSellerProducts, getSellerStreams } = useStore();

  const products = user ? getSellerProducts(user.id) : [];
  const myStreams = user ? getSellerStreams(user.id) : [];

  const [tab, setTab] = useState("Товары");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteStream, setConfirmDeleteStream] = useState<string | null>(null);
  const [stoppingStream, setStoppingStream] = useState<string | null>(null);
  const [editStreamId, setEditStreamId] = useState<string | null>(null);
  const [editStreamTitle, setEditStreamTitle] = useState("");
  const [savingStreamTitle, setSavingStreamTitle] = useState(false);

  const activeStream = myStreams.find(s => s.isLive) ?? null;

  const handleStopStream = async (id: string) => {
    setStoppingStream(id);
    try {
      await updateStream(id, { isLive: false });
      await reload();
    } catch { /* ignore */ }
    finally { setStoppingStream(null); }
  };

  const handleSaveStreamTitle = async (id: string) => {
    if (!editStreamTitle.trim()) return;
    setSavingStreamTitle(true);
    try {
      await updateStream(id, { title: editStreamTitle.trim() } as never);
      await reload();
      setEditStreamId(null);
    } catch { /* ignore */ }
    finally { setSavingStreamTitle(false); }
  };

  // Форма
  const [fName, setFName] = useState("");
  const [fPrice, setFPrice] = useState("");
  const [fCategory, setFCategory] = useState(CATEGORIES[0]);
  const [fDesc, setFDesc] = useState("");
  const [fImages, setFImages] = useState<string[]>([]);
  const [fError, setFError] = useState<string | null>(null);
  const [fImgLoading, setFImgLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Доставка и опции
  const [fWeightG, setFWeightG] = useState("500");
  const [fLengthCm, setFLengthCm] = useState("20");
  const [fWidthCm, setFWidthCm] = useState("15");
  const [fHeightCm, setFHeightCm] = useState("10");
  const [fCdek, setFCdek] = useState(true);
  const [fNalog, setFNalog] = useState(false);
  const [fFitting, setFFitting] = useState(false);
  // Склад отправления и количество
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

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
          <Icon name="LayoutDashboard" size={28} className="text-muted-foreground opacity-40" />
        </div>
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Войдите в аккаунт</h2>
        <p className="text-muted-foreground text-sm mb-6">Для доступа к кабинету необходимо войти</p>
        <button
          onClick={() => setPage("auth")}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  const resetForm = () => {
    setFName(""); setFPrice(""); setFCategory(CATEGORIES[0]); setFDesc(""); setFImages([]); setFError(null);
    setFWeightG("500"); setFLengthCm("20"); setFWidthCm("15"); setFHeightCm("10");
    setFCdek(true); setFNalog(false); setFFitting(false);
    setFInStock("1"); setFFromCityCode(0); setFFromCityName(""); setFCityQuery(""); setFCitySuggestions([]);
  };

  const openAddForm = () => {
    setEditId(null);
    resetForm();
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

  const handleImgAdd = async (files: FileList | null) => {
    if (!files) return;
    if (fImages.length >= MAX_IMAGES) { setFError(`Максимум ${MAX_IMAGES} фото`); return; }
    setFImgLoading(true);
    setFError(null);
    const results: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) { setFError(`Файл ${file.name} больше ${MAX_SIZE_MB} МБ`); continue; }
      if (!file.type.startsWith("image/")) continue;
      if (fImages.length + results.length >= MAX_IMAGES) break;
      try { results.push(await uploadImage(file)); } catch { setFError("Ошибка загрузки фото, попробуй ещё раз"); }
    }
    setFImages(prev => [...prev, ...results].slice(0, MAX_IMAGES));
    setFImgLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImg = (idx: number) => setFImages(prev => prev.filter((_, i) => i !== idx));

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
        sellerId: user.id, sellerName: user.name, sellerAvatar: user.avatar,
        ...extraFields,
      });
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    deleteProduct(id);
    setConfirmDelete(null);
  };

  const fmtDuration = (sec?: number) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Мой кабинет</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user.name}{user.city ? ` · ${user.city}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage("seller-register" as Page)}
            className="border border-border text-muted-foreground font-medium px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors text-sm flex items-center gap-2"
          >
            <Icon name="FileText" size={15} />
            Реквизиты
          </button>
          {activeStream ? (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-4 py-2.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-live-pulse flex-shrink-0" />
              <span className="text-sm font-semibold text-red-500 truncate max-w-[120px]">{activeStream.title}</span>
              <button
                onClick={() => handleStopStream(activeStream.id)}
                disabled={stoppingStream === activeStream.id}
                className="ml-1 text-xs font-semibold text-red-500 border border-red-500/40 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
              >
                {stoppingStream === activeStream.id
                  ? <Icon name="Loader" size={12} className="animate-spin" />
                  : <Icon name="Square" size={12} />}
                Стоп
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPage("broadcast")}
              className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
              Начать эфир
            </button>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: "Package", value: String(products.length), label: "Товаров" },
          { icon: "Radio", value: String(myStreams.length), label: "Эфиров" },
          { icon: "ShoppingBag", value: "0", label: "Продаж" },
          { icon: "Wallet", value: "0 ₽", label: "Выручка" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <Icon name={s.icon} size={16} className="text-muted-foreground mb-2" />
            <div className="font-oswald text-xl font-semibold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Табы */}
      <div className="flex gap-1 mb-6 bg-secondary rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── ТОВАРЫ ── */}
      {tab === "Товары" && (
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
                  {/* Превью фото */}
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
        </div>
      )}

      {/* ── МОИ ЭФИРЫ ── */}
      {tab === "Мои эфиры" && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              {myStreams.length > 0 ? `${myStreams.length} эфир${myStreams.length === 1 ? "" : myStreams.length < 5 ? "а" : "ов"}` : "Нет эфиров"}
            </span>
            <div className="flex items-center gap-2">
              {activeStream && (
                <button
                  onClick={() => handleStopStream(activeStream.id)}
                  disabled={stoppingStream === activeStream.id}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {stoppingStream === activeStream.id
                    ? <Icon name="Loader" size={12} className="animate-spin" />
                    : <Icon name="Square" size={12} />}
                  Завершить эфир
                </button>
              )}
              <button onClick={() => setPage("broadcast")}
                className="flex items-center gap-1.5 text-sm text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-live-pulse" />
                {activeStream ? "Вернуться в эфир" : "Начать эфир"}
              </button>
            </div>
          </div>

          {myStreams.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                <Icon name="Radio" size={24} className="text-muted-foreground opacity-40" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Эфиров пока нет</h3>
              <p className="text-sm text-muted-foreground mb-5">Запусти первую трансляцию прямо с телефона</p>
              <button onClick={() => setPage("broadcast")}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 text-sm">
                <Icon name="Video" size={15} /> Начать эфир
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {myStreams.map(s => (
                <div key={s.id} className={`bg-card border rounded-xl overflow-hidden transition-all ${s.isLive ? "border-red-500/40 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]" : "border-border"}`}>
                  <div className="flex gap-3 p-3">
                    {/* Превью */}
                    <div className="w-20 h-14 rounded-lg overflow-hidden bg-secondary flex-shrink-0 relative">
                      {s.thumbnail
                        ? <img src={s.thumbnail} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center">
                            <Icon name={s.isLive ? "Radio" : "PlayCircle"} size={20} className={s.isLive ? "text-red-400" : "text-muted-foreground opacity-40"} />
                          </div>
                      }
                      {s.isLive && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <span className="flex items-center gap-1 text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                            <span className="w-1 h-1 rounded-full bg-white animate-live-pulse" />LIVE
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Инфо */}
                    <div className="flex-1 min-w-0">
                      {editStreamId === s.id ? (
                        <div className="flex gap-1.5 items-center mb-1">
                          <input
                            value={editStreamTitle}
                            onChange={e => setEditStreamTitle(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSaveStreamTitle(s.id)}
                            className="flex-1 text-sm bg-secondary border border-border rounded-lg px-2 py-1 outline-none focus:border-primary/50 min-w-0"
                            autoFocus
                          />
                          <button onClick={() => handleSaveStreamTitle(s.id)} disabled={savingStreamTitle}
                            className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                            {savingStreamTitle ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Check" size={12} />}
                          </button>
                          <button onClick={() => setEditStreamId(null)} className="p-1.5 rounded-lg hover:bg-secondary">
                            <Icon name="X" size={12} className="text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate flex-1">{s.title}</p>
                          <button
                            onClick={() => { setEditStreamId(s.id); setEditStreamTitle(s.title); }}
                            className="p-1 rounded hover:bg-secondary flex-shrink-0"
                          >
                            <Icon name="Pencil" size={11} className="text-muted-foreground" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Icon name="Calendar" size={10} />{s.startedAt}</span>
                        {s.duration && <span className="flex items-center gap-1"><Icon name="Clock" size={10} />{fmtDuration(s.duration)}</span>}
                        <span className="flex items-center gap-1"><Icon name="Eye" size={10} />{s.viewers} зрит.</span>
                      </div>
                    </div>
                  </div>

                  {/* Кнопки действий */}
                  <div className="flex border-t border-border">
                    {s.isLive ? (
                      <>
                        <button
                          onClick={() => setPage("broadcast")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                        >
                          <Icon name="Radio" size={13} />
                          Управление
                        </button>
                        <div className="w-px bg-border" />
                        <button
                          onClick={() => handleStopStream(s.id)}
                          disabled={stoppingStream === s.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                        >
                          {stoppingStream === s.id
                            ? <Icon name="Loader" size={13} className="animate-spin" />
                            : <Icon name="Square" size={13} />}
                          Завершить эфир
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setPage("streams")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <Icon name="Play" size={13} />
                          Смотреть
                        </button>
                        <div className="w-px bg-border" />
                        <button
                          onClick={() => setConfirmDeleteStream(s.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                        >
                          <Icon name="Trash2" size={13} />
                          Удалить
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── СТАТИСТИКА ── */}
      {tab === "Статистика" && (
        <div className="animate-fade-in text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="BarChart2" size={24} className="text-muted-foreground opacity-40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Статистика появится после первых продаж</h3>
          <p className="text-sm text-muted-foreground">Добавь товары и запусти эфир</p>
        </div>
      )}

      {/* ── ФОРМА ТОВАРА ── */}
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

              {/* Фото */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Фотографии (до {MAX_IMAGES})</label>
                <div className="flex flex-wrap gap-2">
                  {fImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImg(idx)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Icon name="Trash2" size={16} className="text-white" />
                      </button>
                      {idx === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-black/60 text-white py-0.5">Главное</span>
                      )}
                    </div>
                  ))}
                  {fImages.length < MAX_IMAGES && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={fImgLoading}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {fImgLoading
                        ? <Icon name="Loader" size={18} className="text-muted-foreground animate-spin" />
                        : <><Icon name="Plus" size={18} className="text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Фото</span></>
                      }
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => handleImgAdd(e.target.files)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG до {MAX_SIZE_MB} МБ. Первое фото — обложка.</p>
              </div>

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

      {/* ── УДАЛЕНИЕ ЭФИРА ── */}
      {confirmDeleteStream && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-destructive" />
            </div>
            <h3 className="font-oswald text-lg font-semibold text-foreground text-center mb-2">Удалить эфир?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">Запись будет удалена и больше не будет видна зрителям</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteStream(null)}
                className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl hover:bg-secondary transition-colors text-sm">
                Отмена
              </button>
              <button onClick={() => { deleteStream(confirmDeleteStream); setConfirmDeleteStream(null); }}
                className="flex-1 bg-destructive text-white font-semibold py-2.5 rounded-xl hover:opacity-90 text-sm">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── УДАЛЕНИЕ ТОВАРА ── */}
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