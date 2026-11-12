import { describe, expect, it } from "vitest";
import frases from "../../tests/fixtures/frases.json";
import { caso, casos, glossarioDosCasos, mutacoes } from "../../tests/fixtures/adaptar";
import type { Idioma } from "./tipos";
import { IDIOMAS } from "./tipos";
import { validarFrase } from "./validador";

const glossario = glossarioDosCasos();

interface Registro {
  idioma: string;
  caso: string;
  frase: string;
  construtos_usados: string[];
  origem?: string;
  grupo?: string;
}

function validar(r: Registro) {
  return validarFrase(r.frase, r.construtos_usados, caso(r.caso).itens, r.idioma as Idioma, glossario);
}

describe("validarFrase aceita o que é legítimo", () => {
  for (const c of casos()) {
    for (const idioma of IDIOMAS) {
      it(`frase de referência: ${c.id} em ${idioma}`, () => {
        const r = validarFrase(c.frase[idioma], c.construtos_usados, c.itens, idioma, glossario);
        expect(r.codigos).toEqual([]);
        expect(r.ok).toBe(true);
      });
    }
  }

  // As frases "gravadas" saíram do compositor do protótipo em Python, que liberava termo de dimensão
  // quando UM item passava do corte. Aqui a regra é a média de itens com norma direta (Tarefa 9),
  // então uma gravada que use termo de dimensão hoje não permitido é reprovada só por V5, e está certo.
  for (const r of (frases.legitimas as Registro[]).filter((x) => x.origem === "gravada")) {
    it(`frase gravada do protótipo: ${r.caso} em ${r.idioma}`, () => {
      expect(validar(r).codigos.filter((c) => c !== "V5")).toEqual([]);
    });
  }
});

describe("validarFrase rejeita o que quebra o contrato", () => {
  for (const [i, m] of mutacoes().entries()) {
    it(`mutação ${i + 1} (${m.idioma}) cai em ${m.deve_falhar}`, () => {
      const r = validarFrase(m.frase, m.construtos_usados, caso(m.caso).itens, m.idioma, glossario);
      expect(r.codigos).toContain(m.deve_falhar);
    });
  }

  for (const [i, r] of (frases.clinicas as Registro[]).entries()) {
    it(`atribuição clínica ${i + 1} (${r.idioma}) cai em V6`, () => {
      expect(validar(r).codigos).toContain("V6");
    });
  }

  for (const [i, r] of (frases.defeituosas as Registro[]).entries()) {
    it(`frase defeituosa ${i + 1} (${r.grupo}, ${r.idioma}) é rejeitada`, () => {
      expect(validar(r).ok).toBe(false);
    });
  }
});

describe("sondas de língua", () => {
  const esperado: Record<string, string | null> = {
    "deveria cair em V7": "V7",
    "deveria cair em V6": "V6",
    "o pré-prompt proíbe 您; deveria cair em V4": "V4",
    "idioma pedido é zh-CN; deveria cair em V10": "V10",
    "frase legítima, deveria passar": null,
    "frase legítima; termo não é contado": null,
  };
  for (const s of frases.sondas_lingua as Array<Registro & { nome: string; esperado: string }>) {
    it(s.nome, () => {
      const r = validar(s);
      const codigo = esperado[s.esperado];
      expect(codigo, `expectativa desconhecida: ${s.esperado}`).not.toBeUndefined();
      if (codigo === null) expect(r.codigos).toEqual([]);
      else expect(r.codigos).toContain(codigo);
    });
  }
});

describe("casos pontuais", () => {
  const c4 = caso("caso-4");
  it("conselho com menção de ajuda cai em V7", () => {
    const frase = "Suas três escolhas comunicam luto e desamparo, e procure ajuda para a desesperança que a pintura e o som indicam.";
    const r = validarFrase(frase, ["luto", "desamparo"], c4.itens, "pt-BR", glossario);
    expect(r.codigos).toContain("V7");
  });

  it("palavra capitalizada no meio da frase, que não é rótulo escolhido, cai em V2", () => {
    const frase = "Suas três escolhas comunicam luto e desamparo A soma delas afirma a desesperança que você reuniu sem dizer com palavras suas.";
    const r = validarFrase(frase, ["luto", "desamparo"], c4.itens, "pt-BR", glossario);
    expect(r.codigos).toContain("V2");
  });

  it("apego ao lugar não é lido como apego", () => {
    const g = {
      ...glossario,
      apego_ao_lugar: { ...glossario.apego!, id: "apego_ao_lugar", termo: { "pt-BR": "apego ao lugar", en: "place attachment", "zh-CN": "地方依恋" } },
    };
    const itens = caso("caso-5").itens.map((i) => ({ ...i, construtos: ["apego_ao_lugar", "pertencimento"], afeto: { metodo: "ausente" as const } }));
    const frase = "As três pinturas que você reuniu mostram gente em volta de uma mesma praça, e essa repetição comunica apego ao lugar e pertencimento.";
    const r = validarFrase(frase, ["apego_ao_lugar", "pertencimento"], itens, "pt-BR", g);
    expect(r.codigos).toEqual([]);
  });
});
