# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mega-menu-service-links.spec.js >> Mega menu dynamic service links >> opens بازیابی رمز ثنا dynamic form
- Location: tests/mega-menu-service-links.spec.js:63:9

# Error details

```
Error: locator.click: Target page, context or browser has been closed
Call log:
  - waiting for locator('[data-menu="identity-judicial"]').locator('ul a').filter({ hasText: /^بازیابی رمز ثنا$/ })

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const dynamicServiceItems = [
  4  |   { menu: 'identity-judicial', title: 'بازیابی رمز ثنا' },
  5  |   { menu: 'identity-judicial', title: 'نوبت‌دهی قضایی' },
  6  |   { menu: 'identity-judicial', title: 'استعلام محکومیت' },
  7  |   { menu: 'finance', title: 'افتتاح حساب' },
  8  |   { menu: 'finance', title: 'احراز هویت بانک' },
  9  |   { menu: 'finance', title: 'اعتبارسنجی مرآت' },
  10 |   { menu: 'finance', title: 'پرداخت آنلاین' },
  11 |   { menu: 'automotive', title: 'مالیات نقل و انتقال' },
  12 |   { menu: 'automotive', title: 'ایران خودرو' },
  13 |   { menu: 'automotive', title: 'سایپا' },
  14 |   { menu: 'automotive', title: 'سامانه یکپارچه' },
  15 |   { menu: 'automotive', title: 'انتخاب خودرو' },
  16 |   { menu: 'automotive', title: 'تهران من' },
  17 |   { menu: 'automotive', title: 'یارانه سوخت وانت' },
  18 |   { menu: 'education', title: 'سامانه‌های آموزشی' },
  19 |   { menu: 'business-tax', title: 'اظهارنامه مالیاتی' },
  20 |   { menu: 'business-tax', title: 'تبصره ۱۰۰' },
  21 |   { menu: 'business-tax', title: 'ارزش افزوده' },
  22 |   { menu: 'business-tax', title: 'اعتراض مالیاتی' },
  23 |   { menu: 'business-tax', title: 'کد اقتصادی' },
  24 |   { menu: 'business-tax', title: 'ثبت شرکت' },
  25 |   { menu: 'business-tax', title: 'ثبت برند' },
  26 |   { menu: 'business-tax', title: 'تغییرات شرکت' },
  27 |   { menu: 'business-tax', title: 'سامانه ملی مجوزها' },
  28 |   { menu: 'business-tax', title: 'جواز کسب' },
  29 |   { menu: 'business-tax', title: 'مجوز صنفی' },
  30 |   { menu: 'business-tax', title: 'مجوز تولیدی' },
  31 |   { menu: 'business-tax', title: 'نوین اصناف' },
  32 |   { menu: 'business-tax', title: 'بازدید اماکن' },
  33 |   { menu: 'business-tax', title: 'صلاحیت بهداشتی' },
  34 |   { menu: 'business-tax', title: 'گواهی مالیاتی ۱۸۶' },
  35 |   { menu: 'government-services', title: 'میخک' },
  36 |   { menu: 'government-services', title: 'سخا' },
  37 |   { menu: 'government-services', title: 'شمس' },
  38 |   { menu: 'government-services', title: 'ستاد ایران' },
  39 |   { menu: 'government-services', title: 'ثبت‌نام املاک و اسکان' },
  40 |   { menu: 'government-services', title: 'خودنویس' },
  41 |   { menu: 'government-services', title: 'ثبت سند ملکی' },
  42 |   { menu: 'government-services', title: 'نام نویسی کارفرما' },
  43 |   { menu: 'government-services', title: 'ثبت نیروی کار' },
  44 |   { menu: 'government-services', title: 'ارسال لیست بیمه' },
  45 |   { menu: 'government-services', title: 'بیمه با سابقه' },
  46 |   { menu: 'government-services', title: 'کمیسیون پزشکی' },
  47 |   { menu: 'government-services', title: 'کمک هزینه عینک' },
  48 |   { menu: 'government-services', title: 'کمک هزینه سمعک' },
  49 |   { menu: 'government-services', title: 'راه‌اندازی توکن' },
  50 |   { menu: 'government-services', title: 'امضا در ثبت من' },
  51 |   { menu: 'government-services', title: 'امضای نرم‌افزاری' }
  52 | ];
  53 | 
  54 | test.describe('Mega menu dynamic service links', () => {
  55 |   test.beforeEach(async ({ page }) => {
  56 |     await page.goto('http://localhost:3003/index.html', { waitUntil: 'networkidle' });
  57 |     await page.evaluate(() => {
  58 |       localStorage.setItem('userData', JSON.stringify({ username: 'testuser' }));
  59 |     });
  60 |   });
  61 | 
  62 |   for (const item of dynamicServiceItems) {
  63 |     test(`opens ${item.title} dynamic form`, async ({ page }) => {
  64 |       const menuItem = page.locator(`[data-menu="${item.menu}"]`);
  65 |       await menuItem.hover({ force: true });
  66 | 
  67 |       const escapedTitle = item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  68 |       const link = menuItem.locator('ul a').filter({ hasText: new RegExp(`^${escapedTitle}$`) });
> 69 |       await link.click();
     |                  ^ Error: locator.click: Target page, context or browser has been closed
  70 | 
  71 |       await expect(page).toHaveURL(/service\.html\?service=/);
  72 |       await expect(page.locator('#serviceTitle')).toHaveText(item.title);
  73 |     });
  74 |   }
  75 | });
  76 | 
```