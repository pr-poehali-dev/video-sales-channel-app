import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface SavedClip {
  id: string;
  name: string;
  url: string;
  duration: number;
  savedAt: string;
}

const STORAGE_KEY = "yugastore_clips";
const MAX_DURATION_SEC = 60;

function getClips(productId: number): SavedClip[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${productId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveClip(productId: number, clip: SavedClip) {
  const existing = getClips(productId);
  localStorage.setItem(`${STORAGE_KEY}_${productId}`, JSON.stringify([clip, ...existing]));
}

function removeClip(productId: number, clipId: string) {
  const existing = getClips(productId).filter(c => c.id !== clipId);
  localStorage.setItem(`${STORAGE_KEY}_${productId}`, JSON.stringify(existing));
}

interface ShortClipPlayerProps {
  productId: number;
  sellerName: string;
}

export default function ShortClipPlayer({ productId, sellerName }: ShortClipPlayerProps) {
  const [clips, setClips] = useState<SavedClip[]>(() => getClips(productId));
  const [activeClip, setActiveClip] = useState<SavedClip | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      clips.forEach(c => {
        if (c.url.startsWith("blob:")) URL.revokeObjectURL(c.url);
      });
    };
  }, []);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("video/")) {
      setError("Выберите видеофайл (mp4, mov, webm)");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("Файл слишком большой. Максимум 100 МБ");
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;

    await new Promise<void>(resolve => {
      video.onloadedmetadata = () => resolve();
    });

    if (video.duration > MAX_DURATION_SEC) {
      URL.revokeObjectURL(url);
      setError(`Видео слишком длинное — ${Math.round(video.duration)} сек. Максимум 60 секунд.`);
      return;
    }

    setUploading(true);
    let tick = 0;
    const interval = setInterval(() => {
      tick += 10;
      setProgress(Math.min(tick, 95));
      if (tick >= 95) clearInterval(interval);
    }, 80);

    await new Promise(r => setTimeout(r, 900));
    clearInterval(interval);
    setProgress(100);

    const clip: SavedClip = {
      id: `${Date.now()}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      url,
      duration: Math.round(video.duration),
      savedAt: new Date().toLocaleDateString("ru", { day: "numeric", month: "short" }),
    };

    saveClip(productId, clip);
    const updated = getClips(productId);
    setClips(updated);
    setActiveClip(clip);
    setUploading(false);
    setProgress(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDelete = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (clip?.url.startsWith("blob:")) URL.revokeObjectURL(clip.url);
    removeClip(productId, clipId);
    setClips(getClips(productId));
    if (activeClip?.id === clipId) setActiveClip(null);
  };

  const fmtDur = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="Clapperboard" size={18} className="text-primary" />
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide">Короткие эфиры</h2>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">до 60 сек</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Сохраните короткий фрагмент прямого эфира от <span className="font-medium text-foreground">{sellerName}</span> — смотрите товар в деталях без подключения к интернету.
      </p>

      {/* Плеер активного клипа */}
      {activeClip && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-5 animate-scale-in">
          <video
            ref={videoRef}
            src={activeClip.url}
            controls
            className="w-full max-h-80 bg-black"
          />
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{activeClip.name}</p>
              <p className="text-xs text-muted-foreground">{fmtDur(activeClip.duration)} · сохранён {activeClip.savedAt}</p>
            </div>
            <button
              onClick={() => setActiveClip(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Список сохранённых клипов */}
      {clips.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {clips.map(clip => (
            <div
              key={clip.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                activeClip?.id === clip.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
              onClick={() => setActiveClip(clip)}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Icon name="Play" size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{clip.name}</p>
                <p className="text-xs text-muted-foreground">{fmtDur(clip.duration)} · {clip.savedAt}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(clip.id); }}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Icon name="Trash2" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Зона загрузки */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          uploading ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/50"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-foreground">Сохраняю клип...</p>
            <div className="w-48 bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
              <Icon name="Upload" size={22} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Загрузить видеофрагмент</p>
            <p className="text-xs text-muted-foreground">Перетащите файл или нажмите · mp4, mov, webm · до 60 сек</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-3 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-2.5 animate-fade-in">
          <Icon name="CircleAlert" size={15} />
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3 text-center">
        Видео сохраняется только на вашем устройстве и не загружается на сервер
      </p>
    </div>
  );
}
