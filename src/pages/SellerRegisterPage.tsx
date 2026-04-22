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
  ooo:            { short: "ООО/ЗАО",   long: "Юридическое лицо",  icon: "Building2" },
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
  initialProfileType?: "individual" | "legal"; // физлицо или юрлицо
}

const inputCls = "w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";
const labelCls = "text-[11px] text-muted-foreground mb-0.5 block";

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

function Field({ label, hint, children, required }: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className={labelCls}>{label}{required && <span className="text-destructive ml-0.5">*</span>}</label>
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

export default function SellerRegisterPage({ setPage, embedded, onGoAddProduct, initialProfileType }: Props) {
  const profileType = initialProfileType ?? "legal"; // "individual" = физлицо, "legal" = юрлицо
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
    legalType: profileType === "individual" ? "individual" : "self_employed",
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
        if (!r.ok) throw new Error(`INN API error: ${r.status}`);
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
        if (!r.ok) throw new Error(`CDEK cities error: ${r.status}`);
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
        if (!r.ok) throw new Error(`BIK API error: ${r.status}`);
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
    fetch(`${STORE_API}?action=get_seller_profile&user_id=${user.id}&profile_type=${profileType}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setForm(prev => ({
            ...prev,
            legalType: data.legalType || (profileType === "individual" ? "individual" : "self_employed"),
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

  // ── Сохраняем данные текущего legalType в localStorage при переключении ────
  const LSKEY = (lt: LegalType) => `seller_form_${lt}`;

  const switchLegalType = (newType: LegalType) => {
    // Сохраняем текущий блок
    const snapshot = { ...form };
    try { localStorage.setItem(LSKEY(form.legalType), JSON.stringify(snapshot)); } catch { /* ignore */ }
    // Восстанавливаем сохранённый блок нового типа
    try {
      const saved = localStorage.getItem(LSKEY(newType));
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SellerProfile>;
        setForm({ ...form, ...parsed, legalType: newType });
        if (parsed.inn) setInnFieldsVisible(true);
        return;
      }
    } catch { /* ignore */ }
    setForm(prev => ({ ...prev, legalType: newType }));
    setInnFieldsVisible(false);
    setInnResolved(false);
    setBikResolved(false);
  };

  // ── Сохранение черновика (fire-and-forget) ────────────────────────────────
  const saveDraft = useCallback(async (formData: SellerProfile, userId: string) => {
    setDraftStatus("saving");
    try {
      await fetch(`${STORE_API}?action=save_seller_draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          profileType,
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
    // Мгновенно в localStorage
    try { localStorage.setItem(LSKEY(form.legalType), JSON.stringify(form)); } catch { /* ignore */ }
    // Дебаунс на сервер
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => saveDraft(form, user.id), 1500);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, loading, user]);

  const handleSaveAll = async () => {
    setError(null);
    const lt = form.legalType;

    // ── Общие поля ──
    if (lt !== "individual" && !pName.trim()) { setError("Введите ваше имя"); return; }
    // Для самозанятых контактный телефон = телефон из «Мой налог»
    const contactPhone = (lt === "self_employed") ? form.phoneForTax : pPhone;
    if (!contactPhone.trim()) { setError("Введите телефон"); return; }
    if (contactPhone.replace(/\D/g, "").length < 10) { setError("Введите корректный номер телефона (не менее 10 цифр)"); return; }

    // ── Валидация по типу ──
    if (lt === "individual") {
      if (!form.legalName.trim()) { setError("Введите ФИО полностью"); return; }
      const nameParts = form.legalName.trim().split(/\s+/);
      if (nameParts.length < 2) { setError("Введите фамилию и имя полностью"); return; }
      if (!form.cardNumber.trim()) { setError("Введите номер карты для выплат"); return; }
      if (form.cardNumber.replace(/\D/g, "").length < 16) { setError("Номер карты должен содержать 16 цифр"); return; }
      if (!form.productCategory) { setError("Выберите категорию товаров"); return; }
      if (!cityCode) { setError("Укажите город отправки — он будет подставляться в каждый товар"); return; }
    }

    if (lt === "self_employed") {
      if (!form.legalName.trim()) { setError("Введите ФИО полностью"); return; }
      if (!form.inn.trim()) { setError("Введите ИНН"); return; }
      if (!innCheck.valid) { setError(innCheck.error || "Неверный ИНН"); return; }
      if (!form.phoneForTax.trim()) { setError("Введите телефон, привязанный к «Мой налог»"); return; }
      if (form.payoutMethod === "card" && !form.cardNumber.trim()) { setError("Введите номер карты для выплат"); return; }
      if (form.payoutMethod === "account" && !form.bankAccount.trim()) { setError("Введите расчётный счёт"); return; }
      if (form.payoutMethod === "account" && form.bankAccount.replace(/\D/g, "").length !== 20) { setError("Расчётный счёт должен содержать 20 цифр"); return; }
      if (form.payoutMethod === "account" && !form.bik.trim()) { setError("Введите БИК банка"); return; }
      if (form.payoutMethod === "account" && form.bik.replace(/\D/g, "").length !== 9) { setError("БИК должен содержать 9 цифр"); return; }
      if (!cityCode) { setError("Укажите город отправки — он будет подставляться в каждый товар"); return; }
      if (!shopName.trim()) { setError("Введите название магазина"); return; }
      if (!form.productCategory) { setError("Выберите категорию товаров"); return; }
    }

    if (lt === "ip" || lt === "ooo") {
      if (!form.inn.trim()) { setError(lt === "ip" ? "Введите ИНН (12 цифр)" : "Введите ИНН (10 цифр)"); return; }
      if (!innCheck.valid) { setError(innCheck.error || "Неверный ИНН"); return; }
      if (!form.legalName.trim()) { setError(lt === "ip" ? "Введите полное наименование ИП" : "Введите полное наименование организации"); return; }
      if (!form.ogrn.trim()) { setError(lt === "ip" ? "Введите ОГРНИП" : "Введите ОГРН"); return; }
      if (!form.legalAddress.trim()) { setError("Введите юридический адрес"); return; }
      if (!form.bankAccount.trim()) { setError("Введите расчётный счёт"); return; }
      if (form.bankAccount.replace(/\D/g, "").length !== 20) { setError("Расчётный счёт должен содержать 20 цифр"); return; }
      if (!form.bik.trim()) { setError("Введите БИК банка"); return; }
      if (form.bik.replace(/\D/g, "").length !== 9) { setError("БИК должен содержать 9 цифр"); return; }
      if (!cityCode) { setError("Укажите город отправки — он будет подставляться в каждый товар"); return; }
      if (!shopName.trim()) { setError("Введите название магазина"); return; }
      if (!form.productCategory) { setError("Выберите категорию товаров"); return; }
    }

    if (!form.agreedOffer) { setError("Необходимо принять условия договора оферты"); return; }
    if (!form.agreedPd) { setError("Необходимо дать согласие на обработку персональных данных"); return; }

    setSaving(true);
    try {
      const isIndividualType = form.legalType === "individual";
      const resolvedShopName = isIndividualType
        ? (shopName.trim() || form.legalName.trim() || pName.trim())
        : shopName.trim();
      await updateUser({
        name: isIndividualType ? (form.legalName.trim() || pName.trim()) : pName.trim(),
        phone: contactPhone.trim(),
        city: pCity.trim(),
        ...((resolvedShopName || isIndividualType) && cityCode ? {
          shopName: resolvedShopName,
          shopCityCode: cityCode,
          shopCityName: cityName,
          shopCityGuid: cityGuid,
          shopCarriers: carriers,
          shopCategory: form.productCategory,
        } : (resolvedShopName && !cityCode ? {
          shopName: resolvedShopName,
          shopCarriers: carriers,
          shopCategory: form.productCategory,
        } : isIndividualType ? {
          shopName: resolvedShopName,
          shopCarriers: carriers,
          shopCategory: form.productCategory,
        } : {})),
      });

      const res = await fetch(`${STORE_API}?action=save_seller_profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user!.id,
          profileType,
          ...form,
          userType: form.legalType,
          contactPhone: contactPhone.trim(),
          contactEmail: user!.email,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Ошибка сохранения");
      }
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
              onClick={() => { if (onGoAddProduct) { onGoAddProduct(); } else { sessionStorage.setItem("profileOpenTab", "Товары"); setPage("profile"); } }}
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
            onClick={() => setPage("profile")}
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

  return (
    <div className="max-w-2xl mx-auto px-3 py-3 animate-fade-in">
      {!embedded && (
        <button onClick={() => setPage("profile")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-3 transition-colors">
          <Icon name="ArrowLeft" size={16} />
          Назад в кабинет
        </button>
      )}

      {/* Статус: если уже сохранено — показываем сводку */}
      {savedLegalType && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
          <Icon name="CheckCircle" size={14} className="text-green-500 flex-shrink-0" />
          <p className="text-xs text-green-700">
            <strong>{LEGAL_LABELS[savedLegalType]?.short}</strong> · данные сохранены
          </p>
          {draftStatus === "saving" && <Icon name="Loader" size={12} className="text-muted-foreground animate-spin ml-auto" />}
          {draftStatus === "saved" && <Icon name="CheckCircle" size={12} className="text-green-500 ml-auto" />}
        </div>
      )}

      {!savedLegalType && (
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-oswald text-base font-semibold text-foreground tracking-wide">Данные и реквизиты</h1>
          {draftStatus === "saving" && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Icon name="Loader" size={11} className="animate-spin" />Сохраняю...</span>}
          {draftStatus === "saved" && <span className="flex items-center gap-1 text-xs text-green-600"><Icon name="CheckCircle" size={11} />Сохранено</span>}
        </div>
      )}

      <div className="space-y-2">

        {/* ── Налоговый статус ── */}
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          {profileType === "individual" ? (
            <div className="flex items-center gap-2 py-1">
              <Icon name="User" size={16} className="text-primary" />
              <div>
                <h2 className="text-xs font-semibold text-foreground">Физическое лицо</h2>
                <p className="text-[11px] text-muted-foreground">Продажа б/у товаров, до 5 объявлений, выплаты на карту</p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xs font-semibold text-foreground">Кто вы?</h2>
              <p className="text-[11px] text-muted-foreground">Выберите статус — от него зависят поля</p>
            </div>
          )}

          {profileType !== "individual" && (<div className="flex gap-1.5">
            {(Object.keys(LEGAL_LABELS) as LegalType[]).filter(t => t !== "individual").map(type => {
              const info = LEGAL_LABELS[type];
              const isActive = form.legalType === type;
              const isSavedType = savedLegalType === type;
              return (
                <button key={type} onClick={() => {
                  switchLegalType(type);
                }}
                  className={`flex-1 flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg border text-center transition-all ${
                    isSavedType
                      ? "border-green-500/60 bg-green-500/10"
                      : isActive
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary hover:border-primary/30"
                  }`}>
                  <Icon name={info.icon} size={13} className={isSavedType ? "text-green-600" : isActive ? "text-primary" : "text-muted-foreground"} />
                  <span className={`text-[11px] font-semibold leading-none whitespace-nowrap ${isSavedType ? "text-green-700" : isActive ? "text-primary" : "text-foreground"}`}>
                    {info.short}
                  </span>
                </button>
              );
            })}
          </div>)}

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
              <Field label="ФИО полностью *" hint="Фамилия Имя Отчество — как в паспорте">
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
              <div>
                <label className={labelCls}>Телефон в «Мой налог» *</label>
                <div className="relative">
                  <input
                    value={form.phoneForTax}
                    onChange={e => set("phoneForTax", e.target.value.replace(/[^\d+\s()-]/g, ""))}
                    placeholder="+7 900 000-00-00"
                    inputMode="tel"
                    className={inputCls + " pr-8 " + (
                      form.phoneForTax.replace(/\D/g, "").length >= 10
                        ? "border-green-500/60"
                        : form.phoneForTax.length > 0
                        ? "border-destructive/60"
                        : ""
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {form.phoneForTax.replace(/\D/g, "").length >= 10 && <Icon name="CheckCircle" size={14} className="text-green-500" />}
                    {form.phoneForTax.length > 0 && form.phoneForTax.replace(/\D/g, "").length < 10 && <Icon name="XCircle" size={14} className="text-destructive" />}
                  </div>
                </div>
                {form.phoneForTax.replace(/\D/g, "").length >= 10
                  ? <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1"><Icon name="CheckCircle" size={10} />Номер корректный</p>
                  : form.phoneForTax.length > 0
                  ? <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><Icon name="AlertCircle" size={10} />Введите не менее 10 цифр</p>
                  : <p className="text-[11px] text-muted-foreground mt-1">Тот номер, на который зарегистрировано приложение «Мой налог»</p>
                }
              </div>

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
                    <input value={form.bankAccount} onChange={e => set("bankAccount", e.target.value.replace(/\D/g, "").slice(0, 20))}
                      placeholder="40802810000000000000" className={inputCls} />
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
              <div>
                <label className={labelCls}>Контактный телефон *</label>
                <div className="relative">
                  <input
                    value={pPhone}
                    onChange={handlePhoneChange}
                    placeholder="+7 (900) 000-00-00"
                    inputMode="tel"
                    className={inputCls + " pr-8 " + (
                      pPhone.replace(/\D/g, "").length >= 10
                        ? "border-green-500/60"
                        : pPhone.length > 0
                        ? "border-destructive/60"
                        : ""
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {pPhone.replace(/\D/g, "").length >= 10 && <Icon name="CheckCircle" size={14} className="text-green-500" />}
                    {pPhone.length > 0 && pPhone.replace(/\D/g, "").length < 10 && <Icon name="XCircle" size={14} className="text-destructive" />}
                  </div>
                </div>
                {pPhone.replace(/\D/g, "").length >= 10
                  ? <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1"><Icon name="CheckCircle" size={10} />Номер корректный</p>
                  : pPhone.length > 0
                  ? <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><Icon name="AlertCircle" size={10} />Введите не менее 10 цифр</p>
                  : <p className="text-[11px] text-muted-foreground mt-1">Для связи по вопросам заказов</p>
                }
              </div>
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
                  <Field
                    label={lt === "ip" ? "ОГРНИП *" : "ОГРН *"}
                    hint={lt === "ip" ? "15 цифр — из свидетельства ИП" : "13 цифр — из свидетельства о регистрации ООО"}
                  >
                    <div className="relative">
                      <input value={form.ogrn} onChange={e => set("ogrn", e.target.value.replace(/\D/g, ""))}
                        placeholder={lt === "ip" ? "123456789012345" : "1234567890123"}
                        maxLength={lt === "ip" ? 15 : 13}
                        className={inputCls + " pr-8 " + (
                          form.ogrn.length === (lt === "ip" ? 15 : 13) ? " border-green-500/60" :
                          form.ogrn.length > 0 ? " border-destructive/60" : ""
                        )} />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {form.ogrn.length === (lt === "ip" ? 15 : 13) && <Icon name="CheckCircle" size={14} className="text-green-500" />}
                        {form.ogrn.length > 0 && form.ogrn.length < (lt === "ip" ? 15 : 13) && <Icon name="XCircle" size={14} className="text-destructive" />}
                      </div>
                    </div>
                  </Field>
                  <Field label={lt === "ip" ? "Полное наименование ИП *" : "Полное наименование организации *"}
                    hint={lt === "ip" ? "Например: ИП Иванов Иван Иванович" : 'Например: ООО "Ромашка"'}>
                    <input value={form.legalName} onChange={e => set("legalName", e.target.value)}
                      placeholder={lt === "ip" ? "ИП Иванов Иван Иванович" : 'ООО "Ромашка"'}
                      className={inputCls + (form.legalName.trim().length > 3 ? " border-green-500/40" : "")} />
                  </Field>
                  <Field label="Юридический адрес *" hint="Адрес регистрации из ЕГРИП/ЕГРЮЛ">
                    <input value={form.legalAddress} onChange={e => set("legalAddress", e.target.value)}
                      placeholder="129110, г. Москва, ул. Примерная, д. 1"
                      className={inputCls + (form.legalAddress.trim().length > 5 ? " border-green-500/40" : "")} />
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
                  <div>
                    <label className={labelCls}>Расчётный счёт * (20 цифр)</label>
                    <div className="relative">
                      <input value={form.bankAccount} onChange={e => set("bankAccount", e.target.value.replace(/\D/g, "").slice(0, 20))}
                        placeholder="40702810000000000000"
                        className={inputCls + " pr-8 " + (form.bankAccount.length === 20 ? " border-green-500/60" : form.bankAccount.length > 0 ? " border-destructive/60" : "")} />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {form.bankAccount.length === 20 && <Icon name="CheckCircle" size={14} className="text-green-500" />}
                        {form.bankAccount.length > 0 && form.bankAccount.length < 20 && <Icon name="XCircle" size={14} className="text-destructive" />}
                      </div>
                    </div>
                    {form.bankAccount.length === 20
                      ? <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1"><Icon name="CheckCircle" size={10} />Счёт заполнен</p>
                      : form.bankAccount.length > 0
                      ? <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><Icon name="AlertCircle" size={10} />Нужно ровно 20 цифр (сейчас {form.bankAccount.length})</p>
                      : <p className="text-[11px] text-muted-foreground mt-1">Начинается на 407 (ООО) или 408 (ИП)</p>
                    }
                  </div>
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

        {/* ── Блок: Физическое лицо — все данные в одном блоке ── */}
        {profileType === "individual" && (() => {
          const fioOk = form.legalName.trim().split(/\s+/).length >= 2;
          const fioErr = form.legalName.trim().length > 0 && !fioOk;
          const phoneDigits = pPhone.replace(/\D/g, "");
          const phoneOk = phoneDigits.length >= 10;
          const phoneErr = pPhone.length > 0 && !phoneOk;
          const cardDigits = form.cardNumber.replace(/\D/g, "");
          const cardOk = cardDigits.length === 16;
          const cardErr = form.cardNumber.length > 0 && !cardOk;
          const fmtCard = (v: string) => v.replace(/\D/g, "").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
          return (
          <div className="bg-card border border-border rounded-xl p-3 space-y-3">
            <h2 className="text-xs font-semibold text-foreground">Личные данные</h2>

            {/* ФИО */}
            <div>
              <label className={labelCls}>ФИО полностью *</label>
              <div className="relative">
                <input value={form.legalName} onChange={e => set("legalName", e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className={inputCls + (fioErr ? " border-red-400" : fioOk ? " border-green-400" : "")} />
                {fioOk && <Icon name="CheckCircle" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />}
              </div>
              {fioErr && <p className="text-[11px] text-red-500 mt-1">Введите фамилию и имя (минимум два слова)</p>}
              {!form.legalName && <p className="text-[11px] text-muted-foreground mt-1">Фамилия Имя Отчество — как в паспорте</p>}
            </div>

            {/* Телефон */}
            <div>
              <label className={labelCls}>Телефон *</label>
              <div className="relative">
                <input value={pPhone} onChange={handlePhoneChange}
                  placeholder="+7 (999) 000-00-00" inputMode="tel"
                  className={inputCls + (phoneErr ? " border-red-400" : phoneOk ? " border-green-400" : "")} />
                {phoneOk && <Icon name="CheckCircle" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />}
              </div>
              {phoneErr && <p className="text-[11px] text-red-500 mt-1">Введите не менее 10 цифр</p>}
              {!pPhone && <p className="text-[11px] text-muted-foreground mt-1">Для связи по вопросам заказов</p>}
            </div>

            {/* Карта */}
            <div>
              <label className={labelCls}>Номер карты для выплат *</label>
              <div className="relative">
                <input
                  value={fmtCard(form.cardNumber)}
                  onChange={e => set("cardNumber", e.target.value.replace(/\D/g, "").slice(0, 16))}
                  placeholder="0000 0000 0000 0000"
                  inputMode="numeric" maxLength={19}
                  className={inputCls + (cardErr ? " border-red-400" : cardOk ? " border-green-400" : "")} />
                {cardOk && <Icon name="CheckCircle" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />}
              </div>
              {cardErr && <p className="text-[11px] text-red-500 mt-1">Номер карты — 16 цифр</p>}
              {!form.cardNumber && <p className="text-[11px] text-muted-foreground mt-1">На эту карту поступят деньги за продажи</p>}
            </div>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
              <Icon name="Info" size={13} className="flex-shrink-0 mt-0.5" />
              <span>Физлица продают только б/у товары, до 5 объявлений. Без чека и ИНН.</span>
            </div>

            {/* Магазин — для физлица */}
            <div className="border-t border-border/50 pt-3">
              <h2 className="text-xs font-semibold text-foreground mb-2">Магазин</h2>
              <Field label="Название магазина" hint="Отображается покупателям в корзине" required>
                <input value={shopName} onChange={e => setShopName(e.target.value)}
                  placeholder="Например: Мои вещи" className={inputCls} />
              </Field>
              <div className="mt-2">
                <Field label="Категория товаров" hint="Используется для настройки ставок и комиссий" required>
                  <select
                    value={form.productCategory}
                    onChange={e => set("productCategory", e.target.value)}
                    className={inputCls + " cursor-pointer"}>
                    <option value="">— Выберите категорию —</option>
                    {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            {/* Город отправки — прямо в этом блоке для физлица */}
            <div className="relative">
              <label className={labelCls}>
                Город отправки *
                {cityCode && <span className="ml-1.5 text-green-600 font-normal">· будет подставляться в каждый товар</span>}
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
              <div className="flex flex-wrap gap-1.5 mt-1">
                {([
                  ["СДЭК", "Truck", true],
                  ["ПЭК", "Package", false],
                  ["Почта России", "Mail", false],
                  ["Деловые линии", "Container", false],
                ] as const).map(([name, icon, available]) => {
                  const active = carriers.includes(name);
                  if (!available) return (
                    <div key={name} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-secondary/40 opacity-40 cursor-not-allowed">
                      <Icon name={icon} size={11} className="text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">{name}</span>
                    </div>
                  );
                  return (
                    <button key={name} type="button"
                      onClick={() => setCarriers(prev => active ? prev.filter(c => c !== name) : [...prev, name])}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all ${
                        active ? "border-green-500/50 bg-green-500/10 text-green-700" : "border-border bg-secondary text-muted-foreground hover:border-primary/30"
                      }`}>
                      <Icon name={icon} size={11} />
                      <span className="text-[11px] font-medium">{name}</span>
                      {active && <Icon name="Check" size={10} className="ml-0.5 text-green-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          );
        })()}

        {/* ── Магазин — только для юрлиц ── */}
        {profileType !== "individual" && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <h2 className="text-xs font-semibold text-foreground">Магазин</h2>
          <Field label="Название магазина" hint="Отображается покупателям в корзине" required>
            <input value={shopName} onChange={e => setShopName(e.target.value)}
              placeholder="Например: Украшения Марины" className={inputCls} />
          </Field>

          {/* Категория товаров */}
          <Field label="Категория товаров" hint="Используется для настройки ставок и комиссий" required>
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
            <div className="flex flex-wrap gap-1.5 mt-1">
              {([
                ["СДЭК", "Truck", true],
                ["ПЭК", "Package", false],
                ["Почта России", "Mail", false],
                ["Деловые линии", "Container", false],
              ] as const).map(([name, icon, available]) => {
                const active = carriers.includes(name);
                if (!available) return (
                  <div key={name} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-secondary/40 opacity-40 cursor-not-allowed">
                    <Icon name={icon} size={11} className="text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">{name}</span>
                  </div>
                );
                return (
                  <button key={name} type="button"
                    onClick={() => setCarriers(prev => active ? prev.filter(c => c !== name) : [...prev, name])}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all ${
                      active ? "border-green-500/50 bg-green-500/10 text-green-700" : "border-border bg-secondary text-muted-foreground hover:border-primary/30"
                    }`}>
                    <Icon name={icon} size={11} />
                    <span className="text-[11px] font-medium">{name}</span>
                    {active && <Icon name="Check" size={10} className="ml-0.5 text-green-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>)}

        {/* ── Документы ── */}
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <div>
            <h2 className="text-xs font-semibold text-foreground">Документы</h2>
            <p className="text-[11px] text-muted-foreground">Могут потребоваться для модерации</p>
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

        {/* ── Согласия ── */}
        <label className="flex items-center gap-2 cursor-pointer group px-1">
          <button
            onClick={() => { set("agreedOffer", !form.agreedOffer); set("agreedPd", !form.agreedOffer); }}
            className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
              form.agreedOffer ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
            }`}
          >
            {form.agreedOffer && <Icon name="Check" size={10} className="text-primary-foreground" />}
          </button>
          <span className="text-[11px] text-muted-foreground leading-snug">
            Принимаю{" "}
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setPage("oferta-seller"); }} className="text-primary underline">оферту</button>
            {" "}и{" "}
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setPage("oferta-buyer"); }} className="text-primary underline">соглашение</button>
            , согласен на обработку ПД и передачу в Т‑Банк
          </span>
        </label>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg">
            <Icon name="AlertCircle" size={13} />{error}
          </div>
        )}

        <button onClick={handleSaveAll} disabled={saving}
          className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
          {saving
            ? <><Icon name="Loader" size={15} className="animate-spin" />Сохраняем...</>
            : savedLegalType
              ? <><Icon name="CheckCircle" size={15} />Обновить данные</>
              : <><Icon name="Save" size={15} />Сохранить</>}
        </button>

      </div>
    </div>
  );
}