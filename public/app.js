document.addEventListener('DOMContentLoaded', () => {
    const currentUserData = JSON.parse(localStorage.getItem('userData') || 'null');

    // بارگذاری بنر از دیتابیس
    fetch('/api/banner')
        .then(r => r.json())
        .then(banners => {
            if (banners.length > 0 && document.getElementById('bannerImg')) {
                document.getElementById('bannerImg').src = banners[0].src;
            }
        })
        .catch(() => {});

    const SERVICE_CONFIGS = {
        schools: {
            title: 'پیش ثبت نام مدارس',
            cost: '۵۰,۰۰۰ تومان',
            fields: ['parentPhone', 'parentNationalId', 'birthYear', 'birthMonth', 'birthDay',
                     'postalCode', 'studentNationalId', 'additionalNotes'],
            transform: (data) => ({
                parentPhone: data.parentPhone,
                parentNationalId: data.parentNationalId,
                birthYear: data.birthYear,
                birthMonth: data.birthMonth,
                birthDay: data.birthDay,
                postalCode: data.postalCode,
                studentNationalId: data.studentNationalId,
                additionalNotes: data.additionalNotes,
})
        },
        fineInquiry: {
            title: 'استعلام جریمه',
            cost: '۲۵,۰۰۰ تومان',
            fields: ['ownerPhone', 'ownerNationalId', 'plateNumber', 'additionalNotes'],
            transform: (data) => ({
                ownerPhone: data.ownerPhone,
                ownerNationalId: data.ownerNationalId,
                plateNumber: data.plateNumber,
                additionalNotes: data.additionalNotes,
            })
        },
        finePayment: {
            title: 'پرداخت آنلاین جریمه',
            cost: '۳۵,۰۰۰ تومان',
            fields: ['ownerPhone', 'ownerNationalId', 'plateNumber', 'violationNumber', 'paymentMethod', 'additionalNotes'],
            transform: (data) => ({
                ownerPhone: data.ownerPhone,
                ownerNationalId: data.ownerNationalId,
                plateNumber: data.plateNumber,
                violationNumber: data.violationNumber,
                paymentMethod: data.paymentMethod === 'card' ? 'کارت بانکی' : data.paymentMethod === 'online' ? 'درگاه اینترنتی' : 'کیف پول الکترونیک',
                additionalNotes: data.additionalNotes,
            })
        },
        fineAppeal: {
            title: 'اعتراض به جریمه',
            cost: '۴۵,۰۰۰ تومان',
            fields: ['ownerPhone', 'ownerNationalId', 'plateNumber', 'violationNumber', 'appealReason', 'additionalNotes'],
            transform: (data) => ({
                ownerPhone: data.ownerPhone,
                ownerNationalId: data.ownerNationalId,
                plateNumber: data.plateNumber,
                violationNumber: data.violationNumber,
                appealReason: data.appealReason,
                additionalNotes: data.additionalNotes,
            })
        },
        marriage: {
            title: 'وام ازدواج',
            cost: '۲۵۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay',
                     'marriageYear', 'marriageMonth', 'marriageDay', 'idNumber', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                marriageDate: [data.marriageYear, data.marriageMonth, data.marriageDay].filter(Boolean).join('/'),
                idNumber: data.idNumber,
                additionalNotes: data.additionalNotes,
            })
        },
        konkor: {
            title: 'ثبت‌نام کنکور سراسری',
            cost: '۲۰۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay',
                     'regionCode', 'educationLevel', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                regionCode: data.regionCode,
                educationLevel: data.educationLevel,
                additionalNotes: data.additionalNotes,
            })
        },
        subsidy: {
            title: 'ثبت‌نام یارانه معیشتی',
            cost: '۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'postalCode', 'familyCount', 'iban', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                postalCode: data.postalCode,
                familyCount: data.familyCount,
                iban: data.iban,
                additionalNotes: data.additionalNotes,
            })
        },
        rental: {
            title: 'ثبت‌نام ودیعه مسکن اجاره',
            cost: '۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'postalCode', 'contractNumber', 'iban', 'depositAmount', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                postalCode: data.postalCode,
                contractNumber: data.contractNumber,
                iban: data.iban,
                depositAmount: data.depositAmount,
                additionalNotes: data.additionalNotes,
            })
        },
        housing: {
            title: 'ثبت‌نام نهضت ملی مسکن',
            cost: '۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'postalCode', 'familyCount', 'ownershipStatus', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                postalCode: data.postalCode,
                familyCount: data.familyCount,
                ownershipStatus: data.ownershipStatus === 'renter' ? 'مستأجر' : data.ownershipStatus === 'loan' ? 'ساکن منزل وام‌دار' : data.ownershipStatus === 'personal' ? 'ساکن منزل شخصی' : data.ownershipStatus,
                additionalNotes: data.additionalNotes,
            })
        },
        ieltsToefl: {
            title: 'ثبت‌نام تافل و آیلتس',
            cost: '۱۵۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'passportNumber', 'birthYear', 'birthMonth', 'birthDay', 'examType', 'city', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId || undefined,
                passportNumber: data.passportNumber,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                examType: data.examType === 'toefl' ? 'تافل iBT' : data.examType === 'ielts-academic' ? 'آیلتس آکادمیک' : data.examType === 'ielts-general' ? 'آیلتس جنرال' : data.examType,
                city: data.city,
                additionalNotes: data.additionalNotes,
            })
        },
        internet: {
            title: 'ثبت‌نام اینترنت پرسرعت (ADSL/فیبر نوری)',
            cost: '۱۰۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'postalCode', 'address', 'operator', 'internetType', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                postalCode: data.postalCode,
                address: data.address,
                operator: data.operator === 'mci' ? 'همراه اول' : data.operator === 'irancell' ? 'ایرانسل' : data.operator === 'mokhbarat' ? 'مخابرات' : data.operator === 'rightel' ? 'رایتل' : data.operator,
                internetType: data.internetType === 'adsl' ? 'ADSL' : data.internetType === 'vdsl' ? 'VDSL' : data.internetType === 'fiber' ? 'فیبر نوری (FTTH)' : data.internetType,
                additionalNotes: data.additionalNotes,
            })
        },
        criminalRecord: {
            title: 'صدور گواهی عدم سوء پیشینه (اینترنتی)',
            cost: '۱۸۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'idNumber', 'birthplace', 'deliveryMethod', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                idNumber: data.idNumber,
                birthplace: data.birthplace,
                deliveryMethod: data.deliveryMethod === 'postal' ? 'ارسال به آدرس پستی' : data.deliveryMethod === 'inperson' ? 'تحویل حضوری در دفاتر پیشخوان' : data.deliveryMethod,
                additionalNotes: data.additionalNotes,
            })
        },
        smartCard: {
            title: 'ثبت نام کارت ملی هوشمند',
            cost: '۸۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'serialNumber', 'motherName', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                serialNumber: data.serialNumber,
                motherName: data.motherName,
                additionalNotes: data.additionalNotes,
            })
        },
        healthInsurance: {
            title: 'ثبت نام و درخواست اینترنتی بیمه سلامت',
            cost: '۱۲۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'postalCode', 'familyMembers', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                postalCode: data.postalCode,
                familyMembers: data.familyMembers,
                additionalNotes: data.additionalNotes,
            })
        },
        marriageLoanStatus: {
            title: 'استعلام وضعیت وام ازدواج',
            cost: '۳۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'trackingCode', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                trackingCode: data.trackingCode,
                additionalNotes: data.additionalNotes,
            })
        },
        marriageLoanRenew: {
            title: 'تمدید مهلت وام ازدواج',
            cost: '۲۵,۰۰۰ تومان',
            fields: ['applicantPhone', 'trackingCode', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                trackingCode: data.trackingCode,
                additionalNotes: data.additionalNotes,
            })
        },
        urgentLoan: {
            title: 'وام ضروری',
            cost: '۱۰۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'postalCode', 'loanType', 'amount', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                postalCode: data.postalCode,
                loanType: data.loanType === 'retired' ? 'بازنشستگان' : data.loanType === 'employee' ? 'کارمندان' : 'دانشجویی',
                amount: data.amount,
                additionalNotes: data.additionalNotes,
            })
        },
        housingPurchase: {
            title: 'تسهیلات خرید مسکن',
            cost: '۸۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'postalCode', 'propertyAddress', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                postalCode: data.postalCode,
                propertyAddress: data.propertyAddress,
                additionalNotes: data.additionalNotes,
            })
        },
        housingConstruction: {
            title: 'وام ساخت مسکن',
            cost: '۱۰۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'postalCode', 'constructionAddress', 'constructionArea', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                postalCode: data.postalCode,
                constructionAddress: data.constructionAddress,
                constructionArea: data.constructionArea,
                additionalNotes: data.additionalNotes,
            })
        },
        justiceStocks: {
            title: 'سهام عدالت',
            cost: '۵۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'actionType', 'stockCount', 'sellPrice', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                actionType: data.actionType === 'register' ? 'ثبت نام' : data.actionType === 'inquiry' ? 'استعلام' : 'فروش',
                stockCount: data.stockCount,
                sellPrice: data.sellPrice,
                additionalNotes: data.additionalNotes,
            })
        },
        stockRegistration: {
            title: 'افتتاح کد بورسی',
            cost: '۱۰۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'bankName', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                bankName: data.bankName,
                additionalNotes: data.additionalNotes,
            })
        },
        stockTrade: {
            title: 'خرید و فروش سهام',
            cost: '۵۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'tradeType', 'stockSymbol', 'stockCount', 'price', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                tradeType: data.tradeType === 'buy' ? 'خرید' : 'فروش',
                stockSymbol: data.stockSymbol,
                stockCount: data.stockCount,
                price: data.price,
                additionalNotes: data.additionalNotes,
            })
        },
        sjam: {
            title: 'سجام (احراز هویت بورسی)',
            cost: '۷۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'bankName', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                bankName: data.bankName,
                additionalNotes: data.additionalNotes,
            })
        },
        elementaryRegistration: {
            title: 'پیش ثبت نام پایه اول دبستان',
            cost: '۴۵,۰۰۰ تومان',
            fields: ['parentPhone', 'parentNationalId', 'studentNationalId', 'postalCode', 'preferredSchool', 'additionalNotes'],
            transform: (data) => ({
                parentPhone: data.parentPhone,
                parentNationalId: data.parentNationalId,
                studentNationalId: data.studentNationalId,
                postalCode: data.postalCode,
                preferredSchool: data.preferredSchool,
                additionalNotes: data.additionalNotes,
            })
        },
        middleSchoolRegistration: {
            title: 'پیش ثبت نام متوسطه اول',
            cost: '۴۵,۰۰۰ تومان',
            fields: ['parentPhone', 'parentNationalId', 'studentNationalId', 'postalCode', 'preferredSchool', 'additionalNotes'],
            transform: (data) => ({
                parentPhone: data.parentPhone,
                parentNationalId: data.parentNationalId,
                studentNationalId: data.studentNationalId,
                postalCode: data.postalCode,
                preferredSchool: data.preferredSchool,
                additionalNotes: data.additionalNotes,
            })
        },
        highSchoolRegistration: {
            title: 'پیش ثبت نام متوسطه دوم',
            cost: '۴۵,۰۰۰ تومان',
            fields: ['parentPhone', 'parentNationalId', 'studentNationalId', 'postalCode', 'preferredSchool', 'fieldOfStudy', 'additionalNotes'],
            transform: (data) => ({
                parentPhone: data.parentPhone,
                parentNationalId: data.parentNationalId,
                studentNationalId: data.studentNationalId,
                postalCode: data.postalCode,
                preferredSchool: data.preferredSchool,
                fieldOfStudy: data.fieldOfStudy,
                additionalNotes: data.additionalNotes,
            })
        },
        specialSchools: {
            title: 'ثبت نام مدارس خاص',
            cost: '۵۰,۰۰۰ تومان',
            fields: ['parentPhone', 'parentNationalId', 'studentNationalId', 'postalCode', 'schoolType', 'preferredField', 'additionalNotes'],
            transform: (data) => ({
                parentPhone: data.parentPhone,
                parentNationalId: data.parentNationalId,
                studentNationalId: data.studentNationalId,
                postalCode: data.postalCode,
                schoolType: data.schoolType === 'shahed' ? 'شاهد' : data.schoolType === 'nemone-dovvom' ? 'نمونه دولتی' : 'سمپاد',
                preferredField: data.preferredField,
                additionalNotes: data.additionalNotes,
            })
        },
        nonGovSchools: {
            title: 'ثبت نام مدارس غیردولتی',
            cost: '۶۰,۰۰۰ تومان',
            fields: ['parentPhone', 'parentNationalId', 'studentNationalId', 'postalCode', 'schoolType', 'preferredSchool', 'additionalNotes'],
            transform: (data) => ({
                parentPhone: data.parentPhone,
                parentNationalId: data.parentNationalId,
                studentNationalId: data.studentNationalId,
                postalCode: data.postalCode,
                schoolType: data.schoolType === 'international' ? 'بین‌الملل' : 'هیئت امنایی',
                preferredSchool: data.preferredSchool,
                additionalNotes: data.additionalNotes,
            })
        },
        universityRegistration: {
            title: 'ثبت نام دانشگاه‌ها',
            cost: '۱۰۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'universityType', 'preferredField', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                universityType: data.universityType,
                preferredField: data.preferredField,
                additionalNotes: data.additionalNotes,
            })
        },
        employmentExam: {
            title: 'ثبت نام آزمون استخدامی',
            cost: '۸۰,۰۰۰ تومان',
            fields: ['applicantPhone', 'applicantNationalId', 'birthYear', 'birthMonth', 'birthDay', 'examType', 'educationLevel', 'preferredOrganization', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                applicantNationalId: data.applicantNationalId,
                birthDate: [data.birthYear, data.birthMonth, data.birthDay].filter(Boolean).join('/'),
                examType: data.examType,
                educationLevel: data.educationLevel,
                preferredOrganization: data.preferredOrganization,
                additionalNotes: data.additionalNotes,
            })
        },
        technicalInspectionAppointment: {
            title: 'ثبت نام نوبت معاینه فنی',
            cost: '۳۵,۰۰۰ تومان',
            fields: ['ownerPhone', 'ownerNationalId', 'vehicleType', 'plateNumber', 'preferredDate', 'additionalNotes'],
            transform: (data) => ({
                ownerPhone: data.ownerPhone,
                ownerNationalId: data.ownerNationalId,
                vehicleType: data.vehicleType,
                plateNumber: data.plateNumber,
                preferredDate: data.preferredDate,
                additionalNotes: data.additionalNotes,
            })
        },
        technicalInspectionValidity: {
            title: 'استعلام اعتبار معاینه فنی',
            cost: '۲۰,۰۰۰ تومان',
            fields: ['ownerPhone', 'ownerNationalId', 'plateNumber', 'vin', 'additionalNotes'],
            transform: (data) => ({
                ownerPhone: data.ownerPhone,
                ownerNationalId: data.ownerNationalId,
                plateNumber: data.plateNumber,
                vin: data.vin,
                additionalNotes: data.additionalNotes,
            })
        }
    };

    const MEGA_MENU_DATA = {
        banking: [
            {
                title: 'وام ازدواج',
                icon: 'fa-ring',
                link: 'marriage-loan.html',
                subItems: [
                    { title: 'ثبت نام وام ازدواج', link: 'marriage-loan.html' },
                    { title: 'استعلام وضعیت وام', link: 'marriage-loan-status.html' },
                    { title: 'تمدید مهلت وام', link: 'marriage-loan-renew.html' }
                ]
            },
            {
                title: 'وام ودیعه مسکن',
                icon: 'fa-home',
                link: 'rental-deposit.html',
                subItems: [
                    { title: 'ثبت نام وام ودیعه مسکن', link: 'rental-deposit.html' }
                ]
            },
            {
                title: 'وام ضروری',
                icon: 'fa-hand-holding-usd',
                link: 'urgent-loan.html',
                subItems: [
                    { title: 'ثبت نام وام ضروری بازنشستگان', link: 'urgent-loan.html' },
                    { title: 'وام ضروری کارمندان', link: 'urgent-loan.html' },
                    { title: 'وام دانشجویی', link: 'urgent-loan.html' }
                ]
            },
            {
                title: 'تسهیلات مسکن',
                icon: 'fa-city',
                link: 'housing-movement.html',
                subItems: [
                    { title: 'تسهیلات خرید مسکن', link: 'housing-purchase.html' },
                    { title: 'وام ساخت مسکن', link: 'housing-construction.html' }
                ]
            },
            {
                title: 'سهام عدالت',
                icon: 'fa-balance-scale',
                link: 'justice-stocks.html',
                subItems: [
                    { title: 'ثبت نام سهام عدالت', link: 'justice-stocks.html' },
                    { title: 'استعلام سهام', link: 'justice-stocks.html' },
                    { title: 'فروش سهام', link: 'justice-stocks.html' }
                ]
            },
            {
                title: 'یارانه نقدی و معیشتی',
                icon: 'fa-hand-holding-heart',
                link: 'subsidy.html',
                subItems: [
                    { title: 'ثبت نام یارانه معیشتی', link: 'subsidy.html' },
                    { title: 'اعتراض به یارانه', link: 'subsidy.html' },
                    { title: 'به‌روزرسانی اطلاعات', link: 'subsidy.html' },
                    { title: 'استعلام یارانه', link: 'subsidy.html' }
                ]
            },
            {
                title: 'بورس و سرمایه‌گذاری',
                icon: 'fa-chart-line',
                link: '#',
                subItems: [
                    { title: 'افتتاح کد بورسی', link: 'stock-registration.html' },
                    { title: 'خرید و فروش سهام', link: 'stock-trade.html' },
                    { title: 'سجام (احراز هویت بورسی)', link: 'sjam.html' }
                ]
            }
        ],
        education: [
            {
                title: 'پیش ثبت نام مدارس',
                icon: 'fa-school',
                link: 'schools.html',
                subItems: [
                    { title: 'پیش ثبت نام پایه اول دبستان', link: 'elementary-registration.html' },
                    { title: 'پیش ثبت نام متوسطه اول', link: 'middle-school-registration.html' },
                    { title: 'پیش ثبت نام متوسطه دوم', link: 'high-school-registration.html' }
                ]
            },
            {
                title: 'ثبت نام مدارس خاص',
                icon: 'fa-school',
                link: 'special-schools.html',
                subItems: [
                    { title: 'ثبت نام مدارس شاهد', link: 'special-schools.html' },
                    { title: 'ثبت نام مدارس نمونه دولتی', link: 'special-schools.html' },
                    { title: 'ثبت نام مدارس تیزهوشان (سمپاد)', link: 'special-schools.html' }
                ]
            },
            {
                title: 'ثبت نام مدارس غیردولتی',
                icon: 'fa-globe',
                link: 'non-gov-schools.html',
                subItems: [
                    { title: 'ثبت نام مدارس بین‌الملل', link: 'non-gov-schools.html' },
                    { title: 'ثبت نام مدارس هیئت امنایی', link: 'non-gov-schools.html' }
                ]
            },
            {
                title: 'کنکور سراسری',
                icon: 'fa-graduation-cap',
                link: 'konkor.html',
                subItems: [
                    { title: 'ثبت نام کنکور کارشناسی', link: 'konkor.html' },
                    { title: 'ثبت نام کنکور ارشد', link: 'konkor.html' },
                    { title: 'ثبت نام کنکور دکتری', link: 'konkor.html' }
                ]
            },
            {
                title: 'ثبت نام دانشگاه‌ها',
                icon: 'fa-university',
                link: 'university-registration.html',
                subItems: [
                    { title: 'ثبت نام بدون کنکور دانشگاه آزاد', link: 'university-registration.html' },
                    { title: 'ثبت نام پیام نور', link: 'university-registration.html' },
                    { title: 'ثبت نام علمی کاربردی', link: 'university-registration.html' },
                    { title: 'ثبت نام غیرحضوری', link: 'university-registration.html' }
                ]
            },
            {
                title: 'آزمون‌های استخدامی',
                icon: 'fa-file-alt',
                link: 'employment-exam.html',
                subItems: [
                    { title: 'ثبت نام آزمون استخدامی آموزش و پرورش', link: 'employment-exam.html' },
                    { title: 'ثبت نام استخدامی بانک‌ها', link: 'employment-exam.html' },
                    { title: 'ثبت نام استخدامی دستگاه‌های دولتی', link: 'employment-exam.html' }
                ]
            }
        ],
        identity: [
            {
                title: 'کارت ملی هوشمند',
                icon: 'fa-id-card',
                link: 'smart-national-card.html',
                subItems: [
                    { title: 'درخواست کارت ملی هوشمند جدید', link: 'smart-national-card.html' },
                    { title: 'تعویض کارت ملی قدیم', link: 'smart-national-card.html' },
                    { title: 'المثنی کارت ملی', link: 'smart-national-card.html' },
                    { title: 'پیگیری پستی', link: '#' },
                    { title: 'تغییر نشانی', link: '#' }
                ]
            },
            {
                title: 'شناسنامه',
                icon: 'fa-file-alt',
                link: '#',
                subItems: [
                    { title: 'درخواست شناسنامه المثنی', link: '#' },
                    { title: 'اصلاح مشخصات شناسنامه', link: '#' },
                    { title: 'المثنی برگه هویت', link: '#' }
                ]
            },
            {
                title: 'گذرنامه (پاسپورت)',
                icon: 'fa-passport',
                link: '#',
                subItems: [
                    { title: 'ثبت نام اینترنتی گذرنامه', link: '#' },
                    { title: 'تمدید گذرنامه', link: '#' },
                    { title: 'المثنی گذرنامه', link: '#' },
                    { title: 'پیگیری وضعیت', link: '#' }
                ]
            },
            {
                title: 'گواهی عدم سوء پیشینه',
                icon: 'fa-file-alt',
                link: 'criminal-record.html',
                subItems: [
                    { title: 'صدور گواهی اینترنتی', link: 'criminal-record.html' },
                    { title: 'گواهی برای مهاجرت', link: 'criminal-record.html' },
                    { title: 'گواهی برای کار', link: 'criminal-record.html' },
                    { title: 'گواهی برای ازدواج', link: 'criminal-record.html' },
                    { title: 'تمدید گواهی', link: '#' }
                ]
            },
            {
                title: 'پایگاه ثبت احوال',
                icon: 'fa-database',
                link: '#',
                subItems: [
                    { title: 'استعلام کد ملی', link: '#' },
                    { title: 'استعلام وضعیت شناسنامه', link: '#' },
                    { title: 'درخواست کد پستی', link: '#' }
                ]
            },
            {
                title: 'ثبت نام انتخابات',
                icon: 'fa-vote-yea',
                link: '#',
                subItems: [
                    { title: 'ثبت نام رأی اولی‌ها', link: '#' },
                    { title: 'تأیید صلاحیت', link: '#' },
                    { title: 'تعیین شعبه اخذ رأی', link: '#' }
                ]
            },
            {
                title: 'سامانه ثنا (قضایی)',
                icon: 'fa-gavel',
                link: '#',
                subItems: [
                    { title: 'ثبت نام ثنا', link: '#' },
                    { title: 'پیگیری پرونده قضایی', link: '#' },
                    { title: 'دریافت کارت وکالت', link: '#' },
                    { title: 'ابلاغ الکترونیک', link: '#' }
                ]
            }
        ],
        automotive: [
            {
                title: 'کارت سوخت',
                icon: 'fa-gas-pump',
                link: 'fuel-card.html',
                subItems: [
                    { title: 'ثبت نام کارت سوخت جدید', link: 'fuel-card.html' },
                    { title: 'صدور کارت سوخت المثنی', link: 'fuel-card.html' },
                    { title: 'مفقودی کارت سوخت', link: 'fuel-card.html' },
                    { title: 'تعویض کارت سوخت آسیب دیده', link: 'fuel-card.html' },
                    { title: 'پیگیری وضعیت کارت', link: '#' }
                ]
            },

            {
                title: 'تغییر خودرو در کارت سوخت',
                icon: 'fa-car',
                link: '#',
                subItems: [
                    { title: 'انتقال کارت سوخت به خودرو جدید', link: 'fuel-card-transfer.html' },
                    { title: 'حذف خودرو فروخته شده', link: 'fuel-card-remove-vehicle.html' },
                    { title: 'تغییر خودرو در کارت سوخت', link: 'fuel-card-change-vehicle.html' }
                ]
            },
            {
                title: 'سامانه تعویض پلاک',
                icon: 'fa-ticket-alt',
                link: '#',
                subItems: [
                    { title: 'ثبت نام نوبت تعویض پلاک', link: '#' },
                    { title: 'استعلام خلافی خودرو', link: '#' },
                    { title: 'نقل و انتقال خودرو', link: '#' }
                ]
            },
            {
                title: 'جریمه‌های رانندگی',
                icon: 'fa-exclamation-triangle',
                link: '#',
                subItems: [
                    { title: 'استعلام جریمه', link: 'fine-inquiry.html' },
                    { title: 'پرداخت آنلاین جریمه', link: 'fine-payment.html' },
                    { title: 'اعتراض به جریمه', link: 'fine-appeal.html' }
                ]
            },
            {
                title: 'معاینه فنی',
                icon: 'fa-tools',
                link: '#',
                subItems: [
                    { title: 'ثبت نام نوبت معاینه فنی', link: 'technical-inspection-appointment.html' },
                    { title: 'استعلام اعتبار معاینه فنی', link: 'technical-inspection-validity.html' }
                ]
            }
        ],
        administrative: [
            {
                title: 'ثبت شرکت و کسب و کار',
                icon: 'fa-building',
                link: '#',
                subItems: [
                    { title: 'ثبت شرکت آنلاین', link: '#' },
                    { title: 'ثبت برند و علامت تجاری', link: '#' },
                    { title: 'تغییرات شرکت', link: '#' }
                ]
            },
            {
                title: 'دریافت مجوزها',
                icon: 'fa-certificate',
                link: '#',
                subItems: [
                    { title: 'مجوز کسب و کار (جواز کسب)', link: '#' },
                    { title: 'مجوز صنفی', link: '#' },
                    { title: 'مجوز تولیدی', link: '#' }
                ]
            },
            {
                title: 'سامانه ثبت اظهارنامه مالیاتی',
                icon: 'fa-file-invoice',
                link: '#',
                subItems: [
                    { title: 'ثبت اظهارنامه مالیاتی عملکرد', link: '#' },
                    { title: 'ثبت اظهارنامه ارزش افزوده', link: '#' },
                    { title: 'تمدید کارت بازرگانی', link: '#' }
                ]
            },
            {
                title: 'تکمیل فرم‌های اداری',
                icon: 'fa-file-alt',
                link: '#',
                subItems: [
                    { title: 'تکمیل فرم استخدامی', link: '#' },
                    { title: 'تکمیل فرم بانکی', link: '#' },
                    { title: 'تکمیل فرم مهاجرت', link: '#' }
                ]
            }
        ]
    };

    function buildMegaMenu() {
        document.querySelectorAll('.menu-item').forEach(item => {
            const menuKey = item.getAttribute('data-menu');
            const dropdown = item.querySelector('.mega-dropdown');
            if (!dropdown || !menuKey || !MEGA_MENU_DATA[menuKey]) return;

            const items = MEGA_MENU_DATA[menuKey];
            let html = '<div class="mega-menu-columns">';
            items.forEach(section => {
                html += '<div class="mega-column">';
                html += '<h4 class="mega-column-title"><a href="' + section.link + '"><i class="fas ' + section.icon + '"></i> ' + section.title + '</a></h4>';
                if (section.subItems && section.subItems.length) {
                    html += '<ul>';
                    section.subItems.forEach(sub => {
                        html += '<li><a href="' + sub.link + '">' + sub.title + '</a></li>';
                    });
                    html += '</ul>';
                }
                html += '</div>';
            });
            html += '</div>';
            dropdown.innerHTML = html;
        });
    }

    buildMegaMenu();

    function setupServiceForm(formElement, serviceKey) {
        const config = SERVICE_CONFIGS[serviceKey];
        if (!config) return;
        formElement.addEventListener('submit', e => {
            e.preventDefault();
            const raw = Object.fromEntries(new FormData(formElement));
            localStorage.setItem('registrationData', JSON.stringify(raw));
            const body = {
                title: config.title,
                cost: config.cost,
                ...config.transform(raw),
                status: 'pending',
                username: currentUserData ? currentUserData.username : null
            };
            fetch('/api/order', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            })
            .then(r => r.json())
            .then(result => {
                localStorage.setItem('lastTrackingCode', result.trackingCode);
                window.location.href = 'review.html';
            })
            .catch(() => {
                const fallbackCode = 'CFT-' + Date.now().toString().slice(-8);
                const fallbackOrder = { ...body, trackingCode: fallbackCode };
                localStorage.setItem('lastTrackingCode', fallbackCode);
                window.location.href = 'review.html';
            });
        });
    }

    document.querySelectorAll('#registrationForm, #fuelCardForm, #marriageLoanForm, #serviceForm').forEach(form => {
        const key = form.id === 'registrationForm' ? 'schools'
                  : form.id === 'fuelCardForm' ? 'fuel'
                  : form.id === 'marriageLoanForm' ? 'marriage'
                  : form.dataset.service;
        if (key) setupServiceForm(form, key);
    });

    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', e => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            localStorage.setItem('userData', JSON.stringify({ username }));
            fetch('/api/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username, password })
            }).catch(() => {});
            window.location.href = 'index.html';
        });
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', e => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            
            if (username === 'sedeb' && password === 'sedeb75') {
                localStorage.setItem('adminData', JSON.stringify({ username }));
                window.location.href = 'admin.html';
                return;
            }
            
            fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username, password })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem('userData', JSON.stringify({ username }));
                    window.location.href = 'index.html';
                } else {
                    alert('نام کاربری یا رمز عبور اشتباه است!');
                }
            })
            .catch(() => {
                const storedData = localStorage.getItem('userData');
                if (storedData) {
                    const user = JSON.parse(storedData);
                    if (user.username) {
                        localStorage.setItem('userData', JSON.stringify({ username }));
                        window.location.href = 'index.html';
                    }
                } else {
                    alert('نام کاربری یا رمز عبور اشتباه است!');
                }
            });

        });

    }

    // Eye icons
    const eyeToggles = [
        { btn: 'toggleAdminPassword', input: 'adminPassword' },
        { btn: 'togglePassword', input: 'password' },
        { btn: 'toggleConfirmPassword', input: 'confirmPassword' },
        { btn: 'toggleLoginPassword', input: 'loginPassword' }
    ];

    eyeToggles.forEach(({ btn, input }) => {
        const toggleBtn = document.getElementById(btn);
        const pwdInput = document.getElementById(input);
        if (toggleBtn && pwdInput) {
            toggleBtn.addEventListener('click', () => {
                pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
                toggleBtn.innerHTML = pwdInput.type === 'text' ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
            });
        }
    });

    const adminLoggedIn = localStorage.getItem('adminData');
    if (!adminLoggedIn && document.getElementById('adminPanel')) {
        window.location.href = 'login.html';
    }

    const ordersBadge = document.getElementById('ordersBadge');
    const chatBadge = document.getElementById('chatBadge');

    function updateAdminBadges() {
        fetch('/api/orders')
            .then(r => r.json())
            .then(orders => {
                const pendingCount = (orders || []).filter(o => o.status === 'pending').length;
                if (ordersBadge) {
                    ordersBadge.textContent = pendingCount;
                    ordersBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
                }
            })
            .catch(() => {});
        fetch('/api/admin/chat/customers')
            .then(r => r.json())
            .then(function(customers) {
                const newCount = (customers || []).reduce(function(sum, c) { return sum + (c.unread || 0); }, 0);
                if (chatBadge) {
                    chatBadge.textContent = newCount;
                    chatBadge.style.display = newCount > 0 ? 'inline-block' : 'none';
                }
            })
            .catch(() => {});
    }

    if (ordersBadge || chatBadge) {
        updateAdminBadges();
        setInterval(updateAdminBadges, 10000);
    }

    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', e => {
            e.preventDefault();
            localStorage.removeItem('adminData');
            window.location.href = 'login.html';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => {
            e.preventDefault();
            localStorage.removeItem('userData');
            window.location.href = 'index.html';
        });
    }

    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', function() {
            const trackingCode = localStorage.getItem('lastTrackingCode');
            if (!trackingCode) {
                alert('کد سفارش پیدا نشد. لطفاً دوباره ثبت نام کنید.');
                window.location.href = 'index.html';
                return;
            }
            confirmPaymentBtn.disabled = true;
            confirmPaymentBtn.textContent = 'در حال پردازش...';
            fetch('/api/order/confirm', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ trackingCode })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    window.location.href = 'success.html';
                }
            })
            .catch(() => {
                alert('خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.');
                confirmPaymentBtn.disabled = false;
                confirmPaymentBtn.textContent = 'تایید و پرداخت';
            });
        });
    }

    const supportBtn = document.getElementById('supportBtn');
    const supportModal = document.getElementById('supportModal');
    const faqTab = document.getElementById('faqTab');
    const chatTab = document.getElementById('chatTab');
    const faqPanel = document.getElementById('faqPanel');
    const chatPanel = document.getElementById('chatPanel');
    const inlineChatMessages = document.getElementById('inlineChatMessages');
    const inlineMessageInput = document.getElementById('inlineMessageInput');
    const inlineSendBtn = document.getElementById('inlineSendBtn');
    let inlinePolling = null;

    function switchTab(tab) {
        if (tab === 'faq') {
            faqTab.classList.add('active');
            chatTab.classList.remove('active');
            faqPanel.style.display = '';
            chatPanel.style.display = 'none';
        } else {
            chatTab.classList.add('active');
            faqTab.classList.remove('active');
            chatPanel.style.display = '';
            faqPanel.style.display = 'none';
            loadInlineMessages();
        }
    }

    function loadInlineMessages() {
        if (!inlineChatMessages) return;
        const userData = JSON.parse(localStorage.getItem('userData') || 'null');
        const username = userData ? userData.username : 'مهمان';
        fetch('/api/chat?username=' + encodeURIComponent(username))
            .then(function(r) { return r.json(); })
            .then(function(messages) {
                inlineChatMessages.innerHTML = '';
                messages.forEach(function(msg) {
                    var div = document.createElement('div');
                    div.className = 'message ' + (msg.role === 'admin' ? 'support' : 'user');
                    var sender = msg.role === 'admin' ? 'پشتیبانی' : msg.username;
                    div.textContent = sender + ': ' + msg.text;
                    inlineChatMessages.appendChild(div);
                });
                inlineChatMessages.scrollTop = inlineChatMessages.scrollHeight;
            })
            .catch(function() {});
    }

    function sendInlineMessage() {
        if (!inlineMessageInput) return;
        var text = inlineMessageInput.value.trim();
        if (!text) return;
        var userData = JSON.parse(localStorage.getItem('userData') || 'null');
        var username = userData ? userData.username : 'مهمان';
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, text: text })
        }).then(function(r) { return r.json(); })
          .then(function() {
              inlineMessageInput.value = '';
              loadInlineMessages();
          })
          .catch(function() {});
    }

    if (supportBtn && supportModal) {
        supportBtn.addEventListener('click', e => {
            e.preventDefault();
            supportModal.classList.add('active');
            switchTab('faq');
        });

        if (faqTab && chatTab) {
            faqTab.addEventListener('click', function() { switchTab('faq'); });
            chatTab.addEventListener('click', function() { switchTab('chat'); });
        }

        if (inlineSendBtn) {
            inlineSendBtn.addEventListener('click', sendInlineMessage);
        }
        if (inlineMessageInput) {
            inlineMessageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') sendInlineMessage();
            });
        }

        const closeBtn = supportModal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                supportModal.classList.remove('active');
                if (inlinePolling) { clearInterval(inlinePolling); inlinePolling = null; }
            });
        }

        supportModal.addEventListener('click', e => {
            if (e.target === supportModal) {
                supportModal.classList.remove('active');
                if (inlinePolling) { clearInterval(inlinePolling); inlinePolling = null; }
            }
        });

        supportModal.addEventListener('transitionend', function() {
            if (!supportModal.classList.contains('active')) {
                if (inlinePolling) { clearInterval(inlinePolling); inlinePolling = null; }
            } else {
                if (chatPanel && chatPanel.style.display !== 'none' && !inlinePolling) {
                    inlinePolling = setInterval(loadInlineMessages, 3000);
                }
            }
        });

        if (chatPanel && !inlinePolling) {
            chatPanel.addEventListener('transitionend', function() {
                if (chatPanel.style.display !== 'none' && !inlinePolling) {
                    inlinePolling = setInterval(loadInlineMessages, 3000);
                }
            });
        }
    }

    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', e => {
            e.preventDefault();
            const adminDataCheck = localStorage.getItem('adminData');
            const userDataCheck = localStorage.getItem('userData');
            window.location.href = adminDataCheck ? 'admin.html' : (userDataCheck ? 'profile.html' : 'login.html');
        });
    }

    const bannerUpload = document.getElementById('bannerUpload');
    const previewImg = document.getElementById('previewImg');
    const saveBannerBtn = document.getElementById('saveBannerBtn');

    if (bannerUpload && previewImg) {
        bannerUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    previewImg.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (saveBannerBtn && previewImg) {
        saveBannerBtn.addEventListener('click', function() {
            const bannerSrc = previewImg.src;
            fetch('/api/banner', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ src: bannerSrc })
            })
            .then(() => {
                const toast = document.createElement('div');
                toast.className = 'toast';
                toast.textContent = 'بنر با موفقیت ذخیره شد!';
                document.body.appendChild(toast);
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
                window.location.href = 'index.html';
            })
            .catch(() => {
                let banners = JSON.parse(localStorage.getItem('banners') || '[]');
                banners.push({ id: Date.now(), src: bannerSrc, date: new Date().toISOString() });
                localStorage.setItem('banners', JSON.stringify(banners));
                alert('بنر ذخیره شد (در حافظه مرورگر)!');
                window.location.href = 'index.html';
            });
        });
    }
});

