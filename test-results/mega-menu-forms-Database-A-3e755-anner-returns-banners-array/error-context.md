# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mega-menu-forms.spec.js >> Database API Tests >> GET /api/banner returns banners array
- Location: tests/mega-menu-forms.spec.js:20:9

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:3003
Call log:
  - → GET http://localhost:3003/api/banner
    - user-agent: Playwright/1.60.0 (x64; zorin 18) node/22.23
    - accept: */*
    - accept-encoding: gzip,deflate,br

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const BASE_URL = 'http://localhost:3003';
  4   | 
  5   | test.describe('Database API Tests', () => {
  6   |     test('GET /api/orders returns orders array', async ({ request }) => {
  7   |         const response = await request.get(`${BASE_URL}/api/orders`);
  8   |         expect(response.ok()).toBeTruthy();
  9   |         const data = await response.json();
  10  |         expect(Array.isArray(data)).toBeTruthy();
  11  |     });
  12  | 
  13  |     test('GET /api/pricing returns pricing array', async ({ request }) => {
  14  |         const response = await request.get(`${BASE_URL}/api/pricing`);
  15  |         expect(response.ok()).toBeTruthy();
  16  |         const data = await response.json();
  17  |         expect(Array.isArray(data)).toBeTruthy();
  18  |     });
  19  | 
  20  |     test('GET /api/banner returns banners array', async ({ request }) => {
> 21  |         const response = await request.get(`${BASE_URL}/api/banner`);
      |                                        ^ Error: apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:3003
  22  |         expect(response.ok()).toBeTruthy();
  23  |         const data = await response.json();
  24  |         expect(Array.isArray(data)).toBeTruthy();
  25  |     });
  26  | 
  27  |     test('POST /api/order creates a new order', async ({ request }) => {
  28  |         const response = await request.post(`${BASE_URL}/api/order`, {
  29  |             data: {
  30  |                 title: 'Test Order',
  31  |                 cost: '۵۰,۰۰۰ تومان',
  32  |                 status: 'pending',
  33  |                 serviceKey: 'judicial',
  34  |                 phone: '09123456789',
  35  |                 nationalId: '1234567890',
  36  |                 birthYear: '1370',
  37  |                 birthMonth: '1',
  38  |                 birthDay: '1',
  39  |                 serviceType: 'judicial-password',
  40  |                 idNumber: '123',
  41  |                 trackingCode: 'TEST-001',
  42  |                 province: 'تهران',
  43  |                 city: 'تهران',
  44  |                 preferredDate: '1404/1/1',
  45  |                 notes: 'Test note'
  46  |             }
  47  |         });
  48  |         expect(response.ok()).toBeTruthy();
  49  |         const data = await response.json();
  50  |         expect(data.trackingCode).toBeTruthy();
  51  |         expect(data.success).toBe(true);
  52  |     });
  53  | 
  54  |     test('POST /api/login authenticates valid user', async ({ request }) => {
  55  |         const response = await request.post(`${BASE_URL}/api/login`, {
  56  |             data: {
  57  |                 username: 'Farshad88',
  58  |                 password: 'farzad82'
  59  |             }
  60  |         });
  61  |         expect(response.ok()).toBeTruthy();
  62  |         const data = await response.json();
  63  |         expect(data.success).toBe(true);
  64  |     });
  65  | 
  66  |     test('POST /api/login rejects invalid credentials', async ({ request }) => {
  67  |         const response = await request.post(`${BASE_URL}/api/login`, {
  68  |             data: {
  69  |                 username: 'wrong',
  70  |                 password: 'wrong'
  71  |             }
  72  |         });
  73  |         expect(response.status()).toBe(401);
  74  |         const data = await response.json();
  75  |         expect(data.error).toBeTruthy();
  76  |     });
  77  | });
  78  | 
  79  | test.describe('Mega Menu Service Forms', () => {
  80  |     test.beforeEach(async ({ page }) => {
  81  |         await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  82  |         await page.evaluate(() => {
  83  |             localStorage.setItem('userData', JSON.stringify({ username: 'testuser' }));
  84  |         });
  85  |     });
  86  | 
  87  |     test('judicial service form displays and submits correctly', async ({ page }) => {
  88  |         await page.waitForTimeout(500);
  89  | 
  90  |         const menuItem = page.locator('[data-menu="identity-judicial"]');
  91  |         await menuItem.hover({ force: true });
  92  |         await page.waitForTimeout(500);
  93  | 
  94  |         const link = menuItem.locator('ul a').filter({ hasText: 'نوبت‌دهی قضایی' });
  95  |         await link.click();
  96  | 
  97  |         await expect(page).toHaveURL(/service\.html\?service=/);
  98  |         await expect(page.locator('#serviceTitle')).toHaveText('نوبت‌دهی قضایی');
  99  | 
  100 |         await page.waitForTimeout(800);
  101 | 
  102 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  103 |         const fieldCount = await formFields.count();
  104 |         expect(fieldCount).toBeGreaterThan(0);
  105 | 
  106 |         await page.fill('input[name="phone"]', '09123456789');
  107 |         await page.fill('input[name="nationalId"]', '1234567890');
  108 |         await page.fill('input[name="birthYear"]', '1370');
  109 |         await page.fill('input[name="birthMonth"]', '1');
  110 |         await page.fill('input[name="birthDay"]', '1');
  111 |         await page.selectOption('select[name="serviceType"]', { label: 'نوبت‌دهی قضایی' });
  112 |         await page.fill('input[name="idNumber"]', '123');
  113 | 
  114 |         const [response] = await Promise.all([
  115 |             page.waitForResponse('**/api/order', { timeout: 30000 }),
  116 |             page.click('#serviceForm button[type="submit"]')
  117 |         ]);
  118 | 
  119 |         expect(response.status()).toBe(200);
  120 |         await page.waitForTimeout(2000);
  121 | 
```