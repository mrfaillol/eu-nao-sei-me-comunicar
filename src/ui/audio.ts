// Um som por vez. `tocar` só deve ser chamado de dentro de um toque ou clique: no iPhone o áudio
// só começa em resposta a um gesto da pessoa.
export interface Tocador {
  tocar(id: string, url: string): Promise<void>;
  parar(): void;
  tocando(): string | null;
  aoMudar(observador: (id: string | null) => void): void;
}

export function criarTocador(novoAudio: () => HTMLAudioElement = () => new Audio()): Tocador {
  let atual: { id: string; audio: HTMLAudioElement } | null = null;
  const observadores: Array<(id: string | null) => void> = [];
  const avisar = () => observadores.forEach((o) => o(atual?.id ?? null));

  function parar(): void {
    if (!atual) return;
    atual.audio.pause();
    atual = null;
    avisar();
  }

  return {
    async tocar(id, url) {
      if (atual?.id === id) return parar();
      atual?.audio.pause();
      const audio = novoAudio();
      audio.src = url;
      audio.onended = () => {
        if (atual?.audio === audio) {
          atual = null;
          avisar();
        }
      };
      atual = { id, audio };
      avisar();
      try {
        await audio.play();
      } catch {
        // O navegador recusou tocar (sem gesto, arquivo ausente): volta ao silêncio em vez de fingir que toca.
        if (atual?.audio === audio) {
          atual = null;
          avisar();
        }
      }
    },
    parar,
    tocando: () => atual?.id ?? null,
    aoMudar: (o) => void observadores.push(o),
  };
}
