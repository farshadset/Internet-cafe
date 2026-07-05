# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mega-menu-forms.spec.js >> Mega Menu Service Forms >> judicial service form displays and submits correctly
- Location: tests/mega-menu-forms.spec.js:87:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-menu="identity-judicial"]').locator('ul a').filter({ hasText: 'نوبت‌دهی قضایی' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-menu="identity-judicial"]').locator('ul a').filter({ hasText: 'نوبت‌دهی قضایی' })

```

```yaml
- text: پاسخگویی همه‌روزه
- strong: ۸ صبح تا ۱۱ شب
- text: "•حتی روزهای تعطیل تماس و واتساپ:"
- strong: ۰۲۱-۹۱۰۰۹۹۰۰
- banner:
  - link " کافینت خدمات آنلاین":
    - /url: index.html
  - link "پیگیری سفارش":
    - /url: "#"
  - link "ثبت درخواست":
    - /url: form.html
  - navigation "منوی اصلی":
    - list:
      - listitem:
        - button "خدمات هویتی و قضایی":
          - text: خدمات هویتی و قضایی
          - img
      - listitem:
        - button "بانکی، مالی و بورسی":
          - text: بانکی، مالی و بورسی
          - img
      - listitem:
        - button "خودرو و حمل و نقل":
          - text: خودرو و حمل و نقل
          - img
      - listitem:
        - button "آموزش و آزمون‌ها":
          - text: آموزش و آزمون‌ها
          - img
      - listitem:
        - button "مالیات، مجوز و کسب‌وکار":
          - text: مالیات، مجوز و کسب‌وکار
          - img
      - listitem:
        - button "سامانه‌های دولتی":
          - text: سامانه‌های دولتی
          - img
- text: بیش از ۱۲۰ خدمت آنلاین بدون نیاز به مراجعه حضوری
- heading "کارهای اداری‌ات را بسپار به ما، از خانه انجامش می‌دهیم" [level=1]:
  - text: کارهای اداری‌ات را بسپار به ما، از خانه
  - emphasis: انجامش می‌دهیم
- textbox
- text: "جستجو د پرتکرارها:"
- link "ثبت نام ثنا":
  - /url: service.html?service=sanaRegistration
- link "کارت سوخت":
  - /url: fuel-card.html
- link "سهام عدالت":
  - /url: justice-stocks.html
- link "استعلام خلافی":
  - /url: fine-inquiry.html
- link "اظهارنامه مالیاتی":
  - /url: service.html?service=tax
- text: دسته‌بندی خدمات
- heading "هر کاری با سامانه‌های دولتی داری، اینجا هست" [level=2]
- paragraph: شش دسته اصلی خدمات؛ روی هر کدام بزنید تا فهرست کامل را در منو ببینید.
- link " خدمات هویتی و قضایی کارت ملی، شناسنامه، گذرنامه، سامانه ثنا و گواهی عدم سوء پیشینه. مشاهده ۱۸ خدمت":
  - /url: "#"
  - text: 
  - heading "خدمات هویتی و قضایی" [level=3]
  - paragraph: کارت ملی، شناسنامه، گذرنامه، سامانه ثنا و گواهی عدم سوء پیشینه.
  - text: مشاهده ۱۸ خدمت
  - img
- link " بانکی، مالی و بورسی وام و تسهیلات، یارانه، سهام عدالت، سجام و احراز هویت بانکی. مشاهده ۱۵ خدمت":
  - /url: "#"
  - text: 
  - heading "بانکی، مالی و بورسی" [level=3]
  - paragraph: وام و تسهیلات، یارانه، سهام عدالت، سجام و احراز هویت بانکی.
  - text: مشاهده ۱۵ خدمت
  - img
- link " خودرو و حمل و نقل کارت سوخت، تعویض پلاک، استعلام خلافی و ثبت‌نام خودروسازها. مشاهده ۱۷ خدمت":
  - /url: "#"
  - text: 
  - heading "خودرو و حمل و نقل" [level=3]
  - paragraph: کارت سوخت، تعویض پلاک، استعلام خلافی و ثبت‌نام خودروسازها.
  - text: مشاهده ۱۷ خدمت
  - img
- link " آموزش و آزمون‌ها ثبت‌نام مدارس و دانشگاه، کنکور، آزمون‌های استخدامی و بین‌المللی. مشاهده ۱۷ خدمت":
  - /url: "#"
  - text: 
  - heading "آموزش و آزمون‌ها" [level=3]
  - paragraph: ثبت‌نام مدارس و دانشگاه، کنکور، آزمون‌های استخدامی و بین‌المللی.
  - text: مشاهده ۱۷ خدمت
  - img
