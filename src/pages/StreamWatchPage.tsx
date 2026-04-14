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

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">

      {/* ── ВЕРХНИЙ БЛОК: видео + чат рядом ─────────────────────────── */}
      {/* Мобиле: колонка, видео 16:9 + чат фикс. высоты. md+: строка на весь экран */}
      <div className="flex flex-col md:flex-row flex-shrink-0 md:overflow-hidden md:h-[calc(100vh-56px)]">

        {/* ВИДЕО */}
        <div className="relative bg-black w-full md:w-[58%] flex-shrink-0"
          style={{ aspectRatio: "16/9" }}>
          {/* Превью */}
          {liveStatus !== "playing" && (
            <img src={stream.thumbnail || STREAM_THUMBNAIL}
              className="absolute inset-0 w-full h-full object-cover" />
          )}
          {/* Agora */}
          <div ref={videoElRef} className="absolute inset-0 w-full h-full"
            style={{ opacity: liveStatus === "playing" ? 1 : 0 }} />
          {/* Подключение */}
          {stream.isLive && liveStatus === "waiting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Icon name="Loader" size={28} className="text-white animate-spin" />
            </div>
          )}
          {/* Завершён */}
          {!stream.isLive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center">
                <Icon name="PlayCircle" size={36} className="text-white/60 mx-auto mb-1" />
                <p className="text-white/60 text-sm">Эфир завершён</p>
              </div>
            </div>
          )}
          {/* Назад */}
          <button onClick={() => setPage("streams")}
            className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-10">
            <Icon name="ArrowLeft" size={16} className="text-white" />
          </button>
          {/* LIVE */}
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
          {/* Инфо под видео (только мобиле — внутри видео-блока) */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 md:hidden">
            <p className="text-white text-sm font-semibold truncate">{stream.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-white/70 text-xs">{stream.sellerName}</span>
              <span className="ml-auto flex items-center gap-1 text-white/70 text-xs">
                <Icon name="Eye" size={11} />{stream.viewers}
              </span>
            </div>
          </div>
        </div>

        {/* ЧАТ — занимает оставшееся место */}
        <div className="flex flex-col flex-1 min-h-0 h-64 md:h-auto border-t md:border-t-0 md:border-l border-border bg-background">
          {/* Заголовок + инфо (только desktop) */}
          <div className="hidden md:block px-4 py-2.5 border-b border-border">
            <p className="font-semibold text-sm truncate">{stream.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">{stream.sellerName}</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <Icon name="Eye" size={11} />{stream.viewers}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <Icon name="MessageCircle" size={14} className="text-muted-foreground" />
            <span className="font-semibold text-sm">Чат</span>
            <span className="text-xs text-muted-foreground">{messages.length}</span>
          </div>

          {/* Сообщения — скролл только внутри этого блока */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-6">Сообщений пока нет</p>
            ) : (
              messages.map(m => (
                <div key={m.id} className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
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

          {/* Ввод */}
          <div className="px-3 py-2.5 border-t border-border flex gap-2 items-center flex-shrink-0">
            {user ? (
              <>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder="Написать..."
                  maxLength={200}
                  className="flex-1 bg-secondary border border-border rounded-full px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                />
                <button onClick={sendMessage} disabled={!input.trim() || sending}
                  className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                  {sending
                    ? <Icon name="Loader" size={14} className="animate-spin" />
                    : <Icon name="Send" size={14} />}
                </button>
              </>
            ) : (
              <button onClick={() => setPage("auth")}
                className="flex-1 text-center text-sm text-muted-foreground py-2 border border-border rounded-full hover:bg-secondary transition-colors">
                Войдите чтобы написать
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── ТОВАРЫ — скроллятся под блоком видео+чат ─────────────────── */}
      <div className="flex-1 overflow-y-auto border-t border-border bg-background">
        {sellerProducts.length > 0 ? (
          <div className="px-4 py-4">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Icon name="ShoppingBag" size={15} className="text-primary" />
              Товары продавца
              <span className="text-xs text-muted-foreground font-normal">({sellerProducts.length})</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {sellerProducts.map(p => (
                <div key={p.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-primary/40 transition-all group"
                  onClick={() => { setReviewProduct(p); onProductClick(p.id); }}
                >
                  <div className="aspect-square bg-secondary overflow-hidden">
                    {p.images[0]
                      ? <img src={p.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      : <div className="w-full h-full flex items-center justify-center"><Icon name="Package" size={20} className="text-muted-foreground opacity-30" /></div>
                    }
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-primary font-bold text-xs mt-0.5">{p.price.toLocaleString("ru-RU")} ₽</p>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        addToCart({ id: p.id, name: p.name, price: p.price, image: p.images[0] ?? "" });
                        setAddedId(p.id);
                        setTimeout(() => setAddedId(null), 1500);
                      }}
                      className={`mt-2 w-full py-1.5 rounded-xl text-xs font-bold transition-colors ${addedId === p.id ? "bg-green-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                    >
                      {addedId === p.id ? "✓ Добавлено" : "В корзину"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            Товары не добавлены
          </div>
        )}
      </div>

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