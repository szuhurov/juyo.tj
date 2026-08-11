"use client";

/**
 * Провайдери мавзӯъ (равшан / торик / система).
 *
 * `next-themes` аллакай дар package.json буд, вале ҳеҷ гоҳ васл нашуда
 * буд — бинобар ин 341 класси `dark:`-и мавҷуда ҳеҷ гоҳ фаъол намешуданд.
 *
 * `attribute="class"` — чунки globals.css `@custom-variant dark (&:is(.dark *))`
 * дорад, яъне Tailwind маҳз ба класси `.dark` такя мекунад, на ба
 * `prefers-color-scheme`.
 *
 * `defaultTheme="system"` — талаби корбар: пешфарз аз системаи дастгоҳ.
 *
 * `disableTransitionOnChange` — бе он ҳамаи `transition-colors`-и сайт
 * ҳангоми иваз кардани мавзӯъ якбора "мешинанд" ва ранг-ранг мешавад.
 */
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="juyo-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
