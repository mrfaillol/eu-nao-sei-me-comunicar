// Tipos do acervo e do glossário. Espelham data/acervo.schema.json e data/construtos.json:
// o pipeline em Python escreve, o site e a função leem.

export type Idioma = "pt-BR" | "en" | "zh-CN";
export const IDIOMAS: readonly Idioma[] = ["pt-BR", "en", "zh-CN"];

export type Tipo = "pintura" | "som" | "palavra";
export type ClasseSemiotica = "icone" | "indice" | "simbolo";

export type Afeto =
  | { metodo: "ausente" }
  | { metodo: "norma_direta"; valencia: number; ativacao: number; fonte: string };

export interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Credito {
  autor: string;
  linha: string;
  fonte: string;
  licenca: string;
  url: string;
}

/** A definição da palavra no dicionário da própria língua, copiada da fonte. */
export interface Definicao {
  texto: string;
  /** Classe gramatical, como o dicionário a escreve ("s. f."). Pode vir vazia. */
  classe: string;
  /** Pinyin, nas palavras em mandarim. Vazio nas outras. */
  pronuncia: string;
  fonte: "dicionario-aberto" | "wikcionario-pt" | "moedict";
  licenca: string;
  url: string;
}

export interface Item {
  id: string;
  tipo: Tipo;
  classe_semiotica: ClasseSemiotica;
  idioma: Idioma | null;
  rotulo: string;
  texto_humano: string;
  origem_do_texto: "curadoria" | "titulo_e_tags" | "glosa";
  construtos: string[];
  tema_sensivel: boolean;
  afeto: Afeto;
  credito: Credito;
  revisao: { humana: "pendente" | "aprovada" | "reprovada"; por: string | null; em: string | null };
  midia:
    | null
    | { arquivo: string; largura: number; altura: number }
    | { arquivo: string; duracao_ms: number };
  definicao?: Definicao;
  rosto?: Caixa | null;
  nitido?: string | null;
  sensivel?: { nudez: "nenhuma" | "parcial" | "frontal"; violencia: "nenhuma" | "historica" | "grafica" };
}

export interface Acervo {
  versao: string;
  demonstracao: boolean;
  itens: Item[];
}

export interface Construto {
  id: string;
  dimensao: boolean;
  termo: Record<Idioma, string>;
  variantes: Record<Idioma, string[]>;
  definicao: Record<Idioma, string>;
  referencia: { doi: string; citacao: string; titulo_contem: string };
}

export type Glossario = Record<string, Construto>;

/** Um termo que a frase pode usar, já no idioma de saída. */
export interface Termo {
  id: string;
  termo: string;
  variantes: string[];
  /** ids dos itens escolhidos que carregam o construto; vazio em termo de dimensão. */
  itens: string[];
}
