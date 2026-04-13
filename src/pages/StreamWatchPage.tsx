import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type StoreStream, type ChatMessage } from "@/context/StoreContext";
import type { CartItem, Page } from "@/App";

const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const EMOJI_REACTIONS = ["🔥", "❤️", "👏", "😮", "😂"];
// Интервал опроса — чуть быстрее чем вещатель шлёт
const POLL_MS = 120;
const AUDIO_SAMPLE_RATE = 16000;

interface Props {
  stream: StoreStream;
  setPage: (p: Page) => void;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onProductClick: (id: string) => void;
}

function fmtDuration(sec?: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type RightTab = "chat" | "products";

export default function StreamWatchPage({ stream, setPage, addToCart, onProductClick }: Props) {
  const { user } = useAuth();
  const { addChatMessage, getStreamMessages, getSellerProducts } = useStore();
  const sellerProducts = getSellerProducts(stream.sellerId);

  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seqRef      = useRef(-1);
  const fetchingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioTimeRef = useRef(0); // когда начать следующий чанк

  const [frameSrc, setFrameSrc]       = useState<string | null>(null);
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [input, setInput]             = useState("");
  const [reaction, setReaction]       = useState<string | null>(null);
  const [sending, setSending]         = useState(false);
  const [panelOpen, setPanelOpen]     = useState(true);
  const [rightTab, setRightTab]       = useState<RightTab>("chat");
  const [addedId, setAddedId]         = useState<string | null>(null);
  const [liveStatus, setLiveStatus]   = useState<"waiting" | "playing">("waiting");

  // Воспроизводим base64-PCM через AudioContext (Int16, 16000 Гц, моно)
  const playAudio = useCallback((b64: string) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
        audioTimeRef.current = audioCtxRef.current.currentTime;
      }
      const ctx = audioCtxRef.current;
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const i16 = new Int16Array(bytes.buffer);
      const f32 = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;

      const buf = ctx.createBuffer(1, f32.length, AUDIO_SAMPLE_RATE);
      buf.copyToChannel(f32, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);

      // Планируем воспроизведение вплотную к предыдущему чанку
      const startAt = Math.max(ctx.currentTime, audioTimeRef.current);
      src.start(startAt);
      audioTimeRef.current = startAt + buf.duration;
    } catch { /* ignore */ }
  }, []);

  // ── Опрос кадра + аудио ───────────────────────────────────────────────────
  const fetchFrame = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const qs = new URLSearchParams({
        action: "get_frame",
        stream_id: stream.id,
        seq: String(seqRef.current),
      });
      const resp = await fetch(`${API}?${qs}`);
      const data: { frame: string | null; audio: string | null; seq: number } = await resp.json();
      if (data.frame) {
        seqRef.current = data.seq;
        setFrameSrc(`data:image/jpeg;base64,${data.frame}`);
        setLiveStatus("playing");
      }
      if (data.audio) playAudio(data.audio);
    } catch { /* ignore */ }
    finally { fetchingRef.current = false; }
  }, [stream.id, playAudio]);

  useEffect(() => {
    if (!stream.isLive) return;
    fetchFrame();
    pollRef.current = setInterval(fetchFrame, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, [stream.isLive, fetchFrame]);

  // ── Чат ──────────────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try { setMessages(await getStreamMessages(stream.id)); } catch { /* ignore */ }
  }, [stream.id, getStreamMessages]);

  useEffect(() => {
    fetchMessages();
    chatPollRef.current = setInterval(fetchMessages, 4000);
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [fetchMessages]);

  const sendMessage = async (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || !user || sending) return;
    setSending(true);
    try {
      const msg = await addChatMessage({ streamId: stream.id, userId: user.id, userName: user.name.split(" ")[0], userAvatar: user.avatar, text: t });
      setMessages(prev => [...prev, msg]);
      if (!text) setInput("");
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  const sendReaction = (emoji: string) => {
    if (!user) return;
    sendMessage(emoji);
    setReaction(emoji);
    setTimeout(() => setReaction(null), 1000);
  };

  const handleAddToCart = (e: React.MouseEvent, p: typeof sellerProducts[0]) => {
    e.stopPropagation();
    addToCart({ id: p.id, name: p.name, price: p.price, image: p.images[0] ?? "" });
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1500);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-56px)] bg-black">

      {/* ── ВИДЕО ─────────────────────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-center bg-black min-h-[50vh] lg:min-h-0">

        <button onClick={() => setPage("streams")}
          className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
          <Icon name="ArrowLeft" size={18} className="text-white" />
        </button>

        {/* LIVE: кадры JPEG — работает в любом браузере */}
        {stream.isLive && (
          <>
            {frameSrc && (
              <img
                src={frameSrc}
                alt="live"
                className="w-full h-full object-contain max-h-[calc(100vh-56px)]"
                style={{ background: "black", display: "block" }}
              />
            )}
            {liveStatus === "waiting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/20 text-primary text-3xl font-bold flex items-center justify-center">
                  {stream.sellerAvatar}
                </div>
                <p className="text-white font-semibold text-lg">{stream.sellerName}</p>
                <p className="text-white/50 text-sm">{stream.title}</p>
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Icon name="Loader" size={16} className="animate-spin" />
                  Подключение к эфиру...
                </div>
                <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
                </span>
              </div>
            )}
          </>
        )}

        {/* Запись */}
        {!stream.isLive && stream.videoUrl && (
          <video src={stream.videoUrl} controls autoPlay playsInline
            className="w-full h-full object-contain max-h-[calc(100vh-56px)]"
            style={{ background: "black" }}
          />
        )}
        {!stream.isLive && !stream.videoUrl && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-white/10 text-white text-3xl font-bold flex items-center justify-center">
              {stream.sellerAvatar}
            </div>
            <p className="text-white font-semibold">{stream.sellerName}</p>
            <p className="text-white/40 text-sm">Запись недоступна</p>
          </div>
        )}

        {/* LIVE бейдж */}
        {stream.isLive && liveStatus === "playing" && (
          <div className="absolute top-4 left-14 z-10">
            <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
            </span>
          </div>
        )}

        {!stream.isLive && stream.duration && (
          <div className="absolute bottom-16 right-4 bg-black/70 text-white text-xs font-mono px-2 py-1 rounded z-10">
            {fmtDuration(stream.duration)}
          </div>
        )}

        {reaction && (
          <div className="absolute bottom-20 right-8 text-5xl animate-bounce pointer-events-none z-20">{reaction}</div>
        )}

        {stream.isLive && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {EMOJI_REACTIONS.map(e => (
              <button key={e} onClick={() => sendReaction(e)} disabled={!user}
                className="text-xl bg-black/50 backdrop-blur rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/70 disabled:opacity-40">
                {e}
              </button>
            ))}
          </div>
        )}

        <button onClick={() => setPanelOpen(o => !o)}
          className="absolute top-4 right-4 z-20 lg:hidden w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
          <Icon name="MessageSquare" size={17} className="text-white" />
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {messages.length > 99 ? "99" : messages.length}
            </span>
          )}
        </button>
      </div>

      {/* ── ПРАВАЯ ПАНЕЛЬ ─────────────────────────────────── */}
      <div className={`flex flex-col bg-zinc-950 border-l border-white/10 lg:w-80 xl:w-96 lg:flex-shrink-0 ${panelOpen ? "h-[65vh] lg:h-auto" : "h-0 overflow-hidden lg:flex lg:h-auto"}`}>

        <div className="flex border-b border-white/10 flex-shrink-0">
          {(["chat", "products"] as RightTab[]).map(tab => (
            <button key={tab} onClick={() => setRightTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors border-b-2 ${rightTab === tab ? "text-white border-primary" : "text-white/40 border-transparent hover:text-white/70"}`}>
              <Icon name={tab === "chat" ? "MessageSquare" : "ShoppingBag"} size={14} />
              {tab === "chat" ? "Чат" : "Товары"}
              {tab === "chat" && messages.length > 0 && <span className="bg-white/10 text-white/60 text-[10px] px-1.5 py-0.5 rounded-full">{messages.length}</span>}
              {tab === "chat" && stream.isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse ml-1" />}
              {tab === "products" && sellerProducts.length > 0 && <span className="bg-white/10 text-white/60 text-[10px] px-1.5 py-0.5 rounded-full">{sellerProducts.length}</span>}
            </button>
          ))}
        </div>

        {rightTab === "chat" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {messages.length === 0
                ? <p className="text-center text-white/30 text-xs pt-8">Чат пуст</p>
                : messages.map(m => (
                  <div key={m.id} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/30 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{m.userAvatar}</div>
                    <p className="text-[12px] text-white/80 leading-snug"><span className="text-primary/90 font-semibold">{m.userName} </span>{m.text}</p>
                  </div>
                ))
              }
              <div ref={el => el?.scrollIntoView()} />
            </div>
            {user ? (
              <div className="px-3 py-3 border-t border-white/10 flex gap-2 flex-shrink-0">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Написать..." maxLength={200}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/40 outline-none focus:border-primary/50"
                />
                <button onClick={() => sendMessage()} disabled={!input.trim() || sending}
                  className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40">
                  <Icon name="Send" size={13} className="text-white" />
                </button>
              </div>
            ) : (
              <p className="text-center text-white/30 text-xs py-3 border-t border-white/10 flex-shrink-0">Войдите чтобы писать в чат</p>
            )}
          </div>
        )}

        {rightTab === "products" && (
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {sellerProducts.length === 0
              ? <p className="text-center text-white/30 text-xs pt-8">Нет товаров</p>
              : sellerProducts.map(p => (
                <div key={p.id} onClick={() => onProductClick(p.id)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                  {p.images[0]
                    ? <img src={p.images[0]} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-lg bg-white/10 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{p.name}</p>
                    <p className="text-primary text-xs font-bold mt-0.5">{p.price.toLocaleString("ru-RU")} ₽</p>
                  </div>
                  <button onClick={e => handleAddToCart(e, p)}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors flex-shrink-0 ${addedId === p.id ? "bg-green-600 text-white" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                    {addedId === p.id ? "✓" : "В корзину"}
                  </button>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}