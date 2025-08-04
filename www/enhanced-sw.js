// Enhanced Service Worker for CipherWave Advanced Features
const CACHE_NAME = 'cipherwave-advanced-v1';
const OFFLINE_URL = '/offline.html';

const CACHE_URLS = [
    '/',
    '/index.html',
    '/script.js',
    '/styles.css',
    '/advanced-features.js',
    '/adaptive-theme.js',
    '/pwa-manager.js',
    '/voice-manager.js',
    '/realtime-manager.js',
    '/file-manager.js',
    '/thread-manager.js',
    '/security-manager.js',
    '/cipherwave.png',
    '/offline.html'
];

// Install event - cache resources
self.addEventListener('install', event => {
    console.log('🔧 Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Caching app resources');
                return cache.addAll(CACHE_URLS);
            })
            .then(() => {
                console.log('✅ Service Worker installation complete');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ Service Worker installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('🔄 Service Worker activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('🗑️ Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Handle navigation requests
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // If network request succeeds, return it
                    return response;
                })
                .catch(() => {
                    // If network fails, return cached page or offline page
                    return caches.open(CACHE_NAME)
                        .then(cache => {
                            return cache.match(event.request.url) || cache.match(OFFLINE_URL);
                        });
                })
        );
        return;
    }

    // Handle other requests with cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    // Return cached version
                    return response;
                }

                // Fetch from network
                return fetch(event.request)
                    .then(response => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response for caching
                        const responseToCache = response.clone();
                        
                        // Cache the response
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    });
            })
            .catch(() => {
                // Return offline fallback for essential resources
                if (event.request.destination === 'document') {
                    return caches.match(OFFLINE_URL);
                }
                
                // Return a simple offline response for other resources
                return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
            })
    );
});

// Background sync for message queue
self.addEventListener('sync', event => {
    console.log('📤 Background sync triggered:', event.tag);
    
    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    } else if (event.tag === 'sync-files') {
        event.waitUntil(syncFiles());
    }
});

async function syncMessages() {
    try {
        console.log('📨 Syncing queued messages...');
        
        // Get queued messages from IndexedDB or localStorage
        const messages = await getQueuedMessages();
        
        if (messages.length === 0) {
            console.log('📭 No messages to sync');
            return;
        }

        console.log(`📤 Syncing ${messages.length} messages`);
        
        // Send each message
        for (const message of messages) {
            try {
                await sendMessage(message);
                await removeFromQueue(message.id);
                console.log('✅ Message synced:', message.id);
            } catch (error) {
                console.error('❌ Failed to sync message:', message.id, error);
                // Keep message in queue for retry
            }
        }
        
        // Notify main thread of sync completion
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'sync-complete',
                data: { messageCount: messages.length }
            });
        });
        
    } catch (error) {
        console.error('❌ Background message sync failed:', error);
    }
}

async function syncFiles() {
    try {
        console.log('📁 Syncing queued files...');
        
        // Get queued files from IndexedDB or localStorage
        const files = await getQueuedFiles();
        
        if (files.length === 0) {
            console.log('📭 No files to sync');
            return;
        }

        console.log(`📤 Syncing ${files.length} files`);
        
        // Send each file
        for (const file of files) {
            try {
                await sendFile(file);
                await removeFileFromQueue(file.id);
                console.log('✅ File synced:', file.id);
            } catch (error) {
                console.error('❌ Failed to sync file:', file.id, error);
            }
        }
        
    } catch (error) {
        console.error('❌ Background file sync failed:', error);
    }
}

// Notification click handling
self.addEventListener('notificationclick', event => {
    console.log('🔔 Notification clicked:', event.notification.tag);
    
    event.notification.close();
    
    if (event.action === 'refresh') {
        // Refresh all clients
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'refresh-request' });
                });
            })
        );
    } else if (event.action === 'reply' && event.notification.tag) {
        // Handle quick reply
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                if (clients.length > 0) {
                    clients[0].focus();
                    clients[0].postMessage({
                        type: 'quick-reply',
                        messageId: event.notification.tag
                    });
                } else {
                    return self.clients.openWindow('/');
                }
            })
        );
    } else {
        // Focus the app
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                if (clients.length > 0) {
                    return clients[0].focus();
                }
                return self.clients.openWindow('/');
            })
        );
    }
});

