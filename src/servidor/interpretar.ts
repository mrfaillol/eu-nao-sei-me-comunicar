// A função "interpretar": recebe três ids e um idioma, devolve a frase.
//
// O cliente nunca envia texto. Os itens são lidos do acervo aqui no servidor, então ninguém
// consegue usar este endereço como um modelo genérico nem injetar instrução pelo pedido.
//
// Cada pedido aceito pode custar uma chamada paga ao modelo, então a função recusa cedo:
// origem de navegador fora da lista (403), tipo de conteúdo que dispensa preflight (415) e corpo
// acima de 1 KB, medido enquanto chega (413). Isso não substitui limite de pedidos por cliente:
// quem chama sem navegador não manda origem, e só a hospedagem consegue contar pedidos por IP.
// O que o modelo escreve só chega à tela se passar no validador; caso contrário há uma segunda
// tentativa e, por fim, a frase composta por regra.
import { ajudaDestacada } from "../frase/ajuda";
import { comporFrase } from "../frase/compositor";
import { montarCorrecao, montarMensagens, VERSAO_PROMPT } from "../frase/prompt";
import { IDIOMAS, type Glossario, type Idioma, type Item } from "../frase/tipos";
import { validarFrase, type Codigo } from "../frase/validador";
import type { Provedor } from "./provedores/tipos";

export interface Resposta {
  frase: string;
  idioma: Idioma;
  origem: "modelo" | "modelo_2" | "regra";
  construtos_usados: string[];
  ajuda_destacada: boolean;
  versao_prompt: string;
}

export interface Dependencias {
  acervo: Item[];
  glossario: Glossario;
  provedor: Provedor | null;
  /** Origens que podem chamar a função. Em produção: a do site, capacitor://localhost e https://localhost. */
  origens: string[];
  /** Tempo total para as duas tentativas do modelo. O cliente espera 8.000 ms; aqui sobra folga para a rede. */
  prazoMs?: number;
}

const PRAZO_PADRAO_MS = 7000;
const TAMANHO_MAXIMO_DO_CORPO = 1024;

class Prazo extends Error {}

function lerResposta(texto: string): { frase: string; construtos_usados: string[] } | null {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const dado: unknown = JSON.parse(limpo);
    if (typeof dado !== "object" || dado === null) return null;
    const { frase, construtos_usados } = dado as Record<string, unknown>;
    if (typeof frase !== "string" || !Array.isArray(construtos_usados)) return null;
    if (!construtos_usados.every((c): c is string => typeof c === "string")) return null;
    return { frase: frase.trim(), construtos_usados };
  } catch {
    return null;
  }
}

/** Espera o provedor só até o prazo, mesmo que ele ignore o sinal de aborto. */
async function comPrazo(chamada: (sinal: AbortSignal) => Promise<string>, ms: number): Promise<string> {
  const controle = new AbortController();
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const estouro = new Promise<never>((_, rejeitar) => {
    relogio = setTimeout(() => {
      controle.abort();
      rejeitar(new Prazo());
    }, ms);
  });
  try {
    return await Promise.race([chamada(controle.signal), estouro]);
  } finally {
    clearTimeout(relogio);
  }
}

export async function escreverFrase(
  itens: Item[],
  idioma: Idioma,
  deps: Pick<Dependencias, "glossario" | "provedor" | "prazoMs">,
): Promise<Resposta> {
  const comum = { idioma, ajuda_destacada: ajudaDestacada(itens), versao_prompt: VERSAO_PROMPT };
  const porRegra = (): Resposta => ({ ...comum, origem: "regra", ...comporFrase(itens, idioma, deps.glossario) });

  const provedor = deps.provedor;
  if (!provedor) return porRegra();

  const { sistema, usuario } = montarMensagens(itens, idioma, deps.glossario);
  const fim = Date.now() + (deps.prazoMs ?? PRAZO_PADRAO_MS);
  let violados: Array<Codigo | "V1"> = [];

  for (const tentativa of [1, 2] as const) {
    const restante = fim - Date.now();
    if (restante <= 0) break;
    const mensagem = tentativa === 1 ? usuario : usuario + montarCorrecao(violados);

    let texto: string;
    try {
      texto = await comPrazo((sinal) => provedor.gerar(sistema, mensagem, tentativa, sinal), restante);
    } catch {
      // Prazo, recusa, limite de uso, falha de rede: em todos os casos a pessoa recebe a frase por regra.
      break;
    }

    const lido = lerResposta(texto);
    if (!lido) {
      violados = ["V1"];
      continue;
    }
    const validacao = validarFrase(lido.frase, lido.construtos_usados, itens, idioma, deps.glossario);
    if (validacao.ok) return { ...comum, origem: tentativa === 1 ? "modelo" : "modelo_2", ...lido };
    violados = validacao.codigos;
  }
  return porRegra();
}

