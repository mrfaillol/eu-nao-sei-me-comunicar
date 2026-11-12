// Zoom até o rosto de destaque. A conta e o comportamento vêm de docs/pesquisa/zoom-no-rosto.md,
// seção (d), medidos no Chrome: só `transform` na pintura e `opacity` na camada nítida.
import type { Caixa } from "../frase/tipos";

export interface Alvo {
  s: number;
  tx: number;
  ty: number;
}

/**
 * Escala e deslocamento que põem o rosto com `k` da largura da moldura (e no máximo `kAlt` da altura),
 * centrado, sem deixar a pintura descobrir a moldura. É a mesma conta de pipeline/acervo/rostos.py.
 */
export function alvo(c: Caixa, k = 0.5, kAlt = 0.8, sMax = 8): Alvo {
  const s = Math.max(1, Math.min(k / c.w, kAlt / c.h, sMax));
  const limitar = (v: number) => Math.min(0, Math.max(1 - s, v));
  return { s, tx: limitar(0.5 - s * (c.x + c.w / 2)), ty: limitar(0.5 - s * (c.y + c.h / 2)) };
}

const vez = new WeakMap<HTMLElement, number>();

export function aproximar(moldura: HTMLElement, caixa: Caixa): void {
  const pintura = moldura.querySelector<HTMLElement>(".pintura");
  const nitido = moldura.querySelector<HTMLElement>(".nitido");
  if (!pintura) return;
  const { s, tx, ty } = alvo(caixa);
  const estaVez = (vez.get(moldura) ?? 0) + 1;
  vez.set(moldura, estaVez); // invalida temporizador e evento de chamadas antigas
  pintura.style.setProperty("--s", String(s));
  pintura.style.setProperty("--tx", `${tx * 100}%`);
  pintura.style.setProperty("--ty", `${ty * 100}%`);
  if (!nitido) return;
  const pronto = () => {
    if (vez.get(moldura) === estaVez) nitido.classList.add("pronto");
  };
  const ms = parseFloat(getComputedStyle(pintura).transitionDuration) * 1000;
  if (!(ms > 0)) return pronto();
  pintura.addEventListener("transitionend", pronto, { once: true });
  setTimeout(pronto, ms + 400); // o evento pode não chegar (medido a frio); o temporizador garante
}

export function afastar(moldura: HTMLElement): void {
  const pintura = moldura.querySelector<HTMLElement>(".pintura");
  vez.set(moldura, (vez.get(moldura) ?? 0) + 1);
  moldura.querySelector(".nitido")?.classList.remove("pronto");
  for (const v of ["--s", "--tx", "--ty"]) pintura?.style.removeProperty(v);
}
