import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";

type AuthMode = "login" | "register";

interface AuthPageProps {
  onSuccess: () => void;
}

export default function AuthPage({ onSuccess }: AuthPageProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Заполните все обязательные поля");
      return;
    }
    if (mode === "register") {
      if (!name.trim()) { setError("Введите имя"); return; }
      if (password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
      if (password !== confirm) { setError("Пароли не совпадают"); return; }
    }
    setLoading(true);
    let err: string | null;
    if (mode === "login") {
      err = await login(email, password);
    } else {
      err = await register({ name, email, phone, password, role: "user", city });
    }
    setLoading(false);
    if (err) { setError(err); return; }
    onSuccess();
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 animate-fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-oswald text-3xl font-semibold text-foreground tracking-wider mb-2">
            <span className="text-primary">БАЗАР</span>.РФ
          </div>
          <h1 className="text-xl font-semibold text-foreground mt-4">
            {mode === "login" ? "Войти в аккаунт" : "Создать аккаунт"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Рады видеть вас снова" : "Живой торг — без посредников"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {/* Переключатель режима */}
          <div className="flex bg-secondary rounded-xl p-1 mb-6">
            {(["login", "register"] as AuthMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {/* Имя */}
            {mode === "register" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Имя и фамилия *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Анна Иванова"
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            {/* Телефон и город */}
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Телефон</label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+7 900 000-00-00"
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Город</label>
                  <input
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Москва"
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Пароль */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Пароль *</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder={mode === "register" ? "Минимум 6 символов" : "Введите пароль"}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name={showPass ? "EyeOff" : "Eye"} size={15} />
                </button>
              </div>
            </div>

            {/* Подтверждение пароля */}
            {mode === "register" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Повторите пароль *</label>
                <input
                  type={showPass ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="Повторите пароль"
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            )}

            {/* Ошибка */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}