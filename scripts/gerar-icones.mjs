// Gera os ícones em PNG a partir de public/icones/favicon.svg. Uso: node scripts/gerar-icones.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(import.meta.url)("@playwright/test");
const svg = readFileSync(`${raiz}/public/icones/favicon.svg`, "utf-8");
const navegador = await chromium.launch();
for (const lado of [32, 180, 192, 512]) {
  const pagina = await navegador.newPage({ viewport: { width: lado, height: lado }, deviceScaleFactor: 1 });
  await pagina.setContent(`<style>html,body{margin:0;background:#000}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg}`);
  await pagina.screenshot({ path: `${raiz}/public/icones/${lado}.png` });
  await pagina.close();
}
await navegador.close();
