import { describe, expect, it } from "vitest";
import { alvo } from "./zoom";

describe("alvo do zoom", () => {
  it("bate com a conta medida na pesquisa", () => {
    const a = alvo({ x: 0.4389, y: 0.1838, w: 0.1272, h: 0.1477 });
    expect(a.s).toBeCloseTo(3.931, 2);
    expect(a.tx).toBeCloseTo(-1.4752, 2);
    expect(a.ty).toBeCloseTo(-0.5128, 2);
  });

  it("rosto que já ocupa mais da metade da largura não amplia", () => {
    expect(alvo({ x: 0.2, y: 0.2, w: 0.58, h: 0.5 }).s).toBe(1);
  });

  it("a pintura sempre cobre a moldura", () => {
    for (let n = 0; n < 20; n++) {
      const w = 0.03 + (n % 7) * 0.05;
      const caixa = { x: (n * 0.047) % (1 - w), y: (n * 0.031) % (1 - w), w, h: w * 1.2 };
      const { s, tx, ty } = alvo(caixa);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(8);
      expect(tx).toBeLessThanOrEqual(0);
      expect(tx).toBeGreaterThanOrEqual(1 - s - 1e-9);
      expect(ty).toBeLessThanOrEqual(0);
      expect(ty).toBeGreaterThanOrEqual(1 - s - 1e-9);
    }
  });
});
