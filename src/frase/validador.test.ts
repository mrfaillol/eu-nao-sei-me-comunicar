import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import frases from "../../tests/fixtures/frases.json";
import sonda from "../../tests/fixtures/sonda-modelo.json";
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
  // Duas gravadas em inglês terminam em "without saying it yourself". Depois da revisão final, "yourself"
  // é barrado (para pegar "harming yourself"): falso positivo aceito, porque a queda é para a frase por regra
  // e o compositor que escrevia essas frases foi substituído pelos moldes de src/frase/moldes.
  const gravadas = (frases.legitimas as Registro[]).filter((x) => x.origem === "gravada" && !/\byourself\b/.test(x.frase));
  it("as gravadas com yourself são as duas conhecidas", () => {
    expect((frases.legitimas as Registro[]).filter((x) => /\byourself\b/.test(x.frase))).toHaveLength(2);
  });
  for (const r of gravadas) {
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

describe("respostas de um modelo real (sonda de 12/Nov/2026)", () => {
  // 17 de 18 passaram na primeira tentativa. A reprovada não tem verbo de mensagem, e a recusa está certa.
  const reprovadas: Record<string, string[]> = { "zh-CN|caso-2-so-sons": ["V9"] };
  for (const r of sonda.respostas as Registro[]) {
    it(`${r.caso} em ${r.idioma}`, () => {
      expect(validar(r).codigos, r.frase).toEqual(reprovadas[`${r.idioma}|${r.caso}`] ?? []);
    });
  }
});

import construtosReais from "../../data/construtos.json";
import acervoReal from "../../public/indice/acervo.json";
import furos from "../../tests/fixtures/revisao-final.json";
import { comporFrase } from "./compositor";
import { indexarGlossario } from "./glossario";
import type { Acervo, Construto, Item } from "./tipos";

describe("frases que o revisor final fez passar (12/Nov/2026)", () => {
  const real = indexarGlossario(construtosReais as unknown as Construto[]);
  const base = casos()[0]!.itens[0]!;
  const itens: Item[] = [["medo"], ["raiva"], ["medo"]].map((construtos, n) => ({
    ...base, id: `x:${n}`, tipo: "som", rotulo: `som ${n}`, idioma: null, construtos, afeto: { metodo: "ausente" },
  }));

  for (const [n, f] of (furos.clinicas as Array<{ idioma: string; frase: string }>).entries()) {
    it(`atribuição de estado à pessoa ${n + 1} (${f.idioma}) cai em V6`, () => {
      expect(validarFrase(f.frase, [], itens, f.idioma as Idioma, real).codigos, f.frase).toContain("V6");
    });
  }
  for (const [n, f] of (furos.conselhos as Array<{ idioma: string; frase: string }>).entries()) {
    it(`conselho ou menção de ajuda ${n + 1} (${f.idioma}) cai em V7 ou V6`, () => {
      const codigos = validarFrase(f.frase, [], itens, f.idioma as Idioma, real).codigos;
      expect(codigos.includes("V7") || codigos.includes("V6"), f.frase).toBe(true);
    });
  }

  it("devolve os termos permitidos que achou na frase, para a procedência não depender do que o modelo declara", () => {
    const frase = "Os três sons que você reuniu apontam para cenas que não se repetem, e a soma deles comunica medo e raiva, sem que uma cena anule outra.";
    const r = validarFrase(frase, [], itens, "pt-BR", real);
    expect(r.codigos).toEqual([]);
    expect(r.presentes).toEqual(["medo", "raiva"]);
  });
});

describe("o compositor contra o índice real", () => {
  // Todo trio de uma amostra fixa do acervo, nos três idiomas: nenhum molde pode ser reprovado.
  const real = indexarGlossario(construtosReais as unknown as Construto[]);
  const todos = (acervoReal as unknown as Acervo).itens;
  for (const idioma of IDIOMAS) {
    it(`nenhuma frase por regra é reprovada em ${idioma}`, () => {
      // A amostra tem tamanho fixo (cerca de 54 itens, uns 25 mil trios). Com passo fixo ela crescia junto com o
      // acervo, e os trios crescem ao cubo: em 606 palavras o teste passou de 5 s no CI.
      const doIdioma = todos.filter((i) => i.idioma === null || i.idioma === idioma);
      const passo = Math.max(3, Math.ceil(doIdioma.length / 54));
      const sessao = doIdioma.filter((_, n) => n % passo === 0);
      let conferidas = 0;
      for (let a = 0; a < sessao.length; a++) {
        for (let b = a + 1; b < sessao.length; b++) {
          for (let c = b + 1; c < sessao.length; c++) {
            const trio = [sessao[a]!, sessao[b]!, sessao[c]!];
            const { frase, construtos_usados } = comporFrase(trio, idioma, real);
            if (construtos_usados.length < 2) continue; // trio de um só construto: frase de um termo, fora do contrato de 2 a 4
            const r = validarFrase(frase, construtos_usados, trio, idioma, real);
            if (!r.ok) throw new Error(`${r.codigos.join(",")} | ${trio.map((i) => i.id).join(" + ")} | ${frase}`);
            conferidas++;
          }
        }
      }
      expect(conferidas).toBeGreaterThan(3000);
    });
  }
});

describe("sonda de 12/Nov/2026 com o pré-prompt que pede a versão simples", () => {
  const sonda = JSON.parse(readFileSync("tests/fixtures/sonda-modelo-v3.json", "utf-8")) as { casos: Array<{ n: number; idioma: Idioma; itens: string[]; frase: string; construtos_usados: string[]; simples: string }> };
  // Os itens vêm guardados com a sonda: o acervo ganha e perde itens a cada lote, e o registro da sonda não pode mudar junto.
  const acervo = (JSON.parse(readFileSync("tests/fixtures/sonda-modelo-v3-itens.json", "utf-8")) as { itens: Item[] }).itens;
  const porId = new Map(acervo.map((i) => [i.id, i]));
  const real = indexarGlossario(JSON.parse(readFileSync("public/indice/construtos.json", "utf-8")) as Construto[]);
  const codigos = (n: number) => {
    const c = sonda.casos.find((x) => x.n === n)!;
    return validarFrase(c.frase, c.construtos_usados, c.itens.map((id) => porId.get(id)!), c.idioma, real).codigos;
  };

  it("em mandarim, 你挑选了 e 你挑选的 são o ato de escolher, e não um estado atribuído à pessoa", () => {
    // As três frases em mandarim foram reprovadas por V6 só por isso: o validador conhecia 你选的 e não 你挑选.
    for (const n of [8, 9, 10]) expect(codigos(n), `caso ${n}`).not.toContain("V6");
  });

  it("frase sem verbo de mensagem continua reprovada: o modelo usou 'mostram' e 'stands against'", () => {
    expect(codigos(4)).toContain("V9");
    expect(codigos(7)).toContain("V9");
  });

  it("as cinco frases que tinham passado continuam passando", () => {
    for (const n of [1, 2, 3, 5, 6]) expect(codigos(n), `caso ${n}`).toEqual([]);
  });
});
