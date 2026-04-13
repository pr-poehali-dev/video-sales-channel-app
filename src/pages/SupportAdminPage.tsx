import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";

const API = "https://functions.poehali.dev/0a8bbc48-f71c-4a23-b48e-cd0a9392789f";

interface Message {
  id: string;
  senderRole: "user" | "admin";
  senderName: string;
  text: string;
  createdAt: string;
}

interface Chat {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadAdmin: number;
  unreadUser: number;
  status: string;
}

interface SupportAdminPageProps {
  setPage: (p: Page) => void;
}

export default function SupportAdminPage({ setPage }: SupportAdminPageProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");
  const endRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChats = useCallback(async () => {
    try {
      const r = await fetch(`${API}?action=get_all_chats`);
      const data = await r.json();
      if (Array.isArray(data)) setChats(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const r = await fetch(`${API}?action=get_messages&chat_id=${chatId}&role=admin`);
      const data = await r.json();
      if (Array.isArray(data)) setMessages(data);
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadAdmin: 0 } : c));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadChats();
    chatsPollRef.current = setInterval(loadChats, 5000);
    return () => { if (chatsPollRef.current) clearInterval(chatsPollRef.current); };
  }, []);

  useEffect(() => {
    if (!activeChat) return;
    loadMessages(activeChat.id);
    pollRef.current = setInterval(() => loadMessages(activeChat.id), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChat?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const openChat = (chat: Chat) => {
    setActiveChat(chat);
    setMessages([]);
  };

  const send = async () => {
    if (!input.trim() || !activeChat || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      const r = await fetch(`${API}?action=send_message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: activeChat.id, sender_role: "admin", sender_name: "Поддержка", text }),
      });
      const msg = await r.json();
      setMessages(prev => [...prev, msg]);
    } catch { setInput(text); }
    finally { setSending(false); }
  };

  const setStatus = async (chatId: string, status: "open" | "closed") => {
    try {
      await fetch(`${API}?action=set_status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, status }),
      });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, status } : c));
      if (activeChat?.id === chatId) setActiveChat(prev => prev ? { ...prev, status } : prev);
    } catch { /* ignore */ }
  };

  const fmtTime = (iso: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      return isToday
        ? d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString("ru", { day: "numeric", month: "short" });
    } catch { return ""; }
  };

  const fmtFull = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  if (!user || user.role !== "admin") return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <Icon name="ShieldOff" size={36} className="mx-auto mb-4 text-muted-foreground opacity-40" />
      <h2 className="font-oswald text-xl font-semibold mb-2">Нет доступа</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Войдите как администратор:<br/>
        <span className="font-mono text-xs">admin@yugastore.ru / admin2024</span>
      </p>
      <button onClick={() => setPage("auth")} className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">Войти</button>
    </div>
  );

  const filtered = chats.filter(c => filter === "all" ? true : c.status === filter);
  const totalUnread = chats.reduce((s, c) => s + c.unreadAdmin, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide flex items-center gap-2">
            Чаты поддержки
            {totalUnread > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{chats.length} диалог{chats.length === 1 ? "" : chats.length < 5 ? "а" : "ов"}</p>
        </div>
        {/* Фильтр */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {(["open", "closed", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {f === "open" ? "Открытые" : f === "closed" ? "Закрытые" : "Все"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ height: "calc(100vh - 200px)" }}>
        {/* Список чатов */}
        <div className="md:col-span-1 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <p className="text-xs text-muted-foreground font-medium">{filtered.length} диалог{filtered.length === 1 ? "" : "ов"}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><Icon name="Loader" size={20} className="text-muted-foreground animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Icon name="MessageCircle" size={28} className="mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">Нет диалогов</p>
              </div>
            ) : filtered.map(chat => (
              <button key={chat.id} onClick={() => openChat(chat)}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary transition-colors border-b border-border/50 text-left ${activeChat?.id === chat.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
                {/* Аватар */}
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {chat.userAvatar || chat.userName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold text-foreground truncate">{chat.userName}</p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{fmtTime(chat.lastMessageAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {chat.lastMessage || "Нет сообщений"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${chat.status === "open" ? "bg-green-500/10 text-green-600" : "bg-secondary text-muted-foreground"}`}>
                      {chat.status === "open" ? "Открыт" : "Закрыт"}
                    </span>
                    {chat.unreadAdmin > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{chat.unreadAdmin}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Окно чата */}
        <div className="md:col-span-2 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          {!activeChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                <Icon name="MessageSquare" size={28} className="text-muted-foreground opacity-40" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Выберите диалог</p>
              <p className="text-xs text-muted-foreground">Нажмите на пользователя слева чтобы открыть переписку</p>
            </div>
          ) : (
            <>
              {/* Шапка чата */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                    {activeChat.userAvatar || activeChat.userName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{activeChat.userName}</p>
                    <p className="text-xs text-muted-foreground">ID: {activeChat.userId.slice(0, 20)}...</p>
                  </div>
                </div>
                <button
                  onClick={() => setStatus(activeChat.id, activeChat.status === "open" ? "closed" : "open")}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    activeChat.status === "open"
                      ? "border-border text-muted-foreground hover:bg-secondary"
                      : "border-green-500/30 text-green-600 hover:bg-green-500/10"
                  }`}>
                  {activeChat.status === "open" ? "Закрыть" : "Открыть"}
                </button>
              </div>

              {/* Сообщения */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground">Нет сообщений</p>
                  </div>
                ) : messages.map(m => (
                  <div key={m.id} className={`flex ${m.senderRole === "admin" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      m.senderRole === "admin"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-foreground rounded-bl-sm"
                    }`}>
                      {m.senderRole === "user" && (
                        <p className="text-[10px] font-semibold text-primary mb-0.5">{m.senderName}</p>
                      )}
                      <p className="text-sm leading-relaxed">{m.text}</p>
                      <p className={`text-[10px] mt-1 ${m.senderRole === "admin" ? "text-white/60 text-right" : "text-muted-foreground"}`}>
                        {fmtFull(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {/* Ввод */}
              <div className="flex items-end gap-2 px-4 py-3 border-t border-border flex-shrink-0">
                {activeChat.status === "closed" ? (
                  <p className="flex-1 text-xs text-muted-foreground text-center py-2">Диалог закрыт — откройте чтобы ответить</p>
                ) : (
                  <>
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      placeholder="Ответить пользователю..."
                      maxLength={1000}
                      rows={1}
                      className="flex-1 bg-secondary border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none leading-relaxed"
                      style={{ maxHeight: 100, overflowY: "auto" }}
                      onInput={e => {
                        const el = e.currentTarget;
                        el.style.height = "auto";
                        el.style.height = Math.min(el.scrollHeight, 100) + "px";
                      }}
                    />
                    <button onClick={send} disabled={!input.trim() || sending}
                      className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                      {sending ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name="Send" size={16} />}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}