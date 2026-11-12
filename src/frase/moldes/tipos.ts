import type { Abertura, Tom } from "../assinatura";

/**
 * Moldes da frase por regra. `{n}` é a quantidade de itens reunidos, por extenso.
 * No tom convergente, `{c1}` é o construto que mais se repete e `{c2}` o que fica ao fundo: um termo
 * com três itens, até três com seleções maiores, juntados por `juntar`.
 * Nos tons sensível e divergente, `{lista}` recebe de dois a quatro termos, um por item escolhido.
 * `{todos}` só existe em mandarim: "三者" com três itens, "它们" com mais.
 * Cada molde, preenchido, precisa passar no validador: os testes do compositor conferem todos.
 */
export interface Moldes {
  doisTermos: Record<Tom, Record<Abertura, string[]>>;
  umTermo: string;
  juntar: (termos: string[]) => string;
  semTermo: string;
}
