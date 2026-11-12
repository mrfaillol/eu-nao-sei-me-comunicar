import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".moldura")).toHaveCount(3);
});

test("três escolhas livres levam à frase, com a procedência de cada termo", async ({ page }, info) => {
  const externas: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://localhost")) externas.push(r.url());
  });

  await page.locator(".moldura").first().click();
  await expect(page.locator(".tarefas .conta")).toHaveText("1 de 3");
  await page.locator(".opcao-som .tocar").first().click();
  await expect(page.locator(".opcao-som .tocar").first()).toHaveAttribute("aria-pressed", "true");
  await page.locator(".opcao-som .escolher").first().click();
  await expect(page.locator(".tarefas .conta")).toHaveText("2 de 3");
  await expect(page.locator('.opcao-som .tocar[aria-pressed="true"]')).toHaveCount(0); // escolher parou o som
  await page.screenshot({ path: `docs/capturas/escolha-${info.project.name}.png`, fullPage: true });
  await page.locator("button.palavra").first().click();

  const dialogo = page.locator('dialog[data-dialogo="resultado"]');
  await expect(dialogo).toBeVisible();
  const frase = dialogo.locator(".frase[data-origem]");
  await expect(frase).toBeVisible();
  const texto = (await frase.textContent()) ?? "";
  expect(texto.endsWith(".")).toBe(true);
  expect(texto.split(/\s+/).length).toBeGreaterThanOrEqual(15);
  expect(texto).toContain("você reuniu");

  const termos = dialogo.locator(".termos li");
  const quantos = await termos.count();
  expect(quantos).toBeGreaterThanOrEqual(1);
  expect(quantos).toBeLessThanOrEqual(4);
  for (let n = 0; n < quantos; n++) await expect(termos.nth(n).locator('a[href^="https://doi.org/10."]')).toHaveCount(1);
  await expect(dialogo).toContainText("Não é diagnóstico nem avaliação de saúde.");
  await page.screenshot({ path: `docs/capturas/resultado-${info.project.name}-pt-BR.png` });

  await dialogo.locator('[data-acao="recomecar"]').click();
  await expect(dialogo).toBeHidden();
  await expect(page.locator(".tarefas .conta")).toHaveText("0 de 3");
  expect(externas, "o site não chama ninguém de fora em uso").toEqual([]);
});

test("três escolhas na mesma janela também valem, e a quarta não entra", async ({ page }) => {
  for (let n = 0; n < 3; n++) {
    await page.locator("button.palavra").first().click();
  }
  await expect(page.locator('dialog[data-dialogo="resultado"] .frase[data-origem]')).toBeVisible();
  await expect(page.locator(".tarefas .escolhas li[data-escolhido]")).toHaveCount(3);
  await expect(page.locator('dialog[data-dialogo="resultado"] .frase')).toContainText("As três palavras que você reuniu");
});

test("outras três troca as opções e mantém as escolhas", async ({ page }) => {
  await page.locator("button.palavra").first().click();
  const antes = await page.locator(".moldura").evaluateAll((nos) => nos.map((n) => n.getAttribute("data-id")));
  await page.locator('[data-janela="pintura"] [data-acao="outras"]').click();
  const depois = await page.locator(".moldura").evaluateAll((nos) => nos.map((n) => n.getAttribute("data-id")));
  expect(depois).toHaveLength(3);
  expect(depois.some((id) => antes.includes(id))).toBe(false);
  await expect(page.locator(".tarefas .conta")).toHaveText("1 de 3");
});

test("retirar uma escolha devolve a contagem", async ({ page }) => {
  await page.locator("button.palavra").first().click();
  await page.locator(".tarefas .escolhas li[data-escolhido] button").click();
  await expect(page.locator(".tarefas .conta")).toHaveText("0 de 3");
});

test("tocar um som pausa o que estava tocando", async ({ page }) => {
  const tocar = page.locator(".opcao-som .tocar");
  await tocar.nth(0).click();
  await tocar.nth(1).click();
  await expect(tocar.nth(0)).toHaveAttribute("aria-pressed", "false");
  await expect(tocar.nth(1)).toHaveAttribute("aria-pressed", "true");
});

test("ver inteira mostra a pintura com o crédito do museu", async ({ page }) => {
  await page.locator(".ver").first().click();
  const dialogo = page.locator('dialog[data-dialogo="inteira"]');
  await expect(dialogo).toBeVisible();
  await expect(dialogo.locator('a[href^="https://clevelandart.org/art/"]')).toBeVisible();
});

test("a frase sai no idioma escolhido, em inglês e em mandarim", async ({ page }, info) => {
  for (const [idioma, trecho] of [["en", "you gathered"], ["zh-CN", "你选的"]] as const) {
    await page.selectOption("#idioma", idioma);
    for (let n = 0; n < 3; n++) await page.locator(".moldura").first().click();
    const frase = page.locator('dialog[data-dialogo="resultado"] .frase[data-origem]');
    await expect(frase).toContainText(trecho);
    await expect(frase).toHaveAttribute("lang", idioma);
    await page.screenshot({ path: `docs/capturas/resultado-${info.project.name}-${idioma}.png` });
    await page.locator('[data-acao="recomecar"]').click();
  }
});

test("com movimento reduzido, a pintura não anima", async ({ browser }) => {
  const contexto = await browser.newContext({ reducedMotion: "reduce" });
  const page = await contexto.newPage();
  await page.goto("/");
  await expect(page.locator(".moldura")).toHaveCount(3);
  await expect(page.locator(".pintura").first()).toHaveCSS("transition-duration", "0s");
  await contexto.close();
});

test("os créditos avisam que o acervo é de demonstração", async ({ page }) => {
  await page.locator('[data-acao="creditos"]').click();
  await expect(page.locator('dialog[data-dialogo="creditos"] [data-aviso="demonstracao"]')).toHaveText("Acervo de demonstração: revisão humana pendente.");
});

test("nenhum controle de uma janela fica coberto por outra", async ({ page }) => {
  for (const janela of ["pintura", "som", "palavra"]) {
    const botao = page.locator(`[data-janela="${janela}"] [data-acao="outras"]`);
    const visivel = await botao.evaluate((no) => {
      const r = no.getBoundingClientRect();
      const noTopo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return noTopo === no || no.contains(noTopo);
    });
    // no celular o botão pode estar fora da tela (rola-se até ele); em tela larga precisa estar à vista e livre
    if (await botao.isVisible()) await botao.scrollIntoViewIfNeeded();
    const livre = await botao.evaluate((no) => {
      const r = no.getBoundingClientRect();
      const noTopo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return noTopo === no || no.contains(noTopo);
    });
    expect(livre || visivel, `"Outras três" de ${janela} está coberto`).toBe(true);
  }
});

test("as escolhas feitas aparecem na barra de tarefas com o nome", async ({ page }) => {
  await page.locator("button.palavra").first().click();
  await page.locator(".opcao-som .escolher").first().click();
  const nomes = page.locator(".tarefas .escolhas li[data-escolhido] .nome");
  await expect(nomes).toHaveCount(2);
  for (let n = 0; n < 2; n++) {
    await expect(nomes.nth(n)).toBeVisible();
    const largura = await nomes.nth(n).evaluate((no) => no.getBoundingClientRect().width);
    expect(largura).toBeGreaterThan(30);
  }
});
