import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { Page } from "@/App";

interface Props {
  page: Page;
  setPage: (p: Page) => void;
}

export default function LiveBroadcastBar({ page, setPage }: Props) {
  const { user } = useAuth();
  const { streams } = useStore();

  if (!user || user.role === "admin" || page === "broadcast") return null;

  const activeStream = streams.find(s => s.sellerId === user.id && s.isLive);
  if (!activeStream) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-1/2 -translate-x-1/2 z-40 animate-fade-in">
      <button
        onClick={() => setPage("broadcast")}
        className="flex items-center gap-2.5 bg-red-500 text-white pl-3 pr-4 py-2.5 rounded-full shadow-lg shadow-red-500/30 hover:bg-red-600 active:scale-95 transition-all text-sm font-semibold whitespace-nowrap"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20">
          <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
        </span>
        <span>LIVE · {activeStream.title}</span>
        <span className="text-white/70 text-xs font-normal">→ войти</span>
      </button>
    </div>
  );
}
