import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type ChatMessage } from "@/context/StoreContext";
import type { Page } from "@/App";

const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";
const JPEG_QUALITY = 0.4;
const FRAME_WIDTH = 400;
type FacingMode = "user" | "environment";

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

  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const cameraRef    = useRef<MediaStream | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamIdRef  = useRef<string | null>(null);
  const seqRef       = useRef(0);
  const activeRef    = useRef(false); // эфир идёт
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioBufRef  = useRef<Float32Array | null>(null);

  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [title, setTitle] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [duration, setDuration] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);

  const startCamera = useCallback(async (facing: FacingMode) => {
    setCameraError(null);
    cameraRef.current?.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      cameraRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch (e: unknown) {
      const err = e as Error;
      setCameraReady(false);
      if (err.name === "NotAllowedError") setCameraError("Нет доступа к камере. Разрешите в настройках браузера.");
      else if (err.name === "NotFoundError") setCameraError("Камера не найдена.");
      else setCameraError("Ошибка: " + err.message);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      activeRef.current = false;
      cameraRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      processorRef.current?.disconnect();
      audioCtxRef.current?.close();
    };
  }, []);

  const startAudioCapture = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = proc;
      proc.onaudioprocess = (e) => {
        audioBufRef.current = new Float32Array(e.inputBuffer.getChannelData(0));
      };
      src.connect(proc);
      proc.connect(ctx.destination);
    } catch { /* ignore */ }
  }, []);

  // Цепочка отправки: каждый кадр шлётся ТОЛЬКО после того как предыдущий получил ответ
  const sendLoop = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    while (activeRef.current) {
      const sid = streamIdRef.current;
      if (!sid || video.readyState < 2) {
        await new Promise(r => setTimeout(r, 50));
        continue;
      }

      try {
        const ctx = canvas.getContext("2d");
        if (!ctx) break;

        const aspect = (video.videoHeight || 480) / (video.videoWidth || 640);
        canvas.width  = FRAME_WIDTH;
        canvas.height = Math.round(FRAME_WIDTH * aspect);

        if (facingMode === "user") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (facingMode === "user") ctx.setTransform(1, 0, 0, 1, 0, 0);

        const frameB64 = canvas.toDataURL("image/jpeg", JPEG_QUALITY).split(",")[1];

        let audioB64: string | null = null;
        const abuf = audioBufRef.current;
        if (abuf) {
          const i16 = new Int16Array(abuf.length);
          for (let i = 0; i < abuf.length; i++) i16[i] = Math.max(-32768, Math.min(32767, abuf[i] * 32768));
          const u8 = new Uint8Array(i16.buffer);
          let bin = "";
          // Быстрый btoa через chunk
          for (let i = 0; i < u8.length; i += 8192) {
            bin += String.fromCharCode(...u8.subarray(i, i + 8192));
          }
          audioB64 = btoa(bin);
          audioBufRef.current = null;
        }

        await fetch(`${API}?action=push_frame`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stream_id: sid, seq: seqRef.current++, frame: frameB64, audio: audioB64 }),
        });
      } catch { /* ignore */ }
    }
  }, [facingMode]);

  const startBroadcast = async () => {
    if (!title.trim() || !user || !cameraRef.current) return;
    const s = await addStream({ title: title.trim(), sellerId: user.id, sellerName: user.name, sellerAvatar: user.avatar, isLive: true, viewers: 0 });
    streamIdRef.current = s.id;
    seqRef.current = 0;
    activeRef.current = true;
    startAudioCapture(cameraRef.current);
    setIsLive(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    sendLoop();
  };

  const stopBroadcast = async () => {
    activeRef.current = false;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    processorRef.current?.disconnect(); processorRef.current = null;
    audioCtxRef.current?.close(); audioCtxRef.current = null;
    const dur = duration;
    setSavedDuration(dur);
    setIsLive(false);
    const sid = streamIdRef.current;
    if (sid) await updateStream(sid, { isLive: false, duration_sec: dur } as never);
    setFinished(true);
  };

  const switchCamera = async () => {
    const next: FacingMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startCamera(next);
  };

  const toggleMute = () => {
    cameraRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
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
        <button onClick={() => { setFinished(false); setTitle(""); setDuration(0); streamIdRef.current = null; }}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">Новый эфир</button>
        <button onClick={() => setPage("dashboard")}
          className="border border-border font-semibold px-6 py-3 rounded-xl hover:bg-accent">Кабинет</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-56px)] bg-black flex flex-col lg:flex-row">
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Видео-превью */}
      <div className="relative flex-1 bg-black" style={{ minHeight: "56vw", maxHeight: "70vh" }}>
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />

        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6 text-center">
            <div>
              <Icon name="VideoOff" size={36} className="mx-auto mb-3 text-red-400" />
              <p className="text-sm text-white/80 mb-4">{cameraError}</p>
              <button onClick={() => startCamera(facingMode)} className="text-xs text-primary underline">Попробовать снова</button>
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
          <button onClick={switchCamera} className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Icon name="RefreshCw" size={16} className="text-white" />
          </button>
        </div>

        {/* Нижние кнопки */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 z-10">
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
              className={`w-12 h-12 rounded-full flex items-center justify-center ${isMuted ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
              <Icon name={isMuted ? "MicOff" : "Mic"} size={18} className="text-white" />
            </button>

            {isLive ? (
              <button onClick={stopBroadcast}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 rounded-full text-sm shadow-lg">
                <Icon name="Square" size={16} />Завершить
              </button>
            ) : (
              <button onClick={startBroadcast} disabled={!cameraReady || !title.trim()}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-8 py-3.5 rounded-full text-sm shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />Начать эфир
              </button>
            )}

            <div className="w-12 h-12" /> {/* Заглушка для симметрии */}
          </div>
        </div>
      </div>

      {/* Боковая / нижняя панель */}
      <div className="lg:w-80 xl:w-96 bg-zinc-950 border-l border-white/10 flex flex-col" style={{ minHeight: isLive ? "220px" : "auto" }}>
        {isLive && streamIdRef.current
          ? <LiveChat streamId={streamIdRef.current} />
          : (
            <div className="p-4 flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-white/5 flex items-start gap-2.5">
                <Icon name="Wifi" size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-white/50">Работает в Яндекс, Chrome, Safari. Задержка ~1-2 сек.</p>
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
}
