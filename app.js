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
        fuel: {
            title: 'کارت سوخت',
            cost: '۱۵۰,۰۰۰ تومان',
            fields: ['ownerPhone', 'ownerNationalId', 'plateLetters', 'plateNumbersFirst',
                     'plateNumbersSecond', 'vin', 'requestType', 'additionalNotes'],
            transform: (data) => {
                const plateFull = [data.plateLetters, data.plateNumbersFirst, data.plateNumbersSecond].filter(Boolean).join(' - ');
                const requestTypeLabels = { new: 'صدور کارت جدید', duplicate: 'المثنی (گم شدگی/خرابی)' };
                return {
                    ownerPhone: data.ownerPhone,
                    ownerNationalId: data.ownerNationalId,
                    plate: plateFull,
                    vin: data.vin,
                    requestType: requestTypeLabels[data.requestType] || data.requestType,
                    additionalNotes: data.additionalNotes,
                };
            }
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
        }
    };

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
        window.location.href = 'admin-login.html';
    }

    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', e => {
            e.preventDefault();
            localStorage.removeItem('adminData');
            window.location.href = 'admin-login.html';
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
                    inlinePolling = setInterval(loadInlineMessages, 2000);
                }
            }
        });

        if (chatPanel && !inlinePolling) {
            chatPanel.addEventListener('transitionend', function() {
                if (chatPanel.style.display !== 'none' && !inlinePolling) {
                    inlinePolling = setInterval(loadInlineMessages, 2000);
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

    function compressImage(file, maxWidth = 800, maxHeight = 200, quality = 0.7) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            img.src = URL.createObjectURL(file);
        });
    }

    if (bannerUpload && previewImg) {
        bannerUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                compressImage(file).then(blob => {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        previewImg.src = event.target.result;
                    };
                    reader.readAsDataURL(blob);
                });
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

