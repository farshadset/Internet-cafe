// ChillUtils loaded from libs/utils.js

var _origFetch = window.fetch;
var _cachedAdminToken = null;
var _cachedUserToken = null;
var _autoLogoutTimer = null;

function _refreshTokenCache() {
    try { var d = JSON.parse(localStorage.getItem('adminData') || 'null'); _cachedAdminToken = (d && d.token) ? d.token : null; } catch(e) { _cachedAdminToken = null; }
    try { var d = JSON.parse(localStorage.getItem('userData') || 'null'); _cachedUserToken = (d && d.token) ? d.token : null; } catch(e) { _cachedUserToken = null; }
    _setupAutoLogout();
}
_refreshTokenCache();
window.addEventListener('storage', function(e) {
    if (e.key === 'adminData' || e.key === 'userData') _refreshTokenCache();
});

function _parseJWT(token) {
    if (typeof jwtDecode !== 'undefined') {
        try { return jwtDecode(token); } catch(e) { return null; }
    }
    try {
        var parts = token.split('.');
        if (parts.length !== 3) return null;
        return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch(e) { return null; }
}

function _setupAutoLogout() {
    if (_autoLogoutTimer) { clearTimeout(_autoLogoutTimer); _autoLogoutTimer = null; }
    var tokens = [];
    if (_cachedAdminToken) tokens.push({ token: _cachedAdminToken, type: 'admin' });
    if (_cachedUserToken) tokens.push({ token: _cachedUserToken, type: 'user' });
    if (tokens.length === 0) return;
    var soonest = null;
    tokens.forEach(function(t) {
        var payload = _parseJWT(t.token);
        if (payload && payload.exp) {
            var remaining = payload.exp - Date.now();
            if (remaining <= 0) {
                _forceLogout(t.type);
            } else if (!soonest || remaining < soonest.remaining) {
                soonest = { type: t.type, remaining: remaining };
            }
        }
    });
    if (soonest) {
        var fireAt = Math.max(soonest.remaining - 30000, 5000);
        _autoLogoutTimer = setTimeout(function() {
            _forceLogout(soonest.type);
        }, fireAt);
    }
}

function _forceLogout(type) {
    if (_autoLogoutTimer) { clearTimeout(_autoLogoutTimer); _autoLogoutTimer = null; }
    if (type === 'admin') {
        localStorage.removeItem('adminData');
        _cachedAdminToken = null;
    } else {
        localStorage.removeItem('userData');
        _cachedUserToken = null;
    }
    if (type === 'admin' && location.pathname.indexOf('/admin') !== -1) {
        location.href = '/login';
    } else if (type === 'user' && location.pathname.indexOf('/admin') === -1) {
        location.href = '/login';
    }
}

function isTokenExpired(token) {
    var payload = _parseJWT(token);
    return !payload || (payload.exp && Date.now() > payload.exp);
}

function checkAdminAuth() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem('adminData') || 'null'); } catch(e) {}
    if (!d || !d.token) { window.location.href = '/login'; return false; }
    if (isTokenExpired(d.token)) { localStorage.removeItem('adminData'); window.location.href = '/login'; return false; }
    return true;
}

function checkUserAuth() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem('userData') || 'null'); } catch(e) {}
    if (!d || !d.token) { window.location.href = '/login'; return false; }
    if (isTokenExpired(d.token)) { localStorage.removeItem('userData'); window.location.href = '/login'; return false; }
    return true;
}

window.fetch = function(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    var apiUrl = typeof url === 'string' ? url : (url.url || '');
    if (apiUrl.indexOf('/api/') === 0) {
        if (!opts.headers['Authorization']) {
            if (_cachedAdminToken) {
                opts.headers['Authorization'] = 'Bearer ' + _cachedAdminToken;
            } else if (_cachedUserToken) {
                opts.headers['Authorization'] = 'Bearer ' + _cachedUserToken;
            }
        }
    }
    return _origFetch.call(this, url, opts);
};

// ==================== WEBAUTHN CLIENT ====================
var WebAuthnClient = {
    isSupported: function() {
        return window.PublicKeyCredential !== undefined &&
               typeof window.PublicKeyCredential === 'function' &&
               typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
    },
    isPlatformAuthenticatorAvailable: async function() {
        if (!this.isSupported()) return false;
        try {
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch(e) { return false; }
    },
    arrayBufferToBase64url: function(buffer) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    },
    base64urlToArrayBuffer: function(base64url) {
        var str = base64url.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        var binary = atob(str);
        var buffer = new ArrayBuffer(binary.length);
        var view = new Uint8Array(buffer);
        for (var i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
        return buffer;
    },
    register: async function(deviceName) {
        var optionsRes = await fetch('/api/webauthn/register-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!optionsRes.ok) throw new Error('خطا در دریافت تنظیمات ثبت‌نام');
        var options = await optionsRes.json();
        options.challenge = this.base64urlToArrayBuffer(options.challenge);
        options.user.id = this.base64urlToArrayBuffer(options.user.id);
        if (options.excludeCredentials) {
            options.excludeCredentials = options.excludeCredentials.map(function(c) {
                return Object.assign({}, c, { id: this.base64urlToArrayBuffer(c.id) });
            }.bind(this));
        }
        var credential = await navigator.credentials.create({ publicKey: options });
        var credentialData = {
            id: credential.id,
            rawId: this.arrayBufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
                attestationObject: this.arrayBufferToBase64url(credential.response.attestationObject),
                clientDataJSON: this.arrayBufferToBase64url(credential.response.clientDataJSON),
                transports: credential.response.getTransports ? credential.response.getTransports() : [],
            },
            authenticatorAttachment: credential.authenticatorAttachment,
            clientExtensionResults: credential.getClientExtensionResults(),
        };
        var regRes = await fetch('/api/webauthn/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: credentialData, deviceName: deviceName || 'دستگاه ناشناس' })
        });
        var regResult = await regRes.json();
        if (!regRes.ok || !regResult.success) throw new Error(regResult.error || 'خطا در ثبت‌نام');
        return regResult;
    },
    authenticate: async function(username) {
        var optionsRes = await fetch('/api/webauthn/auth-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username })
        });
        if (!optionsRes.ok) throw new Error('خطا در دریافت تنظیمات احراز هویت');
        var options = await optionsRes.json();
        options.challenge = this.base64urlToArrayBuffer(options.challenge);
        if (options.allowCredentials) {
            options.allowCredentials = options.allowCredentials.map(function(c) {
                return Object.assign({}, c, { id: this.base64urlToArrayBuffer(c.id) });
            }.bind(this));
        }
        var assertion = await navigator.credentials.get({ publicKey: options });
        var assertionData = {
            id: assertion.id,
            rawId: this.arrayBufferToBase64url(assertion.rawId),
            type: assertion.type,
            response: {
                authenticatorData: this.arrayBufferToBase64url(assertion.response.authenticatorData),
                clientDataJSON: this.arrayBufferToBase64url(assertion.response.clientDataJSON),
                signature: this.arrayBufferToBase64url(assertion.response.signature),
                userHandle: assertion.response.userHandle ? this.arrayBufferToBase64url(assertion.response.userHandle) : null,
            },
            clientExtensionResults: assertion.getClientExtensionResults(),
        };
        var authRes = await fetch('/api/webauthn/authenticate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: assertionData, username: username })
        });
        var authResult = await authRes.json();
        if (!authRes.ok || !authResult.success) throw new Error(authResult.error || 'خطا در احراز هویت');
        return authResult;
    },
    getCredentials: async function() {
        var res = await fetch('/api/webauthn/credentials');
        if (!res.ok) throw new Error('خطا در دریافت لیست اثرانگشت‌ها');
        return await res.json();
    },
    removeCredential: async function(id) {
        var res = await fetch('/api/webauthn/credentials/' + encodeURIComponent(id), { method: 'DELETE' });
        if (!res.ok) throw new Error('خطا در حذف اثرانگشت');
        return await res.json();
    }
};

var escapeHtml = ChillUtils.escapeHtml;
var safeUrl = ChillUtils.safeUrl;
var formatPrice = ChillUtils.formatPrice;
var isImageFile = ChillUtils.isImageFile;

