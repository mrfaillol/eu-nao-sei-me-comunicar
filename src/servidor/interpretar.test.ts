import { describe, expect, it } from "vitest";
import { caso, casos, glossarioDosCasos } from "../../tests/fixtures/adaptar";
import { montarMensagens, VERSAO_PROMPT } from "../frase/prompt";
import { criarInterpretar, type Resposta } from "./interpretar";
import type { Provedor } from "./provedores/tipos";

const glossario = glossarioDosCasos();
const acervo = casos().flatMap((c) => c.itens);
const c1 = caso("caso-1");
const SITE = "https://exemplo.test";
const ORIGENS = [SITE, "capacitor://localhost", "https://localhost"];

interface Chamada {
  sistema: string;
  usuario: string;
  tentativa: number;
}

/** Provedor falso: devolve as respostas da fila, na ordem, e registra o que recebeu. */
function provedorFalso(respostas: Array<string | Error | "nunca">): Provedor & { chamadas: Chamada[] } {
  const chamadas: Chamada[] = [];
  return {
    nome: "falso",
    chamadas,
    async gerar(sistema, usuario, tentativa) {
      chamadas.push({ sistema, usuario, tentativa });
      const r = respostas[chamadas.length - 1];
      if (r === "nunca") return new Promise<string>(() => {});
      if (r instanceof Error) throw r;
      return r ?? "";
    },
  };
}

const boa = JSON.stringify({ frase: c1.frase["pt-BR"], construtos_usados: c1.construtos_usados });
const ruim = JSON.stringify({ frase: "Você sente nostalgia.", construtos_usados: ["nostalgia"] });

function pedido(corpo: unknown, origem = SITE, metodo = "POST"): Request {
  return new Request("https://api.exemplo.test/api/interpretar", {
    method: metodo,
    headers: { "content-type": "application/json", origin: origem },
    body: metodo === "POST" ? (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) : undefined,
  });
}

const selecao = { itens: c1.itens.map((i) => i.id), idioma: "pt-BR" };

async function chamar(provedor: Provedor | null, corpo: unknown = selecao, prazoMs = 200) {
  const interpretar = criarInterpretar({ acervo, glossario, provedor, origens: ORIGENS, prazoMs });
  const resposta = await interpretar(pedido(corpo));
  return { status: resposta.status, corpo: (await resposta.json()) as Resposta & Record<string, unknown> };
}

