import type { Idioma } from "../frase/tipos";
import { el } from "./dom";
import { t } from "./i18n";

export interface Ajuda {
  conferido_em: string;
  idiomas: Record<
    Idioma,
    { link: string; titulo: string; linha: { nome: string; contato: string; detalhe: string; url: string }; diretorio: { texto: string; url: string } }
  >;
}

/** Folha de ajuda. Os textos e os canais são fixos, do arquivo ajuda.json: o modelo nunca escreve sobre ajuda. */
export function desenharAjuda(corpo: HTMLElement, ajuda: Ajuda, idioma: Idioma, aoFechar: () => void): void {
  const a = ajuda.idiomas[idioma];
  const fechar = el("button", { class: "botao", type: "button" }, t("fechar", idioma));
  fechar.addEventListener("click", aoFechar);
  corpo.replaceChildren(
    el("p", {}, a.linha.nome),
    el("p", { class: "telefone" }, el("a", { href: `tel:${a.linha.contato}` }, a.linha.contato)),
    el("p", {}, a.linha.detalhe, " ", el("a", { href: a.linha.url, rel: "noopener noreferrer", target: "_blank" }, a.linha.url)),
    el("p", {}, el("a", { href: a.diretorio.url, rel: "noopener noreferrer", target: "_blank" }, a.diretorio.texto)),
    el("div", { class: "acoes" }, fechar),
  );
}
