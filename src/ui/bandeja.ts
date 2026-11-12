import type { Idioma, Item } from "../frase/tipos";
import { el } from "./dom";
import { t } from "./i18n";
import { MINIMO } from "./selecao";

export interface Bandeja {
  conta: HTMLElement;
  lista: HTMLElement;
  /** Pede a frase. Fica apagado até a seleção chegar ao mínimo. */
  ver: HTMLButtonElement;
}

/** A barra de tarefas mostra as escolhas feitas, como janelas abertas, anuncia a contagem e libera a frase a partir de três. */
export function desenharBandeja(b: Bandeja, escolhidos: Item[], idioma: Idioma, aoRetirar: (id: string) => void): void {
  const n = escolhidos.length;
  b.conta.textContent = t(n < MINIMO ? "bandeja.conta" : "bandeja.conta_livre", idioma, { n });
  b.ver.textContent = t("bandeja.ver", idioma);
  b.ver.disabled = n < MINIMO;
  if (n === 0) {
    b.lista.replaceChildren(el("li", { class: "vazia", style: "box-shadow:none;background:none" }, t("bandeja.vazia", idioma)));
    return;
  }
  b.lista.replaceChildren(
    ...escolhidos.map((item) => {
      const retirar = el("button", { type: "button", "aria-label": t("bandeja.retirar", idioma, { rotulo: item.rotulo }) }, "×");
      retirar.addEventListener("click", () => aoRetirar(item.id));
      return el("li", { "data-escolhido": item.id }, el("span", { class: "nome", lang: item.idioma }, item.rotulo), retirar);
    }),
  );
  // A escolha mais recente fica à vista, mesmo com a lista comprida.
  b.lista.lastElementChild?.scrollIntoView?.({ block: "nearest", inline: "end" });
}
