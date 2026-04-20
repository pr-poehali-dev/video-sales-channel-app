import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type UserRole = "user" | "admin";

export interface SavedPvz {
  code: string;
  apiship_id?: number;
  address: string;
  name: string;
  cityCode: string;
  cityName: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar: string;
  city: string;
  savedPvz?: SavedPvz | null;
  shopName?: string;
  shopCityCode?: string;
  shopCityName?: string;
  shopCityGuid?: string;
  shopCarriers?: string[];
  joinedAt: string;
  isBlocked?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<string | null>;
  register: (data: RegisterData) => Promise<string | null>;
  logout: () => void;
  updateUser: (data: Partial<User>) => Promise<void>;
  getAllUsers: () => Promise<(User)[]>;
  blockUser: (id: string) => Promise<void>;
  unblockUser: (id: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  requestReset: (email: string) => Promise<string | null>;
  confirmReset: (email: string, code: string, newPassword: string) => Promise<string | null>;
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

const SESSION_KEY = "yugastore_session";
const AUTH_API = "https://functions.poehali.dev/f78c2cf9-b718-4a63-9473-a8f6bcff11f4";

async function authFetch(action: string, body?: object, method = "POST") {
  const res = await fetch(`${AUTH_API}?action=${action}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
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

  const saveSession = (u: User | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  };

  const login = async (emailOrPhone: string, password: string): Promise<string | null> => {
    const isPhone = !emailOrPhone.includes("@");
    const body = isPhone
      ? { phone: emailOrPhone, password }
      : { email: emailOrPhone, password };
    const data = await authFetch("login", body);
    if (data.error) return data.error;
    saveSession(data.user);
    return null;
  };

  const register = async (registerData: RegisterData): Promise<string | null> => {
    const data = await authFetch("register", {
      name: registerData.name,
      email: registerData.email,
      phone: registerData.phone,
      city: registerData.city,
      password: registerData.password,
    });
    if (data.error) return data.error;
    saveSession(data.user);
    return null;
  };

  const logout = () => {
    saveSession(null);
  };

  const updateUser = async (updateData: Partial<User>) => {
    if (!user) return;
    // Поля которые хранятся только локально (не на сервере)
    const localOnlyFields = ["savedPvz"];
    const hasServerFields = Object.keys(updateData).some(k => !localOnlyFields.includes(k));
    if (hasServerFields) {
      const data = await authFetch("update_profile", {
        user_id: user.id,
        name: updateData.name ?? user.name,
        phone: updateData.phone ?? user.phone,
        city: updateData.city ?? user.city,
        shop_name: updateData.shopName ?? user.shopName ?? "",
        shop_city_code: updateData.shopCityCode ?? user.shopCityCode ?? "",
        shop_city_name: updateData.shopCityName ?? user.shopCityName ?? "",
        shop_city_guid: updateData.shopCityGuid ?? user.shopCityGuid ?? "",
        shop_carriers: updateData.shopCarriers ?? user.shopCarriers ?? ["СДЭК"],
      });
      if (!data.error) {
        saveSession({ ...data.user, savedPvz: updateData.savedPvz !== undefined ? updateData.savedPvz : user.savedPvz });
        return;
      }
    } else {
      saveSession({ ...user, ...updateData });
    }
  };

  const getAllUsers = async (): Promise<User[]> => {
    const data = await authFetch("get_all_users", undefined, "GET");
    return data.users || [];
  };

  const blockUser = async (id: string) => {
    await authFetch("block_user", { user_id: id });
  };

  const unblockUser = async (id: string) => {
    await authFetch("unblock_user", { user_id: id });
  };

  const deleteUser = async (id: string) => {
    await authFetch("delete_user", { user_id: id });
  };

  const requestReset = async (email: string): Promise<string | null> => {
    const data = await authFetch("request_reset", { email });
    if (data.error) return data.error;
    return null;
  };

  const confirmReset = async (email: string, code: string, newPassword: string): Promise<string | null> => {
    const data = await authFetch("confirm_reset", { email, code, new_password: newPassword });
    if (data.error) return data.error;
    saveSession(data.user);
    return null;
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, getAllUsers, blockUser, unblockUser, deleteUser, requestReset, confirmReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}