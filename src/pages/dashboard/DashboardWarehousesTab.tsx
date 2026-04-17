import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const CDEK_API = "https://functions.poehali.dev/a73e197d-7da4-4945-bd28-4d0de6b02bb7";

interface CdekCity { code: string; city: string; region: string; guid?: string; }
export interface Warehouse { id: string; sellerId: string; name: string; cityCode: string; cityName: string; address: string; isDefault: boolean; }

interface Props {
  warehouses: Warehouse[];
  setWarehouses: React.Dispatch<React.SetStateAction<Warehouse[]>>;
  whLoading: boolean;
}

export default function DashboardWarehousesTab({ warehouses, setWarehouses, whLoading }: Props) {
  const { user } = useAuth();

  const [showWhForm, setShowWhForm] = useState(false);
  const [whName, setWhName] = useState("");
  const [whAddress, setWhAddress] = useState("");
  const [whCityCode, setWhCityCode] = useState("");
  const [whCityGuid, setWhCityGuid] = useState("");
  const [whCityName, setWhCityName] = useState("");
  const [whCityQuery, setWhCityQuery] = useState("");
  const [whCitySuggestions, setWhCitySuggestions] = useState<CdekCity[]>([]);
  const [whCityLoading, setWhCityLoading] = useState(false);
  const [whError, setWhError] = useState<string | null>(null);
  const [whSaving, setWhSaving] = useState(false);

  useEffect(() => {
    if (whCityQuery.length < 2) { setWhCitySuggestions([]); return; }
    if (whCityName && whCityQuery === whCityName) return;
    const t = setTimeout(async () => {
      setWhCityLoading(true);
      try {
        const r = await fetch(`${CDEK_API}?action=cities&q=${encodeURIComponent(whCityQuery)}`);
        setWhCitySuggestions(await r.json());
      } catch { setWhCitySuggestions([]); } finally { setWhCityLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [whCityQuery, whCityName]);

  const handleAddWarehouse = async () => {
    setWhError(null);
    if (!whName.trim()) { setWhError("Введите название склада"); return; }
    if (!whCityCode) { setWhError("Выберите город из списка"); return; }
    setWhSaving(true);
    try {
      const r = await fetch(`${STORE_API}?action=add_warehouse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seller_id: user!.id, name: whName.trim(), city_code: whCityCode, city_guid: whCityGuid, city_name: whCityName, address: whAddress.trim() }),
      });
      const wh = await r.json();
      setWarehouses(prev => [...prev, wh]);
      setShowWhForm(false);
      setWhName(""); setWhAddress(""); setWhCityCode(""); setWhCityGuid(""); setWhCityName(""); setWhCityQuery(""); setWhCitySuggestions([]);
    } catch { setWhError("Ошибка сохранения"); } finally { setWhSaving(false); }
  };

  const handleSetDefaultWarehouse = async (id: string) => {
    await fetch(`${STORE_API}?action=set_default_warehouse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, seller_id: user!.id }),
    });
    setWarehouses(prev => prev.map(w => ({ ...w, isDefault: w.id === id })));
  };

  const handleDeleteWarehouse = async (id: string) => {
    await fetch(`${STORE_API}?action=delete_warehouse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, seller_id: user!.id }),
    });
    setWarehouses(prev => prev.filter(w => w.id !== id));
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {warehouses.length > 0 ? `${warehouses.length} склад${warehouses.length === 1 ? "" : warehouses.length < 5 ? "а" : "ов"}` : "Нет складов"}
        </span>
        <button onClick={() => setShowWhForm(true)}
          className="flex items-center gap-1.5 text-sm text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors font-medium">
          <Icon name="Plus" size={14} /> Добавить склад
        </button>
      </div>

      {whLoading ? (
        <div className="flex justify-center py-12"><Icon name="Loader" size={24} className="animate-spin text-muted-foreground" /></div>
      ) : warehouses.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="Warehouse" size={24} className="text-muted-foreground opacity-40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Складов пока нет</h3>
          <p className="text-sm text-muted-foreground mb-5">Добавь склад — это город отправления товаров для расчёта доставки СДЭК</p>
          <button onClick={() => setShowWhForm(true)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 text-sm">
            <Icon name="Plus" size={15} /> Добавить склад
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {warehouses.map(w => (
            <div key={w.id} className={`bg-card border rounded-xl p-4 transition-all ${w.isDefault ? "border-primary/40 shadow-[0_0_0_1px_rgba(var(--primary)/0.1)]" : "border-border"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${w.isDefault ? "bg-primary/10" : "bg-secondary"}`}>
                  <Icon name="Warehouse" size={18} className={w.isDefault ? "text-primary" : "text-muted-foreground"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{w.name}</p>
                    {w.isDefault && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">По умолчанию</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{w.cityName}{w.address ? `, ${w.address}` : ""}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!w.isDefault && (
                    <button
                      onClick={() => handleSetDefaultWarehouse(w.id)}
                      className="text-xs text-primary border border-primary/30 px-2.5 py-1.5 rounded-lg hover:bg-primary/5 transition-colors font-medium"
                    >
                      По умолчанию
                    </button>
                  )}
                  <button onClick={() => handleDeleteWarehouse(w.id)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                    <Icon name="Trash2" size={15} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Форма добавления склада */}
      {showWhForm && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 animate-fade-in" onClick={e => { if (e.target === e.currentTarget) setShowWhForm(false); }}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-oswald text-lg font-semibold text-foreground tracking-wide">Новый склад</h3>
              <button onClick={() => setShowWhForm(false)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70">
                <Icon name="X" size={15} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Название склада *</label>
                <input value={whName} onChange={e => setWhName(e.target.value)} placeholder="Например: Основной склад"
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
              </div>
              <div className="relative">
                <label className="text-xs text-muted-foreground mb-1 block">Город отправления *</label>
                <div className="relative">
                  <input value={whCityQuery} onChange={e => { setWhCityQuery(e.target.value); setWhCityCode(""); setWhCityGuid(""); setWhCityName(""); }}
                    placeholder="Начните вводить город..."
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors pr-8" />
                  {whCityLoading && <Icon name="Loader" size={14} className="absolute right-3 top-3 text-muted-foreground animate-spin" />}
                  {whCityCode && !whCityLoading && <Icon name="CheckCircle" size={14} className="absolute right-3 top-3 text-green-500" />}
                </div>
                {whCitySuggestions.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-card border border-border rounded-xl shadow-xl mt-1 overflow-hidden">
                    {whCitySuggestions.map(c => (
                      <button key={c.code} type="button"
                        onClick={() => { setWhCityCode(c.code); setWhCityGuid(c.guid || ""); setWhCityName(c.city); setWhCityQuery(c.city); setWhCitySuggestions([]); }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-b border-border/50 last:border-0">
                        <span className="font-medium text-foreground">{c.city}</span>
                        <span className="text-muted-foreground text-xs ml-1">{c.region}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Адрес склада (необязательно)</label>
                <input value={whAddress} onChange={e => setWhAddress(e.target.value)} placeholder="ул. Примерная, 1"
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors" />
              </div>
              {whError && <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 text-sm text-destructive">{whError}</div>}
              <div className="flex gap-3 pt-1">
                <button onClick={handleAddWarehouse} disabled={whSaving}
                  className="flex-1 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {whSaving ? <><Icon name="Loader" size={15} className="animate-spin" /> Сохранение...</> : "Добавить склад"}
                </button>
                <button onClick={() => setShowWhForm(false)} className="px-5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-secondary transition-colors">
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}