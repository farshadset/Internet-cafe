import { test, expect } from '@playwright/test';

const dynamicServiceItems = [
  { menu: 'identity-judicial', title: 'بازیابی رمز ثنا' },
  { menu: 'identity-judicial', title: 'نوبت‌دهی قضایی' },
  { menu: 'identity-judicial', title: 'استعلام محکومیت' },
  { menu: 'finance', title: 'افتتاح حساب' },
  { menu: 'finance', title: 'احراز هویت بانک' },
  { menu: 'finance', title: 'اعتبارسنجی مرآت' },
  { menu: 'finance', title: 'پرداخت آنلاین' },
  { menu: 'automotive', title: 'مالیات نقل و انتقال' },
  { menu: 'automotive', title: 'ایران خودرو' },
  { menu: 'automotive', title: 'سایپا' },
  { menu: 'automotive', title: 'سامانه یکپارچه' },
  { menu: 'automotive', title: 'انتخاب خودرو' },
  { menu: 'automotive', title: 'تهران من' },
  { menu: 'automotive', title: 'یارانه سوخت وانت' },
  { menu: 'education', title: 'سامانه‌های آموزشی' },
  { menu: 'business-tax', title: 'اظهارنامه مالیاتی' },
  { menu: 'business-tax', title: 'تبصره ۱۰۰' },
  { menu: 'business-tax', title: 'ارزش افزوده' },
  { menu: 'business-tax', title: 'اعتراض مالیاتی' },
  { menu: 'business-tax', title: 'کد اقتصادی' },
  { menu: 'business-tax', title: 'ثبت شرکت' },
  { menu: 'business-tax', title: 'ثبت برند' },
  { menu: 'business-tax', title: 'تغییرات شرکت' },
  { menu: 'business-tax', title: 'سامانه ملی مجوزها' },
  { menu: 'business-tax', title: 'جواز کسب' },
  { menu: 'business-tax', title: 'مجوز صنفی' },
  { menu: 'business-tax', title: 'مجوز تولیدی' },
  { menu: 'business-tax', title: 'نوین اصناف' },
  { menu: 'business-tax', title: 'بازدید اماکن' },
  { menu: 'business-tax', title: 'صلاحیت بهداشتی' },
  { menu: 'business-tax', title: 'گواهی مالیاتی ۱۸۶' },
  { menu: 'government-services', title: 'میخک' },
  { menu: 'government-services', title: 'سخا' },
  { menu: 'government-services', title: 'شمس' },
  { menu: 'government-services', title: 'ستاد ایران' },
  { menu: 'government-services', title: 'ثبت‌نام املاک و اسکان' },
  { menu: 'government-services', title: 'خودنویس' },
  { menu: 'government-services', title: 'ثبت سند ملکی' },
  { menu: 'government-services', title: 'نام نویسی کارفرما' },
  { menu: 'government-services', title: 'ثبت نیروی کار' },
  { menu: 'government-services', title: 'ارسال لیست بیمه' },
  { menu: 'government-services', title: 'بیمه با سابقه' },
  { menu: 'government-services', title: 'کمیسیون پزشکی' },
  { menu: 'government-services', title: 'کمک هزینه عینک' },
  { menu: 'government-services', title: 'کمک هزینه سمعک' },
  { menu: 'government-services', title: 'راه‌اندازی توکن' },
  { menu: 'government-services', title: 'امضا در ثبت من' },
  { menu: 'government-services', title: 'امضای نرم‌افزاری' }
];

test.describe('Mega menu dynamic service links', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3004/index.html', { waitUntil: 'networkidle' });
  });

  for (const item of dynamicServiceItems) {
    test(`opens ${item.title} dynamic form`, async ({ page }) => {
      const menuItem = page.locator(`[data-menu="${item.menu}"]`);
      await menuItem.hover({ force: true });

      const escapedTitle = item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const link = menuItem.locator('ul a').filter({ hasText: new RegExp(`^${escapedTitle}$`) });
      await link.click();

      await expect(page).toHaveURL(/service\.html\?service=/);
      await expect(page.locator('#serviceTitle')).toHaveText(item.title);
    });
  }
});
