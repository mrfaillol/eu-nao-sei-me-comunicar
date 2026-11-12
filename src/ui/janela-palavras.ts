import type { Idioma, Item } from "../frase/tipos";
import { el } from "./dom";
import { t } from "./i18n";

export function desenharPalavras(poco: HTMLElement, itens: Item[], idioma: Idioma, aoEscolher: (id: string) => void): void {
  poco.replaceChildren(
    ...itens.map((item) => {
      // lang é o da palavra, não o da interface: quem lê a tela em voz alta pronuncia certo.
      const botao = el("button", { class: "palavra", type: "button", lang: item.idioma, "aria-label": t("palavra.escolher", idioma, { rotulo: item.rotulo }), "data-id": item.id }, item.rotulo);
      botao.addEventListener("click", () => aoEscolher(item.id));
      return botao;
    }),
  );
}
