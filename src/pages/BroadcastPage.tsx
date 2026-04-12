import { useState, useRef, useEffect, useCallback, useCallback as _uc } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { Page } from "@/App";

function LiveChat({ streamId, setPage: _setPage }: { streamId: string; setPage: (p: Page) => void }) {
  const { user } = useAuth();
  const { addChatMessage, getStreamMessages } = useStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<import("@/context/StoreContext").ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    try { setMessages(await getStreamMessages(streamId)); } catch { /* ignore */ }
  }, [streamId, getStreamMessages]);

  useEffect(() => {
    fetch();
    pollRef.current = setInterval(fetch, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetch]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!input.trim() || !user) return;
    const msg = await addChatMessage({ streamId, userId: user.id, userName: user.name.split(" ")[0], userAvatar: user.avatar, text: input.trim() });
    setMessages(prev => [...prev, msg]);
    setInput("");
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ height: "320px" }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border flex-shrink-0">
        <Icon name="MessageSquare" size={14} className="text-primary" />
        <span className="text-sm font-semibold text-foreground">Чат зрителей</span>
        <span className="ml-auto text-xs text-muted-foreground">{messages.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.length === 0
          ? <p className="text-xs text-muted-foreground text-center pt-6">Сообщений пока нет</p>
          : messages.map(m => (
            <div key={m.id} className="flex items-start gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center font-oswald flex-shrink-0">{m.userAvatar}</div>
              <div>
                <span className="text-[10px] text-muted-foreground">{m.userName} </span>
                <span className="text-xs text-foreground">{m.text}</span>
              </div>
            </div>
          ))
        }
        <div ref={chatEndRef} />
      </div>
      <div className="px-3 py-2 border-t border-border flex gap-2 flex-shrink-0">
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ответить зрителям..."
          className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
        />
        <button onClick={send} disabled={!input.trim()}
          className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 flex-shrink-0">
          <Icon name="Send" size={13} />
        </button>
      </div>
    </div>
  );
}

interface BroadcastPageProps {
  setPage: (p: Page) => void;
}

type FacingMode = "user" | "environment";

