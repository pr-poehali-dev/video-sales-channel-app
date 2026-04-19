import { useRef, useEffect, useState, useCallback } from "react";

const ITEM_H = 48;
const VISIBLE = 5; // нечётное — центральный элемент выбран

interface ScrollPickerProps {
  value: number;
  onChange: (v: number) => void;
  items: number[];
  dark?: boolean;
}

export function ScrollPicker({ value, onChange, items, dark = false }: ScrollPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const totalH = ITEM_H * VISIBLE; // высота всего барабана
  const pad = Math.floor(VISIBLE / 2); // 2 пустых строки сверху/снизу

  const scrollToIdx = useCallback((idx: number, smooth = true) => {
    listRef.current?.scrollTo({ top: idx * ITEM_H, behavior: smooth ? "smooth" : "instant" });
  }, []);

  // При изменении value снаружи — прокрутить
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

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: "100%" }}>
      {/* Барабан */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: totalH }}
      >
        {/* Подсветка центральной строки */}
        <div
          className={`absolute left-0 right-0 pointer-events-none z-10 rounded-xl ${dark ? "bg-white/12" : "bg-primary/8 border border-primary/20"}`}
          style={{ top: pad * ITEM_H, height: ITEM_H }}
        />

        {/* Верхний градиент-маска */}
        <div
          className="absolute top-0 left-0 right-0 z-20 pointer-events-none"
          style={{
            height: pad * ITEM_H,
            background: dark
              ? "linear-gradient(to bottom, rgba(24,24,27,0.95), rgba(24,24,27,0))"
              : "linear-gradient(to bottom, var(--card, white) 10%, transparent)",
          }}
        />
        {/* Нижний градиент-маска */}
        <div
          className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none"
          style={{
            height: pad * ITEM_H,
            background: dark
              ? "linear-gradient(to top, rgba(24,24,27,0.95), rgba(24,24,27,0))"
              : "linear-gradient(to top, var(--card, white) 10%, transparent)",
          }}
        />

        {/* Список */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="w-full h-full overflow-y-scroll"
          style={{
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {/* Верхние паддинг-элементы */}
          {Array.from({ length: pad }).map((_, i) => (
            <div key={`pt${i}`} style={{ height: ITEM_H, scrollSnapAlign: "start", flexShrink: 0 }} />
          ))}

          {items.map((item, idx) => {
            const selected = item === value;
            return (
              <div
                key={item}
                style={{ height: ITEM_H, scrollSnapAlign: "start", flexShrink: 0 }}
                className="flex items-center justify-center cursor-pointer relative z-30"
                onClick={() => { onChange(item); scrollToIdx(idx); }}
              >
                <span
                  className="font-oswald transition-all duration-150 leading-none"
                  style={{
                    fontSize: selected ? 22 : 15,
                    fontWeight: selected ? 700 : 400,
                    color: selected
                      ? (dark ? "white" : "hsl(var(--foreground))")
                      : (dark ? "rgba(255,255,255,0.28)" : "hsl(var(--muted-foreground)/0.4)"),
                    opacity: selected ? 1 : 0.7,
                  }}
                >
                  {item}
                </span>
              </div>
            );
          })}

          {/* Нижние паддинг-элементы */}
          {Array.from({ length: pad }).map((_, i) => (
            <div key={`pb${i}`} style={{ height: ITEM_H, scrollSnapAlign: "start", flexShrink: 0 }} />
          ))}
        </div>
      </div>

      {/* Ручной ввод */}
      {editing ? (
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={() => confirmInput(inputVal)}
          onKeyDown={e => { if (e.key === "Enter") confirmInput(inputVal); if (e.key === "Escape") { setEditing(false); setInputVal(""); } }}
          placeholder={String(value)}
          className={`w-full rounded-lg px-2 py-1.5 text-sm text-center outline-none border ${
            dark
              ? "bg-white/10 border-white/20 text-white placeholder:text-white/30"
              : "bg-secondary border-border text-foreground placeholder:text-muted-foreground"
          }`}
          style={{ fontSize: 14 }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setEditing(true); setInputVal(String(value)); }}
          className={`text-[10px] underline underline-offset-2 leading-none transition-colors ${
            dark ? "text-white/25 hover:text-white/50" : "text-muted-foreground/40 hover:text-muted-foreground"
          }`}
        >
          вручную
        </button>
      )}
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
  const labelCls = dark
    ? "text-[10px] text-white/40 text-center mb-1 block"
    : "text-[10px] text-muted-foreground text-center mb-1 block";

  const cols = [
    { label: "Вес, г",   items: WEIGHTS, val: snapWeight(weightG),  set: (v: number) => setWeightG(String(v)) },
    { label: "Дл., см",  items: DIMS,    val: snapDim(lengthCm),     set: (v: number) => setLengthCm(String(v)) },
    { label: "Шир., см", items: DIMS,    val: snapDim(widthCm),      set: (v: number) => setWidthCm(String(v)) },
    { label: "Выс., см", items: DIMS,    val: snapDim(heightCm),     set: (v: number) => setHeightCm(String(v)) },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {cols.map(c => (
        <div key={c.label}>
          <span className={labelCls}>{c.label}</span>
          <ScrollPicker value={c.val} onChange={c.set} items={c.items} dark={dark} />
        </div>
      ))}
    </div>
  );
}
