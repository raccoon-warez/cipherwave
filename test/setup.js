// Test setup for CipherWave
// Global test configuration and mocks

import { vi } from 'vitest';

// Mock browser APIs
Object.defineProperty(global, 'crypto', {
    value: {
        getRandomValues: vi.fn((arr) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        }),
        randomUUID: vi.fn(() => 'mock-uuid-' + Math.random().toString(36))
    },
    writable: true
});

// Mock performance API
global.performance = {
    now: vi.fn(() => Date.now()),
    memory: {
        usedJSHeapSize: 10000000,
        totalJSHeapSize: 50000000,
        jsHeapSizeLimit: 2147483648
    }
};

// Mock console methods to reduce test noise
global.console = {
    ...console,
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
};

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
};
global.localStorage = localStorageMock;

// Mock sessionStorage
global.sessionStorage = localStorageMock;

// Mock URL
global.URL = {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn()
};

// Mock Blob
global.Blob = vi.fn((parts, options) => ({
    size: parts.reduce((total, part) => total + part.length, 0),
    type: options?.type || '',
    parts: parts
}));

// Mock File
global.File = vi.fn((parts, name, options) => ({
    ...new Blob(parts, options),
    name: name,
    lastModified: Date.now()
}));

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
    readyState: 1, // OPEN
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null
}));

// Mock Worker
global.Worker = vi.fn(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
}));

// Mock fetch
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        blob: () => Promise.resolve(new Blob())
    })
);

// Mock setTimeout and setInterval to be synchronous in tests
global.setTimeout = vi.fn((fn) => {
    fn();
    return 1;
});

global.setInterval = vi.fn((fn) => {
    fn();
    return 1;
});

global.clearTimeout = vi.fn();
global.clearInterval = vi.fn();

// Mock CryptoJS (basic implementation for tests)
global.CryptoJS = {
    lib: {
        WordArray: {
            create: vi.fn((words) => ({ words, sigBytes: words ? words.length * 4 : 0 })),
            random: vi.fn((bytes) => ({ 
                words: new Array(Math.ceil(bytes / 4)).fill(0).map(() => Math.random() * 0xFFFFFFFF | 0),
                sigBytes: bytes,
                toString: () => 'mock-random-string'
            }))
        }
    },
    enc: {
        Utf8: {
            parse: vi.fn((str) => ({ words: [str.charCodeAt(0)], sigBytes: str.length })),
            stringify: vi.fn((wordArray) => String.fromCharCode(wordArray.words[0] || 65))
        },
        Hex: {
            parse: vi.fn((hex) => ({ words: [parseInt(hex.substring(0, 8), 16) || 0], sigBytes: hex.length / 2 })),
            stringify: vi.fn((wordArray) => (wordArray.words[0] || 0).toString(16).padStart(8, '0'))
        }
    },
    AES: {
        encrypt: vi.fn((message, key) => ({
            toString: () => 'mock-encrypted-' + message
        })),
        decrypt: vi.fn((ciphertext, key) => ({
            toString: (encoding) => {
                if (encoding === global.CryptoJS.enc.Utf8) {
                    return ciphertext.replace('mock-encrypted-', '');
                }
                return ciphertext;
            }
        }))
    },
    HmacSHA256: vi.fn((message, key) => ({
        toString: () => 'mock-hmac-' + message + '-' + key
    })),
    SHA256: vi.fn((message) => ({
        toString: () => 'mock-sha256-' + message
    })),
    mode: {
        CBC: 'cbc',
        GCM: 'gcm'
    },
    pad: {
        Pkcs7: 'pkcs7'
    }
};

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
}));

// Mock MutationObserver  
global.MutationObserver = vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => [])
}));

// Mock navigator
global.navigator = {
    ...global.navigator,
    onLine: true,
    userAgent: 'Mozilla/5.0 (Test Environment)',
    language: 'en-US',
    languages: ['en-US', 'en'],
    cookieEnabled: true,
    connection: {
        effectiveType: '4g',
        downlink: 10,
        rtt: 100
    },
    mediaDevices: {
        getUserMedia: vi.fn(() => Promise.resolve({})),
        enumerateDevices: vi.fn(() => Promise.resolve([]))
    }
};

// Mock window
global.window = {
    ...global.window,
    crypto: global.crypto,
    performance: global.performance,
    localStorage: global.localStorage,
    sessionStorage: global.sessionStorage,
    navigator: global.navigator,
    location: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
        hostname: 'localhost',
        port: '3000',
        pathname: '/',
        search: '',
        hash: ''
    },
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
};

// Set up test environment flags
process.env.NODE_ENV = 'test';

// Suppress expected console warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
    const message = args[0];
    if (typeof message === 'string' && (
        message.includes('Using fallback random generation') ||
        message.includes('Crypto worker error') ||
        message.includes('WebRTC not supported')
    )) {
        return; // Suppress expected test warnings
    }
    originalWarn.apply(console, args);
};