import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const CDEK_URL = "https://functions.poehali.dev/937e27f3-191a-445d-b034-61bd84ed5381";

interface City {
  code: number;
  city: string;
  region: string;
}

interface Tariff {
  code: number;
  name: string;
  price: number;
  days_min: number;
  days_max: number;
}

interface CdekDeliveryProps {
  weightGrams: number;
  onSelect: (tariff: Tariff | null, city: City | null) => void;
}

export default function CdekDelivery({ weightGrams, onSelect }: CdekDeliveryProps) {
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingTariffs, setLoadingTariffs] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchCities = (q: string) => {
    if (q.length < 2) { setCities([]); setShowDropdown(false); return; }
    setLoadingCities(true);
    fetch(`${CDEK_URL}?action=cities&q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        setCities(Array.isArray(data) ? data : []);
        setShowDropdown(true);
        setError("");
      })
      .catch(() => setError("Не удалось загрузить список городов"))
      .finally(() => setLoadingCities(false));
  };

  const handleInput = (val: string) => {
    setQuery(val);
    if (selectedCity) {
      setSelectedCity(null);
      setTariffs([]);
      setSelectedTariff(null);
      onSelect(null, null);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCities(val), 400);
  };

  const selectCity = (city: City) => {
    setSelectedCity(city);
    setQuery(`${city.city}${city.region ? ", " + city.region : ""}`);
    setShowDropdown(false);
    setTariffs([]);
    setSelectedTariff(null);
    setLoadingTariffs(true);
    setError("");
    fetch(`${CDEK_URL}?action=calc&city_code=${city.code}&weight=${weightGrams}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTariffs(data);
        } else {
          setError("Доставка в этот город недоступна или нет данных");
        }
      })
      .catch(() => setError("Ошибка расчёта доставки"))
      .finally(() => setLoadingTariffs(false));
  };

  const selectTariff = (t: Tariff) => {
    setSelectedTariff(t);
    onSelect(t, selectedCity);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-5 h-5 bg-[#00AAFF]/15 rounded flex items-center justify-center flex-shrink-0">
          <Icon name="Truck" size={12} className="text-[#00AAFF]" />
        </div>
        <span className="text-sm font-medium text-foreground">Доставка СДЭК</span>
      </div>

      {/* City search */}
      <div className="relative" ref={wrapRef}>
        <div className="relative">
          <Icon name="MapPin" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => handleInput(e.target.value)}
            onFocus={() => cities.length > 0 && setShowDropdown(true)}
            placeholder="Введите город доставки..."
            className="w-full bg-secondary border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
          {loadingCities && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            </div>
          )}
          {selectedCity && !loadingCities && (
            <button
              onClick={() => { setQuery(""); setSelectedCity(null); setTariffs([]); setSelectedTariff(null); onSelect(null, null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Icon name="X" size={14} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && cities.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in">
            {cities.map(city => (
              <button
                key={city.code}
                onMouseDown={() => selectCity(city)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary transition-colors text-left"
              >
                <Icon name="MapPin" size={13} className="text-muted-foreground flex-shrink-0" />
                <div>
                  <span className="text-sm text-foreground">{city.city}</span>
                  {city.region && <span className="text-xs text-muted-foreground ml-1.5">{city.region}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading tariffs */}
      {loadingTariffs && (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          Рассчитываем стоимость доставки...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
          <Icon name="AlertCircle" size={14} />
          {error}
        </div>
      )}

      {/* Tariffs */}
      {tariffs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Выберите способ доставки:</p>
          {tariffs.map(t => (
            <button
              key={t.code}
              onClick={() => selectTariff(t)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                selectedTariff?.code === t.code
                  ? "border-primary bg-primary/8 "
                  : "border-border bg-secondary hover:border-border/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  selectedTariff?.code === t.code ? "border-primary" : "border-muted-foreground"
                }`}>
                  {selectedTariff?.code === t.code && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.days_min === t.days_max ? `${t.days_min} дней` : `${t.days_min}–${t.days_max} дней`}
                  </p>
                </div>
              </div>
              <span className="font-oswald text-base font-semibold text-foreground">
                {t.price.toLocaleString("ru")} ₽
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
