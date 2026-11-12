import type { Glossario, Idioma, Item, Termo } from "./tipos";

// Cortes do contrato da frase (docs/pesquisa/pre-prompt.md, seção a). Só valem sobre norma direta:
// afeto derivado da descrição comprime tudo no meio da escala e foi descartado.
const VALENCIA_NEGATIVA = -0.3;
const VALENCIA_POSITIVA = 0.3;
const ATIVACAO_ALTA = 0.6;
const ATIVACAO_BAIXA = 0.3;
const MINIMO_DE_ITENS_COM_NORMA = 2;

function media(valores: number[]): number {
  const soma = valores.reduce((a, b) => a + b, 0);
  return Math.round((soma / valores.length) * 1e4) / 1e4;
}

function termoDe(id: string, idioma: Idioma, glossario: Glossario, itens: string[]): Termo | null {
  const construto = glossario[id];
  if (!construto) return null;
  return { id, termo: construto.termo[idioma], variantes: construto.variantes[idioma], itens };
}

function idsDeDimensao(itens: Item[]): string[] {
  const comNorma = itens.flatMap((i) => (i.afeto.metodo === "norma_direta" ? [i.afeto] : []));
  if (comNorma.length < MINIMO_DE_ITENS_COM_NORMA) return [];

  const ids: string[] = [];
  const valencia = media(comNorma.map((a) => a.valencia));
  const ativacao = media(comNorma.map((a) => a.ativacao));
  if (ativacao >= ATIVACAO_ALTA) ids.push("alta_ativacao");
  if (ativacao <= ATIVACAO_BAIXA) ids.push("baixa_ativacao");
  if (valencia <= VALENCIA_NEGATIVA) ids.push("valencia_negativa");
  if (valencia >= VALENCIA_POSITIVA) ids.push("valencia_positiva");
  return ids.sort();
}

/**
 * Os termos científicos que a frase pode usar para esta seleção, já no idioma de saída:
 * a união dos construtos dos três itens (mais frequentes primeiro) e, depois, os termos
 * de dimensão que as normas diretas sustentam.
 */
export function termosPermitidos(itens: Item[], idioma: Idioma, glossario: Glossario): Termo[] {
  const portadores = new Map<string, string[]>();
  for (const item of itens) {
    for (const id of item.construtos) {
      portadores.set(id, [...(portadores.get(id) ?? []), item.id]);
    }
  }

  const construtos = [...portadores.entries()]
    .sort(([idA, a], [idB, b]) => b.length - a.length || idA.localeCompare(idB))
    .map(([id, ids]) => termoDe(id, idioma, glossario, ids));

  const dimensoes = idsDeDimensao(itens).map((id) => termoDe(id, idioma, glossario, []));

  return [...construtos, ...dimensoes].filter((t): t is Termo => t !== null);
}
