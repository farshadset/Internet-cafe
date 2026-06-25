const EXTRA_SERVICE_OPTIONS = {
    judicial: {
        'judicial-password': 'بازیابی رمز شخصی ثنا',
        'judicial-appointment': 'نوبت‌دهی قضایی',
        'judicial-notice': 'دریافت ابلاغیه قضایی',
        'judicial-case': 'پیگیری پرونده قضایی آنلاین'
    },
    insurance: {
        employer: 'نام‌نویسی کارفرما در کارگاه',
        worker: 'ثبت نیروی کار در کارگاه',
        history: 'ثبت بیمه با سابقه',
        list: 'ارسال لیست بیمه',
        commission: 'ثبت کمیسیون پزشکی بازنشستگی',
        allowance: 'کمک هزینه عینک و سمعک'
    },
    student: {
        educationyar: 'ثبت‌نام دانشگاه آزاد (آموزشیار)',
        payamNoor: 'ثبت‌نام دانشگاه پیام نور',
        educationalSystems: 'ثبت‌نام سامانه‌های آموزشی'
    },
    government: {
        mikhak: 'ثبت‌نام سامانه میخک',
        setad: 'ثبت‌نام سامانه ستاد ایران',
        sakha: 'ثبت‌نام سامانه سخا',
        shams: 'ثبت‌نام سامانه شمس',
        amlak: 'ثبت‌نام سامانه املاک و اسکان',
        khodnevis: 'ثبت قرارداد در سامانه خودنویس',
        propertyDocument: 'ثبت سند ملکی در سامانه',
        licenseUniqueId: 'دریافت شناسه یکتا برای مجوزها'
    },
    tax: {
        objection: 'ثبت اعتراض مالیاتی',
        group1: 'ارسال اظهارنامه گروه ۱',
        group2: 'ارسال اظهارنامه گروه ۲',
        article95: 'اظهارنامه عادی ماده ۹۵',
        article100: 'اظهارنامه تبصره ۱۰۰',
        economicCode: 'بروزرسانی کد اقتصادی',
        acquirer: 'اتصال پذیرنده مالیاتی'
    },
    'business-tax': {
        taxReturn: 'اظهارنامه مالیاتی',
        article100: 'تبصره ۱۰۰',
        vat: 'ارزش افزوده',
        economicCode: 'کد اقتصادی',
        company: 'ثبت شرکت',
        brand: 'ثبت برند',
        companyChanges: 'تغییرات شرکت',
        license: 'جواز کسب',
        guildLicense: 'مجوز صنفی',
        productionLicense: 'مجوز تولیدی'
    },
    finance: {
        account: 'افتتاح حساب بانکی',
        bankIdentity: 'احراز هویت بانک‌ها',
        merat: 'اعتبارسنجی مرآت رسالت',
        onlinePayment: 'پرداخت آنلاین',
        violationPayment: 'پرداخت خلافی',
        transferTax: 'پرداخت مالیات نقل و انتقال'
    },
    vehicles: {
        ikco: 'ثبت‌نام ایران‌خودرو',
        saipa: 'ثبت‌نام سایپا',
        integrated: 'ثبت‌نام سامانه یکپارچه خودرو',
        carSelection: 'انتخاب خودرو',
        tehranMe: 'ثبت‌نام تهران من',
        vanFuel: 'ثبت یارانه سوخت وانت‌بار'
    },
    housing: {
        amlak: 'ثبت‌نام املاک و اسکان',
        marriage: 'ثبت‌نام وام ازدواج',
        rentalDeposit: 'ثبت‌نام وام ودیعه مسکن'
    },
    token: {
        saabtToken: 'امضا با توکن در سایت ثبت من',
        softwarePlatform: 'امضا با پلتفرم نرم‌افزاری',
        setup: 'راه‌اندازی توکن'
    },
    licenses: {
        portal: 'ورود به سامانه ملی مجوزها',
        initial: 'ثبت‌نام اولیه مجوز',
        policeVisit: 'درخواست بازدید اماکن',
        novinAsnaf: 'نوین اصناف',
        realPerson: 'ثبت مراحل اشخاص حقیقی',
        health: 'ثبت صلاحیت بهداشتی',
        tax186: 'دریافت گواهی مالیاتی ۱۸۶',
        militaryCard: 'استعلام کارت پایان خدمت',
        veteran: 'استعلام ایثارگری',
        conviction: 'استعلام محکومیت'
    },
    identity: {
        verification: 'احراز هویت',
        sejam: 'ثبت سجام'
    }
};

