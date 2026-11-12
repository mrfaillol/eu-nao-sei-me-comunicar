// Validador da frase. Roda no servidor sobre a resposta do modelo e no teste sobre o compositor.
//
// Duas escolhas de desenho vieram da medição de 12/Nov/2026 (docs/pesquisa/dossie.md, seção 2):
// - A segunda pessoa é conferida por lista de PERMISSÃO. Com lista de bloqueio ("você tem",
//   "você sente"), 33 de 33 frases defeituosas passavam: sempre existe um verbo fora da lista.
//   A pergunta certa é "o que a frase PODE dizer da pessoa?", e a resposta é curta: que ela escolheu.
// - Em chinês, por substring pura, 差异化 acusava 异化. O plano previa casar só em fronteira de
//   Intl.Segmenter, mas o dicionário do ICU não conhece termo técnico e junta 是正|性|效|价, de modo
//   que 正性效价 nunca cai em fronteira. Ficou: o termo mais longo casa primeiro, e uma lista curta de
//   palavras comuns que contêm um termo consome o trecho antes dele.
import { termosPermitidos } from "./termos";
import type { Glossario, Idioma, Item } from "./tipos";

export type Codigo = "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8" | "V9" | "V10";

export interface Validacao {
  ok: boolean;
  codigos: Codigo[];
}

type PorIdioma<T> = Record<Idioma, T>;

const HAN = /\p{Script=Han}/gu;
const LIMITE: PorIdioma<[number, number]> = { "pt-BR": [15, 45], en: [15, 45], "zh-CN": [25, 80] };
const PONTO_FINAL: PorIdioma<string> = { "pt-BR": ".", en: ".", "zh-CN": "。" };

