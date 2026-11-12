import { ajudaDestacada } from "./ajuda";
import type { Item } from "./tipos";

/** Relação entre os três itens: matéria grave, um construto que se repete, ou construtos distintos. */
export type Tom = "sensivel" | "convergente" | "divergente";
/** Classe de signo da seleção: só pinturas, só sons, só palavras, ou mistura. */
export type Abertura = "pinturas" | "sons" | "palavras" | "mista";

export interface Assinatura {
  tom: Tom;
  abertura: Abertura;
}

const ABERTURA_POR_TIPO = { pintura: "pinturas", som: "sons", palavra: "palavras" } as const;

export function assinatura(itens: Item[]): Assinatura {
  const tipos = new Set(itens.map((i) => i.tipo));
  const unico = tipos.size === 1 ? itens[0]?.tipo : undefined;
  const abertura: Abertura = unico ? ABERTURA_POR_TIPO[unico] : "mista";

  if (ajudaDestacada(itens)) return { tom: "sensivel", abertura };

  const contagem = new Map<string, number>();
  for (const item of itens) for (const c of item.construtos) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  const repete = [...contagem.values()].some((n) => n >= 2);
  return { tom: repete ? "convergente" : "divergente", abertura };
}
