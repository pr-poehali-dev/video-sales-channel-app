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
  const { addChatMessage, getStreamMessages, getSellerProducts, banChatUser, unbanChatUser } = useStore();
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
  // "full" — видео на весь экран, "split" — видео сверху 50%, товары снизу
  const [viewMode, setViewMode] = useState<"full" | "split">("full");
  const productsRef = useRef<HTMLDivElement>(null);
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());
  const [reportedId, setReportedId] = useState<string | null>(null);
  const [banningId, setBanningId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const isOwner = user?.id === stream.sellerId;

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
    setSendError(null);
    try {
      const msg = await addChatMessage({ streamId: stream.id, userId: user.id, userName: user.name.split(" ")[0], userAvatar: user.avatar, text: t });
      setMessages(prev => [...prev, msg]);
      setInput("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setSendError(msg);
      setTimeout(() => setSendError(null), 3000);
    }
    finally { setSending(false); }
  };

  const handleBan = async (userId: string) => {
    if (!user) return;
    setBanningId(userId);
    try {
      await banChatUser(stream.id, userId, user.id);
      setBannedIds(prev => new Set([...prev, userId]));
      setMessages(prev => prev.filter(m => m.userId !== userId));
      setReportedId(null);
    } catch { /* ignore */ }
    finally { setBanningId(null); }
  };

  const handleUnban = async (userId: string) => {
    if (!user) return;
    try {
      await unbanChatUser(stream.id, userId);
      setBannedIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
    } catch { /* ignore */ }
  };

  const isSplit = viewMode === "split";

  return (
    <div className="fixed inset-0 flex flex-col bg-black" style={{ zIndex: 40 }}>

      {/* ── ВИДЕО — полный экран или верхняя половина ─────────────────── */}
      <div
        className="relative w-full bg-black flex-shrink-0 transition-all duration-300"
        style={{ height: isSplit ? "50dvh" : "100dvh" }}
      >
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

        {/* ── ВЕРХНЯЯ ПАНЕЛЬ ── */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-3 pt-3 pb-6"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)" }}>
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

        {/* ── НИЖНЯЯ ПАНЕЛЬ НАД ВИДЕО: кнопки + чат ── */}
        <div className="absolute bottom-0 left-0 right-0 z-20"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 60%, transparent)" }}>

          {/* Сообщения (только в полном режиме) */}
          {!isSplit && chatVisible && (
            <div className="px-3 pt-3 pb-1 space-y-1.5 overflow-y-auto" style={{ maxHeight: 160 }}>
              {messages.map(m => (
                <div key={m.id} className="flex items-start gap-2 group/msg relative">
                  <div className="w-5 h-5 rounded-full bg-white/20 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {m.userAvatar}
                  </div>
                  <p className="text-xs text-white leading-snug flex-1 min-w-0">
                    <span className="font-bold text-white/90">{m.userName} </span>
                    <span className="text-white/80">{m.text}</span>
                  </p>
                  {/* Кнопка жалобы — видна при hover или если это владелец */}
                  {user && m.userId !== user.id && (
                    <button
                      onClick={() => setReportedId(reportedId === m.userId ? null : m.userId)}
                      className="opacity-0 group-hover/msg:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center"
                    >
                      <Icon name="MoreVertical" size={12} className="text-white/50" />
                    </button>
                  )}
                  {/* Панель действий */}
                  {reportedId === m.userId && user && m.userId !== user.id && (
                    <div className="absolute right-3 bg-black/90 border border-white/10 rounded-xl p-2 z-30 flex flex-col gap-1 min-w-[140px]">
                      {isOwner ? (
                        bannedIds.has(m.userId) ? (
                          <button
                            onClick={() => handleUnban(m.userId)}
                            className="text-xs text-green-400 py-1 px-2 text-left hover:bg-white/10 rounded-lg"
                          >
                            Разблокировать
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBan(m.userId)}
                            disabled={banningId === m.userId}
                            className="text-xs text-red-400 py-1 px-2 text-left hover:bg-white/10 rounded-lg disabled:opacity-50"
                          >
                            {banningId === m.userId ? "Блокирую..." : `Заблокировать ${m.userName}`}
                          </button>
                        )
                      ) : (
                        <p className="text-xs text-white/50 px-2 py-1">Пожаловаться нельзя — только владелец может блокировать</p>
                      )}
                      <button
                        onClick={() => setReportedId(null)}
                        className="text-xs text-white/40 py-1 px-2 text-left hover:bg-white/10 rounded-lg"
                      >
                        Отмена
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Ввод (только в полном режиме) */}
          {!isSplit && (
            <div className="px-3 pt-1 pb-1">
              {sendError && (
                <p className="text-xs text-red-400 text-center mb-1 bg-black/60 rounded-full py-1">{sendError}</p>
              )}
              {user ? (
                <div className="flex gap-2 items-center">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                    placeholder="Написать в чат..."
                    maxLength={200}
                    className="flex-1 bg-black/50 backdrop-blur border border-white/20 rounded-full px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/40"
                    style={{ fontSize: 16 }}
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || sending}
                    className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                    {sending ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="Send" size={14} />}
                  </button>
                </div>
              ) : (
                <button onClick={() => setPage("auth")}
                  className="w-full text-center text-sm text-white/70 py-2 border border-white/20 rounded-full bg-black/40 backdrop-blur">
                  Войдите чтобы написать
                </button>
              )}
            </div>
          )}

          {/* Кнопки управления */}
          <div className="flex items-center justify-center gap-2 px-3 pt-1" style={{ paddingBottom: "calc(56px + 0.75rem + env(safe-area-inset-bottom, 0px))" }}>
            {sellerProducts.length > 0 && (
              <button
                onClick={() => setViewMode(isSplit ? "full" : "split")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${isSplit ? "bg-white text-black" : "bg-primary text-primary-foreground"}`}
              >
                <Icon name="ShoppingBag" size={13} />
                {isSplit ? "Скрыть товары" : `Товары (${sellerProducts.length})`}
              </button>
            )}
            {!isSplit && (
              <button
                onClick={() => setChatVisible(v => !v)}
                className="flex items-center gap-1.5 bg-black/50 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full"
              >
                <Icon name={chatVisible ? "MessageCircleOff" : "MessageCircle"} size={13} />
                {chatVisible ? "Скрыть чат" : "Чат"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── ТОВАРЫ — только в split-режиме ────────────────────────────── */}
      {isSplit && (
        <div ref={productsRef} className="flex-1 bg-background overflow-y-auto">
          {/* Чат в split-режиме — компактная полоса */}
          <div className="border-b border-border bg-background">
            <div className="flex gap-2 items-center px-3 py-2">
              {user ? (
                <>
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                    placeholder="Написать в чат..."
                    maxLength={200}
                    className="flex-1 bg-secondary border border-border rounded-full px-4 py-2 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                    style={{ fontSize: 16 }}
                  />
                  <button onClick={sendMessage} disabled={!input.trim() || sending}
                    className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                    {sending ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="Send" size={14} />}
                  </button>
                </>
              ) : (
                <button onClick={() => setPage("auth")}
                  className="flex-1 text-center text-sm text-muted-foreground py-2 border border-border rounded-full">
                  Войдите чтобы написать
                </button>
              )}
            </div>
          </div>

          {/* Товары */}
          <div className="px-3 py-4 pb-24">
            <p className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Icon name="ShoppingBag" size={15} className="text-primary" />
              Товары продавца
              <span className="text-xs text-muted-foreground font-normal">({sellerProducts.length})</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                  <div className="p-2.5">
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