import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { indexarGlossario } from "./glossario";
import { comporSimples } from "./simples";
import type { Construto, Item, Tipo } from "./tipos";
import { IDIOMAS } from "./tipos";
import { validarFrase } from "./validador";

const lista = JSON.parse(readFileSync("data/construtos.json", "utf-8")) as Construto[];
const glossario = indexarGlossario(lista);

function item(n: number, tipo: Tipo, construtos: string[], sensivel = false): Item {
  return { id: `${tipo}:t:${n}`, tipo, classe_semiotica: tipo === "pintura" ? "icone" : tipo === "som" ? "indice" : "simbolo", idioma: tipo === "palavra" ? "pt-BR" : null, rotulo: `item ${n}`, texto_humano: "t", origem_do_texto: tipo === "pintura" ? "curadoria" : tipo === "som" ? "titulo_e_tags" : "glosa", construtos, tema_sensivel: sensivel, afeto: { metodo: "ausente" }, credito: { autor: "", linha: "l", fonte: "cma", licenca: "CC0-1.0", url: "https://exemplo.test" }, revisao: { humana: "pendente", por: null, em: null }, midia: null };
}

describe("glossário: a explicação simples de cada construto", () => {
  it("todo construto que a frase pode nomear tem explicação simples nos três idiomas", () => {
    for (const c of lista.filter((x) => !x.dimensao)) {
      for (const idioma of IDIOMAS) expect(c.simples?.[idioma]?.trim(), `${c.id} em ${idioma}`).toBeTruthy();
    }
  });

  it("a explicação simples é curta e não fala da pessoa", () => {
    for (const c of lista.filter((x) => !x.dimensao)) {
      expect(c.simples!["pt-BR"].length, c.id).toBeLessThanOrEqual(64);
      expect(c.simples!.en.length, c.id).toBeLessThanOrEqual(64);
      expect(c.simples!["zh-CN"].length, c.id).toBeLessThanOrEqual(24);
      expect(`${c.simples!["pt-BR"]} ${c.simples!.en}`, c.id).not.toMatch(/\b(você|voce|tu|teu|sua|seu|you|your)\b/i);
      expect(c.simples!["zh-CN"], c.id).not.toMatch(/[你您]/);
    }
  });
});

describe("comporSimples", () => {
  const convergente = [item(1, "pintura", ["apego_ao_lugar", "apego"]), item(2, "som", ["apego_ao_lugar"]), item(3, "palavra", ["constrangimento"])];

  it("diz em palavras do dia a dia o que a frase técnica diz, na ordem dela", () => {
    const texto = comporSimples(["apego_ao_lugar", "apego", "constrangimento"], convergente, "pt-BR", glossario);
    expect(texto).toBe("O que você escolheu volta mais de uma vez a um mesmo assunto: ligação forte com um lugar. Junto com isso: ligação forte com alguém e vergonha diante dos outros.");
  });

  it("não usa o termo técnico quando há explicação simples", () => {
    const texto = comporSimples(["dissonancia_cognitiva", "interocepcao"], [item(1, "pintura", ["dissonancia_cognitiva"]), item(2, "som", ["interocepcao"]), item(3, "palavra", ["fluxo"])], "pt-BR", glossario);
    expect(texto).not.toMatch(/dissonância|interocepção/);
    expect(texto).toContain("coisas diferentes");
  });

  it("um termo só, tema grave e nenhum termo têm cada um a sua forma", () => {
    expect(comporSimples(["medo"], [item(1, "pintura", ["medo"]), item(2, "som", ["medo"]), item(3, "palavra", ["medo"])], "pt-BR", glossario)).toBe("Tudo o que você escolheu aponta para um assunto só: medo.");
    const grave = [item(1, "pintura", ["luto"], true), item(2, "pintura", ["medo"], true), item(3, "palavra", ["esperanca"])];
    expect(comporSimples(["luto", "medo", "esperanca"], grave, "pt-BR", glossario)).toContain("assuntos pesados");
    expect(comporSimples([], [item(1, "pintura", []), item(2, "som", []), item(3, "palavra", [])], "pt-BR", glossario)).toContain("ainda não tem um nome simples");
  });

  it("sai nos três idiomas, sempre falando da escolha", () => {
    expect(comporSimples(["apego_ao_lugar", "apego"], convergente, "en", glossario)).toMatch(/^What you chose keeps coming back to one thing: a strong bond with a place\. Alongside it: a strong bond with someone\.$/);
    expect(comporSimples(["apego_ao_lugar", "apego"], convergente, "zh-CN", glossario)).toMatch(/^你选的东西一再回到同一件事：.+。同时出现的还有：.+。$/);
  });

  it("construto sem explicação simples cai no próprio termo, sem quebrar", () => {
    const semSimples = { ...glossario, medo: { ...glossario.medo!, simples: undefined } };
    expect(comporSimples(["medo"], [item(1, "pintura", ["medo"]), item(2, "som", ["medo"]), item(3, "palavra", ["medo"])], "pt-BR", semSimples)).toContain("medo");
  });

  it("nenhuma versão simples atribui estado à pessoa nem aconselha (regras V6 e V7 do validador)", () => {
    const ids = lista.filter((c) => !c.dimensao).map((c) => c.id);
    const reprovadas: string[] = [];
    for (const idioma of IDIOMAS) {
      for (let n = 0; n < ids.length; n++) {
        const tres = [ids[n]!, ids[(n + 7) % ids.length]!, ids[(n + 13) % ids.length]!];
        for (const itens of [
          [item(1, "pintura", [tres[0]!, tres[1]!]), item(2, "som", [tres[0]!]), item(3, "palavra", [tres[2]!])],
          [item(1, "pintura", [tres[0]!]), item(2, "som", [tres[1]!]), item(3, "palavra", [tres[2]!])],
          [item(1, "pintura", [tres[0]!], true), item(2, "som", [tres[1]!], true), item(3, "palavra", [tres[2]!])],
        ]) {
          const texto = comporSimples(tres, itens, idioma, glossario);
          const { codigos } = validarFrase(texto, tres, itens, idioma, glossario);
          if (codigos.includes("V6") || codigos.includes("V7")) reprovadas.push(`${idioma} ${codigos.join(",")}: ${texto}`);
        }
      }
    }
    expect(reprovadas.slice(0, 5)).toEqual([]);
  });
});
