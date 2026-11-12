import type { Glossario, Idioma, Item } from "../frase/tipos";
import type { Resposta } from "../servidor/interpretar";
import { el } from "./dom";
import { t } from "./i18n";

function linhaDeCredito(item: Item): HTMLElement {
  return el(
    "li",
    {},
    el("p", {}, item.credito.linha),
    el("p", {}, `${item.credito.licenca} · `, el("a", { href: item.credito.url, rel: "noopener noreferrer", target: "_blank" }, item.credito.url)),
  );
}

/** "De onde veio cada termo": o termo científico da frase, a definição, a referência e os itens que o carregam. */
function linhaDeTermo(id: string, escolhidos: Item[], glossario: Glossario, idioma: Idioma): HTMLElement | null {
  const construto = glossario[id];
  if (!construto) return null;
  const portadores = escolhidos.filter((i) => i.construtos.includes(id)).map((i) => i.rotulo);
  return el(
    "li",
    {},
    el("strong", {}, construto.termo[idioma]),
    el("p", {}, construto.definicao[idioma]),
    el("p", {}, `${construto.referencia.citacao}. `, el("a", { href: `https://doi.org/${construto.referencia.doi}`, rel: "noopener noreferrer", target: "_blank" }, `doi.org/${construto.referencia.doi}`)),
    portadores.length > 0 && el("p", {}, t("resultado.nos_itens", idioma, { itens: portadores.join("; ") })),
  );
}

export function desenharEspera(corpo: HTMLElement, idioma: Idioma): void {
  corpo.replaceChildren(el("p", { class: "frase", role: "status" }, t("resultado.aguarde", idioma)));
}

export function desenharResultado(
  corpo: HTMLElement,
  resposta: Resposta,
  escolhidos: Item[],
  glossario: Glossario,
  idioma: Idioma,
  aoRecomecar: () => void,
  ajuda: { texto: string; aoAbrir: () => void },
): void {
  const recomecar = el("button", { class: "botao", type: "button", "data-acao": "recomecar" }, t("resultado.recomecar", idioma));
  recomecar.addEventListener("click", aoRecomecar);
  // A barra de tarefas fica inerte atrás da caixa da frase: o link de ajuda precisa estar aqui dentro,
  // que é onde a pessoa está quando o destaque importa.
  const botaoAjuda = el("button", { class: `botao ajuda${resposta.ajuda_destacada ? " destacada" : ""}`, type: "button", "data-acao": "ajuda-no-resultado" }, ajuda.texto);
  botaoAjuda.addEventListener("click", ajuda.aoAbrir);
  const termos = resposta.construtos_usados.map((id) => linhaDeTermo(id, escolhidos, glossario, idioma)).filter((x): x is HTMLElement => x !== null);
  corpo.replaceChildren(
    // A frase é anunciada a quem usa leitor de tela assim que chega.
    el("p", { class: "frase", lang: resposta.idioma, role: "status", "data-origem": resposta.origem }, resposta.frase),
    el("p", { class: "nota" }, t("resultado.aviso", idioma)),
    el("p", { class: "nota" }, t(resposta.origem === "regra" ? "resultado.regra" : "resultado.modelo", idioma)),
    el("h3", {}, t("resultado.termos", idioma)),
    el("ul", { class: "lista termos" }, ...termos),
    el("h3", {}, t("resultado.creditos", idioma)),
    el("ul", { class: "lista" }, ...escolhidos.map(linhaDeCredito)),
    el("div", { class: "acoes" }, botaoAjuda, recomecar),
  );
}
