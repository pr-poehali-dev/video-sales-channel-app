import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type StoreStream, type ChatMessage } from "@/context/StoreContext";
import type { Page } from "@/App";

interface StreamWatchPageProps {
  stream: StoreStream;
  setPage: (p: Page) => void;
}

const EMOJI_REACTIONS = ["🔥", "❤️", "👏", "😮", "😂"];
const POLL_INTERVAL = 4000;

function fmtDuration(sec?: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function StreamWatchPage({ stream, setPage }: StreamWatchPageProps) {
  const { user } = useAuth();
  const { addChatMessage, getStreamMessages } = useStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [reaction, setReaction] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [videoError, setVideoError] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const msgs = await getStreamMessages(stream.id);
      setMessages(msgs);
    } catch { /* ignore */ }
  }, [stream.id, getStreamMessages]);

  useEffect(() => {
    fetchMessages();
    if (stream.isLive) {
      pollRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages, stream.isLive]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = async (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || !user || sending) return;
    setSending(true);
    try {
      const msg = await addChatMessage({
        streamId: stream.id, userId: user.id,
        userName: user.name.split(" ")[0], userAvatar: user.avatar, text: t,
      });
      setMessages(prev => [...prev, msg]);
      if (!text) { setInput(""); inputRef.current?.focus(); }
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  const sendReaction = (emoji: string) => {
    if (!user) return;
    sendMessage(emoji);
    setReaction(emoji);
    setTimeout(() => setReaction(null), 1000);
  };

  const hasVideo = !!stream.videoUrl && !videoError;

  return (
    /* Шортс-стиль: чёрный фон, видео по центру, чат сбоку на десктопе / снизу на мобильном */
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-56px)] bg-black">

      {/* ── Видео-зона ─────────────────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-center bg-black min-h-[50vh] lg:min-h-0">

        {/* Кнопка назад */}
        <button
          onClick={() => setPage("streams")}
          className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
        >
          <Icon name="ArrowLeft" size={18} className="text-white" />
        </button>

        {/* Видео (если есть запись) */}
        {hasVideo ? (
          <video
            src={stream.videoUrl!}
            controls
            autoPlay
            playsInline
            onError={() => setVideoError(true)}
            className="w-full h-full object-contain max-h-[calc(100vh-56px)]"
            style={{ maxWidth: "100%", background: "black" }}
          />
        ) : (
          /* Заглушка — аватар продавца */
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center select-none">
            <div className="w-24 h-24 rounded-full bg-primary/20 text-primary text-4xl font-bold flex items-center justify-center font-oswald">
              {stream.sellerAvatar}
            </div>
            <div>
              <p className="text-white font-semibold text-xl">{stream.sellerName}</p>
              <p className="text-white/50 text-sm mt-1">{stream.title}</p>
            </div>
            {stream.isLive ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
                </span>
                <span className="text-white/60 text-xs">Видео транслируется у продавца</span>
              </div>
            ) : (
              <p className="text-white/40 text-sm">Запись этого эфира недоступна</p>
            )}
          </div>
        )}

        {/* LIVE-бейдж поверх видео */}
        {stream.isLive && hasVideo && (
          <div className="absolute top-4 left-16 flex items-center gap-2 z-10">
            <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
            </span>
            <span className="bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <Icon name="Eye" size={11} />{stream.viewers}
            </span>
          </div>
        )}

        {/* Длительность для записи */}
        {!stream.isLive && stream.duration && (
          <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs font-mono px-2 py-1 rounded z-10">
            {fmtDuration(stream.duration)}
          </div>
        )}

        {/* Реакции поверх видео */}
        {reaction && (
          <div className="absolute bottom-20 right-6 text-5xl animate-bounce pointer-events-none z-20 select-none">
            {reaction}
          </div>
        )}

        {/* Кнопки эмодзи */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {EMOJI_REACTIONS.map(e => (
            <button key={e} onClick={() => sendReaction(e)} disabled={!user}
              className="text-xl bg-black/50 backdrop-blur rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70 transition-colors disabled:opacity-40">
              {e}
            </button>
          ))}
        </div>

        {/* Кнопка чата на мобильном */}
        <button
          onClick={() => setChatOpen(o => !o)}
          className="absolute top-4 right-4 z-20 lg:hidden w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
        >
          <Icon name="MessageSquare" size={17} className="text-white" />
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {messages.length > 99 ? "99+" : messages.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Чат ────────────────────────────────────────────── */}
      <div className={`
        flex flex-col bg-zinc-950 border-l border-white/10
        lg:w-80 xl:w-96 lg:flex-shrink-0
        transition-all duration-300
        ${chatOpen ? "h-[60vh] lg:h-auto" : "h-0 overflow-hidden lg:h-auto lg:overflow-visible"}
      `}>
        {/* Заголовок чата */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
          <Icon name="MessageSquare" size={15} className="text-white/60" />
          <span className="font-semibold text-white/80 text-sm">Чат</span>
          <span className="text-xs text-white/40 ml-1">({messages.length})</span>
          {stream.isLive && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-red-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />LIVE
            </span>
          )}
          {/* Инфо об эфире */}
          <div className="ml-auto hidden lg:block text-right">
            <p className="text-xs font-semibold text-white/70 truncate max-w-[140px]">{stream.title}</p>
            <p className="text-[10px] text-white/40">{stream.sellerName}</p>
          </div>
        </div>

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/40 text-sm">Сообщений пока нет</p>
              {user && <p className="text-white/30 text-xs mt-1">Будь первым!</p>}
            </div>
          ) : (
            messages.map(msg => {
              const isEmoji = /^\p{Emoji}{1,2}$/u.test(msg.text.trim());
              const isMe = msg.userId === user?.id;
              return (
                <div key={msg.id} className={`flex items-start gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  <div className="w-6 h-6 rounded-full bg-primary/30 text-primary text-[10px] font-bold flex items-center justify-center font-oswald flex-shrink-0">
                    {msg.userAvatar}
                  </div>
                  <div className={`max-w-[80%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && <span className="text-[10px] text-white/40 mb-0.5">{msg.userName}</span>}
                    <div className={isEmoji ? "text-2xl" : `rounded-2xl px-3 py-1.5 text-sm break-words ${
                      isMe ? "bg-primary text-white rounded-tr-sm" : "bg-white/10 text-white rounded-tl-sm"
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-white/30 mt-0.5">{msg.sentAt}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Поле ввода */}
        <div className="px-3 py-3 border-t border-white/10 flex-shrink-0">
          {user ? (
            <div className="flex gap-2">
              <input
                ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Написать в чат..."
                maxLength={200}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary/60 transition-colors"
              />
              <button
                onClick={() => sendMessage()} disabled={!input.trim() || sending}
                className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center hover:opacity-90 disabled:opacity-40 flex-shrink-0"
              >
                <Icon name={sending ? "Loader" : "Send"} size={15} className={`text-white ${sending ? "animate-spin" : ""}`} />
              </button>
            </div>
          ) : (
            <button onClick={() => setPage("auth")}
              className="w-full text-sm text-center text-primary/80 border border-white/10 rounded-xl py-2.5 hover:bg-white/5 transition-colors">
              Войдите, чтобы писать в чат
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
