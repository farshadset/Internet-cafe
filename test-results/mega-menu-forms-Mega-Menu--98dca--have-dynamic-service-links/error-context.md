# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mega-menu-forms.spec.js >> Mega Menu Service Forms >> all six mega menu categories have dynamic service links
- Location: tests/mega-menu-forms.spec.js:210:9

# Error details

```
Error: locator.hover: Target page, context or browser has been closed
Call log:
  - waiting for locator('[data-menu="identity-judicial"]')

```

# Test source

```ts
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
> 224 |             await menuItem.hover({ force: true });
      |                            ^ Error: locator.hover: Target page, context or browser has been closed
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