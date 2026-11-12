import { describe, expect, it } from "vitest";
import { caso, glossarioDosCasos, semAfeto, sensivel } from "../../tests/fixtures/adaptar";
import { ajudaDestacada } from "./ajuda";
import { termosPermitidos } from "./termos";

const glossario = glossarioDosCasos();

describe("termosPermitidos", () => {
  it("une os construtos dos três itens e acrescenta os termos de dimensão que as normas sustentam", () => {
    const { itens } = caso("caso-1");
    const ids = termosPermitidos(itens, "pt-BR", glossario).map((t) => t.id);
    expect(ids).toEqual(["apego", "nostalgia", "pertencimento", "baixa_ativacao", "valencia_negativa"]);
  });

  it("não cria termo de dimensão quando menos de dois itens têm norma direta", () => {
    const { itens } = caso("caso-1");
    const selecao = [semAfeto(itens[0]!), semAfeto(itens[1]!), itens[2]!];
    const ids = termosPermitidos(selecao, "pt-BR", glossario).map((t) => t.id);
    expect(ids).toEqual(["apego", "nostalgia", "pertencimento"]);
  });

  it("devolve o termo no idioma de saída", () => {
    const { itens } = caso("caso-1");
    const termos = termosPermitidos(itens, "zh-CN", glossario);
    expect(termos.find((t) => t.id === "nostalgia")?.termo).toBe("怀旧");
  });

  it("registra quais itens escolhidos carregam cada construto", () => {
    const { itens } = caso("caso-1");
    const nostalgia = termosPermitidos(itens, "pt-BR", glossario).find((t) => t.id === "nostalgia");
    expect(nostalgia?.itens).toEqual([itens[0]!.id, itens[1]!.id]);
  });

  it("ordena por frequência antes de ordenar por id", () => {
    const { itens } = caso("caso-3"); // alienação aparece em dois itens, exaustão em dois, habituação e tédio em um
    const ids = termosPermitidos(itens.map(semAfeto), "pt-BR", glossario).map((t) => t.id);
    expect(ids).toEqual(["alienacao", "exaustao", "habituacao", "tedio"]);
  });
});

describe("ajudaDestacada", () => {
  it("fica apagada com um único item de tema sensível", () => {
    const { itens } = caso("caso-5");
    expect(ajudaDestacada([sensivel(itens[0]!), itens[1]!, itens[2]!])).toBe(false);
  });

  it("acende com dois itens de tema sensível", () => {
    const { itens } = caso("caso-5");
    expect(ajudaDestacada([sensivel(itens[0]!), sensivel(itens[1]!), itens[2]!])).toBe(true);
  });
});