- link " مالیات، مجوز و کسب‌وکار اظهارنامه، تبصره ۱۰۰، ثبت شرکت و برند، جواز کسب و مجوز صنفی. مشاهده ۱۶ خدمت":
  - /url: "#"
  - text: 
  - heading "مالیات، مجوز و کسب‌وکار" [level=3]
  - paragraph: اظهارنامه، تبصره ۱۰۰، ثبت شرکت و برند، جواز کسب و مجوز صنفی.
  - text: مشاهده ۱۶ خدمت
  - img
- link " سامانه‌های دولتی میخک، سخا، ستاد ایران، املاک و اسکان، تأمین اجتماعی و توکن. مشاهده ۲۲ خدمت":
  - /url: "#"
  - text: 
  - heading "سامانه‌های دولتی" [level=3]
  - paragraph: میخک، سخا، ستاد ایران، املاک و اسکان، تأمین اجتماعی و توکن.
  - text: مشاهده ۲۲ خدمت
  - img
- text: روند انجام کار
- heading "در چهارقدم، بدون صف و بدون مراجعه" [level=2]
- heading "خدمت را انتخاب کنید" [level=3]
- paragraph: از منو یا جست‌وجو، خدمت موردنظر را پیدا کنید و مدارک لازم را ببینید.
- heading "مدارک را بفرستید" [level=3]
- paragraph: عکس مدارک را از طریق واتساپ یا فرم سایت برای کارشناس ارسال کنید.
- heading "ما ثبت می‌کنیم" [level=3]
- paragraph: کارشناس، درخواست را در سامانه رسمی ثبت می‌کند و از شما تأیید می‌گیرد.
- heading "رسید تحویل بگیرید" [level=3]
- paragraph: کد رهگیری و رسید رسمی برایتان ارسال می‌شود و تا نتیجه، پیگیر می‌مانیم.
- main:
  - heading "خدمات ویژه" [level=2]
  - link "رزومه و استخدام رزومه و استخدام":
    - /url: resume-employment.html
    - img "رزومه و استخدام"
    - text: رزومه و استخدام
  - link "خدمات سفارشی خدمات سفارشی":
    - /url: custom-services.html
    - img "خدمات سفارشی"
    - text: خدمات سفارشی
  - link "مقاله و تحقیق مقاله و تحقیق":
    - /url: articles-research.html
    - img "مقاله و تحقیق"
    - text: مقاله و تحقیق
  - img "بنر کافینت"
  - link "بنر کافینت":
    - /url: www.google.com
    - img "بنر کافینت"
- contentinfo:
  - heading "کافینت آنلاین" [level=4]
  - paragraph: کافینت آنلاین خدمات دولتی؛ ثبت‌نام‌ها، استعلام‌ها و پیگیری‌های اداری شما را از راه دور و با رسید رسمی انجام می‌دهیم.
  - heading "خدمات پرتکرار" [level=4]
  - list:
    - listitem:
      - link "ثبت نام ثنا":
        - /url: service.html?service=sanaRegistration
    - listitem:
      - link "کارت ملی هوشمند":
        - /url: smart-national-card.html
    - listitem:
      - link "صدور کارت سوخت":
        - /url: fuel-card.html
    - listitem:
      - link "اظهارنامه مالیاتی":
        - /url: service.html?service=tax
    - listitem:
      - link "سهام عدالت":
        - /url: justice-stocks.html
  - heading "دسترسی سریع" [level=4]
  - list:
    - listitem:
      - link "همه خدمات":
        - /url: "#services"
    - listitem:
      - link "ثبت درخواست":
        - /url: "#order"
    - listitem:
      - link "پیگیری سفارش":
        - /url: "#"
    - listitem:
      - link "سؤالات متداول":
        - /url: "#"
    - listitem:
      - link "تماس با ما":
        - /url: "#"
  - heading "راه‌های ارتباطی" [level=4]
  - list:
    - listitem: "تلفن: ۰۲۱-۹۱۰۰۹۹۰۰"
    - listitem: "واتساپ: ۰۹۱۲-۰۰۰-۰۰۰۰"
    - listitem: "ایمیل: info@caffint.ir"
    - listitem: "ساعت کاری: هر روز ۸ تا ۲۳"
  - text: © ۱۴۰۵ کافینت آنلاین — تمام حقوق محفوظ است.
- link "":
  - /url: "#"
- link "":
  - /url: "#"
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
  91  |         await menuItem.hover({ force: true });
  92  |         await page.waitForTimeout(500);
  93  | 
  94  |         const link = menuItem.locator('ul a').filter({ hasText: 'نوبت‌دهی قضایی' });
