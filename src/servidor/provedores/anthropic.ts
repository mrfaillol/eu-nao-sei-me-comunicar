// Provedor Anthropic, pelo SDK oficial.
//
// Escolhas ligadas ao modelo padrão (claude-opus-5-5):
// - não envia `temperature` nem `thinking`: o modelo rejeita amostragem configurada e raciocina sempre;
//   a profundidade é controlada por `effort`, aqui "low", porque a tarefa é uma frase e o prazo é curto;
// - `output_config.format` garante que a resposta é o JSON pedido;
// - `fallbacks: "default"` deixa a API reexecutar em outro modelo se o classificador de segurança
//   declinar. Se ainda assim vier recusa, a função cai na frase por regra.
import Anthropic from "@anthropic-ai/sdk";
import { FalhaDoProvedor, type Provedor } from "./tipos";

export { FalhaDoProvedor };

export const MODELO_PADRAO = "claude-opus-5-5";
/** No gateway o padrão é o modelo mais barato da família: a tarefa é uma frase, e o endereço é público. */
export const MODELO_DO_GATEWAY = "anthropic/claude-haiku-5.5";
const ENDERECO_DO_GATEWAY = "https://ai-gateway.vercel.sh";

const FORMATO_DA_RESPOSTA = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      frase: { type: "string" },
      construtos_usados: { type: "array", items: { type: "string" } },
    },
    required: ["frase", "construtos_usados"],
    additionalProperties: false,
  },
};

function classificar(erro: unknown): FalhaDoProvedor {
  if (erro instanceof FalhaDoProvedor) return erro;
  const opcoes = { cause: erro };
  if (erro instanceof Anthropic.RateLimitError) return new FalhaDoProvedor("limite", "limite de uso atingido", opcoes);
  if (erro instanceof Anthropic.AuthenticationError) return new FalhaDoProvedor("autenticacao", "credencial recusada", opcoes);
  // 403: a credencial existe, mas a conta não tem acesso (no AI Gateway, falta cartão cadastrado na Vercel).
  if (erro instanceof Anthropic.PermissionDeniedError) return new FalhaDoProvedor("autenticacao", "conta sem acesso ao modelo", opcoes);
  if (erro instanceof Anthropic.BadRequestError) return new FalhaDoProvedor("pedido", "pedido rejeitado pela API", opcoes);
  if (erro instanceof Anthropic.APIConnectionError) return new FalhaDoProvedor("conexao", "sem resposta da API", opcoes);
  if (erro instanceof Anthropic.APIError) return new FalhaDoProvedor("api", `erro ${erro.status ?? "?"} da API`, opcoes);
  return new FalhaDoProvedor("api", "falha inesperada no provedor", opcoes);
}

export function criarProvedorAnthropic(modelo: string, cliente: Anthropic): Provedor {
  return {
    nome: `anthropic:${modelo}`,
    async gerar(sistema, usuario, _tentativa, sinal) {
      try {
        const resposta = await cliente.beta.messages.create(
          {
            model: modelo,
            // Teto de custo: o endereço é público e a resposta é uma frase em JSON. 4096 cobre o
            // raciocínio em esforço baixo mais a frase; um teto maior só aumentaria o gasto por abuso.
            max_tokens: 4096,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "low", format: FORMATO_DA_RESPOSTA },
            system: sistema,
            messages: [{ role: "user", content: usuario }],
          },
          // Sem nova tentativa do SDK: o prazo da função é curto e ela já tem a sua segunda tentativa.
          { signal: sinal, maxRetries: 0 },
        );
        if (resposta.stop_reason === "refusal") {
          throw new FalhaDoProvedor("recusa", `o modelo declinou (${resposta.stop_details?.category ?? "sem categoria"})`);
        }
        return resposta.content.flatMap((bloco) => (bloco.type === "text" ? [bloco.text] : [])).join("");
      } catch (erro) {
        throw classificar(erro);
      }
    },
  };
}

/**
 * O mesmo modelo pelo AI Gateway da Vercel, que fala a API de mensagens da Anthropic. Só a parte estável
 * da API: o gateway é um intermediário, e recurso beta ou saída estruturada podem não atravessar.
 * O JSON é pedido no pré-prompt e conferido por quem chama.
 */
export function criarProvedorDoGateway(modelo: string, cliente: Anthropic): Provedor {
  return {
    nome: `gateway:${modelo}`,
    async gerar(sistema, usuario, _tentativa, sinal) {
      try {
        const resposta = await cliente.messages.create(
          // Uma frase e uma explicação curta em JSON cabem com folga; teto baixo limita o gasto por abuso.
          { model: modelo, max_tokens: 700, system: sistema, messages: [{ role: "user", content: usuario }] },
          { signal: sinal, maxRetries: 0 },
        );
        if (resposta.stop_reason === "refusal") throw new FalhaDoProvedor("recusa", "o modelo declinou");
        return resposta.content.flatMap((bloco) => (bloco.type === "text" ? [bloco.text] : [])).join("");
      } catch (erro) {
        throw classificar(erro);
      }
    },
  };
}

/**
 * Decide o provedor. Com chave da Anthropic no ambiente, vai direto. Sem ela, usa o AI Gateway com o
 * token que a Vercel dá à função do próprio projeto (ou com AI_GATEWAY_API_KEY). Sem nenhum dos dois não
 * há modelo, e a função responde pela frase por regra.
 */
export function escolherProvedor(env: Record<string, string | undefined>, tokenDoProjeto?: string): Provedor | null {
  if (env.FRASE_PROVEDOR === "nenhum") return null;
  const chave = env.ANTHROPIC_API_KEY;
  if (chave) return criarProvedorAnthropic(env.FRASE_MODELO ?? MODELO_PADRAO, new Anthropic({ apiKey: chave }));
  const doGateway = env.AI_GATEWAY_API_KEY || tokenDoProjeto;
  if (!doGateway) return null;
  return criarProvedorDoGateway(env.FRASE_MODELO ?? MODELO_DO_GATEWAY, new Anthropic({ apiKey: doGateway, baseURL: ENDERECO_DO_GATEWAY }));
}
