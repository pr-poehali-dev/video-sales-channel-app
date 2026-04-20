import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const CDEK_API = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";

interface CdekCity { code: string; city: string; region: string; guid?: string; }

// Налоговый статус продавца
type LegalType = "individual" | "self_employed" | "ip" | "ooo";

const LEGAL_LABELS: Record<LegalType, { short: string; long: string; icon: string }> = {
  individual:     { short: "Физлицо",      long: "Физическое лицо",   icon: "User" },
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
  cardNumber: string;    // Номер карты (самозанятый/физлицо)
  // Физлицо
  passportSeries: string;
  passportNumber: string;
  // Категория товаров
  productCategory: string;
  // Согласия
  agreedOffer: boolean;
  agreedPd: boolean;
}

interface Props {
  setPage: (p: Page) => void;
  embedded?: boolean;
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
      <div className="grid grid-cols-2 gap-3">
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
        {/* Корр. счёт */}
        <div>
          <label className={labelCls}>
            Корр. счёт
            {bikResolved && <span className="ml-1 text-green-500 font-medium">· заполнен авто</span>}
          </label>
          <input
            value={corrAccount}
            onChange={e => onCorrChange(e.target.value.replace(/\D/g, ""))}
            placeholder="30101810..."
            maxLength={20}
            className={inputCls + (bikResolved && corrAccount ? " border-green-500/40 bg-green-500/5" : "")}
          />
        </div>
      </div>
      {/* Название банка */}
      <div>
        <label className={labelCls}>
          Название банка
          {bikResolved && <span className="ml-1 text-green-500 font-medium">· определён по БИК</span>}
        </label>
        <input
          value={bankName}
          onChange={e => onBankNameChange(e.target.value)}
          placeholder="ПАО «Сбербанк»"
          className={inputCls + (bikResolved && bankName ? " border-green-500/40 bg-green-500/5" : "")}
        />
        {bikResolved && bankName && (
          <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
            <Icon name="CheckCircle" size={10} />
            Банк найден автоматически
          </p>
        )}
      </div>
    </div>
  );
}

const PRODUCT_CATEGORIES = [
  "Одежда и аксессуары", "Электроника", "Красота и здоровье", "Дом и интерьер",
  "Детские товары", "Спорт и отдых", "Еда и напитки", "Украшения и бижутерия",
  "Рукоделие и хобби", "Другое",
];

