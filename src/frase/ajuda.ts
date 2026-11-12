import type { Item } from "./tipos";

const MINIMO_DE_ITENS_SENSIVEIS = 2;

/**
 * O link de ajuda existe em todas as telas; esta regra só decide o destaque dele.
 * É decisão fixa do app, tomada sobre a anotação humana dos itens. O modelo nunca participa.
 */
export function ajudaDestacada(itens: Item[]): boolean {
  return itens.filter((i) => i.tema_sensivel).length >= MINIMO_DE_ITENS_SENSIVEIS;
}
