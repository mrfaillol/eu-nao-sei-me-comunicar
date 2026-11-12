import { expect, test, type Page } from "@playwright/test";

interface ItemDoAcervo {
  id: string;
  texto_humano: string;
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

test("o (i) da palavra mostra a definição do dicionário, com a fonte", async ({ page }) => {
  const itens = await acervo(page);
  const botao = page.locator(".opcao-palavra .info").first();
  await botao.click();
  const id = (await botao.getAttribute("data-info"))!;
  const caixa = page.locator(".info-caixa");
  await expect(caixa.locator(".info-titulo")).toHaveText("No dicionário");
  await expect(caixa.locator(".info-glosa")).toHaveText(itens.get(id)!.texto_humano);
  await expect(caixa.locator(".info-fonte")).toContainText("Wiktionary");
  await expect(page.locator(".tarefas .conta")).toHaveText("0 de 3"); // ler a definição não escolhe a palavra
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
  await expect(page.locator(".tarefas .autoria .simbolo")).toHaveText(/☭/);
  const lugar = await page.evaluate(() => {
    const a = document.querySelector(".autoria")!.getBoundingClientRect();
    const assinatura = document.querySelector(".autoria a")!.getBoundingClientRect();
    const simbolo = document.querySelector(".autoria .simbolo")!.getBoundingClientRect();
    return { daDireita: innerWidth - a.right, doChao: innerHeight - a.bottom, simboloDepois: simbolo.left >= assinatura.right - 1, largura: assinatura.width };
  });
  expect(lugar.daDireita).toBeLessThanOrEqual(12);
  expect(lugar.doChao).toBeLessThanOrEqual(16);
  expect(lugar.simboloDepois).toBe(true);
  expect(lugar.largura).toBeGreaterThan(50);
  await page.locator(".tarefas").screenshot({ path: `docs/capturas/barra-${info.project.name}.png` });
});
