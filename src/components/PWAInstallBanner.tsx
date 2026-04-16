import { useState } from "react";
import Icon from "@/components/ui/icon";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function PWAInstallBanner() {
  const { canInstall, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:w-80">
      <div className="bg-card border border-border rounded-2xl shadow-lg p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name="Smartphone" size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">Установить приложение</p>
          <p className="text-xs text-muted-foreground mt-0.5">Работает без браузера</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={install}
            className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            Установить
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="X" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
