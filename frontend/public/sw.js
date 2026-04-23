// Service Worker for PollGen PWA
var CACHE_NAME = 'pollgen-v1';
var OFFLINE_PAGE = '/offline';
var PRECACHE_URLS = [
    '/',
    '/index.html',
    '/offline',
    // Add other core assets you want to cache for offline use
];
// Install event - cache the application shell
self.addEventListener('install', function (event) {
    event.waitUntil(caches.open(CACHE_NAME)
        .then(function (cache) {
        console.log('Opened cache');
        return cache.addAll(PRECACHE_URLS);
    }));
});
// Activate event - clean up old caches
self.addEventListener('activate', function (event) {
    var cacheWhitelist = [CACHE_NAME];
    event.waitUntil(caches.keys().then(function (cacheNames) {
        return Promise.all(cacheNames.map(function (cacheName) {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
                return caches.delete(cacheName);
            }
        }));
    }));
});
// Fetch event - serve from cache, falling back to network
self.addEventListener('fetch', function (event) {
    // Skip cross-origin requests, like those for Google Analytics
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    event.respondWith(caches.match(event.request)
        .then(function (response) {
        // Cache hit - return response
        if (response) {
            return response;
        }
        // Clone the request
        var fetchRequest = event.request.clone();
        return fetch(fetchRequest).then(function (response) {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
            }
            // Clone the response
            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
                .then(function (cache) {
                cache.put(event.request, responseToCache);
            });
            return response;
        }, 
        // If fetch fails, return the offline page
        function () {
            if (event.request.mode === 'navigate') {
                return caches.match(OFFLINE_PAGE);
            }
            return new Response('You are offline and the requested resource is not in the cache.');
        });
    }));
});
// Listen for messages from the main thread
self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
