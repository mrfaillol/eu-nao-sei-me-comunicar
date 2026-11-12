import { describe, expect, it } from "vitest";
import type { Item, Tipo } from "../frase/tipos";
import { completa, criarEstado, escolher, redistribuir, retirar, trocarIdioma } from "./selecao";

function item(tipo: Tipo, n: number, idioma: Item["idioma"] = null): Item {
  return {
    id: `${tipo}:${idioma ?? "x"}:${n}`, tipo, classe_semiotica: "icone", idioma, rotulo: `${tipo} ${n}`, texto_humano: "t",
    origem_do_texto: "glosa", construtos: ["apego"], tema_sensivel: false, afeto: { metodo: "ausente" },
    credito: { autor: "", linha: "l", fonte: "cma", licenca: "CC0-1.0", url: "https://x.test" },
    revisao: { humana: "pendente", por: null, em: null }, midia: null,
  };
}

function acervo(porJanela = 9): Item[] {
  const itens: Item[] = [];
  for (let n = 0; n < porJanela; n++) {
    itens.push(item("pintura", n), item("som", n), item("palavra", n, "pt-BR"), item("palavra", n, "en"));
  }
  return itens;
}

/** Sorteio determinístico para os testes. */
function sorteio(semente = 1): () => number {
  let s = semente;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

describe("seleção", () => {
  const a = acervo();

  it("começa com três opções distintas por janela, e palavras só do idioma", () => {
    const e = criarEstado(a, "pt-BR", sorteio());
    for (const janela of ["pintura", "som", "palavra"] as const) {
      expect(e.mesas[janela]).toHaveLength(3);
      expect(new Set(e.mesas[janela]).size).toBe(3);
    }
    expect(e.mesas.palavra.every((id) => id.startsWith("palavra:pt-BR:"))).toBe(true);
    expect(e.escolhidos).toEqual([]);
  });

  it("escolher acrescenta o item e troca as três opções daquela janela por outras ainda não vistas", () => {
    const e0 = criarEstado(a, "pt-BR", sorteio());
    const alvo = e0.mesas.pintura[0]!;
    const e1 = escolher(e0, alvo, a, sorteio(2));
    expect(e1.escolhidos).toEqual([alvo]);
    expect(e1.mesas.pintura).toHaveLength(3);
    expect(e1.mesas.pintura.some((id) => e0.mesas.pintura.includes(id))).toBe(false);
    expect(e1.mesas.som).toEqual(e0.mesas.som);
    expect(e0.escolhidos).toEqual([]); // função pura: o estado anterior não muda
  });

  it("a quarta escolha não entra, e escolher o mesmo item duas vezes também não", () => {
    let e = criarEstado(a, "pt-BR", sorteio());
    e = escolher(e, e.mesas.pintura[0]!, a, sorteio(2));
    expect(escolher(e, e.escolhidos[0]!, a, sorteio(3))).toBe(e);
    e = escolher(e, e.mesas.som[0]!, a, sorteio(3));
    e = escolher(e, e.mesas.palavra[0]!, a, sorteio(4));
    expect(completa(e)).toBe(true);
    expect(escolher(e, e.mesas.pintura[0]!, a, sorteio(5))).toBe(e);
    expect(e.escolhidos).toHaveLength(3);
  });

  it("item escolhido nunca fica na mesa", () => {
    let e = criarEstado(a, "pt-BR", sorteio());
    for (let n = 0; n < 3; n++) e = escolher(e, e.mesas.pintura[0]!, a, sorteio(n + 2));
    expect(e.mesas.pintura.some((id) => e.escolhidos.includes(id))).toBe(false);
  });

  it("retirar tira o item e a seleção deixa de estar completa", () => {
    let e = criarEstado(a, "pt-BR", sorteio());
    for (const janela of ["pintura", "som", "palavra"] as const) e = escolher(e, e.mesas[janela][0]!, a, sorteio(7));
    const e2 = retirar(e, e.escolhidos[1]!);
    expect(e2.escolhidos).toHaveLength(2);
    expect(completa(e2)).toBe(false);
    expect(retirar(e2, "nao-existe")).toBe(e2);
  });

  it("janela esgotada recomeça o ciclo sem repetir o escolhido e sem travar", () => {
    const pequeno = [item("pintura", 0), item("pintura", 1), item("pintura", 2), item("pintura", 3), item("som", 0), item("palavra", 0, "pt-BR")];
    let e = criarEstado(pequeno, "pt-BR", sorteio());
    expect(e.mesas.som).toHaveLength(1); // menos de três no acervo: mostra o que há
    e = escolher(e, e.mesas.pintura[0]!, pequeno, sorteio(2));
    const escolhido = e.escolhidos[0]!;
    expect(e.mesas.pintura).toHaveLength(3);
    for (let n = 0; n < 6; n++) {
      e = redistribuir(e, "pintura", pequeno, sorteio(n + 3));
      expect(e.mesas.pintura).toHaveLength(3);
      expect(e.mesas.pintura).not.toContain(escolhido);
    }
  });

  it("redistribuir mostra tudo antes de repetir", () => {
    let e = criarEstado(a, "pt-BR", sorteio());
    const vistas = new Set(e.mesas.som);
    for (let n = 0; n < 2; n++) {
      e = redistribuir(e, "som", a, sorteio(n + 5));
      for (const id of e.mesas.som) {
        expect(vistas.has(id)).toBe(false);
        vistas.add(id);
      }
    }
    expect(vistas.size).toBe(9);
  });

  it("trocar de idioma mantém as escolhas e redistribui as palavras no idioma novo", () => {
    let e = criarEstado(a, "pt-BR", sorteio());
    const palavra = e.mesas.palavra[0]!;
    e = escolher(e, palavra, a, sorteio(2));
    const e2 = trocarIdioma(e, "en", a, sorteio(3));
    expect(e2.idioma).toBe("en");
    expect(e2.escolhidos).toEqual([palavra]); // a palavra em português continua escolhida
    expect(e2.mesas.palavra.every((id) => id.startsWith("palavra:en:"))).toBe(true);
    expect(e2.mesas.pintura).toEqual(e.mesas.pintura);
  });
});
