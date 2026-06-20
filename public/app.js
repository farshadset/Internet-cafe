function formatPrice(price) {
    var numStr = (price !== undefined && price !== null && price !== '') ? String(price) : '0';
    numStr = numStr.replace(/[۰-۹]/g, function(d) { return d.charCodeAt(0) - 0x06F0; });
    numStr = numStr.replace(/[,٬٫]/g, '');
    var match = numStr.match(/\d+/);
    if (!match) return numStr;
    var num = parseInt(match[0], 10);
    if (isNaN(num)) return numStr;
    var formatted = num.toLocaleString('fa-IR').replace(/٬/g, ',');
    var result = '\u202A' + numStr.replace(match[0], formatted) + '\u202C';
    return result;
}

function openAttachmentStorage() {
    return new Promise(function(resolve, reject) {
        if (typeof indexedDB === 'undefined') {
            resolve(null);
            return;
        }
        const request = indexedDB.open('caffint_attachments', 1);
        request.onupgradeneeded = function() {
            const db = request.result;
            if (!db.objectStoreNames.contains('attachments')) {
                db.createObjectStore('attachments', { keyPath: 'trackingCode' });
            }
        };
        request.onsuccess = function() {
            resolve(request.result);
        };
        request.onerror = function() {
            reject(request.error);
        };
    });
}

window.saveAttachmentsForTrackingCode = function(trackingCode, attachments) {
    if (!trackingCode || !attachments || attachments.length === 0) return Promise.resolve();
    return openAttachmentStorage().then(function(db) {
        if (!db) return;
        return new Promise(function(resolve, reject) {
            const transaction = db.transaction('attachments', 'readwrite');
            const store = transaction.objectStore('attachments');
            const request = store.put({ trackingCode: trackingCode, attachments: attachments });
            request.onsuccess = function() { db.close(); resolve(); };
            request.onerror = function() { db.close(); reject(request.error); };
        });
    }).catch(function() {});
};

window.getAttachmentsForTrackingCode = function(trackingCode) {
    if (!trackingCode) return Promise.resolve([]);
    return openAttachmentStorage().then(function(db) {
        if (!db) return [];
        return new Promise(function(resolve, reject) {
            const transaction = db.transaction('attachments', 'readonly');
            const store = transaction.objectStore('attachments');
            const request = store.get(trackingCode);
            request.onsuccess = function() {
                db.close();
                resolve(request.result && request.result.attachments ? request.result.attachments : []);
            };
            request.onerror = function() { db.close(); reject(request.error); };
        });
    });
};

function attachmentForApiStorage(attachment) {
    return {
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        dataUrl: '',
        uploadedAt: attachment.uploadedAt
    };
}

function attachmentForUpload(attachment) {
    return {
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        dataUrl: attachment.dataUrl,
        uploadedAt: attachment.uploadedAt
    };
}

window.uploadAttachmentsForTrackingCode = async function(trackingCode, attachments) {
    const uploadList = Array.isArray(attachments) ? attachments.filter(function(attachment) {
        return attachment && attachment.dataUrl;
    }) : [];
    if (!trackingCode || uploadList.length === 0) return [];

    const uploaded = [];
    for (const attachment of uploadList) {
        try {
            const response = await fetch('/api/order-attachment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackingCode: trackingCode, attachment: attachmentForUpload(attachment) })
            });
            const result = await response.json();
            if (result && result.success && result.attachment) uploaded.push(result.attachment);
        } catch (error) {}
    }
    return uploaded;
};

