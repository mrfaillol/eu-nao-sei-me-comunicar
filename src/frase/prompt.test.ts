import { describe, expect, it } from "vitest";
import acervoReal from "../../public/indice/acervo.json";
import construtosReais from "../../public/indice/construtos.json";
import { comporFrase } from "./compositor";
import { indexarGlossario } from "./glossario";
import { montarMensagens } from "./prompt";
import { termosPermitidos } from "./termos";
import type { Acervo, Construto, Item } from "./tipos";

const glossario = indexarGlossario(construtosReais as unknown as Construto[]);
const palavras = (acervoReal as unknown as Acervo).itens.filter((i) => i.tipo === "palavra" && i.idioma === "pt-BR");

/** Palavras do acervo, uma a uma, até a seleção permitir pelo menos `n` termos diferentes. */
function selecaoCom(n: number): Item[] {
  const itens: Item[] = [];
  for (const palavra of palavras) {
    itens.push(palavra);
    if (itens.length >= 3 && termosPermitidos(itens, "pt-BR", glossario).length >= n) return itens;
  }
  throw new Error("o acervo não tem palavras para tantos termos");
}

type Pedido = { termos_permitidos: Array<{ id: string; termo: string }>; itens: Array<{ construtos: string[] }> };
const pedido = (itens: Item[]) => JSON.parse(montarMensagens(itens, "pt-BR", glossario).usuario) as Pedido;

describe("o que o pré-prompt entrega ao modelo", () => {
  it("seleção que permite mais de quatro termos chega ao modelo só com os que a frase por regra escolheria", () => {
    // A frase aceita de dois a quatro termos. Modelo que recebe sete tende a usar os sete, e é reprovado.
    const itens = selecaoCom(7);
    const { termos_permitidos, itens: enviados } = pedido(itens);
    const ids = termos_permitidos.map((t) => t.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids.length).toBeLessThanOrEqual(4);
    expect([...ids].sort()).toEqual([...comporFrase(itens, "pt-BR", glossario).construtos_usados].sort());
    // Os construtos de cada item também saem cortados: o modelo não vê termo que não pode usar.
    for (const item of enviados) for (const construto of item.construtos) expect(ids).toContain(construto);
    expect(enviados).toHaveLength(itens.length);
  });

  it("seleção com até quatro termos permitidos segue inteira", () => {
    const itens = palavras.slice(0, 3);
    const permitidos = termosPermitidos(itens, "pt-BR", glossario);
    expect(permitidos.length).toBeLessThanOrEqual(4);
    const { termos_permitidos, itens: enviados } = pedido(itens);
    expect(termos_permitidos.map((t) => t.id)).toEqual(permitidos.map((t) => t.id));
    expect(enviados.map((i) => i.construtos)).toEqual(itens.map((i) => i.construtos));
  });
});

describe("termo declarado e termo escrito", () => {
  it("vale o que está escrito na frase: declarar um termo permitido que não foi escrito não reprova", async () => {
    // Medido em 12/Nov/2026: o modelo declara "emoções positivas" e escreve "regozijo". A frase está dentro do
    // contrato; o que sai para a tela é a lista do que está escrito, não a declarada.
    const { validarFrase } = await import("./validador");
    const itens = selecaoCom(6);
    const { frase, construtos_usados } = comporFrase(itens, "pt-BR", glossario);
    const sobra = termosPermitidos(itens, "pt-BR", glossario).map((t) => t.id).find((id) => !construtos_usados.includes(id))!;
    expect(sobra).toBeDefined();
    const r = validarFrase(frase, [...construtos_usados, sobra], itens, "pt-BR", glossario);
    expect(r.codigos).toEqual([]);
    expect([...r.presentes].sort()).toEqual([...construtos_usados].sort());
  });

  it("declarar um termo que a seleção não permite continua reprovando", async () => {
    const { validarFrase } = await import("./validador");
    const itens = selecaoCom(6);
    const { frase, construtos_usados } = comporFrase(itens, "pt-BR", glossario);
    const permitidos = new Set(termosPermitidos(itens, "pt-BR", glossario).map((t) => t.id));
    const deFora = (construtosReais as unknown as Construto[]).map((c) => c.id).find((id) => !permitidos.has(id))!;
    expect(validarFrase(frase, [...construtos_usados, deFora], itens, "pt-BR", glossario).codigos).toContain("V5");
  });
});
