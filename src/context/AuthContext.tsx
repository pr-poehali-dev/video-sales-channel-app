import { createContext, useContext, useState, type ReactNode } from "react";

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar: string;
  city: string;
  joinedAt: string;
  isBlocked?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<string | null>;
  register: (data: RegisterData) => Promise<string | null>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  getAllUsers: () => (User & { password: string })[];
  blockUser: (id: string) => void;
  unblockUser: (id: string) => void;
  deleteUser: (id: string) => void;
}

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  city: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_KEY = "yugastore_users";
const SESSION_KEY = "yugastore_session";

// Аккаунт администратора — только через жёстко заданные данные, не хранится в списке пользователей
const ADMIN_EMAIL = "admin@yugastore.ru";
const ADMIN_PASSWORD = "admin2024";
const ADMIN_USER: User = {
  id: "admin_root",
  name: "Администратор",
  email: ADMIN_EMAIL,
  role: "admin",
  avatar: "АД",
  phone: "",
  city: "",
  joinedAt: "январь 2024",
};

function getUsers(): (User & { password: string })[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users: (User & { password: string })[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const login = async (email: string, password: string): Promise<string | null> => {
    // Проверяем admin
    if (email.toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setUser(ADMIN_USER);
      localStorage.setItem(SESSION_KEY, JSON.stringify(ADMIN_USER));
      return null;
    }
    const users = getUsers();
    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!found) return "Неверный email или пароль";
    if (found.isBlocked) return "Ваш аккаунт заблокирован. Обратитесь к администратору.";
    const { password: _, ...userData } = found;
    setUser(userData);
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    return null;
  };

  const register = async (data: RegisterData): Promise<string | null> => {
    if (data.email.toLowerCase() === ADMIN_EMAIL) return "Этот email недоступен для регистрации";
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return "Пользователь с таким email уже существует";
    }
    const newUser: User & { password: string } = {
      id: `user_${Date.now()}`,
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: "user",
      avatar: initials(data.name),
      city: data.city,
      joinedAt: new Date().toLocaleDateString("ru", { month: "long", year: "numeric" }),
      password: data.password,
      isBlocked: false,
    };
    saveUsers([...users, newUser]);
    const { password: _, ...userData } = newUser;
    setUser(userData);
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    return null;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const updateUser = (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    const users = getUsers().map(u => u.id === updated.id ? { ...u, ...data } : u);
    saveUsers(users);
  };

  const getAllUsers = () => getUsers();

  const blockUser = (id: string) => {
    const users = getUsers().map(u => u.id === id ? { ...u, isBlocked: true } : u);
    saveUsers(users);
  };

  const unblockUser = (id: string) => {
    const users = getUsers().map(u => u.id === id ? { ...u, isBlocked: false } : u);
    saveUsers(users);
  };

  const deleteUser = (id: string) => {
    const users = getUsers().filter(u => u.id !== id);
    saveUsers(users);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, getAllUsers, blockUser, unblockUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}