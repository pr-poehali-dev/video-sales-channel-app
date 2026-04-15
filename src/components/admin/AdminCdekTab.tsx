import { useState } from "react";
import Icon from "@/components/ui/icon";

const CDEK_API = "https://functions.poehali.dev/937e27f3-191a-445d-b034-61bd84ed5381";

export default function AdminCdekTab() {
  const [cdekId, setCdekId] = useState("aKDJq0vBV0kRgFKQsJY5vZ77OZfFmP9T");
  const [cdekSecret, setCdekSecret] = useState("");
  const [cdekTesting, setCdekTesting] = useState(false);
  const [cdekResult, setCdekResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const testCdek = async () => {
    if (!cdekId.trim() || !cdekSecret.trim()) {
      setCdekResult({ ok: false, msg: "Введите Client ID и пароль" });
      return;
    }
    setCdekTesting(true);
    setCdekResult(null);
    try {
      const res = await fetch(`${CDEK_API}?action=test_auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: cdekId.trim(), client_secret: cdekSecret.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setCdekResult({ ok: true, msg: data.msg || "Подключено!" });
      } else {
        setCdekResult({ ok: false, msg: data.msg || "Ошибка авторизации. Проверьте ключи." });
      }
    } catch {
      setCdekResult({ ok: false, msg: "Ошибка подключения к серверу" });
    } finally {
      setCdekTesting(false);
    }
  };

  return (
    <div className="max-w-lg animate-fade-in space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#00AAFF]/10 flex items-center justify-center">
            <Icon name="Truck" size={16} className="text-[#00AAFF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Настройки API СДЭК</p>
            <p className="text-xs text-muted-foreground">Ключи из личного кабинета СДЭК → Интеграция → API</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Account / Client ID</label>
          <input
            value={cdekId}
            onChange={e => setCdekId(e.target.value)}
            placeholder="aKDJq0vBV0kRgFKQsJY5vZ77OZfFmP9T"
            className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Secure password / Пароль</label>
          <input
            value={cdekSecret}
            onChange={e => setCdekSecret(e.target.value)}
            placeholder="Вставьте Secure password из кабинета СДЭК"
            className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
        </div>

        {cdekResult && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
            cdekResult.ok ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
          }`}>
            <Icon name={cdekResult.ok ? "CheckCircle" : "AlertCircle"} size={16} />
            {cdekResult.msg}
          </div>
        )}

        <button
          onClick={testCdek}
          disabled={cdekTesting || !cdekId.trim()}
          className="w-full bg-[#00AAFF] text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {cdekTesting
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Проверяю...</>
            : <><Icon name="Zap" size={16} /> Проверить подключение</>
          }
        </button>
      </div>

      <div className="bg-secondary/50 rounded-xl px-4 py-3 text-xs text-muted-foreground">
        <Icon name="Info" size={12} className="inline mr-1.5 mb-0.5" />
        Ключи сохраняются через платформу. Здесь можно только проверить подключение.
      </div>
    </div>
  );
}
