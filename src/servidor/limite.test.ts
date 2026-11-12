import { describe, expect, it } from "vitest";
import { criarLimite } from "./limite";

describe("limite de chamadas ao modelo", () => {
  it("deixa passar até o teto por minuto de cada visitante e recusa o resto", () => {
    let agora = 0;
    const limite = criarLimite({ porVisitantePorMinuto: 3, totalPorHora: 100, agora: () => agora });
    expect([1, 2, 3, 4].map(() => limite.permitir("a"))).toEqual([true, true, true, false]);
    expect(limite.permitir("b")).toBe(true); // outro visitante tem a sua própria conta
    agora += 61_000;
    expect(limite.permitir("a")).toBe(true); // a janela de um minuto andou
  });

  it("tem um teto total por hora, que protege o gasto mesmo com muitos visitantes", () => {
    let agora = 0;
    const limite = criarLimite({ porVisitantePorMinuto: 10, totalPorHora: 5, agora: () => agora });
    const passaram = Array.from({ length: 8 }, (_, n) => limite.permitir(`v${n}`)).filter(Boolean).length;
    expect(passaram).toBe(5);
    agora += 3_600_001;
    expect(limite.permitir("novo")).toBe(true);
  });

  it("não guarda visitante para sempre: a memória não cresce sem fim", () => {
    let agora = 0;
    const limite = criarLimite({ porVisitantePorMinuto: 2, totalPorHora: 1_000_000, agora: () => agora });
    for (let n = 0; n < 500; n++) limite.permitir(`v${n}`);
    agora += 120_000;
    limite.permitir("depois");
    expect(limite.visitantesGuardados()).toBeLessThanOrEqual(1);
  });
});

describe("pausa do modelo", () => {
  it("depois de acionada, segura o modelo pelo tempo dado e depois solta sozinha", async () => {
    const { criarPausa } = await import("./limite");
    let agora = 1000;
    const pausa = criarPausa({ ms: 600_000, agora: () => agora });
    expect(pausa.ativa()).toBe(false);
    pausa.acionar();
    expect(pausa.ativa()).toBe(true);
    agora += 599_000;
    expect(pausa.ativa()).toBe(true);
    agora += 2_000;
    expect(pausa.ativa()).toBe(false);
  });
});
