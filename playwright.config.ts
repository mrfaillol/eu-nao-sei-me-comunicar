import { defineConfig } from "@playwright/test";

const PORTA = 5188;

export default defineConfig({
  testDir: "e2e",
  // A animação do zoom não avança com relógio virtual: os testes rodam em tempo real.
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORTA}`, trace: "off", locale: "pt-BR" },
  webServer: [
    { command: `pnpm exec vite --port ${PORTA} --strictPort`, url: `http://localhost:${PORTA}`, reuseExistingServer: true, timeout: 60_000 },
    // O site construído, para os testes que dependem do service worker. `pnpm e2e` constrói antes.
    { command: "pnpm exec vite preview --port 5189 --strictPort", url: "http://localhost:5189", reuseExistingServer: true, timeout: 60_000 },
  ],
  projects: [
    { name: "celular", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: "mesa", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
