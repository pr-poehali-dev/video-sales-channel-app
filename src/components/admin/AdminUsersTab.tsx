import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth, type User } from "@/context/AuthContext";

const ROLE_LABELS: Record<string, string> = {
  user: "Пользователь",
  admin: "Администратор",
};

export default function AdminUsersTab() {
  const { getAllUsers, blockUser, unblockUser, deleteUser } = useAuth();
  const [users, setUsers] = useState<(User & { password: string })[]>(() => getAllUsers());
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user">("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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
    <>
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
    </>
  );
}
