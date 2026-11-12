import { describe, expect, it } from "vitest";
import { criarTocador } from "./audio";

class AudioFalso {
  src = "";
  pausado = true;
  tocou = 0;
  onended: (() => void) | null = null;
  play() { this.pausado = false; this.tocou++; return Promise.resolve(); }
  pause() { this.pausado = true; }
}

function tocador() {
  const criados: AudioFalso[] = [];
  const t = criarTocador(() => { const a = new AudioFalso(); criados.push(a); return a as unknown as HTMLAudioElement; });
  return { t, criados };
}

describe("tocador", () => {
  it("tocar um som pausa o anterior", async () => {
    const { t, criados } = tocador();
    await t.tocar("a", "a.mp3");
    await t.tocar("b", "b.mp3");
    expect(criados[0]!.pausado).toBe(true);
    expect(criados[1]!.pausado).toBe(false);
    expect(t.tocando()).toBe("b");
  });

  it("tocar o mesmo som de novo pausa", async () => {
    const { t, criados } = tocador();
    await t.tocar("a", "a.mp3");
    await t.tocar("a", "a.mp3");
    expect(criados[0]!.pausado).toBe(true);
    expect(t.tocando()).toBeNull();
  });

  it("parar silencia tudo", async () => {
    const { t, criados } = tocador();
    await t.tocar("a", "a.mp3");
    t.parar();
    expect(criados.every((a) => a.pausado)).toBe(true);
    expect(t.tocando()).toBeNull();
  });

  it("avisa quem observa quando o som começa, pausa e termina sozinho", async () => {
    const { t, criados } = tocador();
    const vistos: Array<string | null> = [];
    t.aoMudar((id) => vistos.push(id));
    await t.tocar("a", "a.mp3");
    criados[0]!.onended?.();
    expect(vistos).toEqual(["a", null]);
    expect(t.tocando()).toBeNull();
  });
});
