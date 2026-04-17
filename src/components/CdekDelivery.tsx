import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";
import CdekPvzMap from "@/components/CdekPvzMap";
import type { SavedPvz } from "@/context/AuthContext";

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
  savedCity?: string;
  savedPvz?: SavedPvz | null;
  onSelect: (tariff: Tariff | null, city: City | null, pvzCode?: string, pvzAddress?: string) => void;
  onClearCity?: () => void;
  onClearPvz?: () => void;
  onSavePvz?: (pvz: SavedPvz) => void;
}

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

function providerLabel(provider?: string): string {
  const map: Record<string, string> = { cdek: "СДЭК", boxberry: "Boxberry", dpd: "DPD", pochta: "Почта России", iml: "IML", pek: "ПЭК" };
  return map[provider?.toLowerCase() || ""] || (provider?.toUpperCase() ?? "");
}

function cleanTariffName(name: string): string {
  return name.replace(/^[A-Z]+:\s*/i, "").trim();
}

export default function DeliverySelector({
  weightGrams,
  fromCityCode = "",
  sellerId = "",
  savedCity = "",
  savedPvz = null,
  onSelect,
  onClearCity,
  onClearPvz,
  onSavePvz,
}: DeliveryProps) {
  const [query, setQuery] = useState(savedCity || "");
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
  const [changingCity, setChangingCity] = useState(false);
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

  // Авто-выбор города из savedCity при первой загрузке
  useEffect(() => {
    if (!savedCity || selectedCity) return;
    const cityName = savedCity.split(",")[0].trim();
    if (cityName.length < 2) return;
    fetch(`${APISHIP_URL}?action=cities&q=${encodeURIComponent(cityName)}`)
      .then(r => r.json())
      .then(data => {
        const list: City[] = Array.isArray(data) ? data : [];
        if (list.length === 0) return;
        const match = list.find(c => savedCity.startsWith(c.city)) ?? list[0];
        selectCity(match);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Восстановление сохранённого ПВЗ после загрузки тарифов
  useEffect(() => {
    if (!savedPvz || !selectedCity || selectedPvz) return;
    if (savedPvz.cityCode !== selectedCity.code) return;
    setSelectedPvz({ code: savedPvz.code, name: savedPvz.name, address: savedPvz.address, work_time: "", lat: 0, lon: 0, phones: [] });
    if (selectedTariff) {
      onSelect(selectedTariff, selectedCity, savedPvz.code, savedPvz.address);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tariffs, savedPvz, selectedCity]);

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
    setChangingCity(false);
    setTariffs([]);
    setSelectedTariff(null);
    setSelectedPvz(null);
    setLoadingTariffs(true);
    setError("");
    onSelect(null, city);
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

  const clearCity = () => {
    setQuery("");
    setSelectedCity(null);
    setTariffs([]);
    setSelectedTariff(null);
    setSelectedPvz(null);
    setChangingCity(false);
    onSelect(null, null);
    onClearCity?.();
  };

  const selectTariff = (t: Tariff) => {
    setSelectedTariff(t);
    setSelectedPvz(null);
    onSelect(t, selectedCity, undefined);
  };

  const [deliveryMode, setDeliveryMode] = useState<"pvz" | "courier">("pvz");

  const isPvz = (t: Tariff) => t.delivery_to === "pvz";

  const pvzTariffs = tariffs.filter(isPvz).sort((a, b) => a.price - b.price);
  const courierTariffs = tariffs.filter(t => !isPvz(t)).sort((a, b) => a.price - b.price);
  const cheapestPvz = pvzTariffs[0] ?? null;
  const cheapestCourier = courierTariffs[0] ?? null;

  const hasPvz = pvzTariffs.length > 0;
  const hasCourier = courierTariffs.length > 0;

  const activeMode = hasPvz && deliveryMode === "pvz" ? "pvz" : hasCourier ? "courier" : hasPvz ? "pvz" : "pvz";
  const activeTariff = activeMode === "pvz" ? cheapestPvz : cheapestCourier;

  useEffect(() => {
    if (tariffs.length === 0) return;
    const mode = hasPvz ? "pvz" : "courier";
    setDeliveryMode(mode);
    const best = mode === "pvz" ? cheapestPvz : cheapestCourier;
    if (best) selectTariff(best);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tariffs]);

  const showCityInput = !selectedCity || changingCity;

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

        {/* Город — показываем карточку если выбран, иначе input */}
        {selectedCity && !changingCity ? (
          <div className="flex items-start gap-3 bg-secondary border border-border rounded-xl px-4 py-3">
            <Icon name="MapPin" size={15} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-tight">{selectedCity.city}</p>
              {selectedCity.region && <p className="text-xs text-muted-foreground leading-tight mt-0.5">{selectedCity.region}</p>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => { setChangingCity(true); setQuery(""); }}
                className="text-xs text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
              >
                Сменить
              </button>
              <button
                onClick={clearCity}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10"
                title="Удалить город"
              >
                <Icon name="Trash2" size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative" ref={wrapRef}>
            <div className="relative">
              <Icon name="MapPin" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={e => handleInput(e.target.value)}
                onFocus={() => cities.length > 0 && setShowDropdown(true)}
                placeholder="Введите город доставки..."
                autoFocus={changingCity}
                className="w-full bg-secondary border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
              {loadingCities && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                </div>
              )}
              {changingCity && !loadingCities && (
                <button
                  onClick={() => { setChangingCity(false); }}
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
        )}

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

            {/* Тариф */}
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

            {/* ПВЗ — кнопка выбора или карточка выбранного */}
            {activeMode === "pvz" && activeTariff && selectedCity && (
              selectedPvz ? (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-primary bg-primary/8">
                  <Icon name="MapPin" size={16} className="text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-primary font-medium">Пункт выбран</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedPvz.address}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setShowPvzMap(true)}
                      className="text-xs text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                    >
                      Сменить
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPvz(null);
                        if (selectedTariff) onSelect(selectedTariff, selectedCity, undefined);
                        onClearPvz?.();
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-lg hover:bg-destructive/10"
                      title="Удалить ПВЗ"
                    >
                      <Icon name="Trash2" size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowPvzMap(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border hover:border-primary/40 transition-all"
                >
                  <Icon name="MapPin" size={16} className="text-muted-foreground" />
                  <p className="flex-1 text-left text-sm text-muted-foreground">Выбрать пункт выдачи на карте</p>
                  <Icon name="ChevronRight" size={14} className="text-muted-foreground flex-shrink-0" />
                </button>
              )
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
            onSavePvz?.({
              code: pvz.code,
              name: pvz.name,
              address: pvz.address,
              cityCode: selectedCity.code,
              cityName: `${selectedCity.city}${selectedCity.region ? ", " + selectedCity.region : ""}`,
            });
          }}
          onClose={() => setShowPvzMap(false)}
        />
      )}
    </>
  );
}
