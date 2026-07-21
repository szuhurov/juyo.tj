import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno edge functions — алоҳида runtime (Deno, на Node), import-ҳои
    // URL-и он (https://esm.sh/...) бо resolver-и TypeScript-и ин config
    // мувофиқат намекунанд — лозим аст бо deno lint алоҳида санҷида шаванд.
    "supabase/functions/**",
    // Скриптҳои ёрирасони як-бора (import/backfill/debug) — CommonJS,
    // берун аз бандли барнома, ба қоидаҳои сахти TS-и app лозим нест.
    "scripts/**",
    "shot.js",
    "shot11.js",
  ]),
  {
    // Дар тестҳо `any`/`Function` барои mock-ҳо маъмул ва бехатар аст —
    // қоидаи сахт ин ҷо арзиш намеафзояд, танҳо шовиш эҷод мекунад.
    files: ["tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
    },
  },
]);

export default eslintConfig;
