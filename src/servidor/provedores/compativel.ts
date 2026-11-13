// Provedor para qualquer serviço que fale o formato chat/completions (Command Code, OpenRouter e outros).
//
// Existe para ligar um modelo que não é da Anthropic com uma chave que a pessoa já tem. Só o que todo
// serviço desse formato aceita: sistema, usuário, modelo e teto de saída. O JSON é pedido no pré-prompt e
// conferido por quem chama, porque modo JSON e saída estruturada variam de serviço para serviço.
import { FalhaDoProvedor, type Provedor, type TipoDeFalha } from "./tipos";

export interface OpcoesDoCompativel {
  /** Endereço base, até o `/v1` (ex.: https://api.commandcode.ai/provider/v1). */
  endereco: string;
  chave: string;
  modelo: string;
  /** Campos a mais no corpo do pedido, para o que só um serviço entende (ex.: desligar o raciocínio no OpenRouter). */
  extra?: Record<string, unknown>;
  /** Teto de tokens de saída. Modelo que raciocina precisa de mais que o padrão, porque gasta saída pensando. */
  teto?: number;
  buscar?: typeof fetch;
}

/** Modelos abertos de raciocínio às vezes escrevem o rascunho antes da resposta, entre estas marcas. */
const RACIOCINIO = /^\s*<think>[\s\S]*?<\/think>\s*/i;

// Uma frase e uma explicação curta em JSON cabem com folga em 700; teto baixo limita o gasto por abuso.
const TETO_PADRAO = 700;
const TETO_MINIMO = 200;
const TETO_MAXIMO = 4096;

function tipoPorStatus(status: number): TipoDeFalha {
  if (status === 401 || status === 403) return "autenticacao";
  if (status === 429) return "limite";
  if (status >= 400 && status < 500) return "pedido";
  return "api";
}

export function criarProvedorCompativel({ endereco, chave, modelo, extra = {}, teto = TETO_PADRAO, buscar = fetch }: OpcoesDoCompativel): Provedor {
  const url = `${endereco.replace(/\/+$/, "")}/chat/completions`;
  return {
    nome: `compativel:${modelo}`,
    async gerar(sistema, usuario, _tentativa, sinal) {
      let resposta: Response;
      try {
        resposta = await buscar(url, {
          method: "POST",
          signal: sinal,
          headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
          // Os campos extras vão primeiro: modelo, teto e mensagens são desta função e não se trocam por configuração.
          body: JSON.stringify({
            ...extra,
            model: modelo,
            max_tokens: teto,
            messages: [
              { role: "system", content: sistema },
              { role: "user", content: usuario },
            ],
          }),
        });
      } catch (erro) {
        throw new FalhaDoProvedor("conexao", "sem resposta da API", { cause: erro });
      }
      // O corpo de erro do serviço não entra na mensagem: pode repetir a chave ou o pedido.
      if (!resposta.ok) throw new FalhaDoProvedor(tipoPorStatus(resposta.status), `erro ${resposta.status} da API`);
      let dado: unknown;
      try {
        dado = await resposta.json();
      } catch (erro) {
        throw new FalhaDoProvedor("api", "resposta que não é JSON", { cause: erro });
      }
      const texto = (dado as { choices?: Array<{ message?: { content?: unknown } }> } | null)?.choices?.[0]?.message?.content;
      if (typeof texto !== "string" || !texto.trim()) throw new FalhaDoProvedor("api", "resposta sem texto");
      return texto.replace(RACIOCINIO, "");
    },
  };
}

/**
 * As variáveis do provedor compatível, ou null se faltar uma das três obrigatórias, se o endereço não for https
 * ou se MODELO_EXTRA não for um objeto JSON. Configuração torta desliga o provedor em vez de valer pela metade.
 */
export function configuracaoCompativel(env: Record<string, string | undefined>): { endereco: string; chave: string; modelo: string; extra: Record<string, unknown>; teto: number } | null {
  const { MODELO_URL: endereco, MODELO_CHAVE: chave, MODELO_NOME: modelo } = env;
  if (!endereco || !chave || !modelo || !endereco.startsWith("https://")) return null;
  let extra: unknown = {};
  if (env.MODELO_EXTRA) {
    try {
      extra = JSON.parse(env.MODELO_EXTRA);
    } catch {
      return null;
    }
  }
  if (typeof extra !== "object" || extra === null || Array.isArray(extra)) return null;
  const pedido = /^\d+$/.test(env.MODELO_TETO ?? "") ? Number(env.MODELO_TETO) : TETO_PADRAO;
  const teto = pedido >= TETO_MINIMO && pedido <= TETO_MAXIMO ? pedido : TETO_PADRAO;
  return { endereco, chave, modelo, extra: extra as Record<string, unknown>, teto };
}
