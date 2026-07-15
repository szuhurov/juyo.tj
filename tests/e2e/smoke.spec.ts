import { test, expect } from '@playwright/test';

test.describe('Smoke tests — unauthenticated', () => {
  test('home page loads and shows header', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/JUYO/i);
    await expect(page.locator('header')).toBeVisible();
  });

  test('home page has main content area', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
  });

  test('404 page shows for unknown route', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-xyz');
    expect(response?.status()).toBe(404);
    await expect(page.locator('body')).toContainText(/404|Ёфт нашуд|not found/i);
  });

  test('/items/add redirects to sign-in when unauthenticated', async ({ page }) => {
    await page.goto('/items/add');
    await page.waitForURL(/sign.in|clerk\.com/i, { timeout: 10_000 });
    expect(page.url()).toMatch(/sign.in|clerk\.com/i);
  });

  test('/profile redirects to sign-in when unauthenticated', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL(/sign.in|clerk\.com/i, { timeout: 10_000 });
    expect(page.url()).toMatch(/sign.in|clerk\.com/i);
  });
});

test.describe('Accessibility basics', () => {
  test('home page has a lang attribute on html element', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('home page has no missing alt attributes on images', async ({ page }) => {
    await page.goto('/');
    const imgsWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imgsWithoutAlt).toBe(0);
  });
});

