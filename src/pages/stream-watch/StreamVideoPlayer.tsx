import Icon from "@/components/ui/icon";
import type { StoreStream } from "@/context/StoreContext";
import type { Page } from "@/App";

const EMOJI_REACTIONS = ["🔥", "❤️", "👏", "😮", "😂"];
const STREAM_THUMBNAIL = "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/5cdc424e-1406-41e5-9e82-3dcbd622fe88.jpg";

function fmtDuration(sec?: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface Props {
  stream: StoreStream;
  setPage: (p: Page) => void;
  liveStatus: "waiting" | "playing" | "error";
  errorMsg: string;
  reaction: string | null;
  messagesCount: number;
  videoElRef: React.RefObject<HTMLDivElement>;
  onChatToggle: () => void;
  onReaction: (emoji: string) => void;
  canReact: boolean;
}

export default function StreamVideoPlayer({
  stream, setPage, liveStatus, errorMsg, reaction,
  messagesCount, videoElRef, onChatToggle, onReaction, canReact,
}: Props) {
  return (
    <div className="relative w-full bg-black lg:flex-1" style={{ aspectRatio: "16/9", maxHeight: "56vw" }}>

      {/* Заставка */}
      <img src={stream.thumbnail || STREAM_THUMBNAIL} alt="thumbnail"
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        style={{ opacity: liveStatus === "playing" ? 0 : 1 }}
      />

      {/* Agora видео */}
      <div ref={videoElRef} className="absolute inset-0 w-full h-full"
        style={{ opacity: liveStatus === "playing" ? 1 : 0, transition: "opacity 0.5s" }}
      />

      {/* Статус подключения */}
      {stream.isLive && liveStatus === "waiting" && (
        <div className="absolute inset-0 flex items-end p-4 bg-gradient-to-t from-black/70 via-transparent to-black/30">
          <div className="flex items-center gap-2 text-white/60 text-xs">
            <Icon name="Loader" size={13} className="animate-spin" />Подключение к эфиру...
          </div>
        </div>
      )}
      {liveStatus === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
          <div>
            <Icon name="WifiOff" size={32} className="mx-auto mb-3 text-red-400" />
            <p className="text-white/70 text-sm">{errorMsg || "Не удалось подключиться"}</p>
          </div>
        </div>
      )}

      {/* Градиент */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />

      {/* Шапка */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-3 z-10">
        <button onClick={() => setPage("streams")}
          className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
          <Icon name="ArrowLeft" size={18} className="text-white" />
        </button>
        {stream.isLive && liveStatus === "playing" && (
          <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
          </span>
        )}
        {!stream.isLive && stream.duration && (
          <span className="bg-black/60 text-white text-xs font-mono px-2 py-1 rounded">{fmtDuration(stream.duration)}</span>
        )}
        <button onClick={onChatToggle}
          className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center relative lg:hidden">
          <Icon name="MessageSquare" size={16} className="text-white" />
          {messagesCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {messagesCount > 9 ? "9+" : messagesCount}
            </span>
          )}
        </button>
      </div>

      {/* Реакция */}
      {reaction && (
        <div className="absolute bottom-20 right-5 text-4xl animate-bounce pointer-events-none z-20">{reaction}</div>
      )}

      {/* Эмодзи */}
      {stream.isLive && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {EMOJI_REACTIONS.map(e => (
            <button key={e} onClick={() => onReaction(e)} disabled={!canReact}
              className="text-lg bg-black/50 backdrop-blur rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/70 active:scale-110 disabled:opacity-40 transition-transform">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
