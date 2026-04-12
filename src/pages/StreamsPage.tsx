import { useState } from "react";
import Icon from "@/components/ui/icon";
import { streams, chatMessages } from "@/data/mockData";
import StreamCard from "@/components/StreamCard";

const TABS = ["Все", "В эфире", "Записи"];

export default function StreamsPage() {
  const [tab, setTab] = useState("Все");
  const [activeStream, setActiveStream] = useState(streams[0]);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState(chatMessages);

  const filtered = streams.filter(s => {
    if (tab === "В эфире") return s.isLive;
    if (tab === "Записи") return !s.isLive;
    return true;
  });

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, {
      id: Date.now(),
      user: "Вы",
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      isHost: false,
    }]);
    setChatInput("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left — active stream */}
        <div className="flex-1 min-w-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
            <div className="video-thumb">
              <img src={activeStream.thumb} alt={activeStream.title} />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur flex items-center justify-center cursor-pointer hover:bg-white/25 transition-colors">
                  <Icon name="Play" size={28} className="text-white ml-1" />
                </div>
              </div>
              {activeStream.isLive && (
                <>
                  <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded">
                    <span className="w-2 h-2 rounded-full bg-white animate-live-pulse inline-block" />
                    LIVE
                  </div>
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2.5 py-1.5 rounded">
                    <Icon name="Eye" size={13} />
                    {activeStream.viewers.toLocaleString("ru")} зрителей
                  </div>
                </>
              )}
            </div>

            <div className="p-4">
              <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">{activeStream.title}</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                    {activeStream.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{activeStream.host}</p>
                    <div className="flex items-center gap-1 text-xs text-yellow-400">
                      <Icon name="Star" size={11} />
                      {activeStream.rating}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name="Heart" size={14} />
                    Подписаться
                  </button>
                  <button className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name="Share2" size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <Icon name="MessageSquare" size={16} className="text-primary" />
              Комментарии (47)
            </h3>
            <div className="space-y-3">
              {[
                { user: "Наталья К.", text: "Отличный эфир! Уже купила серёжки 💕", time: "14:20", rating: 5 },
                { user: "Виктор", text: "Подскажите, есть ли доставка в Казань?", time: "14:18", rating: null },
                { user: "Ирина_shop", text: "Кольцо — просто шедевр, брала 3 раза уже", time: "14:15", rating: 5 },
              ].map((c, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                    {c.user[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-foreground">{c.user}</span>
                      <span className="text-xs text-muted-foreground">{c.time}</span>
                      {c.rating && (
                        <div className="flex">
                          {Array.from({ length: c.rating }).map((_, j) => (
                            <Icon key={j} name="Star" size={10} className="text-yellow-400 fill-yellow-400" />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <input
                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                placeholder="Написать комментарий..."
              />
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                Отправить
              </button>
            </div>
          </div>
        </div>

        {/* Right — chat + list */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {/* Live chat */}
          <div className="bg-card border border-border rounded-xl flex flex-col h-80">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-live-pulse" />
              <span className="text-sm font-medium text-foreground">Живой чат</span>
              <span className="text-xs text-muted-foreground ml-auto">{activeStream.viewers} онлайн</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 chat-scroll">
              {messages.map(msg => (
                <div key={msg.id} className="flex gap-2">
                  <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${msg.isHost ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                    {msg.user[0]}
                  </div>
                  <div>
                    <span className={`text-[11px] font-semibold ${msg.isHost ? "text-primary" : "text-muted-foreground"}`}>
                      {msg.user}
                    </span>
                    <p className="text-xs text-foreground/80">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-border flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                className="flex-1 bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
                placeholder="Написать в чат..."
              />
              <button onClick={sendMessage} className="bg-primary text-primary-foreground p-1.5 rounded-lg hover:opacity-90 transition-opacity">
                <Icon name="Send" size={14} />
              </button>
            </div>
          </div>

          {/* Stream list */}
          <div className="bg-card border border-border rounded-xl">
            <div className="p-3 border-b border-border flex gap-1">
              {TABS.map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveStream(s)}
                  className={`w-full flex gap-2.5 p-3 hover:bg-secondary/50 transition-colors text-left ${activeStream.id === s.id ? "bg-primary/5" : ""}`}
                >
                  <div className="w-16 h-10 rounded overflow-hidden flex-shrink-0 relative">
                    <img src={s.thumb} alt="" className="w-full h-full object-cover" />
                    {s.isLive && (
                      <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-[9px] font-bold text-center py-0.5">
                        LIVE
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.host}</p>
                    {s.isLive && (
                      <p className="text-[10px] text-red-400 font-medium">{s.viewers.toLocaleString("ru")} зрителей</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