// V2: o que pode aparecer no corpo da frase, antes do ponto final.
const CORPO_PERMITIDO: PorIdioma<RegExp> = {
  "pt-BR": /^[\p{L}\p{M} ,'’-]+$/u,
  en: /^[\p{L}\p{M} ,'’-]+$/u,
  "zh-CN": /^[\p{L}\p{M} ，、'’-]+$/u,
};

const SEGUNDA_PESSOA: PorIdioma<RegExp> = {
  "pt-BR": /(?<![\p{L}\p{M}])(você|seus?|suas?)(?![\p{L}\p{M}])/iu,
  en: /\b(you|your)\b/i,
  "zh-CN": /你/u,
};

// V6: o que a frase pode dizer da pessoa. Sujeito "você" só com verbo do ato de escolher ou comunicar;
// possessivo só junto de substantivo da seleção.
const ATO_PT = new Set(["reuniu", "escolheu", "pôs", "colocou", "juntou", "selecionou", "comunica"]);
const NOME_PT = /^(escolhas?|seleção|mensagem|palavras)$/i;
const ATO_EN = new Set(["gathered", "chose", "placed", "picked", "selected", "put", "set", "communicate"]);
const NOME_EN = /^(choices?|selection|message|own)$/i;
const DEPOIS_DE_NI = /^(把|选的|选择的|放在|的(这)?三个选择|的选择|的信息|没有(用自己的话)?讲出来)/u;

const NOSOLOGIA: PorIdioma<RegExp> = {
  "pt-BR":
    /transtorno|depress|bipolar|esquizo|síndrome|sintoma|diagnóst|patolog|doença|distúrbio|psicose|neurose|tdah|autis|borderline|pânico|fobia|suicid|clínic|paciente|anedonia|ansiedade|hipervigil|estresse pós|trauma|insônia|dissocia|burnout|humor/iu,
  en: /disorder|depress|bipolar|schizo|syndrome|symptom|diagnos|patholog|illness|psychosis|neurosis|adhd|autis|borderline|panic|phobia|suicid|clinical|patient|anhedonia|anxiety|hypervigil|trauma|insomnia|dissociat|burnout|chronic|\bmood\b/i,
  "zh-CN":
    /障碍|抑郁|双相|精神分裂|综合征|症状|诊断|病理|疾病|精神病|神经症|多动症|自闭|恐慌|恐惧症|自杀|临床|患者|焦虑|失眠|快感缺失|创伤|应激|情绪状态/u,
};

// V7: conselho, consolo dirigido e qualquer menção de ajuda. O link de ajuda é do app, nunca da frase.
const CONSELHO: PorIdioma<RegExp> = {
  "pt-BR":
    /(?<![\p{L}\p{M}])(procure|busque|tente|deveria|deve|precisa|recomendo|considere|permita-se|cuide|respire|fale|converse|conversar|ligue|ajuda|apoio|profissional|terapia|terapeuta|psicólog[oa]|médic[oa])(?![\p{L}\p{M}])|vai passar|é importante|vale a pena/iu,
  en: /\b(should|try to|consider|seek|you need to|must|recommend|take care|remember to|will pass|reach out|talk to|talking to|counselor|therapist|therapy|help|please|call)\b/i,
  "zh-CN": /应该|建议|你需要|试着|不妨|最好|寻求|记得|会过去|求助|帮助|热线|请|聊一聊|谈谈|可以找|打电话|咨询/u,
};

const AUTOR_E_TEORIA: PorIdioma<RegExp> = {
  "pt-BR": /(?<![\p{L}\p{M}])segundo(?![\p{L}\p{M}])|de acordo com|conforme|materialis|dialétic|semiótic|behavioris|marxis/iu,
  en: /according to|materialis|dialectic|semiotic|behaviou?ris|marxis/i,
  "zh-CN":
    /根据|认为|唯物|辩证|符号学|行为主义|马克思|恩格斯|弗洛伊德|斯金纳|巴甫洛夫|皮尔斯|索绪尔|维果茨基|拉康|荣格|涂尔干|黑格尔/u,
};
const TEORICOS =
  /\b(Marx|Engels|Freud|Skinner|Pavlov|Peirce|Saussure|Vygotsky|Vigotski|Lacan|Jung|Durkheim|Adorno|Benjamin|Bakhtin|Russell|Lukács|Gramsci|Hegel)\b/i;

const VERBO_DE_MENSAGEM: PorIdioma<RegExp> = {
  "pt-BR": /(?<![\p{L}\p{M}])(comunica|comunicam|diz|dizem|sinaliza|sinalizam|expressa|expressam|afirma|afirmam|nomeia|nomeiam)(?![\p{L}\p{M}])/iu,
  en: /\b(communicates?|says?|signals?|express(es)?|states?|conveys?|names?)\b/i,
  "zh-CN": /传达|表达|说出|说明|表明|诉说/u,
};

const VOTO_PT = /(?<![\p{L}\p{M}])(que|uma|você|sua|suas|com|em|da|do|pela|não)(?![\p{L}\p{M}])/giu;
const VOTO_EN = /\b(the|and|you|your|of|which|that|with|in|by)\b/gi;
// Caracteres que só existem na escrita tradicional. Lista mínima: pega texto tradicional corrido, não um caractere isolado raro.
// Palavras comuns que contêm um termo do glossário sem ter relação com ele.
const PALAVRAS_COMUNS_QUE_CONTEM_TERMO: PorIdioma<string[]> = {
  "pt-BR": [],
  en: [],
  "zh-CN": ["差异化", "单独处理"],
};
const SO_TRADICIONAL = /[們這個說會來時為無傳達選擇語聲畫詞屬緒戲遊歸眾連]/u;

function palavras(texto: string): string[] {
  return texto.split(/\s+/).filter(Boolean);
}

function semPontuacao(palavra: string): string {
  return palavra.replace(/[^\p{L}\p{M}'’-]/gu, "");
}

function rotulosEscolhidos(itens: Item[]): string[] {
  return itens.filter((i) => i.tipo === "palavra").map((i) => i.rotulo);
}

interface Ocorrencia {
  /** null marca palavra comum que só consome o trecho. */
  id: string | null;
  inicio: number;
  fim: number;
}

/**
 * Acha os termos do glossário na frase. O termo mais longo casa primeiro e consome o trecho,
 * para "apego ao lugar" não ser lido também como "apego" e 地方依恋 não ser lido como 依恋.
 */
function termosNaFrase(frase: string, idioma: Idioma, glossario: Glossario): string[] {
  const doGlossario: Array<{ id: string | null; texto: string }> = Object.values(glossario).flatMap((c) =>
    [c.termo[idioma], ...c.variantes[idioma]].map((texto) => ({ id: c.id, texto })),
  );
  const comuns = PALAVRAS_COMUNS_QUE_CONTEM_TERMO[idioma].map((texto) => ({ id: null, texto }));
  const formas = [...doGlossario, ...comuns]
    .filter((f) => f.texto.length > 0)
    .sort((a, b) => b.texto.length - a.texto.length);

  const alvo = frase.toLocaleLowerCase();
  const semEspacoEntrePalavras = idioma === "zh-CN";
  const ehLetra = (c: string | undefined) => c !== undefined && /[\p{L}\p{M}]/u.test(c);
  const achados: Ocorrencia[] = [];

  for (const forma of formas) {
    const agulha = forma.texto.toLocaleLowerCase();
    let de = 0;
    for (;;) {
      const inicio = alvo.indexOf(agulha, de);
      if (inicio < 0) break;
      const fim = inicio + agulha.length;
      de = inicio + 1;
      const naFronteira = semEspacoEntrePalavras || (!ehLetra(alvo[inicio - 1]) && !ehLetra(alvo[fim]));
      const livre = !achados.some((o) => inicio < o.fim && fim > o.inicio);
      if (naFronteira && livre) achados.push({ id: forma.id, inicio, fim });
    }
  }
  return [...new Set(achados.flatMap((o) => (o.id === null ? [] : [o.id])))];
}

function segundaPessoaSoDoAto(frase: string, idioma: Idioma): boolean {
  if (idioma === "zh-CN") {
    for (const m of frase.matchAll(/你/gu)) {
      if (!DEPOIS_DE_NI.test(frase.slice(m.index + 1, m.index + 14))) return false;
    }
    return true;
  }

  const lista = palavras(frase).map(semPontuacao);
  const [pronome, possessivo, atos, nomes, depois] =
    idioma === "pt-BR"
      ? [/^você$/i, /^(seus?|suas?)$/i, ATO_PT, NOME_PT, 2]
      : [/^you$/i, /^your$/i, ATO_EN, NOME_EN, 2];

  for (const [i, palavra] of lista.entries()) {
    if (pronome.test(palavra)) {
      const proxima = (lista[i + 1] ?? "").toLocaleLowerCase();
      if (!atos.has(proxima)) return false;
    }
    if (possessivo.test(palavra)) {
      // pt-BR aceita o substantivo antes ("palavras suas"); en não tem possessivo posposto.
      const vizinhas = [...(idioma === "pt-BR" ? lista.slice(Math.max(0, i - 1), i) : []), ...lista.slice(i + 1, i + 1 + depois)];
      if (!vizinhas.some((v) => nomes.test(v))) return false;
    }
  }
  return true;
}

function fraseUnica(frase: string, itens: Item[], idioma: Idioma): boolean {
  if (!frase.endsWith(PONTO_FINAL[idioma])) return false;
  const corpo = frase.slice(0, -1);
  if (!CORPO_PERMITIDO[idioma].test(corpo)) return false;
  if (idioma === "zh-CN") return true;

  // Sem pontuação para denunciar, uma segunda frase colada aparece como maiúscula no meio.
  const rotulos = new Set(rotulosEscolhidos(itens).flatMap(palavras));
  return palavras(corpo)
    .slice(1)
    .map(semPontuacao)
    .every((p) => p === "" || p[0] === p[0]!.toLocaleLowerCase() || rotulos.has(p));
}

function idiomaCerto(frase: string, itens: Item[], idioma: Idioma): boolean {
  if (idioma === "zh-CN") {
    if (SO_TRADICIONAL.test(frase)) return false;
    const rotulos = rotulosEscolhidos(itens).join(" ").toLocaleLowerCase();
    const latinas = frase.match(/[A-Za-zÀ-ÿ]+/g) ?? [];
    return latinas.every((w) => rotulos.includes(w.toLocaleLowerCase()));
  }
  if (frase.match(HAN)) return false;
  const maisIngles = (frase.match(VOTO_EN) ?? []).length > (frase.match(VOTO_PT) ?? []).length;
  return maisIngles === (idioma === "en");
}

function citaAutor(frase: string, itens: Item[], idioma: Idioma): boolean {
  if (/\p{N}/u.test(frase)) return true;
  if (AUTOR_E_TEORIA[idioma].test(frase) || TEORICOS.test(frase)) return true;
  const sobrenomes = itens.flatMap((i) => i.credito.autor.split(/[\s,()-]+/)).filter((p) => p.length >= 4 && /^\p{Lu}/u.test(p));
  const alvo = frase.toLocaleLowerCase();
  return sobrenomes.some((s) => new RegExp(`(?<![\\p{L}\\p{M}])${s.toLocaleLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}])`, "u").test(alvo));
}

/**
 * Confere a frase contra o contrato. `construtosUsados` é o que o autor da frase (modelo ou compositor)
 * declara ter usado. Devolve todos os códigos violados, para a segunda tentativa saber o que corrigir.
 */
export function validarFrase(
  frase: string,
  construtosUsados: string[],
  itens: Item[],
  idioma: Idioma,
  glossario: Glossario,
): Validacao {
  const texto = frase.trim();
  const codigos: Codigo[] = [];

  if (!fraseUnica(texto, itens, idioma)) codigos.push("V2");

  const tamanho = idioma === "zh-CN" ? (texto.match(HAN) ?? []).length : palavras(texto).length;
  const [minimo, maximo] = LIMITE[idioma];
  if (tamanho < minimo || tamanho > maximo) codigos.push("V3");

  if (!SEGUNDA_PESSOA[idioma].test(texto) || (idioma === "zh-CN" && texto.includes("您"))) codigos.push("V4");

  const permitidos = new Set(termosPermitidos(itens, idioma, glossario).map((t) => t.id));
  const naFrase = new Set(termosNaFrase(texto, idioma, glossario));
  const fora = [...naFrase].filter((id) => !permitidos.has(id));
  const presentes = [...naFrase].filter((id) => permitidos.has(id));
  const declaradosValem = construtosUsados.every((id) => permitidos.has(id) && naFrase.has(id));
  if (fora.length > 0 || !declaradosValem || presentes.length < 2 || presentes.length > 4) codigos.push("V5");

  if (!segundaPessoaSoDoAto(texto, idioma) || NOSOLOGIA[idioma].test(texto)) codigos.push("V6");
  if (CONSELHO[idioma].test(texto)) codigos.push("V7");
  if (citaAutor(texto, itens, idioma)) codigos.push("V8");
  if (!VERBO_DE_MENSAGEM[idioma].test(texto)) codigos.push("V9");
  if (!idiomaCerto(texto, itens, idioma)) codigos.push("V10");

  return { ok: codigos.length === 0, codigos };
}
