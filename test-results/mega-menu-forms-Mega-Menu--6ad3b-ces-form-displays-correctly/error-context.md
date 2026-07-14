# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mega-menu-forms.spec.js >> Mega Menu Service Forms >> vehicle services form displays correctly
- Location: tests/mega-menu-forms.spec.js:174:9

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.hover: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-menu="automotive"]')

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
        - generic: کنکور سراسری...
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
> 178 |         await menuItem.hover({ force: true });
      |                        ^ Error: locator.hover: Test timeout of 60000ms exceeded.
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
  192 |     test('education services form displays correctly', async ({ page }) => {
  193 |         await page.waitForTimeout(500);
  194 | 
  195 |         const menuItem = page.locator('[data-menu="education"]');
  196 |         await menuItem.hover({ force: true });
  197 |         await page.waitForTimeout(500);
  198 | 
  199 |         const link = menuItem.locator('ul a').filter({ hasText: 'سامانه‌های آموزشی' });
  200 |         await link.click();
  201 | 
  202 |         await expect(page).toHaveURL(/service\.html\?service=/);
  203 |         await page.waitForTimeout(800);
  204 | 
  205 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  206 |         const fieldCount = await formFields.count();
  207 |         expect(fieldCount).toBeGreaterThan(0);
  208 |     });
  209 | 
  210 |     test('all six mega menu categories have dynamic service links', async ({ page }) => {
  211 |         await page.waitForTimeout(500);
  212 | 
  213 |         const menus = [
  214 |             'identity-judicial',
  215 |             'finance',
  216 |             'automotive',
  217 |             'education',
  218 |             'business-tax',
  219 |             'government-services'
  220 |         ];
  221 | 
  222 |         for (const menuKey of menus) {
  223 |             const menuItem = page.locator(`[data-menu="${menuKey}"]`);
  224 |             await menuItem.hover({ force: true });
  225 |             await page.waitForTimeout(300);
  226 | 
  227 |             const links = menuItem.locator('ul a');
  228 |             const count = await links.count();
  229 |             expect(count).toBeGreaterThan(0);
  230 |         }
  231 |     });
  232 | });
  233 | 
```