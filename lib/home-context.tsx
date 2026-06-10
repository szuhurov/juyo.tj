"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Item } from "./services/item-service";

interface HomeState {
  visualSearchResults: Item[] | null;
  isSearchTyping: boolean;
  goHomeSignal: number;
  setVisualSearchResults: (results: Item[] | null) => void;
  setIsSearchTyping: (typing: boolean) => void;
  triggerGoHome: () => void;
}

const HomeContext = createContext<HomeState | null>(null);

export function HomeProvider({ children }: { children: ReactNode }) {
  const [visualSearchResults, setVisualSearchResults] = useState<Item[] | null>(null);
  const [isSearchTyping, setIsSearchTyping] = useState(false);
  const [goHomeSignal, setGoHomeSignal] = useState(0);

  const triggerGoHome = useCallback(() => setGoHomeSignal((n) => n + 1), []);

  return (
    <HomeContext.Provider value={{
      visualSearchResults,
      isSearchTyping,
      goHomeSignal,
      setVisualSearchResults,
      setIsSearchTyping,
      triggerGoHome,
    }}>
      {children}
    </HomeContext.Provider>
  );
}

export function useHomeState() {
  const ctx = useContext(HomeContext);
  if (!ctx) throw new Error("useHomeState must be used within HomeProvider");
  return ctx;
}
