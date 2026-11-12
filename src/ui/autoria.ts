// A assinatura do autor no canto da barra de tarefas, com o link para o site dele e a foice e o martelo.
import tracado from "./assinatura-autor.svg?raw";
import type { Idioma } from "../frase/tipos";
import { el } from "./dom";
import { t } from "./i18n";

const SITE = "https://vingren.me";
const REPOSITORIO = "https://github.com/mrfaillol/eu-nao-sei-me-comunicar";

export function criarAutoria(): { no: HTMLElement; traduzir(idioma: Idioma): void } {
  const link = el("a", { class: "assinatura", href: SITE, target: "_blank", rel: "noopener" });
  // O traçado vem de um arquivo do próprio repositório, não de terceiros: pode entrar como SVG.
  const svg = new DOMParser().parseFromString(tracado, "image/svg+xml").documentElement;
  link.append(document.importNode(svg, true));
  // U+FE0E pede o glifo de texto, na cor da barra, em vez da versão emoji.
  // A foice e o martelo levam ao código-fonte.
  const simbolo = el("a", { class: "simbolo", href: REPOSITORIO, target: "_blank", rel: "noopener" }, "☭︎");
  const no = el("div", { class: "autoria" }, link, simbolo);
  return {
    no,
    traduzir(idioma) {
      link.setAttribute("aria-label", t("autoria.rotulo", idioma));
      link.title = "vingren.me";
      simbolo.setAttribute("aria-label", t("autoria.simbolo", idioma));
      simbolo.title = "github.com/mrfaillol/eu-nao-sei-me-comunicar";
    },
  };
}
