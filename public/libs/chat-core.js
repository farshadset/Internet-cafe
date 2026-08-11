/**
 * chat-core.js — Shared Chat Module
 * Provides: attachment handling, message rendering, Socket.io integration, 
 * offline queue, notification sounds, typing indicators, read receipts
 */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ChatCore = factory();
})(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    var API_BASE = '';
    var PAGE_SIZE = 30;
    var MAX_ATTACHMENTS = 4;
    var MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
    var MAX_TOTAL_SIZE = 4 * 1024 * 1024; // 4MB total (4 files x 1MB)
    var POLL_INTERVAL = 8000;
    var TYPING_TIMEOUT = 3000;
    var MAX_MESSAGE_LENGTH = 5000;

    // Audio context for notification sounds
    var _audioCtx = null;
    var _notificationSound = null;

    function getAudioContext() {
        if (!_audioCtx) {
            try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
        }
        return _audioCtx;
    }

    function playNotificationSound() {
        var ctx = getAudioContext();
        if (!ctx) return;
        try {
            if (ctx.state === 'suspended') ctx.resume();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } catch(e) {}
    }

    // Utility functions
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function isImageFile(file) {
        if (!file) return false;
        var type = file.type || '';
        var name = file.name || '';
        return type.indexOf('image/') === 0 || /\.(jpe?g|png|gif|webp|bmp|svg|tiff|tif|avif|heic|heif)$/i.test(name);
    }

    function isHeicFile(file) {
        if (!file) return false;
        var name = file.name || '';
        var type = file.type || '';
        return /\.(heic|heif)$/i.test(name) || type === 'image/heic' || type === 'image/heif';
    }

    var _heicLoadingPromise = null;
    function loadHeicConverter() {
        if (_heicLoadingPromise) return _heicLoadingPromise;
        _heicLoadingPromise = new Promise(function(resolve) {
            if (typeof window.HeicTo !== 'undefined' && typeof window.HeicTo.heicTo === 'function') {
                resolve(window.HeicTo);
                return;
            }
            if (typeof ChillUtils !== 'undefined' && typeof ChillUtils.loadHeicTo === 'function') {
                ChillUtils.loadHeicTo().then(function(heic) {
                    resolve(heic);
                }).catch(function() { resolve(null); });
                return;
            }
            var script = document.createElement('script');
            script.type = 'module';
            script.onload = function() {
                var check = setInterval(function() {
                    if (typeof window.HeicTo !== 'undefined' && typeof window.HeicTo.heicTo === 'function') {
                        clearInterval(check);
                        resolve(window.HeicTo);
                    }
                }, 50);
                setTimeout(function() { clearInterval(check); resolve(null); }, 5000);
            };
            script.onerror = function() { resolve(null); };
            script.src = 'libs/heic-to-loader.js';
            document.head.appendChild(script);
            setTimeout(function() { resolve(null); }, 6000);
        });
        return _heicLoadingPromise;
    }

    function convertHeicToJpeg(file) {
        return new Promise(function(resolve) {
            if (!isHeicFile(file)) { resolve(file); return; }
            loadHeicConverter().then(function(heic) {
                if (heic && typeof heic.heicTo === 'function') {
                    heic.heicTo({ blob: file, type: 'image/jpeg', quality: 0.82 })
                        .then(function(jpegBlob) {
                            var newName = (file.name || 'image').replace(/\.[^.]+$/, '.jpg');
                            resolve(new File([jpegBlob], newName, { type: 'image/jpeg', lastModified: Date.now() }));
                        })
                        .catch(function() { resolve(file); });
                } else {
                    resolve(file);
                }
            }).catch(function() { resolve(file); });
        });
    }

    function generateId(prefix) {
        return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function formatTime(isoString) {
        if (!isoString) return '';
        try {
            var d = new Date(isoString);
            return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        } catch(e) { return ''; }
    }

    function formatDate(isoString) {
        if (!isoString) return '';
        try {
            var d = new Date(isoString);
            return d.toLocaleDateString('fa-IR');
        } catch(e) { return ''; }
    }

    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '...' : str;
    }

    function _doCompressImage(file, maxMB) {
        return new Promise(function(resolve) {
            if (typeof window.imageCompression === 'function') {
                window.imageCompression(file, {
                    maxSizeMB: maxMB,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    maxIteration: 10,
                    exifOrientation: 1,
                    fileType: 'image/jpeg',
                    initialQuality: 0.82
                }).then(function(compressed) {
                    resolve(compressed);
                }).catch(function() {
                    _canvasCompress(file, maxMB).then(resolve);
                });
                return;
            }
            _canvasCompress(file, maxMB).then(resolve);
        });
    }

    function _canvasCompress(file, maxMB) {
        return new Promise(function(resolve) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var img = new Image();
                img.onload = function() {
                    try {
                        var canvas = document.createElement('canvas');
                        var ctx = canvas.getContext('2d');
                        var ratio = Math.min(1, Math.sqrt((maxMB * 1024 * 1024) / file.size) * 0.8);
                        canvas.width = Math.round(img.width * ratio);
                        canvas.height = Math.round(img.height * ratio);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob(function(blob) {
                            if (blob) {
                                resolve(new File([blob], (file.name || 'image').replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg', lastModified: Date.now() }));
                            } else {
                                resolve(file);
                            }
                        }, 'image/jpeg', 0.85);
                    } catch(err) { resolve(file); }
                };
                img.onerror = function() { resolve(file); };
                img.src = e.target.result;
            };
            reader.onerror = function() { resolve(file); };
            reader.readAsDataURL(file);
        });
    }

    function compressOversizedImage(file) {
        var targetMB = MAX_FILE_SIZE / (1024 * 1024);
        return convertHeicToJpeg(file).then(function(converted) {
            return _doCompressImage(converted, targetMB);
        });
    }

    function compressImage(file, maxMB) {
        maxMB = maxMB || 1;
        return new Promise(function(resolve) {
            if (!isImageFile(file)) { resolve(file); return; }
            if (file.size <= maxMB * 1024 * 1024) {
                if (isHeicFile(file)) {
                    convertHeicToJpeg(file).then(resolve);
                } else {
                    resolve(file);
                }
                return;
            }
            convertHeicToJpeg(file).then(function(converted) {
                _doCompressImage(converted, maxMB).then(resolve);
            });
        });
    }

    // Read file as data URL with progress
    function readFileAsDataURL(file, onProgress) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            if (onProgress) {
                reader.onprogress = function(ev) {
                    if (ev.lengthComputable) {
                        onProgress(Math.round((ev.loaded / ev.total) * 100));
                    }
                };
            }
            reader.onload = function(ev) {
                resolve({
                    id: generateId('att_'),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    dataUrl: ev.target.result,
                    uploadedAt: new Date().toISOString()
                });
            };
            reader.onerror = function() { reject(new Error('خطا در خواندن فایل')); };
            reader.readAsDataURL(file);
        });
    }

    // Validate attachment
    function validateAttachment(file) {
        var allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
        var type = (file.type || '').toLowerCase();
        var ext = (file.name || '').split('.').pop().toLowerCase();
        var allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'];
        var isAllowed = allowedTypes.indexOf(type) !== -1 || allowedExts.indexOf(ext) !== -1;
        if (!isAllowed) {
            return { valid: false, error: 'فقط فرمت‌های JPEG، PNG، WebP، HEIC و PDF مجاز هستند.' };
        }
        if (file.size > MAX_FILE_SIZE) {
            return {
                valid: false,
                compressible: isImageFile(file),
                error: 'حجم فایل ' + (file.size / (1024 * 1024)).toFixed(1) + ' مگابایت است. حداکثر ' + (MAX_FILE_SIZE / (1024 * 1024)) + ' مگابایت مجاز است.'
            };
        }
        return { valid: true };
    }

    // Render attachment thumbnail HTML (for preview before send)
    function renderAttachmentThumb(attachment, dataUrl) {
        var isImg = isImageFile(attachment);
        var html = '<div class="att-thumb" data-att-id="' + escapeHtml(attachment.id) + '">';
        if (isImg) {
            html += '<img src="' + escapeHtml(dataUrl || attachment.dataUrl) + '" alt="' + escapeHtml(attachment.name) + '" loading="lazy" decoding="async">';
        } else {
            var ext = (attachment.name || '').split('.').pop().toUpperCase() || 'FILE';
            html += '<div class="att-thumb-file"><i class="fas fa-file"></i><span>' + escapeHtml(ext) + '</span></div>';
        }
        html += '<span class="att-status"><i class="fas fa-check"></i></span>';
        html += '<button type="button" class="att-remove" data-remove="' + escapeHtml(attachment.id) + '"><i class="fas fa-times"></i></button>';
        html += '</div>';
        return html;
    }

    // Render attachment thumbnail with progress (for uploading state)
    function renderAttachmentProgress(attachmentId, fileName, isImage) {
        var html = '<div class="att-thumb uploading" data-att-id="' + escapeHtml(attachmentId) + '">';
        if (isImage) {
            html += '<img src="" alt="" style="opacity:0.3">';
        } else {
            var ext = (fileName || '').split('.').pop().toUpperCase() || 'FILE';
            html += '<div class="att-thumb-file" style="opacity:0.3"><i class="fas fa-file"></i><span>' + escapeHtml(ext) + '</span></div>';
        }
        html += '<div class="att-progress-overlay">';
        html += '<svg class="att-progress-ring" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" stroke-width="3"/><circle class="att-progress-circle" data-progress="' + escapeHtml(attachmentId) + '" cx="18" cy="18" r="14" fill="none" stroke="#667eea" stroke-width="3" stroke-dasharray="87.96" stroke-dashoffset="87.96" transform="rotate(-90 18 18)" stroke-linecap="round"/></svg>';
        html += '<span class="att-progress-text" data-progress-text="' + escapeHtml(attachmentId) + '">0%</span>';
        html += '</div>';
        html += '<button type="button" class="att-remove" data-cancel-read="' + escapeHtml(attachmentId) + '"><i class="fas fa-times"></i></button>';
        html += '</div>';
        return html;
    }

    function updateProgress(attId, pct) {
        var circle = document.querySelector('[data-progress="' + attId + '"]');
        var text = document.querySelector('[data-progress-text="' + attId + '"]');
        if (circle) circle.style.strokeDashoffset = (87.96 * (1 - pct / 100));
        if (text) text.textContent = pct + '%';
    }

    // Render a single chat message element
    function renderMessage(msg, options) {
        options = options || {};
        var div = document.createElement('div');
        div.className = 'msg ' + (msg.role === 'admin' ? 'msg-admin' : 'msg-customer');
        div.setAttribute('data-msg-id', msg.id);
        div.setAttribute('data-timestamp', msg.timestamp);

        var bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.textContent = msg.text;
        div.appendChild(bubble);

        // Attachments
        if (msg.attachments && msg.attachments.length > 0) {
            var attContainer = document.createElement('div');
            attContainer.className = 'msg-attachments';
            msg.attachments.forEach(function(att) {
                var isImg = isImageFile(att);
                var attUrl = resolveAttachmentUrl(att.dataUrl || att.url || '');
                var thumb = document.createElement('div');
                thumb.className = 'att-thumb';
                thumb.style.cssText = 'width:80px;height:80px;cursor:pointer;border-radius:8px;overflow:hidden;';
                if (isImg && attUrl) {
                    var img = document.createElement('img');
                    img.src = attUrl;
                    img.alt = att.name || '';
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px;';
                    thumb.appendChild(img);
                } else {
                    var ext = (att.name || '').split('.').pop().toUpperCase() || 'FILE';
                    thumb.innerHTML = '<div class="att-thumb-file"><i class="fas fa-file"></i><span>' + escapeHtml(ext) + '</span></div>';
                }
                thumb.addEventListener('click', function() {
                    downloadAttachment(attUrl, att.name);
                });
                attContainer.appendChild(thumb);
            });
            div.appendChild(attContainer);
        }

        // Time + ticks
        var timeEl = document.createElement('div');
        timeEl.className = 'msg-time';
        timeEl.textContent = formatTime(msg.timestamp);

        var tickRole = options.tickRole || 'admin';
        if (msg.role === tickRole) {
            var tickEl = document.createElement('span');
            tickEl.className = 'msg-tick';
            tickEl.setAttribute('data-msg-tick', msg.id);
            if (msg.seenAt) {
                tickEl.textContent = ' ✓✓';
                tickEl.classList.add('msg-seen');
            } else if (options.pending) {
                tickEl.textContent = '';
                tickEl.classList.add('msg-pending');
            } else {
                tickEl.textContent = ' ✓';
                tickEl.classList.add('msg-sent');
            }
            timeEl.appendChild(tickEl);
        }

        div.appendChild(timeEl);

        return div;
    }

    function updateMessageTick(msgId, status) {
        var tickEl = document.querySelector('[data-msg-tick="' + msgId + '"]');
        if (!tickEl) return;
        tickEl.classList.remove('msg-pending', 'msg-sent', 'msg-seen');
        if (status === 'sent') {
            tickEl.textContent = ' ✓';
            tickEl.classList.add('msg-sent');
        } else if (status === 'seen') {
            tickEl.textContent = ' ✓✓';
            tickEl.classList.add('msg-seen');
        }
    }

    // Download attachment
    function downloadAttachment(dataUrl, name) {
        if (!dataUrl) return;
        var a = document.createElement('a');
        a.href = resolveAttachmentUrl(dataUrl);
        a.download = name || 'attachment';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function() { a.remove(); }, 100);
    }

    // Attachment images are served by /api/chat/blob, which authorizes via the
    // session cookie OR the Authorization header. An <img> tag can only send the
    // cookie, so when the logged-in user's cookie belongs to another role (e.g.
    // an admin browsing after a customer login in the same browser) the image
    // request 403s and disappears after a refresh. This helper loads those
    // images through fetch (the caller can inject its own bearer token) and swaps
    // in an object URL so the thumbnail no longer depends on the cookie.
    function authorizeAttachmentImages(rootEl, getHeaders) {
        if (!rootEl || !rootEl.querySelectorAll) return;
        rootEl.querySelectorAll('img[src^="/api/chat/blob"]').forEach(function(img) {
            if (img.getAttribute('data-auth') === '1') return;
            img.setAttribute('data-auth', '1');
            var src = img.getAttribute('src');
            if (!src) return;
            var opts = { credentials: 'same-origin' };
            if (getHeaders) {
                var h = getHeaders();
                if (h) opts.headers = h;
            }
            fetch(src, opts).then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.blob();
            }).then(function(b) {
                var url = URL.createObjectURL(b);
                img.addEventListener('load', function() { try { URL.revokeObjectURL(url); } catch (e) {} });
                img.addEventListener('error', function() { try { URL.revokeObjectURL(url); } catch (e) {} });
                img.setAttribute('data-auth', '2');
                img.src = url;
            }).catch(function() {
                img.setAttribute('data-auth', '');
            });
        });
    }

    // Offline queue
    var _offlineQueue = [];
    var _offlineKey = 'chat_offline_queue';

    function loadOfflineQueue() {
        try {
            var saved = localStorage.getItem(_offlineKey);
            if (saved) _offlineQueue = JSON.parse(saved);
        } catch(e) { _offlineQueue = []; }
        return _offlineQueue;
    }

    function saveOfflineQueue() {
        try { localStorage.setItem(_offlineKey, JSON.stringify(_offlineQueue)); } catch(e) {}
    }

    function enqueueOffline(message) {
        message._offlineId = generateId('off_');
        message._queuedAt = new Date().toISOString();
        _offlineQueue.push(message);
        saveOfflineQueue();
        return message._offlineId;
    }

    function dequeueOffline(_offlineId) {
        _offlineQueue = _offlineQueue.filter(function(m) { return m._offlineId !== _offlineId; });
        saveOfflineQueue();
    }

    function getOfflineQueue() {
        return _offlineQueue.slice();
    }

    // sendFn receives the current queue and must resolve with an array of
    // _offlineId values that were successfully sent. Those are removed from
    // the queue; the rest are kept for a later retry.
    function flushOfflineQueue(sendFn) {
        if (!sendFn || typeof sendFn !== 'function') return Promise.resolve([]);
        var queued = _offlineQueue.slice();
        if (queued.length === 0) return Promise.resolve([]);
        return Promise.resolve(sendFn(queued)).then(function(sentIds) {
            var ok = Array.isArray(sentIds) ? sentIds : [];
            var before = _offlineQueue.length;
            _offlineQueue = _offlineQueue.filter(function(m) {
                return ok.indexOf(m._offlineId) === -1;
            });
            if (_offlineQueue.length !== before) saveOfflineQueue();
            return ok;
        }).catch(function() {
            return [];
        });
    }

    // Socket.io wrapper
    var _socket = null;
    var _socketCallbacks = {};
    var _socketLoading = false;
    var _socketAttempted = false;
    var _socketClientPromise = null;

    // Dynamically load the socket.io client. On hosts where the server never
    // runs Socket.io (e.g. Vercel serverless), the script 404s and we resolve
    // null so callers can fall back to HTTP polling.
    function loadSocketClient() {
        if (typeof io !== 'undefined') return Promise.resolve(io);
        if (_socketClientPromise) return _socketClientPromise;
        if (typeof window !== 'undefined' && window._ioMissing === true) return Promise.resolve(null);
        _socketClientPromise = new Promise(function(resolve) {
            var script = document.createElement('script');
            script.src = '/socket.io/socket.io.js';
            script.async = true;
            var finished = false;
            function finish(ioRef) {
                if (finished) return;
                finished = true;
                resolve(ioRef || null);
            }
            script.onload = function() { finish(typeof io !== 'undefined' ? io : null); };
            script.onerror = function() {
                if (typeof window !== 'undefined') window._ioMissing = true;
                finish(null);
            };
            document.head.appendChild(script);
            setTimeout(function() { finish(typeof io !== 'undefined' ? io : null); }, 5000);
        });
        return _socketClientPromise;
    }

    function initSocket(token) {
        if (!token) return null;
        if (_socket && _socket.connected) return _socket;
        if (_socketLoading || _socketAttempted) return null;

        _socketLoading = true;
        loadSocketClient().then(function(ioRef) {
            _socketLoading = false;
            _socketAttempted = true;
            if (!ioRef) { _socket = null; return; }
            _socket = ioRef({ auth: { token: token } });

            _socket.on('connect', function() {
                if (_socketCallbacks.onConnect) _socketCallbacks.onConnect(_socket);
            });
            _socket.on('disconnect', function() {
                if (_socketCallbacks.onDisconnect) _socketCallbacks.onDisconnect();
            });
            _socket.on('new-message', function(data) {
                if (_socketCallbacks.onNewMessage) _socketCallbacks.onNewMessage(data);
                if (data.role !== _socketCallbacks.currentRole) {
                    playNotificationSound();
                }
            });
            _socket.on('message-seen', function(data) {
                if (_socketCallbacks.onMessageSeen) _socketCallbacks.onMessageSeen(data);
            });
            _socket.on('customer-typing', function(data) {
                if (_socketCallbacks.onTyping) _socketCallbacks.onTyping(data);
            });
            _socket.on('customer-stop-typing', function(data) {
                if (_socketCallbacks.onStopTyping) _socketCallbacks.onStopTyping(data);
            });
            _socket.on('admin-typing', function(data) {
                if (_socketCallbacks.onTyping) _socketCallbacks.onTyping(data);
            });
            _socket.on('admin-stop-typing', function(data) {
                if (_socketCallbacks.onStopTyping) _socketCallbacks.onStopTyping(data);
            });
            _socket.on('conversation-closed', function(data) {
                if (_socketCallbacks.onConversationClosed) _socketCallbacks.onConversationClosed(data);
            });
            _socket.on('conversation-reopened', function(data) {
                if (_socketCallbacks.onConversationReopened) _socketCallbacks.onConversationReopened(data);
            });
        });
        return null;
    }

    function isSocketAvailable() {
        return !!(_socket && _socket.connected);
    }

    function setSocketCallbacks(callbacks) {
        for (var k in callbacks) {
            if (callbacks.hasOwnProperty(k)) _socketCallbacks[k] = callbacks[k];
        }
    }

    function getSocket() { return _socket; }

    function emitTyping(conversationId, username) {
        if (_socket && _socket.connected) {
            _socket.emit('typing', { conversationId: conversationId, username: username });
        }
    }

    function emitStopTyping(conversationId, username) {
        if (_socket && _socket.connected) {
            _socket.emit('stop-typing', { conversationId: conversationId, username: username });
        }
    }

    function joinConversation(conversationId) {
        if (_socket && _socket.connected) {
            _socket.emit('join-conversation', { conversationId: conversationId });
        }
    }

    // Typing debounce helper
    var _typingTimer = null;
    function handleTyping(conversationId, username, callback) {
        if (_typingTimer) clearTimeout(_typingTimer);
        emitTyping(conversationId, username);
        _typingTimer = setTimeout(function() {
            emitStopTyping(conversationId, username);
        }, TYPING_TIMEOUT);
        if (callback) callback();
    }

    function stopTyping(conversationId, username) {
        if (_typingTimer) { clearTimeout(_typingTimer); _typingTimer = null; }
        emitStopTyping(conversationId, username);
    }

    // API helpers
    function apiGet(url) {
        return fetch(API_BASE + url, {
            headers: { 'Accept': 'application/json' }
        }).then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        });
    }

    function apiPost(url, data) {
        return fetch(API_BASE + url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(function(r) {
            return r.json().then(function(d) { return { ok: r.ok, data: d }; });
        }).catch(function(e) { return { ok: false, data: { error: 'خطا در ارتباط با سرور' } }; });
    }

    function apiDelete(url) {
        return fetch(API_BASE + url, { method: 'DELETE' })
            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); });
    }

    // Rewrite a Vercel Blob public URL to this domain's proxy so images load
    // from 'self' and don't depend on direct access to *.blob.vercel-storage.com.
    function resolveAttachmentUrl(url) {
        var normalized = normalizeBlobUrl(String(url || ''));
        if (!normalized || normalized.indexOf('data:') === 0) return normalized;
        var m = normalized.match(/^https?:\/\/[^/]+\.blob\.vercel-storage\.com\/(.+)$/);
        if (m) return '/api/chat/blob?path=' + encodeURIComponent(normalized);
        return normalized;
    }

    // Direct upload to Vercel Blob
    function normalizeBlobUrl(url) {
        if (!url || typeof url !== 'string') return url;
        // Fix old URL format with store_ prefix and missing .public
        // Old: https://store_XXX.blob.vercel-storage.com/...
        // New: https://XXX.public.blob.vercel-storage.com/...
        if (url.indexOf('.blob.vercel-storage.com') !== -1 && url.indexOf('.public.') === -1) {
            return url.replace(/^(https?:\/\/)(?:store_)?([^.]+)\.blob\.vercel-storage\.com/, '$1$2.public.blob.vercel-storage.com');
        }
        return url;
    }
    function uploadToBlob(file, token) {
        // Upload via the same-origin server (which forwards to Vercel Blob) so
        // it works even when the browser cannot reach *.blob.vercel-storage.com directly.
        return readFileAsDataURL(file).then(function(data) {
            return apiPost('/api/chat/upload', {
                file: {
                    name: data.name,
                    type: data.type,
                    size: data.size,
                    dataUrl: data.dataUrl
                },
                conversationId: null
            }).then(function(r) {
                if (!r.ok) throw new Error(r.data && (r.data.error || r.data.detail) || 'خطا در آپلود فایل');
                return { url: r.data.url, name: r.data.name, type: r.data.type, size: r.data.size };
            });
        });
    }

    // Inject common CSS for chat
    function injectChatStyles() {
        if (document.getElementById('chat-core-styles')) return;
        var style = document.createElement('style');
        style.id = 'chat-core-styles';
        style.textContent = `
            .att-thumb{position:relative;display:inline-block;border-radius:8px;overflow:hidden;background:#f5f5f5;transition:transform 0.15s;width:70px;height:70px;flex-shrink:0}
            .att-thumb:hover{transform:scale(1.03)}
            .att-thumb img{width:100%;height:100%;object-fit:cover;border-radius:8px;display:block}
            .att-thumb-file{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f5f5f5;color:#667eea;font-weight:700}
            .att-thumb-file i{font-size:18px;margin-bottom:2px}
            .att-thumb-file span{font-size:0.5rem}
            .att-remove{position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:#e74c3c;color:#fff;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;z-index:10;box-shadow:0 1px 3px rgba(0,0,0,0.25);transition:transform 0.15s}
            .att-remove:hover{transform:scale(1.15)}
            .att-status{position:absolute;bottom:2px;left:2px;width:16px;height:16px;background:#4caf50;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px}
            .att-progress-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,0.85);border-radius:6px;z-index:5}
            .att-progress-ring{filter:drop-shadow(0 1px 2px rgba(0,0,0,0.1))}
            .att-progress-ring circle:first-child{stroke:#e5e7eb}
            .att-progress-circle{transition:stroke-dashoffset 0.15s ease-out;stroke:#667eea}
            .att-progress-text{font-size:0.6rem;font-weight:700;color:#667eea;margin-top:2px}
            .att-thumb.uploading{position:relative}
            .msg{display:flex;flex-direction:column;margin-bottom:0.5rem;max-width:80%}
            .msg-admin{align-self:flex-start}
            .msg-customer{align-self:flex-end;align-items:flex-end}
            .customer-view .msg-admin{align-self:flex-end;align-items:flex-end}
            .customer-view .msg-customer{align-self:flex-start}
            .msg-bubble{padding:0.6rem 1rem;border-radius:16px;font-size:0.9rem;line-height:1.6;word-wrap:break-word;white-space:pre-wrap}
            .msg-admin .msg-bubble{background:#667eea;color:#fff;border-bottom-right-radius:4px}
            .msg-customer .msg-bubble{background:#f3f4f6;color:#111;border-bottom-left-radius:4px}
            .customer-view .msg-admin .msg-bubble{background:#f3f4f6;color:#111;border-bottom-left-radius:4px}
            .customer-view .msg-customer .msg-bubble{background:#667eea;color:#fff;border-bottom-right-radius:4px}
            .msg-time{font-size:0.65rem;color:#999;margin-top:2px;padding:0 0.5rem;display:flex;align-items:center;gap:4px}
            .msg-seen{color:#667eea}
            .msg-tick{font-size:0.7rem;letter-spacing:-2px}
            .msg-pending{color:#bbb}
            .msg-sent{color:#4caf50}
            .msg-seen{color:#4caf50}
            .msg-attachments{display:flex;flex-wrap:wrap;gap:8px;margin-top:0.5rem}
            .typing-indicator{display:flex;gap:4px;padding:8px 16px;align-items:center}
            .typing-dot{width:6px;height:6px;background:#999;border-radius:50%;animation:typingBounce 1.4s infinite}
            .typing-dot:nth-child(2){animation-delay:0.2s}
            .typing-dot:nth-child(3){animation-delay:0.4s}
            @keyframes typingBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
        `;
        document.head.appendChild(style);
    }

    // Public API
    return {
        escapeHtml: escapeHtml,
        isImageFile: isImageFile,
        isHeicFile: isHeicFile,
        convertHeicToJpeg: convertHeicToJpeg,
        generateId: generateId,
        formatTime: formatTime,
        formatDate: formatDate,
        truncate: truncate,
        compressImage: compressImage,
        compressOversizedImage: compressOversizedImage,
        readFileAsDataURL: readFileAsDataURL,
        validateAttachment: validateAttachment,
        renderAttachmentThumb: renderAttachmentThumb,
        renderAttachmentProgress: renderAttachmentProgress,
        updateProgress: updateProgress,
        renderMessage: renderMessage,
        updateMessageTick: updateMessageTick,
        downloadAttachment: downloadAttachment,
        authorizeAttachmentImages: authorizeAttachmentImages,
        playNotificationSound: playNotificationSound,
        uploadToBlob: uploadToBlob,
        normalizeBlobUrl: normalizeBlobUrl,
        resolveAttachmentUrl: resolveAttachmentUrl,
        enqueueOffline: enqueueOffline,
        dequeueOffline: dequeueOffline,
        getOfflineQueue: getOfflineQueue,
        loadOfflineQueue: loadOfflineQueue,
        flushOfflineQueue: flushOfflineQueue,
        initSocket: initSocket,
        setSocketCallbacks: setSocketCallbacks,
        getSocket: getSocket,
        isSocketAvailable: isSocketAvailable,
        emitTyping: emitTyping,
        emitStopTyping: emitStopTyping,
        joinConversation: joinConversation,
        handleTyping: handleTyping,
        stopTyping: stopTyping,
        apiGet: apiGet,
        apiPost: apiPost,
        apiDelete: apiDelete,
        injectChatStyles: injectChatStyles,
        MAX_ATTACHMENTS: MAX_ATTACHMENTS,
        MAX_FILE_SIZE: MAX_FILE_SIZE,
        MAX_TOTAL_SIZE: MAX_TOTAL_SIZE,
        POLL_INTERVAL: POLL_INTERVAL,
        MAX_MESSAGE_LENGTH: MAX_MESSAGE_LENGTH
    };
});
