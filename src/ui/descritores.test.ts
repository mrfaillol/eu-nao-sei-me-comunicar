import { describe, expect, it } from "vitest";
import type { Item } from "../frase/tipos";
import { descritores } from "./descritores";

function item(parcial: Partial<Item>): Item {
  return { id: "x", tipo: "pintura", classe_semiotica: "icone", idioma: null, rotulo: "r", texto_humano: "", origem_do_texto: "curadoria", construtos: [], tema_sensivel: false, afeto: { metodo: "ausente" }, credito: { autor: "", linha: "l", fonte: "cma", licenca: "CC0-1.0", url: "https://exemplo.test" }, revisao: { humana: "pendente", por: null, em: null }, midia: null, ...parcial };
}

describe("descritores", () => {
  it("de um som, devolve as tags que o autor escreveu, sem repetir", () => {
    const som = item({ tipo: "som", origem_do_texto: "titulo_e_tags", texto_humano: "Rain, Moderate, C | rain, raindrops, Weather, rain, moderate" });
    expect(descritores(som)).toEqual(["rain", "raindrops", "Weather", "moderate"]);
  });

  it("de um som sem tags, usa as palavras do título", () => {
    const som = item({ tipo: "som", origem_do_texto: "titulo_e_tags", texto_humano: "Door Creaks: You're Not Alone" });
    expect(descritores(som)).toEqual(["door", "creaks", "alone"]);
  });

  it("de uma pintura, tira as palavras de conteúdo do texto da curadoria, na ordem em que aparecem", () => {
    const pintura = item({ texto_humano: "A woman sits alone by a window, her hands folded, in grey northern light. The window faces Venice." });
    expect(descritores(pintura)).toEqual(["woman", "sits", "alone", "window", "hands", "folded", "grey", "northern", "light", "faces", "Venice"]);
  });

  it("toda palavra devolvida está escrita no texto humano do item", () => {
    const texto = "Turner witnessed the burning of the Houses of Parliament from a boat on the Thames; crowds gathered, awed by the fire's terrible beauty.";
    const pintura = item({ texto_humano: texto });
    const palavras = descritores(pintura);
    expect(palavras.length).toBeGreaterThan(5);
    for (const p of palavras) expect(texto.toLowerCase()).toContain(p.toLowerCase());
  });

  it("nome próprio no começo da frase conserva a maiúscula", () => {
    const pintura = item({ rotulo: "Portrait of Dora Wheeler", credito: { autor: "William Merritt Chase", linha: "l", fonte: "cma", licenca: "CC0-1.0", url: "https://exemplo.test" }, texto_humano: "Dora Wheeler posed in a blue dress. Chase admired her calm gaze. Silk tapestry glows behind her." });
    expect(descritores(pintura)).toEqual(["Dora", "Wheeler", "posed", "blue", "dress", "Chase", "admired", "calm", "gaze", "silk", "tapestry", "glows", "behind"]);
  });

  it("palavras de narração genérica saem: ficam as que descrevem", () => {
    const pintura = item({ texto_humano: "This painting became the first work the artist made after three years; it shows a stormy harbor at dusk." });
    expect(descritores(pintura)).toEqual(["stormy", "harbor", "dusk"]);
  });

  it("texto longo é amostrado por inteiro, e não só pelo começo", () => {
    const palavras = Array.from({ length: 60 }, (_, n) => `termo${String.fromCharCode(97 + (n % 26))}${String.fromCharCode(97 + Math.floor(n / 26))}`);
    const saida = descritores(item({ texto_humano: palavras.join(" ") }));
    expect(saida[0]).toBe(palavras[0]);
    expect(saida.at(-1)).toBe(palavras.at(-1));
  });

  it("não passa de dezesseis palavras", () => {
    const longo = Array.from({ length: 60 }, (_, n) => `palavra${String.fromCharCode(97 + (n % 26))}${String.fromCharCode(97 + Math.floor(n / 26))}`).join(" ");
    expect(descritores(item({ texto_humano: longo }))).toHaveLength(16);
  });

  it("de uma palavra não devolve nada: o que se mostra é a definição inteira", () => {
    expect(descritores(item({ tipo: "palavra", origem_do_texto: "glosa", texto_humano: "Sentimento de falta." }))).toEqual([]);
  });
});
