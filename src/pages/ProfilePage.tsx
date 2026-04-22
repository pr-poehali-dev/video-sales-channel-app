import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { Page } from "@/App";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import SellerRegisterPage from "./SellerRegisterPage";
import DashboardProductsTab from "./dashboard/DashboardProductsTab";
import DashboardStreamsTab from "./dashboard/DashboardStreamsTab";
import DashboardWarehousesTab, { type Warehouse } from "./dashboard/DashboardWarehousesTab";
import DashboardOrdersTab from "./dashboard/DashboardOrdersTab";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const AUTH_API  = "https://functions.poehali.dev/f78c2cf9-b718-4a63-9473-a8f6bcff11f4";
const CDEK_API  = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";

const PRODUCT_CATEGORIES = [
  "Одежда и аксессуары", "Электроника", "Красота и здоровье", "Дом и интерьер",
  "Детские товары", "Спорт и отдых", "Еда и напитки", "Украшения и бижутерия",
  "Рукоделие и хобби", "Другое",
];

const ALL_CARRIERS = [
  { id: "СДЭК", icon: "Truck" },
  { id: "ПЭК", icon: "Package" },
  { id: "Почта России", icon: "Mail" },
  { id: "Деловые линии", icon: "Package2" },
] as const;

interface CdekCityProfile { code: string; city: string; region: string; guid?: string; }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new:       { label: "Ожидает оплаты", color: "text-yellow-500" },
  paid:      { label: "Оплачен",        color: "text-green-500"  },
  shipped:   { label: "В доставке",     color: "text-blue-500"   },
  delivered: { label: "Доставлен",      color: "text-green-600"  },
  cancelled: { label: "Отменён",        color: "text-red-400"    },
};

interface OrderItem { id: string; name: string; price: number; qty: number; image?: string; }
interface Order {
  id: string; status: string; items: OrderItem[];
  goodsTotal: number; orderTotal: number;
  deliveryCityName: string; deliveryAddress: string;
  deliveryType: string; cdekTrackNumber?: string; createdAt: string;
}

interface ProfilePageProps { setPage: (p: Page) => void; onAddProduct?: () => void; onSetSellerRegisterType?: (t: "individual" | "legal") => void; }

