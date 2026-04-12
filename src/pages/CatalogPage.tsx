import { useState } from "react";
import Icon from "@/components/ui/icon";
import { products, CATEGORIES } from "@/data/mockData";
import ProductCard from "@/components/ProductCard";
import type { CartItem } from "@/App";

interface CatalogPageProps {
  addToCart: (item: Omit<CartItem, "qty">) => void;
  onProductClick: (productId: number) => void;
}

export default function CatalogPage({ addToCart, onProductClick }: CatalogPageProps) {
  const [category, setCategory] = useState("Все");
  const [sort, setSort] = useState("popular");
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
      if (sort === "rating") return b.rating - a.rating;
      return b.reviews - a.reviews;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-oswald text-2xl font-semibold text-foreground tracking-wide">Каталог товаров</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} товаров</span>
      </div>

      {/* Search + Sort */}
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
          <option value="popular">По популярности</option>
          <option value="rating">По рейтингу</option>
          <option value="price_asc">Сначала дешевле</option>
          <option value="price_desc">Сначала дороже</option>
        </select>
      </div>

      {/* Categories */}
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

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Icon name="PackageSearch" size={40} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">Товары не найдены</p>
          <p className="text-sm mt-1">Попробуй изменить фильтры или поисковый запрос</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((product, i) => (
            <div key={product.id} className="animate-fade-in" style={{ opacity: 0, animationDelay: `${i * 50}ms` }}>
              <ProductCard
                product={product}
                addToCart={addToCart}
                onClick={() => onProductClick(product.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
