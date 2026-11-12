import { el } from "./dom";

export interface OpcoesDeJanela {
  id: string;
  titulo: string;
  conteudo: HTMLElement;
  rodape?: HTMLElement;
}

const ARRASTAVEL = "(min-width: 900px) and (pointer: fine)";

function barra(id: string, titulo: string): HTMLElement {
  // Os três quadradinhos são só desenho da moldura; não fazem nada e ficam fora da leitura de tela.
  const enfeites = el("span", { class: "enfeites", "aria-hidden": "true" }, el("i"), el("i"), el("i"));
  return el("div", { class: "barra" }, el("h2", { id: `titulo-${id}` }, titulo), enfeites);
}

/** Uma janela em estilo de sistema clássico. Em tela larga com mouse, a barra de título arrasta. */
export function criarJanela(opcoes: OpcoesDeJanela): HTMLElement {
  const corpo = el("div", { class: "corpo" }, opcoes.conteudo, opcoes.rodape && el("div", { class: "rodape" }, opcoes.rodape));
  const janela = el(
    "section",
    { class: "janela", role: "group", "aria-labelledby": `titulo-${opcoes.id}`, "data-janela": opcoes.id },
    barra(opcoes.id, opcoes.titulo),
    corpo,
  );
  // Tocar em qualquer ponto traz a janela para a frente, como numa área de trabalho.
  janela.addEventListener("pointerdown", () => trazerParaFrente(janela));
  tornarArrastavel(janela);
  return janela;
}

export function definirTitulo(janela: HTMLElement, titulo: string): void {
  const h2 = janela.querySelector("h2");
  if (h2) h2.textContent = titulo;
}

const CAMADA_INICIAL = 10;
const CAMADA_MAXIMA = 900; // a barra de tarefas fica em 1000 e nunca pode ser coberta
let topo = CAMADA_INICIAL;

function trazerParaFrente(janela: HTMLElement): void {
  if (topo >= CAMADA_MAXIMA) {
    // Renumera as janelas na ordem em que estão, a partir da camada inicial.
    const todas = [...document.querySelectorAll<HTMLElement>(".janela[data-janela]")].sort(
      (a, b) => (Number(a.style.zIndex) || 0) - (Number(b.style.zIndex) || 0),
    );
    topo = CAMADA_INICIAL;
    for (const j of todas) j.style.zIndex = String(++topo);
  }
  janela.style.zIndex = String(++topo);
}

function tornarArrastavel(janela: HTMLElement): void {
  const pega = janela.querySelector<HTMLElement>(".barra");
  if (!pega) return;
  let origem: { x: number; y: number; dx: number; dy: number } | null = null;

  pega.addEventListener("pointerdown", (e) => {
    if (!window.matchMedia(ARRASTAVEL).matches || e.button !== 0) return;
    origem = { x: e.clientX, y: e.clientY, dx: parseFloat(janela.style.getPropertyValue("--dx")) || 0, dy: parseFloat(janela.style.getPropertyValue("--dy")) || 0 };
    trazerParaFrente(janela);
    janela.classList.add("arrastando");
    pega.setPointerCapture(e.pointerId);
  });
  pega.addEventListener("pointermove", (e) => {
    if (!origem) return;
    janela.style.setProperty("--dx", `${origem.dx + e.clientX - origem.x}px`);
    janela.style.setProperty("--dy", `${origem.dy + e.clientY - origem.y}px`);
  });
  const soltar = () => {
    origem = null;
    janela.classList.remove("arrastando");
  };
  pega.addEventListener("pointerup", soltar);
  pega.addEventListener("pointercancel", soltar);
}

/** Caixa de diálogo com a mesma moldura. Usa <dialog>: foco preso, Esc fecha, fundo inerte. */
export function criarDialogo(id: string, titulo: string): { dialogo: HTMLDialogElement; corpo: HTMLElement; titular(t: string): void } {
  const corpo = el("div", { class: "corpo" });
  const dialogo = el("dialog", { class: "janela", "aria-labelledby": `titulo-${id}`, "data-dialogo": id }, barra(id, titulo), corpo);
  return { dialogo, corpo, titular: (t) => definirTitulo(dialogo, t) };
}