export default function BroadcastPage({ setPage }: BroadcastPageProps) {
  const { user } = useAuth();
  const { addStream, updateStream } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentStreamId = useRef<string | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(0);
  const [viewers] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);

  const startCamera = useCallback(async (facing: FacingMode) => {
    setCameraError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraStarted(true);
      setHasCamera(true);
    } catch (e: unknown) {
      const err = e as Error;
      setHasCamera(false);
      setCameraStarted(false);
      if (err.name === "NotAllowedError") setCameraError("Нет доступа к камере. Разрешите доступ в настройках браузера.");
      else if (err.name === "NotFoundError") setCameraError("Камера не найдена на этом устройстве.");
      else setCameraError("Не удалось запустить камеру: " + err.message);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const switchCamera = async () => {
    const next: FacingMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startCamera(next);
  };

  const toggleMute = () => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const startBroadcast = () => {
    if (!title.trim() || !user) return;
    const now = new Date();
    const s = addStream({
      title: title.trim(),
      sellerId: user.id,
      sellerName: user.name,
      sellerAvatar: user.avatar,
      isLive: true,
      viewers: 0,
      startedAt: now.toLocaleDateString("ru", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
    });
    currentStreamId.current = s.id;
    setIsLive(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const stopBroadcast = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (currentStreamId.current) {
      updateStream(currentStreamId.current, {
        isLive: false,
        endedAt: new Date().toISOString(),
        duration,
        viewers,
      });
    }
    setSavedDuration(duration);
    setIsLive(false);
    setFinished(true);
  };

  const fmtDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <Icon name="Video" size={36} className="mx-auto mb-4 text-muted-foreground opacity-40" />
        <h2 className="font-oswald text-xl font-semibold text-foreground mb-2">Войдите в аккаунт</h2>
        <p className="text-sm text-muted-foreground mb-5">Чтобы вести эфиры, необходимо войти</p>
        <button onClick={() => setPage("auth")} className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  // Экран после завершения эфира
  if (finished) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Icon name="CheckCircle" size={40} className="text-primary" />
        </div>
        <h2 className="font-oswald text-2xl font-semibold text-foreground mb-2">Эфир завершён</h2>
        <p className="text-sm text-muted-foreground mb-1">«{title}»</p>
        <p className="text-sm text-muted-foreground mb-8">Длительность: {fmtDuration(savedDuration)}</p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <button
            onClick={() => { setFinished(false); setTitle(""); setDuration(0); currentStreamId.current = null; }}
            className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Начать новый эфир
          </button>
          <button
            onClick={() => setPage("dashboard")}
            className="border border-border text-foreground font-semibold px-6 py-3 rounded-xl hover:bg-secondary transition-colors"
          >
            В кабинет
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-fade-in">
      <button
        onClick={() => setPage("dashboard")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
      >
        <Icon name="ArrowLeft" size={16} />
        Назад в кабинет
      </button>

      <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide mb-6">Прямой эфир</h1>

      {/* Превью камеры */}
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[9/16] md:aspect-video mb-5">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Icon name="VideoOff" size={40} className="text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">{cameraError}</p>
            <button onClick={() => startCamera(facingMode)} className="text-sm text-primary hover:underline">
              Попробовать снова
            </button>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
          />
        )}

        {isLive && (
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />
              LIVE
            </div>
            <div className="bg-black/60 text-white text-xs px-2.5 py-1.5 rounded font-mono">
              {fmtDuration(duration)}
            </div>
          </div>
        )}

        {isLive && (
          <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-2.5 py-1.5 rounded flex items-center gap-1.5">
            <Icon name="Eye" size={12} />{viewers}
          </div>
        )}

        {cameraStarted && (
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button onClick={switchCamera}
              className="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70 transition-colors"
              title="Переключить камеру">
              <Icon name="RefreshCw" size={18} />
            </button>
            <button onClick={toggleMute}
              className={`w-11 h-11 rounded-full backdrop-blur flex items-center justify-center text-white transition-colors ${isMuted ? "bg-red-500/80 hover:bg-red-500" : "bg-black/50 hover:bg-black/70"}`}
              title={isMuted ? "Включить микрофон" : "Выключить микрофон"}>
              <Icon name={isMuted ? "MicOff" : "Mic"} size={18} />
            </button>
          </div>
        )}

        {cameraStarted && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <span className="bg-black/50 text-white text-[10px] px-2 py-1 rounded">
              {facingMode === "environment" ? "Основная камера" : "Фронтальная камера"}
            </span>
          </div>
        )}
      </div>

      {!isLive ? (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Название эфира *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && startBroadcast()}
              placeholder="Например: Новая коллекция украшений"
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <button
            onClick={startBroadcast}
            disabled={!title.trim() || !hasCamera || !!cameraError}
            className="w-full flex items-center justify-center gap-2 bg-red-500 text-white font-semibold py-3.5 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-live-pulse" />
            Начать прямой эфир
          </button>
          {!cameraStarted && !cameraError && (
            <p className="text-xs text-center text-muted-foreground">Запускаем камеру...</p>
          )}
        </div>
      ) : (
        <div className="bg-card border border-destructive/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Icon name="Eye" size={13} />{viewers} зрителей
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-semibold text-foreground">{fmtDuration(duration)}</div>
              <div className="text-xs text-red-500 font-medium">В эфире</div>
            </div>
          </div>
          <button
            onClick={stopBroadcast}
            className="w-full flex items-center justify-center gap-2 bg-secondary text-destructive font-semibold py-3.5 rounded-xl border border-destructive/30 hover:bg-destructive/10 transition-colors"
          >
            <Icon name="Square" size={15} />
            Завершить эфир
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-4">
        Для лучшего качества используйте стабильный Wi-Fi или 4G
      </p>
    </div>
  );
}