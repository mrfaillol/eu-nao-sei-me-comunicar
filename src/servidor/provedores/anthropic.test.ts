import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { criarProvedorAnthropic, criarProvedorDoGateway, escolherProvedor, FalhaDoProvedor, MODELO_DO_GATEWAY, MODELO_PADRAO } from "./anthropic";

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

describe("provedor pelo AI Gateway da Vercel", () => {
  function clienteDoGateway(resposta: unknown) {
    const pedidos: Array<{ corpo: Record<string, unknown>; opcoes: Record<string, unknown> }> = [];
    const cliente = {
      messages: {
        create: async (corpo: Record<string, unknown>, opcoes: Record<string, unknown>) => {
          pedidos.push({ corpo, opcoes });
          if (resposta instanceof Error) throw resposta;
          return resposta;
        },
      },
    } as unknown as Anthropic;
    return { cliente, pedidos };
  }

  it("usa a API de mensagens estável, sem recurso beta, com teto curto de saída", async () => {
    const { cliente, pedidos } = clienteDoGateway({ stop_reason: "end_turn", content: [{ type: "text", text: '{"frase":"x"}' }] });
    const texto = await criarProvedorDoGateway("anthropic/claude-haiku-5.5", cliente).gerar("SISTEMA", "USUARIO", 1, sinal);
    expect(texto).toBe('{"frase":"x"}');
    const { corpo, opcoes } = pedidos[0]!;
    expect(corpo.model).toBe("anthropic/claude-haiku-5.5");
    expect(corpo.system).toBe("SISTEMA");
    expect(corpo.messages).toEqual([{ role: "user", content: "USUARIO" }]);
    expect(corpo.max_tokens).toBeLessThanOrEqual(1024);
    for (const campo of ["betas", "fallbacks", "output_config", "temperature", "thinking"]) expect(corpo).not.toHaveProperty(campo);
    expect(opcoes.signal).toBe(sinal);
    expect(opcoes.maxRetries).toBe(0);
  });

  it("recusa e erro de limite viram falhas classificadas, como no provedor direto", async () => {
    const recusa = clienteDoGateway({ stop_reason: "refusal", content: [] });
    await expect(criarProvedorDoGateway("m", recusa.cliente).gerar("s", "u", 1, sinal)).rejects.toMatchObject({ tipo: "recusa" });
    const limite = clienteDoGateway(new Anthropic.RateLimitError(429, undefined, "limite", new Headers()));
    await expect(criarProvedorDoGateway("m", limite.cliente).gerar("s", "u", 1, sinal)).rejects.toMatchObject({ tipo: "limite" });
  });

  it("conta sem acesso ao gateway (403) vira falha de autenticação, não erro genérico", async () => {
    // Medido em 12/Nov/2026: sem cartão cadastrado na Vercel, o gateway devolve 403 customer_verification_required.
    const semAcesso = clienteDoGateway(new Anthropic.PermissionDeniedError(403, undefined, "customer_verification_required", new Headers()));
    await expect(criarProvedorDoGateway("m", semAcesso.cliente).gerar("s", "u", 1, sinal)).rejects.toMatchObject({ tipo: "autenticacao" });
  });

  it("sem chave da Anthropic, o token do projeto liga o gateway com o modelo barato", () => {
    const p = escolherProvedor({}, "token-do-projeto");
    expect(p?.nome).toBe(`gateway:${MODELO_DO_GATEWAY}`);
    expect(MODELO_DO_GATEWAY).toBe("anthropic/claude-haiku-5.5");
  });

  it("FRASE_MODELO troca o modelo do gateway, e FRASE_PROVEDOR=nenhum desliga", () => {
    expect(escolherProvedor({ FRASE_MODELO: "anthropic/claude-sonnet-5.5" }, "t")?.nome).toBe("gateway:anthropic/claude-sonnet-5.5");
    expect(escolherProvedor({ FRASE_PROVEDOR: "nenhum" }, "t")).toBeNull();
  });

  it("sem token e sem chave não há modelo", () => {
    expect(escolherProvedor({}, undefined)).toBeNull();
    expect(escolherProvedor({}, "")).toBeNull();
  });
});

