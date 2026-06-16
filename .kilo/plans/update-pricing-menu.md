# Update Pricing Page to Match Full Mega Menu

## Goal
Make `public/admin-pricing.html` contain every category, group, and leaf link from the mega menu in `public/index.html` so admins can set prices for all services.

## Current state
`admin-pricing.html` already has a hierarchical drill-down UI (category → group → leaf), but `PRICING_DATA` is missing multiple categories/groups from the mega menu.

## Missing from `PRICING_DATA` vs mega menu HTML
Based on `index.html` `data-menu` keys and the provided mega menu HTML, the current `PRICING_DATA` omits these groups/leaves:

### 1) خدمات هویتی و قضایی (identity-judicial)
- کارت ملی و شناسنامه → missing leaves: «المثنی کارت ملی», «تغییر نشانی», «شناسنامه المثنی», «اصلاح مشخصات»
- گذرنامه و مهاجرت → missing leaves: «تمدید پاسپورت», «المثنی گذرنامه», «فرم مهاجرت»
- سوء پیشینه و استعلام‌ها → ok mostly, but ensure «استعلام محکومیت» present

### 2) خدمات بانکی، مالی و بورسی (finance)
- وام و تسهیلات → ok
- یارانه و سهام عدالت → ok
- بورس و سجام → ok
- خدمات بانکی → ok

### 3) خودرو و حمل و نقل (automotive)
- کارت سوخت → missing leaves: «صدور کارت سوخت», «المثنی کارت سوخت», «انتقال کارت سوخت»
- تعویض پلاک و خودرو → ok
- جریمه و معاینه فنی → ok, ensure «استعلام خلافی» included
- ثبت نام خودرو → missing leaves: «ایران خودرو», «سایپا», «سامانه یکپارچه», «انتخاب خودرو»
- خدمات شهری → missing leaves: «تهران من», «یارانه سوخت وانت»

### 4) آموزش، دانشگاه و آزمون‌ها (education)
- مدارس → missing leaves: «پیش ثبت نام مدارس», «مدارس شاهد», «مدارس تیزهوشان», «مدارس غیردولتی»
- دانشگاه‌ها → missing leaves: «دانشگاه آزاد», «پیام نور», «علمی کاربردی», «ثبت نام غیرحضوری»
- کنکور و آزمون‌ها → missing leaves: «کنکور سراسری», «ارشد», «دکتری»
- آزمون‌های استخدامی → missing leaves: «آموزش و پرورش», «بانک‌ها», «دستگاه‌های دولتی»
- خدمات دانشجویی → missing leaves: «سامانه‌های آموزشی», «وام دانشجویی»
- آزمون‌های بین‌المللی → ok

### 5) مالیات، مجوز و کسب‌وکار (business-tax)
- مالیات → missing leaves: «اظهارنامه مالیاتی», «تبصره ۱۰۰», «ارزش افزوده», «اعتراض مالیاتی», «کد اقتصادی»
- ثبت و تغییرات شرکت → missing leaves: «ثبت شرکت», «ثبت برند», «تغییرات شرکت»
- مجوزها → missing leaves: «سامانه ملی مجوزها», «جواز کسب», «مجوز صنفی», «مجوز تولیدی»
- اصناف و اماکن → missing leaves: «نوین اصناف», «بازدید اماکن», «صلاحیت بهداشتی», «گواهی مالیاتی ۱۸۶»

### 6) سامانه‌های دولتی (government-services)
- سامانه‌های عمومی → missing leaves: «میخک», «سخا», «شمس», «ستاد ایران»
- املاک و اسکان → missing leaves: «ثبت‌نام املاک و اسکان», «خودنویس», «ثبت سند ملکی»
- تأمین اجتماعی و بیمه → missing leaves: «نام نویسی کارفرما», «ثبت نیروی کار», «ارسال لیست بیمه», «بیمه با سابقه», «کمیسیون پزشکی», «کمک هزینه عینک», «کمک هزینه سمعک»
- خدمات توکن → missing leaves: «راه‌اندازی توکن», «امضا در ثبت من», «امضای نرم‌افزاری»
- خدمات انتخاباتی → missing leaves: «رأی اولی‌ها», «تعیین شعبه», «تأیید صلاحیت»

## Approach
1. Replace the current `PRICING_DATA` object in `admin-pricing.html` with the complete hierarchy above.
2. Ensure unique, stable `key` strings for each leaf so prices map cleanly.
3. Keep the existing recursive UI (category expand → group expand → leaf with edit button) intact.
4. Do not change server routes or DB schema.

## Risks / notes
- Some leaf names from mega menu are generic (e.g., «نقل و انتقال خودرو» has no dedicated page). Use descriptive keys anyway; admin can set a price.
- Reusing the same `key` across related leaves is acceptable if they truly share a price; otherwise give each leaf its own key.
