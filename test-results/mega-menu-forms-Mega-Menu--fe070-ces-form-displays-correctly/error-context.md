# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mega-menu-forms.spec.js >> Mega Menu Service Forms >> international services form displays correctly
- Location: tests/mega-menu-forms.spec.js:250:9

# Error details

```
Error: locator.click: Target page, context or browser has been closed
Call log:
  - waiting for locator('[data-menu="education"]').locator('ul a').filter({ hasText: 'تافل و آیلتس' })

```

# Test source

```ts
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
  196 | 
  197 |         const link = menuItem.locator('ul a').filter({ hasText: 'افتتاح حساب' });
  198 |         await link.click();
  199 | 
  200 |         await expect(page).toHaveURL(/service\.html\?service=/);
  201 |         await page.waitForTimeout(1500);
  202 | 
  203 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  204 |         const fieldCount = await formFields.count();
  205 |         expect(fieldCount).toBeGreaterThan(0);
  206 |     });
  207 | 
  208 |     test('vehicle services form displays correctly', async ({ page }) => {
  209 |         await page.waitForTimeout(500);
  210 |         await page.evaluate(() => {
  211 |           localStorage.setItem('userData', JSON.stringify({ username: 'testuser' }));
  212 |         });
  213 | 
  214 |         const menuItem = page.locator('[data-menu="automotive"]');
  215 |         await menuItem.hover({ force: true });
  216 |         await page.waitForTimeout(500);
  217 | 
  218 |         const link = menuItem.locator('ul a').filter({ hasText: 'سایپا' });
  219 |         await link.click();
  220 | 
  221 |         await expect(page).toHaveURL(/service\.html\?service=/);
  222 |         await page.waitForTimeout(1500);
  223 | 
  224 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  225 |         const fieldCount = await formFields.count();
  226 |         expect(fieldCount).toBeGreaterThan(0);
  227 |     });
  228 | 
  229 |     test('education services form displays correctly', async ({ page }) => {
  230 |         await page.waitForTimeout(500);
  231 |         await page.evaluate(() => {
  232 |           localStorage.setItem('userData', JSON.stringify({ username: 'testuser' }));
  233 |         });
  234 | 
  235 |         const menuItem = page.locator('[data-menu="education"]');
  236 |         await menuItem.hover({ force: true });
  237 |         await page.waitForTimeout(500);
  238 | 
  239 |         const link = menuItem.locator('ul a').filter({ hasText: 'سامانه‌های آموزشی' });
  240 |         await link.click();
  241 | 
  242 |         await expect(page).toHaveURL(/service\.html\?service=/);
  243 |         await page.waitForTimeout(1500);
  244 | 
  245 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  246 |         const fieldCount = await formFields.count();
  247 |         expect(fieldCount).toBeGreaterThan(0);
  248 |     });
  249 | 
  250 |     test('international services form displays correctly', async ({ page }) => {
  251 |         await page.waitForTimeout(500);
  252 |         await page.evaluate(() => {
  253 |             localStorage.setItem('userData', JSON.stringify({ username: 'testuser' }));
  254 |         });
  255 | 
  256 |         const menuItem = page.locator('[data-menu="education"]');
  257 |         await menuItem.hover({ force: true });
  258 |         await page.waitForTimeout(500);
  259 | 
  260 |         const link = menuItem.locator('ul a').filter({ hasText: 'تافل و آیلتس' });
> 261 |         await link.click();
      |                    ^ Error: locator.click: Target page, context or browser has been closed
  262 | 
  263 |         await expect(page).toHaveURL(/service\.html\?service=/);
  264 |         await page.waitForTimeout(1500);
  265 | 
  266 |         const formFields = page.locator('#serviceForm input, #serviceForm select, #serviceForm textarea');
  267 |         const fieldCount = await formFields.count();
  268 |         expect(fieldCount).toBeGreaterThan(0);
  269 |     });
  270 | 
  271 |     test('all six mega menu categories have dynamic service links', async ({ page }) => {
  272 |         await page.waitForTimeout(500);
  273 | 
  274 |         const menus = [
  275 |             'identity-judicial',
  276 |             'finance',
  277 |             'automotive',
  278 |             'education',
  279 |             'business-tax',
  280 |             'government-services'
  281 |         ];
  282 | 
  283 |         for (const menuKey of menus) {
  284 |             const menuItem = page.locator(`[data-menu="${menuKey}"]`);
  285 |             await menuItem.hover({ force: true });
  286 |             await page.waitForTimeout(300);
  287 | 
  288 |             const links = menuItem.locator('ul a');
  289 |             const count = await links.count();
  290 |             expect(count).toBeGreaterThan(0);
  291 |         }
  292 |     });
  293 | });
  294 | 
```