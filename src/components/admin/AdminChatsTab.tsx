import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

const SUPPORT_API = "https://functions.poehali.dev/0a8bbc48-f71c-4a23-b48e-cd0a9392789f";

interface SupportChat {
  id: string; userId: string; userName: string; userAvatar: string;
  lastMessage: string; lastMessageAt: string;
  unreadAdmin: number; status: string;
}
interface SupportMsg {
  id: string; senderRole: "user" | "admin"; senderName: string; text: string; createdAt: string;
}

export default function AdminChatsTab() {
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [active, setActive] = useState<SupportChat | null>(null);
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"open"|"closed"|"all">("open");
  const endRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChats = useCallback(async () => {
    try {
      const r = await fetch(`${SUPPORT_API}?action=get_all_chats`);
      const d = await r.json();
      if (Array.isArray(d)) setChats(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const r = await fetch(`${SUPPORT_API}?action=get_messages&chat_id=${chatId}&role=admin`);
      const d = await r.json();
      if (Array.isArray(d)) setMessages(d);
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadAdmin: 0 } : c));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadChats();
    chatsPollRef.current = setInterval(loadChats, 5000);
    return () => { if (chatsPollRef.current) clearInterval(chatsPollRef.current); };
  }, []);

  useEffect(() => {
    if (!active) return;
    loadMessages(active.id);
    pollRef.current = setInterval(() => loadMessages(active.id), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [active?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!input.trim() || !active || sending) return;
    const text = input.trim(); setInput(""); setSending(true);
    try {
      const r = await fetch(`${SUPPORT_API}?action=send_message`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: active.id, sender_role: "admin", sender_name: "Поддержка", text }),
      });
      const msg = await r.json();
      setMessages(prev => [...prev, msg]);
    } catch { setInput(text); } finally { setSending(false); }
  };

  const toggleStatus = async (chat: SupportChat) => {
    const s = chat.status === "open" ? "closed" : "open";
    try {
      await fetch(`${SUPPORT_API}?action=set_status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat.id, status: s }),
      });
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, status: s } : c));
      if (active?.id === chat.id) setActive(prev => prev ? { ...prev, status: s } : prev);
    } catch { /* ignore */ }
  };

  const fmtTime = (iso: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso), now = new Date();
      return d.toDateString() === now.toDateString()
        ? d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("ru", { day: "numeric", month: "short" });
    } catch { return ""; }
  };

  const filtered = chats.filter(c => filter === "all" ? true : c.status === filter);
  const totalUnread = chats.reduce((s, c) => s + c.unreadAdmin, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in" style={{ height: "calc(100vh - 260px)", minHeight: 400 }}>
      {/* Список */}
      <div className="md:col-span-1 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            Диалоги
            {totalUnread > 0 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalUnread}</span>}
          </span>
          <div className="flex gap-0.5 bg-secondary rounded-lg p-0.5">
            {(["open","closed","all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2 py-1 text-[10px] rounded-md font-medium transition-all ${filter===f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {f==="open"?"Откр.":f==="closed"?"Закр.":"Все"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Icon name="Loader" size={18} className="text-muted-foreground animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Icon name="MessageCircle" size={24} className="mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-xs text-muted-foreground">Нет диалогов</p>
            </div>
          ) : filtered.map(chat => (
            <button key={chat.id} onClick={() => { setActive(chat); setMessages([]); }}
              className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary transition-colors border-b border-border/50 text-left ${active?.id===chat.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
              <div className="w-9 h-9 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                {chat.userAvatar || chat.userName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-semibold text-foreground truncate">{chat.userName}</p>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{fmtTime(chat.lastMessageAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage || "Нет сообщений"}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${chat.status==="open" ? "bg-green-500/10 text-green-600" : "bg-secondary text-muted-foreground"}`}>
                    {chat.status==="open" ? "Открыт" : "Закрыт"}
                  </span>
                  {chat.unreadAdmin > 0 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{chat.unreadAdmin}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Чат */}
      <div className="md:col-span-2 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <Icon name="MessageSquare" size={28} className="text-muted-foreground opacity-30 mb-3" />
            <p className="text-sm text-muted-foreground">Выберите диалог слева</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                  {active.userAvatar || active.userName[0]?.toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-foreground">{active.userName}</p>
              </div>
              <button onClick={() => toggleStatus(active)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${active.status==="open" ? "border-border text-muted-foreground hover:bg-secondary" : "border-green-500/30 text-green-600 hover:bg-green-500/10"}`}>
                {active.status==="open" ? "Закрыть" : "Открыть"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.length === 0
                ? <p className="text-center text-xs text-muted-foreground py-6">Нет сообщений</p>
                : messages.map(m => (
                  <div key={m.id} className={`flex ${m.senderRole==="admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${m.senderRole==="admin" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                      {m.senderRole==="user" && <p className="text-[10px] font-semibold text-primary mb-0.5">{m.senderName}</p>}
                      <p className="text-sm leading-relaxed">{m.text}</p>
                      <p className={`text-[10px] mt-0.5 ${m.senderRole==="admin" ? "text-white/60 text-right" : "text-muted-foreground"}`}>
                        {new Date(m.createdAt).toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"})}
                      </p>
                    </div>
                  </div>
                ))
              }
              <div ref={endRef} />
            </div>
            <div className="flex items-end gap-2 px-4 py-3 border-t border-border flex-shrink-0">
              {active.status==="closed"
                ? <p className="flex-1 text-xs text-muted-foreground text-center py-1.5">Диалог закрыт — откройте чтобы ответить</p>
                : <>
                    <textarea value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
                      placeholder="Ответить..." maxLength={1000} rows={1}
                      className="flex-1 bg-secondary border border-border rounded-2xl px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none"
                      style={{ maxHeight: 80 }}
                      onInput={e => { const el=e.currentTarget; el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,80)+"px"; }}
                    />
                    <button onClick={send} disabled={!input.trim()||sending}
                      className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                      {sending ? <Icon name="Loader" size={14} className="animate-spin"/> : <Icon name="Send" size={14}/>}
                    </button>
                  </>
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}
