import { useState, useRef, useEffect, useCallback } from "react";
import AgoraRTC, { type IAgoraRTCClient, type ILocalVideoTrack, type ILocalAudioTrack } from "agora-rtc-sdk-ng";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type ChatMessage } from "@/context/StoreContext";
import type { Page } from "@/App";

const AGORA_TOKEN = "https://functions.poehali.dev/a2751c9f-9c4b-4808-bf97-73f350e873a1";
const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

AgoraRTC.setLogLevel(3);

const CODEC = (() => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("safari") && !ua.includes("chrome") ? "h264" : "vp8";
})();

// ── Модалка быстрого добавления товара ────────────────────────────────────────
interface QuickProductModalProps {
  imageDataUrl: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  onClose: () => void;
  onSaved: () => void;
}

function QuickProductModal({ imageDataUrl, sellerId, sellerName, sellerAvatar, onClose, onSaved }: QuickProductModalProps) {
  const { addProduct } = useStore();
  const [name, setName]       = useState("");
  const [price, setPrice]     = useState("");
  const [stock, setStock]     = useState("10");
  const [saving, setSaving]   = useState(false);
  const [imgUrl, setImgUrl]   = useState<string | null>(null);

  // Загружаем фото в S3 сразу при открытии
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API}?action=upload_image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_url: imageDataUrl }),
        });
        const data = await resp.json();
        if (data.url) setImgUrl(data.url);
      } catch { /* ignore */ }
    })();
  }, [imageDataUrl]);

  const save = async () => {
    if (!name.trim() || !price || saving) return;
    setSaving(true);
    try {
      await addProduct({
        name: name.trim(),
        price: parseFloat(price),
        category: "Разное",
        description: "",
        images: imgUrl ? [imgUrl] : [],
        sellerId,
        sellerName,
        sellerAvatar,
        inStock: parseInt(stock) || 0,
      });
      onSaved();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-zinc-900 rounded-t-2xl p-4 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-white text-sm">Быстрый товар из эфира</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10">
            <Icon name="X" size={14} className="text-white" />
          </button>
        </div>

        <div className="flex gap-3 mb-4">
          {/* Фото */}
          <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
            <img src={imageDataUrl} className="w-full h-full object-cover" />
          </div>
          {/* Поля */}
          <div className="flex-1 flex flex-col gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Название товара..."
              className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/60 w-full"
              style={{ fontSize: 16 }}
              autoFocus
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  value={price}
                  onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="Цена"
                  type="number"
                  className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/60 w-full pr-6"
                  style={{ fontSize: 16 }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">₽</span>
              </div>
              <div className="relative w-20">
                <input
                  value={stock}
                  onChange={e => setStock(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Кол-во"
                  type="number"
                  className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/60 w-full pr-5"
                  style={{ fontSize: 16 }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 text-[10px]">шт</span>
              </div>
            </div>
          </div>
        </div>

        {!imgUrl && (
          <p className="text-[11px] text-white/30 text-center mb-3">Загружаю фото...</p>
        )}

        <button
          onClick={save}
          disabled={!name.trim() || !price || saving}
          className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? <Icon name="Loader" size={15} className="animate-spin" /> : <Icon name="Plus" size={15} />}
          {saving ? "Сохраняю..." : "Добавить в магазин"}
        </button>
      </div>
    </div>
  );
}

// ── Главная ───────────────────────────────────────────────────────────────────
interface BroadcastPageProps { setPage: (p: Page) => void; }

export default function BroadcastPage({ setPage }: BroadcastPageProps) {
  const { user } = useAuth();
  const { addStream, updateStream, reload } = useStore();

  const [checkedActive, setCheckedActive] = useState<{id: string; title: string} | null | "loading">("loading");

  useEffect(() => {
    if (!user) { setCheckedActive(null); return; }
    reload().then(() => {
      fetch(`${API}?action=get_streams`)
        .then(r => r.json())
        .then((all: Array<{sellerId: string; isLive: boolean; id: string; title: string}>) => {
          const found = all.find(s => s.sellerId === user.id && s.isLive);
          setCheckedActive(found ?? null);
        })
        .catch(() => setCheckedActive(null));
    });
  }, [user?.id]);

  const clientRef      = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef  = useRef<ILocalVideoTrack | null>(null);
  const audioTrackRef  = useRef<ILocalAudioTrack | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamIdRef    = useRef<string | null>(null);
  const facingModeRef  = useRef<"user" | "environment">("user");
  const thumbInputRef  = useRef<HTMLInputElement>(null);

  const [title, setTitle]             = useState("");
  const [isLive, setIsLive]           = useState(false);
  const [isMuted, setIsMuted]         = useState(false);
  const [isCamOff, setIsCamOff]       = useState(false);
  const [isFront, setIsFront]         = useState(true);
  const [duration, setDuration]       = useState(0);
  const [finished, setFinished]       = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);
  const [status, setStatus]           = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [errorMsg, setErrorMsg]       = useState("");
  const [customThumb, setCustomThumb] = useState<string | null>(null);
  const [stoppingActive, setStoppingActive] = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);

  // Чат
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatVisible, setChatVisible]   = useState(true);
  const [chatSending, setChatSending]   = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addChatMessage, getStreamMessages } = useStore();

  // Фото-товар
  const [quickProductImg, setQuickProductImg] = useState<string | null>(null);

  const refreshChat = useCallback(async () => {
    if (!streamIdRef.current) return;
    try { setChatMessages(await getStreamMessages(streamIdRef.current)); } catch { /* ignore */ }
  }, [getStreamMessages]);

  useEffect(() => {
    if (isLive) {
      refreshChat();
      chatPollRef.current = setInterval(refreshChat, 3000);
    }
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [isLive, refreshChat]);

  useEffect(() => {
    if (chatVisible) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, chatVisible]);

  const sendChat = async () => {
    if (!chatInput.trim() || !user || chatSending || !streamIdRef.current) return;
    setChatSending(true);
    try {
      const msg = await addChatMessage({
        streamId: streamIdRef.current,
        userId: user.id,
        userName: user.name.split(" ")[0],
        userAvatar: user.avatar,
        text: chatInput.trim(),
      });
      setChatMessages(prev => [...prev, msg]);
      setChatInput("");
    } catch { /* ignore */ }
    finally { setChatSending(false); }
  };

  const attachStream = useCallback((track: ILocalVideoTrack | null) => {
    const vid = nativeVideoRef.current;
    if (!vid || !track) return;
    try {
      const ms = new MediaStream([track.getMediaStreamTrack()]);
      vid.srcObject = ms;
      vid.play().catch(() => {});
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (videoTrackRef.current) attachStream(videoTrackRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let videoTrack: ILocalVideoTrack | null = null;
    let audioTrack: ILocalAudioTrack | null = null;
    (async () => {
      try {
        [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
          { encoderConfig: "speech_standard" },
          { encoderConfig: { width: 640, height: 360, frameRate: 15, bitrateMax: 600 }, optimizationMode: "motion",
            facingMode: facingModeRef.current }
        );
        audioTrackRef.current = audioTrack;
        videoTrackRef.current = videoTrack;
        attachStream(videoTrack);
      } catch (e: unknown) {
        const err = e as Error;
        if (err.name === "NotAllowedError") setErrorMsg("Нет доступа к камере. Разрешите в настройках браузера.");
        else setErrorMsg("Ошибка камеры: " + err.message);
        setStatus("error");
      }
    })();
    return () => { videoTrack?.stop(); videoTrack?.close(); audioTrack?.stop(); audioTrack?.close(); };
  }, []);

  const handleThumbFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setCustomThumb(dataUrl);
      if (streamIdRef.current) {
        setThumbUploading(true);
        try {
          await fetch(`${API}?action=upload_thumbnail`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stream_id: streamIdRef.current, data_url: dataUrl }),
          });
        } catch { /* ignore */ }
        finally { setThumbUploading(false); }
      }
    };
    reader.readAsDataURL(file);
  };

  // Делаем скриншот с видео для быстрого товара
  const capturePhoto = () => {
    const vid = nativeVideoRef.current;
    if (!vid) return;
    const canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth || 640;
    canvas.height = vid.videoHeight || 360;
    canvas.getContext("2d")?.drawImage(vid, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setQuickProductImg(dataUrl);
  };

  const startBroadcast = async () => {
    if (!title.trim() || !user) return;
    setStatus("connecting");
    setErrorMsg("");
    let createdStreamId: string | null = null;
    try {
      try {
        const allResp = await fetch(`${API}?action=get_streams`);
        const allStreams: Array<{seller_id: string; is_live: boolean; id: string}> = await allResp.json();
        const active = allStreams.filter(s => s.seller_id === user.id && s.is_live);
        for (const st of active) {
          await updateStream(st.id, { isLive: false } as never);
        }
      } catch { /* ignore */ }

      const s = await addStream({ title: title.trim(), sellerId: user.id, sellerName: user.name, sellerAvatar: user.avatar, isLive: true, viewers: 0 });
      createdStreamId = s.id;
      streamIdRef.current = s.id;

      const tokenResp = await fetch(`${AGORA_TOKEN}?channel=${s.id}&uid=1&role=publisher`);
      const tokenData = await tokenResp.json();
      if (tokenData.error) throw new Error("Токен: " + tokenData.error);

      const client = AgoraRTC.createClient({ mode: "live", codec: CODEC });
      clientRef.current = client;
      await client.setClientRole("host");

      await Promise.race([
        client.join(tokenData.appId, s.id, tokenData.token, 1),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Таймаут подключения 30с")), 30000)),
      ]);

      if (audioTrackRef.current && videoTrackRef.current) {
        await client.publish([audioTrackRef.current, videoTrackRef.current]);
      }

      setIsLive(true);
      setStatus("live");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

      setTimeout(async () => {
        try {
          let dataUrl = customThumb;
          if (!dataUrl) {
            const vid = nativeVideoRef.current;
            if (!vid || !s.id) return;
            const canvas = document.createElement("canvas");
            canvas.width = vid.videoWidth || 640;
            canvas.height = vid.videoHeight || 360;
            canvas.getContext("2d")?.drawImage(vid, 0, 0, canvas.width, canvas.height);
            dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          }
          await fetch(`${API}?action=upload_thumbnail`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stream_id: s.id, data_url: dataUrl }),
          });
        } catch { /* не критично */ }
      }, 1000);
    } catch (e: unknown) {
      const err = e as Error;
      setErrorMsg("Ошибка подключения: " + err.message);
      setStatus("error");
      if (createdStreamId) {
        streamIdRef.current = null;
        try {
          await updateStream(createdStreamId, { isLive: false } as never);
        } catch { /* ignore */ }
      }
    }
  };

  const stopBroadcast = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; }
    const dur = duration;
    setSavedDuration(dur);
    try { await clientRef.current?.leave(); } catch { /* ignore */ }
    clientRef.current = null;
    const sid = streamIdRef.current;
    if (sid) await updateStream(sid, { isLive: false, duration_sec: dur } as never);
    setIsLive(false);
    setStatus("idle");
    setFinished(true);
  };

  const toggleMute = async () => {
    if (!audioTrackRef.current) return;
    await audioTrackRef.current.setEnabled(isMuted);
    setIsMuted(m => !m);
  };

  const toggleCamera = async () => {
    if (!videoTrackRef.current) return;
    await videoTrackRef.current.setEnabled(isCamOff);
    setIsCamOff(c => !c);
  };

  const flipCamera = async () => {
    const newFacing = facingModeRef.current === "user" ? "environment" : "user";
    facingModeRef.current = newFacing;
    setIsFront(newFacing === "user");
    const oldTrack = videoTrackRef.current;
    if (oldTrack) { oldTrack.stop(); oldTrack.close(); }
    try {
      const newTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: { width: 640, height: 360, frameRate: 15, bitrateMax: 600 },
        optimizationMode: "motion",
        facingMode: newFacing,
      });
      videoTrackRef.current = newTrack;
      if (clientRef.current && isLive) {
        await clientRef.current.unpublish([oldTrack!]);
        await clientRef.current.publish([newTrack]);
      }
      attachStream(newTrack);
    } catch { /* игнор */ }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;

  // ── Экраны-заглушки ──────────────────────────────────────────────────────────
  if (!user) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <Icon name="Video" size={36} className="mx-auto mb-4 text-muted-foreground opacity-40" />
      <h2 className="font-oswald text-xl font-semibold mb-2">Войдите в аккаунт</h2>
      <p className="text-sm text-muted-foreground mb-5">Чтобы вести эфиры, необходимо войти</p>
      <button onClick={() => setPage("auth")} className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">Войти</button>
    </div>
  );

  if (checkedActive === "loading" && !isLive) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <Icon name="Loader" size={32} className="mx-auto text-muted-foreground animate-spin" />
    </div>
  );

  if (checkedActive && !isLive) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
        <Icon name="Radio" size={40} className="text-red-500" />
      </div>
      <h2 className="font-oswald text-2xl font-semibold mb-2">Эфир идёт прямо сейчас</h2>
      <p className="text-sm text-muted-foreground mb-1">«{checkedActive.title}»</p>
      <p className="text-sm text-muted-foreground mb-6">Нажмите «Завершить эфир» чтобы остановить</p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button
          onClick={async () => {
            setStoppingActive(true);
            try {
              await updateStream(checkedActive.id, { isLive: false });
              setCheckedActive(null);
              setFinished(true);
              setTitle(checkedActive.title);
            }
            catch { /* ignore */ }
            finally { setStoppingActive(false); }
          }}
          disabled={stoppingActive}
          className="bg-red-500 text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60">
          {stoppingActive ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name="Square" size={16} />}
          Завершить эфир
        </button>
        <button onClick={() => setPage("dashboard")}
          className="border border-border font-semibold px-6 py-3 rounded-xl hover:bg-accent">Назад в кабинет</button>
      </div>
    </div>
  );

  if (finished) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
        <Icon name="CheckCircle" size={40} className="text-primary" />
      </div>
      <h2 className="font-oswald text-2xl font-semibold mb-2">Эфир завершён!</h2>
      <p className="text-sm text-muted-foreground mb-1">«{title}»</p>
      <p className="text-sm text-muted-foreground mb-6">Длительность: {fmt(savedDuration)}</p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button onClick={() => { setFinished(false); setTitle(""); setDuration(0); streamIdRef.current = null; setStatus("idle"); setChatMessages([]); }}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">Новый эфир</button>
        <button onClick={() => setPage("dashboard")}
          className="border border-border font-semibold px-6 py-3 rounded-xl hover:bg-accent">Кабинет</button>
      </div>
    </div>
  );

  return (
    <div className="relative bg-black" style={{ height: "calc(100dvh - 56px)" }}>

      {/* ── ВИДЕО на весь экран ── */}
      <video
        ref={nativeVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ background: "#000" }}
      />

      {/* Ошибка камеры */}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6 text-center z-10">
          <div>
            <Icon name="VideoOff" size={36} className="mx-auto mb-3 text-red-400" />
            <p className="text-sm text-white/80 mb-4">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ── ШАПКА ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-3 z-20"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}>
        <button onClick={() => setPage("streams")}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
          <Icon name="ArrowLeft" size={18} className="text-white" />
        </button>

        <div className="flex items-center gap-2">
          {isLive && (
            <>
              <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
              </span>
              <span className="bg-black/60 text-white text-xs font-mono px-2 py-1 rounded-lg">{fmt(duration)}</span>
            </>
          )}
          {status === "connecting" && (
            <div className="flex items-center gap-1.5 bg-black/60 text-white/70 text-xs px-3 py-1.5 rounded-full">
              <Icon name="Loader" size={12} className="animate-spin" />Подключение...
            </div>
          )}
        </div>

        {/* Кнопки справа (только в эфире) */}
        {isLive && (
          <div className="flex items-center gap-2">
            <button
              onClick={capturePhoto}
              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg"
              title="Сфотографировать и добавить товар"
            >
              <Icon name="Camera" size={17} className="text-primary-foreground" />
            </button>
            <button
              onClick={stopBroadcast}
              className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
            >
              <Icon name="Square" size={11} />
              Стоп
            </button>
          </div>
        )}
        {!isLive && <div className="w-9 h-9" />}
      </div>

      {/* ── ЧАТ ПОВЕРХ ВИДЕО (только в эфире) ── */}
      {isLive && (
        <div className="absolute bottom-0 left-0 right-0 z-20"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 60%, transparent)" }}>

          {/* Сообщения */}
          {chatVisible && (
            <div className="px-3 pt-3 pb-1 space-y-1.5 overflow-y-auto" style={{ maxHeight: 150 }}>
              {chatMessages.length === 0
                ? <p className="text-[11px] text-white/30 text-center">Пока тихо...</p>
                : chatMessages.map(m => (
                  <div key={m.id} className="flex items-start gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-white/20 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {m.userAvatar}
                    </div>
                    <p className="text-xs text-white leading-snug">
                      <span className="font-bold text-primary/90">{m.userName} </span>
                      <span className="text-white/80">{m.text}</span>
                    </p>
                  </div>
                ))
              }
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Ввод сообщения */}
          <div className="px-3 pt-1 pb-2">
            <div className="flex gap-2 items-center">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Написать в чат..."
                maxLength={200}
                className="flex-1 bg-black/50 backdrop-blur border border-white/20 rounded-full px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/40"
                style={{ fontSize: 16 }}
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatSending}
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                {chatSending ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="Send" size={14} />}
              </button>
            </div>
          </div>

          {/* Нижние кнопки управления */}
          <div className="flex items-center justify-center gap-3 px-4 pb-5">
            {/* Скрыть чат */}
            <button
              onClick={() => setChatVisible(v => !v)}
              className="flex items-center gap-1.5 bg-black/50 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full"
            >
              <Icon name={chatVisible ? "MessageCircleOff" : "MessageCircle"} size={13} />
              {chatVisible ? "Скрыть чат" : "Чат"}
            </button>

            {/* Микрофон */}
            <button onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
              <Icon name={isMuted ? "MicOff" : "Mic"} size={18} className="text-white" />
            </button>

            {/* Завершить */}
            <button onClick={stopBroadcast}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-full text-sm shadow-lg transition-colors">
              <Icon name="Square" size={15} />Завершить
            </button>

            {/* Камера вкл/выкл */}
            <button onClick={toggleCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCamOff ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
              <Icon name={isCamOff ? "VideoOff" : "Video"} size={18} className="text-white" />
            </button>

            {/* Перевернуть камеру */}
            <button onClick={flipCamera} disabled={isCamOff}
              className="w-12 h-12 rounded-full bg-black/60 backdrop-blur border border-white/20 flex items-center justify-center disabled:opacity-30 transition-colors">
              <Icon name="RefreshCw" size={18} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── НЕ В ЭФИРЕ: форма запуска ── */}
      {!isLive && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-8"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 70%, transparent)" }}>

          <div className="flex flex-col gap-2 mb-4">
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
              placeholder="Название эфира..."
              className="w-full bg-black/60 backdrop-blur border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary/60"
              style={{ fontSize: 16 }}
            />
            <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbFile} />
            <button
              onClick={() => thumbInputRef.current?.click()}
              className="flex items-center gap-2 bg-black/60 backdrop-blur border border-white/20 rounded-xl px-4 py-2 text-xs text-white/70 hover:text-white hover:border-white/40 transition-colors w-full"
            >
              {customThumb
                ? <><img src={customThumb} className="w-5 h-5 rounded object-cover flex-shrink-0" /><span className="truncate">Превью загружено — нажми чтобы сменить</span></>
                : <><Icon name="Image" size={14} className="flex-shrink-0" /><span>Загрузить превью (необязательно)</span></>
              }
            </button>
          </div>

          {errorMsg && (
            <div className="mb-3 bg-black/80 border border-red-500/50 rounded-xl px-4 py-2.5 text-xs text-red-400 text-center">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            <button onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
              <Icon name={isMuted ? "MicOff" : "Mic"} size={18} className="text-white" />
            </button>

            <button
              onClick={status === "error" ? () => { setStatus("idle"); setErrorMsg(""); } : startBroadcast}
              disabled={!title.trim() || status === "connecting"}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-8 py-3.5 rounded-full text-sm shadow-lg transition-colors">
              {status === "connecting"
                ? <><Icon name="Loader" size={16} className="animate-spin" />Подключение...</>
                : status === "error"
                ? <><Icon name="RefreshCw" size={16} />Повторить</>
                : <><span className="w-2.5 h-2.5 rounded-full bg-white" />Начать эфир</>
              }
            </button>

            <button onClick={toggleCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCamOff ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
              <Icon name={isCamOff ? "VideoOff" : "Video"} size={18} className="text-white" />
            </button>

            <button onClick={flipCamera} disabled={isCamOff}
              className="w-12 h-12 rounded-full bg-black/60 backdrop-blur border border-white/20 flex items-center justify-center disabled:opacity-30 transition-colors">
              <Icon name="RefreshCw" size={18} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── Модалка быстрого товара ── */}
      {quickProductImg && user && (
        <QuickProductModal
          imageDataUrl={quickProductImg}
          sellerId={user.id}
          sellerName={user.name}
          sellerAvatar={user.avatar}
          onClose={() => setQuickProductImg(null)}
          onSaved={() => setQuickProductImg(null)}
        />
      )}
    </div>
  );
}