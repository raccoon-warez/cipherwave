import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  plugins: [
    legacy({
      targets: ["defaults", "not IE 11"],
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5000000, // 5MB
      },
      manifest: {
        name: "CipherWave",
        short_name: "CipherWave",
        description: "Secure P2P Messenger",
        theme_color: "#6C63FF",
        background_color: "#181A20",
        display: "standalone",
        icons: [
          {
            src: "cipherwave.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "cipherwave.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  build: {
    target: "esnext",
    minify: "terser",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index-optimized.html'
      },
      output: {
        manualChunks: (id) => {
          // Core crypto library - use only libsodium-wrappers
          if (id.includes('libsodium-wrappers')) {
            return 'crypto-core';
          }
          
          // WebRTC functionality
          if (id.includes('simple-peer')) {
            return 'webrtc-core';
          }
          
          // Large UI managers - dynamically imported
          if (id.includes('file-manager.js') || id.includes('voice-manager.js')) {
            return 'ui-heavy';
          }
          
          // Mobile-specific code
          if (id.includes('@capacitor/core') || 
              id.includes('@capacitor/splash-screen') || 
              id.includes('@capacitor/status-bar') ||
              id.includes('mobile-manager.js')) {
            return 'mobile';
          }
          
          // Vendor libraries
          if (id.includes('uuid') || id.includes('ws')) {
            return 'vendor';
          }
          
          // Core managers
          if (id.includes('security-manager.js') || 
              id.includes('connection-manager.js') || 
              id.includes('message-manager.js') ||
              id.includes('ui-manager.js')) {
            return 'core';
          }
          
          // Node modules (except already handled ones)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        // Optimize chunk names and hashes
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().replace(/\.[^/.]+$/, '')
            : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        }
      },
    },
    // Increase chunk size warning limit for crypto libraries
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['libsodium-wrappers', 'simple-peer', 'uuid'],
    exclude: ['crypto-js', 'tweetnacl'] // Remove duplicate crypto libraries
  },
  // Define globals for replaced libraries
  define: {
    global: 'globalThis',
  },
});
