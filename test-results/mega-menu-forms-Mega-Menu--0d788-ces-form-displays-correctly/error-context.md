# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mega-menu-forms.spec.js >> Mega Menu Service Forms >> education services form displays correctly
- Location: tests/mega-menu-forms.spec.js:229:9

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('[data-menu="education"]').locator('ul a').filter({ hasText: 'سامانه‌های آموزشی' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - text: پاسخگویی همه‌روزه
      - strong [ref=e5]: ۸ صبح تا ۱۱ شب
      - text: •حتی روزهای تعطیل
    - generic [ref=e6]:
      - text: "تماس و واتساپ:"
      - strong [ref=e7]: ۰۲۱-۹۱۰۰۹۹۰۰
  - banner [ref=e8]:
    - generic [ref=e9]:
      - link " کافینت خدمات آنلاین" [ref=e10] [cursor=pointer]:
        - /url: index.html
        - generic [ref=e12]: 
        - generic [ref=e13]:
          - text: کافینت
          - generic [ref=e14]: خدمات آنلاین
      - generic [ref=e15]:
        - link "پیگیری سفارش" [ref=e16] [cursor=pointer]:
          - /url: "#"
        - link "ثبت درخواست" [ref=e17] [cursor=pointer]:
          - /url: form.html
    - navigation "منوی اصلی" [ref=e18]:
      - list [ref=e20]:
        - listitem [ref=e21]:
          - button "خدمات هویتی و قضایی" [ref=e22] [cursor=pointer]:
            - text: خدمات هویتی و قضایی
            - img [ref=e23]
        - listitem [ref=e25]:
          - button "بانکی، مالی و بورسی" [ref=e26] [cursor=pointer]:
            - text: بانکی، مالی و بورسی
            - img [ref=e27]
        - listitem [ref=e29]:
          - button "خودرو و حمل و نقل" [ref=e30] [cursor=pointer]:
            - text: خودرو و حمل و نقل
            - img [ref=e31]
        - listitem [ref=e33]:
          - button "آموزش و آزمون‌ها" [ref=e34] [cursor=pointer]:
            - text: آموزش و آزمون‌ها
            - img [ref=e35]
        - listitem [ref=e37]:
          - button "مالیات، مجوز و کسب‌وکار" [ref=e38] [cursor=pointer]:
            - text: مالیات، مجوز و کسب‌وکار
            - img [ref=e39]
        - listitem [ref=e41]:
          - button "سامانه‌های دولتی" [ref=e42] [cursor=pointer]:
            - text: سامانه‌های دولتی
            - img [ref=e43]
  - generic [ref=e46]:
    - generic [ref=e47]:
      - text: بیش از
      - generic [ref=e48]: ۱۲۰ خدمت آنلاین
      - text: بدون نیاز به مراجعه حضوری
    - heading "کارهای اداری‌ات را بسپار به ما، از خانه انجامش می‌دهیم" [level=1] [ref=e49]:
      - text: کارهای اداری‌ات را بسپار به ما،
      - text: از خانه
      - emphasis [ref=e50]: انجامش می‌دهیم
    - generic [ref=e51]:
      - textbox [ref=e53]
      - generic:
        - generic: پیش ثبت نام مدارس...
    - generic [ref=e54]:
      - generic [ref=e55]: "پرتکرارها:"
      - link "ثبت نام ثنا" [ref=e56] [cursor=pointer]:
        - /url: service.html?service=sanaRegistration
      - link "کارت سوخت" [ref=e57] [cursor=pointer]:
        - /url: fuel-card.html
      - link "سهام عدالت" [ref=e58] [cursor=pointer]:
        - /url: justice-stocks.html
      - link "استعلام خلافی" [ref=e59] [cursor=pointer]:
        - /url: fine-inquiry.html
      - link "اظهارنامه مالیاتی" [ref=e60] [cursor=pointer]:
        - /url: service.html?service=tax
  - generic [ref=e62]:
    - generic [ref=e63]:
      - generic [ref=e64]: دسته‌بندی خدمات
      - heading "هر کاری با سامانه‌های دولتی داری، اینجا هست" [level=2] [ref=e65]
      - paragraph [ref=e66]: شش دسته اصلی خدمات؛ روی هر کدام بزنید تا فهرست کامل را در منو ببینید.
    - generic [ref=e67]:
      - link " خدمات هویتی و قضایی کارت ملی، شناسنامه، گذرنامه، سامانه ثنا و گواهی عدم سوء پیشینه. مشاهده ۱۸ خدمت" [ref=e68] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e70]: 
        - heading "خدمات هویتی و قضایی" [level=3] [ref=e71]
        - paragraph [ref=e72]: کارت ملی، شناسنامه، گذرنامه، سامانه ثنا و گواهی عدم سوء پیشینه.
        - generic [ref=e73]:
          - text: مشاهده ۱۸ خدمت
          - img [ref=e74]
      - link " بانکی، مالی و بورسی وام و تسهیلات، یارانه، سهام عدالت، سجام و احراز هویت بانکی. مشاهده ۱۵ خدمت" [ref=e76] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e78]: 
        - heading "بانکی، مالی و بورسی" [level=3] [ref=e79]
        - paragraph [ref=e80]: وام و تسهیلات، یارانه، سهام عدالت، سجام و احراز هویت بانکی.
        - generic [ref=e81]:
          - text: مشاهده ۱۵ خدمت
          - img [ref=e82]
      - link " خودرو و حمل و نقل کارت سوخت، تعویض پلاک، استعلام خلافی و ثبت‌نام خودروسازها. مشاهده ۱۷ خدمت" [ref=e84] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e86]: 
        - heading "خودرو و حمل و نقل" [level=3] [ref=e87]
        - paragraph [ref=e88]: کارت سوخت، تعویض پلاک، استعلام خلافی و ثبت‌نام خودروسازها.
        - generic [ref=e89]:
          - text: مشاهده ۱۷ خدمت
          - img [ref=e90]
      - link " آموزش و آزمون‌ها ثبت‌نام مدارس و دانشگاه، کنکور، آزمون‌های استخدامی و بین‌المللی. مشاهده ۱۷ خدمت" [ref=e92] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e94]: 
        - heading "آموزش و آزمون‌ها" [level=3] [ref=e95]
        - paragraph [ref=e96]: ثبت‌نام مدارس و دانشگاه، کنکور، آزمون‌های استخدامی و بین‌المللی.
        - generic [ref=e97]:
          - text: مشاهده ۱۷ خدمت
          - img [ref=e98]
      - link " مالیات، مجوز و کسب‌وکار اظهارنامه، تبصره ۱۰۰، ثبت شرکت و برند، جواز کسب و مجوز صنفی. مشاهده ۱۶ خدمت" [ref=e100] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e102]: 
        - heading "مالیات، مجوز و کسب‌وکار" [level=3] [ref=e103]
        - paragraph [ref=e104]: اظهارنامه، تبصره ۱۰۰، ثبت شرکت و برند، جواز کسب و مجوز صنفی.
        - generic [ref=e105]:
          - text: مشاهده ۱۶ خدمت
          - img [ref=e106]
      - link " سامانه‌های دولتی میخک، سخا، ستاد ایران، املاک و اسکان، تأمین اجتماعی و توکن. مشاهده ۲۲ خدمت" [ref=e108] [cursor=pointer]:
        - /url: "#"
        - generic [ref=e110]: 
        - heading "سامانه‌های دولتی" [level=3] [ref=e111]
        - paragraph [ref=e112]: میخک، سخا، ستاد ایران، املاک و اسکان، تأمین اجتماعی و توکن.
        - generic [ref=e113]:
          - text: مشاهده ۲۲ خدمت
          - img [ref=e114]
  - generic [ref=e117]:
    - generic [ref=e118]:
      - generic [ref=e119]: روند انجام کار
      - heading "در چهارقدم، بدون صف و بدون مراجعه" [level=2] [ref=e120]
    - generic [ref=e121]:
      - generic [ref=e122]:
        - heading "خدمت را انتخاب کنید" [level=3] [ref=e123]
        - paragraph [ref=e124]: از منو یا جست‌وجو، خدمت موردنظر را پیدا کنید و مدارک لازم را ببینید.
      - generic [ref=e125]:
        - heading "مدارک را بفرستید" [level=3] [ref=e126]
        - paragraph [ref=e127]: عکس مدارک را از طریق واتساپ یا فرم سایت برای کارشناس ارسال کنید.
      - generic [ref=e128]:
        - heading "ما ثبت می‌کنیم" [level=3] [ref=e129]
        - paragraph [ref=e130]: کارشناس، درخواست را در سامانه رسمی ثبت می‌کند و از شما تأیید می‌گیرد.
      - generic [ref=e131]:
        - heading "رسید تحویل بگیرید" [level=3] [ref=e132]
        - paragraph [ref=e133]: کد رهگیری و رسید رسمی برایتان ارسال می‌شود و تا نتیجه، پیگیر می‌مانیم.
  - main [ref=e134]:
    - generic [ref=e135]:
      - heading "خدمات ویژه" [level=2] [ref=e136]
      - generic [ref=e137]:
        - link "رزومه و استخدام رزومه و استخدام" [ref=e138] [cursor=pointer]:
          - /url: resume-employment.html
          - img "رزومه و استخدام" [ref=e139]
          - generic [ref=e140]: رزومه و استخدام
        - link "خدمات سفارشی خدمات سفارشی" [ref=e141] [cursor=pointer]:
          - /url: custom-services.html
          - img "خدمات سفارشی" [ref=e142]
          - generic [ref=e143]: خدمات سفارشی
        - link "مقاله و تحقیق مقاله و تحقیق" [ref=e144] [cursor=pointer]:
          - /url: articles-research.html
          - img "مقاله و تحقیق" [ref=e145]
          - generic [ref=e146]: مقاله و تحقیق
      - img "بنر کافینت" [ref=e149]
      - link "بنر کافینت" [ref=e155] [cursor=pointer]:
        - /url: www.google.com
        - img "بنر کافینت" [ref=e157]
  - contentinfo [ref=e160]:
    - generic [ref=e161]:
      - generic [ref=e162]:
        - generic [ref=e163]:
          - heading "کافینت آنلاین" [level=4] [ref=e164]
          - paragraph [ref=e165]: کافینت آنلاین خدمات دولتی؛ ثبت‌نام‌ها، استعلام‌ها و پیگیری‌های اداری شما را از راه دور و با رسید رسمی انجام می‌دهیم.
        - generic [ref=e166]:
          - heading "خدمات پرتکرار" [level=4] [ref=e167]
          - list [ref=e168]:
            - listitem [ref=e169]:
              - link "ثبت نام ثنا" [ref=e170] [cursor=pointer]:
                - /url: service.html?service=sanaRegistration
            - listitem [ref=e171]:
              - link "کارت ملی هوشمند" [ref=e172] [cursor=pointer]:
                - /url: smart-national-card.html
            - listitem [ref=e173]:
              - link "صدور کارت سوخت" [ref=e174] [cursor=pointer]:
                - /url: fuel-card.html
            - listitem [ref=e175]:
              - link "اظهارنامه مالیاتی" [ref=e176] [cursor=pointer]:
                - /url: service.html?service=tax
            - listitem [ref=e177]:
              - link "سهام عدالت" [ref=e178] [cursor=pointer]:
                - /url: justice-stocks.html
        - generic [ref=e179]:
          - heading "دسترسی سریع" [level=4] [ref=e180]
          - list [ref=e181]:
            - listitem [ref=e182]:
              - link "همه خدمات" [ref=e183] [cursor=pointer]:
                - /url: "#services"
            - listitem [ref=e184]:
              - link "ثبت درخواست" [ref=e185] [cursor=pointer]:
                - /url: "#order"
            - listitem [ref=e186]:
              - link "پیگیری سفارش" [ref=e187] [cursor=pointer]:
                - /url: "#"
            - listitem [ref=e188]:
              - link "سؤالات متداول" [ref=e189] [cursor=pointer]:
                - /url: "#"
            - listitem [ref=e190]:
              - link "تماس با ما" [ref=e191] [cursor=pointer]:
                - /url: "#"
        - generic [ref=e192]:
          - heading "راه‌های ارتباطی" [level=4] [ref=e193]
          - list [ref=e194]:
            - listitem [ref=e195]: "تلفن: ۰۲۱-۹۱۰۰۹۹۰۰"
            - listitem [ref=e196]: "واتساپ: ۰۹۱۲-۰۰۰-۰۰۰۰"
            - listitem [ref=e197]: "ایمیل: info@caffint.ir"
            - listitem [ref=e198]: "ساعت کاری: هر روز ۸ تا ۲۳"
      - generic [ref=e200]: © ۱۴۰۵ کافینت آنلاین — تمام حقوق محفوظ است.
  - link "" [ref=e201] [cursor=pointer]:
    - /url: "#"
    - generic [ref=e202]: 
  - link "" [ref=e203] [cursor=pointer]:
    - /url: "#"
    - generic [ref=e204]: 
  - text: +  
```

# Test source

```ts
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
> 240 |         await link.click();
      |                    ^ Error: locator.click: Test timeout of 60000ms exceeded.
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
  261 |         await link.click();
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