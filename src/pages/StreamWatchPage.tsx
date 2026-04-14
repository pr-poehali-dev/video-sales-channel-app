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

  // Высота навбара (~56px) + видео (100vw * 9/16)
  const VIDEO_TOP = 56; // px, высота NavBar
  const videoHeightVw = "56.25vw"; // 16:9

  return (
    <div className="bg-background overflow-x-hidden">
      {/* ── ВИДЕО (fixed) ───────────────────────────────────────────── */}
      <div
        className="fixed left-0 right-0 z-30 bg-black overflow-hidden"
        style={{ top: VIDEO_TOP, height: videoHeightVw }}
      >
        {/* Превью / заглушка */}
        {liveStatus !== "playing" && (
          <img
            src={stream.thumbnail || STREAM_THUMBNAIL}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Agora контейнер */}
        <div ref={videoElRef} className="absolute inset-0 w-full h-full"
          style={{ opacity: liveStatus === "playing" ? 1 : 0 }} />

        {/* Оверлей ожидания */}
        {stream.isLive && liveStatus === "waiting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center">
              <Icon name="Loader" size={28} className="text-white animate-spin mx-auto mb-2" />
              <p className="text-white/70 text-xs">Подключение...</p>
            </div>
          </div>
        )}

        {/* Не в эфире */}
        {!stream.isLive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <Icon name="PlayCircle" size={36} className="text-white/60 mx-auto mb-2" />
              <p className="text-white/60 text-sm">Эфир завершён</p>
            </div>
          </div>
        )}

        {/* Назад */}
        <button onClick={() => setPage("streams")}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-10">
          <Icon name="ArrowLeft" size={16} className="text-white" />
        </button>

        {/* LIVE бейдж */}
        {stream.isLive && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full z-10">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />
            LIVE
          </div>
        )}

        {/* Ошибка */}
        {liveStatus === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 z-10">
            <p className="text-red-400 text-xs text-center">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* ── КОНТЕНТ (отступ = NavBar + высота видео) ─────────────────── */}
      <div style={{ paddingTop: `calc(${VIDEO_TOP}px + ${videoHeightVw})` }}>

      {/* ── ИНФО О СТРИМЕ ───────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border bg-background">
        <h1 className="font-semibold text-base text-foreground">{stream.title}</h1>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0">
            {stream.sellerAvatar}
          </div>
          <span className="text-sm text-muted-foreground">{stream.sellerName}</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Icon name="Eye" size={12} />{stream.viewers}
          </span>
        </div>
      </div>

      {/* ── ЧАТ ─────────────────────────────────────────────────────── */}
      <div className="bg-background border-b border-border">
        {/* Заголовок чата */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Icon name="MessageCircle" size={16} className="text-foreground" />
          <span className="font-semibold text-sm text-foreground">Чат</span>
          <span className="text-xs text-muted-foreground">{messages.length}</span>
        </div>

        {/* Список сообщений */}
        <div className="px-4 py-3 space-y-3" style={{ maxHeight: 320, overflowY: "auto" }}>
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground text-xs py-4">Сообщений пока нет</p>
          ) : (
            messages.map(m => (
              <div key={m.id} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {m.userAvatar}
                </div>
                <div>
                  <span className="text-xs font-semibold text-foreground">{m.userName}</span>
                  <span className="text-xs text-muted-foreground"> · {m.sentAt}</span>
                  <p className="text-sm text-foreground mt-0.5 leading-snug">{m.text}</p>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Поле ввода */}
        <div className="px-4 py-3 border-t border-border flex gap-2 items-center">
          {user ? (
            <>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Введите сообщение..."
                maxLength={200}
                className="flex-1 bg-secondary border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
              <button onClick={sendMessage} disabled={!input.trim() || sending}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                {sending
                  ? <Icon name="Loader" size={16} className="animate-spin" />
                  : <Icon name="Send" size={16} />
                }
              </button>
            </>
          ) : (
            <button onClick={() => setPage("auth")}
              className="flex-1 text-center text-sm text-muted-foreground py-2.5 border border-border rounded-full hover:bg-secondary transition-colors">
              Войдите чтобы написать
            </button>
          )}
        </div>
      </div>

      {/* ── ТОВАРЫ ──────────────────────────────────────────────────── */}
      {sellerProducts.length > 0 && (
        <div className="bg-background px-4 py-5">
          <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
            <Icon name="ShoppingBag" size={16} className="text-primary" />
            Товары продавца
            <span className="text-xs text-muted-foreground font-normal">({sellerProducts.length})</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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

      {/* Отзывы (модалка) */}
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

      </div>{/* end content wrapper */}
    </div>
  );
}