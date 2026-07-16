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
        location.href = 'login.html';
    } else if (type === 'user' && location.pathname.indexOf('/admin') === -1) {
        location.href = 'login.html';
    }
}

function isTokenExpired(token) {
    var payload = _parseJWT(token);
    return !payload || (payload.exp && Date.now() > payload.exp);
}

function checkAdminAuth() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem('adminData') || 'null'); } catch(e) {}
    if (!d || !d.token) { window.location.href = 'login.html'; return false; }
    if (isTokenExpired(d.token)) { localStorage.removeItem('adminData'); window.location.href = 'login.html'; return false; }
    return true;
}

function checkUserAuth() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem('userData') || 'null'); } catch(e) {}
    if (!d || !d.token) { window.location.href = 'login.html'; return false; }
    if (isTokenExpired(d.token)) { localStorage.removeItem('userData'); window.location.href = 'login.html'; return false; }
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

function escapeHtml(v) {
    return String(v || '').replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c];
    });
}

function safeUrl(url) {
    if (!url) return '';
    if (/^(https?:\/\/|data:)/i.test(url)) return url;
    return '';
}

function formatPrice(price) {
    var numStr = (price !== undefined && price !== null && price !== '') ? String(price) : '0';
    numStr = numStr.replace(/[۰-۹]/g, function(d) { return d.charCodeAt(0) - 0x06F0; });
    numStr = numStr.replace(/[,٬٫]/g, '');
    var match = numStr.match(/\d+/);
    if (!match) return numStr;
    var num = parseInt(match[0], 10);
    if (isNaN(num)) return numStr;
    var formatted = num.toLocaleString('fa-IR').replace(/[٬٫]/g, ',');
    var result = '\u202A' + numStr.replace(match[0], formatted) + '\u202C';
    return result;
}

