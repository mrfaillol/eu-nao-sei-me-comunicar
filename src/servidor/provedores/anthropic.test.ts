import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { criarProvedorAnthropic, escolherProvedor, FalhaDoProvedor, MODELO_PADRAO } from "./anthropic";

/** Cliente falso: registra o pedido e devolve a resposta dada, sem rede. */
function clienteFalso(resposta: unknown) {
  const pedidos: Array<{ corpo: Record<string, unknown>; opcoes: Record<string, unknown> }> = [];
  const cliente = {
    beta: {
      messages: {
        create: async (corpo: Record<string, unknown>, opcoes: Record<string, unknown>) => {
          pedidos.push({ corpo, opcoes });
          if (resposta instanceof Error) throw resposta;
          return resposta;
        },
      },
    },
  } as unknown as Anthropic;
  return { cliente, pedidos };
}

const sinal = new AbortController().signal;

describe("provedor Anthropic", () => {
  it("monta o pedido com o sistema, o usuário, esforço baixo, saída em JSON e fallback do servidor", async () => {
    const { cliente, pedidos } = clienteFalso({ stop_reason: "end_turn", content: [{ type: "text", text: '{"frase":"x"}' }] });
    const texto = await criarProvedorAnthropic("claude-opus-5-5", cliente).gerar("SISTEMA", "USUARIO", 1, sinal);
    expect(texto).toBe('{"frase":"x"}');
    const { corpo, opcoes } = pedidos[0]!;
    expect(corpo.model).toBe("claude-opus-5-5");
    expect(corpo.system).toBe("SISTEMA");
    expect(corpo.messages).toEqual([{ role: "user", content: "USUARIO" }]);
    expect(corpo.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(corpo.fallbacks).toBe("default");
    expect((corpo.output_config as { effort: string }).effort).toBe("low");
    expect((corpo.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    expect(corpo.max_tokens).toBeLessThanOrEqual(4096);
    expect(corpo).not.toHaveProperty("temperature");
    expect(corpo).not.toHaveProperty("thinking");
    expect(opcoes.signal).toBe(sinal);
    expect(opcoes.maxRetries).toBe(0);
  });

  it("junta só os blocos de texto, ignorando o raciocínio", async () => {
    const { cliente } = clienteFalso({
      stop_reason: "end_turn",
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: '{"a":' }, { type: "text", text: "1}" }],
    });
    expect(await criarProvedorAnthropic("m", cliente).gerar("s", "u", 1, sinal)).toBe('{"a":1}');
  });

  it("recusa do modelo vira falha do tipo recusa", async () => {
    const { cliente } = clienteFalso({ stop_reason: "refusal", stop_details: { category: null }, content: [] });
    await expect(criarProvedorAnthropic("m", cliente).gerar("s", "u", 1, sinal)).rejects.toMatchObject({ tipo: "recusa" });
  });

  it("erro de limite de uso vira falha do tipo limite", async () => {
    const erro = new Anthropic.RateLimitError(429, undefined, "limite", new Headers());
    const { cliente } = clienteFalso(erro);
    const falha = await criarProvedorAnthropic("m", cliente).gerar("s", "u", 1, sinal).catch((e: unknown) => e);
    expect(falha).toBeInstanceOf(FalhaDoProvedor);
    expect((falha as FalhaDoProvedor).tipo).toBe("limite");
  });
});

describe("escolherProvedor", () => {
  it("sem credencial devolve null", () => {
    expect(escolherProvedor({})).toBeNull();
  });

  it("com chave da Anthropic usa o modelo padrão", () => {
    expect(escolherProvedor({ ANTHROPIC_API_KEY: "chave-de-teste" })?.nome).toBe(`anthropic:${MODELO_PADRAO}`);
    expect(MODELO_PADRAO).toBe("claude-opus-5-5");
  });

  it("FRASE_MODELO troca o modelo", () => {
    expect(escolherProvedor({ ANTHROPIC_API_KEY: "chave-de-teste", FRASE_MODELO: "claude-haiku-5-5" })?.nome).toBe("anthropic:claude-haiku-5-5");
  });

  it("FRASE_PROVEDOR=nenhum desliga o modelo mesmo com chave", () => {
    expect(escolherProvedor({ ANTHROPIC_API_KEY: "chave-de-teste", FRASE_PROVEDOR: "nenhum" })).toBeNull();
  });
});
