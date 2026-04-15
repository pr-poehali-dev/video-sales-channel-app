import Icon from "@/components/ui/icon";
import AgoraRTC, { type IAgoraRTCClient, type ILocalVideoTrack, type ILocalAudioTrack } from "agora-rtc-sdk-ng";
import type { Page } from "@/App";

const AGORA_TOKEN = "https://functions.poehali.dev/a2751c9f-9c4b-4808-bf97-73f350e873a1";

const CODEC = (() => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("safari") && !ua.includes("chrome") ? "h264" : "vp8";
})();

interface ActiveStream { id: string; title: string; }

interface BroadcastScreensProps {
  type: "no-user" | "loading" | "active" | "finished";
  setPage: (p: Page) => void;
  // active screen
  checkedActive?: ActiveStream | null;
  stoppingActive?: boolean;
  audioTrackRef?: React.MutableRefObject<ILocalAudioTrack | null>;
  videoTrackRef?: React.MutableRefObject<ILocalVideoTrack | null>;
  facingModeRef?: React.MutableRefObject<"user" | "environment">;
  streamIdRef?: React.MutableRefObject<string | null>;
  clientRef?: React.MutableRefObject<IAgoraRTCClient | null>;
  attachStream?: (track: ILocalVideoTrack | null) => void;
  setCheckedActive?: (v: ActiveStream | null) => void;
  setIsLive?: (v: boolean) => void;
  setStatus?: (v: "idle" | "connecting" | "live" | "error") => void;
  setErrorMsg?: (v: string) => void;
  setTitle?: (v: string) => void;
  setDuration?: React.Dispatch<React.SetStateAction<number>>;
  timerRef?: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  setStoppingActive?: (v: boolean) => void;
  setFinished?: (v: boolean) => void;
  updateStream?: (id: string, data: Record<string, unknown>) => Promise<void>;
  // finished screen
  title?: string;
  savedDuration?: number;
  fmt?: (s: number) => string;
  onNewBroadcast?: () => void;
}

export default function BroadcastScreens({
  type,
  setPage,
  checkedActive,
  stoppingActive,
  audioTrackRef,
  videoTrackRef,
  facingModeRef,
  streamIdRef,
  clientRef,
  attachStream,
  setCheckedActive,
  setIsLive,
  setStatus,
  setErrorMsg,
  setTitle,
  setDuration,
  timerRef,
  setStoppingActive,
  setFinished,
  updateStream,
  title,
  savedDuration,
  fmt,
  onNewBroadcast,
}: BroadcastScreensProps) {
  if (type === "no-user") return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <Icon name="Video" size={36} className="mx-auto mb-4 text-muted-foreground opacity-40" />
      <h2 className="font-oswald text-xl font-semibold mb-2">Войдите в аккаунт</h2>
      <p className="text-sm text-muted-foreground mb-5">Чтобы вести эфиры, необходимо войти</p>
      <button onClick={() => setPage("auth")} className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">Войти</button>
    </div>
  );

  if (type === "loading") return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <Icon name="Loader" size={32} className="mx-auto text-muted-foreground animate-spin" />
    </div>
  );

  if (type === "active" && checkedActive) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
        <Icon name="Radio" size={40} className="text-red-500" />
      </div>
      <h2 className="font-oswald text-2xl font-semibold mb-2">Эфир идёт прямо сейчас</h2>
      <p className="text-sm text-muted-foreground mb-1">«{checkedActive.title}»</p>
      <p className="text-sm text-muted-foreground mb-6">Нажмите «Вернуться в эфир» чтобы продолжить управление</p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button
          onClick={async () => {
            if (!setStatus || !setTitle || !streamIdRef || !audioTrackRef || !videoTrackRef || !facingModeRef || !attachStream || !setCheckedActive || !setIsLive || !setErrorMsg || !timerRef || !setDuration) return;
            setStatus("connecting");
            setTitle(checkedActive.title);
            streamIdRef.current = checkedActive.id;
            try {
              if (!audioTrackRef.current || !videoTrackRef.current) {
                const [at, vt] = await AgoraRTC.createMicrophoneAndCameraTracks(
                  { encoderConfig: "speech_standard" },
                  { encoderConfig: { width: 640, height: 360, frameRate: 15, bitrateMax: 600 }, optimizationMode: "motion", facingMode: facingModeRef.current }
                );
                audioTrackRef.current = at;
                videoTrackRef.current = vt;
                attachStream(vt);
              }
              const tokenResp = await fetch(`${AGORA_TOKEN}?channel=${checkedActive.id}&uid=1&role=publisher`);
              const tokenData = await tokenResp.json();
              const client = AgoraRTC.createClient({ mode: "live", codec: CODEC });
              if (clientRef) clientRef.current = client;
              await client.setClientRole("host");
              await client.join(tokenData.appId, checkedActive.id, tokenData.token, 1);
              await client.publish([audioTrackRef.current!, videoTrackRef.current!]);
              setCheckedActive(null);
              setIsLive(true);
              setStatus("live");
              timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
            } catch (e: unknown) {
              setStatus("error");
              setErrorMsg((e as Error).message);
            }
          }}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
          Вернуться в эфир
        </button>
        <button
          onClick={async () => {
            if (!setStoppingActive || !setCheckedActive || !setFinished || !setTitle || !updateStream) return;
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
          className="border border-red-500/40 text-red-500 font-semibold px-6 py-3 rounded-xl hover:bg-red-500/10 flex items-center justify-center gap-2 disabled:opacity-60">
          {stoppingActive ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name="Square" size={16} />}
          Завершить эфир
        </button>
        <button onClick={() => setPage("dashboard")}
          className="border border-border font-semibold px-6 py-3 rounded-xl hover:bg-accent">Назад в кабинет</button>
      </div>
    </div>
  );

  if (type === "finished") return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
        <Icon name="CheckCircle" size={40} className="text-primary" />
      </div>
      <h2 className="font-oswald text-2xl font-semibold mb-2">Эфир завершён!</h2>
      <p className="text-sm text-muted-foreground mb-1">«{title}»</p>
      <p className="text-sm text-muted-foreground mb-6">Длительность: {fmt ? fmt(savedDuration ?? 0) : ""}</p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button onClick={onNewBroadcast}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">Новый эфир</button>
        <button onClick={() => setPage("dashboard")}
          className="border border-border font-semibold px-6 py-3 rounded-xl hover:bg-accent">Кабинет</button>
      </div>
    </div>
  );

  return null;
}