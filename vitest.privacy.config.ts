import { defineConfig } from "vitest/config";
import path from "path";

// Golden privacy images (tests/privacy-golden): real OCR + barcode engines,
// slow, so kept out of the default `npm test`. Run with `npm run test:privacy`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/privacy-golden/**/*.test.ts"],
    testTimeout: 300_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
