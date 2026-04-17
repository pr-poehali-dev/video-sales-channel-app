import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";

const CDEK_API = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";

interface CdekCity { code: string; city: string; region: string; guid?: string; }

export default function DashboardShopTab() {
  const { user, updateUser } = useAuth();

  const [shopName, setShopName] = useState(user?.shopName || "");
  const [cityQuery, setCityQuery] = useState(user?.shopCityName || "");
  const [cityCode, setCityCode] = useState(user?.shopCityCode || "");
  const [cityGuid, setCityGuid] = useState(user?.shopCityGuid || "");
  const [cityName, setCityName] = useState(user?.shopCityName || "");
  const [suggestions, setSuggestions] = useState<CdekCity[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const selectCity = (c: CdekCity) => {
    setCityCode(c.code);
    setCityName(c.city);
    setCityGuid(c.guid || "");
    setCityQuery(c.city);
    setSuggestions([]);
  };

  const handleSave = async () => {
    setError(null);
    if (!shopName.trim()) { setError("Введите название магазина"); return; }
    if (!cityCode) { setError("Выберите город из списка"); return; }
    setSaving(true);
    try {
      await updateUser({
        shopName: shopName.trim(),
        shopCityCode: cityCode,
        shopCityName: cityName,
        shopCityGuid: cityGuid,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError("Ошибка сохранения"); } finally { setSaving(false); }
  };

  const hasChanges = shopName !== (user?.shopName || "") || cityCode !== (user?.shopCityCode || "");

  return (
    <div className="animate-fade-in max-w-lg">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">

        {/* Иконка + заголовок */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Icon name="Store" size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Мой магазин</p>
            <p className="text-xs text-muted-foreground">Название и город отправки всех товаров</p>
          </div>
        </div>

        {/* Название магазина */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Название магазина *</label>
          <input
            value={shopName}
            onChange={e => setShopName(e.target.value)}
            placeholder="Например: Украшения Марины"
            className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Отображается покупателям в корзине и карточках товаров</p>
        </div>

        {/* Город отправки */}
        <div className="relative">
          <label className="text-xs text-muted-foreground mb-1.5 block">Город отправки товаров *</label>
          {cityCode && cityQuery === cityName ? (
            <div className="flex items-center gap-3 bg-secondary border border-border rounded-xl px-4 py-2.5">
              <Icon name="MapPin" size={14} className="text-primary flex-shrink-0" />
              <span className="text-sm text-foreground flex-1">{cityName}</span>
              <button
                onClick={() => { setCityCode(""); setCityQuery(""); setCityName(""); setCityGuid(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Icon name="MapPin" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={cityQuery}
                onChange={e => { setCityQuery(e.target.value); setCityCode(""); setCityName(""); }}
                placeholder="Начните вводить город..."
                autoFocus={!cityCode}
                className="w-full bg-secondary border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
              {cityLoading && <Icon name="Loader" size={14} className="absolute right-3 top-3 text-muted-foreground animate-spin" />}
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 bg-card border border-border rounded-xl shadow-xl mt-1 overflow-hidden">
              {suggestions.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onMouseDown={() => selectCity(c)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border/50 last:border-0"
                >
                  <span className="font-medium text-foreground">{c.city}</span>
                  {c.region && <span className="text-muted-foreground text-xs ml-1.5">{c.region}</span>}
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">Используется для расчёта стоимости доставки СДЭК</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-xl px-3 py-2">
            <Icon name="AlertCircle" size={13} />
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <><Icon name="Loader" size={15} className="animate-spin" /> Сохраняем...</>
          ) : saved ? (
            <><Icon name="Check" size={15} /> Сохранено</>
          ) : (
            "Сохранить"
          )}
        </button>
      </div>

      {/* Подсказка */}
      {user?.shopCityName && (
        <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-3">
          <Icon name="Info" size={15} className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Все новые товары будут автоматически отправляться из <strong className="text-foreground">{user.shopCityName}</strong>. При редактировании существующих товаров город тоже обновится.
          </p>
        </div>
      )}
    </div>
  );
}
