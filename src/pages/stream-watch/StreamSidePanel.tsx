import { useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";
import type { ChatMessage, StoreProduct } from "@/context/StoreContext";

// ── ChatPanel ─────────────────────────────────────────────────────────────────
interface ChatPanelProps {
  messages: ChatMessage[];
  user: { id: string; name: string; avatar: string } | null;
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text?: string) => void;
  sending: boolean;
}
function ChatPanel({ messages, user, input, setInput, sendMessage, sending }: ChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0
          ? <p className="text-center text-white/30 text-xs pt-8">Чат пуст</p>
          : messages.map(m => (
            <div key={m.id} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/30 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{m.userAvatar}</div>
              <p className="text-[12px] text-white/80 leading-snug"><span className="text-primary/90 font-semibold">{m.userName} </span>{m.text}</p>
            </div>
          ))}
        <div ref={endRef} />
      </div>
      {user ? (
        <div className="px-3 py-3 border-t border-white/10 flex gap-2 flex-shrink-0">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Написать..." maxLength={200}
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/40 outline-none focus:border-primary/50"
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40">
            <Icon name="Send" size={13} className="text-white" />
          </button>
        </div>
      ) : (
        <p className="text-center text-white/30 text-xs py-3 border-t border-white/10">Войдите чтобы писать</p>
      )}
    </div>
  );
}

// ── ProductsPanel ─────────────────────────────────────────────────────────────
interface ProductsPanelProps {
  products: StoreProduct[];
  addedId: string | null;
  handleAddToCart: (e: React.MouseEvent, p: StoreProduct) => void;
  onProductClick: (id: string) => void;
}
function ProductsPanel({ products, addedId, handleAddToCart, onProductClick }: ProductsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      {products.length === 0
        ? <p className="text-center text-white/30 text-xs pt-8">Нет товаров</p>
        : products.map(p => (
          <div key={p.id} onClick={() => onProductClick(p.id)}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
            {p.images[0]
              ? <img src={p.images[0]} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              : <div className="w-12 h-12 rounded-lg bg-white/10 flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{p.name}</p>
              <p className="text-primary text-xs font-bold mt-0.5">{p.price.toLocaleString("ru-RU")} ₽</p>
            </div>
            <button onClick={e => handleAddToCart(e, p)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex-shrink-0 transition-colors ${addedId === p.id ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"}`}>
              {addedId === p.id ? "✓" : "В корзину"}
            </button>
          </div>
        ))
      }
    </div>
  );
}

// ── StreamSidePanel ───────────────────────────────────────────────────────────
interface Props {
  stream: { title: string; sellerName: string; isLive: boolean };
  messages: ChatMessage[];
  user: { id: string; name: string; avatar: string } | null;
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text?: string) => void;
  sending: boolean;
  products: StoreProduct[];
  addedId: string | null;
  handleAddToCart: (e: React.MouseEvent, p: StoreProduct) => void;
  onProductClick: (id: string) => void;
  liveStatus: "waiting" | "playing" | "error";
  chatOpen: boolean;
  setChatOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  rightTab: "chat" | "products";
  setRightTab: (v: "chat" | "products") => void;
}

export default function StreamSidePanel({
  stream, messages, user, input, setInput, sendMessage, sending,
  products, addedId, handleAddToCart, onProductClick,
  liveStatus, chatOpen, setChatOpen, rightTab, setRightTab,
}: Props) {
  return (
    <>
      {/* ── ИНФО (мобильный) ────────────────────────────────────────── */}
      <div className="lg:hidden bg-zinc-950 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold text-sm truncate">{stream.title}</h2>
          <p className="text-white/50 text-xs mt-0.5">{stream.sellerName}</p>
        </div>
        {stream.isLive && liveStatus === "playing" && (
          <span className="text-white/40 text-xs flex items-center gap-1 flex-shrink-0">
            <Icon name="Eye" size={12} />смотрит
          </span>
        )}
      </div>

      {/* ── ЧАТ-ШТОРКА (мобильный) ──────────────────────────────────── */}
      {chatOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setChatOpen(false)}>
          <div className="bg-zinc-900 rounded-t-2xl" style={{ maxHeight: "70vh" }} onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1" />
            <div className="flex border-b border-white/10">
              {(["chat", "products"] as const).map(tab => (
                <button key={tab} onClick={() => setRightTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${rightTab === tab ? "text-white border-primary" : "text-white/40 border-transparent"}`}>
                  <Icon name={tab === "chat" ? "MessageSquare" : "ShoppingBag"} size={13} />
                  {tab === "chat" ? `Чат (${messages.length})` : `Товары (${products.length})`}
                </button>
              ))}
            </div>
            <div style={{ height: "50vh" }} className="flex flex-col">
              {rightTab === "chat"
                ? <ChatPanel messages={messages} user={user} input={input} setInput={setInput} sendMessage={sendMessage} sending={sending} />
                : <ProductsPanel products={products} addedId={addedId} handleAddToCart={handleAddToCart} onProductClick={onProductClick} />
              }
            </div>
          </div>
        </div>
      )}

      {/* ── ДЕСКТОП ПАНЕЛЬ ──────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:flex-col lg:w-80 xl:w-96 bg-zinc-950 border-l border-white/10 flex-shrink-0">
        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-white font-semibold text-sm">{stream.title}</h2>
          <p className="text-white/50 text-xs mt-0.5">{stream.sellerName}</p>
        </div>
        <div className="flex border-b border-white/10 flex-shrink-0">
          {(["chat", "products"] as const).map(tab => (
            <button key={tab} onClick={() => setRightTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${rightTab === tab ? "text-white border-primary" : "text-white/40 border-transparent hover:text-white/70"}`}>
              <Icon name={tab === "chat" ? "MessageSquare" : "ShoppingBag"} size={13} />
              {tab === "chat" ? "Чат" : "Товары"}
              {tab === "chat" && messages.length > 0 && <span className="bg-white/10 text-white/50 text-[10px] px-1.5 rounded-full">{messages.length}</span>}
              {tab === "chat" && stream.isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-pulse ml-1" />}
              {tab === "products" && <span className="bg-white/10 text-white/50 text-[10px] px-1.5 rounded-full">{products.length}</span>}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          {rightTab === "chat"
            ? <ChatPanel messages={messages} user={user} input={input} setInput={setInput} sendMessage={sendMessage} sending={sending} />
            : <ProductsPanel products={products} addedId={addedId} handleAddToCart={handleAddToCart} onProductClick={onProductClick} />
          }
        </div>
      </div>
    </>
  );
}
