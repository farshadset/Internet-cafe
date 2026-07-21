const CACHE_NAME = 'chillinet-v3';
const STATIC_CACHE = 'chillinet-static-v3';
const DYNAMIC_CACHE = 'chillinet-dynamic-v3';
const IMAGE_CACHE = 'chillinet-images-v3';

const PRECACHE_URLS = [
    '/',
    '/index',
    '/login',
    '/style.css',
    '/libs/utils.js',
    '/libs/notie.min.js',
    '/libs/notie.min.css',
    '/libs/chat-core.js',
    '/libs/browser-image-compression.js',
];

// Install: precache critical static assets
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(function(cache) {
                return cache.addAll(PRECACHE_URLS);
            })
            .then(function() {
                return self.skipWaiting();
            })
    );
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(name) {
                    if (name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== IMAGE_CACHE) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', function(event) {
    var url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API calls (network only for dynamic data)
    if (url.pathname.startsWith('/api/')) {
        // Network-first for API calls
        event.respondWith(
            fetch(event.request)
                .then(function(response) {
                    return response;
                })
                .catch(function() {
                    // Return cached version if available for read-only APIs
                    if (url.pathname.startsWith('/api/pricing') || url.pathname.startsWith('/api/banner')) {
                        return caches.match(event.request);
                    }
                    return new Response(JSON.stringify({ error: 'آفلاین هستید' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // Cache-first for static assets (CSS, JS, fonts, images)
    if (/\.(css|js|woff2?|ttf|eot|svg|ico)$/i.test(url.pathname)) {
        event.respondWith(
            caches.match(event.request).then(function(cached) {
                if (cached) return cached;
                return fetch(event.request).then(function(response) {
                    if (response.ok) {
                        var clone = response.clone();
                        caches.open(STATIC_CACHE).then(function(cache) {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Cache-first for uploaded images
    if (url.pathname.startsWith('/uploads/')) {
        event.respondWith(
            caches.match(event.request).then(function(cached) {
                if (cached) return cached;
                return fetch(event.request).then(function(response) {
                    if (response.ok) {
                        var clone = response.clone();
                        caches.open(IMAGE_CACHE).then(function(cache) {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Stale-while-revalidate for HTML pages
    if (url.pathname === '/' || /^\/[\w-]+\/?$/.test(url.pathname)) {
        event.respondWith(
            caches.open(DYNAMIC_CACHE).then(function(cache) {
                return cache.match(event.request).then(function(cached) {
                    var fetchPromise = fetch(event.request).then(function(response) {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(function() {
                        return cached;
                    });
                    return cached || fetchPromise;
                });
            })
        );
        return;
    }

    // Default: network-first with cache fallback
    event.respondWith(
        fetch(event.request)
            .then(function(response) {
                if (response.ok && url.protocol === 'https:') {
                    var clone = response.clone();
                    caches.open(DYNAMIC_CACHE).then(function(cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            })
            .catch(function() {
                return caches.match(event.request);
            })
    );
});
