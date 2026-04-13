import { useState, useRef, useEffect, useCallback } from "react";
import AgoraRTC, { type IAgoraRTCClient, type ILocalVideoTrack, type ILocalAudioTrack } from "agora-rtc-sdk-ng";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type ChatMessage } from "@/context/StoreContext";
import type { Page } from "@/App";

const AGORA_TOKEN = "https://functions.poehali.dev/a2751c9f-9c4b-4808-bf97-73f350e873a1";

AgoraRTC.setLogLevel(3);

// Safari требует h264, остальные поддерживают vp8
const CODEC = (() => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("safari") && !ua.includes("chrome") ? "h264" : "vp8";
})();

// ── Чат вещателя ──────────────────────────────────────────────────────────────
function LiveChat({ streamId }: { streamId: string }) {
  const { user } = useAuth();
  const { addChatMessage, getStreamMessages } = useStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try { setMessages(await getStreamMessages(streamId)); } catch { /* ignore */ }
  }, [streamId, getStreamMessages]);

  useEffect(() => { refresh(); const t = setInterval(refresh, 3000); return () => clearInterval(t); }, [refresh]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!input.trim() || !user) return;
    const msg = await addChatMessage({ streamId, userId: user.id, userName: user.name.split(" ")[0], userAvatar: user.avatar, text: input.trim() });
    setMessages(prev => [...prev, msg]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 flex-shrink-0">
        <Icon name="MessageSquare" size={13} className="text-white/60" />
        <span className="text-xs font-semibold text-white/70">Чат зрителей</span>
        <span className="ml-auto text-[10px] text-white/40">{messages.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {messages.length === 0
          ? <p className="text-[11px] text-white/30 text-center pt-6">Пока тихо...</p>
          : messages.map(m => (
            <div key={m.id} className="flex items-start gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/30 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{m.userAvatar}</div>
              <p className="text-[11px] text-white/80 leading-snug"><span className="text-primary/80 font-semibold">{m.userName} </span>{m.text}</p>
            </div>
          ))}
        <div ref={endRef} />
      </div>
      <div className="px-2 py-2 border-t border-white/10 flex gap-1.5 flex-shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ответить..." maxLength={200}
          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-2.5 py-2 text-[11px] text-white placeholder:text-white/30 outline-none focus:border-primary/50"
        />
        <button onClick={send} disabled={!input.trim()}
          className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40">
          <Icon name="Send" size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Главная ───────────────────────────────────────────────────────────────────
interface BroadcastPageProps { setPage: (p: Page) => void; }

export default function BroadcastPage({ setPage }: BroadcastPageProps) {
  const { user } = useAuth();
  const { addStream, updateStream } = useStore();

  const clientRef    = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef = useRef<ILocalVideoTrack | null>(null);
  const audioTrackRef = useRef<ILocalAudioTrack | null>(null);
  const videoElRef   = useRef<HTMLDivElement | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamIdRef  = useRef<string | null>(null);
  const facingModeRef = useRef<"user" | "environment">("user");

  const [title, setTitle]           = useState("");
  const [isLive, setIsLive]         = useState(false);
  const [isMuted, setIsMuted]       = useState(false);
  const [isCamOff, setIsCamOff]     = useState(false);
  const [isFront, setIsFront]       = useState(true);
  const [duration, setDuration]     = useState(0);
  const [finished, setFinished]     = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);
  const [status, setStatus]         = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [errorMsg, setErrorMsg]     = useState("");

  // Патчим <video> внутри контейнера для Safari (playsinline + size)
  const patchVideoEl = (container: HTMLDivElement) => {
    setTimeout(() => {
      const v = container.querySelector("video");
      if (v) {
        v.setAttribute("playsinline", "");
        v.setAttribute("webkit-playsinline", "");
        v.style.width = "100%";
        v.style.height = "100%";
        v.style.objectFit = "cover";
        v.style.position = "absolute";
        v.style.inset = "0";
        v.play().catch(() => {/* Safari autoplay */});
      }
    }, 100);
  };

  // Callback ref — воспроизводим видео сразу как только div появится в DOM
  const setVideoEl = useCallback((el: HTMLDivElement | null) => {
    videoElRef.current = el;
    if (el && videoTrackRef.current) {
      videoTrackRef.current.play(el);
      patchVideoEl(el);
    }
  }, []);

  // Инициализируем превью камеры при загрузке
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
        // Если div уже есть в DOM — воспроизводим; иначе сработает callback ref
        if (videoElRef.current) {
          videoTrack.play(videoElRef.current);
          patchVideoEl(videoElRef.current);
        }
      } catch (e: unknown) {
        const err = e as Error;
        if (err.name === "NotAllowedError") setErrorMsg("Нет доступа к камере. Разрешите в настройках браузера.");
        else setErrorMsg("Ошибка камеры: " + err.message);
        setStatus("error");
      }
    })();

    return () => {
      videoTrack?.stop(); videoTrack?.close();
      audioTrack?.stop(); audioTrack?.close();
    };
  }, []);

  const startBroadcast = async () => {
    if (!title.trim() || !user) return;
    setStatus("connecting");
    setErrorMsg("");

    try {
      // Создаём эфир в БД
      const s = await addStream({ title: title.trim(), sellerId: user.id, sellerName: user.name, sellerAvatar: user.avatar, isLive: true, viewers: 0 });
      streamIdRef.current = s.id;

      // Получаем токен
      const tokenResp = await fetch(`${AGORA_TOKEN}?channel=${s.id}&uid=1&role=publisher`);
      const tokenData = await tokenResp.json();

      // Создаём клиент в режиме вещателя
      const client = AgoraRTC.createClient({ mode: "live", codec: CODEC });
      clientRef.current = client;
      await client.setClientRole("host");

      // Подключаемся к каналу
      await client.join(tokenData.appId, s.id, tokenData.token, 1);

      // Публикуем треки
      if (audioTrackRef.current && videoTrackRef.current) {
        await client.publish([audioTrackRef.current, videoTrackRef.current]);
      }

      setIsLive(true);
      setStatus("live");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e: unknown) {
      const err = e as Error;
      setErrorMsg("Ошибка подключения: " + err.message);
      setStatus("error");
      streamIdRef.current = null;
    }
  };

  const stopBroadcast = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const dur = duration;
    setSavedDuration(dur);

    try {
      await clientRef.current?.leave();
    } catch { /* ignore */ }
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

    // Останавливаем старый трек
    const oldTrack = videoTrackRef.current;
    if (oldTrack) { oldTrack.stop(); oldTrack.close(); }

    try {
      const newTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: { width: 640, height: 360, frameRate: 15, bitrateMax: 600 },
        optimizationMode: "motion",
        facingMode: newFacing,
      });
      videoTrackRef.current = newTrack;

      // Если в эфире — меняем трек на лету
      if (clientRef.current && isLive) {
        await clientRef.current.unpublish([oldTrack!]);
        await clientRef.current.publish([newTrack]);
      }

      if (videoElRef.current) {
        newTrack.play(videoElRef.current);
        patchVideoEl(videoElRef.current);
      }
    } catch { /* игнор */ }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;

  if (!user) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <Icon name="Video" size={36} className="mx-auto mb-4 text-muted-foreground opacity-40" />
      <h2 className="font-oswald text-xl font-semibold mb-2">Войдите в аккаунт</h2>
      <p className="text-sm text-muted-foreground mb-5">Чтобы вести эфиры, необходимо войти</p>
      <button onClick={() => setPage("auth")} className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">Войти</button>
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
        <button onClick={() => { setFinished(false); setTitle(""); setDuration(0); streamIdRef.current = null; setStatus("idle"); }}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">Новый эфир</button>
        <button onClick={() => setPage("dashboard")}
          className="border border-border font-semibold px-6 py-3 rounded-xl hover:bg-accent">Кабинет</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-56px)] bg-black flex flex-col lg:flex-row">

      {/* Видео-превью */}
      <div className="relative flex-1 bg-black" style={{ minHeight: "56vw", maxHeight: "70vh" }}>

        {/* Agora рендерит видео сюда */}
        <div ref={setVideoEl} className="w-full h-full" style={{ background: "#000", position: "relative", overflow: "hidden" }} />

        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6 text-center z-10">
            <div>
              <Icon name="VideoOff" size={36} className="mx-auto mb-3 text-red-400" />
              <p className="text-sm text-white/80 mb-4">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Шапка */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10">
          <button onClick={() => setPage("streams")} className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Icon name="ArrowLeft" size={18} className="text-white" />
          </button>
          {isLive && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
              </span>
              <span className="bg-black/60 text-white text-xs font-mono px-2 py-1 rounded-lg">{fmt(duration)}</span>
            </div>
          )}
          {status === "connecting" && (
            <div className="flex items-center gap-1.5 bg-black/60 text-white/70 text-xs px-3 py-1.5 rounded-full">
              <Icon name="Loader" size={12} className="animate-spin" />Подключение...
            </div>
          )}
          <div className="w-9 h-9" />
        </div>

        {/* Нижние кнопки */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 z-10">
          {!isLive && (
            <div className="mb-3">
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
                placeholder="Название эфира..."
                className="w-full bg-black/60 backdrop-blur border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary/60"
              />
            </div>
          )}
          <div className="flex items-center justify-center gap-4">
            <button onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
              <Icon name={isMuted ? "MicOff" : "Mic"} size={18} className="text-white" />
            </button>

            {isLive ? (
              <button onClick={stopBroadcast}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 rounded-full text-sm shadow-lg transition-colors">
                <Icon name="Square" size={16} />Завершить
              </button>
            ) : (
              <button onClick={startBroadcast}
                disabled={!title.trim() || status === "connecting" || status === "error"}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-8 py-3.5 rounded-full text-sm shadow-lg transition-colors">
                {status === "connecting"
                  ? <><Icon name="Loader" size={16} className="animate-spin" />Подключение...</>
                  : <><span className="w-2.5 h-2.5 rounded-full bg-white" />Начать эфир</>
                }
              </button>
            )}

            <button onClick={toggleCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCamOff ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
              <Icon name={isCamOff ? "VideoOff" : "Video"} size={18} className="text-white" />
            </button>

            <button onClick={flipCamera} disabled={isCamOff}
              className="w-12 h-12 rounded-full bg-black/60 backdrop-blur border border-white/20 flex items-center justify-center disabled:opacity-30 transition-colors"
              title={isFront ? "Переключить на основную" : "Переключить на фронтальную"}>
              <Icon name="RefreshCw" size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Боковая панель */}
      <div className="lg:w-80 xl:w-96 bg-zinc-950 border-l border-white/10 flex flex-col"
        style={{ minHeight: isLive ? "220px" : "auto" }}>
        {isLive && streamIdRef.current
          ? <LiveChat streamId={streamIdRef.current} />
          : (
            <div className="p-4">
              <div className="p-3 rounded-xl bg-white/5 flex items-start gap-2.5">
                <Icon name="Zap" size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-white/50">Agora — профессиональный стриминг. Задержка &lt;1 сек, HD-качество, звук без заиканий.</p>
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
}