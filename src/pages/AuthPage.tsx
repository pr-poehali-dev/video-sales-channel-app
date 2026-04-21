import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";

type AuthMode = "login" | "register" | "reset_request" | "reset_confirm";

interface AuthPageProps {
  onSuccess: (isNewUser?: boolean) => void;
  initialEmail?: string;
}

export default function AuthPage({ onSuccess, initialEmail = "" }: AuthPageProps) {
  const { login, register, requestReset, confirmReset } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState(initialEmail);

  const switchMode = (m: AuthMode) => { setMode(m); setError(null); };

  const handleSubmit = async () => {
    setError(null);

    if (mode === "reset_request") {
      if (!resetEmail.trim()) { setError("Введите email"); return; }
      setLoading(true);
      const e = await requestReset(resetEmail.trim());
      setLoading(false);
      if (e) { setError(e); return; }
      switchMode("reset_confirm");
      return;
    }

    if (mode === "reset_confirm") {
      if (!resetCode.trim()) { setError("Введите код из письма"); return; }
      if (password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
      if (password !== confirm) { setError("Пароли не совпадают"); return; }
      setLoading(true);
      const e = await confirmReset(resetEmail.trim(), resetCode.trim(), password);
      setLoading(false);
      if (e) { setError(e); return; }
      onSuccess();
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError(mode === "login" ? "Введите email или телефон и пароль" : "Заполните все обязательные поля");
      return;
    }
    if (mode === "register") {
      if (password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
      if (password !== confirm) { setError("Пароли не совпадают"); return; }
    }
    setLoading(true);
    let err: string | null;
    if (mode === "login") {
      err = await login(email, password);
    } else {
      err = await register({ name: "", email, phone, password, role: "user", city: "" });
    }
    setLoading(false);
    if (err) { setError(err); return; }
    onSuccess(mode === "register");
  };

  const isReset = mode === "reset_request" || mode === "reset_confirm";

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 animate-fade-in">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-oswald text-3xl font-semibold text-foreground tracking-wider mb-2">
            <span className="font-light text-foreground">стрим</span><span className="text-primary">БАЗАР</span>.РФ
          </div>
          <h1 className="text-xl font-semibold text-foreground mt-4">
            {mode === "login" && "Войти в аккаунт"}
            {mode === "register" && "Создать аккаунт"}
            {mode === "reset_request" && "Восстановление пароля"}
            {mode === "reset_confirm" && "Новый пароль"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" && "Рады видеть вас снова"}
            {mode === "register" && "Живой торг — без посредников"}
            {mode === "reset_request" && "Отправим код на вашу почту"}
            {mode === "reset_confirm" && `Код отправлен на ${resetEmail}`}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {/* Переключатель режима — только для login/register */}
          {!isReset && (
            <div className="flex bg-secondary rounded-xl p-1 mb-6">
              {(["login", "register"] as AuthMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "login" ? "Вход" : "Регистрация"}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {/* ── RESET REQUEST ── */}
            {mode === "reset_request" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email *</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="you@example.com"
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            )}

            {/* ── RESET CONFIRM ── */}
            {mode === "reset_confirm" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Код из письма *</label>
                  <input
                    value={resetCode}
                    onChange={e => setResetCode(e.target.value)}
                    placeholder="123456"
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors tracking-widest"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Новый пароль *</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Минимум 6 символов"
                      className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showPass ? "EyeOff" : "Eye"} size={15} />
                    </button>
                  </div>
                </div>
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
              </>
            )}

            {/* ── LOGIN / REGISTER ── */}
            {!isReset && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {mode === "login" ? "Email или телефон *" : "Email *"}
                  </label>
                  <input
                    type={mode === "login" ? "text" : "email"}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={mode === "login" ? "you@example.com или +7 900..." : "you@example.com"}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                  />
                </div>



                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">Пароль *</label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => { setResetEmail(email); switchMode("reset_request"); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Забыли пароль?
                      </button>
                    )}
                  </div>
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
              </>
            )}

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
              {loading ? "Загрузка..." : mode === "login" ? "Войти" : mode === "register" ? "Создать аккаунт" : mode === "reset_request" ? "Отправить код" : "Сохранить пароль"}
            </button>

            {isReset && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                ← Вернуться ко входу
              </button>
            )}

            {mode === "reset_confirm" && (
              <button
                type="button"
                onClick={() => { switchMode("reset_request"); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Не пришёл код? Отправить снова
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}