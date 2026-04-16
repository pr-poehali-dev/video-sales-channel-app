import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";
import AdminChatsTab from "@/components/admin/AdminChatsTab";
import AdminStreamsTab from "@/components/admin/AdminStreamsTab";
import AdminCdekTab from "@/components/admin/AdminCdekTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminTestOrderTab from "@/components/admin/AdminTestOrderTab";

interface AdminPageProps {
  setPage: (p: Page) => void;
}

export default function AdminPage({ setPage }: AdminPageProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"users" | "cdek" | "chats" | "streams" | "test_order">("chats");

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
        {([["chats", "Чаты"], ["streams", "Эфиры"], ["users", "Пользователи"], ["cdek", "СДЭК"], ["test_order", "Тест-заказ"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              activeTab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "chats" && <AdminChatsTab />}
      {activeTab === "streams" && <AdminStreamsTab setPage={setPage} />}
      {activeTab === "cdek" && <AdminCdekTab />}
      {activeTab === "users" && <AdminUsersTab />}
      {activeTab === "test_order" && <AdminTestOrderTab />}
    </div>
  );
}