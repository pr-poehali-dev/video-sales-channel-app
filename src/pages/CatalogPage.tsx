import { useState } from "react";
import Icon from "@/components/ui/icon";
import { useStore } from "@/context/StoreContext";
import ProductCard from "@/components/ProductCard";
import type { CartItem } from "@/App";

const CATEGORIES = ["Все", "Украшения", "Одежда", "Красота", "Аксессуары", "Электроника", "Дом и сад", "Детские товары", "Другое"];

interface CatalogPageProps {
  addToCart: (item: Omit<CartItem, "qty">) => void;
  updateQty?: (id: string, qty: number) => void;
  cart?: CartItem[];
  onProductClick: (productId: string) => void;
}

export default function CatalogPage({ addToCart, updateQty, cart = [], onProductClick }: CatalogPageProps) {
  const { products, loading } = useStore();
  const [category, setCategory] = useState("Все");
  const [sort, setSort] = useState("new");
  const [search, setSearch] = useState("");

  const filtered = products
    .filter(p => {
      const matchCat = category === "Все" || p.category === category;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Каталог товаров</h1>
        {filtered.length > 0 && (
          <span className="text-sm text-muted-foreground">{filtered.length} товар{filtered.length === 1 ? "" : filtered.length < 5 ? "а" : "ов"}</span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-24 animate-fade-in">
          <Icon name="Loader" size={36} className="mx-auto mb-4 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground text-sm">Загружаем товары...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-24 animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
            <Icon name="ShoppingBag" size={36} className="text-muted-foreground opacity-40" />
          </div>
          <h2 className="font-oswald text-xl font-semibold text-foreground tracking-wide mb-2">Товаров пока нет</h2>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Пользователи ещё не добавили товары. Зайди в кабинет и добавь первый!
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                placeholder="Поиск товаров..."
              />
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors cursor-pointer"
            >
              <option value="new">Сначала новые</option>
              <option value="price_asc">Сначала дешевле</option>
              <option value="price_desc">Сначала дороже</option>
            </select>
          </div>

          <div className="flex gap-2 flex-wrap mb-8">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  category === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="PackageSearch" size={40} className="mx-auto mb-4 opacity-40" />
              <p className="text-lg font-medium">Ничего не найдено</p>
              <p className="text-sm mt-1">Попробуй изменить фильтры или поисковый запрос</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((product, i) => (
                <div key={product.id} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <ProductCard
                    product={product}
                    addToCart={addToCart}
                    updateQty={updateQty}
                    cartQty={cart.find(c => c.id === product.id)?.qty ?? 0}
                    onClick={() => onProductClick(product.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}