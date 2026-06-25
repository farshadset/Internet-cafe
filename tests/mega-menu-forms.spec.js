import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3003';

test.describe('Database API Tests', () => {
    test('GET /api/orders returns orders array', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/orders`);
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
    });

    test('GET /api/pricing returns pricing array', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/pricing`);
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
    });

    test('GET /api/banner returns banners array', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/banner`);
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
    });

    test('POST /api/order creates a new order', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/order`, {
            data: {
                title: 'Test Order',
                cost: '۵۰,۰۰۰ تومان',
                status: 'pending',
                serviceKey: 'judicial',
                phone: '09123456789',
                nationalId: '1234567890',
                birthYear: '1370',
                birthMonth: '1',
                birthDay: '1',
                serviceType: 'judicial-password',
                idNumber: '123',
                trackingCode: 'TEST-001',
                province: 'تهران',
                city: 'تهران',
                preferredDate: '1404/1/1',
                notes: 'Test note'
            }
        });
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.trackingCode).toBeTruthy();
        expect(data.success).toBe(true);
    });

    test('POST /api/login authenticates valid user', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/login`, {
            data: {
                username: 'Farshad88',
                password: 'farzad82'
            }
        });
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.success).toBe(true);
    });

    test('POST /api/login rejects invalid credentials', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/login`, {
            data: {
                username: 'wrong',
                password: 'wrong'
            }
        });
        expect(response.status()).toBe(401);
        const data = await response.json();
        expect(data.error).toBeTruthy();
    });
});

test.describe('Mega Menu Service Forms', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.evaluate(() => {
            localStorage.setItem('userData', JSON.stringify({ username: 'testuser' }));
        });
    });

    test('judicial service form displays and submits correctly', async ({ page }) => {
        await page.waitForTimeout(500);

        const menuItem = page.locator('[data-menu="identity-judicial"]');
        await menuItem.hover({ force: true });
        await page.waitForTimeout(500);

        const link = menuItem.locator('ul a').filter({ hasText: 'نوبت‌دهی قضایی' });
        await link.click();

        await expect(page).toHaveURL(/service\.html\?service=/);
        await expect(page.locator('#serviceTitle')).toHaveText('نوبت‌دهی قضایی');

        await page.waitForTimeout(800);

        const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
        const fieldCount = await formFields.count();
        expect(fieldCount).toBeGreaterThan(0);

        await page.fill('input[name="phone"]', '09123456789');
        await page.fill('input[name="nationalId"]', '1234567890');
        await page.fill('input[name="birthYear"]', '1370');
        await page.fill('input[name="birthMonth"]', '1');
        await page.fill('input[name="birthDay"]', '1');
        await page.selectOption('select[name="serviceType"]', { label: 'نوبت‌دهی قضایی' });
        await page.fill('input[name="idNumber"]', '123');

        const [response] = await Promise.all([
            page.waitForResponse('**/api/order', { timeout: 30000 }),
            page.click('#serviceForm button[type="submit"]')
        ]);

        expect(response.status()).toBe(200);
        await page.waitForTimeout(2000);

        await expect(page).toHaveURL(/review\.html/);
        await expect(page.locator('#reviewData')).toContainText('09123456789');
        await expect(page.locator('#confirmPaymentBtn')).toBeVisible();

        const [confirmResponse] = await Promise.all([
            page.waitForResponse('**/api/order/confirm', { timeout: 30000 }),
            page.click('#confirmPaymentBtn')
        ]);

        expect(confirmResponse.status()).toBe(200);
        await page.waitForTimeout(2000);

        await expect(page).toHaveURL(/success\.html/);
        await expect(page.locator('#trackingCode')).toBeVisible();
    });

    test('tax objection form displays correctly', async ({ page }) => {
        await page.waitForTimeout(500);

        const menuItem = page.locator('[data-menu="business-tax"]');
        await menuItem.hover({ force: true });
        await page.waitForTimeout(500);

        const link = menuItem.locator('ul a').filter({ hasText: 'اعتراض مالیاتی' });
        await link.click();

        await expect(page).toHaveURL(/service\.html\?service=/);
        await page.waitForTimeout(800);

        const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
        const fieldCount = await formFields.count();
        expect(fieldCount).toBeGreaterThan(0);
    });

    test('banking services form displays correctly', async ({ page }) => {
        await page.waitForTimeout(500);

        const menuItem = page.locator('[data-menu="finance"]');
        await menuItem.hover({ force: true });
        await page.waitForTimeout(500);

        const link = menuItem.locator('ul a').filter({ hasText: 'افتتاح حساب' });
        await link.click();

        await expect(page).toHaveURL(/service\.html\?service=/);
        await page.waitForTimeout(800);

        const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
        const fieldCount = await formFields.count();
        expect(fieldCount).toBeGreaterThan(0);
    });

    test('vehicle services form displays correctly', async ({ page }) => {
        await page.waitForTimeout(500);

        const menuItem = page.locator('[data-menu="automotive"]');
        await menuItem.hover({ force: true });
        await page.waitForTimeout(500);

        const link = menuItem.locator('ul a').filter({ hasText: 'سایپا' });
        await link.click();

        await expect(page).toHaveURL(/service\.html\?service=/);
        await page.waitForTimeout(800);

        const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
        const fieldCount = await formFields.count();
        expect(fieldCount).toBeGreaterThan(0);
    });

    test('education services form displays correctly', async ({ page }) => {
        await page.waitForTimeout(500);

        const menuItem = page.locator('[data-menu="education"]');
        await menuItem.hover({ force: true });
        await page.waitForTimeout(500);

        const link = menuItem.locator('ul a').filter({ hasText: 'سامانه‌های آموزشی' });
        await link.click();

        await expect(page).toHaveURL(/service\.html\?service=/);
        await page.waitForTimeout(800);

        const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
        const fieldCount = await formFields.count();
        expect(fieldCount).toBeGreaterThan(0);
    });

    test('all six mega menu categories have dynamic service links', async ({ page }) => {
        await page.waitForTimeout(500);

        const menus = [
            'identity-judicial',
            'finance',
            'automotive',
            'education',
            'business-tax',
            'government-services'
        ];

        for (const menuKey of menus) {
            const menuItem = page.locator(`[data-menu="${menuKey}"]`);
            await menuItem.hover({ force: true });
            await page.waitForTimeout(300);

            const links = menuItem.locator('ul a');
            const count = await links.count();
            expect(count).toBeGreaterThan(0);
        }
    });
});
