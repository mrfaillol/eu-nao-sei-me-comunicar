// Limite de chamadas ao modelo. O endereço da função é público e cada chamada custa; este limite roda
// dentro da função, guardado na memória da instância. Não é barreira perfeita (cada instância conta a sua),
// mas segura o caso comum: um visitante ou um robô pedindo frase sem parar. Quem passa do limite continua
// recebendo a frase, só que composta por regra.
export interface Limite {
  permitir(visitante: string): boolean;
  visitantesGuardados(): number;
}

export interface OpcoesDoLimite {
  porVisitantePorMinuto: number;
  totalPorHora: number;
  agora?: () => number;
}

export interface Pausa {
  acionar(): void;
  ativa(): boolean;
}

/**
 * Pausa do modelo. Quando a conta recusa a credencial, insistir a cada pedido só soma atraso e enche o
 * registro: a função pausa o modelo por um tempo, responde pela regra e tenta de novo depois.
 */
export function criarPausa(opcoes: { ms: number; agora?: () => number }): Pausa {
  const agora = opcoes.agora ?? Date.now;
  let ate = 0;
  return { acionar: () => void (ate = agora() + opcoes.ms), ativa: () => agora() < ate };
}

const MINUTO = 60_000;
const HORA = 3_600_000;

export function criarLimite(opcoes: OpcoesDoLimite): Limite {
  const agora = opcoes.agora ?? Date.now;
  const porVisitante = new Map<string, number[]>();
  let daHora: number[] = [];

  return {
    permitir(visitante) {
      const t = agora();
      daHora = daHora.filter((x) => t - x < HORA);
      // Quem não pede há mais de um minuto sai da memória.
      for (const [chave, vezes] of porVisitante) {
        const vivas = vezes.filter((x) => t - x < MINUTO);
        if (vivas.length === 0) porVisitante.delete(chave);
        else porVisitante.set(chave, vivas);
      }
      const minhas = porVisitante.get(visitante) ?? [];
      if (minhas.length >= opcoes.porVisitantePorMinuto || daHora.length >= opcoes.totalPorHora) return false;
      porVisitante.set(visitante, [...minhas, t]);
      daHora.push(t);
      return true;
    },
    visitantesGuardados: () => porVisitante.size,
  };
}
