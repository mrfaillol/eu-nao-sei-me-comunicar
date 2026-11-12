// Adapta os casos de teste do pré-prompt (docs/pesquisa/pre-prompt-casos.json) aos tipos do app.
// Os casos trazem valência e ativação soltas no item; aqui número vira norma_direta e null vira ausente.
import dados from "./casos.json";
import type { Construto, Glossario, Idioma, Item, Tipo } from "../../src/frase/tipos";

const DIMENSOES = new Set(["valencia_negativa", "valencia_positiva", "alta_ativacao", "baixa_ativacao"]);

interface ItemBruto {
  id: string;
  tipo: string;
  rotulo: string;
  texto_humano: string;
  classe_semiotica: string;
  valencia: number | null;
  ativacao: number | null;
  construtos: string[];
  tema_sensivel?: boolean;
  autor?: string;
}

export interface Caso {
  id: string;
  ajuda_destacada: boolean;
  construtos_usados: string[];
  frase: Record<Idioma, string>;
  itens: Item[];
}

export interface Mutacao {
  caso: string;
  idioma: Idioma;
  deve_falhar: string;
  construtos_usados: string[];
  frase: string;
}

export function itemDoCaso(bruto: ItemBruto): Item {
  const tipo = bruto.tipo as Tipo;
  const item: Item = {
    id: bruto.id,
    tipo,
    classe_semiotica: bruto.classe_semiotica as Item["classe_semiotica"],
    idioma: tipo === "palavra" ? "pt-BR" : null,
    rotulo: bruto.rotulo,
    texto_humano: bruto.texto_humano,
    origem_do_texto: tipo === "pintura" ? "curadoria" : tipo === "som" ? "titulo_e_tags" : "glosa",
    construtos: bruto.construtos,
    tema_sensivel: bruto.tema_sensivel ?? false,
    afeto:
      bruto.valencia === null || bruto.ativacao === null
        ? { metodo: "ausente" }
        : { metodo: "norma_direta", valencia: bruto.valencia, ativacao: bruto.ativacao, fonte: "caso-de-teste" },
    credito: { autor: bruto.autor ?? "", linha: bruto.rotulo, fonte: "caso-de-teste", licenca: "CC0-1.0", url: "https://exemplo.invalid" },
    revisao: { humana: "pendente", por: null, em: null },
    midia: null,
  };
  return item;
}

export function glossarioDosCasos(): Glossario {
  const glossario: Glossario = {};
  for (const [id, termo] of Object.entries(dados.glossario as Record<string, Record<Idioma, string>>)) {
    const construto: Construto = {
      id,
      dimensao: DIMENSOES.has(id),
      termo,
      variantes: { "pt-BR": [], en: [], "zh-CN": [] },
      definicao: termo,
      referencia: { doi: "10.0000/caso-de-teste", citacao: "caso de teste", titulo_contem: "teste" },
    };
    glossario[id] = construto;
  }
  return glossario;
}

export function casos(): Caso[] {
  return (dados.casos as unknown as Array<Omit<Caso, "itens"> & { itens: ItemBruto[] }>).map((c) => ({
    ...c,
    itens: c.itens.map(itemDoCaso),
  }));
}

export function caso(prefixo: string): Caso {
  const achado = casos().find((c) => c.id.startsWith(prefixo));
  if (!achado) throw new Error(`caso de teste não encontrado: ${prefixo}`);
  return achado;
}

export function mutacoes(): Mutacao[] {
  return dados.mutacoes as unknown as Mutacao[];
}

/** Devolve uma cópia do item sem número de afeto, como uma pintura ou um som do acervo real. */
export function semAfeto(item: Item): Item {
  return { ...item, afeto: { metodo: "ausente" } };
}

/** Devolve uma cópia do item marcada como tema sensível. */
export function sensivel(item: Item, valor = true): Item {
  return { ...item, tema_sensivel: valor };
}
