import { createContext, useContext, useState, type ReactNode } from "react";

type PriceMode = "retail" | "wholesale";

interface PriceModeContextValue {
  mode: PriceMode;
  setMode: (m: PriceMode) => void;
}

const PriceModeContext = createContext<PriceModeContextValue>({
  mode: "retail",
  setMode: () => {},
});

export function PriceModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PriceMode>("retail");
  return (
    <PriceModeContext.Provider value={{ mode, setMode }}>
      {children}
    </PriceModeContext.Provider>
  );
}

export function usePriceMode() {
  return useContext(PriceModeContext);
}