function formatPriceInputValue(value) {
    var digits = String(value || '')
        .replace(/[۰-۹]/g, function(d) { return d.charCodeAt(0) - 0x06F0; })
        .replace(/[٠-٩]/g, function(d) { return d.charCodeAt(0) - 0x0660; })
        .replace(/\D/g, '');
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function setupPriceInputFormatting(input) {
    if (!input) return;
    input.addEventListener('input', function() {
        var caretFromEnd = input.value.length - input.selectionStart;
        var formatted = formatPriceInputValue(input.value);
        if (input.value !== formatted) {
            input.value = formatted;
            var newCaret = Math.max(0, formatted.length - caretFromEnd);
            if (input.setSelectionRange) {
                input.setSelectionRange(newCaret, newCaret);
            }
        }
    });
    input.addEventListener('blur', function() {
        input.value = formatPriceInputValue(input.value);
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
                link: 'form.html?service=کارت ملی هوشمند&cat=خدمات هویتی و قضایی',
                subItems: [
                    { title: 'کارت ملی هوشمند', link: 'form.html?service=کارت ملی هوشمند&cat=خدمات هویتی و قضایی' },
                    { title: 'المثنی کارت ملی', link: 'form.html?service=المثنی کارت ملی&cat=خدمات هویتی و قضایی' },
                    { title: 'تغییر نشانی', link: 'form.html?service=تغییر نشانی&cat=خدمات هویتی و قضایی' },
                    { title: 'شناسنامه المثنی', link: 'form.html?service=شناسنامه المثنی&cat=خدمات هویتی و قضایی' },
                    { title: 'اصلاح مشخصات', link: 'form.html?service=اصلاح مشخصات&cat=خدمات هویتی و قضایی' }
                ]
            },
            {
                title: 'گذرنامه و مهاجرت',
                icon: 'fa-passport',
                link: 'form.html?service=ثبت نام گذرنامه&cat=خدمات هویتی و قضایی',
                subItems: [
                    { title: 'ثبت نام گذرنامه', link: 'form.html?service=ثبت نام گذرنامه&cat=خدمات هویتی و قضایی' },
                    { title: 'تمدید پاسپورت', link: 'form.html?service=تمدید پاسپورت&cat=خدمات هویتی و قضایی' },
                    { title: 'المثنی گذرنامه', link: 'form.html?service=المثنی گذرنامه&cat=خدمات هویتی و قضایی' },
                    { title: 'فرم مهاجرت', link: 'form.html?service=فرم مهاجرت&cat=خدمات هویتی و قضایی' }
                ]
            },
            {
                title: 'سامانه ثنا و قضایی',
                icon: 'fa-gavel',
                link: 'form.html?service=ثبت نام ثنا&cat=خدمات هویتی و قضایی',
                subItems: [
                    { title: 'ثبت نام ثنا', link: 'form.html?service=ثبت نام ثنا&cat=خدمات هویتی و قضایی' },
                    { title: 'بازیابی رمز ثنا', link: 'form.html?service=بازیابی رمز ثنا&cat=خدمات هویتی و قضایی' },
                    { title: 'ابلاغ الکترونیک', link: 'form.html?service=ابلاغ الکترونیک&cat=خدمات هویتی و قضایی' },
                    { title: 'پیگیری پرونده', link: 'form.html?service=پیگیری پرونده&cat=خدمات هویتی و قضایی' },
                    { title: 'نوبت‌دهی قضایی', link: 'form.html?service=نوبت‌دهی قضایی&cat=خدمات هویتی و قضایی' }
                ]
            },
            {
                title: 'سوء پیشینه و استعلام‌ها',
                icon: 'fa-search',
                link: 'form.html?service=گواهی عدم سوء پیشینه&cat=خدمات هویتی و قضایی',
                subItems: [
                    { title: 'گواهی عدم سوء پیشینه', link: 'form.html?service=گواهی عدم سوء پیشینه&cat=خدمات هویتی و قضایی' },
                    { title: 'استعلام کد ملی', link: 'form.html?service=استعلام کد ملی&cat=خدمات هویتی و قضایی' },
                    { title: 'استعلام شناسنامه', link: 'form.html?service=استعلام شناسنامه&cat=خدمات هویتی و قضایی' },
                    { title: 'استعلام محکومیت', link: 'form.html?service=استعلام محکومیت&cat=خدمات هویتی و قضایی' }
                ]
            }
        ],
        finance: [
            {
                title: 'وام و تسهیلات',
                icon: 'fa-hand-holding-usd',
                link: 'form.html?service=وام ازدواج&cat=بانکی، مالی و بورسی',
                subItems: [
                    { title: 'وام ازدواج', link: 'form.html?service=وام ازدواج&cat=بانکی، مالی و بورسی' },
                    { title: 'وام ودیعه مسکن', link: 'form.html?service=وام ودیعه مسکن&cat=بانکی، مالی و بورسی' },
                    { title: 'وام ضروری', link: 'form.html?service=وام ضروری&cat=بانکی، مالی و بورسی' },
                    { title: 'تسهیلات خرید مسکن', link: 'form.html?service=تسهیلات خرید مسکن&cat=بانکی، مالی و بورسی' }
                ]
            },
            {
                title: 'یارانه و سهام عدالت',
                icon: 'fa-hand-holding-heart',
                link: 'form.html?service=یارانه معیشتی&cat=بانکی، مالی و بورسی',
                subItems: [
                    { title: 'یارانه معیشتی', link: 'form.html?service=یارانه معیشتی&cat=بانکی، مالی و بورسی' },
                    { title: 'اعتراض یارانه', link: 'form.html?service=اعتراض یارانه&cat=بانکی، مالی و بورسی' },
                    { title: 'سهام عدالت', link: 'form.html?service=سهام عدالت&cat=بانکی، مالی و بورسی' },
                    { title: 'فروش سهام', link: 'form.html?service=فروش سهام&cat=بانکی، مالی و بورسی' }
                ]
            },
            {
                title: 'بورس و سجام',
                icon: 'fa-chart-line',
                link: 'form.html?service=ثبت سجام&cat=بانکی، مالی و بورسی',
                subItems: [
                    { title: 'ثبت سجام', link: 'form.html?service=ثبت سجام&cat=بانکی، مالی و بورسی' },
                    { title: 'احراز هویت بورسی', link: 'form.html?service=احراز هویت بورسی&cat=بانکی، مالی و بورسی' },
                    { title: 'افتتاح کد بورسی', link: 'form.html?service=افتتاح کد بورسی&cat=بانکی، مالی و بورسی' }
                ]
            },
            {
                title: 'خدمات بانکی',
                icon: 'fa-wallet',
                link: 'form.html?service=افتتاح حساب&cat=بانکی، مالی و بورسی',
                subItems: [
                    { title: 'افتتاح حساب', link: 'form.html?service=افتتاح حساب&cat=بانکی، مالی و بورسی' },
                    { title: 'احراز هویت بانک', link: 'form.html?service=احراز هویت بانک&cat=بانکی، مالی و بورسی' },
                    { title: 'اعتبارسنجی مرآت', link: 'form.html?service=اعتبارسنجی مرآت&cat=بانکی، مالی و بورسی' },
                    { title: 'پرداخت آنلاین', link: 'form.html?service=پرداخت آنلاین&cat=بانکی، مالی و بورسی' }
                ]
            }
        ],
        automotive: [
            {
                title: 'کارت سوخت',
                icon: 'fa-gas-pump',
                link: 'form.html?service=صدور کارت سوخت&cat=خودرو و حمل و نقل',
                subItems: [
                    { title: 'صدور کارت سوخت', link: 'form.html?service=صدور کارت سوخت&cat=خودرو و حمل و نقل' },
                    { title: 'المثنی کارت سوخت', link: 'form.html?service=المثنی کارت سوخت&cat=خودرو و حمل و نقل' },
                    { title: 'انتقال کارت سوخت', link: 'form.html?service=انتقال کارت سوخت&cat=خودرو و حمل و نقل' }
                ]
            },
            {
                title: 'تعویض پلاک و خودرو',
                icon: 'fa-ticket-alt',
                link: 'form.html?service=نوبت تعویض پلاک&cat=خودرو و حمل و نقل',
                subItems: [
                    { title: 'نوبت تعویض پلاک', link: 'form.html?service=نوبت تعویض پلاک&cat=خودرو و حمل و نقل' },
                    { title: 'نقل و انتقال خودرو', link: 'form.html?service=نقل و انتقال خودرو&cat=خودرو و حمل و نقل' },
                    { title: 'مالیات نقل و انتقال', link: 'form.html?service=مالیات نقل و انتقال&cat=خودرو و حمل و نقل' }
                ]
            },
            {
                title: 'جریمه و معاینه فنی',
                icon: 'fa-exclamation-triangle',
                link: 'form.html?service=استعلام خلافی&cat=خودرو و حمل و نقل',
                subItems: [
                    { title: 'استعلام خلافی', link: 'form.html?service=استعلام خلافی&cat=خودرو و حمل و نقل' },
                    { title: 'پرداخت جریمه', link: 'form.html?service=پرداخت جریمه&cat=خودرو و حمل و نقل' },
                    { title: 'اعتراض جریمه', link: 'form.html?service=اعتراض جریمه&cat=خودرو و حمل و نقل' },
                    { title: 'نوبت معاینه فنی', link: 'form.html?service=نوبت معاینه فنی&cat=خودرو و حمل و نقل' }
                ]
            },
            {
                title: 'ثبت نام خودرو',
                icon: 'fa-car',
                link: 'form.html?service=ثبت نام خودرو ایران خودرو&cat=خودرو و حمل و نقل',
                subItems: [
                    { title: 'ایران خودرو', link: 'form.html?service=ثبت نام خودرو ایران خودرو&cat=خودرو و حمل و نقل' },
                    { title: 'سایپا', link: 'form.html?service=ثبت نام خودرو سایپا&cat=خودرو و حمل و نقل' },
                    { title: 'سامانه یکپارچه', link: 'form.html?service=سامانه یکپارچه&cat=خودرو و حمل و نقل' },
                    { title: 'انتخاب خودرو', link: 'form.html?service=انتخاب خودرو&cat=خودرو و حمل و نقل' }
                ]
            },
            {
                title: 'خدمات شهری',
                icon: 'fa-city',
                link: 'form.html?service=تهران من&cat=خودرو و حمل و نقل',
                subItems: [
                    { title: 'تهران من', link: 'form.html?service=تهران من&cat=خودرو و حمل و نقل' },
                    { title: 'یارانه سوخت وانت', link: 'form.html?service=یارانه سوخت وانت&cat=خودرو و حمل و نقل' }
                ]
            }
        ],
        education: [
            {
                title: 'مدارس',
                icon: 'fa-school',
                link: 'form.html?service=پیش ثبت نام مدارس&cat=آموزش و آزمون‌ها',
                subItems: [
                    { title: 'پیش ثبت نام مدارس', link: 'form.html?service=پیش ثبت نام مدارس&cat=آموزش و آزمون‌ها' },
                    { title: 'مدارس شاهد', link: 'form.html?service=مدارس شاهد&cat=آموزش و آزمون‌ها' },
                    { title: 'مدارس تیزهوشان', link: 'form.html?service=مدارس تیزهوشان&cat=آموزش و آزمون‌ها' },
                    { title: 'مدارس غیردولتی', link: 'form.html?service=مدارس غیردولتی&cat=آموزش و آزمون‌ها' }
                ]
            },
            {
                title: 'دانشگاه‌ها',
                icon: 'fa-university',
                link: 'form.html?service=ثبت نام دانشگاه آزاد&cat=آموزش و آزمون‌ها',
                subItems: [
                    { title: 'دانشگاه آزاد', link: 'form.html?service=ثبت نام دانشگاه آزاد&cat=آموزش و آزمون‌ها' },
                    { title: 'پیام نور', link: 'form.html?service=ثبت نام پیام نور&cat=آموزش و آزمون‌ها' },
                    { title: 'علمی کاربردی', link: 'form.html?service=ثبت نام علمی کاربردی&cat=آموزش و آزمون‌ها' },
                    { title: 'ثبت نام غیرحضوری', link: 'form.html?service=ثبت نام غیرحضوری&cat=آموزش و آزمون‌ها' }
                ]
            },
            {
                title: 'کنکور و آزمون‌ها',
                icon: 'fa-graduation-cap',
                link: 'form.html?service=کنکور سراسری&cat=آموزش و آزمون‌ها',
                subItems: [
                    { title: 'کنکور سراسری', link: 'form.html?service=کنکور سراسری&cat=آموزش و آزمون‌ها' },
                    { title: 'ارشد', link: 'form.html?service=ارشد&cat=آموزش و آزمون‌ها' },
                    { title: 'دکتری', link: 'form.html?service=دکتری&cat=آموزش و آزمون‌ها' }
                ]
            },
            {
                title: 'آزمون‌های استخدامی',
                icon: 'fa-file-alt',
                link: 'form.html?service=آزمون استخدامی آموزش و پرورش&cat=آموزش و آزمون‌ها',
                subItems: [
                    { title: 'آموزش و پرورش', link: 'form.html?service=آزمون استخدامی آموزش و پرورش&cat=آموزش و آزمون‌ها' },
                    { title: 'بانک‌ها', link: 'form.html?service=آزمون استخدامی بانک‌ها&cat=آموزش و آزمون‌ها' },
                    { title: 'دستگاه‌های دولتی', link: 'form.html?service=آزمون استخدامی دستگاه‌های دولتی&cat=آموزش و آزمون‌ها' }
                ]
            },
            {
                title: 'خدمات دانشجویی',
                icon: 'fa-user-graduate',
                link: 'form.html?service=سامانه‌های آموزشی&cat=آموزش و آزمون‌ها',
                subItems: [
                    { title: 'سامانه‌های آموزشی', link: 'form.html?service=سامانه‌های آموزشی&cat=آموزش و آزمون‌ها' },
                    { title: 'وام دانشجویی', link: 'form.html?service=وام دانشجویی&cat=آموزش و آزمون‌ها' }
                ]
            }
        ],
        'business-tax': [
            {
                title: 'مالیات',
                icon: 'fa-file-invoice-dollar',
                link: 'form.html?service=اظهارنامه مالیاتی&cat=مالیات، مجوز و کسب‌وکار',
                subItems: [
                    { title: 'اظهارنامه مالیاتی', link: 'form.html?service=اظهارنامه مالیاتی&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'تبصره ۱۰۰', link: 'form.html?service=تبصره ۱۰۰&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'ارزش افزوده', link: 'form.html?service=ارزش افزوده&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'اعتراض مالیاتی', link: 'form.html?service=اعتراض مالیاتی&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'کد اقتصادی', link: 'form.html?service=کد اقتصادی&cat=مالیات، مجوز و کسب‌وکار' }
                ]
            },
            {
                title: 'ثبت و تغییرات شرکت',
                icon: 'fa-building',
                link: 'form.html?service=ثبت شرکت&cat=مالیات، مجوز و کسب‌وکار',
                subItems: [
                    { title: 'ثبت شرکت', link: 'form.html?service=ثبت شرکت&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'ثبت برند', link: 'form.html?service=ثبت برند&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'تغییرات شرکت', link: 'form.html?service=تغییرات شرکت&cat=مالیات، مجوز و کسب‌وکار' }
                ]
            },
            {
                title: 'مجوزها',
                icon: 'fa-certificate',
                link: 'form.html?service=سامانه ملی مجوزها&cat=مالیات، مجوز و کسب‌وکار',
                subItems: [
                    { title: 'سامانه ملی مجوزها', link: 'form.html?service=سامانه ملی مجوزها&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'جواز کسب', link: 'form.html?service=جواز کسب&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'مجوز صنفی', link: 'form.html?service=مجوز صنفی&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'مجوز تولیدی', link: 'form.html?service=مجوز تولیدی&cat=مالیات، مجوز و کسب‌وکار' }
                ]
            },
            {
                title: 'اصناف و اماکن',
                icon: 'fa-store',
                link: 'form.html?service=نوین اصناف&cat=مالیات، مجوز و کسب‌وکار',
                subItems: [
                    { title: 'نوین اصناف', link: 'form.html?service=نوین اصناف&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'بازدید اماکن', link: 'form.html?service=بازدید اماکن&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'صلاحیت بهداشتی', link: 'form.html?service=صلاحیت بهداشتی&cat=مالیات، مجوز و کسب‌وکار' },
                    { title: 'گواهی مالیاتی ۱۸۶', link: 'form.html?service=گواهی مالیاتی ۱۸۶&cat=مالیات، مجوز و کسب‌وکار' }
                ]
            }
        ],
        'government-services': [
            {
                title: 'سامانه‌های عمومی',
                icon: 'fa-landmark',
                link: 'form.html?service=میخک&cat=سامانه‌های دولتی',
                subItems: [
                    { title: 'میخک', link: 'form.html?service=میخک&cat=سامانه‌های دولتی' },
                    { title: 'سخا', link: 'form.html?service=سخا&cat=سامانه‌های دولتی' },
                    { title: 'شمس', link: 'form.html?service=شمس&cat=سامانه‌های دولتی' },
                    { title: 'ستاد ایران', link: 'form.html?service=ستاد ایران&cat=سامانه‌های دولتی' }
                ]
            },
            {
                title: 'املاک و اسکان',
                icon: 'fa-home',
                link: 'form.html?service=ثبت‌نام املاک و اسکان&cat=سامانه‌های دولتی',
                subItems: [
                    { title: 'ثبت‌نام املاک و اسکان', link: 'form.html?service=ثبت‌نام املاک و اسکان&cat=سامانه‌های دولتی' },
                    { title: 'خودنویس', link: 'form.html?service=خودنویس&cat=سامانه‌های دولتی' },
                    { title: 'ثبت سند ملکی', link: 'form.html?service=ثبت سند ملکی&cat=سامانه‌های دولتی' }
                ]
            },
            {
                title: 'تأمین اجتماعی و بیمه',
                icon: 'fa-shield-alt',
                link: 'form.html?service=نام نویسی کارفرما&cat=سامانه‌های دولتی',
                subItems: [
                    { title: 'نام نویسی کارفرما', link: 'form.html?service=نام نویسی کارفرما&cat=سامانه‌های دولتی' },
                    { title: 'ثبت نیروی کار', link: 'form.html?service=ثبت نیروی کار&cat=سامانه‌های دولتی' },
                    { title: 'ارسال لیست بیمه', link: 'form.html?service=ارسال لیست بیمه&cat=سامانه‌های دولتی' },
                    { title: 'بیمه با سابقه', link: 'form.html?service=بیمه با سابقه&cat=سامانه‌های دولتی' },
                    { title: 'کمیسیون پزشکی', link: 'form.html?service=کمیسیون پزشکی&cat=سامانه‌های دولتی' },
                    { title: 'کمک هزینه عینک', link: 'form.html?service=کمک هزینه عینک&cat=سامانه‌های دولتی' },
                    { title: 'کمک هزینه سمعک', link: 'form.html?service=کمک هزینه سمعک&cat=سامانه‌های دولتی' }
                ]
            },
            {
                title: 'خدمات توکن',
                icon: 'fa-key',
                link: 'form.html?service=راه‌اندازی توکن&cat=سامانه‌های دولتی',
                subItems: [
                    { title: 'راه‌اندازی توکن', link: 'form.html?service=راه‌اندازی توکن&cat=سامانه‌های دولتی' },
                    { title: 'امضا در ثبت من', link: 'form.html?service=امضا در ثبت من&cat=سامانه‌های دولتی' },
                    { title: 'امضای نرم‌افزاری', link: 'form.html?service=امضای نرم‌افزاری&cat=سامانه‌های دولتی' }
                ]
            },
            {
                title: 'خدمات انتخاباتی',
                icon: 'fa-vote-yea',
                link: 'form.html?service=رأی اولی‌ها&cat=سامانه‌های دولتی',
                subItems: [
                    { title: 'رأی اولی‌ها', link: 'form.html?service=رأی اولی‌ها&cat=سامانه‌های دولتی' },
                    { title: 'تعیین شعبه', link: 'form.html?service=تعیین شعبه&cat=سامانه‌های دولتی' },
                    { title: 'تأیید صلاحیت', link: 'form.html?service=تأیید صلاحیت&cat=سامانه‌های دولتی' }
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
                    alert(result.data.error || 'خطا در ثبت سفارش');
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ثبت سفارش'; }
                    return;
                }
                localStorage.setItem('lastTrackingCode', result.data.trackingCode);
                await window.uploadAttachmentsForTrackingCode(result.data.trackingCode, currentAttachments);
                await saveAttachmentsAfterSubmit(result.data.trackingCode);
                window.location.href = 'review.html';
            })
            .catch(async () => {
                alert('خطا در اتصال به سرور. لطفاً دوباره تلاش کنید.');
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
                alert('رمز عبور و تکرار آن مطابقت ندارند!');
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
                    alert(result.data.error || 'خطا در ثبت نام');
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ثبت نام'; }
                    return;
                }
                localStorage.setItem('userData', JSON.stringify({ username: username, token: result.data.token }));
                window.location.href = 'index.html';
            })
            .catch(function() {
                alert('خطا در اتصال به سرور');
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
                    window.location.href = 'admin.html';
                } else if (result.data.error && result.data.error.indexOf('قفل') !== -1) {
                    alert(result.data.error);
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
                            window.location.href = 'index.html';
                        } else {
                            alert(result2.data.error || 'نام کاربری یا رمز عبور اشتباه است!');
                            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ورود'; }
                        }
                    })
                    .catch(function() {
                        alert('خطا در اتصال به سرور.');
                        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ورود'; }
                    });
                }
            })
            .catch(function() {
                alert('خطا در اتصال به سرور. لطفاً دوباره تلاش کنید.');
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
        window.location.href = 'login.html';
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
            window.location.href = 'login.html';
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => {
            e.preventDefault();
            fetch('/api/logout', { method: 'POST' }).catch(function(){});
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
            .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
            .then(function(result) {
                if (result.ok && result.data.success) {
                    window.location.href = 'success.html';
                } else {
                    alert(result.data.error || 'خطا در تایید پرداخت');
                    confirmPaymentBtn.disabled = false;
                    confirmPaymentBtn.textContent = 'تایید و پرداخت';
                }
            })
            .catch(function() {
                alert('خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.');
                confirmPaymentBtn.disabled = false;
                confirmPaymentBtn.textContent = 'تایید و پرداخت';
            });
        });
    }

    const supportBtn = document.getElementById('supportBtn');
    const supportModal = document.getElementById('supportModal');
    const chatPanel = document.getElementById('chatPanel');
    const inlineChatMessages = document.getElementById('inlineChatMessages');
    const inlineMessageInput = document.getElementById('inlineMessageInput');
    const inlineSendBtn = document.getElementById('inlineSendBtn');
    const newConversationBtn = document.getElementById('newConversationBtn');
    const conversationsList = document.getElementById('conversationsList');
    let currentConversationId = null;
    let inlinePolling = null;
    let conversationsData = [];
    let inlineAttachments = [];
    var pendingReads = 0;
    var activeReaders = {};
    let inlineAttachmentPreview = null;
    let inlinePinAttachment = null;
    let inlineAttachmentFile = null;

    function initializeChat() {
        if (!chatPanel) return Promise.resolve();
        chatPanel.style.display = '';
        return loadConversations().then(function() {
            if (!currentConversationId && conversationsList) {
                var firstConv = conversationsList.querySelector('.conversation-item');
                if (!firstConv) {
                    return createNewConversation().then(function() {
                        loadInlineMessages();
                        highlightActiveConversation();
                    });
                } else {
                    currentConversationId = firstConv.getAttribute('data-conv-id');
                    loadInlineMessages();
                    highlightActiveConversation();
                }
            } else {
                loadInlineMessages();
            }
        });
    }

    function createNewConversation() {
        var userData = JSON.parse(localStorage.getItem('userData') || 'null');
        var username = userData ? userData.username : 'مهمان';
        return fetch('/api/chat/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username })
        })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(result) {
            if (!result.ok || !result.data.id) {
                throw new Error('خطا در ایجاد گفتگو');
            }
            currentConversationId = result.data.id;
            return result.data;
        })
        .catch(function(err) {
            console.error('خطا در ایجاد گفتگو:', err);
            currentConversationId = 'conv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            return { id: currentConversationId };
        });
    }

    function loadConversations() {
        if (!conversationsList) return Promise.resolve();
        var userData = JSON.parse(localStorage.getItem('userData') || 'null');
        var username = userData ? userData.username : 'مهمان';
        return fetch('/api/chat/conversations?username=' + encodeURIComponent(username))
            .then(function(r) {
                if (r.status === 404 || !r.ok) return [];
                return r.json().catch(function(){ return []; });
            })
            .then(function(convs) {
                conversationsData = convs || [];
                conversationsList.innerHTML = '';
                if (convs.length === 0) {
                    conversationsList.innerHTML = '<div style="color:#999;font-size:0.85rem;text-align:center;padding:1rem;">هیچ گفتگویی وجود ندارد</div>';
                    return;
                }
                convs.forEach(function(c) {
                    var div = document.createElement('div');
                    div.className = 'conversation-item';
                    if (c.id === currentConversationId) div.classList.add('active');
                    div.setAttribute('data-conv-id', c.id);
                    var dateStr = c.lastTimestamp ? new Date(c.lastTimestamp).toLocaleDateString('fa-IR') : '';
                    var preview = c.lastMessage && c.lastMessage.length > 30 ? c.lastMessage.substring(0, 30) + '...' : (c.lastMessage || 'گفتگوی جدید');
                    div.innerHTML = '<div class="conv-title" title="' + escapeHtml(c.lastMessage || '') + '">' + escapeHtml(preview) + '</div><div class="conv-date">' + dateStr + '</div>';
                    div.addEventListener('click', function() {
                        currentConversationId = c.id;
                        loadInlineMessages();
                        highlightActiveConversation();
                    });
                    conversationsList.appendChild(div);
                });
            })
            .catch(function() {
                conversationsList.innerHTML = '<div style="color:#e74c3c;font-size:0.85rem;text-align:center;padding:1rem;">خطا در بارگذاری گفتگوها</div>';
            });
    }

    function highlightActiveConversation() {
        if (!conversationsList) return;
        var items = conversationsList.querySelectorAll('.conversation-item');
        items.forEach(function(item) {
            item.classList.remove('active');
            if (item.getAttribute('data-conv-id') === currentConversationId) {
                item.classList.add('active');
            }
        });
    }

    function updateInlineSendButton() {
        if (inlineSendBtn) {
            var hasText = inlineMessageInput && inlineMessageInput.value.trim();
            var hasAttachments = inlineAttachments.length > 0;
            inlineSendBtn.disabled = (!hasText && !hasAttachments) || pendingReads > 0;
        }
    }

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

        if (!document.getElementById('uploadProgressStyles')) {
            var style = document.createElement('style');
            style.id = 'uploadProgressStyles';
            style.textContent = '.attachment-thumbnail.uploading{position:relative}.upload-progress-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,0.85);border-radius:6px;z-index:5}.upload-progress-ring{filter:drop-shadow(0 1px 2px rgba(0,0,0,0.1))}.upload-progress-ring circle:first-child{stroke:#e5e7eb}.upload-progress-ring .upload-progress-circle{transition:stroke-dashoffset 0.15s ease-out;stroke:#667eea}.upload-progress-text{font-size:0.6rem;font-weight:700;color:#667eea;margin-top:2px}.upload-cancel-btn{position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:#e74c3c;color:#fff;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;z-index:10;box-shadow:0 1px 3px rgba(0,0,0,0.25);transition:transform 0.15s}.upload-cancel-btn:hover{transform:scale(1.15)}';
            document.head.appendChild(style);
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
            inlineAttachmentFile.accept = 'image/*,.pdf';
            inlineAttachmentFile.style.display = 'none';
            inlineAttachmentFile.multiple = true;
            document.body.appendChild(inlineAttachmentFile);
        }

        inlinePinAttachment.addEventListener('click', function() {
            inlineAttachmentFile.click();
        });
        inlineAttachmentFile.addEventListener('change', function(e) {
            var files = Array.from(e.target.files || []);
            var remaining = 4 - inlineAttachments.length - pendingReads;
            if (remaining <= 0) {
                alert('فقط می توان چهار فایل آپلود کرد');
                inlineAttachmentFile.value = '';
                return;
            }
            var toAdd = files.slice(0, remaining);
            if (files.length > remaining) {
                alert('فقط می توان چهار فایل آپلود کرد. ' + (files.length - remaining) + ' فایل حذف شد.');
            }
            toAdd.forEach(function(file) {
                var attId = 'att_' + Date.now() + '_' + Math.random().toString(16).slice(2);
                var isImage = file.type && file.type.startsWith('image/');

                var html = '<div class="attachment-thumbnail uploading" data-attachment-id="' + escapeHtml(attId) + '">';
                if (isImage) {
                    html += '<img src="" alt="' + escapeHtml(file.name) + '" style="opacity:0.3">';
                } else {
                    html += '<div class="pdf-icon" style="opacity:0.3">PDF</div>';
                }
                html += '<div class="upload-progress-overlay"><svg class="upload-progress-ring" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" stroke-width="3"/><circle class="upload-progress-circle" data-progress-ring="' + attId + '" cx="18" cy="18" r="14" fill="none" stroke="#667eea" stroke-width="3" stroke-dasharray="87.96" stroke-dashoffset="87.96" transform="rotate(-90 18 18)" stroke-linecap="round"/></svg><span class="upload-progress-text" data-progress-text="' + attId + '">0%</span></div>';
                html += '<button type="button" class="remove-attachment upload-cancel-btn" data-cancel-reader="' + attId + '"><i class="fas fa-times"></i></button>';
                html += '</div>';
                inlineAttachmentPreview.insertAdjacentHTML('beforeend', html);
                inlineAttachmentPreview.classList.remove('hidden');

                if (isImage) {
                    var previewReader = new FileReader();
                    previewReader.onload = function(ev) {
                        var img = inlineAttachmentPreview.querySelector('[data-attachment-id="' + attId + '"] img');
                        if (img) { img.src = ev.target.result; img.style.opacity = '1'; }
                    };
                    previewReader.readAsDataURL(file);
                }

                pendingReads++;
                updateInlineSendButton();

                var reader = new FileReader();
                activeReaders[attId] = reader;

                reader.onprogress = function(ev) {
                    if (ev.lengthComputable) {
                        var pct = Math.round((ev.loaded / ev.total) * 100);
                        var circle = document.querySelector('[data-progress-ring="' + attId + '"]');
                        var text = document.querySelector('[data-progress-text="' + attId + '"]');
                        if (circle) circle.style.strokeDashoffset = (87.96 * (1 - pct / 100));
                        if (text) text.textContent = pct + '%';
                    }
                };

                reader.onload = function(ev) {
                    var att = {
                        id: attId,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        dataUrl: ev.target.result,
                        uploadedAt: new Date().toISOString()
                    };
                    inlineAttachments.push(att);
                    var thumb = inlineAttachmentPreview.querySelector('[data-attachment-id="' + attId + '"]');
                    if (thumb) thumb.remove();
                    renderInlineAttachmentPreview(att, ev.target.result);
                    delete activeReaders[attId];
                    pendingReads--;
                    updateInlineSendButton();
                };

                reader.onerror = function() {
                    var thumb = inlineAttachmentPreview.querySelector('[data-attachment-id="' + attId + '"]');
                    if (thumb) thumb.remove();
                    delete activeReaders[attId];
                    pendingReads--;
                    updateInlineSendButton();
                    showToast('خطا در خواندن فایل');
                };

                reader.readAsDataURL(file);
            });
            inlineAttachmentFile.value = '';
        });

        inlineAttachmentPreview.addEventListener('click', function(e) {
            var cancelBtn = e.target.closest('[data-cancel-reader]');
            if (cancelBtn) {
                var attId = cancelBtn.getAttribute('data-cancel-reader');
                if (activeReaders[attId]) {
                    activeReaders[attId].abort();
                    delete activeReaders[attId];
                }
                var thumb = inlineAttachmentPreview.querySelector('[data-attachment-id="' + attId + '"]');
                if (thumb) thumb.remove();
                pendingReads--;
                updateInlineSendButton();
            }
        });
    }

    function renderInlineAttachmentPreview(attachment, dataUrl) {
        if (!inlineAttachmentPreview) return;
        var isImage = attachment.type && attachment.type.startsWith('image/');
        var html = '<div class="attachment-thumbnail" data-attachment-id="' + escapeHtml(attachment.id) + '">';
        if (isImage) {
            html += '<img src="' + escapeHtml(dataUrl) + '" alt="' + escapeHtml(attachment.name) + '">';
        } else {
            html += '<div class="pdf-icon">PDF</div>';
        }
        html += '<span class="upload-status"><i class="fas fa-check"></i></span>';
        html += '<button type="button" class="remove-attachment" onclick="window.removeInlineAttachment(this)"><i class="fas fa-times"></i></button>';
        html += '</div>';
        inlineAttachmentPreview.insertAdjacentHTML('beforeend', html);
        inlineAttachmentPreview.classList.remove('hidden');
    }

    window.removeInlineAttachment = function(button) {
        var thumbnail = button.closest('.attachment-thumbnail');
        if (thumbnail) {
            var attachmentId = thumbnail.getAttribute('data-attachment-id');
            if (activeReaders[attachmentId]) {
                activeReaders[attachmentId].abort();
                delete activeReaders[attachmentId];
                pendingReads--;
            }
            inlineAttachments = inlineAttachments.filter(function(a) {
                return a.id !== attachmentId;
            });
            thumbnail.remove();
            updateInlineSendButton();
        }
        if (inlineAttachmentPreview && inlineAttachmentPreview.querySelectorAll('.attachment-thumbnail').length === 0) {
            inlineAttachmentPreview.classList.add('hidden');
        }
    };

    window.downloadInlineAttachment = function(attachmentId) {
        var attachment = inlineAttachments.find(function(a) { return a.id === attachmentId; });
        if (!attachment) return;
        var a = document.createElement('a');
        a.href = safeUrl(attachment.dataUrl);
        a.download = attachment.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    function loadInlineMessages() {
        if (!inlineChatMessages) return;
        var userData = JSON.parse(localStorage.getItem('userData') || 'null');
        var username = userData ? userData.username : 'مهمان';

        function renderMessages(messages) {
            if (!messages || messages.length === 0) {
                messages = [];
            }
            inlineChatMessages.innerHTML = '';
            messages.forEach(function(msg) {
                var div = document.createElement('div');
                div.className = 'message ' + (msg.role === 'admin' ? 'support' : 'user');
                var bubble = document.createElement('div');
                bubble.className = 'bubble';
                bubble.textContent = msg.text;
                div.appendChild(bubble);
                if (msg.attachments && msg.attachments.length > 0) {
                    var attContainer = document.createElement('div');
                    attContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-top: 0.5rem;';
                    msg.attachments.forEach(function(att) {
                        var thumb = document.createElement('div');
                        thumb.className = 'attachment-thumbnail';
                        thumb.style.cssText = 'width: 80px; height: 80px; cursor: pointer;';
                        if (att.type && att.type.startsWith('image/')) {
                            var img = document.createElement('img');
                            img.src = att.dataUrl || att.url || '';
                            img.alt = att.name;
                            img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 8px;';
                            thumb.appendChild(img);
                        } else {
                            thumb.innerHTML = '<div class="pdf-icon" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #667eea; font-weight: 700; font-size: 0.6rem; border-radius: 8px;">PDF</div>';
                        }
                        thumb.addEventListener('click', function() {
                            if (att.dataUrl) {
                                var safeHref = safeUrl(att.dataUrl);
                                if (safeHref) {
                                    var a = document.createElement('a');
                                    a.href = safeHref;
                                    a.download = att.name;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                }
                            }
                        });
                        attContainer.appendChild(thumb);
                    });
                    div.appendChild(attContainer);
                }
                inlineChatMessages.appendChild(div);
            });
            inlineChatMessages.scrollTop = inlineChatMessages.scrollHeight;
            if (messages.length === 0) {
                var emptyDiv = document.createElement('div');
                emptyDiv.style.cssText = 'text-align:center;color:#999;padding:1rem;';
                emptyDiv.textContent = 'هیچ پیامی وجود ندارد';
                inlineChatMessages.appendChild(emptyDiv);
            }
        }

        if (currentConversationId) {
            fetch('/api/chat/conversation/' + currentConversationId + '?username=' + encodeURIComponent(username))
                .then(function(r) {
                    if (r.status === 404 || !r.ok) return [];
                    return r.json().catch(function(){ return []; });
                })
                .then(function(messages) {
                    renderMessages(messages);
                })
                .catch(function(err) {
                    console.error('خطا در بارگذاری پیام‌ها:', err);
                    if (inlineChatMessages && inlineChatMessages.children.length === 0) {
                        var errDiv = document.createElement('div');
                        errDiv.style.cssText = 'text-align:center;color:#e74c3c;padding:1rem;';
                        errDiv.textContent = 'خطا در بارگذاری پیام‌ها';
                        inlineChatMessages.appendChild(errDiv);
                    }
                });
        } else {
            fetch('/api/chat?username=' + encodeURIComponent(username))
                .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                .then(function(messages) {
                    renderMessages(messages);
                })
                .catch(function(err) {
                    console.error('خطا در بارگذاری پیام‌ها:', err);
                    if (inlineChatMessages && inlineChatMessages.children.length === 0) {
                        var errDiv = document.createElement('div');
                        errDiv.style.cssText = 'text-align:center;color:#e74c3c;padding:1rem;';
                        errDiv.textContent = 'خطا در بارگذاری پیام‌ها';
                        inlineChatMessages.appendChild(errDiv);
                    }
                });
        }
    }

    function sendInlineMessage() {
        if (!inlineMessageInput) return;
        var text = inlineMessageInput.value.trim();
        if (!text && inlineAttachments.length === 0) return;
        if (pendingReads > 0) return;
        if (inlineSendBtn && inlineSendBtn.disabled) return;

        function doSend(conversationId) {
            var userData = JSON.parse(localStorage.getItem('userData') || 'null');
            var username = userData ? userData.username : 'مهمان';
            if (inlineSendBtn) { inlineSendBtn.disabled = true; }
            fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    text: text,
                    conversationId: conversationId,
                    attachments: inlineAttachments
                })
            }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
              .then(function(result) {
                  if (!result.ok) {
                      alert(result.data.error || 'خطا در ارسال پیام');
                      if (inlineSendBtn) { inlineSendBtn.disabled = false; }
                      return;
                  }
                  inlineMessageInput.value = '';
                  inlineAttachments = [];
                  if (inlineAttachmentPreview) {
                      inlineAttachmentPreview.innerHTML = '';
                      inlineAttachmentPreview.classList.add('hidden');
                  }
                  if (inlineSendBtn) { inlineSendBtn.disabled = false; }
                  loadInlineMessages();
                  loadConversations();
              })
              .catch(function(err) {
                  console.error('خطا در ارسال پیام:', err);
                  alert('خطا در ارسال پیام');
                  if (inlineSendBtn) { inlineSendBtn.disabled = false; }
              });
        }

        if (!currentConversationId) {
            createNewConversation().then(function(conv) {
                doSend(conv.id);
            });
        } else {
            doSend(currentConversationId);
        }
    }

    if (supportBtn && supportModal) {
        supportBtn.addEventListener('click', e => {
            e.preventDefault();
            if (!isAuthenticated()) {
                redirectToLogin();
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
                    if (!isAuthenticated()) {
                        redirectToLogin();
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
                if (currentConversationId && conversationsData.some(function(c) { 
                    return c.id === currentConversationId && c.messageCount === 0; 
                })) {
                    loadInlineMessages();
                    highlightActiveConversation();
                    return;
                }
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
            inlineMessageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') sendInlineMessage();
            });
            inlineMessageInput.addEventListener('input', function() {
                var len = inlineMessageInput.value.length;
                var charCounter = document.getElementById('charCounter');
                if (charCounter) {
                    charCounter.textContent = '5000/' + len;
                }
                inlineMessageInput.style.height = 'auto';
                inlineMessageInput.style.height = Math.min(inlineMessageInput.scrollHeight, 300) + 'px';
                if (inlineSendBtn) {
                    inlineSendBtn.disabled = !inlineMessageInput.value.trim() && inlineAttachments.length === 0;
                }
            });
        }

        const closeBtn = supportModal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                supportModal.classList.remove('active');
                currentConversationId = null;
                if (inlinePolling) { clearInterval(inlinePolling); inlinePolling = null; }
            });
        }

        supportModal.addEventListener('click', e => {
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
                    inlinePolling = setInterval(loadInlineMessages, 8000);
                }
            }
        });

        if (chatPanel && !inlinePolling) {
            chatPanel.addEventListener('transitionend', function() {
                if (chatPanel.style.display !== 'none' && !inlinePolling) {
                    inlinePolling = setInterval(loadInlineMessages, 8000);
                }
            });
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
        window.location.href = 'login.html';
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
            window.location.href = adminDataCheck ? 'admin.html' : 'profile.html';
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
                      alert(result.data.error || 'خطا در ذخیره بنر');
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
                  window.location.href = 'index.html';
              })
              .catch(() => {
                  alert('خطا در اتصال به سرور');
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
                  attachmentPreview.insertAdjacentHTML('beforeend', '<div class="attachment-thumbnail" data-attachment-id="' + escapeAttachmentHtml(attachment.id) + '"><img src="' + escapeAttachmentHtml(dataUrl) + '" alt="' + escapeAttachmentHtml(attachment.name) + '"><span class="upload-status"><i class="fas fa-check"></i></span><button type="button" class="remove-attachment" onclick="removeAttachment(this)"><i class="fas fa-times"></i></button></div>');
              } else {
                  attachmentPreview.insertAdjacentHTML('beforeend', '<div class="attachment-thumbnail" data-attachment-id="' + escapeAttachmentHtml(attachment.id) + '"><div class="pdf-icon">PDF</div><span class="upload-status"><i class="fas fa-check"></i></span><button type="button" class="remove-attachment" onclick="removeAttachment(this)"><i class="fas fa-times"></i></button></div>');
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

