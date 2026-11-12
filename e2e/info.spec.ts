import { soNucleo } from "./apoio";
import { expect, test, type Page } from "@playwright/test";

interface ItemDoAcervo {
  id: string;
  texto_humano: string;
  definicao?: { texto: string; classe: string; pronuncia: string; fonte: string };
}

async function acervo(page: Page): Promise<Map<string, ItemDoAcervo>> {
  const resposta = await page.request.get("/indice/acervo.json");
  const dados = (await resposta.json()) as { itens: ItemDoAcervo[] };
  return new Map(dados.itens.map((i) => [i.id, i]));
}

/** Com mouse a caixa abre ao passar por cima; no toque, com um toque no (i). */
async function abrirInfo(page: Page, seletor: string, comMouse: boolean): Promise<string> {
  const botao = page.locator(seletor).first();
  if (comMouse) await botao.hover();
  else await botao.tap();
  await expect(page.locator(".info-caixa")).toBeVisible();
  return (await botao.getAttribute("data-info"))!;
}

test.beforeEach(async ({ page }) => {
  await soNucleo(page);
  await page.goto("/");
  await expect(page.locator(".moldura")).toHaveCount(3);
});

test("cada item das três janelas tem o seu (i)", async ({ page }) => {
  await expect(page.locator(".opcao-pintura .info")).toHaveCount(3);
  await expect(page.locator(".opcao-som .info")).toHaveCount(3);
  await expect(page.locator(".opcao-palavra .info")).toHaveCount(3);
  // o (i) fica acima da pintura, e não por cima dela
  const acima = await page.locator(".opcao-pintura").first().evaluate((opcao) => {
    const i = opcao.querySelector(".info")!.getBoundingClientRect();
    const m = opcao.querySelector(".moldura")!.getBoundingClientRect();
    return i.bottom <= m.top + 1;
  });
  expect(acima).toBe(true);
});

test("o (i) da pintura mostra palavras que estão escritas no texto da curadoria", async ({ page }, info) => {
  const itens = await acervo(page);
  const id = await abrirInfo(page, ".opcao-pintura .info", info.project.name === "mesa");
  const caixa = page.locator(".info-caixa");
  await expect(caixa.locator(".info-titulo")).toHaveText("Palavras de quem descreveu esta pintura");
  const palavras = await caixa.locator(".info-palavras li").allTextContents();
  expect(palavras.length).toBeGreaterThanOrEqual(3);
  const texto = itens.get(id)!.texto_humano.toLowerCase();
  for (const palavra of palavras) expect(texto, `"${palavra}" não está no texto humano de ${id}`).toContain(palavra.toLowerCase());
  await expect(caixa).toContainText("Cleveland Museum of Art");
  await page.screenshot({ path: `docs/capturas/info-pintura-${info.project.name}.png` });
});

test("o (i) do som mostra as tags de quem publicou, sem escolher o som", async ({ page }, info) => {
  const itens = await acervo(page);
  const id = await abrirInfo(page, ".opcao-som .info", info.project.name === "mesa");
  const caixa = page.locator(".info-caixa");
  await expect(caixa.locator(".info-titulo")).toHaveText("Palavras de quem publicou este som");
  const palavras = await caixa.locator(".info-palavras li").allTextContents();
  expect(palavras.length).toBeGreaterThanOrEqual(1);
  const texto = itens.get(id)!.texto_humano.toLowerCase();
  for (const palavra of palavras) expect(texto).toContain(palavra.toLowerCase());
  await expect(page.locator(".tarefas .conta")).toHaveText("0 de 3");
});

test("o (i) da palavra em português mostra a definição de um dicionário em português", async ({ page }) => {
  const itens = await acervo(page);
  const botao = page.locator(".opcao-palavra .info").first();
  await botao.click();
  const item = itens.get((await botao.getAttribute("data-info"))!)!;
  const caixa = page.locator(".info-caixa");
  await expect(caixa.locator(".info-titulo")).toHaveText("No dicionário");
  await expect(caixa.locator(".info-glosa")).toHaveText(item.definicao!.texto);
  expect(item.definicao!.texto).not.toBe(item.texto_humano); // a glosa em inglês não é mais o que a pessoa lê
  await expect(caixa.locator(".info-fonte")).toContainText(/Dicionário Aberto|Wikcionário/);
  await expect(page.locator(".tarefas .conta")).toHaveText("0 de 3"); // ler a definição não escolhe a palavra
});

