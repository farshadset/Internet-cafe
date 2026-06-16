# Add All Mega Menu Items to Pricing Page

## Goal
Update `PRICING_DATA` in `public/admin-pricing.html` so every category, group, and leaf link from the mega menu (`public/index.html`) exists as a distinct, separately-priced item. Each leaf gets its own unique `key`.

## Data source
Mega menu HTML provided by user + `public/index.html` `data-menu` keys:
`identity-judicial`, `finance`, `automotive`, `education`, `business-tax`, `government-services`

## Current gaps (from plan `update-pricing-menu.md`)
The current `PRICING_DATA` is missing many groups/leaves across all 6 categories. Every missing item must be added.

## Implementation
1. Open `public/admin-pricing.html`
2. Find the `var PRICING_DATA = { ... };` block (inside the inline `<script>`)
3. Replace the entire object with the complete hierarchy below, keeping the existing 3-level drill-down UI intact.

### Complete PRICING_DATA structure

```javascript
var PRICING_DATA = {
    'خدمات هویتی و قضایی': {
        icon: 'fa-id-card',
        services: {
            'کارت ملی و شناسنامه': {
                key: 'smartCard', title: 'کارت ملی هوشمند',
                subServices: {
                    'کارت ملی هوشمند': 'smartCard',
                    'المثنی کارت ملی': 'smartCardDuplicate',
                    'تغییر نشانی': 'addressChange',
                    'شناسنامه المثنی': 'idDuplicate',
                    'اصلاح مشخصات': 'infoCorrection'
                }
            },
            'گذرنامه و مهاجرت': {
                key: 'passport', title: 'ثبت نام گذرنامه', adminOnly: true,
                subServices: {
                    'ثبت نام گذرنامه': 'passport',
                    'تمدید پاسپورت': 'passportRenewal',
                    'المثنی گذرنامه': 'passportDuplicate',
                    'فرم مهاجرت': 'migrationForm'
                }
            },
            'سامانه ثنا و قضایی': {
                key: 'judicial', title: 'خدمات قضایی', adminOnly: true,
                subServices: {
                    'ثبت نام ثنا': 'sanaRegister',
                    'بازیابی رمز ثنا': 'judicial',
                    'ابلاغ الکترونیک': 'electronicNotice',
                    'پیگیری پرونده': 'caseTracking',
                    'نوبت‌دهی قضایی': 'judicialAppointment'
                }
            },
            'سوء پیشینه و استعلام‌ها': {
                key: 'criminalRecord', title: 'صدور گواهی عدم سوء پیشینه',
                subServices: {
                    'گواهی عدم سوء پیشینه': 'criminalRecord',
                    'استعلام کد ملی': 'nationalIdInquiry',
                    'استعلام شناسنامه': 'idInquiry',
                    'استعلام محکومیت': 'licenses'
                }
            }
        }
    },
    'خدمات بانکی، مالی و بورسی': {
        icon: 'fa-wallet',
        services: {
            'وام و تسهیلات': {
                key: 'marriage', title: 'وام ازدواج',
                subServices: {
                    'وام ازدواج': 'marriage',
                    'وام ودیعه مسکن': 'rental',
                    'وام ضروری': 'urgentLoan',
                    'تسهیلات خرید مسکن': 'housingPurchase'
                }
            },
            'یارانه و سهام عدالت': {
                key: 'subsidy', title: 'ثبت‌نام یارانه معیشتی',
                subServices: {
                    'یارانه معیشتی': 'subsidy',
                    'اعتراض یارانه': 'subsidyAppeal',
                    'سهام عدالت': 'justiceStocks',
                    'فروش سهام': 'stockTrade'
                }
            },
            'بورس و سجام': {
                key: 'sjam', title: 'سجام',
                subServices: {
                    'ثبت سجام': 'sjam',
                    'احراز هویت بورسی': 'stockAuth',
                    'افتتاح کد بورسی': 'stockRegistration'
                }
            },
            'خدمات بانکی': {
                key: 'finance', title: 'افتتاح حساب',
                subServices: {
                    'افتتاح حساب': 'finance',
                    'احراز هویت بانک': 'bankAuth',
                    'اعتبارسنجی مرآت': 'meratValidation',
                    'پرداخت آنلاین': 'onlinePayment'
                }
            }
        }
    },
    'خودرو و حمل و نقل': {
        icon: 'fa-car',
        services: {
            'کارت سوخت': {
                key: 'fuel', title: 'ثبت نام کارت سوخت',
                subServices: {
                    'صدور کارت سوخت': 'fuel',
                    'المثنی کارت سوخت': 'fuelDuplicate',
                    'انتقال کارت سوخت': 'fuelTransfer'
                }
            },
            'تعویض پلاک و خودرو': {
                key: 'plateTransfer', title: 'نقل و انتقال خودرو',
                subServices: {
                    'نوبت تعویض پلاک': 'plateAppointment',
                    'نقل و انتقال خودرو': 'vehicleTransfer',
                    'مالیات نقل و انتقال': 'transferTax'
                }
            },
            'جریمه و معاینه فنی': {
                key: 'finePayment', title: 'پرداخت آنلاین جریمه',
                subServices: {
                    'استعلام خلافی': 'fineInquiry',
                    'پرداخت جریمه': 'finePayment',
                    'اعتراض جریمه': 'fineAppeal',
                    'نوبت معاینه فنی': 'technicalInspectionAppointment'
                }
            },
            'ثبت نام خودرو': {
                key: 'vehicles', title: 'ثبت نام خودرو',
                subServices: {
                    'ایران خودرو': 'vehicles',
                    'سایپا': 'vehicles',
                    'سامانه یکپارچه': 'vehicles',
                    'انتخاب خودرو': 'vehicles'
                }
            },
            'خدمات شهری': {
                key: 'urbanServices', title: 'خدمات شهری',
                subServices: {
                    'تهران من': 'tehranMan',
                    'یارانه سوخت وانت': 'fuelSubsidy'
                }
            }
        }
    },
    'آموزش، دانشگاه و آزمون‌ها': {
        icon: 'fa-graduation-cap',
        services: {
            'مدارس': {
                key: 'schools', title: 'پیش ثبت نام مدارس',
                subServices: {
                    'پیش ثبت نام مدارس': 'schools',
                    'مدارس شاهد': 'specialSchools',
                    'مدارس تیزهوشان': 'specialSchools',
                    'مدارس غیردولتی': 'nonGovSchools'
                }
            },
            'دانشگاه‌ها': {
                key: 'university', title: 'ثبت نام دانشگاه‌ها',
                subServices: {
                    'دانشگاه آزاد': 'universityRegistration',
                    'پیام نور': 'universityRegistration',
                    'علمی کاربردی': 'universityRegistration',
                    'ثبت نام غیرحضوری': 'nonAttendeeRegistration'
                }
            },
            'کنکور و آزمون‌ها': {
                key: 'konkor', title: 'ثبت‌نام کنکور سراسری',
                subServices: {
                    'کنکور سراسری': 'konkor',
                    'ارشد': 'konkor',
                    'دکتری': 'konkor'
                }
            },
            'آزمون‌های استخدامی': {
                key: 'employmentExam', title: 'ثبت نام آزمون استخدامی',
                subServices: {
                    'آموزش و پرورش': 'employmentExam',
                    'بانک‌ها': 'employmentExam',
                    'دستگاه‌های دولتی': 'employmentExam'
                }
            },
            'خدمات دانشجویی': {
                key: 'studentServices', title: 'خدمات دانشجویی',
                subServices: {
                    'سامانه‌های آموزشی': 'studentPortal',
                    'وام دانشجویی': 'studentLoan'
                }
            },
            'آزمون‌های بین‌المللی': {
                key: 'ieltsToefl', title: 'ثبت‌نام تافل و آیلتس',
                subServices: {
                    'تافل و آیلتس': 'ieltsToefl'
                }
            }
        }
    },
    'مالیات، مجوز و کسب‌وکار': {
        icon: 'fa-briefcase',
        services: {
            'مالیات': {
                key: 'tax', title: 'اظهارنامه مالیاتی',
                subServices: {
                    'اظهارنامه مالیاتی': 'businessTax',
                    'تبصره ۱۰۰': 'tax',
                    'ارزش افزوده': 'businessTax',
                    'اعتراض مالیاتی': 'businessTax',
                    'کد اقتصادی': 'economicCode'
                }
            },
            'ثبت و تغییرات شرکت': {
                key: 'companyRegister', title: 'ثبت شرکت',
                subServices: {
                    'ثبت شرکت': 'companyRegister',
                    'ثبت برند': 'brandRegister',
                    'تغییرات شرکت': 'companyChanges'
                }
            },
            'مجوزها': {
                key: 'licenses', title: 'مجوزها',
                subServices: {
                    'سامانه ملی مجوزها': 'licenses',
                    'جواز کسب': 'businessTax',
                    'مجوز صنفی': 'licenses',
                    'مجوز تولیدی': 'licenses'
                }
            },
            'اصناف و اماکن': {
                key: 'businessPermits', title: 'اصناف و اماکن',
                subServices: {
                    'نوین اصناف': 'licenses',
                    'بازدید اماکن': 'licenses',
                    'صلاحیت بهداشتی': 'licenses',
                    'گواهی مالیاتی ۱۸۶': 'licenses'
                }
            }
        }
    },
    'سامانه‌های دولتی': {
        icon: 'fa-landmark',
        services: {
            'سامانه‌های عمومی': {
                key: 'government', title: 'سامانه‌های عمومی',
                subServices: {
                    'میخک': 'government',
                    'سخا': 'government',
                    'شمس': 'government',
                    'ستاد ایران': 'government'
                }
            },
            'املاک و اسکان': {
                key: 'housing', title: 'املاک و اسکان',
                subServices: {
                    'ثبت‌نام املاک و اسکان': 'housing',
                    'خودنویس': 'government',
                    'ثبت سند ملکی': 'government'
                }
            },
            'تأمین اجتماعی و بیمه': {
                key: 'insurance', title: 'تأمین اجتماعی و بیمه',
                subServices: {
                    'نام نویسی کارفرما': 'insurance',
                    'ثبت نیروی کار': 'insurance',
                    'ارسال لیست بیمه': 'insurance',
                    'بیمه با سابقه': 'insurance',
                    'کمیسیون پزشکی': 'insurance',
                    'کمک هزینه عینک': 'insurance',
                    'کمک هزینه سمعک': 'insurance'
                }
            },
            'خدمات توکن': {
                key: 'token', title: 'خدمات توکن',
                subServices: {
                    'راه‌اندازی توکن': 'token',
                    'امضا در ثبت من': 'government',
                    'امضای نرم‌افزاری': 'token'
                }
            },
            'خدمات انتخاباتی': {
                key: 'election', title: 'خدمات انتخاباتی',
                adminOnly: true,
                subServices: {
                    'رأی اولی‌ها': 'election',
                    'تعیین شعبه': 'election',
                    'تأیید صلاحیت': 'election'
                }
            }
        }
    }
};
```

## Validation
After edit, open the page and verify:
- Every category from mega menu is listed.
- Each category expands to show its groups.
- Each group expands to show all leaf items with unique edit buttons.
- Setting a price saves to DB and reappears on reload.
