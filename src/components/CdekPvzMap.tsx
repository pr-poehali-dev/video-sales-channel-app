import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

const CDEK_URL = "https://functions.poehali.dev/937e27f3-191a-445d-b034-61bd84ed5381";

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
  cityCode: number;
  cityName: string;
  onSelect: (pvz: PvzPoint) => void;
  onClose: () => void;
}

export default function CdekPvzMap({ cityCode, cityName, onSelect, onClose }: CdekPvzMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<import("leaflet").Map | null>(null);
  const [points, setPoints] = useState<PvzPoint[]>([]);
  const [selected, setSelected] = useState<PvzPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const markersRef = useRef<import("leaflet").Marker[]>([]);

  // Загружаем CSS Leaflet один раз
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
    fetch(`${CDEK_URL}?action=get_pvz&city_code=${cityCode}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setPoints(data);
        } else {
          setError("ПВЗ в этом городе не найдены");
        }
      })
      .catch(() => setError("Ошибка загрузки ПВЗ"))
      .finally(() => setLoading(false));
  }, [cityCode]);

  // Инициализируем карту после загрузки точек
  useEffect(() => {
    if (loading || points.length === 0 || !mapRef.current) return;

    import("leaflet").then(L => {
      // Фиксим иконку маркера Leaflet (webpack/vite issue)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Уничтожаем старую карту если была
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }

      const centerLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
      const centerLon = points.reduce((s, p) => s + p.lon, 0) / points.length;

      const map = L.map(mapRef.current!, { zoomControl: true }).setView([centerLat, centerLon], 12);
      leafletMap.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      // Иконка выбранная (синяя)
      const selectedIcon = L.divIcon({
        html: `<div style="width:28px;height:28px;background:#CC1B1B;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        className: "",
      });

      const defaultIcon = L.divIcon({
        html: `<div style="width:22px;height:22px;background:#00AAFF;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        className: "",
      });

      markersRef.current = [];

      points.forEach(p => {
        const marker = L.marker([p.lat, p.lon], { icon: defaultIcon })
          .addTo(map)
          .on("click", () => {
            setSelected(p);
            // Обновляем все иконки
            markersRef.current.forEach((m, i) => {
              m.setIcon(points[i].code === p.code ? selectedIcon : defaultIcon);
            });
            map.panTo([p.lat, p.lon]);
          });

        marker.bindTooltip(p.name, { permanent: false, direction: "top" });
        markersRef.current.push(marker);
      });
    });

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, points.length]);

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
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full flex-shrink-0">
            {points.length} ПВЗ
          </span>
        )}
      </div>

      {/* Карта */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Загружаем пункты СДЭК...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10 px-8">
            <div className="text-center">
              <Icon name="MapPin" size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button onClick={onClose} className="mt-4 text-primary text-sm hover:underline">Назад</button>
            </div>
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />
      </div>

      {/* Нижняя панель с выбранным ПВЗ */}
      <div
        className="flex-shrink-0 border-t border-border bg-card transition-all duration-300"
        style={{ maxHeight: selected ? "220px" : "0px", overflow: "hidden" }}
      >
        {selected && (
          <div className="p-4">
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
              onClick={() => { onSelect(selected); onClose(); }}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Icon name="Check" size={16} />
              Выбрать этот пункт
            </button>
          </div>
        )}
      </div>

      {/* Подсказка если ничего не выбрано */}
      {!selected && !loading && !error && points.length > 0 && (
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-card">
          <p className="text-xs text-muted-foreground text-center">
            Нажмите на метку на карте, чтобы выбрать пункт выдачи
          </p>
        </div>
      )}
    </div>
  );
}
