import { useState, useRef, useEffect, useCallback } from "react";
import AgoraRTC, { type IAgoraRTCClient, type IRemoteVideoTrack, type IRemoteAudioTrack } from "agora-rtc-sdk-ng";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type StoreStream, type ChatMessage, type StoreProduct } from "@/context/StoreContext";
import type { CartItem, Page } from "@/App";
import StreamProductsSection from "@/pages/stream-watch/StreamProductsSection";

const AGORA_TOKEN = "https://functions.poehali.dev/a2751c9f-9c4b-4808-bf97-73f350e873a1";
const STREAM_THUMBNAIL = "https://cdn.poehali.dev/projects/a4bacfcf-1dfc-4307-b19f-4266aaeae1d7/files/5cdc424e-1406-41e5-9e82-3dcbd622fe88.jpg";

AgoraRTC.setLogLevel(3);

const CODEC = (() => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("safari") && !ua.includes("chrome") ? "h264" : "vp8";
})();

interface Props {
  stream: StoreStream;
  setPage: (p: Page) => void;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onProductClick: (id: string) => void;
}

export default function StreamWatchPage({ stream, setPage, addToCart, onProductClick }: Props) {
  const { user } = useAuth();
  const { addChatMessage, getStreamMessages, getSellerProducts } = useStore();
  const sellerProducts = getSellerProducts(stream.sellerId);

  const clientRef   = useRef<IAgoraRTCClient | null>(null);
  const videoElRef  = useRef<HTMLDivElement>(null);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [liveStatus, setLiveStatus] = useState<"waiting" | "playing" | "error">("waiting");
  const [errorMsg, setErrorMsg]     = useState("");
  const [addedId, setAddedId]       = useState<string | null>(null);
  const [reviewProduct, setReviewProduct] = useState<StoreProduct | null>(null);
  const [chatVisible, setChatVisible] = useState(true);
  const [pipMode, setPipMode] = useState(false);
  const productsRef = useRef<HTMLDivElement>(null);

  // ── Agora подключение ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!stream.isLive) return;
    let client: IAgoraRTCClient | null = null;
    let videoTrack: IRemoteVideoTrack | null = null;
    let audioTrack: IRemoteAudioTrack | null = null;
    (async () => {
      try {
        client = AgoraRTC.createClient({ mode: "live", codec: CODEC });
        clientRef.current = client;
        await client.setClientRole("audience");
        const viewerUid = Math.floor(Math.random() * 100000) + 1000;
        const tokenResp = await fetch(`${AGORA_TOKEN}?channel=${stream.id}&uid=${viewerUid}&role=subscriber`);
        const tokenData = await tokenResp.json();
        await client.join(tokenData.appId, stream.id, tokenData.token, viewerUid);
        client.on("user-published", async (remoteUser, mediaType) => {
          await client!.subscribe(remoteUser, mediaType);
          if (mediaType === "video") {
            videoTrack = remoteUser.videoTrack!;
            if (videoElRef.current) videoTrack.play(videoElRef.current);
            setLiveStatus("playing");
          }
          if (mediaType === "audio") { audioTrack = remoteUser.audioTrack!; audioTrack.play(); }
        });
        client.on("user-unpublished", () => setLiveStatus("waiting"));
      } catch (e: unknown) {
        setErrorMsg((e as Error).message);
        setLiveStatus("error");
      }
    })();
    return () => {
      videoTrack?.stop(); audioTrack?.stop();
      client?.leave().catch(() => {}); clientRef.current = null;
    };
  }, [stream.isLive, stream.id]);

  // ── Чат ──────────────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    try { setMessages(await getStreamMessages(stream.id)); } catch { /* ignore */ }
  }, [stream.id, getStreamMessages]);

  useEffect(() => {
    fetchMessages();
    chatPollRef.current = setInterval(fetchMessages, 4000);
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = async () => {
    const t = input.trim();
    if (!t || !user || sending) return;
    setSending(true);
    try {
      const msg = await addChatMessage({ streamId: stream.id, userId: user.id, userName: user.name.split(" ")[0], userAvatar: user.avatar, text: t });
      setMessages(prev => [...prev, msg]);
      setInput("");
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  const handleProductsClick = () => {
    setPipMode(true);
    setChatVisible(false);
    setTimeout(() => productsRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div className="bg-black">

      {/* ── ВИДЕО — полный экран ИЛИ pip-миниатюра ────────────────────── */}
      {/* Контейнер всегда в DOM — Agora играет в videoElRef */}
      <div
        className={pipMode
          ? "fixed z-40 bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-300"
          : "relative w-full bg-black transition-all duration-300"}
        style={pipMode
          ? { top: 68, right: 12, width: 100, aspectRatio: "9/16" }
          : { height: "calc(100dvh - 56px)" }}
      >

        {/* Превью / заглушка */}
        {liveStatus !== "playing" && (
          <img src={stream.thumbnail || STREAM_THUMBNAIL}
            className="absolute inset-0 w-full h-full object-cover" />
        )}

        {/* Agora видео */}
        <div ref={videoElRef} className="absolute inset-0 w-full h-full"
          style={{ opacity: liveStatus === "playing" ? 1 : 0 }} />

        {/* Подключение */}
        {stream.isLive && liveStatus === "waiting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Icon name="Loader" size={32} className="text-white animate-spin" />
          </div>
        )}

        {/* Завершён */}
        {!stream.isLive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <Icon name="PlayCircle" size={40} className="text-white/50 mx-auto mb-2" />
              <p className="text-white/60 text-sm">Эфир завершён</p>
            </div>
          </div>
        )}

        {/* Ошибка */}
        {liveStatus === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
            <p className="text-red-400 text-sm text-center">{errorMsg}</p>
          </div>
        )}

        {/* ── ВЕРХНЯЯ ПАНЕЛЬ (только полный экран) ── */}
        {!pipMode && (
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-3 pt-3 pb-6"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}>
            <button onClick={() => setPage("streams")}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center flex-shrink-0">
              <Icon name="ArrowLeft" size={18} className="text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate leading-tight">{stream.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-white/70 text-xs">{stream.sellerName}</span>
                <span className="flex items-center gap-1 text-white/60 text-xs ml-2">
                  <Icon name="Eye" size={11} />{stream.viewers}
                </span>
              </div>
            </div>
            {stream.isLive && (
              <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />
                LIVE
              </div>
            )}
          </div>
        )}

        {/* ── PIP: кнопка развернуть + LIVE бейдж ── */}
        {pipMode && (
          <>
            <button
              onClick={() => { setPipMode(false); setChatVisible(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
            >
              <Icon name="Maximize2" size={11} className="text-white" />
            </button>
            {stream.isLive && (
              <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                <span className="w-1 h-1 rounded-full bg-white animate-live-pulse" />
                LIVE
              </div>
            )}
          </>
        )}

        {/* ── ЧАТ ПОВЕРХ ВИДЕО (только полный экран) ── */}
        {!pipMode && <div className="absolute bottom-0 left-0 right-0 z-20">

          {/* Кнопки: товары + скрыть чат */}
          <div className="flex items-center justify-center gap-2 px-3 pb-2">
            {sellerProducts.length > 0 && (
              <button
                onClick={handleProductsClick}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-full"
              >
                <Icon name="ShoppingBag" size={13} />
                Товары ({sellerProducts.length})
              </button>
            )}
            <button
              onClick={() => setChatVisible(v => !v)}
              className="flex items-center gap-1.5 bg-black/50 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full"
            >
              <Icon name={chatVisible ? "MessageCircleOff" : "MessageCircle"} size={13} />
              {chatVisible ? "Скрыть чат" : "Чат"}
            </button>
          </div>

          {/* Сообщения */}
          {chatVisible && (
            <div className="px-3 pb-2 space-y-1.5 overflow-y-auto" style={{ maxHeight: 220 }}>
              {messages.map(m => (
                <div key={m.id} className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-white/20 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {m.userAvatar}
                  </div>
                  <p className="text-xs text-white leading-snug">
                    <span className="font-bold text-white/90">{m.userName} </span>
                    <span className="text-white/80">{m.text}</span>
                  </p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Ввод сообщения */}
          <div className="px-3 pb-4 pt-1">
            {user ? (
              <div className="flex gap-2 items-center">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder="Написать в чат..."
                  maxLength={200}
                  className="flex-1 bg-black/50 backdrop-blur border border-white/20 rounded-full px-4 py-2.5 text-white placeholder:text-white/40 outline-none focus:border-white/40"
                  style={{ fontSize: 16 }}
                />
                <button onClick={sendMessage} disabled={!input.trim() || sending}
                  className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                  {sending
                    ? <Icon name="Loader" size={15} className="animate-spin" />
                    : <Icon name="Send" size={15} />}
                </button>
              </div>
            ) : (
              <button onClick={() => setPage("auth")}
                className="w-full text-center text-sm text-white/70 py-2.5 border border-white/20 rounded-full bg-black/40 backdrop-blur">
                Войдите чтобы написать
              </button>
            )}
          </div>
        </div>}{/* end !pipMode chat */}
      </div>{/* end pip/fullscreen wrapper */}

      {/* ── ТОВАРЫ — скроллятся под видео ─────────────────────────────── */}
      {sellerProducts.length > 0 && (
        <div ref={productsRef} className="px-4 py-5 bg-background pb-24" style={pipMode ? { paddingTop: 20 } : {}}>
          <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
            <Icon name="ShoppingBag" size={16} className="text-primary" />
            Товары продавца
            <span className="text-xs text-muted-foreground font-normal">({sellerProducts.length})</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {sellerProducts.map(p => (
              <div key={p.id}
                className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-primary/40 transition-all group"
                onClick={() => { setReviewProduct(p); onProductClick(p.id); }}
              >
                <div className="aspect-square bg-secondary overflow-hidden">
                  {p.images[0]
                    ? <img src={p.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center"><Icon name="Package" size={24} className="text-muted-foreground opacity-30" /></div>
                  }
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-primary font-bold text-sm mt-0.5">{p.price.toLocaleString("ru-RU")} ₽</p>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      addToCart({ id: p.id, name: p.name, price: p.price, image: p.images[0] ?? "" });
                      setAddedId(p.id);
                      setTimeout(() => setAddedId(null), 1500);
                    }}
                    className={`mt-2 w-full py-2 rounded-xl text-xs font-bold transition-colors ${addedId === p.id ? "bg-green-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                  >
                    {addedId === p.id ? "✓ Добавлено" : "В корзину"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модалка отзывов */}
      {reviewProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setReviewProduct(null)}>
          <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <StreamProductsSection
              products={sellerProducts}
              addToCart={addToCart}
              addedId={addedId}
              setAddedId={setAddedId}
              reviewProduct={reviewProduct}
              setReviewProduct={setReviewProduct}
            />
          </div>
        </div>
      )}
    </div>
  );
}