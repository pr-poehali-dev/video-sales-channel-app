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
            Снимите товар 10 секунд
          </span>
          <div className="w-10" />
        </div>

        {/* Центр — обратный отсчёт с прогресс-кольцом */}
        {camRecording && (
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r="50" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                <circle
                  cx="56" cy="56" r="50"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (camCountdown / 10)}`}
                  style={{ transition: "stroke-dashoffset 0.2s linear" }}
                />
              </svg>
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-white font-bold text-4xl font-oswald">{camCountdown}</span>
              </div>
            </div>
            {/* Линейная шкала снизу */}
            <div className="w-48 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${((10 - camCountdown) / 10) * 100}%`, transition: "width 0.2s linear" }}
              />
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