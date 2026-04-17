import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { Page } from "@/App";
import QuickVideoProductModal from "./broadcast/QuickVideoProductModal";
import BroadcastScreens from "./broadcast/BroadcastScreens";
import BroadcastLiveView from "./broadcast/BroadcastLiveView";
import { useBroadcastMedia } from "./broadcast/useBroadcastMedia";
import { useBroadcastStream } from "./broadcast/useBroadcastStream";
import { useBroadcastChat } from "./broadcast/useBroadcastChat";

const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

interface BroadcastPageProps { setPage: (p: Page) => void; onLiveChange?: (live: boolean) => void; }

export default function BroadcastPage({ setPage, onLiveChange }: BroadcastPageProps) {
  const { user } = useAuth();
  const { addStream, updateStream, deleteStream, reload } = useStore();

  const [checkedActive, setCheckedActive] = useState<{ id: string; title: string } | null | "loading">("loading");
  const [defaultWarehouse, setDefaultWarehouse] = useState<{ cityCode: string; cityName: string; name: string } | null>(null);

  // Shared refs (passed into multiple hooks)
  const streamIdRef        = useRef<string | null>(null);
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRecorderRef    = useRef<MediaRecorder | null>(null);
  const autoRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Media hook ─────────────────────────────────────────────────────────────
  const media = useBroadcastMedia(
    (msg) => stream.setErrorMsg(msg),
    (s)   => stream.setStatus(s),
  );

  // ── Stream hook ────────────────────────────────────────────────────────────
  const stream = useBroadcastStream({
    clientRef:        media.clientRef,
    videoTrackRef:    media.videoTrackRef,
    audioTrackRef:    media.audioTrackRef,
    nativeVideoRef:   media.nativeVideoRef,
    streamIdRef,
    autoRecorderRef,
    autoRecordTimerRef,
    timerRef,
    userId:      user?.id      ?? "",
    userName:    user?.name    ?? "",
    userAvatar:  user?.avatar  ?? "",
    addStream:   addStream as never,
    updateStream: updateStream as never,
    deleteStream,
    reload,
    onLiveChange,
  });

  // ── Chat hook ──────────────────────────────────────────────────────────────
  const chat = useBroadcastChat({
    isLive:      stream.isLive,
    streamIdRef,
    userId:      user?.id     ?? "",
    userName:    user?.name   ?? "",
    userAvatar:  user?.avatar ?? "",
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoRecordTimerRef.current) clearTimeout(autoRecordTimerRef.current);
      if (autoRecorderRef.current && autoRecorderRef.current.state === "recording") {
        try { autoRecorderRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  // ── Check active stream on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!user) { setCheckedActive(null); return; }
    reload().then(() => {
      fetch(`${API}?action=get_streams`)
        .then(r => r.json())
        .then((all: Array<{ sellerId: string; isLive: boolean; id: string; title: string }>) => {
          const found = all.find(s => s.sellerId === user.id && s.isLive);
          if (found) {
            setCheckedActive(found);
            stream.autoRejoin(found).then(() => setCheckedActive(null));
          } else {
            setCheckedActive(null);
          }
        })
        .catch(() => setCheckedActive(null));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Default warehouse ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetch(`${API}?action=get_warehouses&seller_id=${user.id}`)
      .then(r => r.json())
      .then((list: Array<{ cityCode: string; cityName: string; name: string; isDefault: boolean }>) => {
        const def = list.find(w => w.isDefault) ?? list[0] ?? null;
        setDefaultWarehouse(def);
      })
      .catch(() => {});
  }, [user?.id]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Guard screens ─────────────────────────────────────────────────────────
  if (!user) return <BroadcastScreens type="no-user" setPage={setPage} />;
  if (checkedActive === "loading" && !stream.isLive) return <BroadcastScreens type="loading" setPage={setPage} />;

  if (stream.finished) return (
    <BroadcastScreens
      type="finished"
      setPage={setPage}
      title={stream.title}
      savedDuration={stream.savedDuration}
      fmt={fmt}
      onNewBroadcast={() => {
        stream.resetAfterFinish();
        chat.resetChat();
      }}
    />
  );

  return (
    <>
      <BroadcastLiveView
        nativeVideoRef={media.nativeVideoRef}
        status={stream.status}
        errorMsg={stream.errorMsg}
        isLive={stream.isLive}
        duration={stream.duration}
        fmt={fmt}
        isMuted={media.isMuted}
        isCamOff={media.isCamOff}
        videoRecording={stream.videoRecording}
        videoCountdown={stream.videoCountdown}
        chatVisible={chat.chatVisible}
        chatMessages={chat.chatMessages}
        chatInput={chat.chatInput}
        chatSending={chat.chatSending}
        chatEndRef={chat.chatEndRef}
        title={stream.title}
        customThumb={stream.customThumb}
        thumbInputRef={stream.thumbInputRef}
        thumbUploading={stream.thumbUploading}
        setPage={setPage}
        onToggleMute={media.toggleMute}
        onToggleCamera={media.toggleCamera}
        onFlipCamera={() => media.flipCamera(stream.isLive)}
        onStopBroadcast={() => stream.stopBroadcast(stream.duration)}
        onCaptureVideo={stream.captureVideo}
        onSendChat={chat.sendChat}
        onChatInputChange={chat.setChatInput}
        onChatInputKeyDown={e => e.key === "Enter" && chat.sendChat()}
        onToggleChatVisible={() => chat.setChatVisible(v => !v)}
        onTitleChange={stream.setTitle}
        onThumbFileChange={stream.handleThumbFile}
        onStartBroadcast={
          stream.status === "error"
            ? () => { stream.setStatus("idle"); stream.setErrorMsg(""); }
            : stream.startBroadcast
        }
      />

      {stream.quickProductVideo && user && (
        <QuickVideoProductModal
          videoBlobUrl={stream.quickProductVideo}
          sellerId={user.id}
          sellerName={user.name}
          sellerAvatar={user.avatar}
          defaultWarehouse={defaultWarehouse}
          onClose={() => { URL.revokeObjectURL(stream.quickProductVideo!); stream.setQuickProductVideo(null); }}
          onSaved={() => { URL.revokeObjectURL(stream.quickProductVideo!); stream.setQuickProductVideo(null); }}
        />
      )}
    </>
  );
}
