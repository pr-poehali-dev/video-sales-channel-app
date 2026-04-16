import { useState, useRef, useEffect, useCallback } from "react";
import AgoraRTC, { type IAgoraRTCClient, type ILocalVideoTrack, type ILocalAudioTrack } from "agora-rtc-sdk-ng";
import { useAuth } from "@/context/AuthContext";
import { useStore, type ChatMessage } from "@/context/StoreContext";
import type { Page } from "@/App";
import QuickVideoProductModal from "./broadcast/QuickVideoProductModal";
import BroadcastScreens from "./broadcast/BroadcastScreens";
import BroadcastLiveView from "./broadcast/BroadcastLiveView";

const AGORA_TOKEN = "https://functions.poehali.dev/a2751c9f-9c4b-4808-bf97-73f350e873a1";
const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

AgoraRTC.setLogLevel(3);

const ua = navigator.userAgent.toLowerCase();
const IS_SAFARI = ua.includes("safari") && !ua.includes("chrome");
const CODEC = IS_SAFARI ? "h264" : "vp8";
const CLIENT_MODE = IS_SAFARI ? "rtc" : "live";

interface BroadcastPageProps { setPage: (p: Page) => void; onLiveChange?: (live: boolean) => void; }

export default function BroadcastPage({ setPage, onLiveChange }: BroadcastPageProps) {
  const { user } = useAuth();
  const { addStream, updateStream, deleteStream, reload } = useStore();

  const [checkedActive, setCheckedActive] = useState<{id: string; title: string} | null | "loading">("loading");

  useEffect(() => {
    if (!user) { setCheckedActive(null); return; }
    reload().then(() => {
      fetch(`${API}?action=get_streams`)
        .then(r => r.json())
        .then((all: Array<{sellerId: string; isLive: boolean; id: string; title: string}>) => {
          const found = all.find(s => s.sellerId === user.id && s.isLive);
          if (found) {
            setCheckedActive(found);
            autoRejoin(found);
          } else {
            setCheckedActive(null);
          }
        })
        .catch(() => setCheckedActive(null));
    });
  }, [user?.id]);

  const autoRejoin = async (stream: {id: string; title: string}) => {
    setStatus("connecting");
    setTitle(stream.title);
    streamIdRef.current = stream.id;
    try {
      for (let i = 0; i < 50; i++) {
        if (audioTrackRef.current && videoTrackRef.current) break;
        await new Promise(res => setTimeout(res, 200));
      }
      const tokenResp = await fetch(`${AGORA_TOKEN}?channel=${stream.id}&uid=1&role=publisher`);
      const tokenData = await tokenResp.json();
      const client = AgoraRTC.createClient({ mode: CLIENT_MODE, codec: CODEC });
      clientRef.current = client;
      if (CLIENT_MODE === "live") await client.setClientRole("host");
      client.startProxyServer(3);
      await Promise.race([
        client.join(tokenData.appId, stream.id, tokenData.token, 1),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Таймаут подключения 30с. Проверьте интернет-соединение")), 30000)),
      ]);
      if (audioTrackRef.current && videoTrackRef.current) {
        await client.publish([audioTrackRef.current, videoTrackRef.current]);
      }
      setCheckedActive(null);
      setIsLive(true);
      onLiveChange?.(true);
      setStatus("live");
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      startAutoRecord(stream.id);
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg((e as Error).message);
      setCheckedActive(null);
    }
  };

  const clientRef      = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef  = useRef<ILocalVideoTrack | null>(null);
  const audioTrackRef  = useRef<ILocalAudioTrack | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement>(null);
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

  // Видео-товар
  const [quickProductVideo, setQuickProductVideo] = useState<string | null>(null);
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoCountdown, setVideoCountdown] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const autoRecorderRef = useRef<MediaRecorder | null>(null);
  const autoRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [defaultWarehouse, setDefaultWarehouse] = useState<{ cityCode: number; cityName: string; name: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`${API}?action=get_warehouses&seller_id=${user.id}`)
      .then(r => r.json())
      .then((list: Array<{ cityCode: number; cityName: string; name: string; isDefault: boolean }>) => {
        const def = list.find(w => w.isDefault) ?? list[0] ?? null;
        setDefaultWarehouse(def);
      })
      .catch(() => {});
  }, [user?.id]);

  const refreshChat = useCallback(async () => {
    if (!streamIdRef.current) return;
    try { setChatMessages(await getStreamMessages(streamIdRef.current)); } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoRecordTimerRef.current) clearTimeout(autoRecordTimerRef.current);
      if (autoRecorderRef.current && autoRecorderRef.current.state === "recording") {
        try { autoRecorderRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

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

  const captureVideo = () => {
    const vid = nativeVideoRef.current;
    if (!vid || videoRecording) return;
    const stream = vid.srcObject as MediaStream | null;
    if (!stream) return;
    const mimeType = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 100000 });
    mediaRecorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setQuickProductVideo(url);
      setVideoRecording(false);
      setVideoCountdown(0);
    };
    setVideoRecording(true);
    setVideoCountdown(5);
    recorder.start();
    let remaining = 5;
    const tick = setInterval(() => {
      remaining -= 1;
      setVideoCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        recorder.stop();
      }
    }, 1000);
  };

  const startAutoRecord = useCallback((streamId: string) => {
    autoRecordTimerRef.current = setTimeout(() => {
      const vid = nativeVideoRef.current;
      if (!vid) return;
      const ms = vid.srcObject as MediaStream | null;
      if (!ms) return;
      const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
        ? "video/mp4;codecs=avc1"
        : MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";
      try {
        const recorder = new MediaRecorder(ms, { mimeType, videoBitsPerSecond: 150000 });
        autoRecorderRef.current = recorder;
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = async () => {
          autoRecorderRef.current = null;
          const blob = new Blob(chunks, { type: mimeType });
          console.log("[autoRecord] blob size:", blob.size, "type:", mimeType);
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = reader.result as string;
            console.log("[autoRecord] dataUrl length:", dataUrl.length, "streamId:", streamId);
            try {
              const resp = await fetch(`${API}?action=upload_video`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data_url: dataUrl, stream_id: streamId, folder: "streams" }),
              });
              const result = await resp.json();
              console.log("[autoRecord] upload result:", result);
            } catch (e) {
              console.error("[autoRecord] upload error:", e);
            }
          };
          reader.readAsDataURL(blob);
        };
        recorder.start();
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 20000);
      } catch (e) {
        console.error("[autoRecord] recorder error:", e);
      }
    }, 3000);
  }, []);

  const startBroadcast = async () => {
    if (!title.trim() || !user) return;
    setStatus("connecting");
    setErrorMsg("");
    let createdStreamId: string | null = null;
    try {
      try {
        const allResp = await fetch(`${API}?action=get_streams`);
        const allStreams: Array<{sellerId: string; seller_id?: string; isLive: boolean; is_live?: boolean; id: string}> = await allResp.json();
        const active = allStreams.filter(s => (s.sellerId === user.id || s.seller_id === user.id) && (s.isLive || s.is_live));
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

      const client = AgoraRTC.createClient({ mode: CLIENT_MODE, codec: CODEC });
      clientRef.current = client;
      if (CLIENT_MODE === "live") await client.setClientRole("host");
      client.startProxyServer(3);

      await Promise.race([
        client.join(tokenData.appId, s.id, tokenData.token, 1),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Таймаут подключения 30с. Проверьте интернет-соединение")), 30000)),
      ]);

      if (audioTrackRef.current && videoTrackRef.current) {
        await client.publish([audioTrackRef.current, videoTrackRef.current]);
      }

      setIsLive(true);
      onLiveChange?.(true);
      setStatus("live");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      startAutoRecord(s.id);

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
      try { await clientRef.current?.leave(); } catch { /* ignore */ }
      clientRef.current = null;
      if (createdStreamId) {
        streamIdRef.current = null;
        try { await deleteStream(createdStreamId); } catch { /* ignore */ }
      }
    }
  };

  const stopBroadcast = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoRecordTimerRef.current) { clearTimeout(autoRecordTimerRef.current); autoRecordTimerRef.current = null; }
    if (autoRecorderRef.current && autoRecorderRef.current.state === "recording") {
      autoRecorderRef.current.stop();
    }
    if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; }
    const dur = duration;
    setSavedDuration(dur);
    try { await clientRef.current?.leave(); } catch { /* ignore */ }
    clientRef.current = null;
    const sid = streamIdRef.current;
    streamIdRef.current = null;
    if (sid) await updateStream(sid, { isLive: false, duration_sec: dur } as never);
    setIsLive(false);
    onLiveChange?.(false);
    setStatus("idle");
    setFinished(true);
    setTimeout(() => reload(), 25000);
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
    try {
      if (clientRef.current && isLive && oldTrack) {
        try { await clientRef.current.unpublish([oldTrack]); } catch { /* ignore */ }
      }
      if (oldTrack) { oldTrack.stop(); oldTrack.close(); }
      videoTrackRef.current = null;
      const newTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: { width: 640, height: 360, frameRate: 15, bitrateMax: 600 },
        optimizationMode: "motion",
        facingMode: newFacing,
      });
      videoTrackRef.current = newTrack;
      if (clientRef.current && isLive) {
        await clientRef.current.publish([newTrack]);
      }
      attachStream(newTrack);
    } catch { /* игнор */ }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;

  // ── Экраны-заглушки ──────────────────────────────────────────────────────────
  if (!user) return <BroadcastScreens type="no-user" setPage={setPage} />;

  if (checkedActive === "loading" && !isLive) return <BroadcastScreens type="loading" setPage={setPage} />;


  if (finished) return (
    <BroadcastScreens
      type="finished"
      setPage={setPage}
      title={title}
      savedDuration={savedDuration}
      fmt={fmt}
      onNewBroadcast={() => { setFinished(false); setTitle(""); setDuration(0); streamIdRef.current = null; setStatus("idle"); setChatMessages([]); }}
    />
  );

  return (
    <>
      <BroadcastLiveView
        nativeVideoRef={nativeVideoRef}
        status={status}
        errorMsg={errorMsg}
        isLive={isLive}
        duration={duration}
        fmt={fmt}
        isMuted={isMuted}
        isCamOff={isCamOff}
        videoRecording={videoRecording}
        videoCountdown={videoCountdown}
        chatVisible={chatVisible}
        chatMessages={chatMessages}
        chatInput={chatInput}
        chatSending={chatSending}
        chatEndRef={chatEndRef}
        title={title}
        customThumb={customThumb}
        thumbInputRef={thumbInputRef}
        thumbUploading={thumbUploading}
        setPage={setPage}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onFlipCamera={flipCamera}
        onStopBroadcast={stopBroadcast}
        onCaptureVideo={captureVideo}
        onSendChat={sendChat}
        onChatInputChange={setChatInput}
        onChatInputKeyDown={e => e.key === "Enter" && sendChat()}
        onToggleChatVisible={() => setChatVisible(v => !v)}
        onTitleChange={setTitle}
        onThumbFileChange={handleThumbFile}
        onStartBroadcast={status === "error" ? () => { setStatus("idle"); setErrorMsg(""); } : startBroadcast}
      />

      {/* ── Модалка видео-товара ── */}
      {quickProductVideo && user && (
        <QuickVideoProductModal
          videoBlobUrl={quickProductVideo}
          sellerId={user.id}
          sellerName={user.name}
          sellerAvatar={user.avatar}
          defaultWarehouse={defaultWarehouse}
          onClose={() => { URL.revokeObjectURL(quickProductVideo); setQuickProductVideo(null); }}
          onSaved={() => { URL.revokeObjectURL(quickProductVideo); setQuickProductVideo(null); }}
        />
      )}
    </>
  );
}