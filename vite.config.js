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
      output: {
        manualChunks: {
          crypto: ["crypto-js", "libsodium-wrappers", "tweetnacl"],
          webrtc: ["simple-peer"],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
});
