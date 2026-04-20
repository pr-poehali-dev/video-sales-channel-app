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
import Icon from "@/components/ui/icon";
import { useSellerProfileCheck } from "@/hooks/useSellerProfileCheck";
import type { SellerProfileIssue } from "@/hooks/useSellerProfileCheck";

const API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

interface BroadcastPageProps { setPage: (p: Page) => void; onLiveChange?: (live: boolean) => void; }

export default function BroadcastPage({ setPage, onLiveChange }: BroadcastPageProps) {
  const { user } = useAuth();
  const { addStream, updateStream, deleteStream, reload } = useStore();

  const [checkedActive, setCheckedActive] = useState<{ id: string; title: string } | null | "loading">("loading");
  const [defaultWarehouse, setDefaultWarehouse] = useState<{ cityCode: string; cityName: string; name: string } | null>(null);
  const [profileIssues, setProfileIssues] = useState<SellerProfileIssue[] | null>(null);
  const [profileExists, setProfileExists] = useState(true);
  const { check: checkProfile, checking: checkingProfile } = useSellerProfileCheck(user?.id);

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

  const handleStartBroadcast = async () => {
    const result = await checkProfile();
    if (!result.ok) {
      setProfileExists(result.profileExists);
      setProfileIssues(result.issues);
      return;
    }
    stream.startBroadcast();
  };

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
            : handleStartBroadcast
        }
      />

      {profileIssues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setProfileIssues(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Icon name="TriangleAlert" size={20} className="text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  {profileExists ? "Профиль заполнен не полностью" : "Заполните профиль продавца"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {profileExists
                    ? "Для выплат после эфира необходимо дополнить профиль"
                    : "Перед запуском эфира заполните профиль продавца"}
                </p>
              </div>
            </div>

            {profileExists && profileIssues.length > 0 && (
              <div className="bg-secondary rounded-xl p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Не заполнено:</p>
                {profileIssues.map(issue => (
                  <div key={issue.field} className="flex items-center gap-2 text-xs text-foreground">
                    <Icon name="CircleX" size={13} className="text-red-400 flex-shrink-0" />
                    {issue.label}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setProfileIssues(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => { setProfileIssues(null); setPage("dashboard"); }}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Перейти в профиль
              </button>
            </div>
          </div>
        </div>
      )}

      {checkingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl px-6 py-4 flex items-center gap-3 shadow-xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-foreground">Проверка профиля…</span>
          </div>
        </div>
      )}

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