import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { interpretarEmDesenvolvimento } from "./src/servidor/dev";

export default defineConfig({
  // Caminhos relativos: o mesmo pacote serve num domínio, numa subpasta e dentro da casca do Capacitor.
  base: "./",
  plugins: [
    interpretarEmDesenvolvimento(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Eu Não Sei Me Comunicar",
        short_name: "Não Sei Dizer",
        description: "Três ou mais escolhas entre pinturas, sons e palavras, e uma frase que descreve o que a seleção comunica.",
        lang: "pt-BR",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: "icones/192.png", sizes: "192x192", type: "image/png" },
          { src: "icones/512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // O acervo inteiro fica no aparelho: depois da primeira visita o site não depende de rede.
        globPatterns: ["**/*.{js,css,html,json,webp,jpg,mp3,png,svg,webmanifest}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
