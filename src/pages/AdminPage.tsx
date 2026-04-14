import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type User } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import type { Page } from "@/App";

const SUPPORT_API = "https://functions.poehali.dev/0a8bbc48-f71c-4a23-b48e-cd0a9392789f";

interface SupportChat {
  id: string; userId: string; userName: string; userAvatar: string;
  lastMessage: string; lastMessageAt: string;
  unreadAdmin: number; status: string;
}
interface SupportMsg {
  id: string; senderRole: "user" | "admin"; senderName: string; text: string; createdAt: string;
}

function ChatsTab() {
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

const CDEK_API = "https://functions.poehali.dev/937e27f3-191a-445d-b034-61bd84ed5381";

// ── Вкладка Эфиры ─────────────────────────────────────────────────────────────
function fmtDur(sec?: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StreamsTab({ setPage }: { setPage: (p: Page) => void }) {
  const { streams, updateStream, deleteStream, reload } = useStore();
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");
  const [stopping, setStopping] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { reload(); }, []);

  const handleStop = async (id: string) => {
    setStopping(id);
    try {
      await updateStream(id, { isLive: false } as never);
      await reload();
    } catch { /* ignore */ }
    finally { setStopping(null); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteStream(id);
      setConfirmDel(null);
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  const live = streams.filter(s => s.isLive);
  const filtered = streams.filter(s => {
    if (filter === "live") return s.isLive;
    if (filter === "ended") return !s.isLive;
    return true;
  }).filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.sellerName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Всего эфиров", value: streams.length, icon: "PlayCircle", color: "text-muted-foreground" },
          { label: "Сейчас в эфире", value: live.length, icon: "Radio", color: "text-red-500" },
          { label: "Завершённых", value: streams.filter(s => !s.isLive).length, icon: "CheckCircle", color: "text-green-500" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 text-center">
            <Icon name={s.icon} size={16} className={`${s.color} mx-auto mb-1`} />
            <div className="font-oswald text-xl font-semibold">{s.value}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Поиск */}
      <div className="relative mb-3">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию или продавцу..."
          className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary/50"
        />
      </div>

      {/* Фильтры */}
      <div className="flex gap-1.5 mb-4">
        {([["all", "Все"], ["live", "Сейчас"], ["ended", "Завершённые"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              filter === key
                ? key === "live" ? "bg-red-500 text-white" : "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground bg-secondary"
            }`}>
            {label}
            {key === "live" && live.length > 0 && (
              <span className="ml-1 bg-white/30 text-inherit text-[10px] px-1 rounded-full">{live.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Список */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="Radio" size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Эфиров не найдено</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map(s => (
            <div key={s.id} className={`bg-card border rounded-xl overflow-hidden ${s.isLive ? "border-red-500/40" : "border-border"}`}>
              <div className="flex gap-3 p-3">
                {/* Превью */}
                <div className="w-20 h-14 rounded-lg overflow-hidden bg-secondary flex-shrink-0 relative">
                  {s.thumbnail
                    ? <img src={s.thumbnail} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <Icon name={s.isLive ? "Radio" : "PlayCircle"} size={20} className={s.isLive ? "text-red-400" : "text-muted-foreground opacity-40"} />
                      </div>
                  }
                  {s.isLive && (
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                      <span className="flex items-center gap-1 text-[9px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">
                        <span className="w-1 h-1 rounded-full bg-white animate-live-pulse" />LIVE
                      </span>
                    </div>
                  )}
                </div>
                {/* Инфо */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-4 h-4 rounded-full bg-primary/20 text-[9px] font-bold flex items-center justify-center text-primary flex-shrink-0">
                      {s.sellerAvatar || s.sellerName[0]}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{s.sellerName}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Icon name="Calendar" size={10} />{s.startedAt}</span>
                    {s.duration && <span className="flex items-center gap-1"><Icon name="Clock" size={10} />{fmtDur(s.duration)}</span>}
                    <span className="flex items-center gap-1"><Icon name="Eye" size={10} />{s.viewers}</span>
                  </div>
                </div>
              </div>

              {/* Действия */}
              <div className="flex border-t border-border">
                {s.isLive ? (
                  <>
                    <button
                      onClick={() => setPage("streams")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Icon name="Eye" size={12} />
                      Смотреть
                    </button>
                    <div className="w-px bg-border" />
                    <button
                      onClick={() => handleStop(s.id)}
                      disabled={stopping === s.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                    >
                      {stopping === s.id ? <Icon name="Loader" size={12} className="animate-spin" /> : <Icon name="Square" size={12} />}
                      Завершить
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setPage("streams")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Icon name="Play" size={12} />
                      Смотреть
                    </button>
                    <div className="w-px bg-border" />
                    <button
                      onClick={() => setConfirmDel(s.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <Icon name="Trash2" size={12} />
                      Удалить
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-destructive" />
            </div>
            <h3 className="font-oswald text-lg font-semibold text-center mb-2">Удалить эфир?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">Запись и все данные эфира будут удалены.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 border border-border font-semibold py-2.5 rounded-xl hover:bg-secondary text-sm">
                Отмена
              </button>
              <button
                onClick={() => handleDelete(confirmDel)}
                disabled={deleting === confirmDel}
                className="flex-1 bg-destructive text-white font-semibold py-2.5 rounded-xl hover:opacity-90 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {deleting === confirmDel ? <Icon name="Loader" size={14} className="animate-spin" /> : null}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AdminPageProps {
  setPage: (p: Page) => void;
}

const ROLE_LABELS: Record<string, string> = {
  user: "Пользователь",
  admin: "Администратор",
};

export default function AdminPage({ setPage }: AdminPageProps) {
  const { user, getAllUsers, blockUser, unblockUser, deleteUser } = useAuth();
  const [users, setUsers] = useState<(User & { password: string })[]>(() => getAllUsers());
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user">("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "cdek" | "chats" | "streams">("chats");

  // СДЭК настройки
  const [cdekId, setCdekId] = useState("aKDJq0vBV0kRgFKQsJY5vZ77OZfFmP9T");
  const [cdekSecret, setCdekSecret] = useState("");
  const [cdekTesting, setCdekTesting] = useState(false);
  const [cdekResult, setCdekResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const testCdek = async () => {
    if (!cdekId.trim() || !cdekSecret.trim()) {
      setCdekResult({ ok: false, msg: "Введите Client ID и пароль" });
      return;
    }
    setCdekTesting(true);
    setCdekResult(null);
    try {
      const res = await fetch(`${CDEK_API}?action=test_auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: cdekId.trim(), client_secret: cdekSecret.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setCdekResult({ ok: true, msg: data.msg || "Подключено!" });
      } else {
        setCdekResult({ ok: false, msg: data.msg || "Ошибка авторизации. Проверьте ключи." });
      }
    } catch {
      setCdekResult({ ok: false, msg: "Ошибка подключения к серверу" });
    } finally {
      setCdekTesting(false);
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <Icon name="ShieldOff" size={36} className="mx-auto mb-4 text-muted-foreground opacity-40" />
        <h2 className="font-oswald text-xl font-semibold text-foreground mb-2">Нет доступа</h2>
        <p className="text-sm text-muted-foreground mb-5">Эта страница доступна только администратору</p>
        <button onClick={() => setPage("home")} className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
          На главную
        </button>
      </div>
    );
  }

  const refresh = () => setUsers(getAllUsers());

  const handleBlock = (id: string) => {
    blockUser(id);
    refresh();
  };

  const handleUnblock = (id: string) => {
    unblockUser(id);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteUser(id);
    setConfirmDelete(null);
    refresh();
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => !u.isBlocked).length,
    blocked: users.filter(u => u.isBlocked).length,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Панель администратора</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Управление платформой</p>
        </div>
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-xs font-semibold px-3 py-1.5 rounded-full">
          <Icon name="ShieldCheck" size={13} />
          ADMIN
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1 mb-6 bg-secondary rounded-xl p-1 w-fit">
        {([["chats", "Чаты"], ["streams", "Эфиры"], ["users", "Пользователи"], ["cdek", "СДЭК"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              activeTab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── ВКЛАДКА ЧАТЫ ── */}
      {activeTab === "chats" && <ChatsTab />}

      {/* ── ВКЛАДКА ЭФИРЫ ── */}
      {activeTab === "streams" && <StreamsTab setPage={setPage} />}

      {/* ── ВКЛАДКА СДЭК ── */}
      {activeTab === "cdek" && (
        <div className="max-w-lg animate-fade-in space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#00AAFF]/10 flex items-center justify-center">
                <Icon name="Truck" size={16} className="text-[#00AAFF]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Настройки API СДЭК</p>
                <p className="text-xs text-muted-foreground">Ключи из личного кабинета СДЭК → Интеграция → API</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Account / Client ID</label>
              <input
                value={cdekId}
                onChange={e => setCdekId(e.target.value)}
                placeholder="aKDJq0vBV0kRgFKQsJY5vZ77OZfFmP9T"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Secure password / Пароль</label>
              <input
                value={cdekSecret}
                onChange={e => setCdekSecret(e.target.value)}
                placeholder="Вставьте Secure password из кабинета СДЭК"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            {cdekResult && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
                cdekResult.ok ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
              }`}>
                <Icon name={cdekResult.ok ? "CheckCircle" : "AlertCircle"} size={16} />
                {cdekResult.msg}
              </div>
            )}

            <button
              onClick={testCdek}
              disabled={cdekTesting || !cdekId.trim()}
              className="w-full bg-[#00AAFF] text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {cdekTesting
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Проверяю...</>
                : <><Icon name="Zap" size={16} /> Проверить подключение</>
              }
            </button>
          </div>

          <div className="bg-secondary/50 rounded-xl px-4 py-3 text-xs text-muted-foreground">
            <Icon name="Info" size={12} className="inline mr-1.5 mb-0.5" />
            Ключи сохраняются через платформу. Здесь можно только проверить подключение.
          </div>
        </div>
      )}

      {/* ── ВКЛАДКА ПОЛЬЗОВАТЕЛИ ── */}
      {activeTab === "users" && <>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: "Users", value: stats.total, label: "Всего пользователей" },
          { icon: "CircleCheck", value: stats.active, label: "Активных" },
          { icon: "Ban", value: stats.blocked, label: "Заблокировано", danger: true },
        ].map((s, i) => (
          <div key={i} className={`bg-card border rounded-xl p-4 ${s.danger && s.value > 0 ? "border-destructive/30" : "border-border"}`}>
            <Icon name={s.icon} size={16} className={`mb-2 ${s.danger ? "text-destructive" : "text-muted-foreground"}`} />
            <div className={`font-oswald text-2xl font-semibold ${s.danger && s.value > 0 ? "text-destructive" : "text-foreground"}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Фильтры */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {(["all", "user"] as const).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                roleFilter === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "all" ? "Все" : "Пользователи"}
            </button>
          ))}
        </div>
      </div>

      {/* Список пользователей */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Icon name="Users" size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{users.length === 0 ? "Пользователей пока нет" : "Не найдено"}</p>
          {users.length === 0 && (
            <p className="text-sm mt-1">Пользователи появятся после регистрации</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(u => (
            <div
              key={u.id}
              className={`bg-card border rounded-xl p-4 flex items-center gap-4 transition-colors ${
                u.isBlocked ? "border-destructive/20 bg-destructive/3" : "border-border"
              }`}
            >
              {/* Аватар */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                u.isBlocked ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
              }`}>
                {u.avatar}
              </div>

              {/* Данные */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{u.name}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    {ROLE_LABELS[u.role] ?? "Пользователь"}
                  </span>
                  {u.isBlocked && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                      ЗАБЛОКИРОВАН
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                {u.city && <p className="text-xs text-muted-foreground">{u.city} · с {u.joinedAt}</p>}
              </div>

              {/* Действия */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {u.isBlocked ? (
                  <button
                    onClick={() => handleUnblock(u.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-green-600 border border-green-600/30 px-3 py-1.5 rounded-lg hover:bg-green-600/10 transition-colors"
                  >
                    <Icon name="CheckCircle" size={13} />
                    Разблокировать
                  </button>
                ) : (
                  <button
                    onClick={() => handleBlock(u.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-orange-500 border border-orange-500/30 px-3 py-1.5 rounded-lg hover:bg-orange-500/10 transition-colors"
                  >
                    <Icon name="Ban" size={13} />
                    Заблокировать
                  </button>
                )}
                <button
                  onClick={() => setConfirmDelete(u.id)}
                  className="w-8 h-8 rounded-lg border border-destructive/20 flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Icon name="Trash2" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-destructive" />
            </div>
            <h3 className="font-oswald text-lg font-semibold text-foreground text-center mb-2">Удалить пользователя?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Это действие нельзя отменить. Все данные пользователя будут удалены.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-border text-foreground font-semibold py-2.5 rounded-xl hover:bg-secondary transition-colors text-sm"
              >
                Отмена
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-destructive text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}