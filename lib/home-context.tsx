"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface HomeState {
  isSearchTyping: boolean;
  goHomeSignal: number;
  setIsSearchTyping: (typing: boolean) => void;
  triggerGoHome: () => void;
}

const HomeContext = createContext<HomeState | null>(null);

export function HomeProvider({ children }: { children: ReactNode }) {
  const [isSearchTyping, setIsSearchTyping] = useState(false);
  const [goHomeSignal, setGoHomeSignal] = useState(0);

  const triggerGoHome = useCallback(() => setGoHomeSignal((n) => n + 1), []);

  return (
    <HomeContext.Provider value={{
      isSearchTyping,
      goHomeSignal,
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
