// CipherWave Test Suite
// This file contains tests to verify the functionality of the CipherWave application

// Test 1: Check if required DOM elements exist
function testDOMElements() {
    console.log("Running DOM Elements Test...");
    
    const requiredElements = [
        'tg-app',
        'messages-container',
        'message-input',
        'send-btn',
        'connection-modal',
        'room-id',
        'connect-btn',
        'cipher-select'
    ];
    
    let allElementsFound = true;
    
    requiredElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) {
            console.log(`✓ Element found: ${elementId}`);
        } else {
            console.error(`✗ Element not found: ${elementId}`);
            allElementsFound = false;
        }
    });
    
    return allElementsFound;
}

// Test 2: Check if CryptoJS is loaded
function testCryptoJS() {
    console.log("Running CryptoJS Test...");
    
    if (typeof CryptoJS !== 'undefined') {
        console.log("✓ CryptoJS is loaded");
        return true;
    } else {
        console.error("✗ CryptoJS is not loaded");
        return false;
    }
}

// Test 3: Check if WebRTC is supported
function testWebRTCSupport() {
    console.log("Running WebRTC Support Test...");
    
    if (typeof RTCPeerConnection !== 'undefined') {
        console.log("✓ WebRTC is supported");
        return true;
    } else {
        console.error("✗ WebRTC is not supported");
        return false;
    }
}

// Test 4: Check if WebSocket is supported
function testWebSocketSupport() {
    console.log("Running WebSocket Support Test...");
    
    if (typeof WebSocket !== 'undefined') {
        console.log("✓ WebSocket is supported");
        return true;
    } else {
        console.error("✗ WebSocket is not supported");
        return false;
    }
}

// Test 5: Test room ID generation
function testRoomIdGeneration() {
    console.log("Running Room ID Generation Test...");
    
    try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let roomId = '';
        for (let i = 0; i < 20; i++) {
            roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        if (roomId.length === 20) {
            console.log("✓ Room ID generation works correctly");
            console.log(`  Generated ID: ${roomId}`);
            return true;
        } else {
            console.error("✗ Room ID generation failed");
            return false;
        }
    } catch (error) {
        console.error("✗ Room ID generation failed with error:", error);
        return false;
    }
}

// Test 6: Test message display function
function testMessageDisplay() {
    console.log("Running Message Display Test...");
    
    try {
        // Create a test message
        const testMessage = "This is a test message";
        const messagesContainer = document.getElementById('messages-container');
        const initialMessageCount = messagesContainer.children.length;
        
        // Display the message
        if (typeof displayMessage !== 'undefined') {
            displayMessage(testMessage, 'sent');
            
            // Check if message was added
            const newMessageCount = messagesContainer.children.length;
            if (newMessageCount > initialMessageCount) {
                console.log("✓ Message display function works correctly");
                
                // Clean up test message
                messagesContainer.removeChild(messagesContainer.lastChild);
                return true;
            } else {
                console.error("✗ Message display function failed to add message");
                return false;
            }
        } else {
            console.error("✗ displayMessage function not found");
            return false;
        }
    } catch (error) {
        console.error("✗ Message display test failed with error:", error);
        return false;
    }
}

// Test 7: Test encryption functions
function testEncryption() {
    console.log("Running Encryption Test...");
    
    try {
        if (typeof CryptoJS !== 'undefined') {
            // Test AES encryption
            const testMessage = "This is a secret message";
            const testKey = CryptoJS.lib.WordArray.random(256/8);
            
            // Encrypt
            const encrypted = CryptoJS.AES.encrypt(testMessage, testKey).toString();
            
            // Decrypt
            const decrypted = CryptoJS.AES.decrypt(encrypted, testKey);
            const decryptedMessage = decrypted.toString(CryptoJS.enc.Utf8);
            
            if (decryptedMessage === testMessage) {
                console.log("✓ AES encryption/decryption works correctly");
                return true;
            } else {
                console.error("✗ AES encryption/decryption failed");
                return false;
            }
        } else {
            console.error("✗ CryptoJS not available for encryption test");
            return false;
        }
    } catch (error) {
        console.error("✗ Encryption test failed with error:", error);
        return false;
    }
}

// Update test results in UI
function updateTestResultsUI(testName, passed) {
    const container = document.getElementById('test-results-container');
    if (!container) return;
    
    const testItem = document.createElement('div');
    testItem.className = `test-item ${passed ? 'passed' : 'failed'}`;
    
    testItem.innerHTML = `
        <div class="test-icon">
            <i class="fas ${passed ? 'fa-check-circle' : 'fa-times-circle'}"></i>
        </div>
        <div class="test-name">${testName}</div>
        <div class="test-status">
            ${passed ? 'PASSED' : 'FAILED'}
        </div>
    `;
    
    container.appendChild(testItem);
}

// Update summary counts
function updateSummaryCounts(passed, total) {
    const passedElement = document.getElementById('passed-count');
    const failedElement = document.getElementById('failed-count');
    const totalElement = document.getElementById('total-count');
    
    if (passedElement) passedElement.textContent = passed;
    if (failedElement) failedElement.textContent = total - passed;
    if (totalElement) totalElement.textContent = total;
}

// Run all tests
function runAllTests() {
    console.log("Starting CipherWave Test Suite...\n");
    
    const tests = [
        { name: "DOM Elements Test", func: testDOMElements },
        { name: "CryptoJS Test", func: testCryptoJS },
        { name: "WebRTC Support Test", func: testWebRTCSupport },
        { name: "WebSocket Support Test", func: testWebSocketSupport },
        { name: "Room ID Generation Test", func: testRoomIdGeneration },
        { name: "Message Display Test", func: testMessageDisplay },
        { name: "Encryption Test", func: testEncryption }
    ];
    
    let passedTests = 0;
    let totalTests = tests.length;
    
    // Update total count immediately
    updateSummaryCounts(0, totalTests);
    
    tests.forEach((test, index) => {
        setTimeout(() => {
            try {
                const result = test.func();
                if (result) {
                    passedTests++;
                }
                updateTestResultsUI(test.name, result);
                updateSummaryCounts(passedTests, totalTests);
            } catch (error) {
                console.error(`✗ ${test.name} failed with error:`, error);
                updateTestResultsUI(test.name, false);
                updateSummaryCounts(passedTests, totalTests);
            }
            console.log(""); // Add spacing between tests
            
            // Show final summary
            if (index === tests.length - 1) {
                console.log(`Test Suite Complete: ${passedTests}/${totalTests} tests passed`);
                
                if (passedTests === totalTests) {
                    console.log("🎉 All tests passed! CipherWave is working correctly.");
                } else {
                    console.log("⚠️  Some tests failed. Please check the console for details.");
                }
            }
        }, 100 * index); // Stagger tests for better UI experience
    });
    
    return passedTests === totalTests;
}

// Run tests when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAllTests);
} else {
    runAllTests();
}
