import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".janela[data-janela]")).toHaveCount(3);
});

test("fundo preto, título do dono e as três janelas com os textos dele", async ({ page }, info) => {
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(page.locator("h1")).toHaveText("Eu Não Sei Me Comunicar");
  await expect(page.locator('[data-janela="pintura"] h2')).toHaveText("Prefiro Me Explicar Escolhendo Imagens Que Me Despertam…");
  await expect(page.locator('[data-janela="som"] h2')).toHaveText("Prefiro Me Comunicar Ouvindo Sons Que Representem O Que Sinto");
  await expect(page.locator('[data-janela="palavra"] h2')).toHaveText("Prefiro Escolher Palavras Soltas");
  for (const janela of ["pintura", "som", "palavra"]) await expect(page.locator(`[data-janela="${janela}"]`)).toBeVisible();
  await expect(page.locator(".moldura")).toHaveCount(3);
  await expect(page.locator(".opcao-som")).toHaveCount(3);
  await expect(page.locator("button.palavra")).toHaveCount(3);
  await page.waitForTimeout(2600); // deixa o zoom dos rostos terminar antes da captura
  await page.screenshot({ path: `docs/capturas/casca-${info.project.name}.png`, fullPage: true });
});

test("a página não rola para o lado", async ({ page }) => {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra).toBeLessThanOrEqual(0);
});

test("trocar o idioma muda o título, as janelas e o atributo lang", async ({ page }) => {
  await page.selectOption("#idioma", "en");
  await expect(page.locator("h1")).toHaveText("I Don't Know How to Communicate");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.selectOption("#idioma", "zh-CN");
  await expect(page.locator("h1")).toHaveText("我不会表达自己");
  await expect(page.locator('[data-janela="palavra"] h2')).toHaveText("我宁愿挑选零散的词语");
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra).toBeLessThanOrEqual(0);
});

test("o teclado alcança a primeira opção de cada janela", async ({ page }) => {
  const vistos = new Set<string>();
  for (let n = 0; n < 40 && vistos.size < 3; n++) {
    await page.keyboard.press("Tab");
    const janela = await page.evaluate(() => document.activeElement?.closest("[data-janela]")?.getAttribute("data-janela") ?? null);
    if (janela) vistos.add(janela);
  }
  expect([...vistos].sort()).toEqual(["palavra", "pintura", "som"]);
});

test("o link de ajuda está na tela desde o começo e abre a linha do idioma", async ({ page }) => {
  await page.locator('[data-acao="ajuda"]').click();
  await expect(page.locator('dialog[data-dialogo="ajuda"]')).toBeVisible();
  await expect(page.locator('dialog[data-dialogo="ajuda"] .telefone')).toHaveText("188");
});
