import type { Idioma, Item } from "../frase/tipos";
import { el } from "./dom";
import type { Info } from "./info";
import { t } from "./i18n";
import { aproximar } from "./zoom";

export interface AcoesDePintura {
  idioma: Idioma;
  midia: (caminho: string) => string;
  info: Info;
  aoEscolher: (id: string) => void;
  aoVer: (item: Item) => void;
}

const ATRASO_POR_POSICAO_MS = 300;

export function desenharPinturas(poco: HTMLElement, itens: Item[], acoes: AcoesDePintura): void {
  poco.replaceChildren(
    ...itens.map((item, posicao) => {
      const midia = item.midia as { arquivo: string; largura: number; altura: number };
      const descricao = [item.rotulo, item.credito.autor].filter(Boolean).join(", ");
      const moldura = el(
        "button",
        { class: "moldura", type: "button", style: `--prop: ${midia.largura} / ${midia.altura}`, "aria-label": t("pintura.escolher", acoes.idioma, { rotulo: descricao }), "data-id": item.id },
        el("div", { class: "pintura" }, el("img", { src: acoes.midia(midia.arquivo), alt: "", decoding: "async" })),
        item.rosto && item.nitido ? el("img", { class: "nitido", src: acoes.midia(item.nitido), alt: "", loading: "lazy" }) : null,
      );
      moldura.addEventListener("click", () => acoes.aoEscolher(item.id));
      // Com rosto, a miniatura se aproxima dele quando a distribuição aparece. Sem rosto, fica parada:
      // zoom dirigido sem rosto acertou o assunto em metade dos casos medidos.
      if (item.rosto) {
        const rosto = item.rosto;
        setTimeout(() => moldura.isConnected && aproximar(moldura, rosto), 60 + posicao * ATRASO_POR_POSICAO_MS);
      }
      const ver = el("button", { class: "ver", type: "button" }, t("pintura.ver", acoes.idioma));
      ver.addEventListener("click", () => acoes.aoVer(item));
      return el("div", { class: "opcao-pintura" }, acoes.info.botao(item, item.rotulo, acoes.idioma), moldura, ver);
    }),
  );
}
