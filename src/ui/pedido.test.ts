import { afterEach, describe, expect, it, vi } from "vitest";
import { casos, glossarioDosCasos } from "../../tests/fixtures/adaptar";
import { pedirFrase } from "./pedido";

const glossario = glossarioDosCasos();
const acervo = casos().flatMap((c) => c.itens);
const ids = casos()[0]!.itens.map((i) => i.id);
const boa = { frase: "Uma frase do servidor.", idioma: "pt-BR", origem: "modelo", construtos_usados: ["nostalgia"], ajuda_destacada: false, versao_prompt: "v" };

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.useRealTimers());

describe("pedirFrase", () => {
  it("sem endereço de função compõe no aparelho e não usa a rede", async () => {
    const buscar = vi.fn();
    const r = await pedirFrase(ids, "pt-BR", { buscar, base: null, acervo, glossario });
    expect(r.origem).toBe("regra");
    expect(r.frase.endsWith(".")).toBe(true);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("com função no ar devolve a frase dela, enviando só ids e idioma", async () => {
    const buscar = vi.fn(async () => resposta(boa));
    const r = await pedirFrase(ids, "pt-BR", { buscar, base: "https://api.test", acervo, glossario });
    expect(r.frase).toBe("Uma frase do servidor.");
    const [url, opcoes] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/api/interpretar");
    expect(JSON.parse(String(opcoes.body))).toEqual({ itens: ids, idioma: "pt-BR" });
  });

  it("função que não responde em 8 segundos: vale a frase por regra", async () => {
    vi.useFakeTimers();
    const buscar = vi.fn((_url: string, opcoes?: RequestInit) => new Promise<Response>((_, rejeitar) => {
      opcoes?.signal?.addEventListener("abort", () => rejeitar(new DOMException("abortado", "AbortError")));
    }));
    const promessa = pedirFrase(ids, "pt-BR", { buscar: buscar as unknown as typeof fetch, base: "https://api.test", acervo, glossario });
    await vi.advanceTimersByTimeAsync(7999);
    let resolvida = false;
    void promessa.then(() => (resolvida = true));
    await Promise.resolve();
    expect(resolvida).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect((await promessa).origem).toBe("regra");
  });

  it("rede fora do ar, status de erro ou corpo fora do contrato: vale a frase por regra", async () => {
    const falhas = [
      vi.fn(async () => { throw new TypeError("sem rede"); }),
      vi.fn(async () => resposta({ erro: "x" }, 500)),
      vi.fn(async () => resposta({ idioma: "pt-BR" })),
      vi.fn(async () => new Response("<html>", { status: 200 })),
    ];
    for (const buscar of falhas) {
      const r = await pedirFrase(ids, "en", { buscar: buscar as unknown as typeof fetch, base: "https://api.test", acervo, glossario });
      expect(r.origem).toBe("regra");
      expect(r.idioma).toBe("en");
    }
  });

  it("toque duplo: a mesma seleção em andamento faz um pedido só", async () => {
    const buscar = vi.fn(async () => resposta(boa));
    const deps = { buscar: buscar as unknown as typeof fetch, base: "https://api.test", acervo, glossario };
    const [a, b] = await Promise.all([pedirFrase(ids, "pt-BR", deps), pedirFrase([...ids].reverse(), "pt-BR", deps)]);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("a versão simples que o servidor mandar passa adiante; se não for texto, é ignorada", async () => {
    const comSimples = await pedirFrase(ids, "pt-BR", { buscar: vi.fn(async () => resposta({ ...boa, simples: "O que você escolheu fala de saudade." })), base: "https://api.test", acervo, glossario });
    expect(comSimples.simples).toBe("O que você escolheu fala de saudade.");
    const semTexto = await pedirFrase([...ids].reverse(), "pt-BR", { buscar: vi.fn(async () => resposta({ ...boa, simples: { html: "<b>x</b>" } })), base: "https://api.test", acervo, glossario });
    expect(semTexto.frase).toBe(boa.frase);
    expect(semTexto).not.toHaveProperty("simples");
  });
});

describe("quanto o navegador espera pela função", () => {
  it("VITE_FRASE_ESPERA_MS entre 3 e 30 segundos vale; fora disso, torto ou ausente, são 8 segundos", async () => {
    const { esperaDoCliente } = await import("./pedido");
    expect(esperaDoCliente("16000")).toBe(16000);
    for (const torto of [undefined, "", "abc", "2999", "30001", "1e4"]) expect(esperaDoCliente(torto), String(torto)).toBe(8000);
  });
});
