import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const CDEK_API = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";

interface CdekCity { code: string; city: string; region: string; guid?: string; }

type LegalType = "individual" | "ip" | "ooo";

interface SellerProfile {
  legalType: LegalType;
  legalName: string;
  inn: string;
  bankAccount: string;
  bankName: string;
  bik: string;
  cdekId: string;
  agreedOffer: boolean;
  agreedPd: boolean;
}

const LEGAL_LABELS: Record<LegalType, string> = {
  individual: "Физическое лицо",
  ip: "ИП",
  ooo: "ООО / ЗАО",
};

interface Props {
  setPage: (p: Page) => void;
}

export default function SellerRegisterPage({ setPage }: Props) {
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

  // Реквизиты
  const [form, setForm] = useState<SellerProfile>({
    legalType: "individual",
    legalName: "",
    inn: "",
    bankAccount: "",
    bankName: "",
    bik: "",
    cdekId: "",
    agreedOffer: false,
    agreedPd: false,
  });

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

  useEffect(() => {
    if (!user) return;
    fetch(`${STORE_API}?action=get_seller_profile&user_id=${user.id}`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          setForm({
            legalType: data.legalType || "individual",
            legalName: data.legalName || "",
            inn: data.inn || "",
            bankAccount: data.bankAccount || "",
            bankName: data.bankName || "",
            bik: data.bik || "",
            cdekId: data.cdekId || "",
            agreedOffer: data.agreedOffer || false,
            agreedPd: data.agreedPd || false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const selectCity = (c: CdekCity) => {
    setCityCode(c.code); setCityName(c.city); setCityGuid(c.guid || "");
    setCityQuery(c.city); setSuggestions([]);
  };

  const set = (key: keyof SellerProfile, val: string | boolean | LegalType) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSaveAll = async () => {
    setError(null);
    if (!pName.trim()) { setError("Введите имя"); return; }
    if (!pPhone.trim()) { setError("Введите телефон"); return; }
    if (!form.legalName.trim()) { setError("Введите ФИО или название организации"); return; }
    if (!form.inn.trim()) { setError("Введите ИНН"); return; }
    if (!form.bankAccount.trim()) { setError("Введите номер карты или расчётный счёт"); return; }
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <button onClick={() => setPage("dashboard")}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
        <Icon name="ArrowLeft" size={16} />
        Назад в кабинет
      </button>

      <div className="mb-6">
        <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Данные и реквизиты</h1>
        <p className="text-sm text-muted-foreground mt-1">Заполните один раз — сохраните всё кнопкой внизу</p>
      </div>

      <div className="space-y-4">

        {/* ── Личные данные ── */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Личные данные</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Имя *</label>
              <input value={pName} onChange={e => setPName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Телефон *</label>
              <input value={pPhone} onChange={e => setPPhone(e.target.value)} placeholder="+7 900 000-00-00"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Город</label>
              <input value={pCity} onChange={e => setPCity(e.target.value)} placeholder="Москва"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <div className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>
        </div>

        {/* ── Магазин ── */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Магазин</h2>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Название магазина</label>
            <input value={shopName} onChange={e => setShopName(e.target.value)}
              placeholder="Например: Украшения Марины"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
            <p className="text-[11px] text-muted-foreground mt-1">Отображается покупателям в корзине</p>
          </div>
          <div className="relative">
            <label className="text-xs text-muted-foreground mb-1 block">Город отправки (для СДЭК)</label>
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
                  className="w-full bg-secondary border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
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

        {/* ── Тип продавца + реквизиты ── */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Тип продавца</h2>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(LEGAL_LABELS) as LegalType[]).map(type => (
              <button key={type} onClick={() => set("legalType", type)}
                className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                  form.legalType === type
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary text-muted-foreground hover:border-border/60"
                }`}>
                {LEGAL_LABELS[type]}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {form.legalType === "individual" ? "ФИО *" : "Название организации *"}
            </label>
            <input value={form.legalName} onChange={e => set("legalName", e.target.value)}
              placeholder={form.legalType === "individual" ? "Иванов Иван Иванович" : 'ООО "Ромашка"'}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ИНН *</label>
              <input value={form.inn} onChange={e => set("inn", e.target.value.replace(/\D/g, ""))}
                placeholder={form.legalType === "individual" ? "12 цифр" : "10 цифр"}
                maxLength={12}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">СДЭК ID <span className="opacity-50">(необяз.)</span></label>
              <input value={form.cdekId} onChange={e => set("cdekId", e.target.value)}
                placeholder="ID из кабинета СДЭК"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
          </div>
        </div>

        {/* ── Реквизиты для выплат ── */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Реквизиты для выплат</h2>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {form.legalType === "individual" ? "Номер карты *" : "Расчётный счёт *"}
            </label>
            <input value={form.bankAccount} onChange={e => set("bankAccount", e.target.value.replace(/\D/g, ""))}
              placeholder={form.legalType === "individual" ? "1234 5678 9012 3456" : "20 цифр"}
              maxLength={20}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
          </div>
          {form.legalType !== "individual" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Банк</label>
                <input value={form.bankName} onChange={e => set("bankName", e.target.value)}
                  placeholder="Название банка"
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">БИК</label>
                <input value={form.bik} onChange={e => set("bik", e.target.value.replace(/\D/g, ""))}
                  placeholder="9 цифр" maxLength={9}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
              </div>
            </div>
          )}
        </div>

        {/* ── Согласия ── */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          {[
            { key: "agreedOffer" as const, label: "Я принимаю условия договора оферты платформы" },
            { key: "agreedPd" as const, label: "Я даю согласие на обработку персональных данных" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <div onClick={() => set(key, !form[key])}
                className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-all ${
                  form[key] ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                }`}>
                {form[key] && <Icon name="Check" size={12} className="text-primary-foreground" />}
              </div>
              <span className="text-sm text-muted-foreground leading-snug">{label}</span>
            </label>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl">
            <Icon name="AlertCircle" size={16} />{error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 bg-green-500/10 text-green-600 text-sm px-4 py-3 rounded-xl">
            <Icon name="CheckCircle" size={16} />Всё сохранено
          </div>
        )}

        <button onClick={handleSaveAll} disabled={saving}
          className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50">
          {saving
            ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Icon name="Save" size={18} />Сохранить всё</>}
        </button>

      </div>
    </div>
  );
}
