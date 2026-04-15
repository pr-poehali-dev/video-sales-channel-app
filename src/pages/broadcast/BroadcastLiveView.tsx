import { useRef } from "react";
import Icon from "@/components/ui/icon";
import type { ChatMessage } from "@/context/StoreContext";
import type { Page } from "@/App";

interface BroadcastLiveViewProps {
  nativeVideoRef: React.RefObject<HTMLVideoElement>;
  status: "idle" | "connecting" | "live" | "error";
  errorMsg: string;
  isLive: boolean;
  duration: number;
  fmt: (s: number) => string;
  isMuted: boolean;
  isCamOff: boolean;
  videoRecording: boolean;
  videoCountdown: number;
  chatVisible: boolean;
  chatMessages: ChatMessage[];
  chatInput: string;
  chatSending: boolean;
  chatEndRef: React.RefObject<HTMLDivElement>;
  title: string;
  customThumb: string | null;
  thumbInputRef: React.RefObject<HTMLInputElement>;
  thumbUploading: boolean;
  setPage: (p: Page) => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onStopBroadcast: () => void;
  onCaptureVideo: () => void;
  onSendChat: () => void;
  onChatInputChange: (v: string) => void;
  onChatInputKeyDown: (e: React.KeyboardEvent) => void;
  onToggleChatVisible: () => void;
  onTitleChange: (v: string) => void;
  onThumbFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartBroadcast: () => void;
}

