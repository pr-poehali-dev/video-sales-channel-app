import { useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

const REGRU_UPLOAD_URL_API = "https://functions.poehali.dev/6aea68a2-cfc2-4613-934a-b3c3d1656fc3";

interface Props {
  camOpen: boolean;
  camRecording: boolean;
  camCountdown: number;
  camUploading: boolean;
  camVideoRef: React.RefObject<HTMLVideoElement>;
  camStreamRef: React.MutableRefObject<MediaStream | null>;
  camRecorderRef: React.MutableRefObject<MediaRecorder | null>;
  setCamOpen: (v: boolean) => void;
  setCamRecording: (v: boolean) => void;
  setCamCountdown: (v: number) => void;
  setCamUploading: (v: boolean) => void;
  setFVideoBlobUrl: (v: string | null) => void;
  setFVideoUrl: (v: string | null) => void;
  stopCamStream: () => void;
  closeCamera: () => void;
}

export default function ProductCameraModal({
  camOpen,
  camRecording,
  camCountdown,
  camUploading,
  camVideoRef,
  camStreamRef,
  camRecorderRef,
  setCamOpen,
  setCamRecording,
  setCamCountdown,
  setCamUploading,
  setFVideoBlobUrl,
  setFVideoUrl,
  stopCamStream,
  closeCamera,
}: Props) {
  const startRecording = () => {
    if (!camStreamRef.current || camRecording) return;
    const mimeType = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";
    const recorder = new MediaRecorder(camStreamRef.current, { mimeType });
    camRecorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      stopCamStream();
      setCamOpen(false);
      setCamRecording(false);
      setCamCountdown(0);
      document.body.style.overflow = "";
      const blob = new Blob(chunks, { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      setFVideoBlobUrl(blobUrl);
      setCamUploading(true);
      try {
        const contentType = mimeType.split(";")[0];
        const urlResp = await fetch(REGRU_UPLOAD_URL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content_type: contentType, folder: "products" }),
        });
        const { upload_url, cdn_url } = await urlResp.json();
        await fetch(upload_url, { method: "PUT", headers: { "Content-Type": contentType, "x-amz-acl": "public-read" }, body: blob });
        setFVideoUrl(cdn_url);
      } catch (e) { console.error("[UPLOAD_VIDEO]", e); }
      finally { setCamUploading(false); }
    };
    setCamRecording(true);
    setCamCountdown(10);
    recorder.start();
    let rem = 10;
    const tick = setInterval(() => {
      rem -= 1;
      setCamCountdown(rem);
      if (rem <= 0) { clearInterval(tick); recorder.stop(); }
    }, 1000);
  };

  if (!camOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden touch-none">
      <video
        ref={camVideoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <button onClick={closeCamera} className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
            <Icon name="X" size={18} className="text-white" />
          </button>
          <span className="text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-full">
            Снимите товар 10 секунд
          </span>
          <div className="w-10" />
        </div>

        {camRecording && (
          <div className="flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-red-500/20 border-4 border-red-500 flex items-center justify-center">
              <span className="text-white font-bold text-4xl font-oswald">{camCountdown}</span>
            </div>
          </div>
        )}
        {!camRecording && <div />}

        <div className="flex items-center justify-center pointer-events-auto pb-4">
          <button
            onClick={startRecording}
            disabled={camRecording}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-60 transition-transform active:scale-95"
          >
            {camRecording ? (
              <div className="w-10 h-10 rounded-sm bg-red-500 animate-pulse" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-red-500" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}