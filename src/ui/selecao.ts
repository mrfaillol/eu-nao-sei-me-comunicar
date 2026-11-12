// Estado da seleção: três opções por janela, até três escolhas livres. Funções puras, que devolvem
// estado novo, para a tela ser sempre um desenho do estado e os testes não precisarem de navegador.
import type { Idioma, Item } from "../frase/tipos";

export type Janela = "pintura" | "som" | "palavra";
export const JANELAS: readonly Janela[] = ["pintura", "som", "palavra"];
const POR_MESA = 3;
const MAXIMO = 3;

export interface EstadoSelecao {
  idioma: Idioma;
  mesas: Record<Janela, string[]>;
  vistos: Record<Janela, string[]>;
  escolhidos: string[];
}

type Sorteio = () => number;

function embaralhar<T>(lista: T[], sorteio: Sorteio): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(sorteio() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

function daJanela(acervo: Item[], janela: Janela, idioma: Idioma): string[] {
  return acervo.filter((i) => i.tipo === janela && (janela !== "palavra" || i.idioma === idioma)).map((i) => i.id);
}

/** Três opções para a janela: primeiro o que ainda não foi visto; esgotado, o ciclo recomeça. */
function distribuir(e: EstadoSelecao, janela: Janela, acervo: Item[], sorteio: Sorteio): EstadoSelecao {
  const disponiveis = daJanela(acervo, janela, e.idioma).filter((id) => !e.escolhidos.includes(id));
  const ineditos = embaralhar(disponiveis.filter((id) => !e.vistos[janela].includes(id)), sorteio);
  let mesa = ineditos.slice(0, POR_MESA);
  let vistos = [...e.vistos[janela], ...mesa];
  if (mesa.length < POR_MESA) {
    const resto = embaralhar(disponiveis.filter((id) => !mesa.includes(id)), sorteio);
    mesa = [...mesa, ...resto.slice(0, POR_MESA - mesa.length)];
    vistos = [...mesa];
  }
  return { ...e, mesas: { ...e.mesas, [janela]: mesa }, vistos: { ...e.vistos, [janela]: vistos } };
}

export function criarEstado(acervo: Item[], idioma: Idioma, sorteio: Sorteio): EstadoSelecao {
  let e: EstadoSelecao = {
    idioma,
    mesas: { pintura: [], som: [], palavra: [] },
    vistos: { pintura: [], som: [], palavra: [] },
    escolhidos: [],
  };
  for (const janela of JANELAS) e = distribuir(e, janela, acervo, sorteio);
  return e;
}

export function redistribuir(e: EstadoSelecao, janela: Janela, acervo: Item[], sorteio: Sorteio): EstadoSelecao {
  return distribuir(e, janela, acervo, sorteio);
}

export function escolher(e: EstadoSelecao, id: string, acervo: Item[], sorteio: Sorteio): EstadoSelecao {
  const item = acervo.find((i) => i.id === id);
  if (!item || e.escolhidos.length >= MAXIMO || e.escolhidos.includes(id)) return e;
  const comEscolha = { ...e, escolhidos: [...e.escolhidos, id] };
  return distribuir(comEscolha, item.tipo, acervo, sorteio);
}

export function retirar(e: EstadoSelecao, id: string): EstadoSelecao {
  if (!e.escolhidos.includes(id)) return e;
  return { ...e, escolhidos: e.escolhidos.filter((x) => x !== id) };
}

export function trocarIdioma(e: EstadoSelecao, idioma: Idioma, acervo: Item[], sorteio: Sorteio): EstadoSelecao {
  // As escolhas ficam: uma palavra já escolhida conserva o rótulo do idioma em que foi escolhida.
  const noNovo = { ...e, idioma, vistos: { ...e.vistos, palavra: [] } };
  return distribuir(noNovo, "palavra", acervo, sorteio);
}

/** Tempo em que um toque na mesma janela é ignorado depois de as opções trocarem. */
export const TRAVA_MS = 350;

/**
 * Escolher troca as três opções no mesmo lugar. Sem esta trava, o segundo clique de um toque duplo cairia
 * no item novo e a pessoa escolheria uma pintura que não viu ou um som que não ouviu.
 */
export function podeEscolher(ultimaTroca: number | undefined, agora: number): boolean {
  return ultimaTroca === undefined || agora - ultimaTroca >= TRAVA_MS;
}

export function completa(e: EstadoSelecao): boolean {
  return e.escolhidos.length === MAXIMO;
}
