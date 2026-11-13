// O (i) de cada item: uma caixa com as palavras de quem descreveu a pintura ou o som, ou com a definição
// da palavra no dicionário. Com mouse, abre ao passar por cima; com toque ou teclado, abre e fecha no botão.
import type { Idioma, Item } from "../frase/tipos";
import { descritores } from "./descritores";
import { el } from "./dom";
import { t } from "./i18n";

export interface Info {
  /** A caixa, uma só para a página. Fica fora das janelas: elas têm `transform`, que prenderia um `position: fixed`. */
  caixa: HTMLElement;
  /** Cria o botão (i) de um item. `nome` é como a tela chama o item: o título, "Som 2" ou a palavra. */
  botao(item: Item, nome: string, idioma: Idioma): HTMLButtonElement;
  fechar(): void;
}

const FOLGA = 8;

// A ficha completa de cada item está em "Créditos e fontes". Aqui cabe só de quem é a voz.
const VOZ: Record<string, (item: Item) => string> = {
  cma: () => "Cleveland Museum of Art",
  mia: () => "Minneapolis Institute of Art",
  "freesound-via-openverse": (item) => ["Freesound", item.credito.autor].filter(Boolean).join(", "),
};

// Cada língua com o seu dicionário, e cada dicionário com o seu jeito: o português traz a classe gramatical
// e a secura de 1913; o chinês traz o pinyin e, muitas vezes, uma citação clássica dentro da definição.
const DICIONARIO: Record<string, string> = {
  "dicionario-aberto": "Dicionário Aberto (Cândido de Figueiredo, 1913)",
  "wikcionario-pt": "Wikcionário",
  moedict: "教育部《重編國語辭典修訂本》",
};

function verbete(item: Item, idioma: Idioma): HTMLElement[] | null {
  const d = item.definicao;
  if (!d) return null;
  const cabeca = el("p", { class: "info-verbete", lang: item.idioma }, el("strong", {}, item.rotulo));
  if (d.pronuncia) cabeca.append(" ", el("span", { class: "info-pronuncia", lang: "zh-Latn" }, d.pronuncia));
  if (d.classe) cabeca.append(" ", el("i", {}, d.classe));
  return [
    el("p", { class: "info-titulo" }, t("info.palavra", idioma)),
    cabeca,
    // A definição chinesa fica em caracteres tradicionais, como o dicionário a publicou.
    el("p", { class: "info-glosa", lang: d.fonte === "moedict" ? "zh-Hant" : item.idioma }, d.texto),
    el("p", { class: "info-fonte" }, `${DICIONARIO[d.fonte] ?? d.fonte} · ${d.licenca}`),
  ];
}

function conteudo(item: Item, idioma: Idioma): HTMLElement[] {
  const voz = VOZ[item.credito.fonte]?.(item);
  const fonte = el("p", { class: "info-fonte" }, voz ? `${voz} · ${item.credito.licenca}` : item.credito.linha);
  if (item.tipo === "palavra") {
    const doDicionario = verbete(item, idioma);
    if (doDicionario) return doDicionario;
    return [el("p", { class: "info-titulo" }, t("info.palavra", idioma)), el("p", { class: "info-glosa", lang: item.idioma }, item.texto_humano), fonte];
  }
  const nos: HTMLElement[] = [
    el("p", { class: "info-titulo" }, t(item.tipo === "pintura" ? "info.pintura" : "info.som", idioma)),
    // As palavras ficam como foram escritas, em inglês: traduzir seria trocar a voz de quem descreveu pela da máquina.
    el("ul", { class: "info-palavras", lang: "en" }, ...descritores(item).map((p) => el("li", {}, p))),
  ];
  if (idioma !== "en") nos.push(el("p", { class: "info-nota" }, t("info.original", idioma)));
  return [...nos, fonte];
}

export function criarInfo(): Info {
  const caixa = el("div", { class: "info-caixa", id: "info-caixa", role: "tooltip", hidden: true });
  let dono: HTMLElement | null = null;
  let fixada = false; // aberta por clique ou toque: não fecha quando o mouse sai

  function fechar(): void {
    dono?.setAttribute("aria-expanded", "false");
    dono?.removeAttribute("aria-describedby");
    dono = null;
    fixada = false;
    caixa.hidden = true;
  }

  function posicionar(botao: HTMLElement): void {
    const b = botao.getBoundingClientRect();
    const chao = document.querySelector(".tarefas")?.getBoundingClientRect().top ?? window.innerHeight;
    const { width, height } = caixa.getBoundingClientRect();
    const esquerda = Math.max(FOLGA, Math.min(b.left, window.innerWidth - width - FOLGA));
    const abaixo = b.bottom + 6;
    const topo = abaixo + height <= chao - FOLGA ? abaixo : Math.max(FOLGA, b.top - height - 6);
    caixa.style.left = `${esquerda}px`;
    caixa.style.top = `${topo}px`;
  }

  function abrir(botao: HTMLElement, item: Item, idioma: Idioma): void {
    if (dono !== botao) fechar();
    caixa.replaceChildren(...conteudo(item, idioma));
    caixa.hidden = false;
    dono = botao;
    botao.setAttribute("aria-expanded", "true");
    botao.setAttribute("aria-describedby", caixa.id);
    posicionar(botao);
  }

  document.addEventListener("pointerdown", (evento) => {
    const alvo = evento.target as Node | null;
    if (dono && alvo && !dono.contains(alvo) && !caixa.contains(alvo)) fechar();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && dono) fechar();
  });
  // A caixa é presa à tela: se a página rola ou muda de tamanho, ela deixaria de apontar para o botão.
  window.addEventListener("scroll", fechar, { passive: true, capture: true });
  window.addEventListener("resize", fechar);

  return {
    caixa,
    fechar,
    botao(item, nome, idioma) {
      const botao = el("button", { class: "info", type: "button", "aria-label": t("info.abrir", idioma, { nome }), "aria-expanded": "false", "data-info": item.id }, el("span", { "aria-hidden": "true" }, "i"));
      botao.addEventListener("pointerenter", (evento) => {
        if (evento.pointerType === "mouse" && !fixada) abrir(botao, item, idioma);
      });
      botao.addEventListener("pointerleave", (evento) => {
        if (evento.pointerType === "mouse" && !fixada && dono === botao) fechar();
      });
      botao.addEventListener("click", () => {
        if (dono === botao && fixada) return fechar();
        abrir(botao, item, idioma);
        fixada = true;
      });
      return botao;
    },
  };
}
