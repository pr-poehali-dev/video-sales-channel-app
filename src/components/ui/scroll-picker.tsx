import { useRef, useEffect, useState, useCallback } from "react";

const ITEM_H = 52;
const VISIBLE = 3; // только 3 строки — компактно

interface ScrollPickerProps {
  value: number;
  onChange: (v: number) => void;
  items: number[];
  label: string;
  dark?: boolean;
}

export function ScrollPicker({ value, onChange, items, label, dark = false }: ScrollPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const pad = Math.floor(VISIBLE / 2); // = 1
  const totalH = ITEM_H * VISIBLE;

  const scrollToIdx = useCallback((idx: number, smooth = true) => {
    listRef.current?.scrollTo({ top: idx * ITEM_H, behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    const idx = items.indexOf(value);
    if (idx >= 0) scrollToIdx(idx, false);
  }, [value, items, scrollToIdx]);

  const handleScroll = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const el = listRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      scrollToIdx(clamped);
      onChange(items[clamped]);
    }, 100);
  };

  const confirmInput = (raw: string) => {
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0) {
      const closest = items.reduce((a, b) => Math.abs(b - num) < Math.abs(a - num) ? b : a);
      onChange(closest);
      scrollToIdx(items.indexOf(closest));
    }
    setEditing(false);
    setInputVal("");
  };

  const fg = dark ? "white" : "hsl(var(--foreground))";
  const muted = dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)";
  const maskTop = dark
    ? "linear-gradient(to bottom, rgb(24,24,27) 0%, rgba(24,24,27,0.4) 70%, transparent 100%)"
    : "linear-gradient(to bottom, white 0%, rgba(255,255,255,0.6) 60%, transparent 100%)";
  const maskBot = dark
    ? "linear-gradient(to top, rgb(24,24,27) 0%, rgba(24,24,27,0.4) 70%, transparent 100%)"
    : "linear-gradient(to top, white 0%, rgba(255,255,255,0.6) 60%, transparent 100%)";

  return (
    <div className="relative select-none" style={{ width: "100%", height: totalH }}>

      {/* Подсветка центральной строки с меткой внутри */}
      <div
        className="absolute left-0 right-0 z-10 pointer-events-none flex flex-col items-center justify-end pb-1"
        style={{
          top: pad * ITEM_H,
          height: ITEM_H,
          background: dark ? "rgba(255,255,255,0.1)" : "hsl(var(--primary)/0.07)",
          border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "hsl(var(--primary)/0.22)"}`,
          borderRadius: 12,
        }}
      >
        <span
          className="font-medium leading-none"
          style={{
            fontSize: 9,
            color: dark ? "rgba(255,255,255,0.35)" : "hsl(var(--primary)/0.6)",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </span>
      </div>

      {/* Скролл-список */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          width: "100%",
          height: totalH,
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`t${i}`} style={{ height: ITEM_H, scrollSnapAlign: "start" }} />
        ))}

        {items.map((item, idx) => {
          const selected = item === value;
          return (
            <div
              key={item}
              style={{ height: ITEM_H, scrollSnapAlign: "start" }}
              className="flex items-center justify-center relative z-20"
              onClick={() => {
                if (selected) {
                  setInputVal(String(value));
                  setEditing(true);
                } else {
                  onChange(item);
                  scrollToIdx(idx);
                }
              }}
            >
              {selected && editing ? (
                <input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onBlur={() => confirmInput(inputVal)}
                  onKeyDown={e => {
                    if (e.key === "Enter") confirmInput(inputVal);
                    if (e.key === "Escape") { setEditing(false); setInputVal(""); }
                  }}
                  className="w-full text-center outline-none bg-transparent font-oswald font-bold"
                  style={{ fontSize: 22, color: fg, border: "none", padding: "0 2px" }}
                />
              ) : (
                <span
                  className="font-oswald transition-all duration-100 leading-none"
                  style={{
                    fontSize: selected ? 22 : 15,
                    fontWeight: selected ? 700 : 400,
                    color: selected ? fg : muted,
                  }}
                >
                  {item}
                </span>
              )}
            </div>
          );
        })}

        {Array.from({ length: pad }).map((_, i) => (
          <div key={`b${i}`} style={{ height: ITEM_H, scrollSnapAlign: "start" }} />
        ))}
      </div>

      {/* Градиентные маски */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-30"
        style={{ height: pad * ITEM_H, background: maskTop }} />
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-30"
        style={{ height: pad * ITEM_H, background: maskBot }} />
    </div>
  );
}

// ─── DimensionPicker ────────────────────────────────────────────────────────

interface DimensionPickerProps {
  weightG: string; setWeightG: (v: string) => void;
  lengthCm: string; setLengthCm: (v: string) => void;
  widthCm: string; setWidthCm: (v: string) => void;
  heightCm: string; setHeightCm: (v: string) => void;
  dark?: boolean;
}

const WEIGHTS = [
  ...Array.from({ length: 20 }, (_, i) => (i + 1) * 50),
  ...Array.from({ length: 18 }, (_, i) => 1100 + i * 100),
  ...Array.from({ length: 15 }, (_, i) => 3000 + i * 500),
];
const DIMS = Array.from({ length: 100 }, (_, i) => i + 1);

function snapWeight(raw: string) {
  const n = parseInt(raw, 10) || 500;
  return WEIGHTS.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a);
}
function snapDim(raw: string) {
  return Math.max(1, Math.min(100, parseInt(raw, 10) || 10));
}

export function DimensionPicker({
  weightG, setWeightG,
  lengthCm, setLengthCm,
  widthCm, setWidthCm,
  heightCm, setHeightCm,
  dark = false,
}: DimensionPickerProps) {
  const cols = [
    { label: "Вес, г",   items: WEIGHTS, val: snapWeight(weightG),  set: (v: number) => setWeightG(String(v)) },
    { label: "Дл., см",  items: DIMS,    val: snapDim(lengthCm),     set: (v: number) => setLengthCm(String(v)) },
    { label: "Шир., см", items: DIMS,    val: snapDim(widthCm),      set: (v: number) => setWidthCm(String(v)) },
    { label: "Выс., см", items: DIMS,    val: snapDim(heightCm),     set: (v: number) => setHeightCm(String(v)) },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {cols.map(c => (
        <ScrollPicker
          key={c.label}
          label={c.label}
          value={c.val}
          onChange={c.set}
          items={c.items}
          dark={dark}
        />
      ))}
    </div>
  );
}