document.addEventListener('DOMContentLoaded', () => {
    const currentUserData = JSON.parse(localStorage.getItem('userData') || 'null');

    function joinDateParts(data, prefix = 'birth') {
        return [data[prefix + 'Year'], data[prefix + 'Month'], data[prefix + 'Day']].filter(Boolean).join('/');
    }

    function optionLabel(value, options) {
        return options[value] || value;
    }

    function commonIdentityTransform(data) {
        return {
            phone: data.phone,
            nationalId: data.nationalId,
            birthDate: joinDateParts(data)
        };
    }

    const YES_NO_OPTIONS = { yes: 'بله', no: 'خیر' };
    const COMMON_IDENTITY_FIELDS = [
        { name: 'phone', label: 'شماره تلفن همراه', type: 'tel', placeholder: '09xx-xxx-xxxx', required: true },
        { name: 'nationalId', label: 'کد ملی', type: 'text', maxLength: 10, required: true },
        { name: 'birthDate', label: 'تاریخ تولد', type: 'dateParts', required: true }
    ];
    const COMMON_TRACKING_FIELDS = [
        { name: 'trackingCode', label: 'کد پیگیری/رهگیری', type: 'text', required: false }
    ];

    // بارگذاری بنر از دیتابیس
    fetch('/api/banner')
        .then(r => r.json())
        .then(banners => {
            if (banners.length > 0 && document.getElementById('bannerImg')) {
                document.getElementById('bannerImg').src = banners[0].src;
            }
        })
        .catch(() => {});

    // بارگذاری قیمت‌ها از دیتابیس
    let adminPricing = {};
    const pricingPromise = fetch('/api/pricing')
        .then(r => r.json())
        .then(pricing => {
            pricing.forEach(p => { adminPricing[p.service] = p.price; });
        })
        .catch(() => {});

    const SERVICE_CONFIGS = {
        schools: {
            title: 'پیش ثبت نام مدارس',
            cost: 50000,
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
            cost: 25000,
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
            cost: 35000,
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
            cost: 45000,
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
            cost: 250000,
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
            cost: 200000,
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
            cost: 0,
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
            cost: 0,
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
            cost: 0,
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
            cost: 150000,
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
            cost: 100000,
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
            cost: 180000,
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
            cost: 80000,
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
            cost: 120000,
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
            cost: 30000,
            fields: ['applicantPhone', 'trackingCode', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                trackingCode: data.trackingCode,
                additionalNotes: data.additionalNotes,
            })
        },
        marriageLoanRenew: {
            title: 'تمدید مهلت وام ازدواج',
            cost: 25000,
            fields: ['applicantPhone', 'trackingCode', 'additionalNotes'],
            transform: (data) => ({
                applicantPhone: data.applicantPhone,
                trackingCode: data.trackingCode,
                additionalNotes: data.additionalNotes,
            })
        },
        urgentLoan: {
            title: 'وام ضروری',
            cost: 100000,
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
            cost: 80000,
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
            cost: 100000,
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
            cost: 50000,
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
            cost: 100000,
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
            cost: 50000,
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
            cost: 70000,
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
            cost: 45000,
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
            cost: 45000,
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
            cost: 45000,
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
            cost: 50000,
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
            cost: 60000,
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
            cost: 100000,
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
            cost: 80000,
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
            cost: '۳۵.۰۰۰ تومان',
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
            cost: 20000,
            fields: ['ownerPhone', 'ownerNationalId', 'plateNumber', 'vin', 'additionalNotes'],
            transform: (data) => ({
                ownerPhone: data.ownerPhone,
                ownerNationalId: data.ownerNationalId,
                plateNumber: data.plateNumber,
                vin: data.vin,
                additionalNotes: data.additionalNotes,
            })
        },
        resumeEmployment: {
            title: 'رزومه و استخدام',
            cost: 'قیمت توسط مدیر تنظیم نشده',
            fields: ['serviceType', 'jobField', 'experienceYears', 'skills', 'targetJob', 'customerName', 'customerPhone', 'additionalNotes'],
            transform: (data) => ({
                serviceType: data.serviceType === 'resume' ? 'نوشتن رزومه' : data.serviceType === 'coverLetter' ? 'نامه توصیه' : data.serviceType === 'linkedin' ? 'بهینه‌سازی لینکدین' : 'مشاوره مصاحبه',
                jobField: data.jobField,
                experienceYears: data.experienceYears,
                skills: data.skills,
                targetJob: data.targetJob,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                additionalNotes: data.additionalNotes,
            })
        },
        customServices: {
            title: 'خدمات سفارشی',
            cost: 'قیمت توسط مدیر تنظیم نشده',
            fields: ['serviceType', 'customerName', 'customerPhone', 'additionalNotes'],
            transform: (data) => ({
                serviceType: data.serviceType === 'document' ? 'تدنین سند' : data.serviceType === 'translation' ? 'ترجمه مدارک' : data.serviceType === 'consultation' ? 'مشاوره' : 'سایر خدمات',
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                additionalNotes: data.additionalNotes,
            })
        },
        articlesResearch: {
            title: 'مقاله و تحقیق',
            cost: 'قیمت توسط مدیر تنظیم نشده',
            fields: ['researchType', 'subject', 'academicLevel', 'pagesCount', 'deadline', 'customerName', 'customerPhone', 'additionalNotes'],
            transform: (data) => ({
                researchType: data.researchType === 'article' ? 'نوشتن مقاله' : data.researchType === 'research' ? 'تحقیق علمی' : data.researchType === 'translation' ? 'ترجمه مقالات' : 'ویرایش مقالات',
                subject: data.subject,
                academicLevel: data.academicLevel === 'bachelor' ? 'کارشناسی' : data.academicLevel === 'master' ? 'کارشناسی ارشد' : 'دکتری',
                pagesCount: data.pagesCount,
                deadline: data.deadline,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                additionalNotes: data.additionalNotes,
            })
        }
    };

    Object.assign(SERVICE_CONFIGS, window.EXTRA_SERVICE_CONFIGS || {});

    const MEGA_MENU_DATA = {
        'identity-judicial': [
            {
                title: 'کارت ملی و شناسنامه',
                icon: 'fa-id-card',
                link: 'smart-national-card.html',
                subItems: [
                    { title: 'کارت ملی هوشمند', link: 'smart-national-card.html' },
                    { title: 'المثنی کارت ملی', link: 'smart-national-card.html' },
                    { title: 'تغییر نشانی', link: '#' },
                    { title: 'شناسنامه المثنی', link: '#' },
                    { title: 'اصلاح مشخصات', link: '#' }
                ]
            },
            {
                title: 'گذرنامه و مهاجرت',
                icon: 'fa-passport',
                link: '#',
                subItems: [
                    { title: 'ثبت نام گذرنامه', link: '#' },
                    { title: 'تمدید پاسپورت', link: '#' },
                    { title: 'المثنی گذرنامه', link: '#' },
                    { title: 'فرم مهاجرت', link: '#' }
                ]
            },
            {
                title: 'سامانه ثنا و قضایی',
                icon: 'fa-gavel',
                link: 'service.html?service=judicial',
                subItems: [
                    { title: 'ثبت نام ثنا', link: '#' },
                    { title: 'بازیابی رمز ثنا', link: 'service.html?service=judicial' },
                    { title: 'ابلاغ الکترونیک', link: '#' },
                    { title: 'پیگیری پرونده', link: '#' },
                    { title: 'نوبت‌دهی قضایی', link: 'service.html?service=judicial' }
                ]
            },
            {
                title: 'سوء پیشینه و استعلام‌ها',
                icon: 'fa-search',
                link: 'criminal-record.html',
                subItems: [
                    { title: 'گواهی عدم سوء پیشینه', link: 'criminal-record.html' },
                    { title: 'استعلام کد ملی', link: '#' },
                    { title: 'استعلام شناسنامه', link: '#' },
                    { title: 'استعلام محکومیت', link: 'service.html?service=licenses' }
                ]
            }
        ],
        finance: [
            {
                title: 'وام و تسهیلات',
                icon: 'fa-hand-holding-usd',
                link: 'marriage-loan.html',
                subItems: [
                    { title: 'وام ازدواج', link: 'marriage-loan.html' },
                    { title: 'وام ودیعه مسکن', link: 'rental-deposit.html' },
                    { title: 'وام ضروری', link: 'urgent-loan.html' },
                    { title: 'تسهیلات خرید مسکن', link: 'housing-purchase.html' }
                ]
            },
            {
                title: 'یارانه و سهام عدالت',
                icon: 'fa-hand-holding-heart',
                link: 'subsidy.html',
                subItems: [
                    { title: 'یارانه معیشتی', link: 'subsidy.html' },
                    { title: 'اعتراض یارانه', link: 'subsidy.html' },
                    { title: 'سهام عدالت', link: 'justice-stocks.html' },
                    { title: 'فروش سهام', link: 'justice-stocks.html' }
                ]
            },
            {
                title: 'بورس و سجام',
                icon: 'fa-chart-line',
                link: 'sjam.html',
                subItems: [
                    { title: 'ثبت سجام', link: 'sjam.html' },
                    { title: 'احراز هویت بورسی', link: 'sjam.html' },
                    { title: 'افتتاح کد بورسی', link: 'stock-registration.html' }
                ]
            },
            {
                title: 'خدمات بانکی',
                icon: 'fa-wallet',
                link: 'service.html?service=finance',
                subItems: [
                    { title: 'افتتاح حساب', link: 'service.html?service=finance' },
                    { title: 'احراز هویت بانک', link: 'service.html?service=finance' },
                    { title: 'اعتبارسنجی مرآت', link: 'service.html?service=finance' },
                    { title: 'پرداخت آنلاین', link: 'service.html?service=finance' }
                ]
            }
        ],
        automotive: [
            {
                title: 'کارت سوخت',
                icon: 'fa-gas-pump',
                link: 'fuel-card.html',
                subItems: [
                    { title: 'صدور کارت سوخت', link: 'fuel-card.html' },
                    { title: 'المثنی کارت سوخت', link: 'fuel-card.html' },
                    { title: 'انتقال کارت سوخت', link: 'fuel-card-transfer.html' }
                ]
            },
            {
                title: 'تعویض پلاک و خودرو',
                icon: 'fa-ticket-alt',
                link: '#',
                subItems: [
                    { title: 'نوبت تعویض پلاک', link: '#' },
                    { title: 'نقل و انتقال خودرو', link: '#' },
                    { title: 'مالیات نقل و انتقال', link: 'service.html?service=finance' }
                ]
            },
            {
                title: 'جریمه و معاینه فنی',
                icon: 'fa-exclamation-triangle',
                link: 'fine-payment.html',
                subItems: [
                    { title: 'استعلام خلافی', link: '#' },
                    { title: 'پرداخت جریمه', link: 'fine-payment.html' },
                    { title: 'اعتراض جریمه', link: 'fine-appeal.html' },
                    { title: 'نوبت معاینه فنی', link: 'technical-inspection-appointment.html' }
                ]
            },
            {
                title: 'ثبت نام خودرو',
                icon: 'fa-car',
                link: 'service.html?service=vehicles',
                subItems: [
                    { title: 'ایران خودرو', link: 'service.html?service=vehicles' },
                    { title: 'سایپا', link: 'service.html?service=vehicles' },
                    { title: 'سامانه یکپارچه', link: 'service.html?service=vehicles' },
                    { title: 'انتخاب خودرو', link: 'service.html?service=vehicles' }
                ]
            },
            {
                title: 'خدمات شهری',
                icon: 'fa-city',
                link: 'service.html?service=vehicles',
                subItems: [
                    { title: 'تهران من', link: 'service.html?service=vehicles' },
                    { title: 'یارانه سوخت وانت', link: 'service.html?service=vehicles' }
                ]
            }
        ],
        education: [
            {
                title: 'مدارس',
                icon: 'fa-school',
                link: 'schools.html',
                subItems: [
                    { title: 'پیش ثبت نام مدارس', link: 'schools.html' },
                    { title: 'مدارس شاهد', link: 'special-schools.html' },
                    { title: 'مدارس تیزهوشان', link: 'special-schools.html' },
                    { title: 'مدارس غیردولتی', link: 'non-gov-schools.html' }
                ]
            },
            {
                title: 'دانشگاه‌ها',
                icon: 'fa-university',
                link: 'university-registration.html',
                subItems: [
                    { title: 'دانشگاه آزاد', link: 'university-registration.html' },
                    { title: 'پیام نور', link: 'university-registration.html' },
                    { title: 'علمی کاربردی', link: 'university-registration.html' },
                    { title: 'ثبت نام غیرحضوری', link: 'university-registration.html' }
                ]
            },
            {
                title: 'کنکور و آزمون‌ها',
                icon: 'fa-graduation-cap',
                link: 'konkor.html',
                subItems: [
                    { title: 'کنکور سراسری', link: 'konkor.html' },
                    { title: 'ارشد', link: 'konkor.html' },
                    { title: 'دکتری', link: 'konkor.html' }
                ]
            },
            {
                title: 'آزمون‌های استخدامی',
                icon: 'fa-file-alt',
                link: 'employment-exam.html',
                subItems: [
                    { title: 'آموزش و پرورش', link: 'employment-exam.html' },
                    { title: 'بانک‌ها', link: 'employment-exam.html' },
                    { title: 'دستگاه‌های دولتی', link: 'employment-exam.html' }
                ]
            },
            {
                title: 'خدمات دانشجویی',
                icon: 'fa-user-graduate',
                link: 'service.html?service=student',
                subItems: [
                    { title: 'سامانه‌های آموزشی', link: 'service.html?service=student' },
                    { title: 'وام دانشجویی', link: 'urgent-loan.html' }
                ]
            }
        ],
        'business-tax': [
            {
                title: 'مالیات',
                icon: 'fa-file-invoice-dollar',
                link: 'service.html?service=tax',
                subItems: [
                    { title: 'اظهارنامه مالیاتی', link: 'service.html?service=business-tax' },
                    { title: 'تبصره ۱۰۰', link: 'service.html?service=tax' },
                    { title: 'ارزش افزوده', link: 'service.html?service=business-tax' },
                    { title: 'اعتراض مالیاتی', link: 'service.html?service=tax' },
                    { title: 'کد اقتصادی', link: 'service.html?service=tax' }
                ]
            },
            {
                title: 'ثبت و تغییرات شرکت',
                icon: 'fa-building',
                link: '#',
                subItems: [
                    { title: 'ثبت شرکت', link: 'service.html?service=business-tax' },
                    { title: 'ثبت برند', link: 'service.html?service=business-tax' },
                    { title: 'تغییرات شرکت', link: 'service.html?service=business-tax' }
                ]
            },
            {
                title: 'مجوزها',
                icon: 'fa-certificate',
                link: 'service.html?service=licenses',
                subItems: [
                    { title: 'سامانه ملی مجوزها', link: 'service.html?service=licenses' },
                    { title: 'جواز کسب', link: 'service.html?service=licenses' },
                    { title: 'مجوز صنفی', link: 'service.html?service=licenses' },
                    { title: 'مجوز تولیدی', link: 'service.html?service=licenses' }
                ]
            },
            {
                title: 'اصناف و اماکن',
                icon: 'fa-store',
                link: 'service.html?service=licenses',
                subItems: [
                    { title: 'نوین اصناف', link: 'service.html?service=licenses' },
                    { title: 'بازدید اماکن', link: 'service.html?service=licenses' },
                    { title: 'صلاحیت بهداشتی', link: 'service.html?service=licenses' },
                    { title: 'گواهی مالیاتی ۱۸۶', link: 'service.html?service=licenses' }
                ]
            }
        ],
        'government-services': [
            {
                title: 'سامانه‌های عمومی',
                icon: 'fa-landmark',
                link: 'service.html?service=government',
                subItems: [
                    { title: 'میخک', link: 'service.html?service=government' },
                    { title: 'سخا', link: 'service.html?service=government' },
                    { title: 'شمس', link: 'service.html?service=government' },
                    { title: 'ستاد ایران', link: 'service.html?service=government' }
                ]
            },
            {
                title: 'املاک و اسکان',
                icon: 'fa-home',
                link: 'service.html?service=housing',
                subItems: [
                    { title: 'ثبت‌نام املاک و اسکان', link: 'service.html?service=housing' },
                    { title: 'خودنویس', link: 'service.html?service=government' },
                    { title: 'ثبت سند ملکی', link: 'service.html?service=government' }
                ]
            },
            {
                title: 'تأمین اجتماعی و بیمه',
                icon: 'fa-shield-alt',
                link: 'service.html?service=insurance',
                subItems: [
                    { title: 'نام نویسی کارفرما', link: 'service.html?service=insurance' },
                    { title: 'ثبت نیروی کار', link: 'service.html?service=insurance' },
                    { title: 'ارسال لیست بیمه', link: 'service.html?service=insurance' },
                    { title: 'بیمه با سابقه', link: 'service.html?service=insurance' },
                    { title: 'کمیسیون پزشکی', link: 'service.html?service=insurance' },
                    { title: 'کمک هزینه عینک', link: 'service.html?service=insurance' },
                    { title: 'کمک هزینه سمعک', link: 'service.html?service=insurance' }
                ]
            },
            {
                title: 'خدمات توکن',
                icon: 'fa-key',
                link: 'service.html?service=token',
                subItems: [
                    { title: 'راه‌اندازی توکن', link: 'service.html?service=token' },
                    { title: 'امضا در ثبت من', link: 'service.html?service=token' },
                    { title: 'امضای نرم‌افزاری', link: 'service.html?service=token' }
                ]
            },
            {
                title: 'خدمات انتخاباتی',
                icon: 'fa-vote-yea',
                link: '#',
                subItems: [
                    { title: 'رأی اولی‌ها', link: '#' },
                    { title: 'تعیین شعبه', link: '#' },
                    { title: 'تأیید صلاحیت', link: '#' }
                ]
            }
        ]
    };

    function buildServiceLink(link, title) {
        if (!link.includes('service.html?service=') || link.includes('label=')) return link;
        const separator = link.includes('?') ? '&' : '?';
        return link + separator + 'label=' + encodeURIComponent(title);
    }

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
                        html += '<li><a href="' + buildServiceLink(sub.link, sub.title) + '">' + sub.title + '</a></li>';
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

    function renderServiceForm(formElement, serviceKey) {
        const config = SERVICE_CONFIGS[serviceKey];
        if (!config || !config.dynamicForm) return;

        const titleElement = document.getElementById('serviceTitle');
        const label = new URLSearchParams(window.location.search).get('label');
        if (titleElement) titleElement.textContent = label || config.title;

        formElement.innerHTML = '';
        formElement.dataset.service = serviceKey;

        (config.fieldConfigs || []).forEach(field => {
            formElement.appendChild(createFormElement(field));
        });

        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.className = 'btn-next';
        submitButton.textContent = 'ثبت درخواست';
        formElement.appendChild(submitButton);
    }

    function createFormElement(field) {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';

        const label = document.createElement('label');
        label.setAttribute('for', field.name);
        label.textContent = field.label;
        wrapper.appendChild(label);

        let input;
        if (field.type === 'select') {
            input = document.createElement('select');
            input.id = field.name;
            input.name = field.name;
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'انتخاب کنید';
            input.appendChild(emptyOption);
            Object.keys(field.options || {}).forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = field.options[value];
                input.appendChild(option);
            });
        } else if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.id = field.name;
            input.name = field.name;
            input.rows = field.rows || 3;
        } else if (field.type === 'dateParts') {
            const dateWrapper = document.createElement('div');
            dateWrapper.className = 'date-fields';
            const prefix = field.prefix || 'birth';
            ['Year', 'Month', 'Day'].forEach((suffix, index) => {
                const part = document.createElement('input');
                part.type = 'number';
                part.id = prefix + suffix;
                part.name = prefix + suffix;
                part.placeholder = suffix === 'Year' ? 'سال' : suffix === 'Month' ? 'ماه' : 'روز';
                part.min = suffix === 'Year' ? '1300' : suffix === 'Month' ? '1' : '1';
                part.max = suffix === 'Year' ? '1500' : suffix === 'Month' ? '12' : '31';
                dateWrapper.appendChild(part);
            });
            input = dateWrapper;
        } else {
            input = document.createElement('input');
            input.type = field.type || 'text';
            input.id = field.name;
            input.name = field.name;
        }

        if (field.placeholder && input.tagName !== 'DIV') input.placeholder = field.placeholder;
        if (field.maxLength && input.tagName !== 'DIV') input.maxLength = field.maxLength;
        if (field.required) {
            if (input.tagName === 'DIV') {
                Array.from(input.querySelectorAll('input')).forEach(part => part.required = true);
            } else {
                input.required = true;
            }
        }

        wrapper.appendChild(input);

        if (field.hint) {
            const small = document.createElement('small');
            small.textContent = field.hint;
            wrapper.appendChild(small);
        }

        return wrapper;
    }

    function setupServiceForm(formElement, serviceKey) {
        const config = SERVICE_CONFIGS[serviceKey];
        if (!config) return;
        if (['resumeEmploymentForm', 'customServicesForm', 'articlesResearchForm'].includes(formElement.id)) return;
        const effectiveCost = adminPricing[serviceKey] || config.cost;
        formElement.addEventListener('submit', e => {
            e.preventDefault();
            if (isReadingAttachment) {
                showAttachmentLimitToast('لطفا صبر کنید فایل در حال بارگذاری است.');
                return;
            }

            const raw = Object.fromEntries(new FormData(formElement));
            const transformed = config.transform(raw);
            const body = {
                ...transformed,
                attachments: currentAttachments.map(attachmentForApiStorage),
                title: transformed.title || config.title,
                cost: effectiveCost,
                status: 'pending',
                serviceKey: key,
                priceStatus: 'pending',
                username: currentUserData ? currentUserData.username : null
            };
            saveRegistrationData(raw, {
                serviceKey,
                serviceTitle: config.title,
                cost: effectiveCost
            });
            fetch('/api/order', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            })
            .then(r => r.json())
            .then(async result => {
                localStorage.setItem('lastTrackingCode', result.trackingCode);
                await window.uploadAttachmentsForTrackingCode(result.trackingCode, currentAttachments);
                await saveAttachmentsAfterSubmit(result.trackingCode);
                window.location.href = 'review.html';
            })
            .catch(async () => {
                const fallbackCode = 'CFT-' + Date.now().toString().slice(-8);
                const fallbackOrder = { ...body, trackingCode: fallbackCode };
                localStorage.setItem('lastTrackingCode', fallbackCode);
                await window.uploadAttachmentsForTrackingCode(fallbackCode, currentAttachments);
                await saveAttachmentsAfterSubmit(fallbackCode);
                window.location.href = 'review.html';
            });
        });
    }

    function normalizeServiceKey(key) {
        return key ? key.replace(/-([a-z])/g, function(match, letter) {
            return letter.toUpperCase();
        }) : key;
    }

    document.querySelectorAll('#registrationForm, #fuelCardForm, #marriageLoanForm, #serviceForm, #resumeEmploymentForm, #customServicesForm, #articlesResearchForm').forEach(form => {
        const key = form.id === 'registrationForm' ? 'schools'
              : form.id === 'fuelCardForm' ? 'fuel'
              : form.id === 'marriageLoanForm' ? 'marriage'
              : form.id === 'resumeEmploymentForm' ? 'resumeEmployment'
              : form.id === 'customServicesForm' ? 'customServices'
              : form.id === 'articlesResearchForm' ? 'articlesResearch'
              : normalizeServiceKey(form.dataset.service || new URLSearchParams(window.location.search).get('service'));
        if (key) {
            renderServiceForm(form, key);
            setupServiceForm(form, key);
        }
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

     const pinAttachment = document.getElementById('pinAttachment');
     const attachmentFile = document.getElementById('attachmentFile');
     const attachmentPreview = document.getElementById('attachmentPreview');
     const textareaPlaceholder = document.getElementById('textareaPlaceholder');
     const additionalNotes = document.getElementById('additionalNotes');
let currentAttachments = [];
      let isReadingAttachment = false;
      window.currentAttachments = currentAttachments;

if (pinAttachment && attachmentFile) {
        function escapeAttachmentHtml(value) {
              return String(value || '').replace(/[&<>"']/g, function(char) {
                  return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
              });
          }

          function countCurrentAttachments(type) {
              return currentAttachments.filter(function(attachment) {
                  if (type === 'image') return attachment.type && attachment.type.startsWith('image/');
                  return attachment.type === type;
              }).length;
          }

          function createAttachment(file, dataUrl) {
              return {
                  id: 'att_' + Date.now() + '_' + Math.random().toString(16).slice(2),
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  dataUrl: dataUrl,
                  uploadedAt: new Date().toISOString()
              };
          }

          function attachmentForStorage(attachment) {
              return {
                  id: attachment.id,
                  name: attachment.name,
                  type: attachment.type,
                  size: attachment.size,
                  dataUrl: '',
                  uploadedAt: attachment.uploadedAt
              };
          }

          function saveRegistrationData(raw, metadata = {}) {
              const storageData = {
                  ...raw,
                  ...metadata,
                  attachments: currentAttachments.map(attachmentForStorage)
              };

              try {
                  localStorage.setItem('registrationData', JSON.stringify(storageData));
              } catch (error) {
                  localStorage.setItem('registrationData', JSON.stringify({
                      ...raw,
                      ...metadata,
                      attachments: []
                  }));
              }
          }


          function saveAttachmentsAfterSubmit(trackingCode) {
              return window.saveAttachmentsForTrackingCode(trackingCode, currentAttachments);
          }

          function renderAttachmentPreview(attachment, dataUrl) {
              if (!attachmentPreview) return;

              if (attachment.type.startsWith('image/')) {
                  attachmentPreview.insertAdjacentHTML('beforeend', '<div class="attachment-thumbnail" data-attachment-id="' + escapeAttachmentHtml(attachment.id) + '"><img src="' + dataUrl + '" alt="' + escapeAttachmentHtml(attachment.name) + '"><button type="button" class="remove-attachment" onclick="removeAttachment(this)"><i class="fas fa-times"></i></button></div>');
              } else {
                  attachmentPreview.insertAdjacentHTML('beforeend', '<div class="attachment-thumbnail" data-attachment-id="' + escapeAttachmentHtml(attachment.id) + '"><div class="pdf-icon">PDF</div><button type="button" class="remove-attachment" onclick="removeAttachment(this)"><i class="fas fa-times"></i></button></div>');
              }

              attachmentPreview.classList.remove('hidden');
          }

          function addAttachmentFromFile(file) {
              if (!file || !attachmentPreview || isReadingAttachment) return;

              if (file.type.startsWith('image/') && countCurrentAttachments('image') >= 4) {
                  showAttachmentLimitToast('فقط می توان چهار فایل آپلود کرد');
                  attachmentFile.value = '';
                  return;
              }

              if (file.type === 'application/pdf' && countCurrentAttachments('application/pdf') >= 4) {
                  showAttachmentLimitToast('فقط می توان چهار فایل آپلود کرد');
                  attachmentFile.value = '';
                  return;
              }

if (file.type.startsWith('image/')) {
                   const reader = new FileReader();
                   isReadingAttachment = true;
                   reader.onload = function(event) {
                       const attachment = createAttachment(file, event.target.result);
                       currentAttachments.push(attachment);
                       window.currentAttachments = [...currentAttachments];
                       renderAttachmentPreview(attachment, event.target.result);
                       isReadingAttachment = false;
                   };
                   reader.onerror = function() {
                       isReadingAttachment = false;
                   };
                   reader.readAsDataURL(file);
               } else if (file.type === 'application/pdf') {
                   const reader = new FileReader();
                   isReadingAttachment = true;
                   reader.onload = function(event) {
                       const attachment = createAttachment(file, event.target.result);
                       currentAttachments.push(attachment);
                       window.currentAttachments = [...currentAttachments];
                       renderAttachmentPreview(attachment, event.target.result);
                      isReadingAttachment = false;
                  };
                  reader.onerror = function() {
                      isReadingAttachment = false;
                  };
                  reader.readAsDataURL(file);
              } else {
                  const textarea = document.getElementById('additionalNotes');
                  if (textarea) {
                      const currentText = textarea.value;
                      textarea.value = currentText + (currentText ? '\n' : '') + 'فایل پیوست: ' + file.name;
                  }
              }

              attachmentFile.value = '';
          }

          pinAttachment.addEventListener('click', function() {
              attachmentFile.click();
          });

          attachmentFile.addEventListener('change', function(e) {
              const file = e.target.files[0];
              addAttachmentFromFile(file);
          });

window.removeAttachment = function(button) {
                const thumbnail = button.closest('.attachment-thumbnail');
                if (thumbnail) {
                    const attachmentId = thumbnail.getAttribute('data-attachment-id');
                    currentAttachments = currentAttachments.filter(function(attachment) {
                        return attachment.id !== attachmentId;
                    });
                    window.currentAttachments = currentAttachments;
                    thumbnail.remove();
                }

                if (attachmentPreview && attachmentPreview.querySelectorAll('.attachment-thumbnail').length === 0) {
                    attachmentPreview.classList.add('hidden');
                }
            };

     }

     window.openAttachmentPopup = async function(attachments, options) {
          function escapeAttachmentHtml(value) {
              return String(value || '').replace(/[&<>"']/g, function(char) {
                  return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
              });
          }

          const attachmentList = Array.isArray(attachments) ? attachments : [];
          const isAdminMode = !!(options && options.adminMode);
          const code = options && options.code;
           let visibleAttachments = attachmentList.filter(function(attachment) {
               return attachment && (attachment.dataUrl || attachment.url);
           });

           if (visibleAttachments.length === 0 && code && window.getAttachmentsForTrackingCode) {
               const storedAttachments = await window.getAttachmentsForTrackingCode(code);
               visibleAttachments = storedAttachments.filter(function(attachment) {
                   return attachment && (attachment.dataUrl || attachment.url);
               });
           }

          if (visibleAttachments.length === 0) {
              showAttachmentLimitToast('فایلی برای نمایش وجود ندارد.');
              return;
          }

          let popup = document.getElementById('attachmentPopup');
          if (!popup) {
              document.body.insertAdjacentHTML('beforeend', '<div class="popup-overlay" id="attachmentPopup"><div class="popup-content attachment-popup-content"><button type="button" class="popup-close-btn" id="closeAttachmentPopup" title="بستن"><i class="fas fa-times"></i></button><h3>پیش‌نمایش فایل‌های پیوست</h3><div id="attachmentPopupGrid" class="attachment-popup-grid"></div></div></div>');
              popup = document.getElementById('attachmentPopup');

              document.getElementById('closeAttachmentPopup').addEventListener('click', function() {
                  popup.classList.remove('active');
              });

popup.addEventListener('click', function(e) {
                   if (e.target === popup) popup.classList.remove('active');
               });
           }

const grid = document.getElementById('attachmentPopupGrid');
            grid.innerHTML = visibleAttachments.map(function(attachment) {
                const isImage = attachment.type && attachment.type.startsWith('image/');
                const safeName = escapeAttachmentHtml(attachment.name || 'فایل پیوست');
                const safeUrl = escapeAttachmentHtml(attachment.url || attachment.dataUrl);
                const preview = isImage
                    ? '<div class="popup-image-wrapper"><img src="' + safeUrl + '" alt="' + safeName + '"><button type="button" class="popup-download-icon" onclick="downloadPopupImage(\'' + safeUrl + '\', \'' + safeName + '\')"><i class="fas fa-download"></i></button></div>'
                    : '<div class="popup-media-wrapper"><div class="popup-pdf-icon">PDF</div><button type="button" class="popup-download-icon" onclick="downloadPopupImage(\'' + safeUrl + '\', \'' + safeName + '\')"><i class="fas fa-download"></i></button></div>';

                return '<div class="attachment-popup-item">' +
                    '<div class="attachment-popup-media">' + preview + '</div>' +
                    '<div class="attachment-popup-name">' + safeName + '</div>' +
                    '</div>';
            }).join('');

           popup.classList.add('active');
       };

       window.downloadPopupImage = function(dataUrl, filename) {
           const a = document.createElement('a');
           a.href = dataUrl;
           a.download = filename;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
       };

       document.addEventListener('click', function(event) {
          const button = event.target.closest('.detail-attachment-button, .admin-attachment-view-btn, .user-attachment-view-btn');
          if (!button) return;

          const code = button.getAttribute('data-code');
          if (!code) return;

          fetch('/api/order/' + encodeURIComponent(code))
              .then(function(response) { return response.json(); })
              .then(function(order) {
                  window.openAttachmentPopup(order && order.attachments ? order.attachments : [], {
                      adminMode: button.classList.contains('admin-attachment-view-btn'),
                      code: code
                  });
              })
              .catch(function() {});
     });

      if (additionalNotes && textareaPlaceholder) {
          const placeholderTexts = [
              'توضیحات خود را اینجا بنویسید ...',
              'میتوانید چهار تصویر آپلود کنید...',
              'میتوانید چهار pdf آپلود کنید...'
          ];
          const placeholderTextElement = textareaPlaceholder.querySelector('span:first-child');
          const placeholderCursor = textareaPlaceholder.querySelector('.cursor');
          let placeholderIndex = 0;
          let placeholderCharIndex = 0;
          let placeholderTimeout = null;

          function clearPlaceholderAnimation() {
              if (placeholderTimeout) {
                  clearTimeout(placeholderTimeout);
                  placeholderTimeout = null;
              }
          }

          function updatePlaceholder() {
              const shouldShowPlaceholder = additionalNotes.value.length === 0 && document.activeElement !== additionalNotes;
              textareaPlaceholder.style.display = shouldShowPlaceholder ? 'flex' : 'none';

              if (shouldShowPlaceholder) {
                  startPlaceholderAnimation();
              } else {
                  clearPlaceholderAnimation();
              }
          }

          function startPlaceholderAnimation() {
              clearPlaceholderAnimation();

              if (!placeholderTextElement || !placeholderCursor) {
                  return;
              }

              const text = placeholderTexts[placeholderIndex] || '';
              placeholderCharIndex = 0;
              placeholderTextElement.textContent = '';

              function typeText() {
                  if (additionalNotes.value.length > 0 || document.activeElement === additionalNotes) {
                      return;
                  }

                  placeholderTextElement.textContent = text.slice(0, placeholderCharIndex);
                  placeholderCharIndex++;

                  if (placeholderCharIndex <= text.length) {
                      placeholderTimeout = setTimeout(typeText, Math.max(30, 700 / Math.max(text.length, 1)));
                  } else {
                      placeholderTimeout = setTimeout(deleteText, 1500);
                  }
              }

              function deleteText() {
                  if (additionalNotes.value.length > 0 || document.activeElement === additionalNotes) {
                      return;
                  }

                  placeholderCharIndex--;
                  placeholderTextElement.textContent = text.slice(0, placeholderCharIndex);

                  if (placeholderCharIndex > 0) {
                      placeholderTimeout = setTimeout(deleteText, Math.max(20, 400 / Math.max(text.length, 1)));
                  } else {
                      placeholderIndex = (placeholderIndex + 1) % placeholderTexts.length;
                      startPlaceholderAnimation();
                  }
              }

              typeText();
          }

          function autoResizeAdditionalNotes() {
              additionalNotes.style.height = 'auto';
              additionalNotes.style.height = Math.max(additionalNotes.scrollHeight, 150) + 'px';
          }

          additionalNotes.addEventListener('input', function() {
              autoResizeAdditionalNotes();
              updatePlaceholder();
          });
          additionalNotes.addEventListener('focus', function() {
              autoResizeAdditionalNotes();
              updatePlaceholder();
          });
          additionalNotes.addEventListener('blur', function() {
              autoResizeAdditionalNotes();
              updatePlaceholder();
          });

autoResizeAdditionalNotes();
           updatePlaceholder();
       }

    const schoolTypeSelect = document.getElementById('schoolType');
    const displayCost = document.getElementById('displayCost');

    if (schoolTypeSelect && displayCost) {
        function updateSchoolCost() {
            const selectedType = schoolTypeSelect.value;
            const basePrice = adminPricing['nonGovSchoolTuition'] || 0;
            if (selectedType === 'international') {
                displayCost.textContent = '۲۵۰,۰۰۰,۰۰۰ تا ۴۵۰,۰۰۰,۰۰۰ تومان';
            } else if (selectedType === 'security') {
                displayCost.textContent = '۱ تا ۷ میلیون تومان';
            } else {
                displayCost.textContent = '۲۵۰,۰۰۰,۰۰۰ تا ۴۵۰,۰۰۰,۰۰۰ تومان';
            }
        }

        schoolTypeSelect.addEventListener('change', updateSchoolCost);
    }
});

