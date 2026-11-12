import type { BrowserContext, Page } from "@playwright/test";

/**
 * Deixa o site só com o acervo conferido, cuja mídia está no próprio site. Os testes do núcleo não
 * podem depender da rede nem do que o pipeline pôs no acervo ampliado.
 */
export async function soNucleo(alvo: Page | BrowserContext): Promise<void> {
  await alvo.route("**/indice/ampliado.json", (rota) => rota.fulfill({ json: { versao: "teste", demonstracao: true, itens: [] } }));
}
