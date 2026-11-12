// Capturas do site publicado em quatro tamanhos de tela, nos três idiomas: a tela de entrada em todos,
// e a caixa da frase em celular e em notebook. Uso: node scripts/capturas-por-tela.mjs [url] [pasta]
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.argv[2] ?? "https://eunaoseimecomunicar.vercel.app/";
const pasta = resolve(process.argv[3] ?? join(raiz, "docs", "capturas", "telas"));
const { chromium } = createRequire(import.meta.url)("@playwright/test");

const TELAS = [
  { nome: "celular", largura: 390, altura: 844, toque: true },
  { nome: "tablet", largura: 820, altura: 1180, toque: true },
  { nome: "notebook", largura: 1440, altura: 900, toque: false },
  { nome: "monitor", largura: 1920, altura: 1080, toque: false },
];
const IDIOMAS = [["pt-BR", "pt-BR"], ["en", "en-GB"], ["zh-CN", "zh-CN"]];

mkdirSync(pasta, { recursive: true });
const navegador = await chromium.launch();
const feitas = [];
for (const [idioma, localidade] of IDIOMAS) {
  for (const tela of TELAS) {
    const contexto = await navegador.newContext({ viewport: { width: tela.largura, height: tela.altura }, deviceScaleFactor: 2, locale: localidade, hasTouch: tela.toque, isMobile: tela.toque && tela.largura < 600 });
    const page = await contexto.newPage();
    // O mesmo sorteio em todas as telas: assim as capturas mostram as mesmas pinturas e palavras, e só a tela muda.
    await page.addInitScript(() => {
      let a = 2026;
      Math.random = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator(".moldura").first().waitFor();
    await page.waitForTimeout(2600); // as pinturas terminam de se aproximar dos rostos
    const entrada = join(pasta, `${idioma}-${tela.nome}-entrada.jpg`);
    await page.screenshot({ path: entrada, type: "jpeg", quality: 90 });
    feitas.push(entrada);

    if (tela.nome === "celular" || tela.nome === "notebook") {
      await page.locator(".moldura").first().click();
      await page.waitForTimeout(450);
      await page.locator(".opcao-som .escolher").first().click();
      await page.waitForTimeout(450);
      await page.locator("button.palavra").first().click();
      await page.locator('[data-acao="ver-frase"]').click();
      await page.locator('dialog[data-dialogo="resultado"] .frase[data-origem]').waitFor();
      await page.waitForTimeout(300);
      const frase = join(pasta, `${idioma}-${tela.nome}-frase.jpg`);
      await page.screenshot({ path: frase, type: "jpeg", quality: 90 });
      feitas.push(frase);
    }
    await contexto.close();
  }
}
await navegador.close();
console.log(`${feitas.length} capturas em ${pasta}`);