> 95  |         await expect(link).toBeVisible({ timeout: 10000 });
      |                            ^ Error: expect(locator).toBeVisible() failed
  96  |         await link.click();
  97  | 
  98  |         await page.waitForURL(/service\.html\?service=/, { timeout: 10000 });
  99  |         await expect(page.locator('#serviceTitle')).toHaveText('نوبت‌دهی قضایی');
  100 | 
  101 |         await page.waitForTimeout(800);
  102 | 
  103 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  104 |         const fieldCount = await formFields.count();
  105 |         expect(fieldCount).toBeGreaterThan(0);
  106 | 
  107 |         await page.fill('input[name="phone"]', '09123456789');
  108 |         await page.fill('input[name="nationalId"]', '1234567890');
  109 |         await page.fill('input[name="birthYear"]', '1370');
  110 |         await page.fill('input[name="birthMonth"]', '1');
  111 |         await page.fill('input[name="birthDay"]', '1');
  112 |         await page.selectOption('select[name="serviceType"]', { label: 'نوبت‌دهی قضایی' });
  113 |         await page.fill('input[name="idNumber"]', '123');
  114 | 
  115 |         // Wait for form to be ready
  116 |         const submitButton = page.locator('#serviceForm button[type="submit"]');
  117 |         await expect(submitButton).toBeVisible({ timeout: 5000 });
  118 |         await expect(submitButton).toBeEnabled({ timeout: 5000 });
  119 |         
  120 |         // Submit form data manually (simulating form submission flow)
  121 |         // Note: Using EXTRA_SERVICE_CONFIGS directly since SERVICE_CONFIGS is scoped inside DOMContentLoaded
  122 |         await page.evaluate(async () => {
  123 |             const form = document.getElementById('serviceForm');
  124 |             const key = 'judicial';
  125 |             const config = window.EXTRA_SERVICE_CONFIGS?.[key];
  126 |             const raw = Object.fromEntries(new FormData(form));
  127 |             const transformed = config.transform(raw);
  128 |             const body = {
  129 |                 ...transformed,
  130 |                 title: transformed.title || config.title,
  131 |                 cost: config.cost,
  132 |                 status: 'pending',
  133 |                 serviceKey: key,
  134 |                 priceStatus: 'pending'
  135 |             };
  136 |             const response = await fetch('/api/order', {
  137 |                 method: 'POST',
  138 |                 headers: {'Content-Type': 'application/json'},
  139 |                 body: JSON.stringify(body)
  140 |             });
  141 |             const result = await response.json();
  142 |             localStorage.setItem('lastTrackingCode', result.trackingCode);
  143 |             localStorage.setItem('registrationData', JSON.stringify({
  144 |                 ...raw,
  145 |                 serviceKey: key,
  146 |                 serviceTitle: config.title,
  147 |                 cost: config.cost
  148 |             }));
  149 |         });
  150 |         
  151 |         // Navigate to review page
  152 |         await page.goto(`${BASE_URL}/review.html`);
  153 |         await page.waitForTimeout(2000);
  154 |         
  155 |         await expect(page.locator('#reviewData')).toBeVisible({ timeout: 5000 });
  156 |         const pageContent = await page.locator('#reviewData').textContent();
  157 |         expect(pageContent).toContain('کد سفارش');
  158 |         await expect(page.locator('#confirmPaymentBtn')).toBeVisible();
  159 | 
  160 |         const [confirmResponse] = await Promise.all([
  161 |             page.waitForResponse('**/api/order/confirm', { timeout: 30000 }),
  162 |             page.click('#confirmPaymentBtn')
  163 |         ]);
  164 | 
  165 |         expect(confirmResponse.status()).toBe(200);
  166 |         await page.waitForTimeout(2000);
  167 | 
  168 |         await expect(page).toHaveURL(/success\.html/);
  169 |         await expect(page.locator('#trackingCode')).toBeVisible();
  170 |     });
  171 | 
  172 |     test('tax objection form displays correctly', async ({ page }) => {
  173 |         await page.waitForTimeout(500);
  174 | 
  175 |         const menuItem = page.locator('[data-menu="business-tax"]');
  176 |         await menuItem.hover({ force: true });
  177 |         await page.waitForTimeout(500);
  178 | 
  179 |         const link = menuItem.locator('ul a').filter({ hasText: 'اعتراض مالیاتی' });
  180 |         await link.click();
  181 | 
  182 |         await expect(page).toHaveURL(/service\.html\?service=/);
  183 |         await page.waitForTimeout(1500);
  184 | 
  185 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  186 |         const fieldCount = await formFields.count();
  187 |         expect(fieldCount).toBeGreaterThan(0);
  188 |     });
  189 | 
  190 |     test('banking services form displays correctly', async ({ page }) => {
  191 |         await page.waitForTimeout(500);
  192 | 
  193 |         const menuItem = page.locator('[data-menu="finance"]');
  194 |         await menuItem.hover({ force: true });
  195 |         await page.waitForTimeout(500);
```