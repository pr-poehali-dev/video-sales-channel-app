import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePage from "@/pages/HomePage";
import StreamsPage from "@/pages/StreamsPage";
import CatalogPage from "@/pages/CatalogPage";
import ProfilePage from "@/pages/ProfilePage";
import CartPage from "@/pages/CartPage";
import DashboardPage from "@/pages/DashboardPage";
import NavBar from "@/components/NavBar";

export type Page = "home" | "streams" | "catalog" | "profile" | "cart" | "dashboard";

export interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  qty: number;
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (item: Omit<CartItem, "qty">) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty } : c));
  };

  return (
    <TooltipProvider>
      <Toaster />
      <div className="min-h-screen bg-background font-golos">
        <NavBar page={page} setPage={setPage} cartCount={cart.reduce((s, c) => s + c.qty, 0)} />
        <main>
          {page === "home" && <HomePage setPage={setPage} addToCart={addToCart} />}
          {page === "streams" && <StreamsPage />}
          {page === "catalog" && <CatalogPage addToCart={addToCart} />}
          {page === "profile" && <ProfilePage setPage={setPage} />}
          {page === "cart" && <CartPage cart={cart} removeFromCart={removeFromCart} updateQty={updateQty} />}
          {page === "dashboard" && <DashboardPage />}
        </main>
      </div>
    </TooltipProvider>
  );
}
