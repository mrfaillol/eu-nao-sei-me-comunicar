import { describe, expect, it } from "vitest";
import { credencialEmUso, escolherProvedor } from "./anthropic";
import { configuracaoCompativel, criarProvedorCompativel } from "./compativel";
import { FalhaDoProvedor } from "./tipos";

type Chamada = { url: string; init: RequestInit };

/** Um `fetch` falso que guarda o que recebeu e devolve a resposta combinada. */
function buscarFalso(resposta: () => Response | Promise<Response>) {
  const chamadas: Chamada[] = [];
  const buscar = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init: init ?? {} });
    return resposta();
  }) as typeof fetch;
  return { buscar, chamadas };
}

const comTexto = (texto: unknown, status = 200) => () => new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: texto } }] }), { status });
const opcoes = { endereco: "https://api.exemplo.test/provider/v1/", chave: "segredo", modelo: "gratuito:free" };
const sinal = () => new AbortController().signal;

async function tipoDaFalha(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa;
  } catch (erro) {
    expect(erro).toBeInstanceOf(FalhaDoProvedor);
    return (erro as FalhaDoProvedor).tipo;
  }
  throw new Error("não falhou");
}

describe("provedor compatível com chat/completions", () => {
  it("manda o sistema e o usuário para /chat/completions, com a chave no cabeçalho e teto curto de saída", async () => {
    const { buscar, chamadas } = buscarFalso(comTexto('{"frase":"x"}'));
    const provedor = criarProvedorCompativel({ ...opcoes, buscar });
    const texto = await provedor.gerar("SISTEMA", "USUARIO", 1, sinal());

    expect(texto).toBe('{"frase":"x"}');
    expect(provedor.nome).toBe("compativel:gratuito:free");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]!.url).toBe("https://api.exemplo.test/provider/v1/chat/completions");
    expect(chamadas[0]!.init.method).toBe("POST");
    const cabecalhos = new Headers(chamadas[0]!.init.headers);
    expect(cabecalhos.get("authorization")).toBe("Bearer segredo");
    expect(cabecalhos.get("content-type")).toBe("application/json");
    const corpo = JSON.parse(String(chamadas[0]!.init.body)) as { model: string; max_tokens: number; messages: Array<{ role: string; content: string }> };
    expect(corpo.model).toBe("gratuito:free");
    expect(corpo.messages).toEqual([
      { role: "system", content: "SISTEMA" },
      { role: "user", content: "USUARIO" },
    ]);
    expect(corpo.max_tokens).toBeLessThanOrEqual(1200);
  });

  it("repassa o sinal de cancelamento ao pedido", async () => {
    const { buscar, chamadas } = buscarFalso(comTexto("ok"));
    const controle = new AbortController();
    await criarProvedorCompativel({ ...opcoes, buscar }).gerar("s", "u", 1, controle.signal);
    expect(chamadas[0]!.init.signal).toBe(controle.signal);
  });

  it("tira o bloco de raciocínio que alguns modelos abertos escrevem antes da resposta", async () => {
    const { buscar } = buscarFalso(comTexto('<think>\nvou pensar {"a":1}\n</think>\n\n{"frase":"x"}'));
    expect(await criarProvedorCompativel({ ...opcoes, buscar }).gerar("s", "u", 1, sinal())).toBe('{"frase":"x"}');
  });

  it.each([
    [401, "autenticacao"],
    [403, "autenticacao"],
    [429, "limite"],
    [400, "pedido"],
    [404, "pedido"],
    [500, "api"],
    [503, "api"],
  ])("resposta %i vira falha do tipo %s", async (status, tipo) => {
    const { buscar } = buscarFalso(() => new Response('{"error":"x"}', { status }));
    expect(await tipoDaFalha(criarProvedorCompativel({ ...opcoes, buscar }).gerar("s", "u", 1, sinal()))).toBe(tipo);
  });

  it("rede caída vira falha de conexão", async () => {
    const buscar = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await tipoDaFalha(criarProvedorCompativel({ ...opcoes, buscar }).gerar("s", "u", 1, sinal()))).toBe("conexao");
  });

  it("resposta sem texto, ou que não é JSON, vira falha da API", async () => {
    for (const resposta of [comTexto(""), comTexto(null), () => new Response("<html>", { status: 200 }), () => new Response("{}", { status: 200 })]) {
      const { buscar } = buscarFalso(resposta);
      expect(await tipoDaFalha(criarProvedorCompativel({ ...opcoes, buscar }).gerar("s", "u", 1, sinal()))).toBe("api");
    }
  });

  it("campos extras vão no corpo, sem poder trocar o modelo, as mensagens ou o teto de saída", async () => {
    // Os modelos gratuitos de raciocínio gastam o teto de saída pensando e devolvem vazio: é preciso desligar o raciocínio.
    const { buscar, chamadas } = buscarFalso(comTexto("ok"));
    const extra = { reasoning: { enabled: false }, model: "outro", messages: [], max_tokens: 99999 };
    await criarProvedorCompativel({ ...opcoes, extra, buscar }).gerar("s", "u", 1, sinal());
    const corpo = JSON.parse(String(chamadas[0]!.init.body)) as Record<string, unknown>;
    expect(corpo.reasoning).toEqual({ enabled: false });
    expect(corpo.model).toBe("gratuito:free");
    expect(corpo.messages).toHaveLength(2);
    expect(corpo.max_tokens).toBeLessThanOrEqual(1200);
  });

  it("a mensagem da falha não carrega a chave nem o corpo devolvido pelo provedor", async () => {
    const { buscar } = buscarFalso(() => new Response('{"error":"chave segredo inválida"}', { status: 401 }));
    try {
      await criarProvedorCompativel({ ...opcoes, buscar }).gerar("s", "u", 1, sinal());
    } catch (erro) {
      expect((erro as Error).message).not.toContain("segredo");
    }
  });
});

