import { describe, expect, it } from "vitest";
import { glossarioDosCasos, itemDoCaso } from "../../tests/fixtures/adaptar";
import { assinatura, type Abertura, type Tom } from "./assinatura";
import { comporFrase } from "./compositor";
import { termosPermitidos } from "./termos";
import type { Item, Tipo } from "./tipos";
import { IDIOMAS } from "./tipos";
import { validarFrase } from "./validador";

const glossario = glossarioDosCasos();

function item(n: number, tipo: Tipo, construtos: string[], sensivel = false): Item {
  const classe = tipo === "pintura" ? "icone" : tipo === "som" ? "indice" : "simbolo";
  return itemDoCaso({
    id: `${tipo}:teste:${n}`,
    tipo,
    rotulo: tipo === "palavra" ? ["saudade", "banzo", "ennui"][n % 3]! : `item ${n}`,
    texto_humano: "texto de teste",
    classe_semiotica: classe,
    valencia: null,
    ativacao: null,
    construtos,
    tema_sensivel: sensivel,
  });
}

const TIPOS: Record<Abertura, [Tipo, Tipo, Tipo]> = {
  pinturas: ["pintura", "pintura", "pintura"],
  sons: ["som", "som", "som"],
  palavras: ["palavra", "palavra", "palavra"],
  mista: ["pintura", "som", "palavra"],
};

function selecao(tom: Tom, abertura: Abertura): Item[] {
  const [a, b, c] = TIPOS[abertura];
  if (tom === "sensivel") return [item(1, a, ["luto", "solidao"], true), item(2, b, ["luto"], true), item(3, c, ["nostalgia"])];
  if (tom === "convergente") return [item(1, a, ["nostalgia", "apego"]), item(2, b, ["nostalgia"]), item(3, c, ["pertencimento"])];
  return [item(1, a, ["nostalgia"]), item(2, b, ["tedio"]), item(3, c, ["vigilancia"])];
}

describe("assinatura", () => {
  it("lê o tom e a abertura da seleção", () => {
    expect(assinatura(selecao("sensivel", "sons"))).toEqual({ tom: "sensivel", abertura: "sons" });
    expect(assinatura(selecao("convergente", "mista"))).toEqual({ tom: "convergente", abertura: "mista" });
    expect(assinatura(selecao("divergente", "palavras"))).toEqual({ tom: "divergente", abertura: "palavras" });
  });

  it("um item sensível entre dois não sensíveis não dá tom sensível", () => {
    const itens = [item(1, "pintura", ["luto"], true), item(2, "som", ["nostalgia"]), item(3, "palavra", ["apego"])];
    expect(assinatura(itens).tom).not.toBe("sensivel");
  });
});

describe("comporFrase gera frase que o validador aceita", () => {
  for (const tom of ["sensivel", "convergente", "divergente"] as Tom[]) {
    for (const abertura of ["pinturas", "sons", "palavras", "mista"] as Abertura[]) {
      for (const idioma of IDIOMAS) {
        it(`${tom} × ${abertura} × ${idioma}`, () => {
          const itens = selecao(tom, abertura);
          const { frase, construtos_usados } = comporFrase(itens, idioma, glossario);
          expect(validarFrase(frase, construtos_usados, itens, idioma, glossario).codigos, frase).toEqual([]);
        });
      }
    }
  }

  it("aguenta os termos mais longos do glossário sem estourar o tamanho", () => {
    const itens = [item(1, "som", ["restauracao_atencao", "sobrecarga_sensorial"]), item(2, "som", ["restauracao_atencao"]), item(3, "som", ["isolamento_social"])];
    for (const idioma of IDIOMAS) {
      const { frase, construtos_usados } = comporFrase(itens, idioma, glossario);
      expect(validarFrase(frase, construtos_usados, itens, idioma, glossario).codigos, frase).toEqual([]);
    }
  });
});

