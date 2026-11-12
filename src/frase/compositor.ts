// Compositor da frase por regra. É o modo de demonstração (sem chave, sem rede) e a rede de
// segurança do servidor quando o modelo falha duas vezes. A mesma seleção dá sempre a mesma frase.
import { assinatura, type Abertura } from "./assinatura";
import { moldes as en } from "./moldes/en";
import { moldes as ptBR } from "./moldes/pt-BR";
import type { Moldes } from "./moldes/tipos";
import { moldes as zhCN } from "./moldes/zh-CN";
import { porExtenso, type Genero } from "./numero";
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

/** O validador aceita de dois a quatro termos na frase (regra V5). */
const MAXIMO_DE_TERMOS = 4;

const GENERO: Record<Abertura, Genero> = { pinturas: "f", sons: "m", palavras: "f", mista: "m" };

interface Lacunas {
  quantos: number;
  idioma: Idioma;
  abertura: Abertura;
  /** Tom convergente: o primeiro termo é `{c1}` e os demais formam `{c2}`. Nos outros tons, todos formam `{lista}`. */
  termos: Termo[];
}

function preencher(molde: string, l: Lacunas, juntar: (t: string[]) => string): string {
  const nomes = l.termos.map((t) => t.termo);
  return molde
    .replace("{n}", porExtenso(l.quantos, l.idioma, GENERO[l.abertura]))
    .replace("{todos}", l.quantos === 3 ? "三者" : "它们")
    .replace("{c1}", nomes[0] ?? "")
    .replace("{c2}", juntar(nomes.slice(1)))
    .replace("{lista}", juntar(nomes));
}

/**
 * Tom convergente: o construto que mais se repete e os que ficam ao fundo. `termos` vem por frequência
 * e depois por id. Com três itens o fundo é um termo, como sempre foi; cada item a mais abre espaço para
 * mais um, até o teto do validador.
 */
function repetidoEFundo(termos: Termo[], quantos: number): Termo[] {
  const fundo = Math.min(MAXIMO_DE_TERMOS - 1, Math.max(1, quantos - 2));
  return termos.slice(0, 1 + fundo);
}

/**
 * Tons sensível e divergente: um termo por item escolhido, sem repetir, para a frase dar conta da seleção
 * inteira e não de dois itens. Com menos de dois termos distintos, completa pela ordem geral. Seleção grande
 * nomeia os quatro primeiros por frequência; os demais aparecem na caixa da frase, fora dela.
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
  return termos.filter((t) => escolhidos.has(t)).slice(0, MAXIMO_DE_TERMOS);
}

export function comporFrase(itens: Item[], idioma: Idioma, glossario: Glossario): FraseComposta {
  const moldes = MOLDES[idioma];
  // Termo de dimensão não entra em lacuna: ele qualifica a seleção, não nomeia o que ela comunica.
  const termos = termosPermitidos(itens, idioma, glossario).filter((t) => !glossario[t.id]?.dimensao);
  const { tom, abertura } = assinatura(itens);
  const lacunas = (usados: Termo[]): Lacunas => ({ quantos: itens.length, idioma, abertura, termos: usados });

  // Os moldes de borda falam em "signos", de gênero masculino, seja qual for a abertura.
  if (termos.length === 0) return { frase: preencher(moldes.semTermo, { ...lacunas([]), abertura: "mista" }, moldes.juntar), construtos_usados: [] };
  if (termos.length === 1) {
    return { frase: preencher(moldes.umTermo, { ...lacunas(termos), abertura: "mista" }, moldes.juntar), construtos_usados: [termos[0]!.id] };
  }

  const opcoes = moldes.doisTermos[tom][abertura];
  const chave = itens.map((i) => i.id).sort().join("|");
  const molde = opcoes[hash(chave) % opcoes.length]!;
  const usados = tom === "convergente" ? repetidoEFundo(termos, itens.length) : umPorItem(itens, termos);
  return { frase: preencher(molde, lacunas(usados), moldes.juntar), construtos_usados: usados.map((t) => t.id) };
}
