/* ══════════════════════════════════════════════════════════════
   utils.js — Shared utilities for chillinet.ir
   ══════════════════════════════════════════════════════════════ */

var ChillUtils = (function() {

    // ── HTML Escaping ──
    var _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function(c) { return _escapeMap[c]; });
    }

    // ── Digit Conversion ──
    var _faDigits = '۰۱۲۳۴۵۶۷۸۹';
    var _arDigits = '٠١٢٣٤٥٦٧٨٩';
    function toEnDigits(str) {
        return String(str || '')
            .replace(/[۰-۹]/g, function(d) { return _faDigits.indexOf(d); })
            .replace(/[٠-٩]/g, function(d) { return _arDigits.indexOf(d); });
    }
    function toFaDigits(str) {
        return String(toEnDigits(str)).replace(/[0-9]/g, function(d) { return _faDigits[parseInt(d)]; });
    }

    // ── Price Formatting ──
    function formatPrice(amount) {
        var numStr = toEnDigits(String(amount !== undefined ? amount : '0'));
        numStr = numStr.replace(/[,٬٫]/g, '').trim();
        var num = parseFloat(numStr);
        if (isNaN(num)) return '۰';
        var formatted = num.toLocaleString('en-US');
        return toFaDigits(formatted);
    }

    // ── Unique ID Generation (replaces 'att_' + Date.now() pattern) ──
    function generateId(prefix) {
        if (window.crypto && window.crypto.randomUUID) {
            return (prefix || '') + crypto.randomUUID();
        }
        return (prefix || '') + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
    }

    // ── Safe URL Validation ──
    function safeUrl(url) {
        if (!url) return '';
        if (/^(https?:\/\/|data:)/i.test(url)) return url;
        return '';
    }

    // ── Persian Date Formatting ──
    function formatDate(dateStr) {
        try {
            return new Date(dateStr).toLocaleDateString('fa-IR');
        } catch(e) {
            return dateStr || '';
        }
    }
    function formatDateTime(dateStr) {
        try {
            return new Date(dateStr).toLocaleString('fa-IR');
        } catch(e) {
            return dateStr || '';
        }
    }

    // ── Iranian National ID Validation ──
    function validNationalId(id) {
        id = toEnDigits(String(id || '').trim());
        if (!/^\d{10}$/.test(id)) return false;
        var check = parseInt(id[9]);
        var sum = 0;
        for (var i = 0; i < 9; i++) sum += parseInt(id[i]) * (10 - i);
        var remainder = sum % 11;
        if (remainder < 2) return check === remainder;
        return check === (11 - remainder);
    }

    // ── Phone Number Validation ──
    function validPhone(phone) {
        return /^09\d{9}$/.test(toEnDigits(String(phone || '').trim()));
    }

    // ── Toast Notification (uses notie if available, fallback to simple) ──
    function showToast(message, type) {
        if (typeof notie !== 'undefined') {
            var nType = type === 'error' ? 3 : type === 'success' ? 1 : 4;
            notie.alert({ type: nType, text: message, time: 3 });
            return;
        }
        var t = document.getElementById('toastNotification');
        if (!t) {
            t = document.createElement('div');
            t.id = 'toastNotification';
            t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;font-size:0.9rem;z-index:99999;opacity:0;transition:opacity 0.3s;pointer-events:none;';
            document.body.appendChild(t);
        }
        t.textContent = message;
        t.style.opacity = '1';
        t.style.background = type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3b82f6';
        clearTimeout(t._timer);
        t._timer = setTimeout(function() { t.style.opacity = '0'; }, 3000);
    }

    // ── Alert Replacement (uses notie if available, fallback to alert) ──
    function showAlert(message, type) {
        if (typeof notie !== 'undefined') {
            var nType = type === 'error' ? 3 : type === 'success' ? 1 : type === 'warning' ? 2 : 4;
            notie.alert({ type: nType, text: message, time: 4 });
            return;
        }
        alert(message);
    }

    // ── Confirm Dialog (uses notie if available, fallback to confirm) ──
    function showConfirm(message, onConfirm) {
        if (typeof notie !== 'undefined') {
            notie.confirm({
                text: message,
                submitText: 'بله',
                cancelText: 'خیر',
                submitCallback: function() { notie.alertClose(); if (onConfirm) onConfirm(); }
            });
            return;
        }
        if (confirm(message)) {
            if (onConfirm) onConfirm();
        }
    }

    // ── JWT Decoding ──
    function parseJWT(token) {
        if (typeof jwtDecode !== 'undefined') {
            try { return jwtDecode(token); } catch(e) { return null; }
        }
        try {
            var parts = token.split('.');
            if (parts.length !== 3) return null;
            return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        } catch(e) { return null; }
    }

    function isTokenExpired(token) {
        var payload = parseJWT(token);
        return !payload || (payload.exp && Date.now() > payload.exp);
    }

    // ── Auth Guards ──
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

    // ── File Type Detection ──
    var IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|tif|avif|heic|heif)$/i;
    function isImageFile(file) {
        if (!file) return false;
        if (file.type && file.type.startsWith('image/')) return true;
        if (file.name && IMAGE_EXTENSIONS.test(file.name)) return true;
        return false;
    }

    // ── Lazy-load heic-to library ──
    var _heicToPromise = null;
    function loadHeicTo() {
        if (_heicToPromise) return _heicToPromise;
        _heicToPromise = new Promise(function(resolve) {
            if (typeof HeicTo !== 'undefined' && typeof HeicTo.heicTo === 'function') { resolve(HeicTo); return; }
            var script = document.createElement('script');
            script.type = 'module';
            script.onload = function() {
                var check = setInterval(function() {
                    if (typeof HeicTo !== 'undefined' && typeof HeicTo.heicTo === 'function') {
                        clearInterval(check);
                        resolve(HeicTo);
                    }
                }, 50);
                setTimeout(function() { clearInterval(check); resolve(null); }, 5000);
            };
            script.onerror = function() { resolve(null); };
            script.src = 'libs/heic-to-loader.js';
            document.head.appendChild(script);
        });
        return _heicToPromise;
    }

    // ── Canvas-based Adaptive Image Compression ──
    function compressImageFile(file, options) {
        options = options || {};
        var maxSizeMB = options.maxSizeMB || 0.3;
        var targetBytes = maxSizeMB * 1024 * 1024;

        return new Promise(function(resolve, reject) {
            if (!isImageFile(file)) { resolve(file); return; }
            if (file.size <= targetBytes) { resolve(file); return; }

            var isHeic = /\.(heic|heif)$/i.test(file.name || '') || (file.type === 'image/heic') || (file.type === 'image/heif');

            if (isHeic) {
                loadHeicTo().then(function(heic) {
                    if (heic && typeof heic.heicTo === 'function') {
                        heic.heicTo({ blob: file, type: 'image/jpeg', quality: 0.82 }).then(function(jpegBlob) {
                            var result = new File([jpegBlob], (file.name || 'image').replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
                            compressToTarget(result, targetBytes).then(resolve).catch(function() { reject(result); });
                        }).catch(function() {
                            compressToTarget(file, targetBytes).then(resolve).catch(function() { reject(file); });
                        });
                    } else {
                        compressToTarget(file, targetBytes).then(resolve).catch(function() { reject(file); });
                    }
                });
            } else {
                compressToTarget(file, targetBytes).then(resolve).catch(function() { reject(file); });
            }
        });
    }

    function compressToTarget(file, targetBytes) {
        return new Promise(function(resolve) {
            function drawToCanvas(imgWidth, imgHeight, drawFn) {
                var w = imgWidth;
                var h = imgHeight;
                var ratio = file.size / targetBytes;
                var maxDim;
                if (ratio > 8)       maxDim = 600;
                else if (ratio > 5)  maxDim = 800;
                else if (ratio > 3)  maxDim = 1024;
                else if (ratio > 2)  maxDim = 1280;
                else                 maxDim = 1600;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                    else { w = Math.round(w * maxDim / h); h = maxDim; }
                }
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                drawFn(ctx, w, h);
                return canvas;
            }

            function encodeCanvas(canvas) {
                var qualities = [0.82, 0.68, 0.55, 0.42, 0.30, 0.20, 0.12];
                var qi = 0;
                function tryNext() {
                    if (qi >= qualities.length) { resolve(file); return; }
                    var q = qualities[qi++];
                    canvas.toBlob(function(blob) {
                        if (!blob || blob.size === 0) { tryNext(); return; }
                        if (blob.size <= targetBytes || qi >= qualities.length) {
                            var result = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() });
                            resolve(result);
                        } else {
                            tryNext();
                        }
                    }, 'image/jpeg', q);
                }
                tryNext();
            }

            function tryImageBitmap() {
                if (typeof createImageBitmap === 'undefined') { tryOldImage(); return; }
                createImageBitmap(file).then(function(bitmap) {
                    var canvas = drawToCanvas(bitmap.width, bitmap.height, function(ctx, w, h) {
                        ctx.drawImage(bitmap, 0, 0, w, h);
                    });
                    bitmap.close();
                    encodeCanvas(canvas);
                }).catch(function() { tryOldImage(); });
            }

            function tryOldImage() {
                var img = new Image();
                var url = URL.createObjectURL(file);
                img.onload = function() {
                    URL.revokeObjectURL(url);
                    try {
                        var canvas = drawToCanvas(img.width, img.height, function(ctx, w, h) {
                            ctx.drawImage(img, 0, 0, w, h);
                        });
                        encodeCanvas(canvas);
                    } catch(e) { reject(e); }
                };
                img.onerror = function() {
                    URL.revokeObjectURL(url);
                    reject(new Error('Cannot decode image'));
                };
                img.src = url;
            }

            tryImageBitmap();
        });
    }

    // ── File Download Helper ──
    function downloadAttachment(fileUrl, fileName) {
        if (!fileUrl) return;
        if (fileUrl.indexOf('data:') === 0) {
            try {
                var arr = fileUrl.split(',');
                var mime = arr[0].match(/:(.*?);/)[1];
                var bstr = atob(arr[1]);
                var n = bstr.length;
                var u8arr = new Uint8Array(n);
                while (n--) u8arr[n] = bstr.charCodeAt(n);
                var blob = new Blob([u8arr], { type: mime });
                var blobUrl = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = blobUrl;
                a.download = fileName || 'file';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(function() {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                }, 200);
            } catch (e) {
                var a2 = document.createElement('a');
                a2.href = fileUrl;
                a2.download = fileName || 'file';
                a2.style.display = 'none';
                document.body.appendChild(a2);
                a2.click();
                setTimeout(function() { document.body.removeChild(a2); }, 200);
            }
        } else {
            var a3 = document.createElement('a');
            a3.href = fileUrl;
            a3.download = fileName || 'file';
            a3.target = '_blank';
            a3.style.display = 'none';
            document.body.appendChild(a3);
            a3.click();
            setTimeout(function() { document.body.removeChild(a3); }, 200);
        }
    }

    // ── Attachment Preview Renderer ──
    function renderAttachmentThumb(attachment, opts) {
        opts = opts || {};
        var size = opts.size || 70;
        var isImg = isImageFile(attachment);
        var html = '<div class="attachment-thumbnail" data-attachment-id="' + escapeHtml(attachment.id) + '" style="width:' + size + 'px;height:' + size + 'px;cursor:pointer;position:relative;border-radius:6px;overflow:hidden;">';
        if (isImg && attachment.dataUrl) {
            html += '<img src="' + escapeHtml(attachment.dataUrl) + '" alt="' + escapeHtml(attachment.name) + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            var ext = (attachment.name || '').split('.').pop().toUpperCase() || 'FILE';
            html += '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f5f5f5;color:#667eea;font-weight:700;border-radius:6px;">';
            html += '<i class="fas fa-file" style="font-size:' + (size * 0.3) + 'px;margin-bottom:2px;"></i>';
            html += '<span style="font-size:0.5rem;max-width:' + (size - 8) + 'px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(ext) + '</span>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    // Expose auth functions globally for use in <head> scripts
    window.checkAdminAuth = checkAdminAuth;
    window.checkUserAuth = checkUserAuth;

    return {
        escapeHtml: escapeHtml,
        toEnDigits: toEnDigits,
        toFaDigits: toFaDigits,
        formatPrice: formatPrice,
        generateId: generateId,
        safeUrl: safeUrl,
        formatDate: formatDate,
        formatDateTime: formatDateTime,
        validNationalId: validNationalId,
        validPhone: validPhone,
        showToast: showToast,
        showAlert: showAlert,
        showConfirm: showConfirm,
        parseJWT: parseJWT,
        isTokenExpired: isTokenExpired,
        checkAdminAuth: checkAdminAuth,
        checkUserAuth: checkUserAuth,
        isImageFile: isImageFile,
        compressImageFile: compressImageFile,
        downloadAttachment: downloadAttachment,
        renderAttachmentThumb: renderAttachmentThumb
    };
})();
