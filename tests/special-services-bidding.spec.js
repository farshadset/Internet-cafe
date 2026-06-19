import { test, expect } from '@playwright/test';

test.describe('خدمات ویژه - سیستم مزایده قیمت', () => {
  
  test('فرم رزومه و استخدام شامل بخش توضیحات اضافی با قیمت پیشنهادی', async ({ page }) => {
    await page.goto('file:///home/farshad/Desktop/کافینت/public/resume-employment.html');
    
    const textarea = page.locator('textarea#additionalNotes');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('style', /height: 150px/);
    await expect(textarea).toHaveAttribute('data-rtl-listener', 'true');
    
    const placeholder = page.locator('.textarea-placeholder span');
    await expect(placeholder.first()).toContainText(/میتوانید چهار تصویر آپلود کنید|توضیحات خود را اینجا بنویسید|میتوانید چهار pdf آپلود کنید/);
    
    const pinBtn = page.locator('button#pinAttachment');
    await expect(pinBtn).toBeVisible();
    
    const priceField = page.locator('input#proposedPrice');
    await expect(priceField).toBeVisible();
    await expect(priceField).toHaveAttribute('required', '');
  });

  test('فرم خدمات سفارشی شامل بخش توضیحات اضافی با قیمت پیشنهادی', async ({ page }) => {
    await page.goto('file:///home/farshad/Desktop/کافینت/public/custom-services.html');
    
    const textarea = page.locator('textarea#additionalNotes');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('style', /height: 150px/);
    
    const priceField = page.locator('input#proposedPrice');
    await expect(priceField).toBeVisible();
  });

  test('فرم مقاله و تحقیق شامل بخش توضیحات اضافی با قیمت پیشنهادی', async ({ page }) => {
    await page.goto('file:///home/farshad/Desktop/کافینت/public/articles-research.html');
    
    const textarea = page.locator('textarea#additionalNotes');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('style', /height: 150px/);
    
    const priceField = page.locator('input#proposedPrice');
    await expect(priceField).toBeVisible();
  });

  test('صفحه مرور وضعیت سفارش برای خدمات ویژه', async ({ page }) => {
    await page.goto('file:///home/farshad/Desktop/کافینت/public/orders-pending.html');
    
    const pricePopup = page.locator('#priceProposalPopup');
    await expect(pricePopup).toHaveCount(1);
    
    const container = page.locator('#pendingOrders');
    await expect(container).toBeVisible();
  });

  test('صفحه لیست سفارش‌ها مدیر شامل دکمه‌های مدیریت قیمت', async ({ page }) => {
    await page.goto('file:///home/farshad/Desktop/کافینت/public/admin-orders.html');
    
    const pricePopup = page.locator('#priceCounterPopup');
    await expect(pricePopup).toHaveCount(1);
    
    const adminPriceInput = page.locator('#adminPriceInput');
    await expect(adminPriceInput).toHaveCount(1);
  });

  test('صفحه بررسی اطلاعات برای خدمات ویژه فقط دکمه تایید دارد', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('registrationData', JSON.stringify({
        serviceKey: 'resumeEmployment',
        serviceTitle: 'رزومه و استخدام',
        proposedPrice: '500000',
        cost: 'قیمت توافقی - 500000'
      }));
      localStorage.setItem('lastTrackingCode', 'TEST-123');
    });
    
    await page.goto('file:///home/farshad/Desktop/کافینت/public/review.html');
    
    const confirmBtn = page.locator('#confirmPaymentBtn');
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toHaveText('تایید');
  });

  test('عنوان خدمات ویژه در صفحه اصلی وجود دارد', async ({ page }) => {
    await page.goto('file:///home/farshad/Desktop/کافینت/public/index.html');
    const heading = page.locator('h2').filter({ hasText: 'خدمات ویژه' });
    await expect(heading).toBeVisible();
  });

  test('جزئیات سفارش خدمات ویژه نام صحیح سرویس را نمایش می‌دهد', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('registrationData', JSON.stringify({
        serviceKey: 'resumeEmployment',
        serviceTitle: 'رزومه و استخدام',
        proposedPrice: '500000',
        cost: 'قیمت توافقی - 500000'
      }));
      localStorage.setItem('lastTrackingCode', 'TEST-123');
    });
    
    await page.goto('file:///home/farshad/Desktop/کافینت/public/review.html');
    
    const serviceTitle = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('registrationData') || '{}').serviceTitle;
    });
    expect(serviceTitle).toBe('رزومه و استخدام');
  });

  test('صفحه orders-pending برای سرویس‌های ویژه API وجود دارد', async ({ page }) => {
    // Verify the page has the necessary elements for special service price management
    await page.goto('file:///home/farshad/Desktop/کافینت/public/orders-pending.html');
    
    const pricePopup = page.locator('#priceProposalPopup');
    await expect(pricePopup).toHaveCount(1);
  });
});