export default function BroadcastLiveView({
  nativeVideoRef,
  status,
  errorMsg,
  isLive,
  duration,
  fmt,
  isMuted,
  isCamOff,
  videoRecording,
  videoCountdown,
  chatVisible,
  chatMessages,
  chatInput,
  chatSending,
  chatEndRef,
  title,
  customThumb,
  thumbInputRef,
  setPage,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
  onStopBroadcast,
  onCaptureVideo,
  onSendChat,
  onChatInputChange,
  onChatInputKeyDown,
  onToggleChatVisible,
  onTitleChange,
  onThumbFileChange,
  onStartBroadcast,
}: BroadcastLiveViewProps) {
  return (
    <div className="fixed inset-0 bg-black" style={{ zIndex: 40 }}>

      {/* ── ВИДЕО на весь экран ── */}
      <video
        ref={nativeVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ background: "#000" }}
      />

      {/* Ошибка камеры */}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6 text-center z-10">
          <div>
            <Icon name="VideoOff" size={36} className="mx-auto mb-3 text-red-400" />
            <p className="text-sm text-white/80 mb-4">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ── ШАПКА ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-3 z-20"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}>
        <button onClick={() => setPage("streams")}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
          <Icon name="ArrowLeft" size={18} className="text-white" />
        </button>

        <div className="flex items-center gap-2">
          {isLive && (
            <>
              <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse" />LIVE
              </span>
              <span className="bg-black/60 text-white text-xs font-mono px-2 py-1 rounded-lg">{fmt(duration)}</span>
            </>
          )}
          {status === "connecting" && (
            <div className="flex items-center gap-1.5 bg-black/60 text-white/70 text-xs px-3 py-1.5 rounded-full">
              <Icon name="Loader" size={12} className="animate-spin" />Подключение...
            </div>
          )}
        </div>

        {isLive && (
          <div className="flex items-center gap-2">
            <button
              onClick={onCaptureVideo}
              disabled={videoRecording}
              className="relative w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center shadow-lg disabled:opacity-80"
              title="Снять 5-сек видео и добавить товар"
            >
              {videoRecording ? (
                <span className="text-white font-bold text-sm leading-none">{videoCountdown}</span>
              ) : (
                <Icon name="Video" size={17} className="text-white" />
              )}
              {videoRecording && (
                <span className="absolute inset-0 rounded-full border-2 border-white animate-ping opacity-60" />
              )}
            </button>
            <button
              onClick={onStopBroadcast}
              className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
            >
              <Icon name="Square" size={11} />
              Стоп
            </button>
          </div>
        )}
        {!isLive && <div className="w-9 h-9" />}
      </div>

      {/* ── ЧАТ ПОВЕРХ ВИДЕО (только в эфире) ── */}
      {isLive && (
        <div className="absolute bottom-0 left-0 right-0 z-20"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 60%, transparent)" }}>

          {chatVisible && (
            <div className="px-3 pt-3 pb-1 space-y-1.5 overflow-y-auto" style={{ maxHeight: 150 }}>
              {chatMessages.length === 0
                ? <p className="text-[11px] text-white/30 text-center">Пока тихо...</p>
                : chatMessages.map(m => (
                  <div key={m.id} className="flex items-start gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-white/20 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {m.userAvatar}
                    </div>
                    <p className="text-xs text-white leading-snug">
                      <span className="font-bold text-primary/90">{m.userName} </span>
                      <span className="text-white/80">{m.text}</span>
                    </p>
                  </div>
                ))
              }
              <div ref={chatEndRef} />
            </div>
          )}

          <div className="px-3 pt-1 pb-2">
            <div className="flex gap-2 items-center">
              <input
                value={chatInput}
                onChange={e => onChatInputChange(e.target.value)}
                onKeyDown={onChatInputKeyDown}
                placeholder="Написать в чат..."
                maxLength={200}
                className="flex-1 bg-black/50 backdrop-blur border border-white/20 rounded-full px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/40"
                style={{ fontSize: 16 }}
              />
              <button onClick={onSendChat} disabled={!chatInput.trim() || chatSending}
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                {chatSending ? <Icon name="Loader" size={14} className="animate-spin" /> : <Icon name="Send" size={14} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 px-4" style={{ paddingBottom: "calc(56px + 1.25rem + env(safe-area-inset-bottom, 0px))" }}>
            <button
              onClick={onToggleChatVisible}
              className="flex items-center gap-1.5 bg-black/50 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full"
            >
              <Icon name={chatVisible ? "MessageCircleOff" : "MessageCircle"} size={13} />
              {chatVisible ? "Скрыть чат" : "Чат"}
            </button>

            <div className="flex items-center justify-center gap-3 w-full">
              <button onClick={onToggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
                <Icon name={isMuted ? "MicOff" : "Mic"} size={18} className="text-white" />
              </button>

              <button onClick={onStopBroadcast}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-full text-sm shadow-lg transition-colors">
                <Icon name="Square" size={15} />Завершить
              </button>

              <button onClick={onToggleCamera}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCamOff ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
                <Icon name={isCamOff ? "VideoOff" : "Video"} size={18} className="text-white" />
              </button>

              <button onClick={onFlipCamera} disabled={isCamOff}
                className="w-12 h-12 rounded-full bg-black/60 backdrop-blur border border-white/20 flex items-center justify-center disabled:opacity-30 transition-colors">
                <Icon name="RefreshCw" size={18} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── НЕ В ЭФИРЕ: форма запуска ── */}
      {!isLive && (
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4"
          style={{ paddingBottom: "calc(56px + 2rem + env(safe-area-inset-bottom, 0px))", background: "linear-gradient(to top, rgba(0,0,0,0.85) 70%, transparent)" }}>

          <div className="flex flex-col gap-2 mb-4">
            <input value={title} onChange={e => onTitleChange(e.target.value)} maxLength={80}
              placeholder="Название эфира..."
              className="w-full bg-black/60 backdrop-blur border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary/60"
              style={{ fontSize: 16 }}
            />
            <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={onThumbFileChange} />
            <button
              onClick={() => thumbInputRef.current?.click()}
              className="flex items-center gap-2 bg-black/60 backdrop-blur border border-white/20 rounded-xl px-4 py-2 text-xs text-white/70 hover:text-white hover:border-white/40 transition-colors w-full"
            >
              {customThumb
                ? <><img src={customThumb} className="w-5 h-5 rounded object-cover flex-shrink-0" /><span className="truncate">Превью загружено — нажми чтобы сменить</span></>
                : <><Icon name="Image" size={14} className="flex-shrink-0" /><span>Загрузить превью (необязательно)</span></>
              }
            </button>
          </div>

          {errorMsg && (
            <div className="mb-3 bg-black/80 border border-red-500/50 rounded-xl px-4 py-2.5 text-xs text-red-400 text-center">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            <button onClick={onToggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
              <Icon name={isMuted ? "MicOff" : "Mic"} size={18} className="text-white" />
            </button>

            <button
              onClick={status === "error" ? onStartBroadcast : onStartBroadcast}
              disabled={!title.trim() || status === "connecting"}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold px-8 py-3.5 rounded-full text-sm shadow-lg transition-colors">
              {status === "connecting"
                ? <><Icon name="Loader" size={16} className="animate-spin" />Подключение...</>
                : status === "error"
                ? <><Icon name="RefreshCw" size={16} />Повторить</>
                : <><span className="w-2.5 h-2.5 rounded-full bg-white" />Начать эфир</>
              }
            </button>

            <button onClick={onToggleCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCamOff ? "bg-red-600" : "bg-black/60 backdrop-blur border border-white/20"}`}>
              <Icon name={isCamOff ? "VideoOff" : "Video"} size={18} className="text-white" />
            </button>

            <button onClick={onFlipCamera} disabled={isCamOff}
              className="w-12 h-12 rounded-full bg-black/60 backdrop-blur border border-white/20 flex items-center justify-center disabled:opacity-30 transition-colors">
              <Icon name="RefreshCw" size={18} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
