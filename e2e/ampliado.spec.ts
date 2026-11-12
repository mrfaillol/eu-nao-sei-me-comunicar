import { expect, test, type Page } from "@playwright/test";

// O acervo ampliado tem a mídia nos servidores de origem. Aqui eles são simulados: o teste não depende
// da rede nem do que o pipeline gerou, só do contrato (mídia com endereço completo, mesmos campos do item).
const MUSEU = "https://openaccess-cdn.clevelandart.org";
const FREESOUND = "https://cdn.freesound.org";
const TRAVA = 420;

interface Item {
  id: string;
  tipo: string;
  rotulo: string;
  midia: Record<string, unknown> | null;
  [campo: string]: unknown;
}

async function prepararAmpliado(page: Page, museuNoAr = true): Promise<{ nucleo: Set<string>; remotos: Item[] }> {
  const resposta = await page.request.get("/indice/acervo.json");
  const acervo = (await resposta.json()) as { itens: Item[] };
  const remotos: Item[] = [];
  acervo.itens.filter((i) => i.tipo === "pintura").forEach((i, n) => {
    remotos.push({ ...i, id: `pintura:cma:9${String(n).padStart(5, "0")}`, rotulo: `Remota ${n}`, nitido: null, rosto: null, midia: { ...i.midia, arquivo: `${MUSEU}/teste/${n}_web.jpg` } });
  });
  acervo.itens.filter((i) => i.tipo === "som").forEach((i, n) => {
    remotos.push({ ...i, id: `som:freesound:9${String(n).padStart(5, "0")}`, rotulo: `Som remoto ${n}`, midia: { ...i.midia, arquivo: `${FREESOUND}/previews/9/${n}-hq.mp3` } });
  });
  await page.route("**/indice/ampliado.json", (rota) => rota.fulfill({ json: { versao: "teste", demonstracao: true, itens: remotos } }));
  await page.route(`${MUSEU}/**`, (rota) => (museuNoAr ? rota.fulfill({ path: "public/midia/pinturas/cma-102578.webp", contentType: "image/webp" }) : rota.abort()));
  await page.route(`${FREESOUND}/**`, (rota) => rota.fulfill({ path: "public/midia/sons/fs-119448.mp3", contentType: "audio/mpeg" }));
  return { nucleo: new Set(acervo.itens.map((i) => i.id)), remotos };
}

async function abrir(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator(".moldura")).toHaveCount(3);
  await expect(page.locator("#app")).toHaveAttribute("data-ampliado", /^[1-9]/);
}

/** Troca as opções da janela até aparecer um item que não é do núcleo, e devolve o id dele. */
async function acharRemoto(page: Page, janela: "pintura" | "som", nucleo: Set<string>): Promise<string> {
  const seletor = janela === "pintura" ? ".moldura" : ".opcao-som .escolher";
  for (let n = 0; n < 12; n++) {
    const ids = await page.locator(`[data-janela="${janela}"] ${seletor}`).evaluateAll((nos) => nos.map((no) => no.getAttribute("data-id")!));
    const remoto = ids.find((id) => !nucleo.has(id));
    if (remoto) return remoto;
    await page.locator(`[data-janela="${janela}"] [data-acao="outras"]`).click();
  }
  throw new Error(`nenhum item remoto apareceu na janela ${janela}`);
}

test("a primeira tela não espera o acervo ampliado: abre com o núcleo e não troca o que está à vista", async ({ page }) => {
  const { nucleo } = await prepararAmpliado(page);
  await abrir(page);
  const ids = await page.locator(".moldura").evaluateAll((nos) => nos.map((n) => n.getAttribute("data-id")!));
  for (const id of ids) expect(nucleo.has(id)).toBe(true);
});

