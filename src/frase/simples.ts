// A versão simples da frase. A frase principal usa o termo catalogado ("apego ao lugar"); esta diz o mesmo
// em palavras do dia a dia ("ligação forte com um lugar"), para quem não lê artigo científico.
// Vale a mesma regra da principal: fala do que a seleção comunica, nunca do que a pessoa sente ou é.
import { assinatura, type Tom } from "./assinatura";
import { moldes as en } from "./moldes/en";
import { moldes as ptBR } from "./moldes/pt-BR";
import { moldes as zhCN } from "./moldes/zh-CN";
import type { Glossario, Idioma, Item } from "./tipos";

interface MoldesSimples {
  /** `{s1}` é o assunto que mais se repete; `{resto}`, os demais. */
  convergente: string;
  convergenteSo: string;
  divergente: string;
  sensivel: string;
  umTermo: string;
  semTermo: string;
}

const MOLDES: Record<Idioma, MoldesSimples> = {
  "pt-BR": {
    convergente: "O que você escolheu volta mais de uma vez a um mesmo assunto: {s1}. Junto com isso: {resto}.",
    convergenteSo: "O que você escolheu volta mais de uma vez a um mesmo assunto: {s1}.",
    divergente: "O que você escolheu fala de coisas diferentes, lado a lado: {lista}.",
    sensivel: "O que você escolheu toca em assuntos pesados: {lista}.",
    umTermo: "Tudo o que você escolheu aponta para um assunto só: {s1}.",
    semTermo: "O que você escolheu ainda não tem um nome simples neste acervo.",
  },
  en: {
    convergente: "What you chose keeps coming back to one thing: {s1}. Alongside it: {resto}.",
    convergenteSo: "What you chose keeps coming back to one thing: {s1}.",
    divergente: "What you chose speaks of different things, side by side: {lista}.",
    sensivel: "What you chose touches heavy matters: {lista}.",
    umTermo: "Everything you chose points to one thing: {s1}.",
    semTermo: "What you chose does not yet have a plain name in this collection.",
  },
  // REVISÃO NATIVA PENDENTE, como os moldes da frase principal em mandarim.
  "zh-CN": {
    convergente: "你选的东西一再回到同一件事：{s1}。同时出现的还有：{resto}。",
    convergenteSo: "你选的东西一再回到同一件事：{s1}。",
    divergente: "你选的东西说的是几件不同的事，它们并排放在一起：{lista}。",
    sensivel: "你选的东西碰到了沉重的话题：{lista}。",
    umTermo: "你选的东西都指向同一件事：{s1}。",
    semTermo: "你选的东西在这份收藏里还没有一个简单的说法。",
  },
};

const JUNTAR: Record<Idioma, (partes: string[]) => string> = { "pt-BR": ptBR.juntar, en: en.juntar, "zh-CN": zhCN.juntar };

/** A explicação simples do construto no idioma, ou o próprio termo quando ela não existe. */
export function emPalavrasSimples(id: string, idioma: Idioma, glossario: Glossario): string | null {
  const construto = glossario[id];
  if (!construto) return null;
  return construto.simples?.[idioma] ?? construto.termo[idioma];
}

/**
 * A versão simples, a partir dos construtos que a frase principal nomeou (na ordem dela) e dos itens
 * escolhidos, que dão o tom. Serve à frase por regra e à frase do modelo: as duas declaram os construtos usados.
 */
export function comporSimples(construtosUsados: string[], itens: Item[], idioma: Idioma, glossario: Glossario): string {
  const moldes = MOLDES[idioma];
  const partes = construtosUsados.map((id) => emPalavrasSimples(id, idioma, glossario)).filter((p): p is string => p !== null);
  if (partes.length === 0) return moldes.semTermo;
  if (partes.length === 1) return moldes.umTermo.replace("{s1}", partes[0]!);
  const tom: Tom = assinatura(itens).tom;
  if (tom === "convergente") {
    return moldes.convergente.replace("{s1}", partes[0]!).replace("{resto}", JUNTAR[idioma](partes.slice(1)));
  }
  return moldes[tom].replace("{lista}", JUNTAR[idioma](partes));
}
