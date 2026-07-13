const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500); // let the stats fetch resolve
  await page.screenshot({ path: 'C:/Users/SAMARI~1/AppData/Local/Temp/claude/c--Users-Samariddin-Desktop-juyo-tj/1f2fa32c-f748-46eb-b972-16f20bcd1cb8/scratchpad/hero-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/SAMARI~1/AppData/Local/Temp/claude/c--Users-Samariddin-Desktop-juyo-tj/1f2fa32c-f748-46eb-b972-16f20bcd1cb8/scratchpad/hero-mobile.png' });

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  await browser.close();
})();