const EXTRA_IDENTITY_FIELDS = [
    { name: 'phone', label: 'شماره تلفن همراه', type: 'tel', placeholder: '09xx-xxx-xxxx', required: true },
    { name: 'nationalId', label: 'کد ملی', type: 'text', maxLength: 10, required: true },
    { name: 'birthDate', label: 'تاریخ تولد', type: 'dateParts', required: true }
];

const EXTRA_YES_NO_OPTIONS = { yes: 'بله', no: 'خیر' };

function EXTRA_JOIN_DATE_PARTS(data, prefix = 'birth') {
    return [data[prefix + 'Year'], data[prefix + 'Month'], data[prefix + 'Day']].filter(Boolean).join('/');
}

function EXTRA_OPTION_LABEL(value, options) {
    return options[value] || value;
}

function EXTRA_COMMON_IDENTITY_TRANSFORM(data) {
    return {
        phone: data.phone,
        nationalId: data.nationalId,
        birthDate: EXTRA_JOIN_DATE_PARTS(data)
    };
}

const EXTRA_SERVICE_CONFIGS = {
    judicial: {
        cost: 80000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت قضایی', type: 'select', required: true, options: {
                'judicial-password': 'بازیابی رمز شخصی ثنا',
                'judicial-appointment': 'نوبت‌دهی قضایی',
                'judicial-notice': 'دریافت ابلاغیه قضایی',
                'judicial-case': 'پیگیری پرونده قضایی آنلاین'
            }},
            { name: 'idNumber', label: 'شماره شناسنامه', type: 'text', required: false },
            { name: 'trackingCode', label: 'کد پیگیری/شماره پرونده', type: 'text', required: false },
            { name: 'province', label: 'استان', type: 'text', required: false },
            { name: 'city', label: 'شهر', type: 'text', required: false },
            { name: 'preferredDate', label: 'تاریخ/بازه زمانی پیشنهادی', type: 'text', required: false },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.judicial), idNumber: data.idNumber, trackingCode: data.trackingCode, province: data.province, city: data.city, preferredDate: data.preferredDate, notes: data.notes })
    },
    insurance: {
        title: 'خدمات بیمه و تأمین اجتماعی',
        cost: 120000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت بیمه/تأمین اجتماعی', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS.insurance },
            { name: 'employerPhone', label: 'تلفن کارفرما', type: 'tel', required: false },
            { name: 'employerNationalId', label: 'کد ملی کارفرما', type: 'text', maxLength: 10, required: false },
            { name: 'workerPhone', label: 'تلفن نیروی کار', type: 'tel', required: false },
            { name: 'workerNationalId', label: 'کد ملی نیروی کار', type: 'text', maxLength: 10, required: false },
            { name: 'workshopCode', label: 'کد کارگاه', type: 'text', required: false },
            { name: 'workshopName', label: 'نام کارگاه/واحد', type: 'text', required: false },
            { name: 'workshopAddress', label: 'آدرس کارگاه', type: 'textarea', required: false },
            { name: 'insuranceNumber', label: 'شماره بیمه/سوابق', type: 'text', required: false },
            { name: 'listYear', label: 'سال لیست بیمه', type: 'text', required: false },
            { name: 'listMonth', label: 'ماه لیست بیمه', type: 'text', required: false },
            { name: 'commissionType', label: 'نوع کمیسیون پزشکی', type: 'select', required: false, options: { 'retirement': 'بازنشستگی', 'disability': 'ازکارافتادگی', 'other': 'سایر' } },
            { name: 'allowanceType', label: 'نوع کمک‌هزینه', type: 'select', required: false, options: { 'glasses': 'عینک', 'hearing': 'سمعک', 'both': 'عینک و سمعک' } },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.insurance), employerPhone: data.employerPhone, employerNationalId: data.employerNationalId, workerPhone: data.workerPhone, workerNationalId: data.workerNationalId, workshopCode: data.workshopCode, workshopName: data.workshopName, workshopAddress: data.workshopAddress, insuranceNumber: data.insuranceNumber, listYear: data.listYear, listMonth: data.listMonth, commissionType: EXTRA_OPTION_LABEL(data.commissionType, { retirement: 'بازنشستگی', disability: 'ازکارافتادگی', other: 'سایر' }), allowanceType: EXTRA_OPTION_LABEL(data.allowanceType, { glasses: 'عینک', hearing: 'سمعک', both: 'عینک و سمعک' }), notes: data.notes })
    },
    student: {
        title: 'خدمات دانشجویی و آموزشی',
        cost: 100000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت آموزشی', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS.student },
            { name: 'systemName', label: 'نام سامانه آموزشی', type: 'text', required: false },
            { name: 'username', label: 'نام کاربری سامانه', type: 'text', required: false },
            { name: 'studentNumber', label: 'شماره دانشجویی', type: 'text', required: false },
            { name: 'acceptanceCode', label: 'کد پذیرش/ثبت‌نام', type: 'text', required: false },
            { name: 'trackingCode', label: 'کد پیگیری', type: 'text', required: false },
            { name: 'campus', label: 'مرکز/واحد دانشگاهی', type: 'text', required: false },
            { name: 'field', label: 'رشته یا مقطع', type: 'text', required: false },
            { name: 'documentStatus', label: 'وضعیت مدارک', type: 'select', required: false, options: { 'complete': 'کامل', 'needsUpload': 'نیاز به بارگذاری', 'needsCorrection': 'نیاز به اصلاح' } },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.student), systemName: data.systemName, username: data.username, studentNumber: data.studentNumber, acceptanceCode: data.acceptanceCode, trackingCode: data.trackingCode, campus: data.campus, field: data.field, documentStatus: EXTRA_OPTION_LABEL(data.documentStatus, { complete: 'کامل', needsUpload: 'نیاز به بارگذاری', needsCorrection: 'نیاز به اصلاح' }), notes: data.notes })
    },
    government: {
        title: 'خدمات سامانه‌های دولتی',
        cost: 80000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع سامانه دولتی', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS.government },
            { name: 'email', label: 'ایمیل', type: 'email', required: false },
            { name: 'trackingCode', label: 'کد پیگیری/رهگیری', type: 'text', required: false },
            { name: 'propertyCode', label: 'کد ملک/شناسه یکتا', type: 'text', required: false },
            { name: 'contractType', label: 'نوع قرارداد', type: 'select', required: false, options: { 'rent': 'اجاره', 'sale': 'خرید و فروش', 'other': 'سایر' } },
            { name: 'landlordPhone', label: 'تلفن موجر/مالک', type: 'tel', required: false },
            { name: 'tenantPhone', label: 'تلفن مستأجر/متقاضی', type: 'tel', required: false },
            { name: 'contractDate', label: 'تاریخ قرارداد', type: 'text', required: false },
            { name: 'licenseCategory', label: 'دسته مجوز', type: 'text', required: false },
            { name: 'workshopAddress', label: 'آدرس محل فعالیت', type: 'textarea', required: false },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.government), email: data.email, trackingCode: data.trackingCode, propertyCode: data.propertyCode, contractType: EXTRA_OPTION_LABEL(data.contractType, { rent: 'اجاره', sale: 'خرید و فروش', other: 'سایر' }), landlordPhone: data.landlordPhone, tenantPhone: data.tenantPhone, contractDate: data.contractDate, licenseCategory: data.licenseCategory, workshopAddress: data.workshopAddress, notes: data.notes })
    },
    'business-tax': {
        title: 'مالیات، مجوز و کسب‌وکار',
        cost: 120000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت مالیات/مجوز/کسب‌وکار', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS['business-tax'] },
            { name: 'email', label: 'ایمیل', type: 'email', required: false },
            { name: 'businessName', label: 'نام شرکت/برند/کسب‌وکار', type: 'text', required: false },
            { name: 'businessCategory', label: 'دسته فعالیت', type: 'text', required: false },
            { name: 'trackingCode', label: 'کد پیگیری/شناسه ملی', type: 'text', required: false },
            { name: 'workshopAddress', label: 'آدرس محل فعالیت', type: 'textarea', required: false },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS['business-tax']), email: data.email, businessName: data.businessName, businessCategory: data.businessCategory, trackingCode: data.trackingCode, workshopAddress: data.workshopAddress, notes: data.notes })
    },
    tax: {
        title: 'خدمات مالیاتی',
        cost: 150000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت مالیاتی', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS.tax },
            { name: 'taxCode', label: 'کد اقتصادی/شماره پرونده مالیاتی', type: 'text', required: false },
            { name: 'taxYear', label: 'سال مالیاتی', type: 'text', required: false },
            { name: 'paperNumber', label: 'شماره برگ تشخیص/ابلاغیه', type: 'text', required: false },
            { name: 'objectionReason', label: 'شرح اعتراض', type: 'textarea', required: false },
            { name: 'incomeAmount', label: 'مبلغ درآمد/فروش اظهارشده', type: 'text', required: false },
            { name: 'salesAmount', label: 'مبلغ فروش', type: 'text', required: false },
            { name: 'vatAmount', label: 'مالیات بر ارزش افزوده', type: 'text', required: false },
            { name: 'legalPersonType', label: 'نوع شخص حقوقی', type: 'select', required: false, options: { 'company': 'شرکت', 'institution': 'مؤسسه', 'other': 'سایر' } },
            { name: 'expenseAmount', label: 'مبلغ هزینه‌ها', type: 'text', required: false },
            { name: 'economicCode', label: 'کد اقتصادی', type: 'text', required: false },
            { name: 'businessCategory', label: 'دسته فعالیت', type: 'text', required: false },
            { name: 'merchantId', label: 'شناسه پذیرنده/فروشگاه', type: 'text', required: false },
            { name: 'terminalId', label: 'شناسه پایانه/درگاه', type: 'text', required: false },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.tax), taxCode: data.taxCode, taxYear: data.taxYear, paperNumber: data.paperNumber, objectionReason: data.objectionReason, incomeAmount: data.incomeAmount, salesAmount: data.salesAmount, vatAmount: data.vatAmount, legalPersonType: EXTRA_OPTION_LABEL(data.legalPersonType, { company: 'شرکت', institution: 'مؤسسه', other: 'سایر' }), expenseAmount: data.expenseAmount, economicCode: data.economicCode, businessCategory: data.businessCategory, merchantId: data.merchantId, terminalId: data.terminalId, notes: data.notes })
    },
    finance: {
        title: 'خدمات بانکی و مالی',
        cost: 100000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت بانکی/مالی', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS.finance },
            { name: 'bankName', label: 'نام بانک', type: 'select', required: false, options: { melli: 'بانک ملی', saman: 'بانک سامان', saderat: 'بانک صادرات', pasargad: 'بانک پاسارگاد', resalat: 'بانک رسالت', other: 'سایر' } },
            { name: 'accountType', label: 'نوع حساب', type: 'select', required: false, options: { qard: 'قرض‌الحسنه', current: 'جاری', saving: 'پس‌انداز', other: 'سایر' } },
            { name: 'verificationLevel', label: 'سطح احراز هویت', type: 'select', required: false, options: { basic: 'پایه', advanced: 'تکمیلی', full: 'کامل' } },
            { name: 'jobType', label: 'نوع شغل', type: 'select', required: false, options: { employee: 'کارمند', selfEmployed: 'شغل آزاد', retired: 'بازنشسته', student: 'دانشجو', other: 'سایر' } },
            { name: 'monthlyIncome', label: 'درآمد ماهانه', type: 'text', required: false },
            { name: 'paymentType', label: 'نوع پرداخت', type: 'select', required: false, options: { bill: 'قبض/شناسه پرداخت', tax: 'مالیات', violation: 'خلافی', transferTax: 'مالیات نقل و انتقال', other: 'سایر' } },
            { name: 'billId', label: 'شناسه قبض', type: 'text', required: false },
            { name: 'paymentId', label: 'شناسه پرداخت', type: 'text', required: false },
            { name: 'amount', label: 'مبلغ پرداختی', type: 'text', required: false },
            { name: 'plateNumber', label: 'شماره پلاک', type: 'text', required: false },
            { name: 'vin', label: 'شماره VIN/بارکد کارت خودرو', type: 'text', required: false },
            { name: 'vehicleType', label: 'نوع خودرو', type: 'text', required: false },
            { name: 'transferDate', label: 'تاریخ انتقال', type: 'text', required: false },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.finance), bankName: EXTRA_OPTION_LABEL(data.bankName, { melli: 'بانک ملی', saman: 'بانک سامان', saderat: 'بانک صادرات', pasargad: 'بانک پاسارگاد', resalat: 'بانک رسالت', other: 'سایر' }), accountType: EXTRA_OPTION_LABEL(data.accountType, { qard: 'قرض‌الحسنه', current: 'جاری', saving: 'پس‌انداز', other: 'سایر' }), verificationLevel: EXTRA_OPTION_LABEL(data.verificationLevel, { basic: 'پایه', advanced: 'تکمیلی', full: 'کامل' }), jobType: EXTRA_OPTION_LABEL(data.jobType, { employee: 'کارمند', selfEmployed: 'شغل آزاد', retired: 'بازنشسته', student: 'دانشجو', other: 'سایر' }), monthlyIncome: data.monthlyIncome, paymentType: EXTRA_OPTION_LABEL(data.paymentType, { bill: 'قبض/شناسه پرداخت', tax: 'مالیات', violation: 'خلافی', transferTax: 'مالیات نقل و انتقال', other: 'سایر' }), billId: data.billId, paymentId: data.paymentId, amount: data.amount, plateNumber: data.plateNumber, vin: data.vin, vehicleType: data.vehicleType, transferDate: data.transferDate, notes: data.notes })
    },
    vehicles: {
        title: 'خدمات خودرو',
        cost: 120000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت خودرو', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS.vehicles },
            { name: 'manufacturer', label: 'خودروساز/سامانه', type: 'select', required: false, options: { ikco: 'ایران‌خودرو', saipa: 'سایپا', integrated: 'سامانه یکپارچه', other: 'سایر' } },
            { name: 'campaignName', label: 'نام طرح/فراخوان', type: 'text', required: false },
            { name: 'model', label: 'مدل خودرو', type: 'text', required: false },
            { name: 'escrowBank', label: 'بانک حساب وکالتی', type: 'text', required: false },
            { name: 'escrowReceiptCode', label: 'کد رسید مسدودی حساب وکالتی', type: 'text', required: false },
            { name: 'registrationCode', label: 'کد ثبت‌نام/رهگیری', type: 'text', required: false },
            { name: 'selectedModel', label: 'خودروی انتخابی', type: 'text', required: false },
            { name: 'representativeProvince', label: 'استان نمایندگی', type: 'text', required: false },
            { name: 'email', label: 'ایمیل', type: 'email', required: false },
            { name: 'plateNumber', label: 'شماره پلاک', type: 'text', required: false },
            { name: 'fuelCardCode', label: 'کد کارت سوخت/یارانه', type: 'text', required: false },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.vehicles), manufacturer: EXTRA_OPTION_LABEL(data.manufacturer, { ikco: 'ایران‌خودرو', saipa: 'سایپا', integrated: 'سامانه یکپارچه', other: 'سایر' }), campaignName: data.campaignName, model: data.model, escrowBank: data.escrowBank, escrowReceiptCode: data.escrowReceiptCode, registrationCode: data.registrationCode, selectedModel: data.selectedModel, representativeProvince: data.representativeProvince, email: data.email, plateNumber: data.plateNumber, fuelCardCode: data.fuelCardCode, notes: data.notes })
    },
    housing: {
        title: 'خدمات مسکن و وام',
        cost: 250000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت مسکن/وام', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS.housing },
            { name: 'postalCode', label: 'کد پستی', type: 'text', required: false },
            { name: 'ownershipStatus', label: 'وضعیت سکونت/مالکیت', type: 'select', required: false, options: { renter: 'مستأجر', owner: 'مالک', loan: 'وام‌دار', other: 'سایر' } },
            { name: 'propertyCode', label: 'کد ملک/شناسه یکتا', type: 'text', required: false },
            { name: 'marriageDate', label: 'تاریخ عقد', type: 'dateParts', prefix: 'marriage', required: false },
            { name: 'idNumber', label: 'شماره شناسنامه', type: 'text', required: false },
            { name: 'contractNumber', label: 'شماره قرارداد اجاره', type: 'text', required: false },
            { name: 'iban', label: 'شماره شبا', type: 'text', required: false },
            { name: 'depositAmount', label: 'مبلغ ودیعه', type: 'text', required: false },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.housing), postalCode: data.postalCode, ownershipStatus: EXTRA_OPTION_LABEL(data.ownershipStatus, { renter: 'مستأجر', owner: 'مالک', loan: 'وام‌دار', other: 'سایر' }), propertyCode: data.propertyCode, marriageDate: EXTRA_JOIN_DATE_PARTS(data, 'marriage'), idNumber: data.idNumber, contractNumber: data.contractNumber, iban: data.iban, depositAmount: data.depositAmount, notes: data.notes })
    },
    token: {
        title: 'خدمات امضا و توکن',
        cost: 150000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت امضا/توکن', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS.token },
            { name: 'requestNumber', label: 'شماره درخواست/سند', type: 'text', required: false },
            { name: 'tokenType', label: 'نوع توکن', type: 'select', required: false, options: { hardware: 'سخت‌افزاری USB', software: 'نرم‌افزاری', notSure: 'مطمئن نیستم' } },
            { name: 'tokenSerial', label: 'سریال توکن/گواهی', type: 'text', required: false },
            { name: 'platformName', label: 'نام پلتفرم', type: 'text', required: false },
            { name: 'softwareName', label: 'نام نرم‌افزار/میان‌افزار', type: 'text', required: false },
            { name: 'platformOs', label: 'سیستم‌عامل', type: 'select', required: false, options: { windows: 'ویندوز', macos: 'مک', linux: 'لینوکس', other: 'سایر' } },
            { name: 'driverInstalled', label: 'درایور/میان‌افزار نصب شده؟', type: 'select', required: false, options: EXTRA_YES_NO_OPTIONS },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.token), requestNumber: data.requestNumber, tokenType: EXTRA_OPTION_LABEL(data.tokenType, { hardware: 'سخت‌افزاری USB', software: 'نرم‌افزاری', notSure: 'مطمئن نیستم' }), tokenSerial: data.tokenSerial, platformName: data.platformName, softwareName: data.softwareName, platformOs: EXTRA_OPTION_LABEL(data.platformOs, { windows: 'ویندوز', macos: 'مک', linux: 'لینوکس', other: 'سایر' }), driverInstalled: EXTRA_OPTION_LABEL(data.driverInstalled, EXTRA_YES_NO_OPTIONS), notes: data.notes })
    },
    licenses: {
        title: 'خدمات مجوز و کسب‌وکار',
        cost: 120000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت مجوز/کسب‌وکار', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS.licenses },
            { name: 'email', label: 'ایمیل', type: 'email', required: false },
            { name: 'licenseCategory', label: 'رسته/دسته مجوز', type: 'text', required: false },
            { name: 'businessName', label: 'نام کسب‌وکار/متقاضی', type: 'text', required: false },
            { name: 'workshopAddress', label: 'آدرس محل فعالیت', type: 'textarea', required: false },
            { name: 'licenseTrackingCode', label: 'کد پیگیری مجوز', type: 'text', required: false },
            { name: 'visitType', label: 'نوع بازدید اماکن', type: 'select', required: false, options: { initial: 'اولیه', renewal: 'تمدید', changeAddress: 'تغییر آدرس' } },
            { name: 'guildName', label: 'نام اتحادیه/صنف', type: 'text', required: false },
            { name: 'licenseCode', label: 'کد مجوز/پروانه', type: 'text', required: false },
            { name: 'currentStep', label: 'مرحله فعلی', type: 'select', required: false, options: { initial: 'ثبت اولیه', documents: 'بارگذاری مدارک', policeVisit: 'بازدید اماکن', health: 'صلاحیت بهداشتی', tax186: 'گواهی ۱۸۶', final: 'صدور' } },
            { name: 'healthCode', label: 'کد پرونده صلاحیت بهداشتی', type: 'text', required: false },
            { name: 'taxCode', label: 'کد اقتصادی/پرونده مالیاتی', type: 'text', required: false },
            { name: 'sakhaCode', label: 'کد سخا/نظام وظیفه', type: 'text', required: false },
            { name: 'veteranCode', label: 'کد ایثارگری', type: 'text', required: false },
            { name: 'inquiryPurpose', label: 'علت استعلام', type: 'select', required: false, options: { employment: 'استخدام', license: 'مجوز', loan: 'وام', personal: 'اطلاع شخصی' } },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.licenses), email: data.email, licenseCategory: data.licenseCategory, businessName: data.businessName, workshopAddress: data.workshopAddress, licenseTrackingCode: data.licenseTrackingCode, visitType: EXTRA_OPTION_LABEL(data.visitType, { initial: 'اولیه', renewal: 'تمدید', changeAddress: 'تغییر آدرس' }), guildName: data.guildName, licenseCode: data.licenseCode, currentStep: EXTRA_OPTION_LABEL(data.currentStep, { initial: 'ثبت اولیه', documents: 'بارگذاری مدارک', policeVisit: 'بازدید اماکن', health: 'صلاحیت بهداشتی', tax186: 'گواهی ۱۸۶', final: 'صدور' }), healthCode: data.healthCode, taxCode: data.taxCode, sakhaCode: data.sakhaCode, veteranCode: data.veteranCode, inquiryPurpose: EXTRA_OPTION_LABEL(data.inquiryPurpose, { employment: 'استخدام', license: 'مجوز', loan: 'وام', personal: 'اطلاع شخصی' }), notes: data.notes })
    },
    identity: {
        title: 'احراز هویت و سجام',
        cost: 70000,
        dynamicForm: true,
        fieldConfigs: [
            ...EXTRA_IDENTITY_FIELDS,
            { name: 'serviceType', label: 'نوع خدمت هویتی', type: 'select', required: true, options: EXTRA_SERVICE_OPTIONS.identity },
            { name: 'verificationService', label: 'سامانه احراز هویت', type: 'select', required: false, options: { mygov: 'دولت من', bank: 'بانک', sejam: 'سجام', other: 'سایر' } },
            { name: 'trackingCode', label: 'کد پیگیری سجام/احراز هویت', type: 'text', required: false },
            { name: 'bankName', label: 'نام بانک/کارگزاری', type: 'text', required: false },
            { name: 'iban', label: 'شماره شبا', type: 'text', required: false },
            { name: 'notes', label: 'توضیحات اضافی', type: 'textarea', required: false }
        ],
        transform: data => ({ ...EXTRA_COMMON_IDENTITY_TRANSFORM(data), title: EXTRA_OPTION_LABEL(data.serviceType, EXTRA_SERVICE_OPTIONS.identity), verificationService: EXTRA_OPTION_LABEL(data.verificationService, { mygov: 'دولت من', bank: 'بانک', sejam: 'سجام', other: 'سایر' }), trackingCode: data.trackingCode, bankName: data.bankName, iban: data.iban, notes: data.notes })
    }