// ============================================================================
// !! ВНИМАНИЕ: ProfilePage — это кабинет ПОКУПАТЕЛЯ (заказы + аккаунт) !!
// Кабинет АДМИНИСТРАТОРА и ПРОДАВЦА живёт в DashboardPage.tsx — НЕ СЮДА!
// Роутинг: admin → "dashboard", продавец → "dashboard", покупатель → "profile"
// Не добавляй сюда admin-блоки — они сломаются при редактировании этого файла.
// ============================================================================
export default function ProfilePage({ setPage, onAddProduct, onSetSellerRegisterType }: ProfilePageProps) {
  const { user, logout, updateUser } = useAuth();
  const { getSellerProducts, getSellerStreams, updateStream, reload } = useStore();
  const products = user ? getSellerProducts(user.id) : [];
  const myStreams = user ? getSellerStreams(user.id) : [];
  const activeStream = myStreams.find(s => s.isLive) ?? null;
  type ProfileMode = "personal" | "legal";
  const [mode, setMode] = useState<ProfileMode>(() => {
    const saved = localStorage.getItem("profileMode") as ProfileMode | null;
    if (saved) return saved;
    return user?.shopName ? "legal" : "personal";
  });

  const handleSetMode = (m: ProfileMode) => {
    localStorage.setItem("profileMode", m);
    setMode(m);
  };

  // ── Кабинет продавца (табы) ──
  const [tab, setTab] = useState<string | null>(() => {
    const pending = sessionStorage.getItem("profileOpenTab");
    if (pending) { sessionStorage.removeItem("profileOpenTab"); return pending; }
    return null;
  });
  const [autoOpenProductForm, setAutoOpenProductForm] = useState(false);
  const [showIndividualProducts, setShowIndividualProducts] = useState(false);
  const [showPersonalData, setShowPersonalData] = useState(false);
  const [showMyPurchases, setShowMyPurchases] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [sellerLegalType, setSellerLegalType] = useState<string>("");
  const [sellerLegalTypeLoaded, setSellerLegalTypeLoaded] = useState(false);
  const [hasIndividualProfile, setHasIndividualProfile] = useState(false);
  const [hasLegalProfile, setHasLegalProfile] = useState(false);
  const [limitToast, setLimitToast] = useState(false);
  const [profileIncompleteToast, setProfileIncompleteToast] = useState(false);
  // Данные физлица-продавца (для отображения/редактирования в блоке личных данных)
  const [indLegalName, setIndLegalName] = useState("");
  const [indCardNumber, setIndCardNumber] = useState("");
  const [indSaving, setIndSaving] = useState(false);
  // Данные магазина физлица
  const [indShopName, setIndShopName] = useState("");
  const [indCategory, setIndCategory] = useState("");
  const [indCarriers, setIndCarriers] = useState<string[]>(["СДЭК"]);
  const [indCityCode, setIndCityCode] = useState("");
  const [indCityName, setIndCityName] = useState("");
  const [indCityGuid, setIndCityGuid] = useState("");
  const [indCityQuery, setIndCityQuery] = useState("");
  const [indCitySuggestions, setIndCitySuggestions] = useState<CdekCityProfile[]>([]);
  const [indCityLoading, setIndCityLoading] = useState(false);
  const [stoppingStream, setStoppingStream] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const { subscribed, isSupported, subscribe, unsubscribe, status: pushStatus } = usePushNotifications(user?.id ?? null);
  const [pushLoading, setPushLoading] = useState(false);

  const loadWarehouses = async (uid: string) => {
    try {
      const r = await fetch(`${STORE_API}?action=get_warehouses&seller_id=${uid}`);
      setWarehouses(await r.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (user) loadWarehouses(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.shopName) { setSellerLegalTypeLoaded(true); return; }
    // Грузим оба профиля: individual и legal
    Promise.all([
      fetch(`${STORE_API}?action=get_seller_profile&user_id=${user.id}&profile_type=individual`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${STORE_API}?action=get_seller_profile&user_id=${user.id}&profile_type=legal`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([indData, legalData]) => {
      setHasIndividualProfile(!!(indData?.legalType));
      setHasLegalProfile(!!(legalData?.legalType));
      if (mode === "personal" && indData?.legalType) setSellerLegalType(indData.legalType);
      else if (legalData?.legalType) setSellerLegalType(legalData.legalType);
      // Сохраняем данные физлица для отображения
      if (indData?.legalType) {
        setIndLegalName(indData.legalName || "");
        setIndCardNumber(indData.cardNumber || "");
      }
      // Данные магазина из user
      if (user) {
        setIndShopName(user.shopName || "");
        setIndCategory(user.shopCategory || "");
        setIndCarriers(user.shopCarriers?.length ? user.shopCarriers : ["СДЭК"]);
        setIndCityCode(user.shopCityCode || "");
        setIndCityName(user.shopCityName || "");
        setIndCityQuery(user.shopCityName || "");
      }
    }).catch(() => {}).finally(() => setSellerLegalTypeLoaded(true));
  }, [user?.id, user?.shopName, mode]);

  const handleStopStream = async (id: string) => {
    setStoppingStream(id);
    try { await updateStream(id, { isLive: false }); await reload(); }
    catch { /* ignore */ } finally { setStoppingStream(null); }
  };

  // ── Данные аккаунта ──
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Синхронизируем phone с данными пользователя при выходе из редактирования
  useEffect(() => {
    if (!editing) setPhone(user?.phone ?? "");
  }, [user?.phone, editing]);

  // Поиск города СДЭК для физлица
  useEffect(() => {
    if (indCityQuery.length < 2 || indCityQuery === indCityName) { setIndCitySuggestions([]); return; }
    const t = setTimeout(async () => {
      setIndCityLoading(true);
      try {
        const r = await fetch(`${CDEK_API}?action=cities&q=${encodeURIComponent(indCityQuery)}`);
        const data = await r.json();
        setIndCitySuggestions(Array.isArray(data) ? data : []);
      } catch { setIndCitySuggestions([]); } finally { setIndCityLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [indCityQuery, indCityName]);

  // Смена пароля
  const [changingPass, setChangingPass] = useState(false);
  const [oldPass,  setOldPass]  = useState("");
  const [newPass,  setNewPass]  = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [passError, setPassError] = useState<string | null>(null);
  const [passSaved, setPassSaved] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // ── Покупки ──
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || mode !== "personal") return;
    setOrdersLoading(true);
    fetch(`${STORE_API}?action=get_orders&buyer_id=${user.id}`)
      .then(r => r.json())
      .then(d => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [user?.id, mode]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
          <Icon name="User" size={28} className="text-muted-foreground opacity-40" />
        </div>
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Вы не вошли</h2>
        <p className="text-muted-foreground text-sm mb-6">Войдите или зарегистрируйтесь, чтобы видеть профиль</p>
        <button onClick={() => setPage("auth")}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  const handleSave = async () => {
    setSaveError(null);
    try {
      await updateUser({ phone: phone.trim() });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Не удалось сохранить данные. Попробуйте ещё раз.");
    }
  };

  const handleSaveIndividual = async () => {
    if (!user) return;
    setIndSaving(true);
    try {
      const res = await fetch(`${STORE_API}?action=save_seller_profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          profileType: "individual",
          legalType: "individual",
          legalName: indLegalName.trim(),
          cardNumber: indCardNumber.replace(/\D/g, ""),
          agreedOffer: true,
          agreedPd: true,
          contactPhone: user.phone,
          contactEmail: user.email,
          productCategory: indCategory,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения данных продавца");
      // Сохраняем данные магазина
      await updateUser({
        shopName: indShopName.trim() || indLegalName.trim() || user.shopName || "",
        shopCategory: indCategory,
        shopCarriers: indCarriers,
        ...(indCityCode ? { shopCityCode: indCityCode, shopCityName: indCityName, shopCityGuid: indCityGuid } : {}),
      });
    } catch {
      setSaveError("Не удалось сохранить данные продавца. Попробуйте ещё раз.");
    } finally {
      setIndSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPassError(null);
    if (!oldPass) { setPassError("Введите текущий пароль"); return; }
    if (newPass.length < 6) { setPassError("Новый пароль — минимум 6 символов"); return; }
    if (newPass !== newPass2) { setPassError("Пароли не совпадают"); return; }
    const res = await fetch(`${AUTH_API}?action=change_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, old_password: oldPass, new_password: newPass }),
    });
    const data = await res.json();
    if (data.error) { setPassError(data.error); return; }
    setChangingPass(false); setOldPass(""); setNewPass(""); setNewPass2("");
    setPassSaved(true);
    setTimeout(() => setPassSaved(false), 2500);
  };

  const handleLogout = () => { logout(); setPage("home"); };
  const isSeller = !!(user.shopName);

  const inputCls = "w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";

  return (
    <div className="max-w-xl mx-auto px-4 animate-fade-in pb-28">

      {/* ── Sticky переключатель режима ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pt-4 pb-3 -mx-4 px-4 border-b border-border/60 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => handleSetMode("personal")}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl font-semibold text-sm transition-all ${
              mode === "personal"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {mode === "personal" ? <Icon name="Check" size={14} /> : <Icon name="User" size={14} />}
              Физ. лицо
            </span>
            {hasIndividualProfile && <span className="text-[10px] opacity-70 font-normal">до 5 объявлений · б/у</span>}
          </button>
          <button
            onClick={() => {
              if (!isSeller || !hasLegalProfile) {
                onSetSellerRegisterType?.("legal");
                setPage("seller-register");
              } else {
                handleSetMode("legal");
              }
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl font-semibold text-sm transition-all ${
              mode === "legal"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {mode === "legal" ? <Icon name="Check" size={14} /> : <Icon name="Building2" size={14} />}
              Юр. лицо
            </span>
            {!hasLegalProfile
              ? <span className="text-[10px] opacity-70 font-normal">зарегистрироваться</span>
              : <span className="text-[10px] opacity-70 font-normal">опт · без лимита</span>
            }
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          РЕЖИМ: ФИЗИЧЕСКОЕ ЛИЦО
      ══════════════════════════════════════════ */}
      {mode === "personal" && (
        <div className="space-y-4 animate-fade-in">

          {/* Шапка */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 text-primary text-xl font-bold flex items-center justify-center font-oswald flex-shrink-0">
              {user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-oswald text-xl font-semibold text-foreground tracking-wide truncate">{user.name}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Покупатель · с {user.joinedAt}</p>
            </div>
            <button onClick={handleLogout}
              className="p-2.5 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors" title="Выйти">
              <Icon name="LogOut" size={15} className="text-destructive" />
            </button>
          </div>

          {/* Данные аккаунта (объединённый блок) */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowPersonalData(v => !v)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="UserCog" size={15} className="text-muted-foreground" />
                Личные данные
              </p>
              <div className="flex items-center gap-2">
                <button onClick={e => {
                  e.stopPropagation();
                  setShowPersonalData(true);
                  const next = !editing;
                  setEditing(next);
                  if (next) {
                    setPhone(user.phone);
                    setIndShopName(user.shopName || "");
                    setIndCategory(user.shopCategory || "");
                    setIndCarriers(user.shopCarriers?.length ? user.shopCarriers : ["СДЭК"]);
                    setIndCityCode(user.shopCityCode || "");
                    setIndCityName(user.shopCityName || "");
                    setIndCityQuery(user.shopCityName || "");
                    setIndCityGuid(user.shopCityGuid || "");
                  }
                }} className="text-xs text-primary font-medium hover:opacity-80 transition-opacity">
                  {editing ? "Отмена" : "Редактировать"}
                </button>
                <Icon name={showPersonalData ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
              </div>
            </button>
            {showPersonalData && (
            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">

            {editing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">Телефон *</label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+7 (900) 000-00-00"
                    inputMode="tel"
                    className={inputCls + (
                      phone && phone.replace(/\D/g, "").length !== 11
                        ? " border-red-400/60"
                        : phone && phone.replace(/\D/g, "").length === 11
                        ? " border-green-400/60"
                        : " border-amber-400/60"
                    )}
                  />
                  {!phone && <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1"><Icon name="AlertCircle" size={10} />Обязательно для заполнения</p>}
                  {phone && phone.replace(/\D/g, "").length !== 11 && <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1"><Icon name="AlertCircle" size={10} />Введите полный номер (11 цифр)</p>}
                  {phone && phone.replace(/\D/g, "").length === 11 && <p className="text-[10px] text-green-600 mt-0.5 flex items-center gap-1"><Icon name="CheckCircle" size={10} />Номер корректен</p>}
                </div>
                {hasIndividualProfile && <>
                  <div className="border-t border-border/50 pt-2 mt-1">
                    <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Данные продавца</p>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-0.5 block">ФИО *</label>
                    <input value={indLegalName} onChange={e => setIndLegalName(e.target.value)}
                      placeholder="Иванов Иван Иванович"
                      className={inputCls + (
                        !indLegalName ? " border-amber-400/60"
                        : indLegalName.trim().split(/\s+/).length >= 2 ? " border-green-400/60"
                        : " border-red-400/60"
                      )} />
                    {!indLegalName && <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1"><Icon name="AlertCircle" size={10} />Обязательно для заполнения</p>}
                    {indLegalName && indLegalName.trim().split(/\s+/).length < 2 && <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1"><Icon name="AlertCircle" size={10} />Введите фамилию и имя</p>}
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-0.5 block">Номер карты для выплат *</label>
                    <input value={indCardNumber.replace(/(\d{4})(?=\d)/g, "$1 ")}
                      onChange={e => setIndCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
                      placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={19}
                      className={inputCls + (
                        !indCardNumber ? " border-amber-400/60"
                        : indCardNumber.replace(/\D/g, "").length === 16 ? " border-green-400/60"
                        : " border-red-400/60"
                      )} />
                    {!indCardNumber && <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1"><Icon name="AlertCircle" size={10} />Обязательно для заполнения</p>}
                    {indCardNumber && indCardNumber.replace(/\D/g, "").length !== 16 && <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1"><Icon name="AlertCircle" size={10} />Номер карты — 16 цифр (введено {indCardNumber.replace(/\D/g, "").length})</p>}
                    {indCardNumber && indCardNumber.replace(/\D/g, "").length === 16 && <p className="text-[10px] text-green-600 mt-0.5 flex items-center gap-1"><Icon name="CheckCircle" size={10} />Номер карты корректен</p>}
                  </div>
                  {/* Блок магазина */}
                  <div className="border-t border-border/50 pt-2 mt-1" />
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-0.5 block">Категория товаров *</label>
                    <select value={indCategory} onChange={e => setIndCategory(e.target.value)}
                      className={inputCls + " cursor-pointer" + (!indCategory ? " border-amber-400/60" : " border-green-400/60")}>
                      <option value="">— Выберите категорию —</option>
                      {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {!indCategory && <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1"><Icon name="AlertCircle" size={10} />Обязательно для заполнения</p>}
                    {indCategory && <p className="text-[10px] text-muted-foreground mt-0.5">Используется для настройки ставок и комиссий</p>}
                  </div>
                  <div className="relative">
                    <label className="text-[11px] text-muted-foreground mb-0.5 block">
                      Город отправки *
                      {indCityCode && <span className="ml-1 text-green-600 font-normal">· будет подставляться в каждый товар</span>}
                    </label>
                    {indCityCode && indCityQuery === indCityName ? (
                      <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2">
                        <Icon name="MapPin" size={13} className="text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground flex-1">{indCityName}</span>
                        <button onClick={() => { setIndCityCode(""); setIndCityQuery(""); setIndCityName(""); setIndCityGuid(""); }}>
                          <Icon name="X" size={13} className="text-muted-foreground" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Icon name="MapPin" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input value={indCityQuery}
                          onChange={e => { setIndCityQuery(e.target.value); setIndCityCode(""); setIndCityName(""); }}
                          placeholder="Начните вводить город..."
                          className={inputCls + " pl-8 pr-8" + (!indCityCode && !indCityQuery ? " border-amber-400/60" : "")} />
                        {indCityLoading && <Icon name="Loader" size={13} className="absolute right-3 top-2.5 text-muted-foreground animate-spin" />}
                      </div>
                    )}
                    {indCitySuggestions.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 bg-card border border-border rounded-xl shadow-xl mt-1 overflow-hidden">
                        {indCitySuggestions.map(c => (
                          <button key={c.code} type="button"
                            onMouseDown={() => { setIndCityCode(c.code); setIndCityName(c.city); setIndCityGuid(c.guid || ""); setIndCityQuery(c.city); setIndCitySuggestions([]); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors border-b border-border/50 last:border-0">
                            <span className="font-medium text-foreground">{c.city}</span>
                            {c.region && <span className="text-muted-foreground text-xs ml-1.5">{c.region}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">Транспортные компании</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_CARRIERS.map(c => {
                        const active = indCarriers.includes(c.id);
                        return (
                          <button key={c.id} type="button"
                            onClick={() => setIndCarriers(prev => active ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              active ? "bg-primary/10 border-primary text-primary" : "bg-secondary border-border text-muted-foreground"
                            }`}>
                            <Icon name={c.icon as "Truck"} size={11} />
                            {c.id}
                            {active && <Icon name="Check" size={10} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>}
                <button onClick={async () => {
                  setSaveError(null);
                  if (!phone.trim()) { setSaveError("Введите номер телефона"); return; }
                  if (phone.replace(/\D/g, "").length !== 11) { setSaveError("Введите полный номер телефона (11 цифр)"); return; }
                  if (hasIndividualProfile) {
                    if (!indLegalName.trim()) { setSaveError("Введите ФИО полностью"); return; }
                    if (indLegalName.trim().split(/\s+/).length < 2) { setSaveError("Введите фамилию и имя"); return; }
                    if (!indCardNumber.trim()) { setSaveError("Введите номер карты для выплат"); return; }
                    if (indCardNumber.replace(/\D/g, "").length !== 16) { setSaveError("Номер карты должен содержать 16 цифр"); return; }
                    if (!indCategory) { setSaveError("Выберите категорию товаров"); return; }
                    if (!indCityCode) { setSaveError("Укажите город отправки"); return; }
                  }
                  await handleSave();
                  if (hasIndividualProfile) await handleSaveIndividual();
                }}
                  disabled={indSaving}
                  className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm mt-1 disabled:opacity-50 flex items-center justify-center gap-2">
                  {indSaving && <Icon name="Loader" size={14} className="animate-spin" />}
                  Сохранить
                </button>
                {saved && <p className="text-xs text-green-600 text-center flex items-center justify-center gap-1"><Icon name="CheckCircle" size={12} />Сохранено</p>}
                {saveError && <p className="text-xs text-destructive text-center flex items-center justify-center gap-1"><Icon name="AlertCircle" size={12} />{saveError}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "Email",   value: user.email },
                  { label: "Телефон", value: user.phone || "—" },
                  ...(hasIndividualProfile ? [
                    { label: "ФИО",              value: indLegalName || "—" },
                    { label: "Карта для выплат", value: indCardNumber ? `•••• •••• •••• ${indCardNumber.slice(-4)}` : "—" },
                    { label: "Категория",        value: indCategory || user.shopCategory || "—" },
                    { label: "Город отправки",   value: indCityName || user.shopCityName || "—" },
                  ] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-sm text-foreground font-medium">{value}</span>
                  </div>
                ))}
              </div>
            )}
            </div>
            )}
          </div>

          {/* Смена пароля */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setChangingPass(v => !v)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="Lock" size={15} className="text-muted-foreground" />
                Пароль
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary font-medium">{changingPass ? "Отмена" : "Изменить"}</span>
                <Icon name={changingPass ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
              </div>
            </button>
            {passSaved && <p className="text-xs text-green-600 flex items-center gap-1 px-4 pb-3"><Icon name="CheckCircle" size={12} />Пароль изменён</p>}
            {changingPass && (
            <div className="px-4 pb-4 border-t border-border/50 pt-3">
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">Текущий пароль</label>
                  <div className="relative">
                    <input type={showOld ? "text" : "password"} value={oldPass} onChange={e => setOldPass(e.target.value)} placeholder="••••••" className={inputCls + " pr-9"} />
                    <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Icon name={showOld ? "EyeOff" : "Eye"} size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">Новый пароль</label>
                  <div className="relative">
                    <input type={showNew ? "text" : "password"} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Минимум 6 символов" className={inputCls + " pr-9"} />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Icon name={showNew ? "EyeOff" : "Eye"} size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-0.5 block">Повторите новый пароль</label>
                  <input type="password" value={newPass2} onChange={e => setNewPass2(e.target.value)} placeholder="••••••" className={inputCls} />
                </div>
                {passError && <p className="text-xs text-destructive flex items-center gap-1"><Icon name="AlertCircle" size={12} />{passError}</p>}
                <button onClick={handleChangePassword}
                  className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
                  Сохранить пароль
                </button>
              </div>
            </div>
            )}
          </div>

          {/* Мои покупки */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowMyPurchases(v => !v)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="ShoppingBag" size={15} className="text-muted-foreground" />
                Мои покупки
                {orders.length > 0 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{orders.length}</span>}
              </p>
              <Icon name={showMyPurchases ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
            </button>
            {showMyPurchases && (
            <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
            {ordersLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Загружаем...
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Icon name="ShoppingBag" size={24} className="text-muted-foreground opacity-40" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Покупок пока нет</h3>
                <p className="text-sm text-muted-foreground mb-4">Здесь появятся ваши заказы</p>
                <button onClick={() => setPage("catalog")}
                  className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm">
                  Перейти в каталог
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{orders.length} заказ{orders.length === 1 ? "" : orders.length < 5 ? "а" : "ов"}</p>
                {orders.map(order => {
                  const st = STATUS_LABEL[order.status] ?? { label: order.status, color: "text-muted-foreground" };
                  const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "";
                  const isOpen = expandedOrder === order.id;
                  const preview = order.items?.[0];
                  return (
                    <div key={order.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                      <button onClick={() => setExpandedOrder(isOpen ? null : order.id)}
                        className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors text-left">
                        {preview?.image ? (
                          <img src={preview.image} alt={preview.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-secondary" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                            <Icon name="Package" size={20} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-0.5">№ {order.id.replace("order_", "").toUpperCase().slice(0, 8)}</p>
                          <p className="text-sm font-semibold text-foreground">
                            {Number(order.orderTotal).toLocaleString("ru-RU")} ₽
                            <span className="text-xs font-normal text-muted-foreground ml-1">· {order.items?.length ?? 0} товар{(order.items?.length ?? 0) === 1 ? "" : (order.items?.length ?? 0) < 5 ? "а" : "ов"}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                            {date && <span className="text-xs text-muted-foreground">· {date}</span>}
                            {order.deliveryCityName && <span className="text-xs text-muted-foreground">· {order.deliveryCityName.split(",")[0]}</span>}
                          </div>
                        </div>
                        <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground flex-shrink-0" />
                      </button>
                      {isOpen && (
                        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 animate-fade-in">
                          {order.items?.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                              {item.image ? <img src={item.image} alt={item.name} className="w-10 h-10 rounded-xl object-cover bg-secondary flex-shrink-0" /> : <div className="w-10 h-10 rounded-xl bg-secondary flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.qty} шт. × {Number(item.price).toLocaleString("ru-RU")} ₽</p>
                              </div>
                              <p className="text-sm font-semibold text-foreground flex-shrink-0">{(item.qty * item.price).toLocaleString("ru-RU")} ₽</p>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-border space-y-1">
                            {order.deliveryCityName && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Icon name="MapPin" size={12} />
                                <span>{order.deliveryCityName}{order.deliveryAddress ? `, ${order.deliveryAddress}` : ""}</span>
                              </div>
                            )}
                            {order.cdekTrackNumber && (
                              <div className="flex items-center gap-2 text-xs text-blue-500">
                                <Icon name="Truck" size={12} />
                                <span>Трек: {order.cdekTrackNumber}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm pt-1">
                              <span className="text-muted-foreground">Итого с доставкой</span>
                              <span className="font-semibold text-foreground">{Number(order.orderTotal).toLocaleString("ru-RU")} ₽</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
            )}
          </div>

          {/* Мои объявления */}
          {hasIndividualProfile && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowIndividualProducts(v => !v)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Icon name="Tag" size={15} className="text-muted-foreground" />
                  Мои объявления
                </p>
                <Icon name={showIndividualProducts ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
              </button>
              {showIndividualProducts && (
                <div className="border-t border-border/50 p-4 animate-fade-in">
                  <DashboardProductsTab
                    warehouses={warehouses}
                    onGoToProfile={() => {}}
                    autoOpenForm={autoOpenProductForm}
                    onAutoOpenDone={() => setAutoOpenProductForm(false)}
                    sellerProfileType="individual"
                  />
                </div>
              )}
            </div>
          )}

          {/* Заказы от покупателей */}
          {hasIndividualProfile && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowMyOrders(v => !v)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Icon name="ClipboardList" size={15} className="text-muted-foreground" />
                  Заказы от покупателей
                </p>
                <Icon name={showMyOrders ? "ChevronUp" : "ChevronDown"} size={16} className="text-muted-foreground" />
              </button>
              {showMyOrders && (
                <div className="border-t border-border/50 p-4 animate-fade-in">
                  <DashboardOrdersTab />
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── Кнопки действий (только физ. лицо) ── */}
      {mode === "personal" && (
        <>
          {/* Тост о лимите */}
          {limitToast && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 animate-fade-in">
              <span className="font-semibold">Лимит исчерпан.</span> Как физлицо вы можете разместить не более 5 объявлений. Хотите больше — станьте ИП или самозанятым (кнопка «Кабинет»).
            </div>
          )}
          {/* Тост о незаполненном профиле */}
          {profileIncompleteToast && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-800 animate-fade-in">
              <p className="font-semibold mb-1">Заполните данные перед подачей объявления:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                {!indLegalName.trim() && <li>ФИО</li>}
                {(!indCardNumber || indCardNumber.replace(/\D/g, "").length < 16) && <li>Номер карты для выплат (16 цифр)</li>}
                {!user?.shopCategory && !indCategory && <li>Категория товаров</li>}
                {!user?.shopCityCode && !indCityCode && <li>Город отправки</li>}
              </ul>
              <button onClick={() => setEditing(true)} className="mt-1.5 text-red-700 font-semibold underline">
                Заполнить сейчас →
              </button>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            {(() => {
              const LIMIT = 5;
              const isIndividual = isSeller && sellerLegalTypeLoaded && sellerLegalType === "individual";
              const limitReached = isIndividual && products.length >= LIMIT;
              const remaining = Math.max(0, LIMIT - products.length);

              const typeLabel: Record<string, string> = {
                individual: "физ. лицо",
                self_employed: "самозанятый",
                ip: "ИП",
                ooo: "ООО/ЗАО",
              };

              let subLabel: string | null = null;
              if (isSeller && sellerLegalTypeLoaded && sellerLegalType) {
                if (sellerLegalType === "individual") {
                  subLabel = limitReached
                    ? `Лимит ${LIMIT}/${LIMIT} исчерпан`
                    : `Осталось ${remaining} из ${LIMIT} · ${typeLabel[sellerLegalType] ?? sellerLegalType}`;
                } else {
                  subLabel = `${products.length} объявл. · ${typeLabel[sellerLegalType] ?? sellerLegalType}`;
                }
              }

              return (
                <button
                  onClick={() => {
                    if (!hasIndividualProfile) {
                      onSetSellerRegisterType?.("individual");
                      setPage("seller-register");
                      return;
                    }
                    if (limitReached) {
                      setLimitToast(true);
                      setTimeout(() => setLimitToast(false), 5000);
                      return;
                    }
                    // Проверяем заполненность профиля
                    const profileOk =
                      indLegalName.trim() &&
                      indCardNumber.replace(/\D/g, "").length === 16 &&
                      (user?.shopCategory || indCategory) &&
                      (user?.shopCityCode || indCityCode);
                    if (!profileOk) {
                      setProfileIncompleteToast(true);
                      setTimeout(() => setProfileIncompleteToast(false), 8000);
                      return;
                    }
                    setAutoOpenProductForm(true);
                    setShowIndividualProducts(true);
                  }}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 hover:opacity-90 transition-opacity ${limitReached ? "bg-primary/40 text-primary-foreground cursor-default" : "bg-primary text-primary-foreground"}`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Icon name="Plus" size={15} />
                    Подать объявление
                  </span>
                  {!hasIndividualProfile
                    ? <span className="text-[10px] opacity-80">зарегистрироваться как физлицо</span>
                    : subLabel && <span className="text-[10px] opacity-80">{subLabel}</span>
                  }
                </button>
              );
            })()}
            <button
              onClick={() => {
                if (!hasLegalProfile) {
                  onSetSellerRegisterType?.("legal");
                  setPage("seller-register");
                } else {
                  handleSetMode("legal");
                }
              }}
              className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2.5 hover:border-primary/40 transition-all text-sm font-semibold text-foreground whitespace-nowrap"
            >
              <Icon name="Store" size={15} className="text-primary" />
              {hasLegalProfile ? "Кабинет" : "Стать продавцом"}
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════
          РЕЖИМ: ЮР. ЛИЦО / ПРОДАВЕЦ
      ══════════════════════════════════════════ */}
      {mode === "legal" && !hasLegalProfile && sellerLegalTypeLoaded && (
        <div className="animate-fade-in text-center py-12 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Icon name="Building2" size={28} className="text-primary opacity-60" />
          </div>
          <div>
            <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-1">Кабинет юридического лица</h2>
            <p className="text-sm text-muted-foreground">Для самозанятых, ИП и ООО — без лимита объявлений, оптовые цены, выставление счётов</p>
          </div>
          <button
            onClick={() => { onSetSellerRegisterType?.("legal"); setPage("seller-register"); }}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            <Icon name="Plus" size={15} />
            Зарегистрироваться как юрлицо
          </button>
        </div>
      )}

      {mode === "legal" && hasLegalProfile && (
        <div className="animate-fade-in space-y-3">

          {/* Шапка продавца */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary text-lg font-bold flex items-center justify-center font-oswald flex-shrink-0">
              {user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-oswald text-lg font-semibold text-foreground tracking-wide truncate">{user.shopName || user.name}</h2>
              <p className="text-xs text-muted-foreground">Кабинет продавца</p>
            </div>
            {isSupported && pushStatus !== "denied" && (
              <button
                onClick={async () => { setPushLoading(true); if (subscribed) await unsubscribe(); else await subscribe(); setPushLoading(false); }}
                disabled={pushLoading}
                title={subscribed ? "Уведомления включены" : "Включить уведомления о заказах"}
                className={`relative p-2 rounded-xl border transition-colors disabled:opacity-50 ${subscribed ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
              >
                {pushLoading ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name={subscribed ? "BellRing" : "BellOff"} size={14} />}
                {subscribed && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />}
              </button>
            )}
          </div>

          {/* Плитки статистики */}
          <div className="grid grid-cols-4 gap-2">
            <button onClick={() => setTab(tab === "Реквизиты" ? null : "Реквизиты")}
              className={`bg-card border rounded-xl p-2.5 text-left transition-colors ${tab === "Реквизиты" ? "border-primary/50 ring-1 ring-primary/20" : "border-primary/30 hover:border-primary/60"}`}>
              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center mb-1.5 font-oswald">
                {user.avatar}
              </div>
              <div className="font-oswald text-[10px] font-semibold text-foreground leading-tight truncate">{(user.shopName || user.name).slice(0, 8)}...</div>
              <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">Данные и реквизиты</div>
            </button>

            <button onClick={() => setTab(tab === "Товары" ? null : "Товары")}
              className={`bg-card border rounded-xl p-2.5 text-left transition-colors ${tab === "Товары" ? "border-primary/50 ring-1 ring-primary/20" : "border-border hover:border-primary/40"}`}>
              <Icon name="Package" size={13} className="text-muted-foreground mb-1.5" />
              <div className="font-oswald text-sm font-semibold text-foreground">{products.length}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Товары</div>
            </button>

            <button onClick={() => setTab(tab === "Мои эфиры" ? null : "Мои эфиры")}
              className={`bg-card border rounded-xl p-2.5 text-left transition-colors ${tab === "Мои эфиры" ? "border-primary/50 ring-1 ring-primary/20" : "border-border hover:border-primary/40"}`}>
              <Icon name="Radio" size={13} className="text-muted-foreground mb-1.5" />
              <div className="font-oswald text-sm font-semibold text-foreground">{myStreams.length}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Эфиры</div>
            </button>

            <button onClick={() => setTab(tab === "Статистика" ? null : "Статистика")}
              className={`bg-card border rounded-xl p-2.5 text-left transition-colors ${tab === "Статистика" ? "border-primary/50 ring-1 ring-primary/20" : "border-border hover:border-primary/40"}`}>
              <Icon name="BarChart2" size={13} className="text-muted-foreground mb-1.5" />
              <div className="font-oswald text-sm font-semibold text-foreground">0 ₽</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Продажи</div>
            </button>
          </div>

          {/* Заказы */}
          <button onClick={() => setTab(tab === "Заказы от покупателей" ? null : "Заказы от покупателей")}
            className={`w-full bg-card border rounded-xl p-3 text-left transition-colors flex items-center gap-3 ${tab === "Заказы от покупателей" ? "border-primary/50 ring-1 ring-primary/20" : "border-border hover:border-primary/40"}`}>
            <Icon name="ShoppingBag" size={16} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Заказы от покупателей</div>
              <div className="text-[11px] text-muted-foreground">Управление и отправка</div>
            </div>
            <Icon name={tab === "Заказы от покупателей" ? "ChevronDown" : "ChevronRight"} size={15} className="text-muted-foreground flex-shrink-0" />
          </button>

          {/* Начать эфир + выйти */}
          <div className="flex items-center gap-2">
            {activeStream ? (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-4 py-2.5 rounded-xl flex-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-live-pulse flex-shrink-0" />
                <span className="text-sm font-semibold text-red-500 truncate flex-1">{activeStream.title}</span>
                <button onClick={() => handleStopStream(activeStream.id)} disabled={stoppingStream === activeStream.id}
                  className="text-xs font-semibold text-red-500 border border-red-500/40 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50 flex items-center gap-1">
                  {stoppingStream === activeStream.id ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Square" size={12} />}
                  Стоп
                </button>
              </div>
            ) : (
              <button onClick={() => setPage("broadcast")}
                className="flex-1 bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
                Начать эфир
              </button>
            )}

          </div>

          {/* ── Контент таба ── */}
          {tab === "Заказы от покупателей" && <DashboardOrdersTab />}
          {tab === "Товары" && <DashboardProductsTab warehouses={warehouses} onGoToProfile={() => setTab("Реквизиты")} autoOpenForm={autoOpenProductForm} onAutoOpenDone={() => setAutoOpenProductForm(false)} sellerProfileType="individual" />}
          {tab === "Мои эфиры" && <DashboardStreamsTab setPage={setPage} />}
          {tab === "Статистика" && (
            <div className="animate-fade-in text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                <Icon name="BarChart2" size={24} className="text-muted-foreground opacity-40" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Статистика появится после первых продаж</h3>
              <p className="text-sm text-muted-foreground">Добавь товары и запусти эфир</p>
            </div>
          )}
          {tab === "Склады" && <DashboardWarehousesTab userId={user.id} warehouses={warehouses} onWarehousesChange={setWarehouses} />}

          {/* Реквизиты */}
          {(tab === "Реквизиты" || tab === null) && (
            <>
              <div className="border-t border-border pt-1">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Данные и реквизиты</p>
              </div>
              <SellerRegisterPage setPage={setPage} embedded initialProfileType="legal" />
            </>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-semibold text-muted-foreground hover:text-red-500 hover:border-red-500/40 transition-colors mt-2"
          >
            <Icon name="LogOut" size={15} />
            Выйти из аккаунта
          </button>
        </div>
      )}

    </div>
  );
}