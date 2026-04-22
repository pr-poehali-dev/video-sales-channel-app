import { useState, lazy, Suspense, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { StoreProvider } from "@/context/StoreContext";
import { PriceModeProvider } from "@/context/PriceModeContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
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
import AdminProductsPage from "@/pages/AdminProductsPage";
import AdminStreamsPage from "@/pages/AdminStreamsPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import SellerRegisterPage from "@/pages/SellerRegisterPage";
import WelcomePage from "@/pages/WelcomePage";
import SupportPage from "@/pages/SupportPage";
import SupportAdminPage from "@/pages/SupportAdminPage";
import OrderSuccessPage from "@/pages/OrderSuccessPage";
import FavoritesPage from "@/pages/FavoritesPage";
import OfertaSellerPage from "@/pages/OfertaSellerPage";
import OfertaBuyerPage from "@/pages/OfertaBuyerPage";
import NavBar from "@/components/NavBar";
import LiveBroadcastBar from "@/components/LiveBroadcastBar";
import PWAInstallBanner from "@/components/PWAInstallBanner";

const BroadcastPage = lazy(() => import("@/pages/BroadcastPage"));

export type Page =
  | "home" | "streams" | "catalog" | "profile" | "cart" | "favorites"
  | "dashboard" | "product" | "seller" | "auth" | "broadcast" | "admin" | "seller-register"
  | "support" | "support-admin" | "order-success" | "admin-products" | "admin-streams" | "admin-users"
  | "oferta-seller" | "oferta-buyer" | "welcome";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  qty: number;
  sellerId?: string;
  sellerName?: string;
  fromCityCode?: string;
  weightG?: number;
  videoUrl?: string;
  wholesalePrice?: number | null;
  retailMarkupPct?: number;
  isUsed?: boolean;
}

function AppInner() {
  const initialPage = (): Page => {
    const path = window.location.pathname;
    if (path === "/order-success") return "order-success";
    return "home";
  };

  const [page, setPage] = useState<Page>(initialPage);
  const [authInitialEmail, setAuthInitialEmail] = useState("");
  const [openAddProduct, setOpenAddProduct] = useState(false);
  const [sellerRegisterProfileType, setSellerRegisterProfileType] = useState<"individual" | "legal">("legal");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
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
  const clearCart = () => setCart([]);

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
      {page !== "product" && <NavBar page={page} setPage={navSetPage} cartCount={cart.reduce((s, c) => s + c.qty, 0)} />}
      <LiveBroadcastBar page={page} setPage={navSetPage} />
      <main className={page === "product" ? "" : "pb-16 md:pb-0"}>
        {page === "home" && <HomePage setPage={navSetPage} addToCart={addToCart} updateQty={updateQty} cart={cart} onProductClick={openProduct} />}
        {page === "streams" && <StreamsPage setPage={navSetPage} addToCart={addToCart} onProductClick={openProduct} />}
        {page === "catalog" && <CatalogPage addToCart={addToCart} updateQty={updateQty} cart={cart} onProductClick={openProduct} />}
        {page === "profile" && <ProfilePage setPage={navSetPage} onSetSellerRegisterType={setSellerRegisterProfileType} />}
        {page === "cart" && <CartPage cart={cart} removeFromCart={removeFromCart} updateQty={updateQty} onGoToAuth={(email) => { setAuthInitialEmail(email || ""); navSetPage("auth"); }} setPage={navSetPage} />}
        {page === "dashboard" && <DashboardPage setPage={navSetPage} openAddProduct={openAddProduct} onAutoOpenDone={() => setOpenAddProduct(false)} />}
        {page === "auth" && <AuthPage onSuccess={(isNew) => navSetPage(isNew ? "welcome" : "home")} initialEmail={authInitialEmail} />}
        {page === "welcome" && <WelcomePage setPage={navSetPage} />}
        {broadcastMounted && (
          <div className={page !== "broadcast" ? "hidden" : ""}>
            <Suspense fallback={null}>
              <BroadcastPage setPage={navSetPage} onLiveChange={handleLiveChange} />
            </Suspense>
          </div>
        )}
        {page === "admin" && <AdminPage setPage={navSetPage} />}
        {page === "admin-products" && <AdminProductsPage setPage={navSetPage} />}
        {page === "admin-streams" && <AdminStreamsPage setPage={navSetPage} />}
        {page === "admin-users" && <AdminUsersPage setPage={navSetPage} />}
        {page === "seller-register" && <SellerRegisterPage setPage={navSetPage} initialProfileType={sellerRegisterProfileType} onGoAddProduct={() => { setOpenAddProduct(true); navSetPage("dashboard"); }} />}
        {page === "support" && <SupportPage setPage={navSetPage} />}
        {page === "support-admin" && <SupportAdminPage setPage={navSetPage} />}
        {page === "order-success" && <OrderSuccessPage setPage={navSetPage} clearCart={clearCart} />}
        {page === "favorites" && <FavoritesPage addToCart={addToCart} updateQty={updateQty} cart={cart} onProductClick={openProduct} />}
        {page === "oferta-seller" && <OfertaSellerPage setPage={navSetPage} />}
        {page === "oferta-buyer" && <OfertaBuyerPage setPage={navSetPage} />}
        {page === "product" && selectedProductId !== null && (
          <ProductPage
            productId={selectedProductId}
            addToCart={addToCart}
            updateQty={updateQty}
            cart={cart}
            onBack={goBack}
            onSellerClick={openSeller}
          />
        )}
        {page === "seller" && selectedSellerId !== null && (
          <SellerPage
            sellerId={selectedSellerId}
            addToCart={addToCart}
            updateQty={updateQty}
            cart={cart}
            onBack={goBack}
            onProductClick={openProduct}
            setPage={navSetPage}
          />
        )}
      </main>
      <PWAInstallBanner />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <PriceModeProvider>
          <FavoritesProvider>
            <TooltipProvider>
              <Toaster />
              <AppInner />
            </TooltipProvider>
          </FavoritesProvider>
        </PriceModeProvider>
      </StoreProvider>
    </AuthProvider>
  );
}