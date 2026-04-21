import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const CDEK_API = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";
const INN_API = "https://functions.poehali.dev/9326a2b2-0003-49fb-ae73-c8c36b2c03a8";

interface CdekCity { code: string; city: string; region: string; guid?: string; }
interface CdekPvz { code: string; name: string; address: string; work_time: string; type: string; }

// Налоговый статус продавца
type LegalType = "individual" | "self_employed" | "ip" | "ooo";

const LEGAL_LABELS: Record<LegalType, { short: string; long: string; icon: string }> = {
  individual:     { short: "Физлицо",      long: "Физическое лицо (б/у товары)", icon: "User" },
  self_employed:  { short: "Самозанятый",  long: "Самозанятый (НПД)", icon: "Briefcase" },
  ip:             { short: "ИП",           long: "Индивидуальный предприниматель", icon: "Building" },
  ooo:            { short: "ООО / ЗАО",   long: "Юридическое лицо",  icon: "Building2" },
};

// Способ выплат для самозанятых/физлиц
type PayoutMethod = "card" | "account";

interface SellerProfile {
  legalType: LegalType;
  // Общее
  legalName: string;     // ФИО / название орг.
  inn: string;
  // ИП/ООО
  ogrn: string;          // ОГРН/ОГРНИП
  legalAddress: string;  // Юр. адрес
  bankAccount: string;   // Расч. счёт / номер карты
  bik: string;
  corrAccount: string;   // Корр. счёт
  bankName: string;
  // Самозанятый
  phoneForTax: string;   // Телефон в "Мой налог"
  payoutMethod: PayoutMethod; // Способ выплат
  cardNumber: string;    // Номер карты (самозанятый)
  // Категория товаров
  productCategory: string;
  // Согласия
  agreedOffer: boolean;
  agreedPd: boolean;
}

interface Props {
  setPage: (p: Page) => void;
  embedded?: boolean;
  onGoAddProduct?: () => void;
}

const inputCls = "w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";
const labelCls = "text-xs text-muted-foreground mb-1 block";

// ── Компонент поля ИНН с индикатором валидности ─────────────────────────────
interface InnFieldProps {
  value: string;
  maxLength: number;
  placeholder: string;
  label: string;
  onChange: (v: string) => void;
}

function InnField({ value, maxLength, placeholder, label, onChange }: InnFieldProps) {
  const check = validateInn(value);
  const showOk = check.valid;
  const showErr = value.length > 0 && !check.valid && check.error;
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <input
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder={placeholder}
          maxLength={maxLength}
          className={
            inputCls + " pr-8 " +
            (showOk ? "border-green-500/60" : showErr ? "border-destructive/60" : "")
          }
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {showOk && <Icon name="CheckCircle" size={14} className="text-green-500" />}
          {showErr && <Icon name="XCircle" size={14} className="text-destructive" />}
        </div>
      </div>
      {showOk && (
        <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
          <Icon name="CheckCircle" size={10} />ИНН действителен
        </p>
      )}
      {showErr && (
        <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
          <Icon name="AlertCircle" size={10} />{check.error}
        </p>
      )}
    </div>
  );
}

