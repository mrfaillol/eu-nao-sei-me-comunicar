// Pede a frase. Sem endereço de função, ou se a função falhar ou demorar, a frase é composta aqui
// mesmo, pela mesma regra que o servidor usa como rede de segurança. A pessoa sempre recebe uma frase.
import { ajudaDestacada } from "../frase/ajuda";
import { comporFrase } from "../frase/compositor";
import { VERSAO_PROMPT } from "../frase/prompt";
import type { Glossario, Idioma, Item } from "../frase/tipos";
import type { Resposta } from "../servidor/interpretar";

export interface DependenciasDoPedido {
  buscar: typeof fetch;
  /** Endereço da função (VITE_API_BASE). Nulo: modo de demonstração, tudo no aparelho. */
  base: string | null;
  acervo: Item[];
  glossario: Glossario;
  prazoMs?: number;
}

const PRAZO_PADRAO_MS = 8000;
const emAndamento = new Map<string, Promise<Resposta>>();

function porRegra(itens: Item[], idioma: Idioma, glossario: Glossario): Resposta {
  return {
    ...comporFrase(itens, idioma, glossario),
    idioma,
    origem: "regra",
    ajuda_destacada: ajudaDestacada(itens),
    versao_prompt: VERSAO_PROMPT,
  };
}

function ehResposta(dado: unknown): dado is Resposta {
  if (typeof dado !== "object" || dado === null) return false;
  const d = dado as Record<string, unknown>;
  return (
    typeof d.frase === "string" &&
    d.frase.trim() !== "" &&
    Array.isArray(d.construtos_usados) &&
    d.construtos_usados.every((c) => typeof c === "string") &&
    (d.origem === "modelo" || d.origem === "modelo_2" || d.origem === "regra")
  );
}

async function daFuncao(ids: string[], idioma: Idioma, deps: DependenciasDoPedido): Promise<Resposta | null> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), deps.prazoMs ?? PRAZO_PADRAO_MS);
  try {
    const resposta = await deps.buscar(`${deps.base}/api/interpretar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itens: ids, idioma }),
      signal: controle.signal,
    });
    if (!resposta.ok) return null;
    const dado: unknown = await resposta.json();
    return ehResposta(dado) ? { ...dado, idioma, ajuda_destacada: Boolean(dado.ajuda_destacada) } : null;
  } catch {
    return null; // sem rede, prazo estourado, corpo que não é JSON
  } finally {
    clearTimeout(relogio);
  }
}

export function pedirFrase(ids: string[], idioma: Idioma, deps: DependenciasDoPedido): Promise<Resposta> {
  const chave = `${[...ids].sort().join("|")}|${idioma}`;
  const jaPedida = emAndamento.get(chave);
  if (jaPedida) return jaPedida; // toque duplo: um pedido só

  const itens = ids.flatMap((id) => deps.acervo.find((i) => i.id === id) ?? []);
  const promessa = (async () => {
    const daRede = deps.base ? await daFuncao(ids, idioma, deps) : null;
    return daRede ?? porRegra(itens, idioma, deps.glossario);
  })().finally(() => emAndamento.delete(chave));
  emAndamento.set(chave, promessa);
  return promessa;
}
