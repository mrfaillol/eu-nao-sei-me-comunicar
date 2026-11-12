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

export interface AcoesDoResultado {
  aoRecomecar: () => void;
  /** Fecha a caixa e mantém a seleção, para a pessoa acrescentar ou retirar escolhas. */
  aoContinuar: () => void;
  ajuda: { texto: string; aoAbrir: () => void };
}

/** Os construtos da seleção que a frase não nomeou, dos mais repetidos para os menos. */
function construtosDeFora(escolhidos: Item[], usados: string[]): string[] {
  const contagem = new Map<string, number>();
  for (const item of escolhidos) for (const id of item.construtos) if (!usados.includes(id)) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  return [...contagem.entries()].sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b)).map(([id]) => id);
}

export function desenharResultado(corpo: HTMLElement, resposta: Resposta, escolhidos: Item[], glossario: Glossario, idioma: Idioma, acoes: AcoesDoResultado): void {
  const { ajuda } = acoes;
  const recomecar = el("button", { class: "botao", type: "button", "data-acao": "recomecar" }, t("resultado.recomecar", idioma));
  recomecar.addEventListener("click", acoes.aoRecomecar);
  const continuar = el("button", { class: "botao", type: "button", "data-acao": "continuar" }, t("resultado.continuar", idioma));
  continuar.addEventListener("click", acoes.aoContinuar);
  // A frase nomeia até quatro termos. Numa seleção grande, os outros não somem: ficam listados aqui, com a mesma procedência.
  const demais = construtosDeFora(escolhidos, resposta.construtos_usados).map((id) => linhaDeTermo(id, escolhidos, glossario, idioma)).filter((x): x is HTMLElement => x !== null);
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
    ...(demais.length > 0 ? [el("details", { class: "demais" }, el("summary", {}, t("resultado.demais", idioma, { n: demais.length })), el("ul", { class: "lista termos-demais" }, ...demais))] : []),
    el("h3", {}, t("resultado.creditos", idioma)),
    el("ul", { class: "lista" }, ...escolhidos.map(linhaDeCredito)),
    el("div", { class: "acoes" }, botaoAjuda, recomecar, continuar),
  );
}