describe("escolherProvedor com um provedor compatível configurado", () => {
  const compativel = { MODELO_URL: "https://api.exemplo.test/v1", MODELO_CHAVE: "k", MODELO_NOME: "gratuito:free" };

  it("as três variáveis juntas ligam o provedor compatível, mesmo com o token do projeto presente", () => {
    expect(escolherProvedor(compativel, "token-do-projeto")?.nome).toBe("compativel:gratuito:free");
  });

  it("faltando uma das três, vale o que valia antes", () => {
    expect(escolherProvedor({ MODELO_URL: compativel.MODELO_URL, MODELO_CHAVE: "k" }, undefined)).toBeNull();
    expect(escolherProvedor({ MODELO_URL: compativel.MODELO_URL, MODELO_NOME: "m" }, "token")?.nome).toMatch(/^gateway:/);
  });

  it("endereço que não é https não liga o provedor: a chave não viaja em texto aberto", () => {
    expect(escolherProvedor({ ...compativel, MODELO_URL: "http://api.exemplo.test/v1" }, undefined)).toBeNull();
  });

  it("a chave da Anthropic continua na frente, e FRASE_PROVEDOR=nenhum desliga tudo", () => {
    expect(escolherProvedor({ ...compativel, ANTHROPIC_API_KEY: "a" }, undefined)?.nome).toMatch(/^anthropic:/);
    expect(escolherProvedor({ ...compativel, FRASE_PROVEDOR: "nenhum" }, "token")).toBeNull();
  });

  it("MODELO_TETO troca o teto de saída, dentro de 200 a 4096; fora disso ou torto, vale o padrão de 700", async () => {
    // Modelo que raciocina gasta saída pensando: com 700 de teto devolve vazio. O teto continua limitado, porque o endereço é público.
    expect(configuracaoCompativel(compativel)?.teto).toBe(700);
    expect(configuracaoCompativel({ ...compativel, MODELO_TETO: "3000" })?.teto).toBe(3000);
    for (const torto of ["100", "99999", "abc", "-5", "1e3", "700.5"]) expect(configuracaoCompativel({ ...compativel, MODELO_TETO: torto })?.teto, torto).toBe(700);
    const { buscar, chamadas } = buscarFalso(comTexto("ok"));
    await criarProvedorCompativel({ ...opcoes, teto: 3000, buscar }).gerar("s", "u", 1, sinal());
    expect((JSON.parse(String(chamadas[0]!.init.body)) as { max_tokens: number }).max_tokens).toBe(3000);
  });

  it("MODELO_EXTRA é um objeto JSON que vai no corpo; se não for um objeto, o provedor não liga", async () => {
    expect(configuracaoCompativel({ ...compativel, MODELO_EXTRA: '{"reasoning":{"enabled":false}}' })?.extra).toEqual({ reasoning: { enabled: false } });
    expect(configuracaoCompativel(compativel)?.extra).toEqual({});
    for (const torto of ["{", "[1]", '"texto"', "null"]) expect(configuracaoCompativel({ ...compativel, MODELO_EXTRA: torto }), torto).toBeNull();
  });

  it("a credencial em uso é a do provedor escolhido", () => {
    expect(credencialEmUso({ ...compativel, ANTHROPIC_API_KEY: "a" }, "token")).toBe("a");
    expect(credencialEmUso(compativel, "token")).toBe("k");
    expect(credencialEmUso({ AI_GATEWAY_API_KEY: "g" }, "token")).toBe("g");
    expect(credencialEmUso({}, "token")).toBe("token");
    expect(credencialEmUso({}, undefined)).toBe("");
  });
});
