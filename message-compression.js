// CipherWave Message Compression
// Implements compression for better bandwidth utilization

class MessageCompression {
    constructor() {
        this.compressionSupported = this.checkCompressionSupport();
        this.compressionRatio = 0;
        this.stats = {
            originalBytes: 0,
            compressedBytes: 0,
            messagesProcessed: 0
        };
    }
    
    checkCompressionSupport() {
        // Check for native compression support
        const hasCompressionStream = 'CompressionStream' in window;
        const hasDecompressionStream = 'DecompressionStream' in window;
        
        return hasCompressionStream && hasDecompressionStream;
    }
    
    // Compress message using native Compression Streams API
    async compressMessage(message) {
        if (!this.compressionSupported) {
            return { compressed: false, data: message };
        }
        
        try {
            const originalSize = new TextEncoder().encode(message).length;
            
            // Skip compression for very small messages (overhead not worth it)
            if (originalSize < 100) {
                return { compressed: false, data: message };
            }
            
            const stream = new CompressionStream('gzip');
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();
            
            // Write data
            await writer.write(new TextEncoder().encode(message));
            await writer.close();
            
            // Read compressed data
            const chunks = [];
            let done = false;
            
            while (!done) {
                const { value, done: streamDone } = await reader.read();
                done = streamDone;
                if (value) {
                    chunks.push(value);
                }
            }
            
            // Combine chunks
            const compressedArray = new Uint8Array(
                chunks.reduce((acc, chunk) => acc + chunk.length, 0)
            );
            let offset = 0;
            for (const chunk of chunks) {
                compressedArray.set(chunk, offset);
                offset += chunk.length;
            }
            
            // Convert to base64 for JSON transmission
            const compressedData = this.arrayBufferToBase64(compressedArray);
            const compressedSize = compressedData.length;
            
            // Update statistics
            this.updateCompressionStats(originalSize, compressedSize);
            
            // Only use compression if it actually reduces size
            if (compressedSize < originalSize * 0.9) {
                return {
                    compressed: true,
                    data: compressedData,
                    originalSize: originalSize,
                    compressedSize: compressedSize,
                    ratio: ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
                };
            } else {
                return { compressed: false, data: message };
            }
            
        } catch (error) {
            console.error('Compression failed:', error);
            return { compressed: false, data: message };
        }
    }
    
    // Decompress message
    async decompressMessage(compressedData) {
        if (!compressedData.compressed) {
            return compressedData.data;
        }
        
        try {
            // Convert base64 back to ArrayBuffer
            const compressedArray = this.base64ToArrayBuffer(compressedData.data);
            
            const stream = new DecompressionStream('gzip');
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();
            
            // Write compressed data
            await writer.write(compressedArray);
            await writer.close();
            
            // Read decompressed data
            const chunks = [];
            let done = false;
            
            while (!done) {
                const { value, done: streamDone } = await reader.read();
                done = streamDone;
                if (value) {
                    chunks.push(value);
                }
            }
            
            // Combine chunks and convert to string
            const decompressedArray = new Uint8Array(
                chunks.reduce((acc, chunk) => acc + chunk.length, 0)
            );
            let offset = 0;
            for (const chunk of chunks) {
                decompressedArray.set(chunk, offset);
                offset += chunk.length;
            }
            
            return new TextDecoder().decode(decompressedArray);
            
        } catch (error) {
            console.error('Decompression failed:', error);
            throw new Error('Failed to decompress message');
        }
    }
    
    // Fallback compression using simple algorithms for unsupported browsers
    async fallbackCompress(message) {
        // Simple run-length encoding for repetitive text
        let compressed = '';
        let count = 1;
        let currentChar = message[0];
        
        for (let i = 1; i < message.length; i++) {
            if (message[i] === currentChar && count < 9) {
                count++;
            } else {
                if (count > 3) {
                    compressed += `${count}${currentChar}`;
                } else {
                    compressed += currentChar.repeat(count);
                }
                currentChar = message[i];
                count = 1;
            }
        }
        
        // Add the last sequence
        if (count > 3) {
            compressed += `${count}${currentChar}`;
        } else {
            compressed += currentChar.repeat(count);
        }
        
        const originalSize = message.length;
        const compressedSize = compressed.length;
        
        if (compressedSize < originalSize * 0.9) {
            this.updateCompressionStats(originalSize, compressedSize);
            return {
                compressed: true,
                algorithm: 'rle',
                data: compressed,
                originalSize: originalSize,
                compressedSize: compressedSize,
                ratio: ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
            };
        }
        
        return { compressed: false, data: message };
    }
    
    // Fallback decompression
    fallbackDecompress(compressedData) {
        if (!compressedData.compressed || compressedData.algorithm !== 'rle') {
            return compressedData.data;
        }
        
        let decompressed = '';
        const data = compressedData.data;
        
        for (let i = 0; i < data.length; i++) {
            const char = data[i];
            if (char >= '2' && char <= '9' && i + 1 < data.length) {
                const count = parseInt(char);
                const repeatChar = data[i + 1];
                decompressed += repeatChar.repeat(count);
                i++; // Skip the repeated character
            } else {
                decompressed += char;
            }
        }
        
        return decompressed;
    }
    
    // Utility functions
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
    
    updateCompressionStats(originalSize, compressedSize) {
        this.stats.originalBytes += originalSize;
        this.stats.compressedBytes += compressedSize;
        this.stats.messagesProcessed++;
        
        this.compressionRatio = this.stats.originalBytes > 0 ? 
            ((this.stats.originalBytes - this.stats.compressedBytes) / this.stats.originalBytes * 100) : 0;
    }
    
    // Get compression statistics
    getStats() {
        return {
            supported: this.compressionSupported,
            messagesProcessed: this.stats.messagesProcessed,
            originalBytes: this.stats.originalBytes,
            compressedBytes: this.stats.compressedBytes,
            averageCompressionRatio: this.compressionRatio.toFixed(1) + '%',
            bandwidthSaved: (this.stats.originalBytes - this.stats.compressedBytes),
            bandwidthSavedMB: ((this.stats.originalBytes - this.stats.compressedBytes) / 1024 / 1024).toFixed(2)
        };
    }
    
    // Test compression effectiveness
    async testCompression(testMessage) {
        console.log('Testing compression with message:', testMessage.substring(0, 50) + '...');
        
        const start = performance.now();
        const compressed = await this.compressMessage(testMessage);
        const compressTime = performance.now() - start;
        
        if (compressed.compressed) {
            const decompressStart = performance.now();
            const decompressed = await this.decompressMessage(compressed);
            const decompressTime = performance.now() - decompressStart;
            
            const success = decompressed === testMessage;
            
            console.log('Compression test results:', {
                success: success,
                originalSize: testMessage.length,
                compressedSize: compressed.compressedSize || compressed.data.length,
                compressionRatio: compressed.ratio || '0%',
                compressTime: compressTime.toFixed(2) + 'ms',
                decompressTime: decompressTime.toFixed(2) + 'ms'
            });
            
            return success;
        } else {
            console.log('Message not compressed (too small or no benefit)');
            return true;
        }
    }
    
    // Reset statistics
    resetStats() {
        this.stats = {
            originalBytes: 0,
            compressedBytes: 0,
            messagesProcessed: 0
        };
        this.compressionRatio = 0;
    }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessageCompression;
} else {
    window.MessageCompression = MessageCompression;
}