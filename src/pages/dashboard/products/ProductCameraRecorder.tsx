import { createPortal } from "react-dom";
import type { RefObject } from "react";
import Icon from "@/components/ui/icon";

interface ProductCameraRecorderProps {
  camVideoRef: RefObject<HTMLVideoElement>;
  camRecording: boolean;
  camCountdown: number;
  onClose: () => void;
  onStartRecording: () => void;
}

export default function ProductCameraRecorder({
  camVideoRef,
  camRecording,
  camCountdown,
  onClose,
  onStartRecording,
}: ProductCameraRecorderProps) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#000", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Видео с камеры */}
      <video
        ref={camVideoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Оверлей управления */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
        {/* Верх */}
        <div className="flex items-center justify-between pointer-events-auto">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
            <Icon name="X" size={18} className="text-white" />
          </button>
          <span className="text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-full">
            Снимите товар 5 секунд
          </span>
          <div className="w-10" />
        </div>

        {/* Центр — обратный отсчёт */}
        {camRecording && (
          <div className="flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-red-500/20 border-4 border-red-500 flex items-center justify-center">
              <span className="text-white font-bold text-4xl font-oswald">{camCountdown}</span>
            </div>
          </div>
        )}
        {!camRecording && <div />}

        {/* Низ — кнопка записи */}
        <div className="flex items-center justify-center pointer-events-auto pb-4">
          <button
            onClick={onStartRecording}
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
    </div>,
    document.body
  );
}
