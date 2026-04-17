import { useRef, useState, useEffect, useCallback } from "react";
import AgoraRTC, { type IAgoraRTCClient, type ILocalVideoTrack, type ILocalAudioTrack } from "agora-rtc-sdk-ng";

export function useBroadcastMedia(
  onError: (msg: string) => void,
  onStatus: (s: "idle" | "connecting" | "live" | "error") => void,
) {
  const clientRef      = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef  = useRef<ILocalVideoTrack | null>(null);
  const audioTrackRef  = useRef<ILocalAudioTrack | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement>(null);
  const facingModeRef  = useRef<"user" | "environment">("user");

  const [isMuted,  setIsMuted]  = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isFront,  setIsFront]  = useState(true);

  const attachStream = useCallback((track: ILocalVideoTrack | null) => {
    const vid = nativeVideoRef.current;
    if (!vid || !track) return;
    try {
      const ms = new MediaStream([track.getMediaStreamTrack()]);
      vid.srcObject = ms;
      vid.play().catch(() => {});
    } catch { /* ignore */ }
  }, []);

  // Инициализация камеры и микрофона
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const IS_SAFARI = ua.includes("safari") && !ua.includes("chrome");
    const CODEC = IS_SAFARI ? "h264" : "vp8";

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
        void CODEC; // used externally via ref
      } catch (e: unknown) {
        const err = e as Error;
        if (err.name === "NotAllowedError") onError("Нет доступа к камере. Разрешите в настройках браузера.");
        else onError("Ошибка камеры: " + err.message);
        onStatus("error");
      }
    })();
    return () => { videoTrack?.stop(); videoTrack?.close(); audioTrack?.stop(); audioTrack?.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (videoTrackRef.current) attachStream(videoTrackRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const flipCamera = async (isLive: boolean) => {
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
    } catch { /* ignore */ }
  };

  return {
    clientRef,
    videoTrackRef,
    audioTrackRef,
    nativeVideoRef,
    facingModeRef,
    isMuted,
    isCamOff,
    isFront,
    attachStream,
    toggleMute,
    toggleCamera,
    flipCamera,
  };
}
