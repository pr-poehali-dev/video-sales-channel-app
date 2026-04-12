import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import type { Page } from "@/App";

interface DashboardPageProps {
  setPage: (p: Page) => void;
}

const PRODUCTS_KEY = "yugastore_my_products";

interface MyProduct {
  id: string;
  name: string;
  price: string;
  category: string;
  description: string;
  createdAt: string;
}

const CATEGORIES = [
  "Украшения", "Одежда", "Красота", "Аксессуары",
  "Электроника", "Дом и сад", "Детские товары", "Другое",
];

function getMyProducts(userId: string): MyProduct[] {
  try {
    const all = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "{}");
    return all[userId] || [];
  } catch {
    return [];
  }
}

function saveMyProducts(userId: string, products: MyProduct[]) {
  try {
    const all = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "{}");
    all[userId] = products;
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(all));
  } catch (_e) {
    // ignore
  }
}

const TABS = ["Товары", "Мои эфиры", "Статистика"];

export default function DashboardPage({ setPage }: DashboardPageProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState("Товары");
  const [products, setProducts] = useState<MyProduct[]>(() => user ? getMyProducts(user.id) : []);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Форма
  const [fName, setFName] = useState("");
  const [fPrice, setFPrice] = useState("");
  const [fCategory, setFCategory] = useState(CATEGORIES[0]);
  const [fDesc, setFDesc] = useState("");
  const [fError, setFError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
          <Icon name="LayoutDashboard" size={28} className="text-muted-foreground opacity-40" />
        </div>
        <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Войдите в аккаунт</h2>
        <p className="text-muted-foreground text-sm mb-6">Для доступа к кабинету необходимо войти</p>
        <button
          onClick={() => setPage("auth")}
          className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  const openAddForm = () => {
    setEditId(null);
    setFName(""); setFPrice(""); setFCategory(CATEGORIES[0]); setFDesc(""); setFError(null);
    setShowForm(true);
  };

  const openEditForm = (p: MyProduct) => {
    setEditId(p.id);
    setFName(p.name); setFPrice(p.price); setFCategory(p.category); setFDesc(p.description); setFError(null);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!fName.trim()) { setFError("Введите название товара"); return; }
    if (!fPrice.trim() || isNaN(Number(fPrice.replace(/\s/g, "")))) { setFError("Введите корректную цену"); return; }
    let updated: MyProduct[];
    if (editId) {
      updated = products.map(p => p.id === editId
        ? { ...p, name: fName.trim(), price: fPrice.trim(), category: fCategory, description: fDesc.trim() }
        : p
      );
    } else {
      const newProduct: MyProduct = {
        id: `prod_${Date.now()}`,
        name: fName.trim(),
        price: fPrice.trim(),
        category: fCategory,
        description: fDesc.trim(),
        createdAt: new Date().toLocaleDateString("ru", { day: "numeric", month: "long" }),
      };
      updated = [newProduct, ...products];
    }
    setProducts(updated);
    saveMyProducts(user.id, updated);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    saveMyProducts(user.id, updated);
    setConfirmDelete(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Мой кабинет</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user.name}{user.city ? ` · ${user.city}` : ""}
          </p>
        </div>
        <button
          onClick={() => setPage("broadcast")}
          className="bg-primary text-primary-foreground font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
          Начать эфир
        </button>
      </div>

      {/* Быстрая статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: "Package", value: products.length.toString(), label: "Товаров" },
          { icon: "Eye", value: "0", label: "Просмотров" },
          { icon: "ShoppingBag", value: "0", label: "Продаж" },
          { icon: "Wallet", value: "0 ₽", label: "Выручка" },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <Icon name={stat.icon} size={16} className="text-muted-foreground mb-2" />
            <div className="font-oswald text-xl font-semibold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Табы */}
      <div className="flex gap-1 mb-6 bg-secondary rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── ТОВАРЫ ── */}
      {tab === "Товары" && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              {products.length > 0 ? `${products.length} товар${products.length === 1 ? "" : products.length < 5 ? "а" : "ов"}` : "Нет товаров"}
            </span>
            <button
              onClick={openAddForm}
              className="flex items-center gap-1.5 text-sm text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors font-medium"
            >
              <Icon name="Plus" size={14} />
              Добавить товар
            </button>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                <Icon name="Package" size={24} className="text-muted-foreground opacity-40" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Товаров пока нет</h3>
              <p className="text-sm text-muted-foreground mb-5">Добавь первый товар, чтобы начать продавать</p>
              <button
                onClick={openAddForm}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                <Icon name="Plus" size={15} />
                Добавить товар
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {products.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon name="Package" size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-oswald text-sm font-semibold text-foreground">
                        {Number(p.price.replace(/\s/g, "")).toLocaleString("ru")} ₽
                      </span>
                      <span className="text-xs text-muted-foreground">{p.category}</span>
                      <span className="text-xs text-muted-foreground">· {p.createdAt}</span>
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openEditForm(p)}
                      className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
                    >
                      <Icon name="Pencil" size={13} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(p.id)}
                      className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors"
                    >
                      <Icon name="Trash2" size={13} className="text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── МОИ ЭФИРЫ ── */}
      {tab === "Мои эфиры" && (
        <div className="animate-fade-in text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="Radio" size={24} className="text-muted-foreground opacity-40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Эфиров пока нет</h3>
          <p className="text-sm text-muted-foreground mb-5">Запусти первую трансляцию прямо с телефона</p>
          <button
            onClick={() => setPage("broadcast")}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            <Icon name="Video" size={15} />
            Начать первый эфир
          </button>
        </div>
      )}

      {/* ── СТАТИСТИКА ── */}
      {tab === "Статистика" && (
        <div className="animate-fade-in text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Icon name="BarChart2" size={24} className="text-muted-foreground opacity-40" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Статистика появится после первых продаж</h3>
          <p className="text-sm text-muted-foreground">Добавь товары и запусти эфир, чтобы увидеть аналитику</p>
        </div>
      )}

      {/* ── МОДАЛ: форма товара ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-oswald text-lg font-semibold text-foreground tracking-wide">
                {editId ? "Редактировать товар" : "Новый товар"}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors"
              >
                <Icon name="X" size={15} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Название *</label>
                <input
                  value={fName}
                  onChange={e => setFName(e.target.value)}
                  placeholder="Например: Серьги золотые с жемчугом"
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Цена, ₽ *</label>
                  <input
                    value={fPrice}
                    onChange={e => setFPrice(e.target.value)}
                    placeholder="1990"
                    inputMode="numeric"
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Категория</label>
                  <select
                    value={fCategory}
                    onChange={e => setFCategory(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
                <textarea
                  value={fDesc}
                  onChange={e => setFDesc(e.target.value)}
                  placeholder="Коротко о товаре: материал, размер, особенности..."
                  rows={3}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors resize-none"
                />
              </div>
              {fError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 text-sm text-destructive">
                  {fError}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-sm"
                >
                  {editId ? "Сохранить" : "Добавить товар"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 border border-border text-muted-foreground font-medium rounded-xl hover:bg-secondary transition-colors text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── МОДАЛ: подтверждение удаления ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="Trash2" size={22} className="text-destructive" />
            </div>
            <h3 className="font-oswald text-lg font-semibold text-foreground text-center mb-2">Удалить товар?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">Это действие нельзя отменить</p>
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
    </div>
  );
}