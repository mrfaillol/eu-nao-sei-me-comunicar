import { describe, expect, it } from "vitest";
import lista from "../../data/construtos.json";
import { indexarGlossario } from "./glossario";
import type { Construto } from "./tipos";

describe("indexarGlossario", () => {
  it("indexa o glossário real por id, sem perder entrada", () => {
    const glossario = indexarGlossario(lista as Construto[]);
    expect(Object.keys(glossario)).toHaveLength(lista.length);
    expect(glossario.nostalgia?.termo["zh-CN"]).toBe("怀旧");
    expect(glossario.valencia_negativa?.dimensao).toBe(true);
  });

  it("recusa id repetido", () => {
    const repetido = [lista[0], lista[0]] as Construto[];
    expect(() => indexarGlossario(repetido)).toThrow(/repetido/);
  });
});
