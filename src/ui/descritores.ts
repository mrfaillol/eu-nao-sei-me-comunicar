// As palavras que o (i) de cada pintura e de cada som mostra. Nenhuma é inventada aqui: todas estão
// escritas no texto humano do item (curadoria do museu, ou título e tags de quem publicou o som).
// Este módulo só separa, tira as palavras vazias e corta a lista.
import type { Item } from "../frase/tipos";

const MAXIMO = 16;

// Os textos de curadoria e as tags estão em inglês. Palavras de função e verbos auxiliares não descrevem nada.
const VAZIAS = new Set(
  `a about above after again against all also although am among an and any are around as at be because been before being below
  between both but by can could did do does doing done down during each either even ever every few for from further had has have
  having he her here hers herself him himself his how however i if in into is it its itself just later made make many may me might
  more most much must my myself near no nor not now of off often on once one only onto or other others our ours out over own per
  perhaps rather same she should since so some such than that the their theirs them themselves then there these they this those
  though through thus to too toward towards two under until up upon us very was we well were what when where whether which while
  who whom whose why will with within without would yet you your yours
  artist artists became become began begun called century depicts depicted early eight first five four known late like likely
  nine painted painter painting paintings picture possibly probably second seen set seven shows shown six spent ten third three
  time times work works year years`.split(/\s+/),
);

function semRepetir(palavras: string[]): string[] {
  const vistas = new Set<string>();
  return palavras.filter((p) => {
    const chave = p.toLowerCase();
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

/**
 * Palavras de conteúdo de um texto corrido, na ordem em que aparecem. A maiúscula de início de frase cai,
 * a não ser que a palavra seja nome próprio: está no título ou no nome do autor, ou vem antes de outra maiúscula.
 */
function palavrasDeConteudo(texto: string, nomes: Set<string>): string[] {
  const saida: string[] = [];
  for (const frase of texto.split(/(?<=[.!?;:])\s+/)) {
    const palavras = frase.split(/[^\p{L}\p{M}'’-]+/u).filter(Boolean);
    palavras.forEach((bruta, posicao) => {
      // Contração: "fire's" e "you're" valem pela palavra antes do apóstrofo; a negação ("don't") não descreve nada.
      if (/n['’]t$/i.test(bruta)) return;
      const palavra = bruta.replace(/^['’-]+|['’-]+$/g, "").split(/['’]/)[0]!;
      if (palavra.length < 3 || VAZIAS.has(palavra.toLowerCase())) return;
      const proprio = nomes.has(palavra) || /^\p{Lu}/u.test(palavras[posicao + 1] ?? "");
      saida.push(posicao === 0 && !proprio ? palavra.toLowerCase() : palavra);
    });
  }
  return saida;
}

/** Com mais palavras do que cabem, pega espaçadas do começo ao fim: o texto de curadoria abre pela biografia e descreve depois. */
function amostrar(palavras: string[]): string[] {
  if (palavras.length <= MAXIMO) return palavras;
  return Array.from({ length: MAXIMO }, (_, n) => palavras[Math.round((n * (palavras.length - 1)) / (MAXIMO - 1))]!);
}

export function descritores(item: Item): string[] {
  if (item.tipo === "palavra") return [];
  if (item.origem_do_texto === "titulo_e_tags") {
    const [titulo = "", tags = ""] = item.texto_humano.split("|");
    const lista = tags.split(",").map((t) => t.trim()).filter(Boolean);
    // No título, toda palavra costuma vir em maiúscula: não dá para separar nome próprio, então tudo vai em minúscula.
    const palavras = lista.length > 0 ? lista : palavrasDeConteudo(titulo, new Set()).map((p) => p.toLowerCase());
    return amostrar(semRepetir(palavras));
  }
  const nomes = new Set(`${item.rotulo} ${item.credito.autor}`.split(/[^\p{L}\p{M}]+/u).filter((p) => /^\p{Lu}/u.test(p)));
  return amostrar(semRepetir(palavrasDeConteudo(item.texto_humano, nomes)));
}
