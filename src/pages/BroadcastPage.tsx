import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useStore, type ChatMessage } from "@/context/StoreContext";
import type { Page } from "@/App";

const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type FacingMode = "user" | "environment";

async function sig(action: string, params: Record<string, unknown>) {
  const r = await fetch(`${API}?action=${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return r.json();
}

async function sigGet(action: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const r = await fetch(`${API}?${qs}`);
  return r.json();
}

// ── Чат вещателя ─────────────────────────────────────────────────────────────
function LiveChat({ streamId }: { streamId: string }) {
  const { user } = useAuth();
  const { addChatMessage, getStreamMessages } = useStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try { setMessages(await getStreamMessages(streamId)); } catch { /* ignore */ }
  }, [streamId, getStreamMessages]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
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

  const videoRef    = useRef<HTMLVideoElement>(null);
  const cameraRef   = useRef<MediaStream | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // viewerId → RTCPeerConnection
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  // ICE кандидаты которые пришли до setLocalDescription
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // последние отправленные ICE id чтобы не слать дважды
  const sentIceRef = useRef<Map<string, string>>(new Map());

  const [facingMode, setFacingMode]   = useState<FacingMode>("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isMuted, setIsMuted]         = useState(false);
  const [title, setTitle]             = useState("");
  const [isLive, setIsLive]           = useState(false);
  const [duration, setDuration]       = useState(0);
  const [finished, setFinished]       = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);

  const startCamera = useCallback(async (facing: FacingMode) => {
    setCameraError(null);
    cameraRef.current?.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
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
      else setCameraError("Ошибка камеры: " + err.message);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      cameraRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Создаём peer-соединение для нового зрителя и отправляем offer
  const connectViewer = useCallback(async (viewerId: string) => {
    const sid = streamIdRef.current;
    if (!sid || !cameraRef.current || peersRef.current.has(viewerId)) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(viewerId, pc);
    pendingIceRef.current.set(viewerId, []);

    // Добавляем все треки камеры
    cameraRef.current.getTracks().forEach(t => pc.addTrack(t, cameraRef.current!));

    // ICE кандидаты → отправляем зрителю
    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        await sig("signal_send", {
          stream_id: sid,
          viewer_id: viewerId,
          type: "ice-broadcaster",
          payload: e.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        pc.close();
        peersRef.current.delete(viewerId);
        setViewerCount(peersRef.current.size);
      }
    };

    // Создаём offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sig("signal_send", {
      stream_id: sid,
      viewer_id: viewerId,
      type: "offer",
      payload: { type: offer.type, sdp: offer.sdp },
    });

    // Применяем отложенные ICE кандидаты зрителя если пришли раньше
    const pending = pendingIceRef.current.get(viewerId) || [];
    for (const c of pending) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
    pendingIceRef.current.delete(viewerId);
  }, []);

  // Polling: новые зрители + answer + ICE от зрителей
  const poll = useCallback(async () => {
    const sid = streamIdRef.current;
    if (!sid) return;

    // Новые зрители
    const viewersResp = await sigGet("signal_get_viewers", { stream_id: sid });
    const viewers: string[] = Array.isArray(viewersResp) ? viewersResp : [];
    for (const vid of viewers) {
      if (!peersRef.current.has(vid)) {
        await connectViewer(vid);
      }
    }
    setViewerCount(peersRef.current.size);

    // Answer и ICE от каждого зрителя
    for (const [vid, pc] of peersRef.current.entries()) {
      // Answer
      if (pc.remoteDescription === null) {
        const answerResp = await sigGet("signal_get", { stream_id: sid, viewer_id: vid, type: "answer" });
        if (answerResp?.payload) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answerResp.payload));
          } catch { /* ignore */ }
        }
      }

      // ICE от зрителя
      const lastIceId = sentIceRef.current.get(`ice-viewer-${vid}`) || "";
      const ices = await sigGet("signal_ice_get", {
        stream_id: sid,
        viewer_id: vid,
        type: "ice-viewer",
        after_id: lastIceId,
      });
      if (Array.isArray(ices) && ices.length > 0) {
        for (const ice of ices) {
          try { await pc.addIceCandidate(new RTCIceCandidate(ice.payload)); } catch { /* ignore */ }
        }
        sentIceRef.current.set(`ice-viewer-${vid}`, ices[ices.length - 1].id);
      }
    }
  }, [connectViewer]);

  const startBroadcast = async () => {
    if (!title.trim() || !user || !cameraRef.current) return;
    const s = await addStream({ title: title.trim(), sellerId: user.id, sellerName: user.name, sellerAvatar: user.avatar, isLive: true, viewers: 0 });
    streamIdRef.current = s.id;
    setIsLive(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    // Polling каждые 2 сек — ищем зрителей
    pollRef.current = setInterval(poll, 2000);
  };

  const stopBroadcast = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    const dur = duration;
    setSavedDuration(dur);
    setIsLive(false);
    const sid = streamIdRef.current;

    // Закрываем все peer-соединения
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();

    // Обновляем в БД
    if (sid) {
      await updateStream(sid, { isLive: false, duration_sec: dur } as never);
      await sig("signal_cleanup", { stream_id: sid });
    }
    setFinished(true);
  };

  const switchCamera = async () => {
    const next: FacingMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    const newFacing = next;
    setCameraError(null);
    cameraRef.current?.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      cameraRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      // Обновляем треки в существующих peer-соединениях
      peersRef.current.forEach(pc => {
        const senders = pc.getSenders();
        stream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) sender.replaceTrack(track);
        });
      });
    } catch { /* ignore */ }
  };

  const toggleMute = () => {
    cameraRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
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
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button onClick={() => { setFinished(false); setTitle(""); setDuration(0); streamIdRef.current = null; setViewerCount(0); }}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">
          Начать новый эфир
        </button>
        <button onClick={() => setPage("dashboard")}
          className="border border-border text-foreground font-semibold px-6 py-3 rounded-xl hover:bg-accent">
          Перейти в кабинет
        </button>
      </div>
    </div>
  );

  // ── Основной экран ───────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-56px)] bg-black flex flex-col lg:flex-row">

      {/* Видео */}
      <div className="relative flex-1 flex items-center justify-center bg-black min-h-[55vw] max-h-[60vh] lg:min-h-0 lg:max-h-none">
        <video ref={videoRef} autoPlay muted playsInline
          className="w-full h-full object-cover"
          style={{ background: "#000", transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />

        {/* Ошибка камеры */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6 text-center">
            <div>
              <Icon name="VideoOff" size={36} className="mx-auto mb-3 text-red-400" />
              <p className="text-sm text-white/80">{cameraError}</p>
              <button onClick={() => startCamera(facingMode)} className="mt-4 text-xs text-primary underline">Попробовать снова</button>
            </div>
          </div>
        )}

        {/* LIVE бейдж */}
        {isLive && (
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
            </span>
            <span className="bg-black/60 text-white text-xs font-mono px-2 py-0.5 rounded">{fmt(duration)}</span>
            {viewerCount > 0 && (
              <span className="flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                <Icon name="Eye" size={11} />{viewerCount}
              </span>
            )}
          </div>
        )}

        {/* Кнопки управления */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
          {isLive ? (
            <button onClick={stopBroadcast}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-full text-sm transition-colors shadow-lg">
              <Icon name="Square" size={14} />
              Завершить
            </button>
          ) : (
            <button onClick={startBroadcast} disabled={!cameraReady || !title.trim()}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-5 py-2.5 rounded-full text-sm transition-colors shadow-lg">
              <span className="w-2 h-2 rounded-full bg-white" />
              Начать эфир
            </button>
          )}

          <button onClick={toggleMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-red-600 text-white" : "bg-black/60 text-white"}`}>
            <Icon name={isMuted ? "MicOff" : "Mic"} size={16} />
          </button>

          <button onClick={switchCamera}
            className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80">
            <Icon name="RefreshCw" size={16} />
          </button>
        </div>
      </div>

      {/* Боковая панель */}
      <div className="lg:w-80 xl:w-96 bg-zinc-950 border-l border-white/10 flex flex-col p-4 gap-4">

        {/* Название эфира */}
        {!isLive && (
          <div>
            <label className="text-xs text-white/60 mb-1.5 block">Название эфира</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Новая коллекция, акция..."
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary/60"
            />
          </div>
        )}

        {/* Чат */}
        {isLive && streamIdRef.current && (
          <LiveChat streamId={streamIdRef.current} />
        )}

        {/* Подсказки когда не в эфире */}
        {!isLive && (
          <div className="space-y-2">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5">
              <Icon name="Wifi" size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-white/60">Зрители смотрят вас в реальном времени прямо в браузере — без скачивания приложений</p>
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5">
              <Icon name="ShoppingBag" size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-white/60">Зрители видят ваши товары и могут купить прямо во время эфира</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
