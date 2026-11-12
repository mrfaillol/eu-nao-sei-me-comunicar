// Compositor da frase por regra. É o modo de demonstração (sem chave, sem rede) e a rede de
// segurança do servidor quando o modelo falha duas vezes. A mesma seleção dá sempre a mesma frase.
import { assinatura } from "./assinatura";
import { moldes as en } from "./moldes/en";
import { moldes as ptBR } from "./moldes/pt-BR";
import type { Moldes } from "./moldes/tipos";
import { moldes as zhCN } from "./moldes/zh-CN";
import { termosPermitidos } from "./termos";
import type { Glossario, Idioma, Item, Termo } from "./tipos";

export interface FraseComposta {
  frase: string;
  construtos_usados: string[];
}

const MOLDES: Record<Idioma, Moldes> = { "pt-BR": ptBR, en, "zh-CN": zhCN };

/** FNV-1a de 32 bits: hash estável e sem dependência, para escolher a variante do molde. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function preencher(molde: string, termos: Termo[], juntar: (t: string[]) => string): string {
  return molde
    .replace("{c1}", termos[0]?.termo ?? "")
    .replace("{c2}", termos[1]?.termo ?? "")
    .replace("{lista}", juntar(termos.map((t) => t.termo)));
}

/** Tom convergente: o construto que se repete e o seguinte. `termos` vem por frequência e depois por id. */
function repetidoEFundo(termos: Termo[]): Termo[] {
  return termos.slice(0, 2);
}

/**
 * Tons sensível e divergente: um termo por item escolhido, sem repetir, para a frase dar conta
 * dos três itens e não de dois. Com menos de dois termos distintos, completa pela ordem geral.
 */
function umPorItem(itens: Item[], termos: Termo[]): Termo[] {
  const escolhidos = new Set<Termo>();
  for (const item of [...itens].sort((a, b) => a.id.localeCompare(b.id))) {
    const termo = termos.find((t) => t.itens.includes(item.id) && !escolhidos.has(t));
    if (termo) escolhidos.add(termo);
  }
  for (const termo of termos) {
    if (escolhidos.size >= 2) break;
    escolhidos.add(termo);
  }
  return termos.filter((t) => escolhidos.has(t));
}

export function comporFrase(itens: Item[], idioma: Idioma, glossario: Glossario): FraseComposta {
  const moldes = MOLDES[idioma];
  // Termo de dimensão não entra em lacuna: ele qualifica a seleção, não nomeia o que ela comunica.
  const termos = termosPermitidos(itens, idioma, glossario).filter((t) => !glossario[t.id]?.dimensao);

  if (termos.length === 0) return { frase: moldes.semTermo, construtos_usados: [] };
  if (termos.length === 1) {
    return { frase: preencher(moldes.umTermo, termos, moldes.juntar), construtos_usados: [termos[0]!.id] };
  }

  const { tom, abertura } = assinatura(itens);
  const opcoes = moldes.doisTermos[tom][abertura];
  const chave = itens.map((i) => i.id).sort().join("|");
  const molde = opcoes[hash(chave) % opcoes.length]!;
  const usados = tom === "convergente" ? repetidoEFundo(termos) : umPorItem(itens, termos);
  return { frase: preencher(molde, usados, moldes.juntar), construtos_usados: usados.map((t) => t.id) };
}
