// A função "interpretar" na Vercel. O site continua estático; só este endereço roda em servidor, para
// pedir a frase a um modelo de linguagem. Sem token do projeto (ou com o limite estourado, ou com o
// modelo fora do ar), ele responde com a frase por regra, a mesma que o navegador comporia sozinho.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { indexarGlossario } from "../frase/glossario";
import type { Acervo, Construto } from "../frase/tipos";
import { criarInterpretar } from "./interpretar";
import { criarLimite, criarPausaPorChave } from "./limite";
import { escolherProvedor } from "./provedores/anthropic";

// Os índices são copiados para a pasta da função no build (scripts/saida-vercel.mjs).
const ler = <T>(nome: string): T => JSON.parse(readFileSync(new URL(`./${nome}`, import.meta.url), "utf8")) as T;
const acervo = [...ler<Acervo>("acervo.json").itens, ...ler<Acervo>("ampliado.json").itens];
const glossario = indexarGlossario(ler<Construto[]>("construtos.json"));

const SITE = "https://eunaoseimecomunicar.vercel.app";
const LIMITE_DO_CORPO = 16 * 1024;
// Uma pessoa pede uma frase a cada tanto; seis por minuto cobre quem está explorando. O teto por hora
// segura o gasto se muita gente (ou um robô com vários endereços) chegar ao mesmo tempo.
const limite = criarLimite({ porVisitantePorMinuto: 6, totalPorHora: 400 });
// Credencial recusada: dez minutos pela regra antes de tentar de novo. A pausa é por credencial, guardada
// pelo resumo dela, para um token falso mandado por alguém não pausar o modelo de todo mundo.
const pausas = criarPausaPorChave({ ms: 10 * 60_000, maximo: 32 });

async function lerCorpo(req: IncomingMessage): Promise<string | null> {
  if (Number(req.headers["content-length"]) > LIMITE_DO_CORPO) return null;
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req) {
    total += (parte as Buffer).byteLength;
    if (total > LIMITE_DO_CORPO) {
      req.destroy();
      return null;
    }
    partes.push(parte as Buffer);
  }
  return Buffer.concat(partes).toString("utf8");
}

const um = (valor: string | string[] | undefined): string => (Array.isArray(valor) ? (valor[0] ?? "") : (valor ?? ""));

export default async function interpretarNaVercel(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const metodo = req.method ?? "GET";
    const corpo = metodo === "POST" ? await lerCorpo(req) : undefined;
    if (corpo === null) {
      res.statusCode = 413;
      res.end();
      return;
    }
    const anfitriao = um(req.headers.host);
    // O token que a Vercel entrega à função do próprio projeto. É ele que autentica no AI Gateway: não há chave guardada.
    const token = um(req.headers["x-vercel-oidc-token"]) || process.env.VERCEL_OIDC_TOKEN;
    const credencial = createHash("sha256").update(token ?? process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "").digest("hex");
    const visitante = um(req.headers["x-real-ip"]) || um(req.headers["x-forwarded-for"]).split(",")[0]!.trim() || "desconhecido";

    const interpretar = criarInterpretar({
      acervo,
      glossario,
      provedor: escolherProvedor(process.env, token),
      origens: [SITE, `https://${anfitriao}`, "capacitor://localhost", "https://localhost"],
      podeChamarModelo: () => !pausas.ativa(credencial) && limite.permitir(visitante),
      aoFalhar: (rotulo) => {
        console.warn(`[interpretar] caminho do modelo falhou: ${rotulo}`);
        if (rotulo === "autenticacao") pausas.acionar(credencial);
      },
    });

    const cabecalhos = new Headers();
    for (const [nome, valor] of Object.entries(req.headers)) {
      // O token do projeto não segue adiante: a função só precisa dele para criar o provedor.
      if (typeof valor === "string" && nome !== "x-vercel-oidc-token") cabecalhos.set(nome, valor);
    }
    const resposta = await interpretar(new Request(`https://${anfitriao || "localhost"}/api/interpretar`, { method: metodo, headers: cabecalhos, body: corpo }));
    res.statusCode = resposta.status;
    resposta.headers.forEach((valor, nome) => res.setHeader(nome, valor));
    res.setHeader("cache-control", "no-store");
    res.end(await resposta.text());
  } catch {
    res.statusCode = 500;
    res.end();
  }
}
