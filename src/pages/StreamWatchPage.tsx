import { useState, useRef, useEffect, useCallback } from "react";
import AgoraRTC, { type IAgoraRTCClient, type IRemoteVideoTrack, type IRemoteAudioTrack } from "agora-rtc-sdk-ng";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type StoreStream, type ChatMessage, type Review, type StoreProduct } from "@/context/StoreContext";
import type { CartItem, Page } from "@/App";

const AGORA_TOKEN  = "https://functions.poehali.dev/a2751c9f-9c4b-4808-bf97-73f350e873a1";
const EMOJI_REACTIONS = ["🔥", "❤️", "👏", "😮", "😂"];
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

function fmtDuration(sec?: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

export default function StreamWatchPage({ stream, setPage, addToCart, onProductClick }: Props) {
  const { user } = useAuth();
  const { addChatMessage, getStreamMessages, getSellerProducts } = useStore();
  const sellerProducts = getSellerProducts(stream.sellerId);

  const clientRef   = useRef<IAgoraRTCClient | null>(null);
  const videoElRef  = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [input, setInput]           = useState("");
  const [reaction, setReaction]     = useState<string | null>(null);
  const [sending, setSending]       = useState(false);
  const [chatOpen, setChatOpen]     = useState(false);
  const [rightTab, setRightTab]     = useState<"chat" | "products">("chat");
  const [addedId, setAddedId]       = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"waiting" | "playing" | "error">("waiting");
  const [errorMsg, setErrorMsg]     = useState("");
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

        // Уникальный uid для зрителя (случайный)
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
          if (mediaType === "audio") {
            audioTrack = remoteUser.audioTrack!;
            audioTrack.play();
          }
        });

        client.on("user-unpublished", () => setLiveStatus("waiting"));

      } catch (e: unknown) {
        const err = e as Error;
        setErrorMsg(err.message);
        setLiveStatus("error");
      }
    })();

    return () => {
      videoTrack?.stop();
      audioTrack?.stop();
      client?.leave().catch(() => {});
      clientRef.current = null;
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
    <>
    <div className="flex flex-col min-h-[calc(100vh-56px)] bg-black lg:flex-row">

      {/* ── ВИДЕО ─────────────────────────────────────────────────────── */}
      <div className="relative w-full bg-black lg:flex-1" style={{ aspectRatio: "16/9", maxHeight: "56vw" }}>

        {/* Заставка */}
        <img src={STREAM_THUMBNAIL} alt="thumbnail"
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
          <button onClick={() => setChatOpen(o => !o)}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center relative lg:hidden">
            <Icon name="MessageSquare" size={16} className="text-white" />
            {messages.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {messages.length > 9 ? "9+" : messages.length}
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
              <button key={e} onClick={() => sendReaction(e)} disabled={!user}
                className="text-lg bg-black/50 backdrop-blur rounded-full w-9 h-9 flex items-center justify-center hover:bg-black/70 active:scale-110 disabled:opacity-40 transition-transform">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── ИНФО (мобильный) ──────────────────────────────────────────── */}
      <div className="lg:hidden bg-zinc-950 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold text-sm truncate">{stream.title}</h2>
          <p className="text-white/50 text-xs mt-0.5">{stream.sellerName}</p>
        </div>
        {stream.isLive && liveStatus === "playing" && (
          <span className="text-white/40 text-xs flex items-center gap-1 flex-shrink-0">
            <Icon name="Eye" size={12} />смотрит
          </span>
        )}
      </div>

      {/* ── ЧАТ-ШТОРКА (мобильный) ────────────────────────────────────── */}
      {chatOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setChatOpen(false)}>
          <div className="bg-zinc-900 rounded-t-2xl" style={{ maxHeight: "70vh" }} onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1" />
            <div className="flex border-b border-white/10">
              {(["chat", "products"] as const).map(tab => (
                <button key={tab} onClick={() => setRightTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${rightTab === tab ? "text-white border-primary" : "text-white/40 border-transparent"}`}>
                  <Icon name={tab === "chat" ? "MessageSquare" : "ShoppingBag"} size={13} />
                  {tab === "chat" ? `Чат (${messages.length})` : `Товары (${sellerProducts.length})`}
                </button>
              ))}
            </div>
            <div style={{ height: "50vh" }} className="flex flex-col">
              {rightTab === "chat"
                ? <ChatPanel messages={messages} user={user} input={input} setInput={setInput} sendMessage={sendMessage} sending={sending} />
                : <ProductsPanel products={sellerProducts} addedId={addedId} handleAddToCart={handleAddToCart} onProductClick={onProductClick} />
              }
            </div>
          </div>
        </div>
      )}

      {/* ── ДЕСКТОП ПАНЕЛЬ ────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:flex-col lg:w-80 xl:w-96 bg-zinc-950 border-l border-white/10 flex-shrink-0">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-white font-semibold text-sm">{stream.title}</h2>
          <p className="text-white/50 text-xs mt-0.5">{stream.sellerName}</p>
        </div>
        <div className="flex border-b border-white/10 flex-shrink-0">
          {(["chat", "products"] as const).map(tab => (
            <button key={tab} onClick={() => setRightTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${rightTab === tab ? "text-white border-primary" : "text-white/40 border-transparent hover:text-white/70"}`}>
              <Icon name={tab === "chat" ? "MessageSquare" : "ShoppingBag"} size={13} />
              {tab === "chat" ? "Чат" : "Товары"}
              {tab === "chat" && messages.length > 0 && <span className="bg-white/10 text-white/50 text-[10px] px-1.5 rounded-full">{messages.length}</span>}
              {tab === "chat" && stream.isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse ml-1" />}
              {tab === "products" && <span className="bg-white/10 text-white/50 text-[10px] px-1.5 rounded-full">{sellerProducts.length}</span>}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          {rightTab === "chat"
            ? <ChatPanel messages={messages} user={user} input={input} setInput={setInput} sendMessage={sendMessage} sending={sending} />
            : <ProductsPanel products={sellerProducts} addedId={addedId} handleAddToCart={handleAddToCart} onProductClick={onProductClick} />
          }
        </div>
      </div>
    </div>

    {/* ── ТОВАРЫ ПОД ВИДЕО ──────────────────────────────────────────────── */}
    {sellerProducts.length > 0 && (
      <div className="bg-background px-4 py-6">
        <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
          <Icon name="ShoppingBag" size={16} className="text-primary" />
          Товары продавца
          <span className="text-xs text-muted-foreground font-normal">({sellerProducts.length})</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sellerProducts.map(p => (
            <div key={p.id}
              className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => setReviewProduct(p)}
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
                  onClick={e => { e.stopPropagation(); addToCart({ id: p.id, name: p.name, price: p.price, image: p.images[0] ?? "" }); setAddedId(p.id); setTimeout(() => setAddedId(null), 1500); }}
                  className={`mt-2 w-full py-1.5 rounded-xl text-xs font-bold transition-colors ${addedId === p.id ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"}`}>
                  {addedId === p.id ? "✓ Добавлено" : "В корзину"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* ── ПОПАП ОТЗЫВОВ НА ТОВАР ────────────────────────────────────────── */}
    {reviewProduct && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0"
        onClick={() => setReviewProduct(null)}>
        <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
          <ProductReviewsBlock product={reviewProduct} addToCart={addToCart} onClose={() => setReviewProduct(null)} />
        </div>
      </div>
    )}
    </>
  );
}

// ── Переиспользуемые компоненты ───────────────────────────────────────────────
interface ChatPanelProps {
  messages: ChatMessage[];
  user: { id: string; name: string; avatar: string } | null;
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text?: string) => void;
  sending: boolean;
}
function ChatPanel({ messages, user, input, setInput, sendMessage, sending }: ChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0
          ? <p className="text-center text-white/30 text-xs pt-8">Чат пуст</p>
          : messages.map(m => (
            <div key={m.id} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/30 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{m.userAvatar}</div>
              <p className="text-[12px] text-white/80 leading-snug"><span className="text-primary/90 font-semibold">{m.userName} </span>{m.text}</p>
            </div>
          ))}
        <div ref={endRef} />
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
        <p className="text-center text-white/30 text-xs py-3 border-t border-white/10">Войдите чтобы писать</p>
      )}
    </div>
  );
}