// ── Валидация ИНН по алгоритму ФНС ──────────────────────────────────────────
function validateInn(inn: string): { valid: boolean; error: string | null } {
  if (!inn) return { valid: false, error: null };
  if (!/^\d+$/.test(inn)) return { valid: false, error: "ИНН должен содержать только цифры" };

  const d = inn.split("").map(Number);

  if (inn.length === 10) {
    // ЮЛ: одна контрольная цифра
    const w = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const ctrl = w.reduce((s, wi, i) => s + wi * d[i], 0) % 11 % 10;
    return ctrl === d[9]
      ? { valid: true, error: null }
      : { valid: false, error: "Неверный ИНН — ошибка контрольной суммы" };
  }

  if (inn.length === 12) {
    // ФЛ/ИП: две контрольные цифры
    const w1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const w2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const c1 = w1.reduce((s, wi, i) => s + wi * d[i], 0) % 11 % 10;
    const c2 = w2.reduce((s, wi, i) => s + wi * d[i], 0) % 11 % 10;
    return c1 === d[10] && c2 === d[11]
      ? { valid: true, error: null }
      : { valid: false, error: "Неверный ИНН — ошибка контрольной суммы" };
  }

  return { valid: false, error: `ИНН должен быть 10 или 12 цифр (сейчас ${inn.length})` };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

interface BikBlockProps {
  bik: string;
  corrAccount: string;
  bankName: string;
  bikLoading: boolean;
  bikResolved: boolean;
  onBikChange: (v: string) => void;
  onCorrChange: (v: string) => void;
  onBankNameChange: (v: string) => void;
}

function BikBlock({ bik, corrAccount, bankName, bikLoading, bikResolved, onBikChange, onCorrChange, onBankNameChange }: BikBlockProps) {
  return (
    <div className="space-y-3">
      {/* БИК */}
      <div>
        <label className={labelCls}>БИК банка * (9 цифр)</label>
        <div className="relative">
          <input
            value={bik}
            onChange={e => onBikChange(e.target.value.replace(/\D/g, ""))}
            placeholder="044525225"
            maxLength={9}
            className={inputCls + " pr-8"}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {bikLoading && <Icon name="Loader" size={14} className="text-muted-foreground animate-spin" />}
            {!bikLoading && bikResolved && <Icon name="CheckCircle" size={14} className="text-green-500" />}
          </div>
        </div>
      </div>
      {/* Корр. счёт и название банка — появляются после автозаполнения по БИК */}
      {bikResolved && (
        <div className="space-y-3 animate-fade-in">
          <div>
            <label className={labelCls}>
              Корр. счёт
              <span className="ml-1 text-green-500 font-medium">· заполнен авто</span>
            </label>
            <input
              value={corrAccount}
              onChange={e => onCorrChange(e.target.value.replace(/\D/g, ""))}
              placeholder="30101810..."
              maxLength={20}
              className={inputCls + (corrAccount ? " border-green-500/40 bg-green-500/5" : "")}
            />
          </div>
          <div>
            <label className={labelCls}>
              Название банка
              <span className="ml-1 text-green-500 font-medium">· определён по БИК</span>
            </label>
            <input
              value={bankName}
              onChange={e => onBankNameChange(e.target.value)}
              placeholder="ПАО «Сбербанк»"
              className={inputCls + (bankName ? " border-green-500/40 bg-green-500/5" : "")}
            />
            {bankName && (
              <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                <Icon name="CheckCircle" size={10} />
                Банк найден автоматически
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PRODUCT_CATEGORIES = [
  "Одежда и аксессуары", "Электроника", "Красота и здоровье", "Дом и интерьер",
  "Детские товары", "Спорт и отдых", "Еда и напитки", "Украшения и бижутерия",
  "Рукоделие и хобби", "Другое",
];

export default function SellerRegisterPage({ setPage, embedded, onGoAddProduct }: Props) {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedLegalType, setSavedLegalType] = useState<LegalType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoadRef = useRef(true);

  // Личные данные
  const [pName, setPName] = useState(user?.name ?? "");
  const [pPhone, setPPhone] = useState(user?.phone ?? "");
  const [pCity, setPCity] = useState(user?.city ?? "");

  // Магазин
  const [shopName, setShopName] = useState(user?.shopName || "");
  const [cityQuery, setCityQuery] = useState(user?.shopCityName || "");
  const [cityCode, setCityCode] = useState(user?.shopCityCode || "");
  const [cityGuid, setCityGuid] = useState(user?.shopCityGuid || "");
  const [cityName, setCityName] = useState(user?.shopCityName || "");
  const [suggestions, setSuggestions] = useState<CdekCity[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [carriers, setCarriers] = useState<string[]>(user?.shopCarriers?.length ? user.shopCarriers : ["СДЭК"]);

  // Автозаполнение по ИНН через dadata
  const [innLoading, setInnLoading] = useState(false);
  const [innResolved, setInnResolved] = useState(false);
  const [innError, setInnError] = useState<string | null>(null);
  // Показываем поля сразу если данные уже были сохранены ранее
  const [innFieldsVisible, setInnFieldsVisible] = useState(false);

  // Автозаполнение банка по БИК
  const [bikLoading, setBikLoading] = useState(false);
  const [bikResolved, setBikResolved] = useState(false);

  // Реквизиты
  const [form, setForm] = useState<SellerProfile>({
    legalType: "self_employed",
    legalName: "",
    inn: "",
    ogrn: "",
    legalAddress: "",
    bankAccount: "",
    bik: "",
    corrAccount: "",
    bankName: "",
    phoneForTax: "",
    payoutMethod: "card",
    cardNumber: "",
    productCategory: "",
    agreedOffer: false,
    agreedPd: false,
  });

  // Валидация ИНН (реактивно пересчитывается при каждом вводе)
  const innCheck = validateInn(form.inn);

  // Автозаполнение по ИНН через dadata (для ИП и ООО)
  useEffect(() => {
    const inn = form.inn;
    const lt = form.legalType;
    if (lt === "self_employed") return;
    const expectedLen = lt === "ip" ? 12 : 10;
    if (inn.length !== expectedLen || !innCheck.valid) {
      setInnResolved(false);
      setInnError(null);
      return;
    }
    const t = setTimeout(async () => {
      setInnLoading(true);
      setInnError(null);
      try {
        const r = await fetch(INN_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inn }),
        });
        const data = await r.json();
        if (data.error) {
          setInnError(data.error);
          setInnResolved(false);
          setInnFieldsVisible(true);
        } else {
          setForm(prev => ({
            ...prev,
            legalName: data.name_short || data.name_full || prev.legalName,
            ogrn: data.ogrn || prev.ogrn,
            legalAddress: data.address || prev.legalAddress,
          }));
          setInnResolved(true);
          setInnFieldsVisible(true);
        }
      } catch { setInnError("Ошибка запроса к dadata"); }
      finally { setInnLoading(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [form.inn, form.legalType, innCheck.valid]);

  useEffect(() => {
    if (cityQuery.length < 2 || cityQuery === cityName) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      setCityLoading(true);
      try {
        const r = await fetch(`${CDEK_API}?action=cities&q=${encodeURIComponent(cityQuery)}`);
        const data = await r.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch { setSuggestions([]); } finally { setCityLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [cityQuery, cityName]);

  // Автозаполнение по БИК через API ЦБ (dadatabank.ru)
  useEffect(() => {
    const bik = form.bik;
    if (bik.length !== 9) { setBikResolved(false); return; }
    const t = setTimeout(async () => {
      setBikLoading(true);
      try {
        const r = await fetch(`https://www.bik-info.ru/api.html?type=json&bik=${bik}`);
        const data = await r.json();
        if (data && data.name) {
          setForm(prev => ({
            ...prev,
            bankName: data.name || prev.bankName,
            corrAccount: data.ks || prev.corrAccount,
          }));
          setBikResolved(true);
        } else {
          setBikResolved(false);
        }
      } catch { setBikResolved(false); }
      finally { setBikLoading(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [form.bik]);

  useEffect(() => {
    if (!user) return;
    fetch(`${STORE_API}?action=get_seller_profile&user_id=${user.id}`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          setForm(prev => ({
            ...prev,
            legalType: data.legalType || "self_employed",
            legalName: data.legalName || "",
            inn: data.inn || "",
            ogrn: data.ogrn || "",
            legalAddress: data.legalAddress || "",
            bankAccount: data.bankAccount || "",
            bik: data.bik || "",
            corrAccount: data.corrAccount || "",
            bankName: data.bankName || "",
            phoneForTax: data.phoneForTax || "",
            payoutMethod: data.payoutMethod || "card",
            cardNumber: data.cardNumber || "",
            productCategory: data.productCategory || "",
            agreedOffer: data.agreedOffer || false,
            agreedPd: data.agreedPd || false,
          }));
          if (data.inn) setInnFieldsVisible(true);
          if (data.legalType) setSavedLegalType(data.legalType);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const selectCity = (c: CdekCity) => {
    setCityCode(c.code); setCityName(c.city); setCityGuid(c.guid || "");
    setCityQuery(c.city); setSuggestions([]);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Разрешаем только цифры, +, пробелы, скобки, дефис
    const cleaned = val.replace(/[^\d+\s()-]/g, "");
    setPPhone(cleaned);
  };

  const set = <K extends keyof SellerProfile>(key: K, val: SellerProfile[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  // ── Сохранение черновика (fire-and-forget) ────────────────────────────────
  const saveDraft = useCallback(async (formData: SellerProfile, userId: string) => {
    setDraftStatus("saving");
    try {
      await fetch(`${STORE_API}?action=save_seller_draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          ...formData,
          userType: formData.legalType,
        }),
      });
      setDraftStatus("saved");
      setTimeout(() => setDraftStatus("idle"), 2500);
    } catch {
      setDraftStatus("idle");
    }
  }, []);

  // ── Debounce: автосохранение при изменении формы ──────────────────────────
  useEffect(() => {
    if (loading || !user) return;
    if (isFirstLoadRef.current) { isFirstLoadRef.current = false; return; }
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => saveDraft(form, user.id), 1500);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [form, loading, user, saveDraft]);

  const handleSaveAll = async () => {
    setError(null);
    const lt = form.legalType;

    // ── Общие поля ──
    if (lt !== "individual" && !pName.trim()) { setError("Введите ваше имя"); return; }
    if (!pPhone.trim()) { setError("Введите телефон"); return; }
    if (pPhone.replace(/\D/g, "").length < 10) { setError("Введите корректный номер телефона (не менее 10 цифр)"); return; }

    // ── Валидация по типу ──
    if (lt === "individual") {
      if (!form.legalName.trim()) { setError("Введите ФИО полностью"); return; }
      const nameParts = form.legalName.trim().split(/\s+/);
      if (nameParts.length < 2) { setError("Введите фамилию и имя полностью"); return; }
      if (!form.cardNumber.trim()) { setError("Введите номер карты для выплат"); return; }
      if (!cityCode) { setError("Укажите город отправки — он будет подставляться в каждый товар"); return; }
    }

    if (lt === "self_employed") {
      if (!form.legalName.trim()) { setError("Введите ФИО полностью"); return; }
      if (!form.inn.trim()) { setError("Введите ИНН"); return; }
      if (!innCheck.valid) { setError(innCheck.error || "Неверный ИНН"); return; }
      if (!form.phoneForTax.trim()) { setError("Введите телефон, привязанный к «Мой налог»"); return; }
      if (form.payoutMethod === "card" && !form.cardNumber.trim()) { setError("Введите номер карты для выплат"); return; }
      if (form.payoutMethod === "account" && !form.bankAccount.trim()) { setError("Введите расчётный счёт"); return; }
      if (form.payoutMethod === "account" && !form.bik.trim()) { setError("Введите БИК банка"); return; }
      if (!cityCode) { setError("Укажите город отправки — он будет подставляться в каждый товар"); return; }
    }

    if (lt === "ip" || lt === "ooo") {
      if (!form.inn.trim()) { setError(lt === "ip" ? "Введите ИНН (12 цифр)" : "Введите ИНН (10 цифр)"); return; }
      if (!innCheck.valid) { setError(innCheck.error || "Неверный ИНН"); return; }
      if (!form.legalName.trim()) { setError(lt === "ip" ? "Введите полное наименование ИП" : "Введите полное наименование организации"); return; }
      if (!form.ogrn.trim()) { setError(lt === "ip" ? "Введите ОГРНИП" : "Введите ОГРН"); return; }
      if (!form.legalAddress.trim()) { setError("Введите юридический адрес"); return; }
      if (!form.bankAccount.trim()) { setError("Введите расчётный счёт"); return; }
      if (!form.bik.trim()) { setError("Введите БИК банка"); return; }
      if (!cityCode) { setError("Укажите город отправки — он будет подставляться в каждый товар"); return; }
    }

    if (!form.agreedOffer) { setError("Необходимо принять условия договора оферты"); return; }
    if (!form.agreedPd) { setError("Необходимо дать согласие на обработку персональных данных"); return; }

    setSaving(true);
    try {
      const isIndividualType = form.legalType === "individual";
      await updateUser({
        name: isIndividualType ? (form.legalName.trim() || pName.trim()) : pName.trim(),
        phone: pPhone.trim(),
        city: pCity.trim(),
        ...((shopName.trim() || isIndividualType) && cityCode ? {
          shopName: isIndividualType ? (form.legalName.trim() || pName.trim()) : shopName.trim(),
          shopCityCode: cityCode,
          shopCityName: cityName,
          shopCityGuid: cityGuid,
          shopCarriers: carriers,
        } : (shopName.trim() && !cityCode ? {
          shopName: shopName.trim(),
          shopCarriers: carriers,
        } : isIndividualType ? {
          shopName: form.legalName.trim() || pName.trim(),
          shopCarriers: carriers,
        } : {})),
      });

      const res = await fetch(`${STORE_API}?action=save_seller_profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user!.id,
          ...form,
          userType: form.legalType,
          contactPhone: pPhone.trim(),
          contactEmail: user!.email,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      setSaved(true);
      setSavedLegalType(form.legalType);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <p className="text-muted-foreground mb-4">Войдите, чтобы зарегистрироваться как продавец</p>
        <button onClick={() => setPage("auth")}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
          Войти
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  // ── Экран успеха после сохранения ────────────────────────────────────────
  if (saved) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 animate-fade-in">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckCircle" size={36} className="text-green-500" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Магазин готов!</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Реквизиты сохранены. Теперь добавьте товар или выйдите в эфир.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { if (onGoAddProduct) { onGoAddProduct(); } else { setPage("dashboard"); } }}
              className="w-full bg-primary text-primary-foreground rounded-2xl p-5 text-left hover:opacity-90 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon name="PackagePlus" size={22} className="text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-primary-foreground text-base">Добавить товар</p>
                  <p className="text-xs text-primary-foreground/70 mt-0.5">Загрузи фото, описание и цену</p>
                </div>
                <Icon name="ChevronRight" size={18} className="text-primary-foreground/70" />
              </div>
            </button>

            <button
              onClick={() => setPage("broadcast")}
              className="w-full bg-card border border-border rounded-2xl p-5 text-left hover:border-primary/40 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/20 transition-colors">
                  <Icon name="Video" size={22} className="text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-base">Выйти в эфир</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Продавай товары в прямом эфире</p>
                </div>
                <Icon name="ChevronRight" size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
          </div>

          <button
            onClick={() => setPage("dashboard")}
            className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Перейти в кабинет продавца
          </button>
        </div>
      </div>
    );
  }

  const lt = form.legalType;
  const isIpOoo = lt === "ip" || lt === "ooo";
  const isSelf = lt === "self_employed";
  const isIndividual = lt === "individual";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      {!embedded && (
        <button onClick={() => setPage("dashboard")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
          <Icon name="ArrowLeft" size={16} />
          Назад в кабинет
        </button>
      )}

      {/* Статус: если уже сохранено — показываем сводку */}
      {savedLegalType && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon name="Check" size={15} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-700">Данные сохранены</p>
            <p className="text-xs text-green-600 mt-0.5">
              Тип: <strong>{LEGAL_LABELS[savedLegalType]?.short}</strong> ·{" "}
              {savedLegalType === "individual" ? "Продажа б/у товаров" : "Продажа новых товаров оптом и в розницу"}
            </p>
          </div>
          <Icon name="CheckCircle" size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
        </div>
      )}

      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="font-oswald text-xl font-semibold text-foreground tracking-wide">Данные и реквизиты</h1>
          {draftStatus === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon name="Loader" size={12} className="animate-spin" />
              Сохраняю...
            </span>
          )}
          {draftStatus === "saved" && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <Icon name="CheckCircle" size={12} />
              Черновик сохранён
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">Данные сохраняются автоматически по мере заполнения</p>
      </div>

      <div className="space-y-4">

        {/* ── Налоговый статус ── */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Кто вы?</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Выберите ваш статус — от этого зависят поля и возможности</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(LEGAL_LABELS) as LegalType[]).map(type => {
              const info = LEGAL_LABELS[type];
              const isActive = form.legalType === type;
              const isSavedType = savedLegalType === type;
              const descriptions: Record<LegalType, string> = {
                individual: "Продажа б/у вещей",
                self_employed: "Свои товары, НПД",
                ip: "Бизнес, опт/розница",
                ooo: "Юр. лицо, опт/розница",
              };
              return (
                <button key={type} onClick={() => set("legalType", type)}
                  className={`flex flex-col p-3 rounded-xl border text-left transition-all relative ${
                    isSavedType
                      ? "border-green-500/60 bg-green-500/8"
                      : isActive
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary hover:border-primary/30"
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name={info.icon} size={13} className={isSavedType ? "text-green-600" : isActive ? "text-primary" : "text-muted-foreground"} />
                    <span className={`text-xs font-semibold leading-tight ${isSavedType ? "text-green-700" : isActive ? "text-primary" : "text-foreground"}`}>
                      {info.short}
                    </span>
                    {isSavedType && (
                      <div className="ml-auto w-4 h-4 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Icon name="Check" size={9} className="text-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-tight">{descriptions[type]}</span>
                </button>
              );
            })}
          </div>

          {/* ── Блок: Физическое лицо ── */}
          {isIndividual && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-500/10 px-3 py-2 rounded-lg">
                <Icon name="Info" size={13} />
                Физлица могут продавать только б/у товары. Размещение бесплатно.
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <div className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-muted-foreground truncate">{user.email}</div>
              </div>
              <div>
                <label className={labelCls}>ФИО полностью *</label>
                <input value={form.legalName} onChange={e => set("legalName", e.target.value)}
                  placeholder="Иванов Иван Иванович" className={inputCls} />
                {form.legalName.trim() && form.legalName.trim().split(/\s+/).length < 2 && (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                    <Icon name="AlertCircle" size={11} />
                    Введите минимум фамилию и имя
                  </p>
                )}
                {form.legalName.trim().split(/\s+/).length >= 2 && (
                  <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                    <Icon name="CheckCircle" size={11} />
                    Принято
                  </p>
                )}
              </div>
              <Field label="Телефон *">
                <input value={pPhone} onChange={handlePhoneChange} placeholder="+7 (900) 000-00-00" inputMode="tel" className={inputCls} />
              </Field>
              <Field label="Номер карты для выплат *" hint="На эту карту будут переводиться деньги за продажи">
                <input value={form.cardNumber} onChange={e => set("cardNumber", e.target.value.replace(/\D/g, ""))}
                  placeholder="1234 5678 9012 3456" maxLength={16} className={inputCls} />
              </Field>

              {/* Город отправки */}
              <div className="relative">
                <label className={labelCls}>
                  Город отправки *
                  {cityCode && (
                    <span className="ml-1.5 text-green-600 font-normal">· будет подставляться в каждый товар</span>
                  )}
                </label>
                {!cityCode && (
                  <p className="text-[11px] text-amber-600 mb-1.5 flex items-center gap-1">
                    <Icon name="AlertCircle" size={11} />
                    Укажите город — он автоматически заполнится в карточке каждого товара
                  </p>
                )}
                {cityCode && cityQuery === cityName ? (
                  <div className="flex items-center gap-3 bg-secondary border border-border rounded-xl px-4 py-2.5">
                    <Icon name="MapPin" size={14} className="text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground flex-1">{cityName}</span>
                    <button onClick={() => { setCityCode(""); setCityQuery(""); setCityName(""); setCityGuid(""); }}>
                      <Icon name="X" size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Icon name="MapPin" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={cityQuery}
                      onChange={e => { setCityQuery(e.target.value); setCityCode(""); setCityName(""); }}
                      placeholder="Начните вводить город..."
                      className={inputCls + " pl-9 pr-9"} />
                    {cityLoading && <Icon name="Loader" size={14} className="absolute right-3 top-3 text-muted-foreground animate-spin" />}
                  </div>
                )}
                {suggestions.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-card border border-border rounded-xl shadow-xl mt-1 overflow-hidden">
                    {suggestions.map(c => (
                      <button key={c.code} type="button" onMouseDown={() => selectCity(c)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border/50 last:border-0">
                        <span className="font-medium text-foreground">{c.city}</span>
                        {c.region && <span className="text-muted-foreground text-xs ml-1.5">{c.region}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Транспортные компании */}
              <div>
                <label className={labelCls}>Транспортные компании</label>
                <p className="text-[11px] text-muted-foreground mb-2">Выберите ТК, через которые отправляете заказы</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["СДЭК", "Truck", true],
                    ["ПЭК", "Package", false],
                    ["Почта России", "Mail", false],
                    ["Деловые линии", "Container", false],
                  ] as const).map(([name, icon, available]) => {
                    const active = carriers.includes(name);
                    if (!available) return (
                      <div key={name} className="flex items-center gap-2 p-3 rounded-xl border border-border bg-secondary/40 opacity-50 cursor-not-allowed relative">
                        <Icon name={icon} size={14} className="flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <span className="text-xs font-medium leading-tight text-muted-foreground">{name}</span>
                          <p className="text-[10px] text-muted-foreground/70 leading-tight">Скоро</p>
                        </div>
                      </div>
                    );
                    return (
                      <button key={name} type="button"
                        onClick={() => setCarriers(prev => active ? prev.filter(c => c !== name) : [...prev, name])}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                          active ? "border-green-500/50 bg-green-500/10 text-green-700" : "border-border bg-secondary text-muted-foreground hover:border-primary/30"
                        }`}>
                        <Icon name={icon} size={14} className="flex-shrink-0" />
                        <span className="text-xs font-medium leading-tight">{name}</span>
                        {active && <Icon name="Check" size={12} className="ml-auto flex-shrink-0 text-green-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Блок: Самозанятый ── */}
          {isSelf && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-500/10 px-3 py-2 rounded-lg">
                <Icon name="Info" size={13} />
                Статус проверяется автоматически через API «Мой налог»
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <div className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-muted-foreground truncate">{user.email}</div>
              </div>
              <Field label="ФИО полностью *">
                <input value={form.legalName} onChange={e => set("legalName", e.target.value)}
                  placeholder="Иванов Иван Иванович" className={inputCls} />
              </Field>
              <InnField
                value={form.inn}
                maxLength={12}
                placeholder="123456789012"
                label="ИНН * (12 цифр)"
                onChange={v => set("inn", v)}
              />
              <Field label="Телефон в «Мой налог» *">
                <input value={form.phoneForTax} onChange={e => set("phoneForTax", e.target.value)}
                  placeholder="+7 900 000-00-00" className={inputCls} />
              </Field>

              {/* Способ выплат */}
              <div>
                <label className={labelCls}>Способ получения выплат</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["card", "По карте", "CreditCard", "Мгновенно"],
                    ["account", "По реквизитам", "Landmark", "Стандартный перевод"],
                  ] as const).map(([val, label, icon, hint]) => (
                    <button key={val} onClick={() => set("payoutMethod", val)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                        form.payoutMethod === val
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground hover:border-primary/30"
                      }`}>
                      <Icon name={icon} size={14} className="flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold break-words">{label}</div>
                        <div className="text-[10px] opacity-70 break-words">{hint}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {form.payoutMethod === "card" ? (
                <Field label="Номер карты *">
                  <input value={form.cardNumber} onChange={e => set("cardNumber", e.target.value.replace(/\D/g, ""))}
                    placeholder="1234 5678 9012 3456" maxLength={16} className={inputCls} />
                </Field>
              ) : (
                <div className="space-y-3">
                  <Field label="Расчётный счёт *" hint="20 цифр">
                    <input value={form.bankAccount} onChange={e => set("bankAccount", e.target.value.replace(/\D/g, ""))}
                      placeholder="40802810000000000000" maxLength={20} className={inputCls} />
                  </Field>
                  <BikBlock
                    bik={form.bik}
                    corrAccount={form.corrAccount}
                    bankName={form.bankName}
                    bikLoading={bikLoading}
                    bikResolved={bikResolved}
                    onBikChange={v => { set("bik", v); setBikResolved(false); }}
                    onCorrChange={v => set("corrAccount", v)}
                    onBankNameChange={v => set("bankName", v)}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Блок: ИП / ООО ── */}
          {isIpOoo && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-500/10 px-3 py-2 rounded-lg">
                <Icon name="Info" size={13} />
                {lt === "ip" ? "Для ИП — ОГРНИП 15 цифр, ИНН 12 цифр" : "Для ООО — ОГРН 13 цифр, ИНН 10 цифр"}
              </div>
              <Field label="Телефон *">
                <input value={pPhone} onChange={handlePhoneChange} placeholder="+7 (900) 000-00-00" inputMode="tel" className={inputCls} />
              </Field>
              <div>
                <label className={labelCls}>Email</label>
                <div className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-muted-foreground truncate">{user.email}</div>
              </div>
              <div>
                <label className={labelCls}>{lt === "ip" ? "ИНН (12 цифр) *" : "ИНН (10 цифр) *"}</label>
                <div className="relative">
                  <input
                    value={form.inn}
                    onChange={v => { set("inn", v.target.value.replace(/\D/g, "")); setInnResolved(false); setInnError(null); setInnFieldsVisible(false); }}
                    placeholder={lt === "ip" ? "123456789012" : "1234567890"}
                    maxLength={lt === "ip" ? 12 : 10}
                    className={inputCls + " pr-8 " + (innResolved ? "border-green-500/60" : innCheck.valid && !innCheck.error ? "" : "")}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {innLoading && <Icon name="Loader" size={14} className="text-primary animate-spin" />}
                    {!innLoading && innResolved && <Icon name="CheckCircle" size={14} className="text-green-500" />}
                    {!innLoading && innError && <Icon name="XCircle" size={14} className="text-destructive" />}
                  </div>
                </div>
                {innLoading && <p className="text-[11px] text-primary mt-1 flex items-center gap-1"><Icon name="Loader" size={10} className="animate-spin" />Ищем в реестре ФНС...</p>}
                {innResolved && <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1"><Icon name="CheckCircle" size={10} />Данные подтянуты автоматически</p>}
                {innError && <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><Icon name="AlertCircle" size={10} />{innError} — заполните вручную</p>}
              </div>

              {/* ОГРН, название, адрес — скрыты до автозаполнения по ИНН */}
              {innFieldsVisible && (
                <div className="space-y-3 animate-fade-in">
                  <Field label={lt === "ip" ? "ОГРНИП *" : "ОГРН *"}>
                    <input value={form.ogrn} onChange={e => set("ogrn", e.target.value.replace(/\D/g, ""))}
                      placeholder={lt === "ip" ? "15 цифр" : "13 цифр"}
                      maxLength={lt === "ip" ? 15 : 13}
                      className={inputCls + (innResolved && form.ogrn ? " border-green-500/40 bg-green-500/5" : "")} />
                  </Field>
                  <Field label={lt === "ip" ? "Полное наименование (ИП Иванов И.И.) *" : "Полное наименование (ООО «Ромашка») *"}>
                    <input value={form.legalName} onChange={e => set("legalName", e.target.value)}
                      placeholder={lt === "ip" ? "ИП Иванов Иван Иванович" : 'ООО "Ромашка"'}
                      className={inputCls + (innResolved && form.legalName ? " border-green-500/40 bg-green-500/5" : "")} />
                  </Field>
                  <Field label="Юридический адрес *">
                    <input value={form.legalAddress} onChange={e => set("legalAddress", e.target.value)}
                      placeholder="129110, г. Москва, ул. Примерная, д. 1"
                      className={inputCls + (innResolved && form.legalAddress ? " border-green-500/40 bg-green-500/5" : "")} />
                  </Field>
                </div>
              )}

              {/* Банковские реквизиты — появляются после заполнения ОГРН и названия */}
              <div className="bg-secondary/60 rounded-xl p-3 space-y-3">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Icon name="Landmark" size={13} />
                  Банковские реквизиты
                </p>
                {(innFieldsVisible && form.ogrn && form.legalName) ? (
                  <Field label="Расчётный счёт * (20 цифр)">
                    <input value={form.bankAccount} onChange={e => set("bankAccount", e.target.value.replace(/\D/g, ""))}
                      placeholder="40702810000000000000" maxLength={20} className={inputCls} />
                  </Field>
                ) : !innFieldsVisible && (
                  <p className="text-[11px] text-muted-foreground">Заполните ИНН, ОГРН и название — поля появятся автоматически</p>
                )}
                <BikBlock
                  bik={form.bik}
                  corrAccount={form.corrAccount}
                  bankName={form.bankName}
                  bikLoading={bikLoading}
                  bikResolved={bikResolved}
                  onBikChange={v => { set("bik", v); setBikResolved(false); }}
                  onCorrChange={v => set("corrAccount", v)}
                  onBankNameChange={v => set("bankName", v)}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Магазин ── */}
        {!isIndividual && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Магазин</h2>
          <Field label="Название магазина" hint="Отображается покупателям в корзине">
            <input value={shopName} onChange={e => setShopName(e.target.value)}
              placeholder="Например: Украшения Марины" className={inputCls} />
          </Field>

          {/* Категория товаров */}
          <Field label="Категория товаров" hint="Используется для настройки ставок и комиссий">
            <select
              value={form.productCategory}
              onChange={e => set("productCategory", e.target.value)}
              className={inputCls + " cursor-pointer"}>
              <option value="">— Выберите категорию —</option>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {/* Город отправки */}
          <div className="relative">
            <label className={labelCls}>
              Город отправки *
              {cityCode && (
                <span className="ml-1.5 text-green-600 font-normal">· будет подставляться в каждый товар</span>
              )}
            </label>
            {!cityCode && (
              <p className="text-[11px] text-amber-600 mb-1.5 flex items-center gap-1">
                <Icon name="AlertCircle" size={11} />
                Укажите город — он автоматически заполнится в карточке каждого товара
              </p>
            )}
            {cityCode && cityQuery === cityName ? (
              <div className="flex items-center gap-3 bg-secondary border border-border rounded-xl px-4 py-2.5">
                <Icon name="MapPin" size={14} className="text-primary flex-shrink-0" />
                <span className="text-sm text-foreground flex-1">{cityName}</span>
                <button onClick={() => { setCityCode(""); setCityQuery(""); setCityName(""); setCityGuid(""); }}>
                  <Icon name="X" size={14} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Icon name="MapPin" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={cityQuery}
                  onChange={e => { setCityQuery(e.target.value); setCityCode(""); setCityName(""); }}
                  placeholder="Начните вводить город..."
                  className={inputCls + " pl-9 pr-9"} />
                {cityLoading && <Icon name="Loader" size={14} className="absolute right-3 top-3 text-muted-foreground animate-spin" />}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 bg-card border border-border rounded-xl shadow-xl mt-1 overflow-hidden">
                {suggestions.map(c => (
                  <button key={c.code} type="button" onMouseDown={() => selectCity(c)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border/50 last:border-0">
                    <span className="font-medium text-foreground">{c.city}</span>
                    {c.region && <span className="text-muted-foreground text-xs ml-1.5">{c.region}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Транспортные компании */}
          <div>
            <label className={labelCls}>Транспортные компании</label>
            <p className="text-[11px] text-muted-foreground mb-2">Выберите ТК, через которые отправляете заказы</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["СДЭК", "Truck", true],
                ["ПЭК", "Package", false],
                ["Почта России", "Mail", false],
                ["Деловые линии", "Container", false],
              ] as const).map(([name, icon, available]) => {
                const active = carriers.includes(name);
                if (!available) return (
                  <div key={name} className="flex items-center gap-2 p-3 rounded-xl border border-border bg-secondary/40 opacity-50 cursor-not-allowed">
                    <Icon name={icon} size={14} className="flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="text-xs font-medium leading-tight text-muted-foreground">{name}</span>
                      <p className="text-[10px] text-muted-foreground/70 leading-tight">Скоро</p>
                    </div>
                  </div>
                );
                return (
                  <button key={name} type="button"
                    onClick={() => setCarriers(prev => active ? prev.filter(c => c !== name) : [...prev, name])}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                      active ? "border-green-500/50 bg-green-500/10 text-green-700" : "border-border bg-secondary text-muted-foreground hover:border-primary/30"
                    }`}>
                    <Icon name={icon} size={14} className="flex-shrink-0" />
                    <span className="text-xs font-medium leading-tight">{name}</span>
                    {active && <Icon name="Check" size={12} className="ml-auto flex-shrink-0 text-green-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* ── Документы ── */}
        {!isIndividual && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Документы</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Могут потребоваться для модерации или по запросу банка</p>
          </div>
          <div className="flex items-center gap-3 bg-secondary/60 rounded-xl p-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon name="FileText" size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">Загрузка документов</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Скан паспорта (главный разворот + прописка) и СНИЛС</p>
            </div>
            <span className="text-[10px] bg-secondary border border-border px-2 py-1 rounded-md text-muted-foreground whitespace-nowrap">Скоро</span>
          </div>
        </div>
        )}

        {/* ── Согласия ── */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Согласия</h2>

          {/* Единый чекбокс оферты + ПД */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <button
              onClick={() => { set("agreedOffer", !form.agreedOffer); set("agreedPd", !form.agreedOffer); }}
              className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-all ${
                form.agreedOffer ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
              }`}
            >
              {form.agreedOffer && <Icon name="Check" size={12} className="text-primary-foreground" />}
            </button>
            <span className="text-sm text-muted-foreground leading-snug">
              Я принимаю условия{" "}
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setPage("oferta-seller"); }}
                className="text-primary underline hover:no-underline"
              >
                Оферты для продавцов
              </button>
              {" "}и{" "}
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setPage("oferta-buyer"); }}
                className="text-primary underline hover:no-underline"
              >
                Пользовательского соглашения
              </button>
              , а также даю согласие на обработку персональных данных и их передачу в Т‑Банк для проведения выплат
            </span>
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl">
            <Icon name="AlertCircle" size={16} />{error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-700 px-4 py-3 rounded-xl animate-fade-in">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Icon name="Check" size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold">Данные сохранены!</p>
              <p className="text-xs text-green-600 mt-0.5">Галочка появилась на вашем типе регистрации</p>
            </div>
          </div>
        )}

        <button onClick={handleSaveAll} disabled={saving}
          className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
          {saving
            ? <><Icon name="Loader" size={16} className="animate-spin" />Сохраняем...</>
            : savedLegalType
              ? <><Icon name="CheckCircle" size={16} />Обновить данные</>
              : <><Icon name="Save" size={16} />Сохранить все данные</>}
        </button>

      </div>
    </div>
  );
}