describe("comporFrase nas bordas", () => {
  it("com um único termo permitido usa o molde de um termo e não lança erro", () => {
    const itens = [item(1, "som", ["solidao"]), item(2, "som", ["solidao"]), item(3, "som", ["solidao"])];
    for (const idioma of IDIOMAS) {
      const { frase, construtos_usados } = comporFrase(itens, idioma, glossario);
      expect(construtos_usados).toEqual(["solidao"]);
      expect(frase).toContain(glossario.solidao!.termo[idioma]);
    }
  });

  it("sem nenhum construto usa o molde sem lacuna e não lança erro", () => {
    const itens = [item(1, "som", []), item(2, "pintura", []), item(3, "palavra", [])];
    for (const idioma of IDIOMAS) {
      const { frase, construtos_usados } = comporFrase(itens, idioma, glossario);
      expect(construtos_usados).toEqual([]);
      expect(frase).not.toContain("{");
    }
  });

  it("item sem construto ao lado de itens anotados não lança erro", () => {
    const itens = [item(1, "som", []), item(2, "pintura", ["nostalgia"]), item(3, "palavra", ["apego"])];
    expect(() => comporFrase(itens, "pt-BR", glossario)).not.toThrow();
  });

  it("a ordem das escolhas não muda a frase", () => {
    const [a, b, c] = selecao("convergente", "mista") as [Item, Item, Item];
    const frase = comporFrase([a, b, c], "pt-BR", glossario).frase;
    expect(comporFrase([c, a, b], "pt-BR", glossario).frase).toBe(frase);
    expect(comporFrase([b, c, a], "pt-BR", glossario).frase).toBe(frase);
  });

  it("no tom convergente, o construto repetido é o primeiro termo da frase", () => {
    const itens = selecao("convergente", "pinturas");
    const { frase, construtos_usados } = comporFrase(itens, "pt-BR", glossario);
    expect(construtos_usados[0]).toBe("nostalgia");
    expect(frase.indexOf("nostalgia")).toBeLessThan(frase.indexOf(glossario[construtos_usados[1]!]!.termo["pt-BR"]));
  });

  it("no tom divergente com três construtos distintos, a frase nomeia os três, um por item", () => {
    const itens = [item(1, "pintura", ["nostalgia"]), item(2, "som", ["tedio"]), item(3, "palavra", ["vigilancia"])];
    for (const idioma of IDIOMAS) {
      const { frase, construtos_usados } = comporFrase(itens, idioma, glossario);
      expect([...construtos_usados].sort()).toEqual(["nostalgia", "tedio", "vigilancia"]);
      for (const id of construtos_usados) expect(frase).toContain(glossario[id]!.termo[idioma]);
      expect(validarFrase(frase, construtos_usados, itens, idioma, glossario).codigos, frase).toEqual([]);
    }
  });

  it("no tom sensível, a frase nomeia até três construtos", () => {
    const itens = [item(1, "pintura", ["luto"], true), item(2, "pintura", ["solidao"], true), item(3, "palavra", ["nostalgia"])];
    const { construtos_usados } = comporFrase(itens, "pt-BR", glossario);
    expect([...construtos_usados].sort()).toEqual(["luto", "nostalgia", "solidao"]);
  });

  it("no tom divergente, os dois termos vêm de itens diferentes", () => {
    const itens = [item(1, "pintura", ["nostalgia", "apego"]), item(2, "som", ["tedio"]), item(3, "palavra", ["vigilancia"])];
    const { construtos_usados } = comporFrase(itens, "pt-BR", glossario);
    const portadores = construtos_usados.map((id) => itens.filter((i) => i.construtos.includes(id)).map((i) => i.id));
    expect(portadores[0]).not.toEqual(portadores[1]);
  });
});

describe("contra o efeito Forer", () => {
  it("seleções sem construto em comum dão frases diferentes, e o termo de uma não aparece na frase da outra", () => {
    const a = [item(1, "pintura", ["nostalgia"]), item(2, "pintura", ["apego"]), item(3, "pintura", ["pertencimento"])];
    const b = [item(4, "pintura", ["tedio"]), item(5, "pintura", ["vigilancia"]), item(6, "pintura", ["anomia"])];
    for (const idioma of IDIOMAS) {
      const fa = comporFrase(a, idioma, glossario).frase;
      const fb = comporFrase(b, idioma, glossario).frase;
      expect(fa).not.toBe(fb);
      for (const t of termosPermitidos(b, idioma, glossario)) expect(fa).not.toContain(t.termo);
      for (const t of termosPermitidos(a, idioma, glossario)) expect(fb).not.toContain(t.termo);
    }
  });
});

