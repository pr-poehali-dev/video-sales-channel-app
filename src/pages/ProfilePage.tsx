import { useState } from "react";
import Icon from "@/components/ui/icon";
import type { Page } from "@/App";
import { useAuth } from "@/context/AuthContext";

interface ProfilePageProps {
  setPage: (p: Page) => void;
}

export default function ProfilePage({ setPage }: ProfilePageProps) {
  const { user, logout, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [saved, setSaved] = useState(false);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
          <Icon name="User" size={28} className="text-muted-foreground opacity-40" />
        </div>
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Вы не вошли</h2>
        <p className="text-muted-foreground text-sm mb-6">Войдите или зарегистрируйтесь, чтобы видеть профиль</p>
        <button
          onClick={() => setPage("auth")}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  const handleSave = () => {
    updateUser({ name: name.trim(), phone: phone.trim(), city: city.trim() });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogout = () => {
    logout();
    setPage("home");
  };

  const roleLabel = user.role === "admin" ? "Администратор" : "Пользователь";
  const roleColor = user.role === "admin" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      {/* Шапка */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/20 text-primary text-2xl font-bold flex items-center justify-center font-oswald flex-shrink-0">
          {user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide truncate">{user.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-sm font-medium ${roleColor}`}>{roleLabel}</span>
            {user.city && <span className="text-sm text-muted-foreground">· {user.city}</span>}
            <span className="text-xs text-muted-foreground">· с {user.joinedAt}</span>
          </div>
        </div>
        <button
          onClick={() => { setEditing(!editing); setName(user.name); setPhone(user.phone); setCity(user.city); }}
          className="p-2 rounded-xl border border-border hover:bg-secondary transition-colors"
        >
          <Icon name={editing ? "X" : "Pencil"} size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Уведомление о сохранении */}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-3 rounded-xl mb-5 animate-fade-in">
          <Icon name="CircleCheck" size={15} />
          Данные сохранены
        </div>
      )}

      {/* Форма редактирования */}
      {editing ? (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5 space-y-4 animate-fade-in">
          <h3 className="font-semibold text-foreground">Редактировать профиль</h3>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Имя и фамилия</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Телефон</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+7 900 000-00-00"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Город</label>
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Москва"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              className="bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              Сохранить
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 mb-5 space-y-3">
          <h3 className="font-semibold text-foreground mb-4">Данные аккаунта</h3>
          {[
            { label: "Email", value: user.email, icon: "Mail" },
            { label: "Телефон", value: user.phone || "Не указан", icon: "Phone" },
            { label: "Город", value: user.city || "Не указан", icon: "MapPin" },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <Icon name={row.icon} size={14} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="text-sm text-foreground">{row.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Быстрый доступ в кабинет — для всех пользователей */}
      {user.role !== "admin" && (
        <button
          onClick={() => setPage("dashboard")}
          className="w-full flex items-center justify-between bg-card border border-border rounded-2xl p-4 mb-3 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="LayoutDashboard" size={16} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Мой кабинет</p>
              <p className="text-xs text-muted-foreground">Товары, эфиры, статистика</p>
            </div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
        </button>
      )}

      {/* Для admin — быстрый доступ */}
      {user.role === "admin" && (
        <button
          onClick={() => setPage("admin")}
          className="w-full flex items-center justify-between bg-card border border-destructive/30 rounded-2xl p-4 mb-3 hover:border-destructive/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Icon name="ShieldCheck" size={16} className="text-destructive" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Панель администратора</p>
              <p className="text-xs text-muted-foreground">Пользователи, модерация</p>
            </div>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
        </button>
      )}

      {/* Выход */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 text-destructive border border-destructive/20 rounded-2xl p-4 hover:bg-destructive/5 transition-colors mt-2"
      >
        <Icon name="LogOut" size={16} />
        <span className="text-sm font-medium">Выйти из аккаунта</span>
      </button>
    </div>
  );
}