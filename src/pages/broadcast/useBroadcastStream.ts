import { useRef, useState, useCallback } from "react";
import AgoraRTC, { type IAgoraRTCClient, type ILocalVideoTrack, type ILocalAudioTrack } from "agora-rtc-sdk-ng";
import type { MutableRefObject } from "react";

const AGORA_TOKEN = "https://functions.poehali.dev/a2751c9f-9c4b-4808-bf97-73f350e873a1";
const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

const ua = navigator.userAgent.toLowerCase();
const IS_SAFARI = ua.includes("safari") && !ua.includes("chrome");
const CODEC = IS_SAFARI ? "h264" : "vp8";
const CLIENT_MODE = IS_SAFARI ? "rtc" : "live";

interface UseBroadcastStreamOptions {
  clientRef: MutableRefObject<IAgoraRTCClient | null>;
  videoTrackRef: MutableRefObject<ILocalVideoTrack | null>;
  audioTrackRef: MutableRefObject<ILocalAudioTrack | null>;
  nativeVideoRef: MutableRefObject<HTMLVideoElement | null>;
  streamIdRef: MutableRefObject<string | null>;
  autoRecorderRef: MutableRefObject<MediaRecorder | null>;
  autoRecordTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  timerRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  userId: string;
  userName: string;
  userAvatar: string;
  addStream: (data: {
    title: string; sellerId: string; sellerName: string; sellerAvatar: string; isLive: boolean; viewers: number;
  }) => Promise<{ id: string }>;
  updateStream: (id: string, data: object) => Promise<void>;
  deleteStream: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  onLiveChange?: (live: boolean) => void;
}

export function useBroadcastStream(opts: UseBroadcastStreamOptions) {
  const {
    clientRef, videoTrackRef, audioTrackRef, nativeVideoRef,
    streamIdRef, autoRecorderRef, autoRecordTimerRef, timerRef,
    userId, userName, userAvatar,
    addStream, updateStream, deleteStream, reload, onLiveChange,
  } = opts;

  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [title,          setTitle]          = useState("");
  const [isLive,         setIsLive]         = useState(false);
  const [duration,       setDuration]       = useState(0);
  const [finished,       setFinished]       = useState(false);
  const [savedDuration,  setSavedDuration]  = useState(0);
  const [status,         setStatus]         = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [errorMsg,       setErrorMsg]       = useState("");
  const [customThumb,    setCustomThumb]    = useState<string | null>(null);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoCountdown, setVideoCountdown] = useState(0);
  const [quickProductVideo, setQuickProductVideo] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

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
        const recorder = new MediaRecorder(ms, { mimeType, videoBitsPerSecond: 800000 });
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
        recorder.start(500);
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 20000);
      } catch (e) {
        console.error("[autoRecord] recorder error:", e);
      }
    }, 3000);
  }, [autoRecordTimerRef, autoRecorderRef, nativeVideoRef]);

  const autoRejoin = useCallback(async (stream: { id: string; title: string }) => {
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
      setIsLive(true);
      onLiveChange?.(true);
      setStatus("live");
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      startAutoRecord(stream.id);
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg((e as Error).message);
    }
  }, [audioTrackRef, videoTrackRef, clientRef, streamIdRef, timerRef, onLiveChange, startAutoRecord]);

  const startBroadcast = async () => {
    if (!title.trim()) return;
    setStatus("connecting");
    setErrorMsg("");
    let createdStreamId: string | null = null;
    try {
      try {
        const allResp = await fetch(`${API}?action=get_streams`);
        const allStreams: Array<{ sellerId: string; seller_id?: string; isLive: boolean; is_live?: boolean; id: string }> = await allResp.json();
        const active = allStreams.filter(s => (s.sellerId === userId || s.seller_id === userId) && (s.isLive || s.is_live));
        for (const st of active) {
          await updateStream(st.id, { isLive: false });
        }
      } catch { /* ignore */ }

      const s = await addStream({ title: title.trim(), sellerId: userId, sellerName: userName, sellerAvatar: userAvatar, isLive: true, viewers: 0 });
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

  const stopBroadcast = async (duration: number) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoRecordTimerRef.current) { clearTimeout(autoRecordTimerRef.current); autoRecordTimerRef.current = null; }
    if (autoRecorderRef.current && autoRecorderRef.current.state === "recording") {
      autoRecorderRef.current.stop();
    }
    const dur = duration;
    setSavedDuration(dur);
    try { await clientRef.current?.leave(); } catch { /* ignore */ }
    clientRef.current = null;
    const sid = streamIdRef.current;
    streamIdRef.current = null;
    if (sid) await updateStream(sid, { isLive: false, duration_sec: dur });
    setIsLive(false);
    onLiveChange?.(false);
    setStatus("idle");
    setFinished(true);
    setTimeout(() => reload(), 25000);
  };

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
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 500000 });
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
    setVideoCountdown(6);
    recorder.start(500);
    let remaining = 6;
    const tick = setInterval(() => {
      remaining -= 1;
      setVideoCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        recorder.stop();
      }
    }, 1000);
  };

  const resetAfterFinish = () => {
    setFinished(false);
    setTitle("");
    setDuration(0);
    streamIdRef.current = null;
    setStatus("idle");
  };

  return {
    thumbInputRef,
    title, setTitle,
    isLive,
    duration, setDuration,
    finished,
    savedDuration,
    status, setStatus,
    errorMsg, setErrorMsg,
    customThumb,
    thumbUploading,
    videoRecording,
    videoCountdown,
    quickProductVideo, setQuickProductVideo,
    autoRejoin,
    startBroadcast,
    stopBroadcast,
    handleThumbFile,
    captureVideo,
    resetAfterFinish,
  };
}
