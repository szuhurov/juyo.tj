"use client";

/**
 * Theme provider (light / dark / system).
 *
 * `next-themes` was already in package.json, but had never been wired
 * up — so the existing 341 `dark:` classes were never actually active.
 *
 * `attribute="class"` — because globals.css has
 * `@custom-variant dark (&:is(.dark *))`, meaning Tailwind relies
 * specifically on the `.dark` class, not on `prefers-color-scheme`.
 *
 * `defaultTheme="light"` — user request: light by default; "system" and
 * "dark" stay selectable in Settings.
 *
 * `disableTransitionOnChange` — without this, all of the site's
 * `transition-colors` fire at once when the theme changes and it flashes
 * through colors.
 */
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      storageKey="juyo-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
