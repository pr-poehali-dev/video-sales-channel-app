import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

const CDEK_URL = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";

interface PvzPoint {
  code: string;
  name: string;
  address: string;
  work_time: string;
  lat: number;
  lon: number;
  phones: string[];
}

interface CdekPvzMapProps {
  cityCode: string;
  cityName: string;
  cityGuid?: string;
  onSelect: (pvz: PvzPoint) => void;
  onClose: () => void;
}

export default function CdekPvzMap({ cityCode, cityName, cityGuid, onSelect, onClose }: CdekPvzMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").Marker[]>([]);
  const [points, setPoints] = useState<PvzPoint[]>([]);
  const [selected, setSelected] = useState<PvzPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  // CSS Leaflet
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  // Загружаем ПВЗ
  useEffect(() => {
    setLoading(true);
    setError("");
    setPoints([]);
    const pvzParam = cityGuid
      ? `city_code=${encodeURIComponent(cityCode)}&city_guid=${cityGuid}`
      : `city_code=${encodeURIComponent(cityCode)}`;
    fetch(`${CDEK_URL}?action=get_pvz&${pvzParam}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPoints(data);
        } else {
          setError("ПВЗ в этом городе не найдены через API. Попробуйте выбрать из списка ниже.");
        }
      })
      .catch(() => setError("Ошибка загрузки ПВЗ"))
      .finally(() => setLoading(false));
  }, [cityCode]);

  // Инициализируем карту
  useEffect(() => {
    if (loading || points.length === 0 || !mapRef.current || viewMode !== "map") return;

    import("leaflet").then(L => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }

      const centerLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
      const centerLon = points.reduce((s, p) => s + p.lon, 0) / points.length;

      const map = L.map(mapRef.current!, { zoomControl: true }).setView([centerLat, centerLon], 12);
      leafletMap.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 19,
      }).addTo(map);

      const makeIcon = (active: boolean) => L.divIcon({
        html: `<div style="width:${active ? 28 : 22}px;height:${active ? 28 : 22}px;background:${active ? "#CC1B1B" : "#00AAFF"};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:${active ? 3 : 2}px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [active ? 28 : 22, active ? 28 : 22],
        iconAnchor: [active ? 14 : 11, active ? 28 : 22],
        className: "",
      });

      markersRef.current = [];
      points.forEach((p, idx) => {
        const marker = L.marker([p.lat, p.lon], { icon: makeIcon(false) })
          .addTo(map)
          .on("click", () => {
            setSelected(p);
            markersRef.current.forEach((m, i) => m.setIcon(makeIcon(i === idx)));
            map.panTo([p.lat, p.lon]);
          });
        marker.bindTooltip(p.name, { permanent: false, direction: "top" });
        markersRef.current.push(marker);
      });
    });

    return () => {
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, points.length, viewMode]);

  const handleSelect = (pvz: PvzPoint) => {
    onSelect(pvz);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/70 flex-shrink-0">
          <Icon name="ArrowLeft" size={18} className="text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Выбор пункта СДЭК</p>
          <p className="text-xs text-muted-foreground truncate">{cityName}</p>
        </div>
        {points.length > 0 && (
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1 flex-shrink-0">
            <button onClick={() => setViewMode("map")} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${viewMode === "map" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              Карта
            </button>
            <button onClick={() => setViewMode("list")} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              Список
            </button>
          </div>
        )}
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-hidden relative">

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Загружаем пункты СДЭК...</p>
            </div>
          </div>
        )}

        {/* Ошибка — показываем ручной ввод */}
        {!loading && error && (
          <div className="h-full flex flex-col items-center justify-center px-6 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
              <Icon name="MapPin" size={28} className="text-muted-foreground opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground mb-1">Пункты не найдены</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <button onClick={onClose} className="text-primary text-sm hover:underline">
              Назад
            </button>
          </div>
        )}

        {/* Карта */}
        {!loading && points.length > 0 && viewMode === "map" && (
          <div ref={mapRef} className="w-full h-full" />
        )}

        {/* Список */}
        {!loading && points.length > 0 && viewMode === "list" && (
          <div className="h-full overflow-y-auto">
            {points.map(p => (
              <button
                key={p.code}
                onClick={() => handleSelect(p)}
                className={`w-full flex items-start gap-3 px-4 py-4 border-b border-border text-left hover:bg-secondary transition-colors ${selected?.code === p.code ? "bg-primary/5" : ""}`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#00AAFF]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name="MapPin" size={15} className="text-[#00AAFF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground line-clamp-1">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.address}</p>
                  {p.work_time && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Icon name="Clock" size={10} />
                      {p.work_time}
                    </p>
                  )}
                </div>
                <Icon name="ChevronRight" size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Нижняя панель — выбранный ПВЗ (только для карты) */}
      {selected && viewMode === "map" && (
        <div className="flex-shrink-0 border-t border-border bg-card p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="MapPin" size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground line-clamp-1">{selected.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{selected.address}</p>
              {selected.work_time && (
                <p className="text-xs text-muted-foreground mt-1">
                  <Icon name="Clock" size={11} className="inline mr-1" />
                  {selected.work_time}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => handleSelect(selected)}
            className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Icon name="Check" size={16} />
            Выбрать этот пункт
          </button>
        </div>
      )}

      {!selected && !loading && !error && points.length > 0 && viewMode === "map" && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-card">
          <p className="text-xs text-muted-foreground text-center">
            Нажмите на метку, чтобы выбрать пункт • или переключитесь в <button onClick={() => setViewMode("list")} className="text-primary underline">список</button>
          </p>
        </div>
      )}
    </div>
  );
}