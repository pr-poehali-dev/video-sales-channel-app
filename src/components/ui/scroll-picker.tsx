import { useRef, useEffect, useState, useCallback } from "react";

interface ScrollPickerProps {
  value: number;
  onChange: (v: number) => void;
  items: number[];
  height?: number;
  dark?: boolean;
}

const ITEM_H = 44;

export function ScrollPicker({ value, onChange, items, height = 220, dark = false }: ScrollPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const scrollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToIndex = useCallback((idx: number, smooth = true) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: idx * ITEM_H, behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    const idx = items.indexOf(value);
    if (idx >= 0) scrollToIndex(idx, false);
  }, [value, items, scrollToIndex]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    scrollingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      scrollingRef.current = false;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      scrollToIndex(clamped);
      onChange(items[clamped]);
    }, 120);
  };

  const handleInputConfirm = (raw: string) => {
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      const closest = items.reduce((a, b) => Math.abs(b - num) < Math.abs(a - num) ? b : a);
      onChange(closest);
      const idx = items.indexOf(closest);
      scrollToIndex(idx);
    }
    setEditing(false);
    setInputVal("");
  };

  const visibleItems = 5;
  const pad = Math.floor(visibleItems / 2);

  const textBase = dark ? "text-white" : "text-foreground";
  const mutedText = dark ? "text-white/25" : "text-muted-foreground/30";
  const selectorBg = dark ? "bg-white/10" : "bg-secondary";

  return (
    <div
      className="relative flex flex-col items-center select-none"
      style={{ height, width: "100%" }}
    >
      {/* Highlight центральной строки */}
      <div
        className={`absolute left-0 right-0 rounded-xl ${selectorBg} pointer-events-none`}
        style={{ top: "50%", transform: "translateY(-50%)", height: ITEM_H, zIndex: 1 }}
      />

      {/* Скролл-список */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="w-full overflow-y-auto scrollbar-hide"
        style={{
          height,
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          paddingTop: (height / 2) - ITEM_H / 2,
          paddingBottom: (height / 2) - ITEM_H / 2,
        }}
      >
        {/* Пустые отступы сверху */}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`top-${i}`} style={{ height: ITEM_H, scrollSnapAlign: "center" }} />
        ))}

        {items.map((item, idx) => {
          const selected = item === value;
          return (
            <div
              key={item}
              style={{ height: ITEM_H, scrollSnapAlign: "center" }}
              className="flex items-center justify-center cursor-pointer"
              onClick={() => {
                onChange(item);
                scrollToIndex(idx);
              }}
            >
              <span
                className={`font-oswald transition-all duration-150 ${
                  selected
                    ? `text-2xl font-semibold ${textBase}`
                    : `text-base ${mutedText}`
                }`}
              >
                {item}
              </span>
            </div>
          );
        })}

        {/* Пустые отступы снизу */}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`bot-${i}`} style={{ height: ITEM_H, scrollSnapAlign: "center" }} />
        ))}
      </div>

      {/* Кнопка ручного ввода */}
      {editing ? (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex gap-1 px-1">
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onBlur={() => handleInputConfirm(inputVal)}
            onKeyDown={e => { if (e.key === "Enter") handleInputConfirm(inputVal); }}
            placeholder={String(value)}
            className={`flex-1 rounded-lg px-2 py-1 text-sm text-center outline-none border ${
              dark
                ? "bg-white/10 border-white/20 text-white placeholder:text-white/30"
                : "bg-card border-border text-foreground placeholder:text-muted-foreground"
            }`}
            style={{ fontSize: 15 }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setEditing(true); setInputVal(String(value)); }}
          className={`absolute bottom-1 text-[10px] underline underline-offset-2 z-10 ${
            dark ? "text-white/30 hover:text-white/60" : "text-muted-foreground/50 hover:text-muted-foreground"
          } transition-colors`}
        >
          ввести вручную
        </button>
      )}
    </div>
  );
}

interface DimensionPickerProps {
  weightG: string; setWeightG: (v: string) => void;
  lengthCm: string; setLengthCm: (v: string) => void;
  widthCm: string; setWidthCm: (v: string) => void;
  heightCm: string; setHeightCm: (v: string) => void;
  dark?: boolean;
}

// Генераторы значений
const WEIGHTS = [
  ...Array.from({ length: 20 }, (_, i) => (i + 1) * 50),        // 50..1000 г (шаг 50)
  ...Array.from({ length: 18 }, (_, i) => 1100 + i * 100),       // 1100..2800 г
  ...Array.from({ length: 15 }, (_, i) => 3000 + i * 500),       // 3000..10000 г
];
const DIMS = Array.from({ length: 100 }, (_, i) => i + 1);        // 1..100 см

function snapWeight(raw: string): number {
  const n = parseInt(raw, 10) || 500;
  return WEIGHTS.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a);
}
function snapDim(raw: string): number {
  const n = parseInt(raw, 10) || 10;
  return Math.max(1, Math.min(100, n));
}

export function DimensionPicker({ weightG, setWeightG, lengthCm, setLengthCm, widthCm, setWidthCm, heightCm, setHeightCm, dark = false }: DimensionPickerProps) {
  const labelClass = dark ? "text-[10px] text-white/40 text-center mb-1" : "text-[10px] text-muted-foreground text-center mb-1";

  const cols = [
    { label: "Вес, г",   items: WEIGHTS, val: snapWeight(weightG),   set: (v: number) => setWeightG(String(v)) },
    { label: "Дл., см",  items: DIMS,    val: snapDim(lengthCm),      set: (v: number) => setLengthCm(String(v)) },
    { label: "Шир., см", items: DIMS,    val: snapDim(widthCm),       set: (v: number) => setWidthCm(String(v)) },
    { label: "Выс., см", items: DIMS,    val: snapDim(heightCm),      set: (v: number) => setHeightCm(String(v)) },
  ];

  return (
    <div>
      <div className="grid grid-cols-4 gap-1 mb-1">
        {cols.map(c => (
          <p key={c.label} className={labelClass}>{c.label}</p>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {cols.map(c => (
          <ScrollPicker
            key={c.label}
            value={c.val}
            onChange={c.set}
            items={c.items}
            height={176}
            dark={dark}
          />
        ))}
      </div>
    </div>
  );
}
