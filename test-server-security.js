#!/usr/bin/env node

// Simple security test for CipherWave server
import WebSocket from 'ws';
import http from 'http';

const SERVER_URL = 'ws://localhost:52178';
const HTTP_URL = 'http://localhost:52178';

console.log('Starting CipherWave security tests...\n');

// Test 1: Health check endpoint
async function testHealthCheck() {
    try {
        const response = await fetch(`${HTTP_URL}/health`);
        const data = await response.json();
        console.log('✅ Health check endpoint working');
        console.log(`   Server uptime: ${Math.round(data.uptime / 1000)}s`);
        console.log(`   Active connections: ${data.stats.activeConnections}`);
    } catch (error) {
        console.log('❌ Health check failed:', error.message);
    }
}

// Test 2: Metrics endpoint
async function testMetrics() {
    try {
        const response = await fetch(`${HTTP_URL}/metrics`);
        const data = await response.text();
        console.log('✅ Metrics endpoint working');
        console.log(`   Metrics size: ${data.length} bytes`);
    } catch (error) {
        console.log('❌ Metrics test failed:', error.message);
    }
}

// Test 3: Rate limiting (send multiple requests rapidly)
async function testRateLimit() {
    console.log('🔄 Testing rate limiting...');
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
        promises.push(fetch(`${HTTP_URL}/health`));
    }
    
    try {
        const responses = await Promise.all(promises);
        const rateLimited = responses.some(r => r.status === 429);
        
        if (rateLimited) {
            console.log('✅ Rate limiting working (some requests blocked)');
        } else {
            console.log('⚠️  Rate limiting not triggered (may need more requests)');
        }
    } catch (error) {
        console.log('❌ Rate limit test failed:', error.message);
    }
}

// Test 4: WebSocket connection with invalid data
function testWebSocketSecurity() {
    return new Promise((resolve) => {
        console.log('🔄 Testing WebSocket security...');
        
        const ws = new WebSocket(SERVER_URL);
        let testsPassed = 0;
        let testsTotal = 3;
        
        ws.on('open', () => {
            console.log('   WebSocket connected');
            
            // Test invalid JSON
            setTimeout(() => {
                ws.send('invalid json');
            }, 100);
            
            // Test oversized message type
            setTimeout(() => {
                ws.send(JSON.stringify({
                    type: 'x'.repeat(100),
                    data: 'test'
                }));
            }, 200);
            
            // Test dangerous content
            setTimeout(() => {
                ws.send(JSON.stringify({
                    type: 'test',
                    content: '<script>alert("xss")</script>'
                }));
            }, 300);
            
            // Close after tests
            setTimeout(() => {
                ws.close();
                resolve(testsPassed);
            }, 1000);
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                if (message.type === 'error') {
                    testsPassed++;
                    console.log(`   ✅ Security validation working: ${message.error}`);
                }
            } catch (e) {
                // Ignore parse errors
            }
        });
        
        ws.on('error', (error) => {
            console.log(`   ❌ WebSocket error: ${error.message}`);
            resolve(testsPassed);
        });
        
        ws.on('close', () => {
            if (testsPassed >= 2) {
                console.log('✅ WebSocket security validations working');
            } else {
                console.log('⚠️  Some WebSocket security tests may have failed');
            }
            resolve(testsPassed);
        });
    });
}

// Test 5: Admin endpoint security
async function testAdminSecurity() {
    try {
        // Test without key
        const response1 = await fetch(`${HTTP_URL}/admin`);
        if (response1.status === 403) {
            console.log('✅ Admin endpoint properly secured (403 without key)');
        }
        
        // Test with key (development only)
        if (process.env.NODE_ENV !== 'production') {
            const response2 = await fetch(`${HTTP_URL}/admin?key=admin123`);
            if (response2.status === 200) {
                const data = await response2.json();
                console.log('✅ Admin endpoint accessible with key');
                console.log(`   Active rooms: ${data.server.rooms.length}`);
            }
        }
    } catch (error) {
        console.log('❌ Admin security test failed:', error.message);
    }
}

// Run all tests
async function runTests() {
    console.log('Make sure the server is running with: npm start\n');
    
    await testHealthCheck();
    console.log();
    
    await testMetrics();
    console.log();
    
    await testRateLimit();
    console.log();
    
    await testWebSocketSecurity();
    console.log();
    
    await testAdminSecurity();
    console.log();
    
    console.log('Security tests completed! ✨');
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(console.error);
}