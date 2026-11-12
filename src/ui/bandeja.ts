import type { Idioma, Item } from "../frase/tipos";
import { el } from "./dom";
import { t } from "./i18n";

/** A barra de tarefas mostra as escolhas feitas, como janelas abertas, e anuncia a contagem. */
export function desenharBandeja(conta: HTMLElement, lista: HTMLElement, escolhidos: Item[], idioma: Idioma, aoRetirar: (id: string) => void): void {
  conta.textContent = t("bandeja.conta", idioma, { n: escolhidos.length });
  if (escolhidos.length === 0) {
    lista.replaceChildren(el("li", { class: "vazia", style: "box-shadow:none;background:none" }, t("bandeja.vazia", idioma)));
    return;
  }
  lista.replaceChildren(
    ...escolhidos.map((item) => {
      const retirar = el("button", { type: "button", "aria-label": t("bandeja.retirar", idioma, { rotulo: item.rotulo }) }, "×");
      retirar.addEventListener("click", () => aoRetirar(item.id));
      return el("li", { "data-escolhido": item.id }, el("span", { class: "nome", lang: item.idioma }, item.rotulo), retirar);
    }),
  );
}
