import type { Idioma, Item } from "../frase/tipos";
import type { Tocador } from "./audio";
import { el } from "./dom";
import { t } from "./i18n";

export interface AcoesDeSom {
  idioma: Idioma;
  midia: (caminho: string) => string;
  tocador: Tocador;
  aoEscolher: (id: string) => void;
}

/** Os sons aparecem sem título: a pessoa escolhe pelo ouvido. O título só aparece na barra de tarefas, depois da escolha. */
export function desenharSons(poco: HTMLElement, itens: Item[], acoes: AcoesDeSom): void {
  poco.replaceChildren(
    ...itens.map((item, posicao) => {
      const nome = t("som.rotulo", acoes.idioma, { n: posicao + 1 });
      const tocar = el("button", { class: "botao tocar", type: "button", "aria-pressed": "false", "aria-label": `${t("som.tocar", acoes.idioma)}: ${nome}` }, t("som.tocar", acoes.idioma));
      const escolher = el("button", { class: "botao escolher", type: "button", "aria-label": `${t("som.escolher", acoes.idioma)}: ${nome}`, "data-id": item.id }, t("som.escolher", acoes.idioma));
      const onda = el("div", { class: "onda", "aria-hidden": "true" }, el("i"), el("i"), el("i"), el("i"), el("i"));
      const opcao = el("div", { class: "opcao-som", "data-som": item.id }, onda, el("span", {}, nome), tocar, escolher);
      // O toque no botão é o gesto que o navegador exige para o áudio começar.
      tocar.addEventListener("click", () => void acoes.tocador.tocar(item.id, acoes.midia((item.midia as { arquivo: string }).arquivo)));
      escolher.addEventListener("click", () => acoes.aoEscolher(item.id));
      return opcao;
    }),
  );
  marcarSomTocando(poco, acoes.tocador.tocando(), acoes.idioma);
}

export function marcarSomTocando(poco: HTMLElement, id: string | null, idioma: Idioma): void {
  for (const opcao of poco.querySelectorAll<HTMLElement>(".opcao-som")) {
    const tocando = opcao.dataset.som === id;
    opcao.classList.toggle("tocando", tocando);
    const botao = opcao.querySelector<HTMLElement>(".tocar");
    if (botao) {
      botao.setAttribute("aria-pressed", String(tocando));
      botao.textContent = t(tocando ? "som.pausar" : "som.tocar", idioma);
    }
  }
}