describe("comporFrase com mais de três escolhas", () => {
  const NUMERO = { "pt-BR": "cinco", en: "five", "zh-CN": "五" } as const;

  it("a frase diz quantos itens foram reunidos, por extenso", () => {
    const itens = [item(1, "pintura", ["nostalgia"]), item(2, "som", ["tedio"]), item(3, "palavra", ["vigilancia"]), item(4, "pintura", ["apego"]), item(5, "som", ["luto"])];
    for (const idioma of IDIOMAS) {
      const { frase } = comporFrase(itens, idioma, glossario);
      expect(frase).toContain(NUMERO[idioma]);
      expect(frase).not.toMatch(/três|three|三/);
    }
  });

  it("concorda o número com o tipo em português", () => {
    const pinturas = Array.from({ length: 21 }, (_, n) => item(n, "pintura", ["nostalgia", "apego"]));
    const sons = Array.from({ length: 22 }, (_, n) => item(n, "som", ["nostalgia", "apego"]));
    expect(comporFrase(pinturas, "pt-BR", glossario).frase).toContain("As vinte e uma imagens");
    expect(comporFrase(sons, "pt-BR", glossario).frase).toContain("Os vinte e dois sons");
  });

  it("no tom convergente, o construto mais repetido vem primeiro e o fundo cresce com a seleção, até três", () => {
    const itens = [
      item(1, "pintura", ["nostalgia", "apego"]),
      item(2, "som", ["nostalgia", "tedio"]),
      item(3, "palavra", ["nostalgia", "vigilancia"]),
      item(4, "pintura", ["pertencimento", "apego"]),
      item(5, "som", ["luto"]),
      item(6, "palavra", ["solidao"]),
    ];
    const { construtos_usados } = comporFrase(itens, "pt-BR", glossario);
    expect(construtos_usados[0]).toBe("nostalgia"); // três itens
    expect(construtos_usados[1]).toBe("apego"); // dois itens
    expect(construtos_usados).toHaveLength(4); // um repetido e três ao fundo: o validador aceita até quatro termos
  });

  it("com três itens o fundo continua sendo um termo só", () => {
    const itens = [item(1, "pintura", ["nostalgia", "apego", "tedio"]), item(2, "som", ["nostalgia"]), item(3, "palavra", ["pertencimento"])];
    expect(comporFrase(itens, "pt-BR", glossario).construtos_usados).toHaveLength(2);
  });

  it("no tom divergente com muitos itens, a frase nomeia no máximo quatro termos", () => {
    const ids = ["nostalgia", "tedio", "vigilancia", "apego", "luto", "solidao", "pertencimento"];
    const itens = ids.map((c, n) => item(n, "pintura", [c]));
    const { construtos_usados } = comporFrase(itens, "en", glossario);
    expect(construtos_usados).toHaveLength(4);
  });

  it("toda seleção de 3 a 40 itens dá frase que o validador aceita, nos três idiomas", () => {
    const construtos = Object.values(glossario).filter((c) => !c.dimensao).map((c) => c.id);
    const tipos: Tipo[] = ["pintura", "som", "palavra"];
    let semente = 20261112;
    const sorteio = () => {
      semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0;
      return semente / 2 ** 32;
    };
    const reprovadas: string[] = [];
    for (let rodada = 0; rodada < 400; rodada++) {
      const quantos = 3 + Math.floor(sorteio() * 38);
      const misto = sorteio() < 0.7;
      const tipoUnico = tipos[Math.floor(sorteio() * 3)]!;
      const itens = Array.from({ length: quantos }, (_, n) => {
        const tipo = misto ? tipos[Math.floor(sorteio() * 3)]! : tipoUnico;
        const quantosConstrutos = 1 + Math.floor(sorteio() * 3);
        const meus = [...new Set(Array.from({ length: quantosConstrutos }, () => construtos[Math.floor(sorteio() * construtos.length)]!))];
        return item(n, tipo, meus, sorteio() < 0.1);
      });
      for (const idioma of IDIOMAS) {
        const { frase, construtos_usados } = comporFrase(itens, idioma, glossario);
        const v = validarFrase(frase, construtos_usados, itens, idioma, glossario);
        if (!v.ok) reprovadas.push(`${idioma} n=${quantos} ${v.codigos.join(",")}: ${frase}`);
      }
    }
    expect(reprovadas.slice(0, 5)).toEqual([]);
  });
});
