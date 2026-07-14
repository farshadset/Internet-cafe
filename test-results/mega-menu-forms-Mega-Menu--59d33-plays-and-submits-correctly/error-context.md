# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mega-menu-forms.spec.js >> Mega Menu Service Forms >> judicial service form displays and submits correctly
- Location: tests/mega-menu-forms.spec.js:87:9

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.hover: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-menu="identity-judicial"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - img "لیمو نت" [ref=e4]
    - separator [ref=e5]
    - link " خانه" [ref=e6] [cursor=pointer]:
      - /url: index.html
      - generic [ref=e7]: 
      - generic: خانه
    - link " لیست سفارش‌ها" [ref=e8] [cursor=pointer]:
      - /url: admin-orders.html
      - generic [ref=e9]: 
      - generic: لیست سفارش‌ها
    - link " چت با مشتری" [ref=e10] [cursor=pointer]:
      - /url: admin-chat.html
      - generic [ref=e11]: 
      - generic: چت با مشتری
    - button " پروفایل" [ref=e12] [cursor=pointer]:
      - generic [ref=e13]: 
      - generic: پروفایل
    - link " اخبار" [ref=e14] [cursor=pointer]:
      - /url: articles-research.html
      - generic [ref=e15]: 
      - generic: اخبار
    - link " آموزش" [ref=e16] [cursor=pointer]:
      - /url: faq.html
      - generic [ref=e17]: 
      - generic: آموزش
  - generic [ref=e18]:
    - banner [ref=e19]:
      - heading "کافینت آنلاین" [level=1] [ref=e20]
      - navigation "منوی اصلی" [ref=e23]:
        - list [ref=e25]:
          - listitem [ref=e26]:
            - button "خدمات هویتی و قضایی" [ref=e27] [cursor=pointer]:
              - text: خدمات هویتی و قضایی
              - img [ref=e28]
          - listitem [ref=e30]:
            - button "بانکی، مالی و بورسی" [ref=e31] [cursor=pointer]:
              - text: بانکی، مالی و بورسی
              - img [ref=e32]
          - listitem [ref=e34]:
            - button "خودرو و حمل و نقل" [ref=e35] [cursor=pointer]:
              - text: خودرو و حمل و نقل
              - img [ref=e36]
          - listitem [ref=e38]:
            - button "آموزش و آزمون‌ها" [ref=e39] [cursor=pointer]:
              - text: آموزش و آزمون‌ها
              - img [ref=e40]
          - listitem [ref=e42]:
            - button "مالیات، مجوز و کسب‌وکار" [ref=e43] [cursor=pointer]:
              - text: مالیات، مجوز و کسب‌وکار
              - img [ref=e44]
          - listitem [ref=e46]:
            - button "سامانه‌های دولتی" [ref=e47] [cursor=pointer]:
              - text: سامانه‌های دولتی
              - img [ref=e48]
    - generic [ref=e50]:
      - textbox [ref=e52]
      - generic:
        - generic: وام ازدواج...
    - main [ref=e53]:
      - img "بنر کافینت" [ref=e56]
      - heading "خدمات ویژه" [level=2] [ref=e61]
      - generic [ref=e62]:
        - link "رزومه و استخدام رزومه و استخدام" [ref=e63] [cursor=pointer]:
          - /url: resume-employment.html
          - img "رزومه و استخدام" [ref=e64]
          - generic [ref=e65]: رزومه و استخدام
        - link "خدمات سفارشی خدمات سفارشی" [ref=e66] [cursor=pointer]:
          - /url: custom-services.html
          - img "خدمات سفارشی" [ref=e67]
          - generic [ref=e68]: خدمات سفارشی
        - link "مقاله و تحقیق مقاله و تحقیق" [ref=e69] [cursor=pointer]:
          - /url: articles-research.html
          - img "مقاله و تحقیق" [ref=e70]
          - generic [ref=e71]: مقاله و تحقیق
      - link "بنر کافینت" [ref=e73] [cursor=pointer]:
        - /url: www.google.com
        - img "بنر کافینت" [ref=e75]
  - text:         +  
  - generic [ref=e80]:
    - heading "منو" [level=3] [ref=e81]
    - button "×" [ref=e82] [cursor=pointer]
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
  21  |         const response = await request.get(`${BASE_URL}/api/banner`);
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
> 91  |         await menuItem.hover({ force: true });
      |                        ^ Error: locator.hover: Test timeout of 60000ms exceeded.
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
  122 |         await expect(page).toHaveURL(/review\.html/);
  123 |         await expect(page.locator('#reviewData')).toContainText('09123456789');
  124 |         await expect(page.locator('#confirmPaymentBtn')).toBeVisible();
  125 | 
  126 |         const [confirmResponse] = await Promise.all([
  127 |             page.waitForResponse('**/api/order/confirm', { timeout: 30000 }),
  128 |             page.click('#confirmPaymentBtn')
  129 |         ]);
  130 | 
  131 |         expect(confirmResponse.status()).toBe(200);
  132 |         await page.waitForTimeout(2000);
  133 | 
  134 |         await expect(page).toHaveURL(/success\.html/);
  135 |         await expect(page.locator('#trackingCode')).toBeVisible();
  136 |     });
  137 | 
  138 |     test('tax objection form displays correctly', async ({ page }) => {
  139 |         await page.waitForTimeout(500);
  140 | 
  141 |         const menuItem = page.locator('[data-menu="business-tax"]');
  142 |         await menuItem.hover({ force: true });
  143 |         await page.waitForTimeout(500);
  144 | 
  145 |         const link = menuItem.locator('ul a').filter({ hasText: 'اعتراض مالیاتی' });
  146 |         await link.click();
  147 | 
  148 |         await expect(page).toHaveURL(/service\.html\?service=/);
  149 |         await page.waitForTimeout(800);
  150 | 
  151 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  152 |         const fieldCount = await formFields.count();
  153 |         expect(fieldCount).toBeGreaterThan(0);
  154 |     });
  155 | 
  156 |     test('banking services form displays correctly', async ({ page }) => {
  157 |         await page.waitForTimeout(500);
  158 | 
  159 |         const menuItem = page.locator('[data-menu="finance"]');
  160 |         await menuItem.hover({ force: true });
  161 |         await page.waitForTimeout(500);
  162 | 
  163 |         const link = menuItem.locator('ul a').filter({ hasText: 'افتتاح حساب' });
  164 |         await link.click();
  165 | 
  166 |         await expect(page).toHaveURL(/service\.html\?service=/);
  167 |         await page.waitForTimeout(800);
  168 | 
  169 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  170 |         const fieldCount = await formFields.count();
  171 |         expect(fieldCount).toBeGreaterThan(0);
  172 |     });
  173 | 
  174 |     test('vehicle services form displays correctly', async ({ page }) => {
  175 |         await page.waitForTimeout(500);
  176 | 
  177 |         const menuItem = page.locator('[data-menu="automotive"]');
  178 |         await menuItem.hover({ force: true });
  179 |         await page.waitForTimeout(500);
  180 | 
  181 |         const link = menuItem.locator('ul a').filter({ hasText: 'سایپا' });
  182 |         await link.click();
  183 | 
  184 |         await expect(page).toHaveURL(/service\.html\?service=/);
  185 |         await page.waitForTimeout(800);
  186 | 
  187 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  188 |         const fieldCount = await formFields.count();
  189 |         expect(fieldCount).toBeGreaterThan(0);
  190 |     });
  191 | 
```