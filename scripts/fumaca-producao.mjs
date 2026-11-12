// Fumaça de produção: faz o fluxo inteiro no site publicado, em celular e em tela larga, nos três idiomas,
// e repete sem rede. Uso: node scripts/fumaca-producao.mjs [url] [pasta-das-capturas]
// Sai com código 1 se alguma conferência falhar. As capturas só são gravadas quando a pasta é informada.
import { createRequire } from "node:module";

const base = process.argv[2] ?? "https://eunaoseimecomunicar.vercel.app/";
const saida = process.argv[3] ?? null;
const { chromium } = createRequire(import.meta.url)("@playwright/test");
const origem = new URL(base).origin;
const falhas = [];
const anotar = (ok, texto) => { console.log(`${ok ? "ok  " : "FALHA"} ${texto}`); if (!ok) falhas.push(texto); };

async function fluxo(navegador, nome, opcoes, captura) {
  const contexto = await navegador.newContext({ deviceScaleFactor: 2, ...opcoes });
  const page = await contexto.newPage();
  const ruins = [], externas = [], erros = [];
  page.on("response", (r) => { if (r.status() >= 400) ruins.push(`${r.status()} ${r.url()}`); });
  page.on("request", (r) => { if (!r.url().startsWith(origem) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) externas.push(r.url()); });
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
  page.on("pageerror", (e) => erros.push(String(e)));

  await page.goto(base, { waitUntil: "networkidle" });
  anotar((await page.locator(".moldura").count()) === 3, `${nome}: três pinturas na tela`);
  anotar((await page.locator("h1").first().textContent() ?? "").trim().length > 0, `${nome}: título "${(await page.locator("h1").first().textContent() ?? "").trim()}"`);
  const imagens = await page.evaluate(() => [...document.querySelectorAll(".moldura img")].map((i) => i.complete && i.naturalWidth > 0));
  anotar(imagens.length >= 3 && imagens.every(Boolean), `${nome}: todas as imagens das molduras carregaram (${imagens.filter(Boolean).length} de ${imagens.length})`);

  await page.locator(".moldura").first().click();
  await page.locator(".opcao-som .tocar").first().click();
  await page.waitForTimeout(900);
  const som = await page.evaluate(() => { const a = document.querySelector("audio"); return a ? { pausado: a.paused, tempo: a.currentTime, erro: a.error?.code ?? null } : null; });
  const pressionado = await page.locator(".opcao-som .tocar").first().getAttribute("aria-pressed");
  anotar(pressionado === "true", `${nome}: botão de som marcado como tocando${som ? ` (áudio no DOM: tempo ${som.tempo.toFixed(2)} s, erro ${som.erro})` : ""}`);
  await page.locator(".opcao-som .escolher").first().click();
  await page.locator("button.palavra").first().click();

  // O (i) de cada item: palavras de quem descreveu, sem sair do site.
  await page.locator(".opcao-palavra .info").first().click();
  const definicao = ((await page.locator(".info-caixa .info-glosa").textContent().catch(() => "")) ?? "").trim();
  anotar(definicao.length > 3, `${nome}: o (i) da palavra mostra a definição "${definicao.slice(0, 50)}"`);
  await page.keyboard.press("Escape");
  await page.locator(".opcao-pintura .info").first().click();
  const palavras = await page.locator(".info-caixa .info-palavras li").count();
  anotar(palavras >= 3, `${nome}: o (i) da pintura mostra ${palavras} palavras da curadoria`);
  await page.keyboard.press("Escape");

  // Sem teto: uma quarta escolha, e a frase só abre no botão da barra.
  await page.waitForTimeout(450);
  await page.locator("button.palavra").first().click();
  anotar(await page.locator('dialog[data-dialogo="resultado"]').isHidden(), `${nome}: a frase não abre sozinha`);
  const assinatura = await page.locator('.tarefas .autoria a[href="https://vingren.me"] svg path').count();
  anotar(assinatura === 3, `${nome}: assinatura do autor na barra, com link para vingren.me`);
  await page.locator('[data-acao="ver-frase"]').click();

  const dialogo = page.locator('dialog[data-dialogo="resultado"]');
  await dialogo.waitFor({ state: "visible", timeout: 10_000 });
  const frase = ((await dialogo.locator(".frase[data-origem]").textContent()) ?? "").trim();
  const origemFrase = await dialogo.locator(".frase[data-origem]").getAttribute("data-origem");
  anotar(frase.length > 30, `${nome}: frase (${origemFrase}) "${frase}"`);
  anotar(/quatro|four|四/.test(frase), `${nome}: a frase conta as quatro escolhas`);
  const dois = await dialogo.locator('.termos li a[href^="https://doi.org/10."]').count();
  anotar(dois >= 1, `${nome}: ${dois} termo(s) com DOI`);
  if (captura && saida) await page.screenshot({ path: `${saida}/producao-${captura}.png` });

  anotar(ruins.length === 0, `${nome}: nenhuma resposta 4xx/5xx${ruins.length ? " -> " + ruins.slice(0, 3).join(" | ") : ""}`);
  anotar(externas.length === 0, `${nome}: nenhuma chamada para fora do domínio${externas.length ? " -> " + externas.slice(0, 3).join(" | ") : ""}`);
  anotar(erros.length === 0, `${nome}: console sem erro${erros.length ? " -> " + erros.slice(0, 2).join(" | ") : ""}`);
  return { contexto, page };
}

const navegador = await chromium.launch();
try {
  const celular = await fluxo(navegador, "celular pt-BR", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "pt-BR" }, "celular");
  await celular.contexto.close();
  const ingles = await fluxo(navegador, "mesa en", { viewport: { width: 1280, height: 800 }, locale: "en-US" }, "mesa-en");
  await ingles.contexto.close();
  const mandarim = await fluxo(navegador, "mesa zh-CN", { viewport: { width: 1280, height: 800 }, locale: "zh-CN" }, "mesa-zh-CN");
  await mandarim.contexto.close();

  // Sem rede: depois da primeira visita, o service worker precisa servir tudo.
  const mesa = await fluxo(navegador, "mesa pt-BR", { viewport: { width: 1280, height: 800 }, locale: "pt-BR" }, "mesa");
  await mesa.page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await mesa.page.waitForTimeout(4000); // tempo do precache terminar
  await mesa.contexto.setOffline(true);
  await mesa.page.reload({ waitUntil: "load" });
  await mesa.page.locator(".moldura").first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  const semRede = await mesa.page.evaluate(() => [...document.querySelectorAll(".moldura img")].map((i) => i.complete && i.naturalWidth > 0));
  anotar(semRede.length >= 3 && semRede.every(Boolean), `sem rede: página recarrega e mostra as pinturas (${semRede.filter(Boolean).length} de ${semRede.length} imagens)`);
  for (let n = 0; n < 3; n++) { await mesa.page.locator("button.palavra").first().click(); await mesa.page.waitForTimeout(450); }
  await mesa.page.locator('[data-acao="ver-frase"]').click();
  const fraseSemRede = await mesa.page.locator('dialog[data-dialogo="resultado"] .frase[data-origem]').textContent({ timeout: 8000 }).catch(() => "");
  anotar((fraseSemRede ?? "").trim().length > 30, `sem rede: frase composta no aparelho "${(fraseSemRede ?? "").trim().slice(0, 70)}…"`);
  await mesa.contexto.close();
} finally {
  await navegador.close();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTUDO OK");
process.exit(falhas.length ? 1 : 0);