/**
 * Lê o corpo até o limite e para. Devolve null se o corpo passar do limite, sem esperar o resto:
 * medir depois de `pedido.text()` deixaria um corpo enorme, ou sem fim, ocupar a memória primeiro.
 */
export async function lerCorpoLimitado(pedido: Request, limite: number): Promise<string | null> {
  const declarado = Number(pedido.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > limite) return null;
  if (!pedido.body) return "";

  const leitor = pedido.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel();
      return null;
    }
    partes.push(value);
  }
  const tudo = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    tudo.set(parte, posicao);
    posicao += parte.byteLength;
  }
  return new TextDecoder().decode(tudo);
}

function lerPedido(texto: string, porId: Map<string, Item>): { itens: Item[]; idioma: Idioma } | null {
  let dado: unknown;
  try {
    dado = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof dado !== "object" || dado === null || Array.isArray(dado)) return null;
  const chaves = Object.keys(dado).sort();
  if (chaves.length !== 2 || chaves[0] !== "idioma" || chaves[1] !== "itens") return null;

  const { idioma, itens } = dado as { idioma: unknown; itens: unknown };
  if (!IDIOMAS.includes(idioma as Idioma)) return null;
  if (!Array.isArray(itens) || itens.length !== 3 || new Set(itens).size !== 3) return null;

  const achados = itens.map((id) => (typeof id === "string" ? porId.get(id) : undefined));
  if (achados.some((i) => i === undefined)) return null;
  return { itens: achados as Item[], idioma: idioma as Idioma };
}

export function criarInterpretar(deps: Dependencias): (pedido: Request) => Promise<Response> {
  const porId = new Map(deps.acervo.map((i) => [i.id, i]));
  const origens = new Set(deps.origens);

  return async (pedido) => {
    const origem = pedido.headers.get("origin");
    const cors: Record<string, string> = { vary: "Origin" };
    // Navegador sempre manda Origin em pedido entre sites. Origem presente e fora da lista é barrada
    // aqui, antes de qualquer trabalho: só deixar de enviar o cabeçalho CORS não impede o gasto.
    if (origem && !origens.has(origem)) {
      return new Response(JSON.stringify({ erro: "origem não autorizada" }), {
        status: 403,
        headers: { vary: "Origin", "content-type": "application/json; charset=utf-8" },
      });
    }
    if (origem) {
      cors["access-control-allow-origin"] = origem;
      cors["access-control-allow-methods"] = "POST, OPTIONS";
      cors["access-control-allow-headers"] = "content-type";
      cors["access-control-max-age"] = "86400";
    }
    const json = (corpo: unknown, status: number) =>
      new Response(JSON.stringify(corpo), {
        status,
        headers: { ...cors, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });

    if (pedido.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (pedido.method !== "POST") return json({ erro: "use POST" }, 405);

    // application/json obriga o navegador a fazer preflight; text/plain passaria sem ele.
    const tipo = (pedido.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (tipo !== "application/json") return json({ erro: "use content-type application/json" }, 415);

    const corpo = await lerCorpoLimitado(pedido, TAMANHO_MAXIMO_DO_CORPO);
    if (corpo === null) return json({ erro: "corpo acima de 1 KB" }, 413);

    const lido = lerPedido(corpo, porId);
    if (!lido) return json({ erro: "pedido fora do contrato: envie { itens: [3 ids distintos do acervo], idioma }" }, 400);

    return json(await escreverFrase(lido.itens, lido.idioma, deps), 200);
  };
}