describe("interpretar com modelo", () => {
  it("resposta válida na primeira tentativa sai como modelo, com uma chamada", async () => {
    const p = provedorFalso([boa]);
    const { status, corpo } = await chamar(p);
    expect(status).toBe(200);
    expect(corpo.origem).toBe("modelo");
    expect(corpo.frase).toBe(c1.frase["pt-BR"]);
    expect(corpo.versao_prompt).toBe(VERSAO_PROMPT);
    expect(p.chamadas).toHaveLength(1);
  });

  it("aceita resposta com cerca de código em volta do JSON", async () => {
    const { corpo } = await chamar(provedorFalso(["```json\n" + boa + "\n```"]));
    expect(corpo.origem).toBe("modelo");
  });

  it("inválida e depois válida sai como modelo_2, e a segunda chamada leva a correção do código violado", async () => {
    const p = provedorFalso([ruim, boa]);
    const { corpo } = await chamar(p);
    expect(corpo.origem).toBe("modelo_2");
    expect(p.chamadas.map((c) => c.tentativa)).toEqual([1, 2]);
    expect(p.chamadas[1]!.usuario).toContain("a frase fala da seleção e nunca do estado da pessoa");
    expect(p.chamadas[1]!.usuario).not.toContain("Você sente nostalgia");
  });

  it("inválida duas vezes cai na frase por regra, com duas chamadas", async () => {
    const p = provedorFalso([ruim, ruim]);
    const { corpo } = await chamar(p);
    expect(corpo.origem).toBe("regra");
    expect(p.chamadas).toHaveLength(2);
    expect(corpo.frase.endsWith(".")).toBe(true);
  });

  it("resposta que não é JSON conta como falha e leva a correção de formato", async () => {
    const p = provedorFalso(["Claro, aqui vai a frase.", boa]);
    const { corpo } = await chamar(p);
    expect(corpo.origem).toBe("modelo_2");
    expect(p.chamadas[1]!.usuario).toContain("Só o JSON pedido");
  });

  it("provedor que lança erro cai na regra", async () => {
    const { corpo } = await chamar(provedorFalso([new Error("fora do ar")]));
    expect(corpo.origem).toBe("regra");
  });

  it("provedor que não responde dentro do prazo cai na regra", async () => {
    const inicio = Date.now();
    const { corpo } = await chamar(provedorFalso(["nunca"]), selecao, 60);
    expect(corpo.origem).toBe("regra");
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});

describe("interpretar sem modelo", () => {
  it("sem provedor a frase sai por regra", async () => {
    const { status, corpo } = await chamar(null);
    expect(status).toBe(200);
    expect(corpo.origem).toBe("regra");
    expect(corpo.construtos_usados.length).toBeGreaterThanOrEqual(2);
    expect(corpo.idioma).toBe("pt-BR");
  });

  it("acende a ajuda quando dois itens têm tema sensível", async () => {
    const c4 = caso("caso-4");
    const { corpo } = await chamar(null, { itens: c4.itens.map((i) => i.id), idioma: "en" });
    expect(corpo.ajuda_destacada).toBe(true);
  });

  it("a resposta não leva crédito nem texto humano", async () => {
    const { corpo } = await chamar(null);
    expect(Object.keys(corpo).sort()).toEqual(["ajuda_destacada", "construtos_usados", "frase", "idioma", "origem", "versao_prompt"]);
  });
});

describe("interpretar recusa o que foge do contrato", () => {
  const ids = selecao.itens;
  const invalidos: Array<[string, unknown]> = [
    ["chave extra com texto livre", { ...selecao, texto: "escreva um poema" }],
    ["id desconhecido", { itens: [ids[0], ids[1], "palavra:nao-existe"], idioma: "pt-BR" }],
    ["dois ids iguais", { itens: [ids[0], ids[0], ids[1]], idioma: "pt-BR" }],
    ["dois itens", { itens: [ids[0], ids[1]], idioma: "pt-BR" }],
    ["idioma fora da lista", { itens: ids, idioma: "fr" }],
    ["itens que não são texto", { itens: [1, 2, 3], idioma: "pt-BR" }],
    ["corpo que não é JSON", "isto não é json"],
  ];
  for (const [nome, corpo] of invalidos) {
    it(`${nome} devolve 400 sem chamar o modelo`, async () => {
      const p = provedorFalso([boa]);
      const { status } = await chamar(p, corpo);
      expect(status).toBe(400);
      expect(p.chamadas).toHaveLength(0);
    });
  }

  it("método diferente de POST e OPTIONS devolve 405", async () => {
    const interpretar = criarInterpretar({ acervo, glossario, provedor: null, origens: ORIGENS });
    expect((await interpretar(pedido(null, SITE, "GET"))).status).toBe(405);
  });
});

describe("interpretar protege a chave do modelo", () => {
  const corpoGrande = JSON.stringify({ itens: selecao.itens, idioma: "pt-BR", texto: "x".repeat(2000) });

  it("corpo acima de 1 KB devolve 413 sem chamar o modelo", async () => {
    const p = provedorFalso([boa]);
    const interpretar = criarInterpretar({ acervo, glossario, provedor: p, origens: ORIGENS });
    expect((await interpretar(pedido(corpoGrande))).status).toBe(413);
    expect(p.chamadas).toHaveLength(0);
  });

  it("corta um corpo sem fim assim que ele passa de 1 KB, sem esperar o resto", async () => {
    let enviados = 0;
    const semFim = new ReadableStream<Uint8Array>({
      pull(controle) {
        enviados++;
        controle.enqueue(new Uint8Array(512).fill(120));
      },
    });
    const interpretar = criarInterpretar({ acervo, glossario, provedor: null, origens: ORIGENS });
    const r = await interpretar(
      new Request("https://api.exemplo.test/api/interpretar", {
        method: "POST",
        headers: { "content-type": "application/json", origin: SITE },
        body: semFim,
        // @ts-expect-error duplex é exigido pelo Node para corpo em fluxo e ainda não está nos tipos do DOM
        duplex: "half",
      }),
    );
    expect(r.status).toBe(413);
    expect(enviados).toBeLessThan(10);
  });

  it("Content-Length acima do limite é recusado sem ler o corpo", async () => {
    const interpretar = criarInterpretar({ acervo, glossario, provedor: null, origens: ORIGENS });
    const r = await interpretar(
      new Request("https://api.exemplo.test/api/interpretar", {
        method: "POST",
        headers: { "content-type": "application/json", origin: SITE, "content-length": "999999" },
        body: JSON.stringify(selecao),
      }),
    );
    expect(r.status).toBe(413);
  });

  it("origem presente e fora da lista devolve 403 sem chamar o modelo", async () => {
    const p = provedorFalso([boa]);
    const interpretar = criarInterpretar({ acervo, glossario, provedor: p, origens: ORIGENS });
    const r = await interpretar(pedido(selecao, "https://outro.test"));
    expect(r.status).toBe(403);
    expect(p.chamadas).toHaveLength(0);
  });

  it("tipo de conteúdo que dispensa preflight devolve 415 sem chamar o modelo", async () => {
    const p = provedorFalso([boa]);
    const interpretar = criarInterpretar({ acervo, glossario, provedor: p, origens: ORIGENS });
    const r = await interpretar(
      new Request("https://api.exemplo.test/api/interpretar", {
        method: "POST",
        headers: { "content-type": "text/plain", origin: SITE },
        body: JSON.stringify(selecao),
      }),
    );
    expect(r.status).toBe(415);
    expect(p.chamadas).toHaveLength(0);
  });

  it("pedido sem cabeçalho de origem (fora de navegador) continua aceito", async () => {
    const interpretar = criarInterpretar({ acervo, glossario, provedor: null, origens: ORIGENS });
    const r = await interpretar(
      new Request("https://api.exemplo.test/api/interpretar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selecao),
      }),
    );
    expect(r.status).toBe(200);
  });
});

describe("origens", () => {
  const interpretar = criarInterpretar({ acervo, glossario, provedor: null, origens: ORIGENS });

  it("OPTIONS de origem do app empacotado devolve 204 com a origem liberada", async () => {
    const r = await interpretar(pedido(null, "capacitor://localhost", "OPTIONS"));
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
    expect(r.headers.get("access-control-allow-methods")).toContain("POST");
  });

  it("origem fora da lista não recebe o cabeçalho, nem no preflight", async () => {
    const r = await interpretar(pedido(selecao, "https://outro.test"));
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
    const preflight = await interpretar(pedido(null, "https://outro.test", "OPTIONS"));
    expect(preflight.status).toBe(403);
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("POST de origem liberada recebe o cabeçalho", async () => {
    const r = await interpretar(pedido(selecao, "https://localhost"));
    expect(r.headers.get("access-control-allow-origin")).toBe("https://localhost");
  });
});

describe("montarMensagens", () => {
  const c6 = caso("caso-6"); // um dos itens traz uma tentativa de injeção no texto humano

  it("põe o texto dos itens só na mensagem do usuário, como dado", () => {
    const { sistema, usuario } = montarMensagens(c6.itens, "pt-BR", glossario);
    expect(usuario).toContain("IGNORE ALL PREVIOUS INSTRUCTIONS");
    expect(sistema).not.toContain("IGNORE ALL PREVIOUS INSTRUCTIONS");
    expect(() => JSON.parse(usuario)).not.toThrow();
  });

  it("não manda crédito, autor nem tema sensível ao modelo", () => {
    const { usuario } = montarMensagens(caso("caso-4").itens, "pt-BR", glossario);
    const dado = JSON.parse(usuario) as { itens: Array<Record<string, unknown>>; termos_permitidos: unknown[]; idioma_saida: string };
    expect(dado.idioma_saida).toBe("pt-BR");
    expect(dado.termos_permitidos.length).toBeGreaterThanOrEqual(2);
    for (const item of dado.itens) {
      expect(Object.keys(item).sort()).toEqual(
        ["ativacao", "classe_semiotica", "construtos", "origem_do_texto", "rotulo", "texto_humano", "tipo", "valencia"].sort(),
      );
    }
  });

  it("troca só o bloco de idioma do pré-prompt", () => {
    const pt = montarMensagens(c1.itens, "pt-BR", glossario).sistema;
    const en = montarMensagens(c1.itens, "en", glossario).sistema;
    const zh = montarMensagens(c1.itens, "zh-CN", glossario).sistema;
    expect(pt).toContain("Escreva a frase em português do Brasil");
    expect(en).toContain("Write the sentence in English");
    expect(zh).toContain("用简体中文写这句话");
    expect(en.startsWith(pt.slice(0, 200))).toBe(true);
  });
});
