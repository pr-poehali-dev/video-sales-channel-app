import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type ChatMessage } from "@/context/StoreContext";
import type { Page } from "@/App";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

type FacingMode = "user" | "environment";

// ── Встроенный чат продавца ──────────────────────────────────────────────────
function LiveChat({ streamId }: { streamId: string }) {
  const { user } = useAuth();
  const { addChatMessage, getStreamMessages } = useStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try { setMessages(await getStreamMessages(streamId)); } catch { /* ignore */ }
  }, [streamId, getStreamMessages]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [refresh]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!input.trim() || !user) return;
    const msg = await addChatMessage({ streamId, userId: user.id, userName: user.name.split(" ")[0], userAvatar: user.avatar, text: input.trim() });
    setMessages(prev => [...prev, msg]);
    setInput("");
  };

  return (
    <div className="bg-black/40 backdrop-blur border border-white/10 rounded-2xl overflow-hidden flex flex-col" style={{ height: "280px" }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 flex-shrink-0">
        <Icon name="MessageSquare" size={13} className="text-white/70" />
        <span className="text-xs font-semibold text-white/80">Чат зрителей</span>
        <span className="ml-auto text-[10px] text-white/50">{messages.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {messages.length === 0
          ? <p className="text-[11px] text-white/40 text-center pt-4">Пока тихо...</p>
          : messages.map(m => (
            <div key={m.id} className="flex items-start gap-1.5">
              <div className="w-4 h-4 rounded-full bg-primary/40 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">{m.userAvatar}</div>
              <p className="text-[11px] text-white/90 leading-snug"><span className="text-primary/80 font-medium">{m.userName} </span>{m.text}</p>
            </div>
          ))
        }
        <div ref={chatEndRef} />
      </div>
      <div className="px-2 py-2 border-t border-white/10 flex gap-1.5 flex-shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ответить зрителям..." maxLength={200}
          className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/40 outline-none focus:border-primary/60"
        />
        <button onClick={send} disabled={!input.trim()}
          className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 flex-shrink-0">
          <Icon name="Send" size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Главная страница ──────────────────────────────────────────────────────────
interface BroadcastPageProps { setPage: (p: Page) => void; }

export default function BroadcastPage({ setPage }: BroadcastPageProps) {
  const { user } = useAuth();
  const { addStream, updateStream } = useStore();

  const videoRef       = useRef<HTMLVideoElement>(null);
  const cameraRef      = useRef<MediaStream | null>(null);
  const recorderRef    = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamIdRef    = useRef<string | null>(null);

  const [facingMode, setFacingMode]   = useState<FacingMode>("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isMuted, setIsMuted]         = useState(false);
  const [title, setTitle]             = useState("");
  const [isLive, setIsLive]           = useState(false);
  const [duration, setDuration]       = useState(0);
  const [uploading, setUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [finished, setFinished]       = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);

  const startCamera = useCallback(async (facing: FacingMode) => {
    setCameraError(null);
    cameraRef.current?.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      cameraRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; }
      setCameraReady(true);
    } catch (e: unknown) {
      const err = e as Error;
      setCameraReady(false);
      if (err.name === "NotAllowedError") setCameraError("Нет доступа к камере. Разрешите в настройках браузера.");
      else if (err.name === "NotFoundError") setCameraError("Камера не найдена.");
      else setCameraError("Ошибка камеры: " + err.message);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      cameraRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const switchCamera = async () => {
    const next: FacingMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startCamera(next);
  };

  const toggleMute = () => {
    cameraRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const startBroadcast = async () => {
    if (!title.trim() || !user || !cameraRef.current) return;
    // Создаём запись в БД
    const s = await addStream({ title: title.trim(), sellerId: user.id, sellerName: user.name, sellerAvatar: user.avatar, isLive: true, viewers: 0 });
    streamIdRef.current = s.id;
    // Начинаем запись
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";
    try {
      const rec = new MediaRecorder(cameraRef.current, { mimeType, videoBitsPerSecond: 1_500_000 });
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start(3000); // чанки каждые 3 сек
      recorderRef.current = rec;
    } catch { /* запись недоступна, эфир всё равно идёт */ }
    setIsLive(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const stopBroadcast = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const dur = duration;
    setSavedDuration(dur);
    setIsLive(false);

    // Останавливаем запись
    recorderRef.current?.stop();

    // Обновляем запись в БД как завершённую
    if (streamIdRef.current) {
      await updateStream(streamIdRef.current, { isLive: false, duration_sec: dur } as never);
    }

    // Загружаем видео через presigned URL напрямую в S3
    if (chunksRef.current.length > 0 && streamIdRef.current) {
      setUploading(true);
      setUploadProgress(5);
      const sid = streamIdRef.current;
      try {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "video/webm" });
        const mime = blob.type || "video/webm";
        setUploadProgress(15);

        // 1. Получаем presigned URL от бэкенда
        const presignResp = await fetch(`${STORE_API}?action=get_video_upload_url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stream_id: sid, mime }),
        });
        if (!presignResp.ok) throw new Error("presign failed");
        const { upload_url, cdn_url } = await presignResp.json();
        setUploadProgress(30);

        // 2. Загружаем blob напрямую в S3 через PUT (с прогрессом)
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = e => {
            if (e.lengthComputable) setUploadProgress(30 + Math.round(e.loaded / e.total * 60));
          };
          xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`S3 ${xhr.status}`)));
          xhr.onerror = () => reject(new Error("network"));
          xhr.open("PUT", upload_url);
          xhr.setRequestHeader("Content-Type", mime);
          xhr.send(blob);
        });
        setUploadProgress(95);

        // 3. Сохраняем CDN-ссылку в БД
        await fetch(`${STORE_API}?action=set_video_url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stream_id: sid, video_url: cdn_url }),
        });
        setUploadProgress(100);
      } catch (e) {
        console.error("Video upload failed:", e);
      } finally {
        setUploading(false);
      }
    }
    setFinished(true);
  };

  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };

  // ── Не залогинен ────────────────────────────────────────
  if (!user) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
      <Icon name="Video" size={36} className="mx-auto mb-4 text-muted-foreground opacity-40" />
      <h2 className="font-oswald text-xl font-semibold text-foreground mb-2">Войдите в аккаунт</h2>
      <p className="text-sm text-muted-foreground mb-5">Чтобы вести эфиры, необходимо войти</p>
      <button onClick={() => setPage("auth")} className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">
        Войти / Зарегистрироваться
      </button>
    </div>
  );

  // ── Экран завершения ─────────────────────────────────────
  if (finished) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
        <Icon name="CheckCircle" size={40} className="text-primary" />
      </div>
      <h2 className="font-oswald text-2xl font-semibold text-foreground mb-2">Эфир завершён!</h2>
      <p className="text-sm text-muted-foreground mb-1">«{title}»</p>
      <p className="text-sm text-muted-foreground mb-6">Длительность: {fmt(savedDuration)}</p>
      {uploading && (
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-2">Загружаем запись... {uploadProgress}%</p>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button onClick={() => { setFinished(false); setTitle(""); setDuration(0); streamIdRef.current = null; chunksRef.current = []; }}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">
          Начать новый эфир
        </button>
        <button onClick={() => setPage("dashboard")}
          className="border border-border text-foreground font-semibold px-6 py-3 rounded-xl hover:bg-secondary">
          В кабинет
        </button>
      </div>
    </div>
  );

  // ── Основной экран (шортс-стиль: видео на весь экран) ────
  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-56px)] bg-black">
      {/* Видео-контейнер — шортс формат */}
      <div className="relative w-full max-w-sm mx-auto" style={{ height: "calc(100vh - 56px)" }}>
        {/* Видео */}
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-950">
            <Icon name="VideoOff" size={48} className="text-white/30" />
            <p className="text-sm text-white/60">{cameraError}</p>
            <button onClick={() => startCamera(facingMode)} className="text-sm text-primary hover:underline">Попробовать снова</button>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
          />
        )}

        {/* Градиент снизу */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Верхняя панель */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4">
          <button onClick={() => setPage("dashboard")}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
            <Icon name="ArrowLeft" size={18} className="text-white" />
          </button>

          {isLive && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
              </div>
              <div className="bg-black/50 text-white text-xs font-mono px-2.5 py-1 rounded-full">{fmt(duration)}</div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button onClick={switchCamera}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
              <Icon name="RefreshCw" size={16} className="text-white" />
            </button>
            <button onClick={toggleMute}
              className={`w-9 h-9 rounded-full backdrop-blur flex items-center justify-center ${isMuted ? "bg-red-500/80" : "bg-black/40"}`}>
              <Icon name={isMuted ? "MicOff" : "Mic"} size={16} className="text-white" />
            </button>
          </div>
        </div>

        {/* Нижняя часть — чат + кнопки */}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-5 space-y-3">
          {/* Чат — только во время эфира */}
          {isLive && streamIdRef.current && <LiveChat streamId={streamIdRef.current} />}

          {/* Название + кнопка старт/стоп */}
          {!isLive ? (
            <div className="space-y-2">
              <input value={title} onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && startBroadcast()}
                placeholder="Название эфира..."
                className="w-full bg-black/50 backdrop-blur border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary/60"
              />
              <button onClick={startBroadcast}
                disabled={!title.trim() || !cameraReady}
                className="w-full flex items-center justify-center gap-2 bg-red-500 text-white font-bold py-3.5 rounded-xl hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-live-pulse" />
                Начать прямой эфир
              </button>
              {!cameraReady && !cameraError && <p className="text-xs text-center text-white/50">Запускаем камеру...</p>}
            </div>
          ) : (
            <button onClick={stopBroadcast}
              className="w-full flex items-center justify-center gap-2 bg-white/10 backdrop-blur border border-white/20 text-white font-semibold py-3.5 rounded-xl hover:bg-white/20 text-sm">
              <Icon name="Square" size={15} className="text-red-400" />
              Завершить эфир
            </button>
          )}
        </div>
      </div>
    </div>
  );
}