export default function SellerRegisterPage({ setPage, embedded }: Props) {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    passportSeries: "",
    passportNumber: "",
    productCategory: "",
    agreedOffer: false,
    agreedPd: false,
  });

  // Валидация ИНН (реактивно пересчитывается при каждом вводе)
  const innCheck = validateInn(form.inn);

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
            passportSeries: data.passportSeries || "",
            passportNumber: data.passportNumber || "",
            productCategory: data.productCategory || "",
            agreedOffer: data.agreedOffer || false,
            agreedPd: data.agreedPd || false,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const selectCity = (c: CdekCity) => {
    setCityCode(c.code); setCityName(c.city); setCityGuid(c.guid || "");
    setCityQuery(c.city); setSuggestions([]);
  };

  const set = <K extends keyof SellerProfile>(key: K, val: SellerProfile[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSaveAll = async () => {
    setError(null);

    if (!pName.trim()) { setError("Введите имя"); return; }
    if (!pPhone.trim()) { setError("Введите телефон"); return; }
    if (!form.legalName.trim()) { setError("Введите ФИО или название организации"); return; }
    if (!form.inn.trim()) { setError("Введите ИНН"); return; }
    if (!innCheck.valid) { setError(innCheck.error || "Неверный ИНН"); return; }

    const isIpOoo = form.legalType === "ip" || form.legalType === "ooo";
    const isSelfEmployed = form.legalType === "self_employed";

    if (isIpOoo && !form.bankAccount.trim()) { setError("Введите расчётный счёт"); return; }
    if (isIpOoo && !form.bik.trim()) { setError("Введите БИК банка"); return; }
    if (isSelfEmployed && form.payoutMethod === "card" && !form.cardNumber.trim()) { setError("Введите номер карты"); return; }
    if (isSelfEmployed && form.payoutMethod === "account" && !form.bankAccount.trim()) { setError("Введите расчётный счёт"); return; }
    if (form.legalType === "individual" && !form.cardNumber.trim()) { setError("Введите номер карты"); return; }

    if (!form.agreedOffer) { setError("Необходимо принять условия договора оферты"); return; }
    if (!form.agreedPd) { setError("Необходимо дать согласие на обработку персональных данных"); return; }

    setSaving(true);
    try {
      await updateUser({
        name: pName.trim(),
        phone: pPhone.trim(),
        city: pCity.trim(),
        ...(shopName.trim() && cityCode ? {
          shopName: shopName.trim(),
          shopCityCode: cityCode,
          shopCityName: cityName,
          shopCityGuid: cityGuid,
        } : {}),
      });

      const res = await fetch(`${STORE_API}?action=save_seller_profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user!.id,
          ...form,
          contactPhone: pPhone.trim(),
          contactEmail: user!.email,
        }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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

      <div className="mb-5">
        <h1 className="font-oswald text-xl font-semibold text-foreground tracking-wide">Данные и реквизиты</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Заполните один раз — сохраните всё кнопкой внизу</p>
      </div>

      <div className="space-y-4">

        {/* ── Личные данные ── */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Личные данные</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Имя *">
                <input value={pName} onChange={e => setPName(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div>
              <Field label="Телефон *">
                <input value={pPhone} onChange={e => setPPhone(e.target.value)} placeholder="+7 900 000-00-00" className={inputCls} />
              </Field>
            </div>
            <div>
              <Field label="Город">
                <input value={pCity} onChange={e => setPCity(e.target.value)} placeholder="Москва" className={inputCls} />
              </Field>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Email</label>
              <div className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>
        </div>

        {/* ── Магазин ── */}
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

          {/* Город СДЭК */}
          <div className="relative">
            <label className={labelCls}>Город отправки (для СДЭК)</label>
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
        </div>

        {/* ── Налоговый статус ── */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Налоговый статус</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Определяет порядок выплат через Т‑Банк (Безопасная сделка)</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(LEGAL_LABELS) as LegalType[]).map(type => {
              const info = LEGAL_LABELS[type];
              return (
                <button key={type} onClick={() => set("legalType", type)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                    form.legalType === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground hover:border-primary/30"
                  }`}>
                  <Icon name={info.icon} size={14} className="flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight break-words">{info.short}</div>
                    <div className="text-[10px] opacity-70 leading-tight break-words">{info.long}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Блок: Физлицо ── */}
          {isIndividual && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 px-3 py-2 rounded-lg">
                <Icon name="Info" size={13} />
                Для C2C сделок. Нужен паспорт для идентификации по 115-ФЗ
              </div>
              <Field label="ФИО полностью *">
                <input value={form.legalName} onChange={e => set("legalName", e.target.value)}
                  placeholder="Иванов Иван Иванович" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Серия паспорта">
                  <input value={form.passportSeries} onChange={e => set("passportSeries", e.target.value.replace(/\D/g, ""))}
                    placeholder="0000" maxLength={4} className={inputCls} />
                </Field>
                <Field label="Номер паспорта">
                  <input value={form.passportNumber} onChange={e => set("passportNumber", e.target.value.replace(/\D/g, ""))}
                    placeholder="000000" maxLength={6} className={inputCls} />
                </Field>
              </div>
              <Field label="Телефон, привязанный к карте *">
                <input value={pPhone} onChange={e => setPPhone(e.target.value)} placeholder="+7 900 000-00-00" className={inputCls} />
              </Field>
              <Field label="Номер карты для выплат *">
                <input value={form.cardNumber} onChange={e => set("cardNumber", e.target.value.replace(/\D/g, ""))}
                  placeholder="1234 5678 9012 3456" maxLength={16} className={inputCls} />
              </Field>
            </div>
          )}

          {/* ── Блок: Самозанятый ── */}
          {isSelf && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-500/10 px-3 py-2 rounded-lg">
                <Icon name="Info" size={13} />
                Статус проверяется автоматически через API «Мой налог»
              </div>
              <Field label="ФИО полностью *">
                <input value={form.legalName} onChange={e => set("legalName", e.target.value)}
                  placeholder="Иванов Иван Иванович" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
                <InnField
                  value={form.inn}
                  maxLength={lt === "ip" ? 12 : 10}
                  placeholder={lt === "ip" ? "123456789012" : "1234567890"}
                  label={lt === "ip" ? "ИНН (12 цифр) *" : "ИНН (10 цифр) *"}
                  onChange={v => set("inn", v)}
                />
                <Field label={lt === "ip" ? "ОГРНИП *" : "ОГРН *"}>
                  <input value={form.ogrn} onChange={e => set("ogrn", e.target.value.replace(/\D/g, ""))}
                    placeholder={lt === "ip" ? "15 цифр" : "13 цифр"}
                    maxLength={lt === "ip" ? 15 : 13} className={inputCls} />
                </Field>
              </div>
              <Field label={lt === "ip" ? "Полное наименование (ИП Иванов И.И.) *" : "Полное наименование (ООО «Ромашка») *"}>
                <input value={form.legalName} onChange={e => set("legalName", e.target.value)}
                  placeholder={lt === "ip" ? "ИП Иванов Иван Иванович" : 'ООО "Ромашка"'} className={inputCls} />
              </Field>
              <Field label="Юридический адрес *">
                <input value={form.legalAddress} onChange={e => set("legalAddress", e.target.value)}
                  placeholder="129110, г. Москва, ул. Примерная, д. 1" className={inputCls} />
              </Field>

              {/* Банковские реквизиты */}
              <div className="bg-secondary/60 rounded-xl p-3 space-y-3">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Icon name="Landmark" size={13} />
                  Банковские реквизиты
                </p>
                <Field label="Расчётный счёт * (20 цифр)">
                  <input value={form.bankAccount} onChange={e => set("bankAccount", e.target.value.replace(/\D/g, ""))}
                    placeholder="40702810000000000000" maxLength={20} className={inputCls} />
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
            </div>
          )}
        </div>

        {/* ── Документы ── */}
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
          <div className="flex items-center gap-2 bg-green-500/10 text-green-600 text-sm px-4 py-3 rounded-xl">
            <Icon name="CheckCircle" size={16} />Данные успешно сохранены!
          </div>
        )}

        <button onClick={handleSaveAll} disabled={saving}
          className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
          {saving
            ? <><Icon name="Loader" size={16} className="animate-spin" />Сохраняем...</>
            : <><Icon name="Save" size={16} />Сохранить все данные</>}
        </button>

      </div>
    </div>
  );
}