interface ProductsPanelProps {
  products: ReturnType<ReturnType<typeof useStore>["getSellerProducts"]>;
  addedId: string | null;
  handleAddToCart: (e: React.MouseEvent, p: ProductsPanelProps["products"][0]) => void;
  onProductClick: (id: string) => void;
}
function ProductsPanel({ products, addedId, handleAddToCart, onProductClick }: ProductsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      {products.length === 0
        ? <p className="text-center text-white/30 text-xs pt-8">Нет товаров</p>
        : products.map(p => (
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
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex-shrink-0 transition-colors ${addedId === p.id ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"}`}>
              {addedId === p.id ? "✓" : "В корзину"}
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ── Звёзды ────────────────────────────────────────────────────────────────────
function Stars({ value, max = 5, size = 14, interactive = false, onChange }: {
  value: number; max?: number; size?: number; interactive?: boolean; onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = interactive ? (hovered || value) > i : value > i;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`${filled ? "text-yellow-400" : "text-muted-foreground/40"} ${interactive ? "cursor-pointer" : ""}`}
            onMouseEnter={() => interactive && setHovered(i + 1)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => interactive && onChange?.(i + 1)}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      })}
    </div>
  );
}

// ── Отзывы на товар ───────────────────────────────────────────────────────────
function ProductReviewsBlock({ product, addToCart, onClose }: {
  product: StoreProduct;
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { getProductReviews, addReview } = useStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    getProductReviews(product.id).then(d => {
      setReviews(d.reviews); setAvg(d.avg); setCount(d.count);
      if (user) setAlreadyReviewed(d.reviews.some(r => r.userId === user.id));
    });
  }, [product.id]);

  const submit = async () => {
    if (!user || rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      const r = await addReview({ productId: product.id, userId: user.id, userName: user.name, userAvatar: user.avatar, rating, text });
      setReviews(prev => [r, ...prev]);
      setAvg(prev => parseFloat(((prev * count + rating) / (count + 1)).toFixed(1)));
      setCount(c => c + 1);
      setAlreadyReviewed(true);
      setRating(0); setText("");
    } catch { /* уже написал */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="bg-background border border-border rounded-2xl overflow-hidden">
      {/* Шапка товара */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        {product.images[0]
          ? <img src={product.images[0]} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
          : <div className="w-14 h-14 rounded-xl bg-secondary flex-shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{product.name}</p>
          <p className="text-primary font-bold text-sm">{product.price.toLocaleString("ru-RU")} ₽</p>
          {count > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Stars value={avg} size={12} />
              <span className="text-xs text-muted-foreground">{avg} ({count})</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button onClick={() => addToCart({ id: product.id, name: product.name, price: product.price, image: product.images[0] ?? "" })}
            className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg">
            В корзину
          </button>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground text-center">Закрыть</button>
        </div>
      </div>

      {/* Форма отзыва */}
      {user && !alreadyReviewed && (
        <div className="p-4 border-b border-border bg-secondary/30">
          <p className="text-sm font-semibold mb-2">Оставить отзыв</p>
          <div className="flex items-center gap-2 mb-2">
            <Stars value={rating} interactive onChange={setRating} />
            {rating > 0 && <span className="text-xs text-muted-foreground">{["", "Плохо", "Не очень", "Нормально", "Хорошо", "Отлично"][rating]}</span>}
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={500}
            placeholder="Расскажите о товаре..." rows={2}
            className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 outline-none focus:border-primary/50 resize-none"
          />
          <button onClick={submit} disabled={rating === 0 || submitting}
            className="mt-2 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40">
            {submitting ? "Отправляем..." : "Отправить"}
          </button>
        </div>
      )}

      {/* Список отзывов */}
      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {reviews.length === 0
          ? <p className="text-center text-muted-foreground text-xs py-8">Отзывов пока нет</p>
          : reviews.map(r => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">{r.userAvatar}</div>
                <span className="text-xs font-semibold">{r.userName}</span>
                <Stars value={r.rating} size={11} />
                <span className="text-[10px] text-muted-foreground ml-auto">{r.createdAt}</span>
              </div>
              {r.text && <p className="text-xs text-muted-foreground leading-relaxed">{r.text}</p>}
            </div>
          ))
        }
      </div>
    </div>
  );
}