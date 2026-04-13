import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";

const API = "https://functions.poehali.dev/0a8bbc48-f71c-4a23-b48e-cd0a9392789f";

interface Message {
  id: string;
  chatId: string;
  senderRole: "user" | "admin";
  senderName: string;
  text: string;
  createdAt: string;
}

interface Chat {
  id: string;
  userId: string;
  userName: string;
  unreadUser: number;
  status: string;
}

interface SupportPageProps {
  setPage: (p: Page) => void;
}

export default function SupportPage({ setPage }: SupportPageProps) {
  const { user } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const r = await fetch(`${API}?action=get_messages&chat_id=${chatId}&role=user`);
      const data = await r.json();
      setMessages(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const r = await fetch(`${API}?action=get_or_create_chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, user_name: user.name, user_avatar: user.avatar }),
        });
        const c = await r.json();
        setChat(c);
        await loadMessages(c.id);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!chat) return;
    pollRef.current = setInterval(() => loadMessages(chat.id), 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [chat?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!input.trim() || !chat || !user || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      const r = await fetch(`${API}?action=send_message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat.id, sender_role: "user", sender_name: user.name, text }),
      });
      const msg = await r.json();
      setMessages(prev => [...prev, msg]);
    } catch { setInput(text); }
    finally { setSending(false); }
  };

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  if (!user) return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <Icon name="MessageCircle" size={40} className="mx-auto mb-4 text-muted-foreground opacity-40" />
      <h2 className="font-oswald text-xl font-semibold mb-2">Войдите в аккаунт</h2>
      <p className="text-sm text-muted-foreground mb-5">Чтобы написать в поддержку, нужно войти</p>
      <button onClick={() => setPage("auth")} className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90">
        Войти
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 56px - env(safe-area-inset-bottom))" }}>
      {/* Шапка */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name="HeadphonesIcon" size={18} className="text-primary" fallback="Headphones" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Поддержка</p>
          <p className="text-xs text-muted-foreground">Обычно отвечаем в течение дня</p>
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Icon name="Loader" size={24} className="text-muted-foreground animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="MessageCircle" size={28} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">Напишите нам</p>
            <p className="text-xs text-muted-foreground">Мы поможем с любым вопросом по заказу, доставке или товарам</p>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.senderRole === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                m.senderRole === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border border-border text-foreground rounded-bl-sm"
              }`}>
                {m.senderRole === "admin" && (
                  <p className="text-[10px] font-semibold text-primary mb-0.5">Поддержка</p>
                )}
                <p className="text-sm leading-relaxed">{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.senderRole === "user" ? "text-white/60 text-right" : "text-muted-foreground"}`}>
                  {fmtTime(m.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Ввод */}
      <div className="flex items-end gap-2 px-4 py-3 border-t border-border bg-background flex-shrink-0">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Напишите сообщение..."
          maxLength={1000}
          rows={1}
          className="flex-1 bg-secondary border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none leading-relaxed"
          style={{ maxHeight: 120, overflowY: "auto" }}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity flex-shrink-0"
        >
          {sending ? <Icon name="Loader" size={16} className="animate-spin" /> : <Icon name="Send" size={16} />}
        </button>
      </div>
    </div>
  );
}
