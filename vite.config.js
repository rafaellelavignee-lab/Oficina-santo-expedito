import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-16.png", "favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "Santo Expedito",
        short_name: "Santo Expedito",
        description: "Sistema de gestão da oficina Santo Expedito",
        lang: "pt-BR",
        start_url: "/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#dc2626",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Dados de venda/estoque/usuários nunca devem vir do cache — só os
        // arquivos estáticos (JS/CSS/ícones) ficam cacheados para abrir mais rápido.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
});
