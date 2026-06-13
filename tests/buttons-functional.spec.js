import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('Header Buttons - Functional Browser Tests', () => {
  const baseUrl = 'http://localhost:3004';

  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  });

  test('Support button click opens modal', async ({ page }) => {
    // Click support button
    await page.click('#supportBtn');
    
    // Wait for modal to appear
    const modal = page.locator('#supportModal');
    await page.waitForTimeout(500);
    
    // Check modal has active class
    const hasActive = await page.evaluate(() => {
      const m = document.getElementById('supportModal');
      return m && m.classList.contains('active');
    });
    expect(hasActive).toBeTruthy();
  });

  test('Support modal close button works', async ({ page }) => {
    await page.click('#supportBtn');
    await page.waitForTimeout(300);
    
    // Click close
    await page.evaluate(() => {
      const c = document.getElementById('closeModal');
      if (c) c.click();
    });
    
    await page.waitForTimeout(300);
    
    const hasActive = await page.evaluate(() => {
      const m = document.getElementById('supportModal');
      return m && m.classList.contains('active');
    });
    expect(hasActive).toBeFalsy();
  });

  test('Profile button redirects to login when not authenticated', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('userData');
      localStorage.removeItem('adminData');
    });
    
    await page.click('#profileBtn');
    await page.waitForTimeout(500);
    
    const url = page.url();
    expect(url).toContain('login.html');
  });

  test('Profile button redirects to profile when user logged in', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('userData', JSON.stringify({ username: 'testuser' }));
    });
    await page.reload();
    
    await page.click('#profileBtn');
    await page.waitForTimeout(500);
    
    const url = page.url();
    expect(url).toContain('profile.html');
  });
});