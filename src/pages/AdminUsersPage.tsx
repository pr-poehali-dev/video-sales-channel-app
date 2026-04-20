import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type User } from "@/context/AuthContext";
import type { Page } from "@/App";

interface Props {
  setPage: (p: Page) => void;
}

const ROLE_LABELS: Record<string, string> = {
  user: "Пользователь",
  seller: "Продавец",
  admin: "Администратор",
};

export default function AdminUsersPage({ setPage }: Props) {
  const { user, getAllUsers, blockUser, unblockUser, deleteUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "seller">("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setUsers(await getAllUsers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleBlock = async (id: string) => {
    setBlocking(id);
    try { await blockUser(id); await refresh(); }
    finally { setBlocking(null); }
  };

  const handleUnblock = async (id: string) => {
    setBlocking(id);
    try { await unblockUser(id); await refresh(); }
    finally { setBlocking(null); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try { await deleteUser(id); setConfirmDelete(null); await refresh(); }
    finally { setDeleting(null); }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => !u.isBlocked).length,
    blocked: users.filter(u => u.isBlocked).length,
    sellers: users.filter(u => u.role === "seller").length,
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <Icon name="ShieldOff" size={36} className="mx-auto mb-4 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">Нет доступа</p>
        <button onClick={() => setPage("home")} className="mt-4 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold">
          На главную
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Шапка */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setPage("dashboard")}
            className="p-2 rounded-xl hover:bg-secondary transition-colors">
            <Icon name="ArrowLeft" size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="font-oswald text-lg font-semibold text-foreground leading-tight">Пользователи</h1>
            <p className="text-[11px] text-muted-foreground">Управление и удаление</p>
          </div>
          <button onClick={refresh} className="p-2 rounded-xl hover:bg-secondary transition-colors" title="Обновить">
            <Icon name="RefreshCw" size={16} className={`text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* Статистика */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: "Users", value: stats.total, label: "Всего" },
            { icon: "CircleCheck", value: stats.active, label: "Активных" },
            { icon: "Store", value: stats.sellers, label: "Продавцов" },
            { icon: "Ban", value: stats.blocked, label: "Блок", danger: true },
          ].map((s, i) => (
            <div key={i} className={`bg-card border rounded-xl p-3 text-center ${s.danger && s.value > 0 ? "border-destructive/30" : "border-border"}`}>
              <Icon name={s.icon} size={14} className={`mx-auto mb-1 ${s.danger && s.value > 0 ? "text-destructive" : "text-muted-foreground"}`} />
              <div className={`font-oswald text-xl font-bold ${s.danger && s.value > 0 ? "text-destructive" : "text-foreground"}`}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Фильтры */}
        <div className="space-y-2">
          <div className="relative">
            <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени или email..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="flex gap-1 bg-secondary rounded-xl p-1">
            {([
              ["all", "Все"],
              ["user", "Покупатели"],
              ["seller", "Продавцы"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setRoleFilter(val)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  roleFilter === val ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Список */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card border border-border rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Icon name="Users" size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">{users.length === 0 ? "Пользователей пока нет" : "Не найдено"}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(u => (
              <div
                key={u.id}
                className={`bg-card border rounded-xl p-4 flex items-center gap-3 transition-colors ${
                  u.isBlocked ? "border-destructive/20 bg-destructive/[0.02]" : "border-border"
                }`}
              >
                {/* Аватар */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                  u.isBlocked ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                }`}>
                  {u.avatar || u.name?.[0]?.toUpperCase() || "?"}
                </div>

                {/* Данные */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">{u.name || "—"}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground whitespace-nowrap">
                      {ROLE_LABELS[u.role] ?? "Пользователь"}
                    </span>
                    {u.isBlocked && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive whitespace-nowrap">
                        БЛОК
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                  {(u.phone || u.city) && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[u.phone, u.city].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>

                {/* Действия */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {u.isBlocked ? (
                    <button
                      onClick={() => handleUnblock(u.id)}
                      disabled={blocking === u.id}
                      className="flex items-center gap-1 text-xs font-medium text-green-600 border border-green-600/30 px-2.5 py-1.5 rounded-lg hover:bg-green-600/10 transition-colors disabled:opacity-50"
                    >
                      {blocking === u.id
                        ? <Icon name="Loader" size={12} className="animate-spin" />
                        : <Icon name="CheckCircle" size={12} />
                      }
                      Разблок
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBlock(u.id)}
                      disabled={blocking === u.id || u.role === "admin"}
                      className="flex items-center gap-1 text-xs font-medium text-orange-500 border border-orange-500/30 px-2.5 py-1.5 rounded-lg hover:bg-orange-500/10 transition-colors disabled:opacity-40"
                    >
                      {blocking === u.id
                        ? <Icon name="Loader" size={12} className="animate-spin" />
                        : <Icon name="Ban" size={12} />
                      }
                      Блок
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete(u.id)}
                    disabled={u.role === "admin"}
                    className="w-8 h-8 rounded-lg border border-destructive/20 flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                  >
                    <Icon name="Trash2" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Диалог удаления */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setConfirmDelete(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-destructive" />
            </div>
            <h3 className="font-oswald text-lg font-semibold text-foreground text-center mb-2">Удалить пользователя?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Это действие нельзя отменить. Все данные будут удалены.
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
                disabled={deleting === confirmDelete}
                className="flex-1 bg-destructive text-white font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {deleting === confirmDelete && <Icon name="Loader" size={14} className="animate-spin" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
