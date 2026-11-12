import type { Abertura, Tom } from "../assinatura";

/**
 * Moldes da frase por regra. No tom convergente, `{c1}` é o construto que se repete e `{c2}` o seguinte.
 * Nos tons sensível e divergente, `{lista}` recebe de dois a três termos, um por item escolhido,
 * juntados por `juntar` na pontuação do idioma.
 * Cada molde, preenchido, precisa passar no validador: os testes do compositor conferem todos.
 */
export interface Moldes {
  doisTermos: Record<Tom, Record<Abertura, string[]>>;
  umTermo: string;
  juntar: (termos: string[]) => string;
  semTermo: string;
}
