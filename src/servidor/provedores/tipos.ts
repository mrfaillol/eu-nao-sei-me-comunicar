/**
 * Um provedor de modelo. A função "interpretar" só conhece esta interface, então trocar de
 * provedor é escrever um arquivo novo aqui, sem tocar no fluxo de validação.
 */
export type TipoDeFalha = "recusa" | "limite" | "autenticacao" | "pedido" | "conexao" | "api";

/** Falha classificada de um provedor. O tipo é o que se registra; a mensagem pode trazer detalhe do provedor e não sai daqui. */
export class FalhaDoProvedor extends Error {
  constructor(
    readonly tipo: TipoDeFalha,
    mensagem: string,
    opcoes?: ErrorOptions,
  ) {
    super(mensagem, opcoes);
    this.name = "FalhaDoProvedor";
  }
}

export interface Provedor {
  nome: string;
  /**
   * Devolve o texto cru da resposta. `tentativa` é 1 ou 2; o provedor pode usá-la para
   * ajustar o que o modelo dele permitir. Deve respeitar `sinal` e lançar erro em falha.
   */
  gerar(sistema: string, usuario: string, tentativa: 1 | 2, sinal: AbortSignal): Promise<string>;
}