// Push notification handling
self.addEventListener('push', event => {
    console.log('📱 Push notification received');
    
    let notificationData = {
        title: 'CipherWave',
        body: 'New message received',
        icon: '/cipherwave.png',
        badge: '/cipherwave.png',
        tag: 'message',
        requireInteraction: false,
        actions: [
            {
                action: 'reply',
                title: 'Reply',
                icon: '/icons/reply.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/icons/dismiss.png'
            }
        ]
    };

    if (event.data) {
        try {
            const pushData = event.data.json();
            notificationData = { ...notificationData, ...pushData };
        } catch (error) {
            console.warn('Failed to parse push data:', error);
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, notificationData)
            .then(() => {
                console.log('✅ Notification displayed');
            })
            .catch(error => {
                console.error('❌ Failed to show notification:', error);
            })
    );
});

// Message handling from main thread
self.addEventListener('message', event => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'queue-message':
            queueMessage(data);
            break;
        case 'queue-file':
            queueFile(data);
            break;
        case 'clear-cache':
            clearCache();
            break;
        case 'update-cache':
            updateCache(data.urls);
            break;
        default:
            console.log('Unknown message type:', type);
    }
});

// Helper functions for message queue management
async function getQueuedMessages() {
    try {
        // Try IndexedDB first, fallback to localStorage
        if ('indexedDB' in self) {
            return await getMessagesFromIndexedDB();
        } else {
            const stored = localStorage.getItem('cipherwave-message-queue');
            return stored ? JSON.parse(stored) : [];
        }
    } catch (error) {
        console.error('Failed to get queued messages:', error);
        return [];
    }
}

async function getQueuedFiles() {
    try {
        if ('indexedDB' in self) {
            return await getFilesFromIndexedDB();
        } else {
            const stored = localStorage.getItem('cipherwave-file-queue');
            return stored ? JSON.parse(stored) : [];
        }
    } catch (error) {
        console.error('Failed to get queued files:', error);
        return [];
    }
}

async function queueMessage(messageData) {
    try {
        if ('indexedDB' in self) {
            await storeMessageInIndexedDB(messageData);
        } else {
            const queue = await getQueuedMessages();
            queue.push(messageData);
            localStorage.setItem('cipherwave-message-queue', JSON.stringify(queue));
        }
        console.log('✅ Message queued:', messageData.id);
    } catch (error) {
        console.error('❌ Failed to queue message:', error);
    }
}

async function queueFile(fileData) {
    try {
        if ('indexedDB' in self) {
            await storeFileInIndexedDB(fileData);
        } else {
            const queue = await getQueuedFiles();
            queue.push(fileData);
            localStorage.setItem('cipherwave-file-queue', JSON.stringify(queue));
        }
        console.log('✅ File queued:', fileData.id);
    } catch (error) {
        console.error('❌ Failed to queue file:', error);
    }
}

async function removeFromQueue(messageId) {
    try {
        if ('indexedDB' in self) {
            await removeMessageFromIndexedDB(messageId);
        } else {
            const queue = await getQueuedMessages();
            const filtered = queue.filter(msg => msg.id !== messageId);
            localStorage.setItem('cipherwave-message-queue', JSON.stringify(filtered));
        }
    } catch (error) {
        console.error('Failed to remove message from queue:', error);
    }
}

async function removeFileFromQueue(fileId) {
    try {
        if ('indexedDB' in self) {
            await removeFileFromIndexedDB(fileId);
        } else {
            const queue = await getQueuedFiles();
            const filtered = queue.filter(file => file.id !== fileId);
            localStorage.setItem('cipherwave-file-queue', JSON.stringify(filtered));
        }
    } catch (error) {
        console.error('Failed to remove file from queue:', error);
    }
}

async function sendMessage(messageData) {
    // In a real implementation, this would send the message to the server
    // For this demo, we'll simulate a network request
    const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
}

async function sendFile(fileData) {
    // In a real implementation, this would upload the file to the server
    const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(fileData)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
}

// IndexedDB helpers (simplified implementation)
async function getMessagesFromIndexedDB() {
    // Simplified IndexedDB implementation
    return [];
}

async function getFilesFromIndexedDB() {
    return [];
}

async function storeMessageInIndexedDB(messageData) {
    // Simplified IndexedDB implementation
}

async function storeFileInIndexedDB(fileData) {
    // Simplified IndexedDB implementation
}

async function removeMessageFromIndexedDB(messageId) {
    // Simplified IndexedDB implementation
}

async function removeFileFromIndexedDB(fileId) {
    // Simplified IndexedDB implementation
}

async function clearCache() {
    try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('✅ Cache cleared');
    } catch (error) {
        console.error('❌ Failed to clear cache:', error);
    }
}

async function updateCache(urls) {
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(urls);
        console.log('✅ Cache updated with new URLs');
    } catch (error) {
        console.error('❌ Failed to update cache:', error);
    }
}

// Skip waiting when new service worker is available
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('🚀 CipherWave Enhanced Service Worker loaded');