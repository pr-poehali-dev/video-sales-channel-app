import { useState, useRef, useEffect, useCallback } from "react";
import AgoraRTC, { type IAgoraRTCClient, type IRemoteVideoTrack, type IRemoteAudioTrack } from "agora-rtc-sdk-ng";
import { useAuth } from "@/context/AuthContext";
import { useStore, type StoreStream, type ChatMessage, type StoreProduct } from "@/context/StoreContext";
import type { CartItem, Page } from "@/App";
import StreamVideoPlayer from "@/pages/stream-watch/StreamVideoPlayer";
import StreamSidePanel from "@/pages/stream-watch/StreamSidePanel";
import StreamProductsSection from "@/pages/stream-watch/StreamProductsSection";

const AGORA_TOKEN = "https://functions.poehali.dev/a2751c9f-9c4b-4808-bf97-73f350e873a1";

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
  const [videoCollapsed, setVideoCollapsed] = useState(false);

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

  const handleAddToCart = (e: React.MouseEvent, p: StoreProduct) => {
    e.stopPropagation();
    addToCart({ id: p.id, name: p.name, price: p.price, image: p.images[0] ?? "" });
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1500);
  };

  return (
    <>
      <div className={`flex bg-black ${videoCollapsed ? "flex-col" : "flex-col lg:flex-row"}`}
        style={{ minHeight: videoCollapsed ? "auto" : "calc(100vh - 56px)" }}>
        <StreamVideoPlayer
          stream={stream}
          setPage={setPage}
          liveStatus={liveStatus}
          errorMsg={errorMsg}
          reaction={reaction}
          messagesCount={messages.length}
          videoElRef={videoElRef}
          onChatToggle={() => setChatOpen(o => !o)}
          onReaction={sendReaction}
          canReact={!!user}
          collapsed={videoCollapsed}
          onToggleCollapse={() => setVideoCollapsed(v => !v)}
        />
        <StreamSidePanel
          stream={stream}
          messages={messages}
          user={user}
          input={input}
          setInput={setInput}
          sendMessage={sendMessage}
          sending={sending}
          products={sellerProducts}
          addedId={addedId}
          handleAddToCart={handleAddToCart}
          onProductClick={onProductClick}
          liveStatus={liveStatus}
          chatOpen={chatOpen}
          setChatOpen={setChatOpen}
          rightTab={rightTab}
          setRightTab={setRightTab}
          videoCollapsed={videoCollapsed}
        />
      </div>

      <StreamProductsSection
        products={sellerProducts}
        addToCart={addToCart}
        addedId={addedId}
        setAddedId={setAddedId}
        reviewProduct={reviewProduct}
        setReviewProduct={setReviewProduct}
      />
    </>
  );
}