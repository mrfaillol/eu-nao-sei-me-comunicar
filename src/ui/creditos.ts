import type { Acervo, Idioma, Item } from "../frase/tipos";
import { el } from "./dom";
import { t } from "./i18n";

export function desenharCreditos(corpo: HTMLElement, acervo: Acervo, idioma: Idioma, aoFechar: () => void): void {
  const fechar = el("button", { class: "botao", type: "button" }, t("fechar", idioma));
  fechar.addEventListener("click", aoFechar);
  const linha = (item: Item) =>
    el("li", {}, el("p", {}, item.credito.linha), el("p", {}, el("a", { href: item.credito.url, rel: "noopener noreferrer", target: "_blank" }, item.credito.url)));
  const aviso = acervo.demonstracao ? [el("p", { class: "nota", "data-aviso": "demonstracao" }, el("strong", {}, t("creditos.demonstracao", idioma)))] : [];
  corpo.replaceChildren(
    ...aviso,
    el("p", {}, t("creditos.pinturas", idioma)),
    el("p", {}, t("creditos.sons", idioma)),
    el("p", {}, t("creditos.palavras", idioma)),
    el("p", {}, t("creditos.normas", idioma)),
    el("details", {}, el("summary", {}, `${t("creditos.itens", idioma)} (${acervo.itens.length})`), el("ul", { class: "lista" }, ...acervo.itens.map(linha))),
    el("div", { class: "acoes" }, fechar),
  );
}

export function desenharPinturaInteira(corpo: HTMLElement, item: Item, midia: (c: string) => string, idioma: Idioma, aoFechar: () => void): void {
  const fechar = el("button", { class: "botao", type: "button" }, t("fechar", idioma));
  fechar.addEventListener("click", aoFechar);
  corpo.replaceChildren(
    el(
      "div",
      { class: "inteira" },
      el("img", { src: midia((item.midia as { arquivo: string }).arquivo), alt: [item.rotulo, item.credito.autor].filter(Boolean).join(", ") }),
      el("p", {}, item.credito.linha),
      el("p", {}, el("a", { href: item.credito.url, rel: "noopener noreferrer", target: "_blank" }, item.credito.url)),
    ),
    el("div", { class: "acoes" }, fechar),
  );
}
