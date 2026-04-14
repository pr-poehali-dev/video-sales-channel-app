import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import CdekPvzMap from "@/components/CdekPvzMap";

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

interface PvzPoint {
  code: string;
  name: string;
  address: string;
  work_time: string;
  lat: number;
  lon: number;
  phones: string[];
}

interface CdekDeliveryProps {
  weightGrams: number;
  fromCityCode?: number;
  sellerId?: string;
  onSelect: (tariff: Tariff | null, city: City | null, pvzCode?: string) => void;
}

export default function CdekDelivery({ weightGrams, fromCityCode = 0, sellerId = "", onSelect }: CdekDeliveryProps) {
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
    const fromParam = fromCityCode ? `&from_city_code=${fromCityCode}` : "";
    const sellerParam = sellerId ? `&seller_id=${sellerId}` : "";
    fetch(`${CDEK_URL}?action=calc&city_code=${city.code}&weight=${weightGrams}${fromParam}${sellerParam}`)
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
    setSelectedPvz(null);
    onSelect(t, selectedCity, undefined);
  };

  // Тариф ПВЗ — код 136
  const isPvzTariff = (t: Tariff) => t.code === 136;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 bg-[#00AAFF]/15 rounded flex items-center justify-center flex-shrink-0">
            <Icon name="Truck" size={12} className="text-[#00AAFF]" />
          </div>
          <span className="text-sm font-medium text-foreground">Доставка СДЭК</span>
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
            Рассчитываем стоимость доставки...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
            <Icon name="AlertCircle" size={14} />
            {error}
          </div>
        )}

        {tariffs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Выберите способ доставки:</p>
            {tariffs.map(t => (
              <div key={t.code}>
                <button
                  onClick={() => selectTariff(t)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                    selectedTariff?.code === t.code
                      ? "border-primary bg-primary/8"
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

                {/* Кнопка выбора ПВЗ на карте — показывается под тарифом самовывоза */}
                {selectedTariff?.code === t.code && isPvzTariff(t) && selectedCity && (
                  <div className="mt-2">
                    {selectedPvz ? (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-3">
                        <Icon name="MapPin" size={15} className="text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground line-clamp-1">{selectedPvz.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{selectedPvz.address}</p>
                        </div>
                        <button
                          onClick={() => setShowPvzMap(true)}
                          className="text-xs text-primary hover:underline flex-shrink-0"
                        >
                          Изменить
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowPvzMap(true)}
                        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 text-primary text-sm font-medium py-3 rounded-xl hover:bg-primary/5 transition-colors"
                      >
                        <Icon name="Map" size={15} />
                        Выбрать пункт выдачи на карте
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Карта ПВЗ — полноэкранный оверлей */}
      {showPvzMap && selectedCity && (
        <CdekPvzMap
          cityCode={selectedCity.code}
          cityName={`${selectedCity.city}${selectedCity.region ? ", " + selectedCity.region : ""}`}
          onSelect={pvz => {
            setSelectedPvz(pvz);
            onSelect(selectedTariff, selectedCity, pvz.code);
          }}
          onClose={() => setShowPvzMap(false)}
        />
      )}
    </>
  );
}
