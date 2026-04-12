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

export default function StreamWatchPage({ stream, setPage }: StreamWatchPageProps) {
  const { user } = useAuth();
  const { addChatMessage, getStreamMessages } = useStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [reaction, setReaction] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
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
        streamId: stream.id,
        userId: user.id,
        userName: user.name.split(" ")[0],
        userAvatar: user.avatar,
        text: t,
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
    setTimeout(() => setReaction(null), 900);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <button
        onClick={() => setPage("streams")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
      >
        <Icon name="ArrowLeft" size={16} />
        Назад к эфирам
      </button>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Левая часть — видео + инфо */}
        <div className="flex-1 min-w-0">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video mb-4 flex items-center justify-center">
            <div className="text-center select-none">
              <div className="w-20 h-20 rounded-full bg-primary/20 text-primary text-3xl font-bold flex items-center justify-center font-oswald mx-auto mb-3">
                {stream.sellerAvatar}
              </div>
              <p className="text-white font-semibold text-lg">{stream.sellerName}</p>
              <p className="text-white/60 text-sm mt-1">{stream.title}</p>
            </div>

            {stream.isLive && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
                </div>
                <div className="bg-black/60 text-white text-xs px-2.5 py-1.5 rounded flex items-center gap-1">
                  <Icon name="Eye" size={11} />{stream.viewers}
                </div>
              </div>
            )}

            {reaction && (
              <div className="absolute bottom-16 right-6 text-4xl animate-bounce pointer-events-none select-none">
                {reaction}
              </div>
            )}

            <div className="absolute bottom-4 left-4 flex gap-2">
              {EMOJI_REACTIONS.map(e => (
                <button key={e} onClick={() => sendReaction(e)} disabled={!user}
                  className="text-xl bg-black/40 backdrop-blur rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/60 transition-colors disabled:opacity-40">
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-oswald text-xl font-semibold text-foreground tracking-wide">{stream.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{stream.sellerName} · {stream.startedAt}</p>
              </div>
              {stream.isLive
                ? <span className="flex items-center gap-1.5 bg-red-500/15 text-red-500 text-xs font-semibold px-2.5 py-1.5 rounded-full flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />В ЭФИРЕ
                  </span>
                : <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1.5 rounded-full">Запись</span>
              }
            </div>
          </div>
        </div>

        {/* Чат */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col bg-card border border-border rounded-2xl overflow-hidden" style={{ height: "600px" }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
            <Icon name="MessageSquare" size={16} className="text-primary" />
            <span className="font-semibold text-foreground text-sm">Чат</span>
            <span className="text-xs text-muted-foreground ml-1">({messages.length})</span>
            {stream.isLive && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-red-500 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse" />LIVE
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0
              ? <div className="text-center py-10">
                  <p className="text-muted-foreground text-sm">Сообщений пока нет</p>
                  <p className="text-muted-foreground text-xs mt-1">Будь первым!</p>
                </div>
              : messages.map(msg => {
                  const isEmoji = /^\p{Emoji}{1,2}$/u.test(msg.text.trim());
                  const isMe = msg.userId === user?.id;
                  return (
                    <div key={msg.id} className={`flex items-start gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center font-oswald flex-shrink-0">
                        {msg.userAvatar}
                      </div>
                      <div className={`max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        {!isMe && <span className="text-[10px] text-muted-foreground mb-0.5">{msg.userName}</span>}
                        <div className={isEmoji ? "text-2xl" : `rounded-2xl px-3 py-1.5 text-sm ${
                          isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-secondary text-foreground rounded-tl-sm"
                        }`}>
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{msg.sentAt}</span>
                      </div>
                    </div>
                  );
                })
            }
            <div ref={chatEndRef} />
          </div>

          <div className="px-3 py-3 border-t border-border flex-shrink-0">
            {user ? (
              <div className="flex gap-2">
                <input ref={inputRef} value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Написать в чат..."
                  maxLength={200}
                  className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
                <button onClick={() => sendMessage()} disabled={!input.trim() || sending}
                  className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0">
                  <Icon name={sending ? "Loader" : "Send"} size={15} className={sending ? "animate-spin" : ""} />
                </button>
              </div>
            ) : (
              <button onClick={() => setPage("auth")}
                className="w-full text-sm text-center text-primary border border-primary/30 rounded-xl py-2 hover:bg-primary/5 transition-colors">
                Войдите, чтобы писать в чат
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
