import { useState, lazy, Suspense, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { StoreProvider } from "@/context/StoreContext";
import HomePage from "@/pages/HomePage";
import StreamsPage from "@/pages/StreamsPage";
import CatalogPage from "@/pages/CatalogPage";
import ProfilePage from "@/pages/ProfilePage";
import CartPage from "@/pages/CartPage";
import DashboardPage from "@/pages/DashboardPage";
import ProductPage from "@/pages/ProductPage";
import SellerPage from "@/pages/SellerPage";
import AuthPage from "@/pages/AuthPage";
import AdminPage from "@/pages/AdminPage";
import SellerRegisterPage from "@/pages/SellerRegisterPage";
import SupportPage from "@/pages/SupportPage";
import SupportAdminPage from "@/pages/SupportAdminPage";
import NavBar from "@/components/NavBar";
import LiveBroadcastBar from "@/components/LiveBroadcastBar";

const BroadcastPage = lazy(() => import("@/pages/BroadcastPage"));

export type Page =
  | "home" | "streams" | "catalog" | "profile" | "cart"
  | "dashboard" | "product" | "seller" | "auth" | "broadcast" | "admin" | "seller-register"
  | "support" | "support-admin";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  qty: number;
  fromCityCode?: number;
  weightG?: number;
  videoUrl?: string;
}

function AppInner() {
  const [page, setPage] = useState<Page>("home");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState<Page>("catalog");
  const [broadcastMounted, setBroadcastMounted] = useState(false);

  const handleLiveChange = useCallback((_live: boolean) => {
  }, []);

  const addToCart = (item: Omit<CartItem, "qty">) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty } : c));
  };

  const openProduct = (productId: string) => {
    setPrevPage(page);
    setSelectedProductId(productId);
    setPage("product");
  };

  const openSeller = (sellerId: string) => {
    setPrevPage(page);
    setSelectedSellerId(sellerId);
    setPage("seller");
  };

  const goBack = () => setPage(prevPage);

  const navSetPage = (p: Page) => {
    if (p !== "product" && p !== "seller") setPrevPage(p);
    if (p === "broadcast") setBroadcastMounted(true);
    setPage(p);
  };

  return (
    <div className="min-h-screen bg-background font-golos">
      <NavBar page={page} setPage={navSetPage} cartCount={cart.reduce((s, c) => s + c.qty, 0)} />
      <LiveBroadcastBar page={page} setPage={navSetPage} />
      <main className={page === "product" ? "" : "pb-16 md:pb-0"}>
        {page === "home" && <HomePage setPage={navSetPage} addToCart={addToCart} onProductClick={openProduct} />}
        {page === "streams" && <StreamsPage setPage={navSetPage} addToCart={addToCart} onProductClick={openProduct} />}
        {page === "catalog" && <CatalogPage addToCart={addToCart} onProductClick={openProduct} />}
        {page === "profile" && <ProfilePage setPage={navSetPage} />}
        {page === "cart" && <CartPage cart={cart} removeFromCart={removeFromCart} updateQty={updateQty} />}
        {page === "dashboard" && <DashboardPage setPage={navSetPage} />}
        {page === "auth" && <AuthPage onSuccess={() => navSetPage("home")} />}
        {broadcastMounted && (
          <div className={page !== "broadcast" ? "hidden" : ""}>
            <Suspense fallback={null}>
              <BroadcastPage setPage={navSetPage} onLiveChange={handleLiveChange} />
            </Suspense>
          </div>
        )}
        {page === "admin" && <AdminPage setPage={navSetPage} />}
        {page === "seller-register" && <SellerRegisterPage setPage={navSetPage} />}
        {page === "support" && <SupportPage setPage={navSetPage} />}
        {page === "support-admin" && <SupportAdminPage setPage={navSetPage} />}
        {page === "product" && selectedProductId !== null && (
          <ProductPage
            productId={selectedProductId}
            addToCart={addToCart}
            onBack={goBack}
            onSellerClick={openSeller}
          />
        )}
        {page === "seller" && selectedSellerId !== null && (
          <SellerPage
            sellerId={selectedSellerId}
            addToCart={addToCart}
            onBack={goBack}
            onProductClick={openProduct}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <TooltipProvider>
          <Toaster />
          <AppInner />
        </TooltipProvider>
      </StoreProvider>
    </AuthProvider>
  );
}