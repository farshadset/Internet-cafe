document.addEventListener('DOMContentLoaded', () => {
    // بارگذاری بنر از دیتابیس
    fetch('/api/banners')
        .then(r => r.json())
        .then(banners => {
            if (banners.length > 0 && document.getElementById('bannerImg')) {
                document.getElementById('bannerImg').src = banners[banners.length - 1].src;
            }
        })
        .catch(() => {});

    const form = document.getElementById('registrationForm');
    if (form) {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(form));
            localStorage.setItem('registrationData', JSON.stringify(data));
            fetch('/api/order', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    parentPhone: data.parentPhone,
                    studentNationalId: data.studentNationalId,
                    status: 'pending'
                })
            }).catch(() => {});
            window.location.href = 'review.html';
        });
    }

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
            fetch('/api/banners', {
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

    // Chat handlers
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    const chatMessages = document.getElementById('chatMessages');
    
    if (sendBtn && messageInput && chatMessages) {
        sendBtn.addEventListener('click', () => {
            const text = messageInput.value.trim();
            if (text) {
                const div = document.createElement('div');
                div.className = 'message user';
                div.textContent = 'شما: ' + text;
                chatMessages.appendChild(div);
                fetch('/api/chat', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ role: 'user', text })
                }).catch(() => {});
                messageInput.value = '';
            }
        });
    }

    const adminSendBtn = document.getElementById('adminSendBtn');
    const adminMessageInput = document.getElementById('adminMessageInput');
    const adminChatMessages = document.getElementById('adminChatMessages');
    
    if (adminSendBtn && adminMessageInput && adminChatMessages) {
        adminSendBtn.addEventListener('click', () => {
            const text = adminMessageInput.value.trim();
            if (text) {
                const div = document.createElement('div');
                div.className = 'message user';
                div.textContent = 'شما: ' + text;
                adminChatMessages.appendChild(div);
                fetch('/api/admin/chat', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ text })
                }).catch(() => {});
                adminMessageInput.value = '';
            }
        });
    }
});
