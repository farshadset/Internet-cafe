/* ══════════════════════════════════════════════════════════════
   pricing-catalog.js — Single source of truth for service catalog
   UMD: works in browser (window.PricingCatalog) + Node (require)
   ══════════════════════════════════════════════════════════════ */
(function (root, factory) {
    var catalog = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
    else root.PricingCatalog = catalog;
})(typeof self !== 'undefined' ? self : this, function () {

    var CATALOG = {
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
                    key: 'passportRegistration', title: 'ثبت نام گذرنامه', adminOnly: true,
                    subServices: {
                        'ثبت نام گذرنامه': 'passportRegistration',
                        'تمدید پاسپورت': 'passportRenewal',
                        'المثنی گذرنامه': 'passportDuplicate',
                        'فرم مهاجرت': 'migrationForm'
                    }
                },
                'سامانه ثنا و قضایی': {
                    key: 'sanaRegister', title: 'خدمات قضایی', adminOnly: true,
                    subServices: {
                        'ثبت نام ثنا': 'sanaRegister',
                        'بازیابی رمز ثنا': 'judicialPasswordRecovery',
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
                        'استعلام محکومیت': 'criminalInquiry'
                    }
                }
            }
        },
        'خدمات بانکی، مالی و بورسی': {
            icon: 'fa-wallet',
            services: {
                'وام و تسهیلات': {
                    key: 'marriageLoan', title: 'وام ازدواج',
                    subServices: {
                        'وام ازدواج': 'marriageLoan',
                        'وام ودیعه مسکن': 'rentalDeposit',
                        'وام ضروری': 'urgentLoan',
                        'تسهیلات خرید مسکن': 'housingPurchaseLoan'
                    }
                },
                'یارانه و سهام عدالت': {
                    key: 'subsidyRegistration', title: 'ثبت‌نام یارانه معیشتی',
                    subServices: {
                        'یارانه معیشتی': 'subsidyRegistration',
                        'اعتراض یارانه': 'subsidyAppeal',
                        'سهام عدالت': 'justiceStocks',
                        'فروش سهام': 'stockSale'
                    }
                },
                'بورس و سجام': {
                    key: 'sjamRegistration', title: 'سجام',
                    subServices: {
                        'ثبت سجام': 'sjamRegistration',
                        'احراز هویت بورسی': 'stockAuth',
                        'افتتاح کد بورسی': 'stockRegistration'
                    }
                },
                'خدمات بانکی': {
                    key: 'bankAccountOpening', title: 'افتتاح حساب',
                    subServices: {
                        'افتتاح حساب': 'bankAccountOpening',
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
                    key: 'fuelCardIssue', title: 'ثبت نام کارت سوخت',
                    subServices: {
                        'صدور کارت سوخت': 'fuelCardIssue',
                        'المثنی کارت سوخت': 'fuelCardDuplicate',
                        'انتقال کارت سوخت': 'fuelCardTransfer'
                    }
                },
                'تعویض پلاک و خودرو': {
                    key: 'plateExchangeAppointment', title: 'نقل و انتقال خودرو',
                    subServices: {
                        'نوبت تعویض پلاک': 'plateExchangeAppointment',
                        'نقل و انتقال خودرو': 'vehicleTransfer',
                        'مالیات نقل و انتقال': 'vehicleTransferTax'
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
                    key: 'iranKhodroRegistration', title: 'ثبت نام خودرو',
                    subServices: {
                        'ایران خودرو': 'iranKhodroRegistration',
                        'سایپا': 'saipaRegistration',
                        'سامانه یکپارچه': 'integratedVehicleRegistration',
                        'انتخاب خودرو': 'vehicleSelection'
                    }
                },
                'خدمات شهری': {
                    key: 'tehranMan', title: 'خدمات شهری',
                    subServices: {
                        'تهران من': 'tehranMan',
                        'یارانه سوخت وانت': 'vanFuelSubsidy'
                    }
                }
            }
        },
        'آموزش، دانشگاه و آزمون‌ها': {
            icon: 'fa-graduation-cap',
            services: {
                'مدارس': {
                    key: 'schoolPreRegistration', title: 'پیش ثبت نام مدارس',
                    subServices: {
                        'پیش ثبت نام مدارس': 'schoolPreRegistration',
                        'مدارس شاهد': 'witnessSchools',
                        'مدارس تیزهوشان': 'giftedSchools',
                        'مدارس غیردولتی': 'nonGovSchools'
                    }
                },
                'دانشگاه‌ها': {
                    key: 'azadUniversityRegistration', title: 'ثبت نام دانشگاه‌ها',
                    subServices: {
                        'دانشگاه آزاد': 'azadUniversityRegistration',
                        'پیام نور': 'payamNoorRegistration',
                        'علمی کاربردی': 'appliedScienceRegistration',
                        'ثبت نام غیرحضوری': 'nonAttendeeRegistration'
                    }
                },
                'کنکور و آزمون‌ها': {
                    key: 'konkurSarasari', title: 'ثبت‌نام کنکور سراسری',
                    subServices: {
                        'کنکور سراسری': 'konkurSarasari',
                        'ارشد': 'mastersExam',
                        'دکتری': 'doctorateExam'
                    }
                },
                'آزمون‌های استخدامی': {
                    key: 'employmentEducation', title: 'ثبت نام آزمون استخدامی',
                    subServices: {
                        'آموزش و پرورش': 'employmentEducation',
                        'بانک‌ها': 'bankEmploymentExam',
                        'دستگاه‌های دولتی': 'governmentEmploymentExam'
                    }
                },
                'خدمات دانشجویی': {
                    key: 'studentPortal', title: 'خدمات دانشجویی',
                    subServices: {
                        'سامانه‌های آموزشی': 'studentPortal',
                        'وام دانشجویی': 'studentLoan'
                    }
                },
                'آزمون‌های بین‌المللی': {
                    key: 'ieltsToeflRegistration', title: 'ثبت‌نام تافل و آیلتس',
                    subServices: {
                        'تافل و آیلتس': 'ieltsToeflRegistration'
                    }
                }
            }
        },
        'مالیات، مجوز و کسب‌وکار': {
            icon: 'fa-briefcase',
            services: {
                'مالیات': {
                    key: 'taxReturn', title: 'اظهارنامه مالیاتی',
                    subServices: {
                        'اظهارنامه مالیاتی': 'taxReturn',
                        'تبصره ۱۰۰': 'tabssore100',
                        'ارزش افزوده': 'vatTax',
                        'اعتراض مالیاتی': 'taxAppeal',
                        'کد اقتصادی': 'economicCode'
                    }
                },
                'ثبت و تغییرات شرکت': {
                    key: 'companyRegistration', title: 'ثبت شرکت',
                    subServices: {
                        'ثبت شرکت': 'companyRegistration',
                        'ثبت برند': 'brandRegistration',
                        'تغییرات شرکت': 'companyChanges'
                    }
                },
                'مجوزها': {
                    key: 'nationalPermitSystem', title: 'مجوزها',
                    subServices: {
                        'سامانه ملی مجوزها': 'nationalPermitSystem',
                        'جواز کسب': 'businessPermitLicense',
                        'مجوز صنفی': 'professionalPermit',
                        'مجوز تولیدی': 'productionPermit'
                    }
                },
                'اصناف و اماکن': {
                    key: 'novinAsnaf', title: 'اصناف و اماکن',
                    subServices: {
                        'نوین اصناف': 'novinAsnaf',
                        'بازدید اماکن': 'locationInspection',
                        'صلاحیت بهداشتی': 'healthQualification',
                        'گواهی مالیاتی ۱۸۶': 'taxCertificate186'
                    }
                }
            }
        },
        'سامانه‌های دولتی': {
            icon: 'fa-landmark',
            services: {
                'سامانه‌های عمومی': {
                    key: 'mikhak', title: 'سامانه‌های عمومی',
                    subServices: {
                        'میخک': 'mikhak',
                        'سخا': 'sakha',
                        'شمس': 'shams',
                        'ستاد ایران': 'setadIran'
                    }
                },
                'املاک و اسکان': {
                    key: 'realEstateHousingRegistration', title: 'املاک و اسکان',
                    subServices: {
                        'ثبت‌نام املاک و اسکان': 'realEstateHousingRegistration',
                        'خودنویس': 'khodnevis',
                        'ثبت سند ملکی': 'propertyDeedRegistration'
                    }
                },
                'تأمین اجتماعی و بیمه': {
                    key: 'employerRegistration', title: 'تأمین اجتماعی و بیمه',
                    subServices: {
                        'نام نویسی کارفرما': 'employerRegistration',
                        'ثبت نیروی کار': 'workforceRegistration',
                        'ارسال لیست بیمه': 'insuranceListSubmission',
                        'بیمه با سابقه': 'experiencedInsurance',
                        'کمیسیون پزشکی': 'medicalCommission',
                        'کمک هزینه عینک': 'glassesAid',
                        'کمک هزینه سمعک': 'hearingAid'
                    }
                },
                'خدمات توکن': {
                    key: 'tokenSetup', title: 'خدمات توکن',
                    subServices: {
                        'راه‌اندازی توکن': 'tokenSetup',
                        'امضا در ثبت من': 'thabtemSign',
                        'امضای نرم‌افزاری': 'softwareSignature'
                    }
                },
                'خدمات انتخاباتی': {
                    key: 'firstVoters', title: 'خدمات انتخاباتی',
                    adminOnly: true,
                    subServices: {
                        'رأی اولی‌ها': 'firstVoters',
                        'تعیین شعبه': 'branchDetermination',
                        'تأیید صلاحیت': 'qualificationApproval'
                    }
                }
            }
        }
    };

    var _keysCache = null;
    function _buildKeys() {
        if (_keysCache) return _keysCache;
        _keysCache = {};
        Object.keys(CATALOG).forEach(function (category) {
            var services = CATALOG[category].services || {};
            Object.keys(services).forEach(function (groupName) {
                var svc = services[groupName];
                if (svc.subServices) {
                    Object.keys(svc.subServices).forEach(function (subName) {
                        _keysCache[svc.subServices[subName]] = true;
                    });
                } else {
                    _keysCache[svc.key] = true;
                }
            });
        });
        return _keysCache;
    }

    return {
        CATALOG: CATALOG,
        isValidKey: function (key) {
            return !!_buildKeys()[key];
        },
        getAllKeys: function () {
            return Object.keys(_buildKeys());
        }
    };
});