,
    addressChange: {
        title: 'تغییر نشانی',
        cost: 50000,
        transform: data => ({ ...data, title: 'تغییر نشانی' })
    },
    idDuplicate: {
        title: 'شناسنامه المثنی',
        cost: 100000,
        transform: data => ({ ...data, title: 'شناسنامه المثنی' })
    },
    infoCorrection: {
        title: 'اصلاح مشخصات',
        cost: 80000,
        transform: data => ({ ...data, title: 'اصلاح مشخصات' })
    },
    passportRegistration: {
        title: 'ثبت نام گذرنامه',
        cost: 150000,
        transform: data => ({ ...data, title: 'ثبت نام گذرنامه' })
    },
    passportRenewal: {
        title: 'تمدید پاسپورت',
        cost: 120000,
        transform: data => ({ ...data, title: 'تمدید پاسپورت' })
    },
    passportDuplicate: {
        title: 'المثنی گذرنامه',
        cost: 120000,
        transform: data => ({ ...data, title: 'المثنی گذرنامه' })
    },
    migrationForm: {
        title: 'فرم مهاجرت',
        cost: 200000,
        transform: data => ({ ...data, title: 'فرم مهاجرت' })
    },
    sanaRegistration: {
        title: 'ثبت نام ثنا',
        cost: 50000,
        transform: data => ({ ...data, title: 'ثبت نام ثنا' })
    },
    electronicNotification: {
        title: 'ابلاغ الکترونیک',
        cost: 30000,
        transform: data => ({ ...data, title: 'ابلاغ الکترونیک' })
    },
    caseTracking: {
        title: 'پیگیری پرونده',
        cost: 30000,
        transform: data => ({ ...data, title: 'پیگیری پرونده' })
    },
    idInquiry: {
        title: 'استعلام کد ملی',
        cost: 20000,
        transform: data => ({ ...data, title: 'استعلام کد ملی' })
    },
    birthCertificateInquiry: {
        title: 'استعلام شناسنامه',
        cost: 20000,
        transform: data => ({ ...data, title: 'استعلام شناسنامه' })
    },
    plateReplacement: {
        title: 'نوبت تعویض پلاک',
        cost: 50000,
        transform: data => ({ ...data, title: 'نوبت تعویض پلاک' })
    },
    violationInquiry: {
        title: 'استعلام خلافی',
        cost: 15000,
        transform: data => ({ ...data, title: 'استعلام خلافی خودرو' })
    },
    electionInfo: {
        title: 'خدمات انتخاباتی',
        cost: 0,
        transform: data => ({ ...data, title: 'خدمات انتخاباتی' })
    }

};

window.EXTRA_SERVICE_CONFIGS = EXTRA_SERVICE_CONFIGS;
