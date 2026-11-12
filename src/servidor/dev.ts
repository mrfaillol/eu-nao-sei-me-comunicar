// Monta a função "interpretar" em /api/interpretar no servidor de desenvolvimento do Vite.
// Em produção a mesma função roda na hospedagem escolhida, atrás de um adaptador de poucas linhas.
import { readFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import { indexarGlossario } from "../frase/glossario";
import type { Acervo, Construto } from "../frase/tipos";
import { criarInterpretar } from "./interpretar";
import { escolherProvedor } from "./provedores/anthropic";

const ORIGEM_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

async function lerCorpo(req: IncomingMessage): Promise<string> {
  const partes: Buffer[] = [];
  for await (const parte of req) partes.push(parte as Buffer);
  return Buffer.concat(partes).toString("utf8");
}

async function lerJson<T>(caminho: string): Promise<T> {
  return JSON.parse(await readFile(caminho, "utf8")) as T;
}

export function interpretarEmDesenvolvimento(): Plugin {
  return {
    name: "interpretar-em-desenvolvimento",
    configureServer(servidor) {
      servidor.middlewares.use("/api/interpretar", (req, res) => {
        void (async () => {
          const indice = path.join(servidor.config.root, "public", "indice");
          let acervo: Acervo;
          let lista: Construto[];
          try {
            // Lido a cada pedido: em desenvolvimento o pipeline regrava o índice com o servidor no ar.
            acervo = await lerJson<Acervo>(path.join(indice, "acervo.json"));
            lista = await lerJson<Construto[]>(path.join(indice, "construtos.json"));
          } catch {
            res.statusCode = 503;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ erro: "acervo ausente: rode `uv run python -m acervo montar` em pipeline/" }));
            return;
          }

          const origem = req.headers.origin ?? "";
          const interpretar = criarInterpretar({
            acervo: acervo.itens,
            glossario: indexarGlossario(lista),
            provedor: escolherProvedor(process.env),
            origens: ORIGEM_LOCAL.test(origem) ? [origem] : [],
          });

          const metodo = req.method ?? "GET";
          const cabecalhos = new Headers();
          for (const [nome, valor] of Object.entries(req.headers)) {
            if (typeof valor === "string") cabecalhos.set(nome, valor);
          }
          const resposta = await interpretar(
            new Request("http://localhost/api/interpretar", {
              method: metodo,
              headers: cabecalhos,
              body: metodo === "POST" ? await lerCorpo(req) : undefined,
            }),
          );

          res.statusCode = resposta.status;
          resposta.headers.forEach((valor, nome) => res.setHeader(nome, valor));
          res.end(await resposta.text());
        })().catch(() => {
          res.statusCode = 500;
          res.end();
        });
      });
    },
  };
}