test("cada língua tem o seu dicionário: chinês com pinyin, inglês com o Wiktionary", async ({ page }, info) => {
  const itens = await acervo(page);
  await page.selectOption("#idioma", "zh-CN");
  let botao = page.locator(".opcao-palavra .info").first();
  await botao.click();
  let item = itens.get((await botao.getAttribute("data-info"))!)!;
  const caixa = page.locator(".info-caixa");
  await expect(caixa.locator(".info-pronuncia")).toHaveText(item.definicao!.pronuncia);
  expect(item.definicao!.pronuncia).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/);
  await expect(caixa.locator(".info-glosa")).toHaveText(item.definicao!.texto);
  await expect(caixa.locator(".info-glosa")).toHaveAttribute("lang", "zh-Hant");
  await expect(caixa.locator(".info-fonte")).toContainText("重編國語辭典");
  await page.screenshot({ path: `docs/capturas/info-palavra-zh-${info.project.name}.png` });
  await page.keyboard.press("Escape");

  await page.selectOption("#idioma", "en");
  botao = page.locator(".opcao-palavra .info").first();
  await botao.click();
  item = itens.get((await botao.getAttribute("data-info"))!)!;
  await expect(caixa.locator(".info-glosa")).toHaveText(item.texto_humano);
  await expect(caixa.locator(".info-fonte")).toContainText("Wiktionary");
});

test("a caixa do (i) cabe inteira na tela, acima da barra de tarefas", async ({ page }) => {
  for (const seletor of [".opcao-pintura .info", ".opcao-som .info", ".opcao-palavra .info"]) {
    for (let n = 0; n < 3; n++) {
      const botao = page.locator(seletor).nth(n);
      await botao.scrollIntoViewIfNeeded();
      await botao.click();
      await expect(botao).toHaveAttribute("aria-expanded", "true");
      const sobra = await page.evaluate(() => {
        const c = document.querySelector(".info-caixa")!.getBoundingClientRect();
        const barra = document.querySelector(".tarefas")!.getBoundingClientRect();
        return { esquerda: c.left, direita: innerWidth - c.right, topo: c.top, chao: barra.top - c.bottom };
      });
      for (const [lado, valor] of Object.entries(sobra)) expect(valor, `${seletor} ${n}: ${lado}`).toBeGreaterThanOrEqual(0);
      await botao.click(); // o segundo toque fecha
      await expect(page.locator(".info-caixa")).toBeHidden();
    }
  }
});

test("Esc e um toque fora fecham a caixa do (i)", async ({ page }) => {
  const botao = page.locator(".opcao-palavra .info").first();
  await botao.click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".info-caixa")).toBeHidden();
  await expect(botao).toHaveAttribute("aria-expanded", "false");
  await botao.click();
  await expect(page.locator(".info-caixa")).toBeVisible();
  await page.locator("h1").click();
  await expect(page.locator(".info-caixa")).toBeHidden();
});

test("a assinatura do autor fica no canto inferior direito da barra, com o link e a foice e o martelo", async ({ page }, info) => {
  const link = page.locator(".tarefas .autoria a.assinatura");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://vingren.me");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link.locator("svg path")).toHaveCount(3);
  const simbolo = page.locator(".tarefas .autoria a.simbolo");
  await expect(simbolo).toHaveText(/☭/);
  // a foice e o martelo levam ao código-fonte
  await expect(simbolo).toHaveAttribute("href", "https://github.com/mrfaillol/eu-nao-sei-me-comunicar");
  await expect(simbolo).toHaveAttribute("rel", /noopener/);
  await expect(simbolo).toHaveAccessibleName(/GitHub/);
  // As medidas não dependem da fonte do sistema: a assinatura está na mesma linha do seletor de idioma,
  // encostada na direita, dentro da barra que fica presa ao chão da tela.
  const lugar = await page.evaluate(() => {
    const caixa = (seletor: string) => document.querySelector(seletor)!.getBoundingClientRect();
    const [barra, autoria, assinatura, simbolo, idioma] = [".tarefas", ".autoria", ".autoria a", ".autoria .simbolo", "#idioma"].map(caixa) as [DOMRect, DOMRect, DOMRect, DOMRect, DOMRect];
    const meio = (r: DOMRect) => r.top + r.height / 2;
    return {
      daDireita: innerWidth - autoria.right,
      barraNoChao: Math.abs(innerHeight - barra.bottom),
      dentroDaBarra: autoria.top >= barra.top && autoria.bottom <= barra.bottom,
      desnivelDoIdioma: Math.abs(meio(autoria) - meio(idioma)),
      depoisDoIdioma: autoria.left >= idioma.right - 1,
      simboloDepois: simbolo.left >= assinatura.right - 1,
      largura: assinatura.width,
    };
  });
  expect(lugar.daDireita).toBeLessThanOrEqual(12);
  expect(lugar.barraNoChao).toBeLessThanOrEqual(1);
  expect(lugar.dentroDaBarra).toBe(true);
  expect(lugar.desnivelDoIdioma).toBeLessThanOrEqual(4);
  expect(lugar.depoisDoIdioma).toBe(true);
  expect(lugar.simboloDepois).toBe(true);
  expect(lugar.largura).toBeGreaterThan(50);
  await page.locator(".tarefas").screenshot({ path: `docs/capturas/barra-${info.project.name}.png` });
});
