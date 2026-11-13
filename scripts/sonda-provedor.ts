// Sonda de um provedor compatível: passa seleções reais do acervo pela mesma função que roda em produção
// e conta quantas frases o modelo acerta de primeira, quantas na segunda tentativa e quantas caem na regra.
//
// Uso (a chave vem do ambiente e nunca é impressa):
//   MODELO_URL=... MODELO_CHAVE=... MODELO_NOME=... pnpm exec esbuild scripts/sonda-provedor.ts --bundle \
//     --platform=node --format=esm --outfile=/caminho/sonda.mjs && node /caminho/sonda.mjs [por-idioma] [semente] [prazo-ms]
import { readFileSync } from "node:fs";
import { indexarGlossario } from "../src/frase/glossario";
import type { Construto, Idioma, Item } from "../src/frase/tipos";
import { criarInterpretar } from "../src/servidor/interpretar";
import { configuracaoCompativel, criarProvedorCompativel } from "../src/servidor/provedores/compativel";

const [porIdioma = "4", semente = "7", prazo = "7000"] = process.argv.slice(2);
const configuracao = configuracaoCompativel(process.env);
if (!configuracao) {
  console.error("faltam MODELO_URL (https), MODELO_CHAVE ou MODELO_NOME no ambiente");
  process.exit(2);
}

const ler = <T>(caminho: string) => JSON.parse(readFileSync(caminho, "utf-8")) as T;
const acervo = [...ler<{ itens: Item[] }>("public/indice/acervo.json").itens, ...ler<{ itens: Item[] }>("public/indice/ampliado.json").itens];
const glossario = indexarGlossario(ler<Construto[]>("public/indice/construtos.json"));

// Sorteio com semente: a mesma sonda repete as mesmas seleções em modelos diferentes.
let estado = Number(semente) >>> 0;
const acaso = () => {
  estado = (estado + 0x6d2b79f5) >>> 0;
  let t = estado;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const sortear = <T>(lista: T[], n: number): T[] => {
  const copia = [...lista];
  const saida: T[] = [];
  while (saida.length < n && copia.length) saida.push(copia.splice(Math.floor(acaso() * copia.length), 1)[0]!);
  return saida;
};

const falhas: string[] = [];
const interpretar = criarInterpretar({
  acervo,
  glossario,
  provedor: criarProvedorCompativel(configuracao),
  origens: [],
  prazoMs: Number(prazo),
  aoFalhar: (rotulo) => falhas.push(rotulo),
});

const casos: Array<Record<string, unknown>> = [];
for (const idioma of ["pt-BR", "en", "zh-CN"] as Idioma[]) {
  const pinturas = acervo.filter((i) => i.tipo === "pintura");
  const sons = acervo.filter((i) => i.tipo === "som");
  const palavras = acervo.filter((i) => i.tipo === "palavra" && i.idioma === idioma);
  for (let n = 0; n < Number(porIdioma); n++) {
    // De três a sete signos, sempre com as três janelas presentes.
    const extras = Math.floor(acaso() * 5);
    const itens = [...sortear(pinturas, 1), ...sortear(sons, 1), ...sortear(palavras, 1), ...sortear([...sortear(pinturas, 2), ...sortear(sons, 2), ...sortear(palavras, 2)], extras)];
    const ids = [...new Set(itens.map((i) => i.id))];
    const antes = falhas.length;
    const inicio = Date.now();
    const resposta = await interpretar(new Request("https://sonda.local/api/interpretar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itens: ids, idioma }) }));
    const dado = (await resposta.json()) as { origem?: string; frase?: string; simples?: string };
    casos.push({ idioma, signos: ids.length, origem: dado.origem ?? `http ${resposta.status}`, ms: Date.now() - inicio, falhas: falhas.slice(antes), frase: dado.frase, simples: dado.simples });
    await new Promise((r) => setTimeout(r, 1200)); // gentileza com o limite por minuto dos planos gratuitos
  }
}

const conta = (o: string) => casos.filter((c) => c.origem === o).length;
const tempos = casos.filter((c) => c.origem !== "regra").map((c) => c.ms as number).sort((a, b) => a - b);
console.log(JSON.stringify({ modelo: configuracao.modelo, total: casos.length, de_primeira: conta("modelo"), na_segunda: conta("modelo_2"), por_regra: conta("regra"), mediana_ms: tempos[Math.floor(tempos.length / 2)] ?? null, maior_ms: tempos.at(-1) ?? null, casos }, null, 1));