function formatPriceInputValue(value) {
    return ChillUtils.toEnDigits(value).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function setupPriceInputFormatting(input) {
    if (!input) return;
    if (typeof Cleave !== 'undefined') {
        new Cleave(input, {
            numeral: true,
            numeralThousandsGroupStyle: 'thousand',
            delimiter: ',',
            numeralPositiveOnly: true
        });
        return;
    }
    input.addEventListener('input', function() {
        var caretFromEnd = input.value.length - input.selectionStart;
        var formatted = formatPriceInputValue(input.value);
        if (input.value !== formatted) {
            input.value = formatted;
            var newCaret = Math.max(0, formatted.length - caretFromEnd);
            if (input.setSelectionRange) input.setSelectionRange(newCaret, newCaret);
        }
    });
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
            if (!response.ok) throw new Error('HTTP ' + response.status);
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
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(banners => {
            if (banners.length > 0 && document.getElementById('bannerImg')) {
                document.getElementById('bannerImg').src = banners[0].src;
            }
        })
        .catch(() => {});

    // بارگذاری قیمت‌ها از دیتابیس
    let adminPricing = {};
    const pricingPromise = fetch('/api/pricing')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
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
                link: '/form?service=کارت ملی هوشمند&cat=خدمات هویتی و قضایی',
                subItems: [
                    { title: 'کارت ملی هوشمند', link: '/form?service=کارت ملی هوشمند&cat=خدمات هویتی و قضایی' },
                    { title: 'المثنی کارت ملی', link: '/form?service=المثنی کارت ملی&cat=خدمات هویتی و قضایی' },
                    { title: 'تغییر نشانی', link: '/form?service=تغییر نشانی&cat=خدمات هویتی و قضایی' },
                    { title: 'شناسنامه المثنی', link: '/form?service=شناسنامه المثنی&cat=خدمات هویتی و قضایی' },
                    { title: 'اصلاح مشخصات', link: '/form?service=اصلاح مشخصات&cat=خدمات هویتی و قضایی' }
                ]
            },
            {
                title: 'گذرنامه و مهاجرت',
                icon: 'fa-passport',
                link: '/form?service=ثبت نام گذرنامه&cat=خدمات هویتی و قضایی',
                subItems: [
                    { title: 'ثبت نام گذرنامه', link: '/form?service=ثبت نام گذرنامه&cat=خدمات هویتی و قضایی' },
                    { title: 'تمدید پاسپورت', link: '/form?service=تمدید پاسپورت&cat=خدمات هویتی و قضایی' },
                    { title: 'المثنی گذرنامه', link: '/form?service=المثنی گذرنامه&cat=خدمات هویتی و قضایی' },
                    { title: 'فرم مهاجرت', link: '/form?service=فرم مهاجرت&cat=خدمات هویتی و قضایی' }
                ]
            },
            {
                title: 'سامانه ثنا و قضایی',
                icon: 'fa-gavel',
                link: '/form?service=ثبت نام ثنا&cat=خدمات هویتی و قضایی',
                subItems: [
                    { title: 'ثبت نام ثنا', link: '/form?service=ثبت نام ثنا&cat=خدمات هویتی و قضایی' },
                    { title: 'بازیابی رمز ثنا', link: '/form?service=بازیابی رمز ثنا&cat=خدمات هویتی و قضایی' },
                    { title: 'ابلاغ الکترونیک', link: '/form?service=ابلاغ الکترونیک&cat=خدمات هویتی و قضایی' },
                    { title: 'پیگیری پرونده', link: '/form?service=پیگیری پرونده&cat=خدمات هویتی و قضایی' },
                    { title: 'نوبت‌دهی قضایی', link: '/form?service=نوبت‌دهی قضایی&cat=خدمات هویتی و قضایی' }
                ]
            },
            {
                title: 'سوء پیشینه و استعلام‌ها',
                icon: 'fa-search',
                link: '/form?service=گواهی عدم سوء پیشینه&cat=خدمات هویتی و قضایی',
                subItems: [
                    { title: 'گواهی عدم سوء پیشینه', link: '/form?service=گواهی عدم سوء پیشینه&cat=خدمات هویتی و قضایی' },
                    { title: 'استعلام کد ملی', link: '/form?service=استعلام کد ملی&cat=خدمات هویتی و قضایی' },
                    { title: 'استعلام شناسنامه', link: '/form?service=استعلام شناسنامه&cat=خدمات هویتی و قضایی' },
                    { title: 'استعلام محکومیت', link: '/form?service=استعلام محکومیت&cat=خدمات هویتی و قضایی' }
                ]
            }
        ],
        finance: [
            {
                title: 'وام و تسهیلات',
                icon: 'fa-hand-holding-usd',
                link: '/form?service=وام ازدواج&cat=بانکی، مالی و بورسی',
                subItems: [
                    { title: 'وام ازدواج', link: '/form?service=وام ازدواج&cat=بانکی، مالی و بورسی' },
                    { title: 'وام ودیعه مسکن', link: '/form?service=وام ودیعه مسکن&cat=بانکی، مالی و بورسی' },
                    { title: 'وام ضروری', link: '/form?service=وام ضروری&cat=بانکی، مالی و بورسی' },
                    { title: 'تسهیلات خرید مسکن', link: '/form?service=تسهیلات خرید مسکن&cat=بانکی، مالی و بورسی' }
                ]
            },
            {
                title: 'یارانه و سهام عدالت',
                icon: 'fa-hand-holding-heart',
                link: '/form?service=یارانه معیشتی&cat=بانکی، مالی و بورسی',
                subItems: [
                    { title: 'یارانه معیشتی', link: '/form?service=یارانه معیشتی&cat=بانکی، مالی و بورسی' },
                    { title: 'اعتراض یارانه', link: '/form?service=اعتراض یارانه&cat=بانکی، مالی و بورسی' },
                    { title: 'سهام عدالت', link: '/form?service=سهام عدالت&cat=بانکی، مالی و بورسی' },
                    { title: 'فروش سهام', link: '/form?service=فروش سهام&cat=بانکی، مالی و بورسی' }
                ]
            },
            {
                title: 'بورس و سجام',
                icon: 'fa-chart-line',
                link: '/form?service=ثبت سجام&cat=بانکی، مالی و بورسی',
                subItems: [
                    { title: 'ثبت سجام', link: '/form?service=ثبت سجام&cat=بانکی، مالی و بورسی' },
                    { title: 'احراز هویت بورسی', link: '/form?service=احراز هویت بورسی&cat=بانکی، مالی و بورسی' },
                    { title: 'افتتاح کد بورسی', link: '/form?service=افتتاح کد بورسی&cat=بانکی، مالی و بورسی' }
                ]
            },
            {
                title: 'خدمات بانکی',
                icon: 'fa-wallet',
                link: '/form?service=افتتاح حساب&cat=بانکی، مالی و بورسی',
                subItems: [
                    { title: 'افتتاح حساب', link: '/form?service=افتتاح حساب&cat=بانکی، مالی و بورسی' },
                    { title: 'احراز هویت بانک', link: '/form?service=احراز هویت بانک&cat=بانکی، مالی و بورسی' },
                    { title: 'اعتبارسنجی مرآت', link: '/form?service=اعتبارسنجی مرآت&cat=بانکی، مالی و بورسی' },
                    { title: 'پرداخت آنلاین', link: '/form?service=پرداخت آنلاین&cat=بانکی، مالی و بورسی' }
                ]
            }
        ],
        automotive: [
            {
                title: 'کارت سوخت',
                icon: 'fa-gas-pump',
                link: '/form?service=صدور کارت سوخت&cat=خودرو و حمل و نقل',
                subItems: [
                    { title: 'صدور کارت سوخت', link: '/form?service=صدور کارت سوخت&cat=خودرو و حمل و نقل' },
                    { title: 'المثنی کارت سوخت', link: '/form?service=المثنی کارت سوخت&cat=خودرو و حمل و نقل' },
                    { title: 'انتقال کارت سوخت', link: '/form?service=انتقال کارت سوخت&cat=خودرو و حمل و نقل' }
                ]
            },
            {
                title: 'تعویض پلاک و خودرو',
                icon: 'fa-ticket-alt',
                link: '/form?service=نوبت تعویض پلاک&cat=خودرو و حمل و نقل',
                subItems: [
                    { title: 'نوبت تعویض پلاک', link: '/form?service=نوبت تعویض پلاک&cat=خودرو و حمل و نقل' },
                    { title: 'نقل و انتقال خودرو', link: '/form?service=نقل و انتقال خودرو&cat=خودرو و حمل و نقل' },
                    { title: 'مالیات نقل و انتقال', link: '/form?service=مالیات نقل و انتقال&cat=خودرو و حمل و نقل' }
                ]
            },
            {
                title: 'جریمه و معاینه فنی',
                icon: 'fa-exclamation-triangle',
                link: '/form?service=استعلام خلافی&cat=خودرو و حمل و نقل',
                subItems: [
                    { title: 'استعلام خلافی', link: '/form?service=استعلام خلافی&cat=خودرو و حمل و نقل' },
                    { title: 'پرداخت جریمه', link: '/form?service=پرداخت جریمه&cat=خودرو و حمل و نقل' },
                    { title: 'اعتراض جریمه', link: '/form?service=اعتراض جریمه&cat=خودرو و حمل و نقل' },
                    { title: 'نوبت معاینه فنی', link: '/form?service=نوبت معاینه فنی&cat=خودرو و حمل و نقل' }
                ]
            },
            {
                title: 'ثبت نام خودرو',
                icon: 'fa-car',
                link: '/form?service=ثبت نام خودرو ایران خودرو&cat=خودرو و حمل و نقل',
                subItems: [
                    { title: 'ایران خودرو', link: '/form?service=ثبت نام خودرو ایران خودرو&cat=خودرو و حمل و نقل' },
                    { title: 'سایپا', link: '/form?service=ثبت نام خودرو سایپا&cat=خودرو و حمل و نقل' },
                    { title: 'سامانه یکپارچه', link: '/form?service=سامانه یکپارچه&cat=خودرو و حمل و نقل' },
                    { title: 'انتخاب خودرو', link: '/form?service=انتخاب خودرو&cat=خودرو و حمل و نقل' }
                ]
            },
            {
                title: 'خدمات شهری',
                icon: 'fa-city',
                link: '/form?service=تهران من&cat=خودرو و حمل و نقل',
                subItems: [
                    { title: 'تهران من', link: '/form?service=تهران من&cat=خودرو و حمل و نقل' },
                    { title: 'یارانه سوخت وانت', link: '/form?service=یارانه سوخت وانت&cat=خودرو و حمل و نقل' }
                ]
            }
        ],
        education: [
            {
                title: 'مدارس',
                icon: 'fa-school',
                link: '/form?service=پیش ثبت نام مدارس&cat=آموزش و آزمون‌ها',
                subItems: [
                    { title: 'پیش ثبت نام مدارس', link: '/form?service=پیش ثبت نام مدارس&cat=آموزش و آزمون‌ها' },
                    { title: 'مدارس شاهد', link: '/form?service=مدارس شاهد&cat=آموزش و آزمون‌ها' },
                    { title: 'مدارس تیزهوشان', link: '/form?service=مدارس تیزهوشان&cat=آموزش و آزمون‌ها' },
                    { title: 'مدارس غیردولتی', link: '/form?service=مدارس غیردولتی&cat=آموزش و آزمون‌ها' }
                ]
            },
            {
                title: 'دانشگاه‌ها',
                icon: 'fa-university',
                link: '/form?service=ثبت نام دانشگاه آزاد&cat=آموزش و آزمون‌ها',
                subItems: [
                    { title: 'دانشگاه آزاد', link: '/form?service=ثبت نام دانشگاه آزاد&cat=آموزش و آزمون‌ها' },
                    { title: 'پیام نور', link: '/form?service=ثبت نام پیام نور&cat=آموزش و آزمون‌ها' },
                    { title: 'علمی کاربردی', link: '/form?service=ثبت نام علمی کاربردی&cat=آموزش و آزمون‌ها' },
                    { title: 'ثبت نام غیرحضوری', link: '/form?service=ثبت نام غیرحضوری&cat=آموزش و آزمون‌ها' }
                ]
            },
            {
                title: 'کنکور و آزمون‌ها',
                icon: 'fa-graduation-cap',
                link: '/form?service=کنکور سراسری&cat=آموزش و آزمون‌ها',
                subItems: [
                    { title: 'کنکور سراسری', link: '/form?service=کنکور سراسری&cat=آموزش و آزمون‌ها' },
                    { title: 'ارشد', link: '/form?service=ارشد&cat=آموزش و آزمون‌ها' },
                    { title: 'دکتری', link: '/form?service=دکتری&cat=آموزش و آزمون‌ها' }
                ]
            },
            {
                title: 'آزمون‌های استخدامی',
                icon: 'fa-file-alt',
                link: '/form?service=آزمون استخدامی آموزش و پرورش&cat=آموزش و آزمون‌ها',
                subItems: [
                    { title: 'آموزش و پرورش', link: '/form?service=آزمون استخدامی آموزش و پرورش&cat=آموزش و آزمون‌ها' },
                    { title: 'بانک‌ها', link: '/form?service=آزمون استخدامی بانک‌ها&cat=آموزش و آزمون‌ها' },
                    { title: 'دستگاه‌های دولتی', link: '/form?service=آزمون استخدامی دستگاه‌های دولتی&cat=آموزش و آزمون‌ها' }
                ]
            },
            {
                title: 'خدمات دانشجویی',
                icon: 'fa-user-graduate',
                link: '/form?service=سامانه‌های آموزشی&cat=آموزش و آزمون‌ها',
                subItems: [
                    { title: 'سامانه‌های آموزشی', link: '/form?service=سامانه‌های آموزشی&cat=آموزش و آزمون‌ها' },
                    { title: 'وام دانشجویی', link: '/form?service=وام دانشجویی&cat=آموزش و آزمون‌ها' }
                ]
            }
        ],
        'business-tax': [
            {
                title: 'مالیات',
                icon: 'fa-file-invoice-dollar',
                link: '/form?service=اظهارنامه مالیاتی&cat=مالیات، مجوز و کسب‌وکار',
                subItems: [
                    { title: 'اظهارنامه مالیاتی', link: '/form?service=اظهارنامه مالیاتی&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'تبصره ۱۰۰', link: '/form?service=تبصره ۱۰۰&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'ارزش افزوده', link: '/form?service=ارزش افزوده&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'اعتراض مالیاتی', link: '/form?service=اعتراض مالیاتی&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'کد اقتصادی', link: '/form?service=کد اقتصادی&cat=مالیات، مجوز و کسب‌وکار' }
                ]
            },
            {
                title: 'ثبت و تغییرات شرکت',
                icon: 'fa-building',
                link: '/form?service=ثبت شرکت&cat=مالیات، مجوز و کسب‌وکار',
                subItems: [
                    { title: 'ثبت شرکت', link: '/form?service=ثبت شرکت&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'ثبت برند', link: '/form?service=ثبت برند&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'تغییرات شرکت', link: '/form?service=تغییرات شرکت&cat=مالیات، مجوز و کسب‌وکار' }
                ]
            },
            {
                title: 'مجوزها',
                icon: 'fa-certificate',
                link: '/form?service=سامانه ملی مجوزها&cat=مالیات، مجوز و کسب‌وکار',
                subItems: [
                    { title: 'سامانه ملی مجوزها', link: '/form?service=سامانه ملی مجوزها&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'جواز کسب', link: '/form?service=جواز کسب&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'مجوز صنفی', link: '/form?service=مجوز صنفی&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'مجوز تولیدی', link: '/form?service=مجوز تولیدی&cat=مالیات، مجوز و کسب‌وکار' }
                ]
            },
            {
                title: 'اصناف و اماکن',
                icon: 'fa-store',
                link: '/form?service=نوین اصناف&cat=مالیات، مجوز و کسب‌وکار',
                subItems: [
                    { title: 'نوین اصناف', link: '/form?service=نوین اصناف&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'بازدید اماکن', link: '/form?service=بازدید اماکن&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'صلاحیت بهداشتی', link: '/form?service=صلاحیت بهداشتی&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'گواهی مالیاتی ۱۸۶', link: '/form?service=گواهی مالیاتی ۱۸۶&cat=مالیات، مجوز و کسب‌وکار' }
                ]
            }
        ],
        'government-services': [
            {
                title: 'سامانه‌های عمومی',
                icon: 'fa-landmark',
                link: '/form?service=میخک&cat=سامانه‌های دولتی',
                subItems: [
                    { title: 'میخک', link: '/form?service=میخک&cat=سامانه‌های دولتی' },
                    { title: 'سخا', link: '/form?service=سخا&cat=سامانه‌های دولتی' },
                    { title: 'شمس', link: '/form?service=شمس&cat=سامانه‌های دولتی' },
                    { title: 'ستاد ایران', link: '/form?service=ستاد ایران&cat=سامانه‌های دولتی' }
                ]
            },
            {
                title: 'املاک و اسکان',
                icon: 'fa-home',
                link: '/form?service=ثبت‌نام املاک و اسکان&cat=سامانه‌های دولتی',
                subItems: [
                    { title: 'ثبت‌نام املاک و اسکان', link: '/form?service=ثبت‌نام املاک و اسکان&cat=سامانه‌های دولتی' },
                    { title: 'خودنویس', link: '/form?service=خودنویس&cat=سامانه‌های دولتی' },
                    { title: 'ثبت سند ملکی', link: '/form?service=ثبت سند ملکی&cat=سامانه‌های دولتی' }
                ]
            },
            {
                title: 'تأمین اجتماعی و بیمه',
                icon: 'fa-shield-alt',
                link: '/form?service=نام نویسی کارفرما&cat=سامانه‌های دولتی',
                subItems: [
                    { title: 'نام نویسی کارفرما', link: '/form?service=نام نویسی کارفرما&cat=سامانه‌های دولتی' },
                    { title: 'ثبت نیروی کار', link: '/form?service=ثبت نیروی کار&cat=سامانه‌های دولتی' },
                    { title: 'ارسال لیست بیمه', link: '/form?service=ارسال لیست بیمه&cat=سامانه‌های دولتی' },
                    { title: 'بیمه با سابقه', link: '/form?service=بیمه با سابقه&cat=سامانه‌های دولتی' },
                    { title: 'کمیسیون پزشکی', link: '/form?service=کمیسیون پزشکی&cat=سامانه‌های دولتی' },
                    { title: 'کمک هزینه عینک', link: '/form?service=کمک هزینه عینک&cat=سامانه‌های دولتی' },
                    { title: 'کمک هزینه سمعک', link: '/form?service=کمک هزینه سمعک&cat=سامانه‌های دولتی' }
                ]
            },
            {
                title: 'خدمات توکن',
                icon: 'fa-key',
                link: '/form?service=راه‌اندازی توکن&cat=سامانه‌های دولتی',
                subItems: [
                    { title: 'راه‌اندازی توکن', link: '/form?service=راه‌اندازی توکن&cat=سامانه‌های دولتی' },
                    { title: 'امضا در ثبت من', link: '/form?service=امضا در ثبت من&cat=سامانه‌های دولتی' },
                    { title: 'امضای نرم‌افزاری', link: '/form?service=امضای نرم‌افزاری&cat=سامانه‌های دولتی' }
                ]
            },
            {
                title: 'خدمات انتخاباتی',
                icon: 'fa-vote-yea',
                link: '/form?service=رأی اولی‌ها&cat=سامانه‌های دولتی',
                subItems: [
                    { title: 'رأی اولی‌ها', link: '/form?service=رأی اولی‌ها&cat=سامانه‌های دولتی' },
                    { title: 'تعیین شعبه', link: '/form?service=تعیین شعبه&cat=سامانه‌های دولتی' },
                    { title: 'تأیید صلاحیت', link: '/form?service=تأیید صلاحیت&cat=سامانه‌های دولتی' }
                ]
            }
        ]
    };

    function buildServiceLink(link, title) {
        if (!link.includes('/form?service=') || link.includes('label=')) return link;
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

    window.MEGA_MENU_DATA = MEGA_MENU_DATA;
    window.megaMenuSearchIndex = [];
    Object.keys(MEGA_MENU_DATA).forEach(function(key) {
        var sections = MEGA_MENU_DATA[key];
        sections.forEach(function(section) {
            window.megaMenuSearchIndex.push({ title: section.title, link: section.link });
            if (section.subItems) {
                section.subItems.forEach(function(sub) {
                    window.megaMenuSearchIndex.push({ title: sub.title, link: sub.link });
                });
            }
        });
    });

    let activeMegaItem = null;
    let hoverCloseTimer = null;

    function positionMegaDropdown(dropdown, item) {
        const rect = item.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = rect.bottom + 8;
        let left = rect.left + rect.width / 2 - dropdown.offsetWidth / 2;

        if (left + dropdown.offsetWidth > vw - 16) left = vw - dropdown.offsetWidth - 16;
        if (left < 16) left = 16;

        if (top + dropdown.offsetHeight > vh - 8) top = vh - dropdown.offsetHeight - 8;
        if (top < 8) top = 8;

        dropdown.style.top = top + 'px';
        dropdown.style.left = left + 'px';
    }

    function openMegaPortal(item) {
        const dropdown = item.querySelector('.mega-dropdown');
        if (!dropdown) return;

        // Close all other open dropdowns
        document.querySelectorAll('.menu-item.mega-open').forEach(function(openItem) {
            if (openItem !== item) {
                openItem.classList.remove('mega-open');
            }
        });

        // First, make it visible with position:fixed so dimensions are correct
        item.classList.add('mega-open');

        // Now position it (in fixed context)
        positionMegaDropdown(dropdown, item);

        activeMegaItem = item;
    }

    function closeMegaPortal(item) {
        const target = item || activeMegaItem;
        if (!target) return;
        target.classList.remove('mega-open');
        activeMegaItem = null;
    }

    function setupMegaMenuHover() {
        document.querySelectorAll('.menu-item').forEach(function(item) {
            const dropdown = item.querySelector('.mega-dropdown');
            if (!dropdown) return;

            item.addEventListener('mouseenter', function() {
                clearTimeout(hoverCloseTimer);
                openMegaPortal(item);
            });

            item.addEventListener('mouseleave', function() {
                hoverCloseTimer = setTimeout(function() { closeMegaPortal(item); }, 80);
            });

            dropdown.addEventListener('mouseenter', function() {
                clearTimeout(hoverCloseTimer);
            });

            dropdown.addEventListener('mouseleave', function() {
                hoverCloseTimer = setTimeout(function() { closeMegaPortal(item); }, 80);
            });
        });
    }

    setupMegaMenuHover();



    document.addEventListener('click', function(e) {
        if (e.target.closest('.menu-item')) return;
        closeMegaPortal();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeMegaPortal();
    });


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
            const submitBtn = formElement.querySelector('[type="submit"]');
            if (submitBtn && submitBtn.disabled) return;
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'در حال ارسال...'; }

            const raw = Object.fromEntries(new FormData(formElement));
            const transformed = config.transform(raw);
            const body = {
                ...transformed,
                attachments: currentAttachments.map(attachmentForApiStorage),
                title: transformed.title || config.title,
                cost: effectiveCost,
                status: 'pending',
                serviceKey: serviceKey,
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
            .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
            .then(async result => {
                if (!result.ok || !result.data.trackingCode) {
                    ChillUtils.showAlert(result.data.error || 'خطا در ثبت سفارش', 'error');
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ثبت سفارش'; }
                    return;
                }
                localStorage.setItem('lastTrackingCode', result.data.trackingCode);
                await window.uploadAttachmentsForTrackingCode(result.data.trackingCode, currentAttachments);
                await saveAttachmentsAfterSubmit(result.data.trackingCode);
                window.location.href = '/review';
            })
            .catch(async () => {
                ChillUtils.showAlert('خطا در اتصال به سرور. لطفاً دوباره تلاش کنید.', 'error');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ثبت سفارش'; }
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
              : form.dataset.service || new URLSearchParams(window.location.search).get('service') || null;
        if (key) {
            renderServiceForm(form, key);
            setupServiceForm(form, key);
        }
    });

    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', e => {
            e.preventDefault();
            const submitBtn = authForm.querySelector('[type="submit"]');
            if (submitBtn && submitBtn.disabled) return;

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                ChillUtils.showAlert('رمز عبور و تکرار آن مطابقت ندارند!', 'warning');
                return;
            }

            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'در حال ثبت نام...'; }
            fetch('/api/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username, password })
            })
            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
            .then(function(result) {
                if (!result.ok || !result.data.success) {
                    ChillUtils.showAlert(result.data.error || 'خطا در ثبت نام', 'error');
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ثبت نام'; }
                    return;
                }
                localStorage.setItem('userData', JSON.stringify({ username: username, token: result.data.token }));
                window.location.href = '/';
            })
            .catch(function() {
                ChillUtils.showAlert('خطا در اتصال به سرور', 'error');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ثبت نام'; }
            });
        });
    }
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', e => {
            e.preventDefault();
            const submitBtn = loginForm.querySelector('[type="submit"]');
            if (submitBtn && submitBtn.disabled) return;

            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'در حال ورود...'; }
            fetch('/api/admin/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username, password })
            })
            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
            .then(function(result) {
                if (result.ok && result.data.success && result.data.token) {
                    localStorage.setItem('adminData', JSON.stringify({ username: username, token: result.data.token }));
                    window.location.href = '/admin';
                } else if (result.data.error && result.data.error.indexOf('قفل') !== -1) {
                    ChillUtils.showAlert(result.data.error, 'error');
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ورود'; }
                } else {
                    fetch('/api/login', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ username: username, password: password })
                    })
                    .then(function(r2) { return r2.json().then(function(d2) { return { ok: r2.ok, data: d2 }; }); })
                    .then(function(result2) {
                        if (result2.ok && result2.data.success) {
                            localStorage.setItem('userData', JSON.stringify({ username: username, token: result2.data.token }));
                            window.location.href = '/';
                        } else {
                            ChillUtils.showAlert(result2.data.error || 'نام کاربری یا رمز عبور اشتباه است!', 'error');
                            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ورود'; }
                        }
                    })
                    .catch(function() {
                        ChillUtils.showAlert('خطا در اتصال به سرور.', 'error');
                        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ورود'; }
                    });
                }
            })
            .catch(function() {
                ChillUtils.showAlert('خطا در اتصال به سرور. لطفاً دوباره تلاش کنید.', 'error');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ورود'; }
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
    var _adminParsed = null;
    try { _adminParsed = adminLoggedIn ? JSON.parse(adminLoggedIn) : null; } catch(e) {}
    if ((!adminLoggedIn || !_adminParsed || !_adminParsed.token) && document.getElementById('adminPanel')) {
        window.location.href = '/login';
    }

    const ordersBadge = document.getElementById('ordersBadge');
    const chatBadge = document.getElementById('chatBadge');

    function updateAdminBadges() {
        fetch('/api/admin/unread-count')
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(data => {
                if (ordersBadge) {
                    ordersBadge.textContent = data.pendingOrders || 0;
                    ordersBadge.style.display = (data.pendingOrders || 0) > 0 ? 'inline-block' : 'none';
                }
                if (chatBadge) {
                    chatBadge.textContent = data.unreadChat || 0;
                    chatBadge.style.display = (data.unreadChat || 0) > 0 ? 'inline-block' : 'none';
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
            fetch('/api/logout', { method: 'POST' }).catch(function(){});
            localStorage.removeItem('adminData');
            window.location.href = '/login';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => {
            e.preventDefault();
            fetch('/api/logout', { method: 'POST' }).catch(function(){});
            localStorage.removeItem('userData');
            window.location.href = '/';
        });
    }

    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', function() {
            const trackingCode = localStorage.getItem('lastTrackingCode');
            if (!trackingCode) {
                ChillUtils.showAlert('کد سفارش پیدا نشد. لطفاً دوباره ثبت نام کنید.', 'warning');
                window.location.href = '/';
                return;
            }
            confirmPaymentBtn.disabled = true;
            confirmPaymentBtn.textContent = 'در حال پردازش...';
            fetch('/api/order/confirm', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ trackingCode })
            })
            .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
            .then(function(result) {
                if (result.ok && result.data.success) {
                    window.location.href = '/success';
                } else {
                    ChillUtils.showAlert(result.data.error || 'خطا در تایید پرداخت', 'error');
                    confirmPaymentBtn.disabled = false;
                    confirmPaymentBtn.textContent = 'تایید و پرداخت';
                }
            })
            .catch(function() {
                ChillUtils.showAlert('خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.', 'error');
                confirmPaymentBtn.disabled = false;
                confirmPaymentBtn.textContent = 'تایید و پرداخت';
            });
        });
    }


    // ==================== CHAT v2 (using ChatCore) ====================
    var supportBtn = document.getElementById('supportBtn');
    var supportModal = document.getElementById('supportModal');
    var chatPanel = document.getElementById('chatPanel');
    var inlineChatMessages = document.getElementById('inlineChatMessages');
    var inlineMessageInput = document.getElementById('inlineMessageInput');
    var inlineSendBtn = document.getElementById('inlineSendBtn');
    var newConversationBtn = document.getElementById('newConversationBtn');
    var conversationsList = document.getElementById('conversationsList');
    var currentConversationId = null;
    var inlinePolling = null;
    var conversationsData = [];
    var inlineAttachments = [];
    var pendingReads = 0;
    var activeReaders = {};
    var inlineAttachmentPreview = null;
    var inlinePinAttachment = null;
    var inlineAttachmentFile = null;
    var _typingDebounce = null;
    var _socket = null;

    if (typeof ChatCore !== 'undefined') {
        ChatCore.injectChatStyles();
    }

    // --- Conversations List ---
    function loadConversations() {
        if (!conversationsList) return Promise.resolve();
        var userData = JSON.parse(localStorage.getItem('userData') || 'null');
        var username = userData ? userData.username : 'مهمان';
        return fetch('/api/chat/conversations?username=' + encodeURIComponent(username))
            .then(function(r) {
                if (r.status === 404 || !r.ok) return [];
                return r.json().catch(function() { return []; });
            })
            .then(function(convs) {
                conversationsData = convs || [];
                renderConversationsList();
            })
            .catch(function() {
                conversationsList.innerHTML = '<div style="color:#e74c3c;font-size:0.85rem;text-align:center;padding:1rem;">خطا در بارگذاری گفتگوها</div>';
            });
    }

    function renderConversationsList() {
        if (!conversationsList) return;
        conversationsList.innerHTML = '';
        if (conversationsData.length === 0) {
            conversationsList.innerHTML = '<div style="color:#999;font-size:0.85rem;text-align:center;padding:1rem;">هیچ گفتگویی وجود ندارد</div>';
            return;
        }
        conversationsData.forEach(function(c) {
            var div = document.createElement('div');
            div.className = 'conversation-item';
            if (c.id === currentConversationId) div.classList.add('active');
            div.setAttribute('data-conv-id', c.id);
            var dateStr = c.lastTimestamp ? ChatCore.formatDate(c.lastTimestamp) : '';
            var preview = ChatCore.truncate(c.lastMessage || 'گفتگوی جدید', 35);
            div.innerHTML = '<div class="conv-title">' + ChatCore.escapeHtml(preview) + '</div><div class="conv-preview">' + ChatCore.escapeHtml(preview) + '</div><div class="conv-date">' + dateStr + '</div>';
            div.addEventListener('click', function() {
                currentConversationId = c.id;
                loadInlineMessages();
                highlightActiveConversation();
                if (typeof ChatCore !== 'undefined') ChatCore.joinConversation(c.id);
            });
            conversationsList.appendChild(div);
        });
    }

    function highlightActiveConversation() {
        if (!conversationsList) return;
        conversationsList.querySelectorAll('.conversation-item').forEach(function(item) {
            item.classList.remove('active');
            if (item.getAttribute('data-conv-id') === currentConversationId) {
                item.classList.add('active');
            }
        });
    }

    // --- Create Conversation ---
    function createNewConversation() {
        var userData = JSON.parse(localStorage.getItem('userData') || 'null');
        var username = userData ? userData.username : 'مهمان';
        return fetch('/api/chat/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username })
        })
        .then(function(r) { return r.json(); })
        .then(function(conv) {
            if (!conv || !conv.id) throw new Error('خطا در ایجاد گفتگو');
            currentConversationId = conv.id;
            return conv;
        })
        .catch(function(err) {
            console.error('خطا در ایجاد گفتگو:', err);
            currentConversationId = 'conv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            return { id: currentConversationId };
        });
    }

    // --- Messages ---
    function loadInlineMessages() {
        if (!inlineChatMessages) return;
        var userData = JSON.parse(localStorage.getItem('userData') || 'null');
        var username = userData ? userData.username : 'مهمان';

        if (currentConversationId) {
            fetch('/api/chat/conversation/' + currentConversationId + '?username=' + encodeURIComponent(username) + '&limit=30')
                .then(function(r) {
                    if (r.status === 404 || !r.ok) return { messages: [] };
                    return r.json().catch(function() { return { messages: [] }; });
                })
                .then(function(data) {
                    renderMessages((data && data.messages) || []);
                    // Mark messages as read
                    markConversationRead(currentConversationId, username);
                })
                .catch(function() {
                    if (inlineChatMessages.children.length === 0) {
                        inlineChatMessages.innerHTML = '<div style="text-align:center;color:#e74c3c;padding:1rem;">خطا در بارگذاری پیام‌ها</div>';
                    }
                });
        }
    }

    function markConversationRead(convId, username) {
        if (!convId) return;
        var ud = JSON.parse(localStorage.getItem('userData') || 'null');
        var token = ud ? ud.token : null;
        if (!token) return;
        fetch('/api/chat/conversation/' + convId + '/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ username: username })
        }).catch(function() {});
    }

    function renderMessages(messages) {
        if (!inlineChatMessages) return;
        inlineChatMessages.innerHTML = '';
        if (!messages || messages.length === 0) {
            inlineChatMessages.innerHTML = '<div style="text-align:center;color:#999;padding:1rem;">هیچ پیامی وجود ندارد</div>';
            return;
        }
        messages.forEach(function(msg) {
            var el = ChatCore.renderMessage(msg, { showSeen: true, tickRole: 'customer' });
            inlineChatMessages.appendChild(el);
        });
        inlineChatMessages.scrollTop = inlineChatMessages.scrollHeight;
    }

    // --- Send Message ---
    function sendInlineMessage() {
        if (!inlineMessageInput) return;
        var text = inlineMessageInput.value.trim();
        if (!text && inlineAttachments.length === 0) return;
        if (pendingReads > 0) return;
        if (inlineSendBtn && inlineSendBtn.disabled) return;

        var totalSize = 0;
        inlineAttachments.forEach(function(a) { totalSize += (a.dataUrl || '').length; });
        if (totalSize > ChatCore.MAX_TOTAL_SIZE) {
            ChillUtils.showAlert('حجم فایل‌های پیوست زیاد است.', 'error');
            return;
        }

        function doSend(convId) {
            var userData = JSON.parse(localStorage.getItem('userData') || 'null');
            var username = userData ? userData.username : 'مهمان';
            if (inlineSendBtn) inlineSendBtn.disabled = true;
            
            if (typeof ChatCore !== 'undefined') {
                ChatCore.stopTyping(convId, username);
            }
            
            fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    conversationId: convId,
                    attachments: inlineAttachments
                })
            })
            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
            .then(function(result) {
                if (!result.ok) {
                    if (typeof ChatCore !== 'undefined') {
                        ChatCore.enqueueOffline({ text: text, conversationId: convId, attachments: inlineAttachments });
                    }
                    ChillUtils.showAlert(result.data.error || 'خطا در ارسال پیام', 'error');
                }
                inlineMessageInput.value = '';
                inlineAttachments = [];
                if (inlineAttachmentPreview) {
                    inlineAttachmentPreview.innerHTML = '';
                    inlineAttachmentPreview.classList.add('hidden');
                }
                if (inlineSendBtn) inlineSendBtn.disabled = false;
                loadInlineMessages();
                loadConversations();
            })
            .catch(function(err) {
                if (typeof ChatCore !== 'undefined') {
                    ChatCore.enqueueOffline({ text: text, conversationId: convId, attachments: inlineAttachments });
                    ChillUtils.showToast('پیام در صف ارسال قرار گرفت');
                } else {
                    ChillUtils.showAlert('خطا در ارسال پیام', 'error');
                }
                if (inlineSendBtn) inlineSendBtn.disabled = false;
            });
        }

        if (!currentConversationId) {
            createNewConversation().then(function(conv) { doSend(conv.id); });
        } else {
            doSend(currentConversationId);
        }
    }

    // --- Attachments ---
    function setupInlineAttachments() {
        if (!inlineChatMessages) return;
        var chatInput = inlineChatMessages.parentElement.querySelector('.admin-chat-input-area');
        if (!chatInput) return;

        inlineAttachmentPreview = document.getElementById('inlineAttachmentPreview') || inlineAttachmentPreview;
        if (!inlineAttachmentPreview) {
            inlineAttachmentPreview = document.createElement('div');
            inlineAttachmentPreview.className = 'attachment-preview hidden';
            inlineAttachmentPreview.id = 'inlineAttachmentPreview';
            chatInput.insertBefore(inlineAttachmentPreview, chatInput.firstChild);
        }

        inlinePinAttachment = document.getElementById('inlinePinAttachment') || inlinePinAttachment;
        if (!inlinePinAttachment) {
            inlinePinAttachment = document.createElement('button');
            inlinePinAttachment.type = 'button';
            inlinePinAttachment.className = 'pin-attachment';
            inlinePinAttachment.title = 'افزودن فایل';
            inlinePinAttachment.innerHTML = '<i class="fas fa-paperclip"></i>';
            chatInput.appendChild(inlinePinAttachment);
        }

        inlineAttachmentFile = document.getElementById('inlineAttachmentFile') || inlineAttachmentFile;
        if (!inlineAttachmentFile) {
            inlineAttachmentFile = document.createElement('input');
            inlineAttachmentFile.type = 'file';
            inlineAttachmentFile.id = 'inlineAttachmentFile';
            inlineAttachmentFile.accept = 'image/*,.heic,.heif,.pdf';
            inlineAttachmentFile.style.display = 'none';
            inlineAttachmentFile.multiple = true;
            document.body.appendChild(inlineAttachmentFile);
        }

        inlinePinAttachment.onclick = function() { inlineAttachmentFile.click(); };

        inlineAttachmentFile.onchange = function(e) {
            var files = Array.from(e.target.files || []);
            var remaining = (typeof ChatCore !== 'undefined' ? ChatCore.MAX_ATTACHMENTS : 4) - inlineAttachments.length - pendingReads;
            if (remaining <= 0) {
                ChillUtils.showAlert('فقط می توان چهار فایل آپلود کرد', 'warning');
                inlineAttachmentFile.value = '';
                return;
            }
            var toProcess = files.slice(0, remaining);
            var index = 0;
            function processFileAttachment(file) {
                var attId = (typeof ChatCore !== 'undefined') ? ChatCore.generateId('att_') : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                var isImg = (typeof ChatCore !== 'undefined') ? ChatCore.isImageFile(file) : false;

                if (inlineAttachmentPreview) {
                    inlineAttachmentPreview.insertAdjacentHTML('beforeend',
                        (typeof ChatCore !== 'undefined') ? ChatCore.renderAttachmentProgress(attId, file.name, isImg) : '');
                    inlineAttachmentPreview.classList.remove('hidden');
                }

                pendingReads++;
                updateInlineSendButton();

                if (typeof ChatCore !== 'undefined') {
                    ChatCore.readFileAsDataURL(file, function(pct) { ChatCore.updateProgress(attId, pct); })
                        .then(function(att) {
                            inlineAttachments.push(att);
                            var thumb = inlineAttachmentPreview.querySelector('[data-att-id="' + attId + '"]');
                            if (thumb) thumb.remove();
                            inlineAttachmentPreview.insertAdjacentHTML('beforeend', ChatCore.renderAttachmentThumb(att, att.dataUrl));
                            pendingReads--;
                            updateInlineSendButton();
                        })
                        .catch(function() {
                            var thumb = inlineAttachmentPreview.querySelector('[data-att-id="' + attId + '"]');
                            if (thumb) thumb.remove();
                            pendingReads--;
                            updateInlineSendButton();
                            ChillUtils.showToast('خطا در خواندن فایل');
                        });
                }
                processNext();
            }
            function processNext() {
                if (index >= toProcess.length) return;
                var file = toProcess[index];
                index++;
                var validation = (typeof ChatCore !== 'undefined') ? ChatCore.validateAttachment(file) : { valid: true };
                if (!validation.valid) {
                    if (validation.compressible && typeof ChillUtils.showConfirm === 'function') {
                        ChillUtils.showConfirm(validation.error + '<br>آیا حجم تصویر کاهش یابد؟', function(confirmed) {
                            if (confirmed) {
                                var cpEl=document.getElementById('compressProgress'),cpFill=document.getElementById('compressBarFill'),cpTxt=document.getElementById('compressText');
                                if(cpEl)cpEl.classList.add('active');if(cpFill)cpFill.style.width='30%';if(cpTxt)cpTxt.textContent='در حال فشرده‌سازی تصویر...';
                                setTimeout(function(){if(cpFill)cpFill.style.width='60%'},500);setTimeout(function(){if(cpFill)cpFill.style.width='85%'},1500);
                                var compressPromise=(typeof ChatCore!=='undefined'?ChatCore.compressOversizedImage(file):Promise.resolve(file));
                                compressPromise
                                    .then(function(compressed){if(cpFill)cpFill.style.width='100%';if(cpTxt)cpTxt.textContent='فشرده‌سازی کامل شد';setTimeout(function(){if(cpEl)cpEl.classList.remove('active')},300);processFileAttachment(compressed);})
                                    .catch(function(){if(cpEl)cpEl.classList.remove('active');ChillUtils.showToast('خطا در فشرده‌سازی');processNext();});
                            } else {
                                processNext();
                            }
                        });
                    } else {
                        ChillUtils.showToast(validation.error);
                        processNext();
                    }
                    return;
                }
                var processFile = (typeof ChatCore !== 'undefined' && ChatCore.isImageFile(file)) ? ChatCore.compressImage(file) : Promise.resolve(file);
                processFile.then(function(finalFile) { processFileAttachment(finalFile); });
            }
            processNext();
            inlineAttachmentFile.value = '';
        };
    }

    function updateInlineSendButton() {
        if (inlineSendBtn) {
            var hasText = inlineMessageInput && inlineMessageInput.value.trim();
            var hasAttachments = inlineAttachments.length > 0;
            inlineSendBtn.disabled = (!hasText && !hasAttachments) || pendingReads > 0;
        }
    }

    // --- Socket.io ---
    function initChatSocket() {
        if (typeof ChatCore === 'undefined' || typeof io === 'undefined') return;
        var userData = JSON.parse(localStorage.getItem('userData') || 'null');
        var token = userData ? userData.token : null;
        if (!token) return;

        var socket = ChatCore.initSocket(token);
        if (!socket) return;

        ChatCore.setSocketCallbacks({
            currentRole: 'customer',
            onNewMessage: function(d) {
                if (d.conversationId === currentConversationId) {
                    loadInlineMessages();
                }
                loadConversations();
            },
            onMessageSeen: function(d) {
                if (d.conversationId === currentConversationId && d.role === 'admin') {
                    // Admin saw my messages - update ticks on customer messages
                    var ticks = inlineChatMessages.querySelectorAll('.msg-customer .msg-tick');
                    ticks.forEach(function(t) {
                        var mid = t.getAttribute('data-msg-tick');
                        if (mid && t.classList.contains('msg-sent'))
                            ChatCore.updateMessageTick(mid, 'seen');
                    });
                }
            }
        });

        if (currentConversationId) {
            ChatCore.joinConversation(currentConversationId);
        }
    }

    // --- Initialize ---
    var initializeChat = (function() {
        var initialized = false;
        return function() {
            if (initialized) return Promise.resolve();
            initialized = true;
            if (!chatPanel) return Promise.resolve();
            chatPanel.style.display = '';
            initChatSocket();
            return loadConversations().then(function() {
                if (!currentConversationId && conversationsList) {
                    var firstConv = conversationsList.querySelector('.conversation-item');
                    if (firstConv) {
                        currentConversationId = firstConv.getAttribute('data-conv-id');
                        loadInlineMessages();
                        highlightActiveConversation();
                        if (typeof ChatCore !== 'undefined') ChatCore.joinConversation(currentConversationId);
                    }
                } else if (currentConversationId) {
                    loadInlineMessages();
                    if (typeof ChatCore !== 'undefined') ChatCore.joinConversation(currentConversationId);
                }
            });
        };
    })();

    // --- Event Listeners ---
    if (supportBtn && supportModal) {
        supportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
                if (typeof redirectToLogin === 'function') redirectToLogin();
                return;
            }
            supportModal.classList.add('active');
            initializeChat();
            setTimeout(setupInlineAttachments, 100);
        });
    }

    if (supportModal) {
        var sidebarSupportBtn = document.getElementById('sidebarSupportBtn');
        var bottomSupportBtn = document.getElementById('bottomSupportBtn');
        [sidebarSupportBtn, bottomSupportBtn].forEach(function(btn) {
            if (btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
                        if (typeof redirectToLogin === 'function') redirectToLogin();
                        return;
                    }
                    supportModal.classList.add('active');
                    initializeChat();
                    setTimeout(setupInlineAttachments, 100);
                });
            }
        });

        if (newConversationBtn) {
            newConversationBtn.addEventListener('click', function() {
                createNewConversation().then(function() {
                    loadConversations().then(function() {
                        loadInlineMessages();
                        highlightActiveConversation();
                    });
                });
            });
        }

        if (inlineSendBtn) {
            inlineSendBtn.addEventListener('click', sendInlineMessage);
        }
        if (inlineMessageInput) {
            inlineMessageInput.addEventListener('input', function() {
                var len = inlineMessageInput.value.length;
                var charCounter = document.getElementById('charCounter');
                if (charCounter) charCounter.textContent = '5000/' + len;
                inlineMessageInput.style.height = 'auto';
                inlineMessageInput.style.height = Math.min(inlineMessageInput.scrollHeight, 300) + 'px';
                updateInlineSendButton();
                
                if (currentConversationId && typeof ChatCore !== 'undefined') {
                    var userData = JSON.parse(localStorage.getItem('userData') || 'null');
                    var username = userData ? userData.username : 'مهمان';
                    ChatCore.handleTyping(currentConversationId, username);
                }
            });
            inlineMessageInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendInlineMessage();
                }
            });
        }

        var closeBtn = supportModal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                supportModal.classList.remove('active');
                currentConversationId = null;
                if (inlinePolling) { clearInterval(inlinePolling); inlinePolling = null; }
            });
        }
        supportModal.addEventListener('click', function(e) {
            if (e.target === supportModal) {
                supportModal.classList.remove('active');
                currentConversationId = null;
                if (inlinePolling) { clearInterval(inlinePolling); inlinePolling = null; }
            }
        });
        supportModal.addEventListener('transitionend', function() {
            if (!supportModal.classList.contains('active')) {
                if (inlinePolling) { clearInterval(inlinePolling); inlinePolling = null; }
                currentConversationId = null;
            } else {
                if (chatPanel && chatPanel.style.display !== 'none' && !inlinePolling) {
                    inlinePolling = setInterval(loadInlineMessages, ChatCore ? ChatCore.POLL_INTERVAL : 8000);
                }
            }
        });

        if (window.visualViewport) {
            var updateAppHeight = function() {
                var vh = window.visualViewport.height;
                document.documentElement.style.setProperty('--app-height', vh + 'px');
            };
            window.visualViewport.addEventListener('resize', updateAppHeight);
            window.visualViewport.addEventListener('scroll', updateAppHeight);
            updateAppHeight();
        }
    }

    function isAuthenticated() {
        var adminData = JSON.parse(localStorage.getItem('adminData') || 'null');
        if (adminData && adminData.token) return true;
        var userData = JSON.parse(localStorage.getItem('userData') || 'null');
        return !!(userData && userData.token);
    }

    function isAdmin() {
        try {
            var d = JSON.parse(localStorage.getItem('adminData') || 'null');
            return !!(d && d.token);
        } catch(e) { return false; }
    }

    if (isAdmin()) {
        document.querySelectorAll('.admin-only').forEach(function(el) {
            el.style.display = '';
        });
    }
    document.querySelectorAll('.user-only').forEach(function(el) {
        if (isAdmin()) el.style.display = 'none';
    });

    function redirectToLogin() {
        window.location.href = '/login';
    }

    function authGuard(e) {
        if (!isAuthenticated()) {
            e.preventDefault();
            redirectToLogin();
            return false;
        }
        return true;
    }

    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', e => {
            e.preventDefault();
            if (!isAuthenticated()) {
                redirectToLogin();
                return;
            }
            const adminDataCheck = localStorage.getItem('adminData');
            const userDataCheck = localStorage.getItem('userData');
            window.location.href = adminDataCheck ? '/admin' : '/profile';
        });
    }

    document.addEventListener('click', function(e) {
        const megaLink = e.target.closest('.mega-dropdown a');
        if (megaLink) {
            authGuard(e);
        }
    });

    document.addEventListener('click', function(e) {
        const serviceBtn = e.target.closest('.service-btn');
        if (serviceBtn) {
            authGuard(e);
        }
    });

    document.addEventListener('click', function(e) {
        const bannerLink = e.target.closest('.banner-link');
        if (bannerLink) {
            authGuard(e);
        }
    });

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
             if (saveBannerBtn.disabled) return;
             saveBannerBtn.disabled = true;
             const bannerSrc = previewImg.src;
              fetch('/api/banner', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ src: bannerSrc })
              })
              .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
              .then(result => {
                  if (!result.ok) {
                      ChillUtils.showAlert(result.data.error || 'خطا در ذخیره بنر', 'error');
                      saveBannerBtn.disabled = false;
                      return;
                  }
                  const toast = document.createElement('div');
                  toast.className = 'toast';
                  toast.textContent = 'بنر با موفقیت ذخیره شد!';
                  document.body.appendChild(toast);
                  toast.classList.add('show');
                  setTimeout(() => {
                      toast.classList.remove('show');
                      setTimeout(() => toast.remove(), 300);
                  }, 3000);
                  window.location.href = '/';
              })
              .catch(() => {
                  ChillUtils.showAlert('خطا در اتصال به سرور', 'error');
                  saveBannerBtn.disabled = false;
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
                  if (type === 'image') return isImageFile(attachment);
                  return attachment.type === type;
              }).length;
          }

          function createAttachment(file, dataUrl) {
              return {
                  id: ChillUtils.generateId('att_'),
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

              if (isImageFile(attachment)) {
                  attachmentPreview.insertAdjacentHTML('beforeend', '<div class="attachment-thumbnail" data-attachment-id="' + escapeAttachmentHtml(attachment.id) + '"><img src="' + escapeAttachmentHtml(dataUrl) + '" alt="' + escapeAttachmentHtml(attachment.name) + '"><span class="upload-status"><i class="fas fa-check"></i></span><button type="button" class="remove-attachment" onclick="removeAttachment(this)"><i class="fas fa-times"></i></button></div>');
              } else {
                  var ext = (attachment.name || '').split('.').pop().toUpperCase() || 'FILE';
                  attachmentPreview.insertAdjacentHTML('beforeend', '<div class="attachment-thumbnail" data-attachment-id="' + escapeAttachmentHtml(attachment.id) + '"><div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f5f5f5;color:#667eea;font-weight:700;"><i class="fas fa-file" style="font-size:18px;margin-bottom:2px;"></i><span style="font-size:0.5rem;">' + escapeAttachmentHtml(ext) + '</span></div><span class="upload-status"><i class="fas fa-check"></i></span><button type="button" class="remove-attachment" onclick="removeAttachment(this)"><i class="fas fa-times"></i></button></div>');
              }

              attachmentPreview.classList.remove('hidden');
          }

          function addAttachmentFromFile(file) {
              if (!file || !attachmentPreview || isReadingAttachment) return;

              if (isImageFile(file) && countCurrentAttachments('image') >= 4) {
                  showAttachmentLimitToast('فقط می توان چهار فایل آپلود کرد');
                  attachmentFile.value = '';
                  return;
              }

              if (file.type === 'application/pdf' && countCurrentAttachments('application/pdf') >= 4) {
                  showAttachmentLimitToast('فقط می توان چهار فایل آپلود کرد');
                  attachmentFile.value = '';
                  return;
              }

              if (isImageFile(file)) {
                  isReadingAttachment = true;
                  var processFile;
                  if (typeof ChillUtils !== 'undefined' && typeof ChillUtils.compressImageFile === 'function') {
                      processFile = ChillUtils.compressImageFile(file, { maxSizeMB: 5 });
                  } else if (typeof ChatCore !== 'undefined' && typeof ChatCore.compressImage === 'function') {
                      processFile = ChatCore.compressImage(file, 5);
                  } else {
                      processFile = Promise.resolve(file);
                  }
                  processFile.then(function(compressedFile) {
                      var reader = new FileReader();
                      reader.onload = function(event) {
                          var attachment = createAttachment(compressedFile, event.target.result);
                          currentAttachments.push(attachment);
                          window.currentAttachments = [...currentAttachments];
                          renderAttachmentPreview(attachment, event.target.result);
                          isReadingAttachment = false;
                      };
                      reader.onerror = function() {
                          isReadingAttachment = false;
                      };
                      reader.readAsDataURL(compressedFile);
                  }).catch(function() {
                      var reader = new FileReader();
                      reader.onload = function(event) {
                          var attachment = createAttachment(file, event.target.result);
                          currentAttachments.push(attachment);
                          window.currentAttachments = [...currentAttachments];
                          renderAttachmentPreview(attachment, event.target.result);
                          isReadingAttachment = false;
                      };
                      reader.onerror = function() {
                          isReadingAttachment = false;
                      };
                      reader.readAsDataURL(file);
                  });
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
                const isImage = isImageFile(attachment);
                const safeName = escapeAttachmentHtml(attachment.name || 'فایل پیوست');
                const safeUrl = escapeAttachmentHtml(attachment.url || attachment.dataUrl);
                const jsUrl = (attachment.url || attachment.dataUrl || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const jsName = (attachment.name || 'فایل پیوست').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const preview = isImage
                    ? '<div class="popup-image-wrapper"><img src="' + safeUrl + '" alt="' + safeName + '"><button type="button" class="popup-download-icon" data-url=\'' + jsUrl + '\' data-name=\'' + jsName + '\'><i class="fas fa-download"></i></button></div>'
                    : '<div class="popup-media-wrapper"><div class="popup-pdf-icon">PDF</div><button type="button" class="popup-download-icon" data-url=\'' + jsUrl + '\' data-name=\'' + jsName + '\'><i class="fas fa-download"></i></button></div>';

                return '<div class="attachment-popup-item">' +
                    '<div class="attachment-popup-media">' + preview + '</div>' +
                    '<div class="attachment-popup-name">' + safeName + '</div>' +
                    '</div>';
            }).join('');

           popup.classList.add('active');

           grid.querySelectorAll('.popup-download-icon').forEach(function(btn) {
               btn.addEventListener('click', function() {
                   var url = this.getAttribute('data-url');
                   var name = this.getAttribute('data-name');
                   if (url) window.downloadPopupImage(url, name || 'attachment');
               });
           });
       };

        window.downloadPopupImage = function(dataUrl, filename) {
            var safeHref = safeUrl(dataUrl);
            if (!safeHref) return;
            const a = document.createElement('a');
            a.href = safeHref;
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
              .then(function(response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
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

