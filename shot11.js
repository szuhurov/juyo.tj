const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const sizes = [
    { name: '390x844-mobile', w: 390, h: 844 },
    { name: '768x1024-tablet', w: 768, h: 1024 },
    { name: '1280x900-laptop', w: 1280, h: 900 },
    { name: '1728x1117-wide', w: 1728, h: 1117 },
    { name: '1920x1080-fullhd', w: 1920, h: 1080 },
  ];
  for (const s of sizes) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
    await page.goto('http://localhost:3000?v=' + Date.now(), { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    const el = await page.locator('section').first();
    await el.screenshot({ path: `C:/Users/SAMARI~1/AppData/Local/Temp/claude/c--Users-Samariddin-Desktop-juyo-tj/1e63f17c-59c9-46b0-af43-76bd6e9df095/scratchpad/hero-${s.name}.png` });
    await page.close();
  }
  await browser.close();
})();
