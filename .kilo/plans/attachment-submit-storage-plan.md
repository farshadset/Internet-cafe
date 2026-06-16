# بررسی ذخیره و ارسال فایل‌های توضیحات اضافی

## مشکل گزارش‌شده
کاربر بعد از آپلود فایل در باکس «توضیحات اضافی» صفحه پیش‌ثبت‌نام مدارس، با کلیک روی مرحله بعد به صفحه بعد نمی‌رود. همچنین باید بررسی شود فایل‌های آپلودشده مثل متن `additionalNotes` در دیتابیس سفارش ذخیره می‌شوند یا نه.

## یافته‌های اولیه
- فرم `public/non-gov-schools.html` مقدار `data-service="non-gov-schools"` دارد.
- در `public/app.js` کلید سرویس باید از فرم hyphenated به کلید camelCase مثل `nonGovSchools` تبدیل شود؛ در غیر این صورت `setupServiceForm` با `SERVICE_CONFIGS[serviceKey]` نامعتبر برمی‌گردد و فرم رفتار native پیدا می‌کند.
- در `setupServiceForm` فایل‌ها در `body.attachments` قرار می‌گیرند و سرور `server.js` با `...req.body` آن‌ها را داخل سفارش ذخیره می‌کند.
- قبل از `fetch('/api/order')`، داده‌ها در `localStorage.registrationData` ذخیره می‌شوند. اگر فایل‌ها حجیم باشند، `localStorage.setItem` ممکن است خطای quota بدهد و اجرای کد قبل از ارسال به سرور متوقف شود؛ این می‌تواند دلیل نرفتن به مرحله بعد باشد.
- صفحه `review.html` فعلاً برای نمایش آیکون فایل‌ها به `data.attachments` از `localStorage.registrationData` وابسته است.

## طرح اجرا
1. بررسی و تست مسیر submit فرم مدارس غیردولتی:
   - مطمئن شویم `data-service="non-gov-schools"` به `nonGovSchools` تبدیل می‌شود.
   - مطمئن شویم submit handler اجرا می‌شود و `fetch('/api/order')` فراخوانی می‌شود.

2. اصلاح ذخیره‌سازی فایل‌ها:
   - داده‌های حجیم `dataUrl` فایل‌ها را از `localStorage.registrationData` حذف کنیم تا خطای quota جلوی ارسال سفارش را نگیرد.
   - برای `review.html` فقط metadata سبک یا یک flag نمایش آیکون ذخیره شود؛ پیش‌نمایش واقعی از سفارش ثبت‌شده یا storage مناسب‌تر خوانده شود.
   - اگر لازم شد برای review قبل از ثبت نهایی، از `IndexedDB` یا endpoint سفارش استفاده شود؛ ترجیح اول: ارسال به سرور و رفتن به review بر اساس `trackingCode`.

3. اطمینان از ذخیره در دیتابیس:
   - payload سفارش باید شامل `attachments: [...]` باشد.
   - هر attachment شامل `id`، `name`، `type`، `size`، `dataUrl`، و `uploadedAt` باشد.
   - سرور باید سفارش را با همان `attachments` در `database.json` ذخیره کند.

4. نمایش در مراحل بعد:
   - `review.html`: آیکون کنار توضیحات فقط وقتی فایل وجود دارد نمایش داده شود.
   - `order-detail.html`: آیکون کنار توضیحات از `order.attachments` خوانده شود.
   - `admin-orders.html`: آیکون مدیریت از `order.attachments` خوانده شود.
   - پاپ‌آپ مدیریت برای فایل‌ها دکمه دانلود نشان دهد، نه دکمه حذف.

5. تست نهایی:
   - با یک تصویر کوچک تست شود که submit انجام می‌شود و به `review.html` می‌رود.
   - با چند تصویر حجیم‌تر تست شود که خطای localStorage باعث توقف submit نشود.
   - بعد از submit، `database.json` بررسی شود که سفارش جدید شامل `attachments` است.
   - در `order-detail.html` و `admin-orders.html` پاپ‌آپ فایل باز شود و در مدیریت دکمه دانلود وجود داشته باشد.

## معیار پذیرش
- با آپلود فایل در توضیحات اضافی، کلیک روی ثبت/مرحله بعد حتماً سفارش را ارسال کند و به مرحله بعد برود.
- فایل‌های آپلودشده همراه سفارش در دیتابیس ذخیره شوند.
- در review، order detail، و admin، فایل‌ها با آیکون تصویر قابل مشاهده باشند.
- در بخش مدیریت، داخل پاپ‌آپ فایل‌ها دکمه دانلود نمایش داده شود.
