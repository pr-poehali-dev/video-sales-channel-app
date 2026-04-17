import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import CdekPvzMap from "@/components/CdekPvzMap";

const APISHIP_URL = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";

interface City {
  code: string;
  city: string;
  region: string;
  guid?: string;
}

interface Tariff {
  code: string;
  name: string;
  price: number;
  days_min: number;
  days_max: number;
  provider?: string;
  delivery_to?: "pvz" | "courier";
}

interface PvzPoint {
  code: string;
  name: string;
  address: string;
  work_time: string;
  lat: number;
  lon: number;
  phones: string[];
}

interface DeliveryProps {
  weightGrams: number;
  fromCityCode?: string;
  sellerId?: string;
  onSelect: (tariff: Tariff | null, city: City | null, pvzCode?: string, pvzAddress?: string) => void;
}

// Убираем дубли тарифов с одинаковым кодом+именем, берём с наименьшими сроками
function dedupTariffs(tariffs: Tariff[]): Tariff[] {
  const map = new Map<string, Tariff>();
  for (const t of tariffs) {
    const key = `${t.code}__${t.delivery_to}`;
    const existing = map.get(key);
    if (!existing || t.days_min < existing.days_min) {
      map.set(key, t);
    }
  }
  return Array.from(map.values());
}

// Красивое имя провайдера
function providerLabel(provider?: string): string {
  const map: Record<string, string> = { cdek: "СДЭК", boxberry: "Boxberry", dpd: "DPD", pochta: "Почта России", iml: "IML", pek: "ПЭК" };
  return map[provider?.toLowerCase() || ""] || (provider?.toUpperCase() ?? "");
}

// Чистое название тарифа (убираем prefix "CDEK: " и т.п.)
function cleanTariffName(name: string): string {
  return name.replace(/^[A-Z]+:\s*/i, "").trim();
}

