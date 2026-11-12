// O acervo que a seleção enxerga a cada momento. O núcleo (acervo conferido) tem a mídia no aparelho e
// vale sempre, com ou sem rede. O ampliado chega depois, tem a mídia nos servidores de origem (museu e
// Freesound) e só é oferecido enquanto há rede e a origem responde.
import type { Item } from "../frase/tipos";

export interface AcervoVivo {
  /** O que as janelas podem oferecer agora. */
  disponiveis(): Item[];
  /** Qualquer item conhecido, mesmo fora de oferta: uma escolha já feita continua valendo. */
  item(id: string): Item | undefined;
  ampliar(itens: Item[]): void;
  /** A mídia remota do item não abriu. */
  falhou(id: string): void;
  tamanho(): { nucleo: number; ampliado: number };
}

const FALHAS_QUE_DESLIGAM = 3;

export function criarAcervoVivo(nucleo: Item[], emRede: () => boolean): AcervoVivo {
  const porId = new Map(nucleo.map((i) => [i.id, i]));
  let ampliado: Item[] = [];
  const quebrados = new Set<string>();
  const falhasPorTipo = new Map<Item["tipo"], number>();

  return {
    disponiveis() {
      if (!emRede() || ampliado.length === 0) return nucleo;
      return [...nucleo, ...ampliado.filter((i) => !quebrados.has(i.id) && (falhasPorTipo.get(i.tipo) ?? 0) < FALHAS_QUE_DESLIGAM)];
    },
    item: (id) => porId.get(id),
    ampliar(itens) {
      ampliado = itens.filter((i) => !porId.has(i.id));
      for (const i of ampliado) porId.set(i.id, i);
    },
    falhou(id) {
      const item = ampliado.find((i) => i.id === id);
      if (!item || quebrados.has(id)) return;
      quebrados.add(id);
      falhasPorTipo.set(item.tipo, (falhasPorTipo.get(item.tipo) ?? 0) + 1);
    },
    tamanho: () => ({ nucleo: nucleo.length, ampliado: ampliado.length }),
  };
}