test("pinturas e sons do acervo ampliado entram nas trocas, e a frase sai deles com procedência", async ({ page }) => {
  const { nucleo } = await prepararAmpliado(page);
  await abrir(page);

  const pintura = await acharRemoto(page, "pintura", nucleo);
  const imagem = page.locator(`.moldura[data-id="${pintura}"] img`).first();
  await expect(imagem).toHaveAttribute("src", new RegExp(`^${MUSEU}/`));
  await expect.poll(() => imagem.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  await page.locator(`.moldura[data-id="${pintura}"]`).click();
  await page.waitForTimeout(TRAVA);

  const som = await acharRemoto(page, "som", nucleo);
  const tocar = page.locator(`.opcao-som[data-som="${som}"] .tocar`);
  await tocar.click();
  await expect(tocar).toHaveAttribute("aria-pressed", "true");
  await page.locator(`.opcao-som[data-som="${som}"] .escolher`).click();
  await page.locator("button.palavra").first().click();

  await page.locator('[data-acao="ver-frase"]').click();
  const dialogo = page.locator('dialog[data-dialogo="resultado"]');
  await expect(dialogo.locator(".frase[data-origem]")).toContainText("você reuniu");
  expect(await dialogo.locator('.termos li a[href^="https://doi.org/10."]').count()).toBeGreaterThanOrEqual(1);
  await expect(dialogo.locator('a[href^="https://clevelandart.org/art/"]')).toHaveCount(1);
});

test("fora do próprio site, o navegador só fala com o museu e com o Freesound", async ({ page }) => {
  const { nucleo } = await prepararAmpliado(page);
  const fora = new Set<string>();
  page.on("request", (pedido) => {
    const endereco = new URL(pedido.url());
    if (endereco.protocol.startsWith("http") && endereco.hostname !== "localhost") fora.add(endereco.origin);
  });
  await abrir(page);
  await acharRemoto(page, "pintura", nucleo);
  const som = await acharRemoto(page, "som", nucleo);
  await page.locator(`.opcao-som[data-som="${som}"] .tocar`).click();
  await page.waitForTimeout(300);
  expect([...fora].sort()).toEqual([FREESOUND, MUSEU].sort());
});

test("com o servidor do museu fora do ar, a janela desiste das pinturas remotas e nenhum quadro fica vazio", async ({ page }) => {
  await prepararAmpliado(page, false);
  await abrir(page);
  for (let n = 0; n < 4; n++) {
    await page.locator('[data-janela="pintura"] [data-acao="outras"]').click();
    await page.waitForTimeout(250);
  }
  await expect.poll(async () => page.locator(".moldura .pintura img").evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)), { timeout: 8000 }).toBe(true);
  const enderecos = await page.locator(".moldura .pintura img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src")!));
  expect(enderecos).toHaveLength(3);
  for (const e of enderecos) expect(e).not.toMatch(/^https:/);
});

test("sem o índice ampliado o site segue inteiro com o núcleo", async ({ page }) => {
  await page.route("**/indice/ampliado.json", (rota) => rota.fulfill({ status: 404, body: "" }));
  await page.goto("/");
  await expect(page.locator(".moldura")).toHaveCount(3);
  await expect(page.locator("#app")).toHaveAttribute("data-ampliado", "0");
  for (let n = 0; n < 3; n++) {
    await page.locator("button.palavra").first().click();
    await page.waitForTimeout(TRAVA);
  }
  await page.locator('[data-acao="ver-frase"]').click();
  await expect(page.locator('dialog[data-dialogo="resultado"] .frase[data-origem]')).toBeVisible();
});

test("os créditos dizem de onde vem a mídia do acervo ampliado e como ele é anotado", async ({ page }) => {
  const { remotos } = await prepararAmpliado(page);
  await abrir(page);
  await page.locator('[data-acao="creditos"]').click();
  const aviso = page.locator('dialog[data-dialogo="creditos"] [data-aviso="ampliado"]');
  await expect(aviso).toContainText(String(remotos.length));
  await expect(aviso).toContainText("anotação desses itens é automática");
});