export default function DeliverySelector({ weightGrams, fromCityCode = "", sellerId = "", onSelect }: DeliveryProps) {
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingTariffs, setLoadingTariffs] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState("");
  const [selectedPvz, setSelectedPvz] = useState<PvzPoint | null>(null);
  const [showPvzMap, setShowPvzMap] = useState(false);
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
    fetch(`${APISHIP_URL}?action=cities&q=${encodeURIComponent(q)}`)
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
      setSelectedPvz(null);
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
    setSelectedPvz(null);
    setLoadingTariffs(true);
    setError("");
    const fromParam = fromCityCode ? `&from_city_code=${encodeURIComponent(fromCityCode)}` : "";
    const sellerParam = sellerId ? `&seller_id=${sellerId}` : "";
    const guidParam = city.guid ? `&city_guid=${city.guid}` : "";
    fetch(`${APISHIP_URL}?action=calc&city_code=${encodeURIComponent(city.code)}&weight=${weightGrams}${guidParam}${fromParam}${sellerParam}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0 && !data[0]?._raw) {
          setTariffs(dedupTariffs(data));
        } else {
          setError("Доставка в этот город недоступна");
        }
      })
      .catch(() => setError("Ошибка расчёта доставки"))
      .finally(() => setLoadingTariffs(false));
  };

  const selectTariff = (t: Tariff) => {
    setSelectedTariff(t);
    setSelectedPvz(null);
    onSelect(t, selectedCity, undefined);
  };

  const [deliveryMode, setDeliveryMode] = useState<"pvz" | "courier">("pvz");

  const isPvz = (t: Tariff) => t.delivery_to === "pvz";

  // Группируем тарифы по типу, берём только самый дешёвый
  const pvzTariffs = tariffs.filter(isPvz).sort((a, b) => a.price - b.price);
  const courierTariffs = tariffs.filter(t => !isPvz(t)).sort((a, b) => a.price - b.price);
  const cheapestPvz = pvzTariffs[0] ?? null;
  const cheapestCourier = courierTariffs[0] ?? null;

  const hasPvz = pvzTariffs.length > 0;
  const hasCourier = courierTariffs.length > 0;

  // Выбранный режим с учётом доступности
  const activeMode = hasPvz && deliveryMode === "pvz" ? "pvz" : hasCourier ? "courier" : hasPvz ? "pvz" : "pvz";
  const activeTariff = activeMode === "pvz" ? cheapestPvz : cheapestCourier;

  // Авто-выбор самого дешёвого тарифа при загрузке
  useEffect(() => {
    if (tariffs.length === 0) return;
    const mode = hasPvz ? "pvz" : "courier";
    setDeliveryMode(mode);
    const best = mode === "pvz" ? cheapestPvz : cheapestCourier;
    if (best) selectTariff(best);
  }, [tariffs]);

  return (
    <>
      <div className="space-y-3">
        {/* Заголовок */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
            <Icon name="Truck" size={12} className="text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">Доставка</span>
        </div>

        {/* Поиск города */}
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
                onClick={() => { setQuery(""); setSelectedCity(null); setTariffs([]); setSelectedTariff(null); setSelectedPvz(null); onSelect(null, null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" size={14} />
              </button>
            )}
          </div>

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

        {loadingTariffs && (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            Рассчитываем варианты доставки...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
            <Icon name="AlertCircle" size={14} />
            {error}
          </div>
        )}

        {tariffs.length > 0 && (
          <div className="space-y-3">
            {/* Табы: Самовывоз / Курьер */}
            <div className="flex gap-2">
              {hasPvz && (
                <button
                  onClick={() => {
                    setDeliveryMode("pvz");
                    if (cheapestPvz) selectTariff(cheapestPvz);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                    activeMode === "pvz"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-muted-foreground border-border hover:border-primary/30"
                  }`}
                >
                  <Icon name="Store" size={14} />
                  Самовывоз
                </button>
              )}
              {hasCourier && (
                <button
                  onClick={() => {
                    setDeliveryMode("courier");
                    if (cheapestCourier) selectTariff(cheapestCourier);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                    activeMode === "courier"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-muted-foreground border-border hover:border-primary/30"
                  }`}
                >
                  <Icon name="Truck" size={14} />
                  Курьер
                </button>
              )}
            </div>

            {/* Один самый дешёвый тариф */}
            {activeTariff && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-primary bg-primary/8">
                <div>
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {providerLabel(activeTariff.provider)}
                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                      · {activeTariff.days_min === activeTariff.days_max ? `${activeTariff.days_min}` : `${activeTariff.days_min}–${activeTariff.days_max}`} дн.
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{cleanTariffName(activeTariff.name)}</p>
                </div>
                <span className="font-oswald text-base font-semibold text-foreground flex-shrink-0">{activeTariff.price.toLocaleString("ru")} ₽</span>
              </div>
            )}

            {/* Кнопка выбора ПВЗ (если активный режим — самовывоз) */}
            {activeMode === "pvz" && activeTariff && selectedCity && (
              <button
                onClick={() => setShowPvzMap(true)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  selectedPvz ? "border-primary bg-primary/8" : "border-dashed border-border hover:border-primary/40"
                }`}
              >
                <Icon name="MapPin" size={16} className={selectedPvz ? "text-primary" : "text-muted-foreground"} />
                <div className="flex-1 text-left">
                  {selectedPvz ? (
                    <>
                      <p className="text-xs text-primary font-medium">Пункт выбран</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{selectedPvz.address}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Выбрать пункт выдачи на карте</p>
                  )}
                </div>
                <Icon name="ChevronRight" size={14} className="text-muted-foreground flex-shrink-0" />
              </button>
            )}
          </div>
        )}
      </div>

      {showPvzMap && selectedCity && (
        <CdekPvzMap
          cityCode={selectedCity.code}
          cityName={selectedCity.city}
          cityGuid={selectedCity.guid}
          onSelect={(pvz) => {
            setSelectedPvz(pvz);
            setShowPvzMap(false);
            if (selectedTariff) onSelect(selectedTariff, selectedCity, pvz.code, pvz.address);
          }}
          onClose={() => setShowPvzMap(false)}
        />
      )}
    </>
  );
}