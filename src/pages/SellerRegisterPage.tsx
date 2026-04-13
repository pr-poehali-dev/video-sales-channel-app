import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

type LegalType = "individual" | "ip" | "ooo";

interface SellerProfile {
  legalType: LegalType;
  legalName: string;
  inn: string;
  bankAccount: string;
  bankName: string;
  bik: string;
  contactPhone: string;
  contactEmail: string;
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<SellerProfile>({
    legalType: "individual",
    legalName: "",
    inn: "",
    bankAccount: "",
    bankName: "",
    bik: "",
    contactPhone: user?.phone || "",
    contactEmail: user?.email || "",
    cdekId: "",
    agreedOffer: false,
    agreedPd: false,
  });

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
            contactPhone: data.contactPhone || user.phone || "",
            contactEmail: data.contactEmail || user.email || "",
            cdekId: data.cdekId || "",
            agreedOffer: data.agreedOffer || false,
            agreedPd: data.agreedPd || false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const set = (key: keyof SellerProfile, val: string | boolean | LegalType) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setError(null);
    if (!form.legalName.trim()) { setError("Введите название / ФИО"); return; }
    if (!form.inn.trim()) { setError("Введите ИНН"); return; }
    if (!form.bankAccount.trim()) { setError("Введите расчётный счёт или номер карты"); return; }
    if (!form.contactPhone.trim()) { setError("Введите телефон"); return; }
    if (!form.agreedOffer) { setError("Необходимо принять условия договора оферты"); return; }
    if (!form.agreedPd) { setError("Необходимо дать согласие на обработку персональных данных"); return; }

    setSaving(true);
    try {
      const res = await fetch(`${STORE_API}?action=save_seller_profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user!.id, ...form }),
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
        <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">
          Кабинет продавца
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Заполните реквизиты для получения выплат и работы с СДЭК
        </p>
      </div>

      <div className="space-y-5">
        {/* Тип продавца */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Тип продавца</h2>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(LEGAL_LABELS) as LegalType[]).map(type => (
              <button
                key={type}
                onClick={() => set("legalType", type)}
                className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                  form.legalType === type
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary text-muted-foreground hover:border-border/60"
                }`}
              >
                {LEGAL_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Основные данные */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            {form.legalType === "individual" ? "Персональные данные" : "Реквизиты организации"}
          </h2>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {form.legalType === "individual" ? "ФИО *" : "Название организации *"}
            </label>
            <input
              value={form.legalName}
              onChange={e => set("legalName", e.target.value)}
              placeholder={form.legalType === "individual" ? "Иванов Иван Иванович" : 'ООО "Ромашка"'}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ИНН *</label>
              <input
                value={form.inn}
                onChange={e => set("inn", e.target.value.replace(/\D/g, ""))}
                placeholder={form.legalType === "individual" ? "12 цифр" : "10 цифр"}
                maxLength={12}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">СДЭК ID <span className="text-muted-foreground/60">(необязательно)</span></label>
              <input
                value={form.cdekId}
                onChange={e => set("cdekId", e.target.value)}
                placeholder="Ваш ID в личном кабинете СДЭК"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Реквизиты для выплат */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Реквизиты для выплат</h2>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {form.legalType === "individual" ? "Номер карты *" : "Расчётный счёт *"}
            </label>
            <input
              value={form.bankAccount}
              onChange={e => set("bankAccount", e.target.value.replace(/\D/g, ""))}
              placeholder={form.legalType === "individual" ? "1234 5678 9012 3456" : "20 цифр"}
              maxLength={20}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {form.legalType !== "individual" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Банк</label>
                <input
                  value={form.bankName}
                  onChange={e => set("bankName", e.target.value)}
                  placeholder="Название банка"
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">БИК</label>
                <input
                  value={form.bik}
                  onChange={e => set("bik", e.target.value.replace(/\D/g, ""))}
                  placeholder="9 цифр"
                  maxLength={9}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Контактные данные */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Контактные данные</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Телефон *</label>
              <input
                value={form.contactPhone}
                onChange={e => set("contactPhone", e.target.value)}
                placeholder="+7 900 000-00-00"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input
                value={form.contactEmail}
                onChange={e => set("contactEmail", e.target.value)}
                placeholder="seller@example.com"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Согласия */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground mb-1">Согласия</h2>
          {[
            { key: "agreedOffer" as const, label: "Я принимаю условия договора оферты платформы Югазин.рф" },
            { key: "agreedPd" as const, label: "Я даю согласие на обработку персональных данных" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <div
                onClick={() => set(key, !form[key])}
                className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-all ${
                  form[key] ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
                }`}
              >
                {form[key] && <Icon name="Check" size={12} className="text-primary-foreground" />}
              </div>
              <span className="text-sm text-muted-foreground leading-snug">{label}</span>
            </label>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl">
            <Icon name="AlertCircle" size={16} />
            {error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 bg-green-500/10 text-green-600 text-sm px-4 py-3 rounded-xl">
            <Icon name="CheckCircle" size={16} />
            Данные сохранены
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Icon name="Save" size={18} />
              Сохранить реквизиты
            </>
          )}
        </button>
      </div>
    </div>
  );
}
