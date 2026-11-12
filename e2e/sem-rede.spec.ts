import { soNucleo } from "./apoio";
import { expect, test } from "@playwright/test";

// Roda contra o site construído (vite preview), porque o service worker só existe na versão de produção.
test.use({ baseURL: "http://localhost:5189" });

test("depois da primeira visita, o site funciona inteiro sem rede", async ({ page, context }, info) => {
  test.skip(info.project.name !== "mesa", "um projeto basta: o comportamento sem rede não depende do tamanho da tela");
  await soNucleo(context);
  await page.goto("/");
  await expect(page.locator(".moldura")).toHaveCount(3);
  // espera o service worker assumir a página e terminar de guardar o acervo
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(async () => page.evaluate(async () => (await caches.keys()).length), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect
    .poll(async () => page.evaluate(async () => {
      let total = 0;
      for (const nome of await caches.keys()) total += (await (await caches.open(nome)).keys()).length;
      return total;
    }), { timeout: 60_000 })
    .toBeGreaterThan(80); // 30 pinturas, 20 recortes, 30 sons, índice e o app

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".moldura")).toHaveCount(3);

  // pintura e som vêm do aparelho
  const midias = await page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>(".pintura img");
    const acervo = (await (await fetch("indice/acervo.json")).json()) as { itens: Array<{ tipo: string; midia: { arquivo: string } | null }> };
    const som = acervo.itens.find((i) => i.tipo === "som")!.midia!.arquivo;
    return { pintura: (await fetch(img!.src)).ok, som: (await fetch(som)).ok };
  });
  expect(midias).toEqual({ pintura: true, som: true });

  await page.locator(".moldura").first().click();
  await page.locator(".opcao-som .tocar").first().click();
  await expect(page.locator(".opcao-som .tocar").first()).toHaveAttribute("aria-pressed", "true"); // o som começou, sem rede
  await page.locator(".opcao-som .escolher").first().click();
  await page.locator("button.palavra").first().click();
  await page.locator('[data-acao="ver-frase"]').click();
  await expect(page.locator('dialog[data-dialogo="resultado"] .frase[data-origem="regra"]')).toBeVisible();
});

test("o manifesto permite instalar: nome, ícones de 192 e 512, tela cheia e preto", async ({ request }, info) => {
  test.skip(info.project.name !== "mesa", "um projeto basta");
  const resposta = await request.get("http://localhost:5189/manifest.webmanifest");
  expect(resposta.ok()).toBe(true);
  const manifesto = (await resposta.json()) as { name: string; display: string; background_color: string; theme_color: string; start_url: string; icons: Array<{ sizes: string; src: string }> };
  expect(manifesto.name).toBe("Eu Não Sei Me Comunicar");
  expect(manifesto.display).toBe("standalone");
  expect(manifesto.background_color).toBe("#000000");
  expect(manifesto.theme_color).toBe("#000000");
  expect(manifesto.icons.map((i) => i.sizes).sort()).toEqual(["192x192", "512x512"]);
  for (const icone of manifesto.icons) expect((await request.get(`http://localhost:5189/${icone.src}`)).ok()).toBe(true);
});
