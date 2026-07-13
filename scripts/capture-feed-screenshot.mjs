import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const url = process.env.CAPTURE_URL || "http://localhost:3000/";
const outDir = "public/screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/feed-hero.png` });
await browser.close();
console.log(`Saved ${outDir}/feed-hero.png`);
