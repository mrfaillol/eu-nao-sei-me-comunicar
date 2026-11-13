// Vídeo de divulgação: uma passada crua pelo site, sem som e sem letreiro, com alguns zooms.
// Uso: node scripts/gravar-demo.mjs [url] [saida.mp4] [semente]
//
// Como funciona:
// 1. Um Chromium sem janela percorre o site como uma pessoa faria. Cada quadro que o navegador pinta é
//    guardado com o instante em que foi pintado (screencast do DevTools), em 2400×1350: o texto sai nítido.
// 2. Nos momentos que valem um olhar de perto, o roteiro anota o instante e o retângulo na tela.
// 3. O ffmpeg junta os quadros em 30 qps e faz a câmera: aproxima de cada retângulo anotado e volta.
//
// A semente fixa o sorteio das opções, para a mesma tomada poder ser repetida.
//
// Ao lado do vídeo fica <saida>.eventos.json: o instante de cada movimento do cursor, clique e aproximação da
// câmera. É a partir dele que scripts/violoncelo.py escreve a trilha, nota por nota.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.argv[2] ?? "https://eunaoseimecomunicar.vercel.app/";
const saida = resolve(process.argv[3] ?? join(raiz, "divulgacao", "eu-nao-sei-me-comunicar.mp4"));
const semente = Number(process.argv[4] ?? 7);
const { chromium } = createRequire(import.meta.url)("@playwright/test");

const TELA = { width: 1600, height: 900 };
const ESCALA = 1.5;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: TELA, deviceScaleFactor: ESCALA, locale: "pt-BR", colorScheme: "dark" });
const page = await contexto.newPage();

// Sorteio com semente (mulberry32) e o cursor de seta, que o navegador sem janela não desenha.
await page.addInitScript((s) => {
  let a = s >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  addEventListener("DOMContentLoaded", () => {
    const seta = document.createElement("div");
    seta.setAttribute("popover", "manual");
    seta.style.cssText = "position:fixed;inset:auto;left:0;top:0;margin:0;padding:0;border:0;background:none;overflow:visible;width:22px;height:30px;pointer-events:none;transition:transform 90ms ease-out";
    seta.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M1 1v23l6-5.5 4 9.5 4-1.7-4-9.3h8.5z" fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.append(seta);
    seta.showPopover();
    let x = 0, y = 0, apertado = false;
    const desenhar = () => (seta.style.transform = `translate(${x}px, ${y}px) scale(${apertado ? 0.86 : 1})`);
    addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; desenhar(); }, true);
    addEventListener("mousedown", () => { apertado = true; desenhar(); }, true);
    addEventListener("mouseup", () => { apertado = false; desenhar(); }, true);
    // Uma caixa de diálogo aberta depois fica por cima: o cursor volta para o topo.
    window.__cursorNoTopo = () => { seta.hidePopover(); seta.showPopover(); };
  });
}, semente);

// ---- captura ----
const pasta = mkdtempSync(join(tmpdir(), "demo-quadros-"));
const quadros = [];
const cdp = await contexto.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const arquivo = join(pasta, `q${String(quadros.length).padStart(5, "0")}.jpg`);
  writeFileSync(arquivo, Buffer.from(data, "base64"));
  quadros.push({ arquivo, t: metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 93, everyNthFrame: 1 });

const marcas = [];
/** Tudo o que se mexe na tela, com o instante: é a partitura bruta da trilha. */
const eventos = [];
const naTela = (x, y) => ({ x: Number((x / TELA.width).toFixed(4)), y: Number((y / TELA.height).toFixed(4)) });
// Com a tela parada o navegador não manda quadro novo: o tempo vem do relógio, não do último quadro.
const agora = () => (quadros.length ? Date.now() / 1000 - quadros[0].t : 0);
/** Anota um momento que merece zoom: o retângulo do elemento e por quanto tempo a câmera fica nele. */
async function marcar(nome, seletor, segura, folga = 0.62) {
  const r = await page.locator(seletor).first().boundingBox();
  if (r) eventos.push({ tipo: "marca", nome, t: agora(), segura });
  if (r) marcas.push({ nome, t: agora(), segura, folga, cx: (r.x + r.width / 2) / TELA.width, cy: (r.y + r.height / 2) / TELA.height, larg: r.width / TELA.width, alt: r.height / TELA.height });
  await dormir(segura * 1000);
}

let mouse = { x: 800, y: 620 };
/** Leva o cursor até o ponto num movimento com aceleração e freio, como mão no mouse. */
async function irPara(x, y, ms = 480) {
  const de = { ...mouse };
  const t0 = agora();
  const passos = Math.max(8, Math.round(ms / 16));
  for (let n = 1; n <= passos; n++) {
    const e = n / passos;
    const s = e * e * (3 - 2 * e);
    await page.mouse.move(de.x + (x - de.x) * s, de.y + (y - de.y) * s);
    await dormir(16);
  }
  mouse = { x, y };
  eventos.push({ tipo: "movimento", t0, t1: agora(), de: naTela(de.x, de.y), para: naTela(x, y) });
}
async function irAte(seletor, n = 0, ms = 480) {
  const r = await page.locator(seletor).nth(n).boundingBox();
  await irPara(r.x + r.width / 2, r.y + r.height / 2, ms);
}
async function clicar(seletor, n = 0, espera = 600, papel = "clique") {
  await irAte(seletor, n);
  await dormir(140);
  eventos.push({ tipo: "clique", papel, t: agora(), ...naTela(mouse.x, mouse.y) });
  await page.mouse.down();
  await dormir(90);
  await page.mouse.up();
  await dormir(espera);
}

// ---- roteiro ----
await page.goto(url, { waitUntil: "load" });
await page.mouse.move(mouse.x, mouse.y);
await page.locator(".moldura").first().waitFor();
await dormir(2500); // o título, e as pinturas chegando perto dos rostos

// A janela das pinturas nasce meio atrás da dos sons: arrasta-se pela barra, como se faz com janela.
const barra = await page.locator('[data-janela="pintura"] .barra').boundingBox();
await irPara(barra.x + 150, barra.y + 18);
eventos.push({ tipo: "clique", papel: "pega", t: agora(), ...naTela(mouse.x, mouse.y) });
await page.mouse.down();
await dormir(120);
await irPara(barra.x + 150 - 176, barra.y + 18 + 26, 760);
eventos.push({ tipo: "clique", papel: "solta", t: agora(), ...naTela(mouse.x, mouse.y) });
await page.mouse.up();
await dormir(500);

// O (i) de uma pintura: as palavras de quem a descreveu.
await irAte(".opcao-pintura .info", 1);
await page.locator(".info-caixa").waitFor();
await marcar("palavras da pintura", ".info-caixa", 2.6);
await clicar(".opcao-pintura .moldura", 1, 900, "escolha");

// Um som: toca (a onda mexe, o vídeo é mudo) e entra na seleção.
await clicar(".opcao-som .tocar", 1, 1200, "tocar");
await clicar(".opcao-som .escolher", 1, 700, "escolha");

// O (i) de uma palavra: o dicionário da própria língua.
await irAte(".opcao-palavra .info", 0);
await page.locator(".info-caixa").waitFor();
await marcar("dicionário", ".info-caixa", 2.8);
await clicar("button.palavra", 0, 800, "escolha");

// Outras três pinturas, mais uma escolha, mais uma palavra: não há teto.
await clicar('[data-janela="pintura"] [data-acao="outras"]', 0, 200, "outras");
// As pinturas novas vêm do servidor do museu: espera abrirem antes de seguir.
await page.waitForFunction(() => [...document.querySelectorAll(".moldura .pintura img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10_000 }).catch(() => {});
await dormir(1700);
await clicar(".opcao-pintura .moldura", 0, 800, "escolha");
await clicar("button.palavra", 1, 700, "escolha");
await irAte('[data-acao="ver-frase"]');
await marcar("escolhas na barra", ".tarefas .escolhas", 1.3, 0.8);

// A frase.
await clicar('[data-acao="ver-frase"]', 0, 0, "ver-frase");
await page.locator('dialog[data-dialogo="resultado"] .frase[data-origem]').waitFor();
eventos.push({ tipo: "frase", t: agora() });
await page.evaluate(() => window.__cursorNoTopo());
await irPara(1320, 300, 500);
await marcar("a frase", 'dialog[data-dialogo="resultado"] .frase', 4.4, 0.78);
// A mesma mensagem em palavras do dia a dia.
await marcar("em palavras simples", 'dialog[data-dialogo="resultado"] .simples', 3.6, 0.8);

// De onde veio cada termo: rola dentro da caixa.
await page.locator('dialog[data-dialogo="resultado"]').evaluate((d) => d.scrollTo({ top: 250, behavior: "smooth" }));
eventos.push({ tipo: "rolagem", t: agora() - 0.05, dura: 0.9 });
await dormir(900);
await marcar("procedência", 'dialog[data-dialogo="resultado"] .termos', 2.2, 0.8);

// Fecha, e o autor assina no canto.
eventos.push({ tipo: "fecha", t: agora() });
await page.keyboard.press("Escape");
await dormir(500);
await irAte(".tarefas .autoria a", 0, 800);
await marcar("assinatura", ".tarefas .autoria", 3.0, 0.2);
await dormir(300);

const fimDaTomada = agora();
await cdp.send("Page.stopScreencast");
await dormir(200);
const fraseFinal = await page.locator('dialog[data-dialogo="resultado"] .frase').textContent().catch(() => "");
await navegador.close();

// ---- montagem ----
const t0 = quadros[0].t;
const fim = fimDaTomada;
const lista = ["ffconcat version 1.0"];
quadros.forEach((q, n) => {
  const dura = (n + 1 < quadros.length ? quadros[n + 1].t : t0 + fim) - q.t;
  lista.push(`file '${q.arquivo}'`, `duration ${Math.max(dura, 0.001).toFixed(4)}`);
});
lista.push(`file '${quadros.at(-1).arquivo}'`);
const concat = join(pasta, "quadros.txt");
writeFileSync(concat, lista.join("\n"));

// Câmera: do plano inteiro para cada marca (0,8 s de ida), fica, e volta ou segue para a próxima.
const IDA = 0.8;
const pontos = [{ t: 0, z: 1, cx: 0.5, cy: 0.5 }];
marcas.forEach((m, n) => {
  const z = Math.min(2.4, Math.max(1.2, m.folga / Math.max(m.larg, m.alt * 1.0)));
  const meio = (v) => Math.min(1 - 0.5 / z, Math.max(0.5 / z, v));
  const alvo = { z, cx: meio(m.cx), cy: meio(m.cy) };
  const chegada = m.t + IDA;
  const saidaDaMarca = m.t + m.segura - 0.15;
  pontos.push({ t: m.t, ...pontos.at(-1), t: m.t }, { t: chegada, ...alvo }, { t: saidaDaMarca, ...alvo });
  const proxima = marcas[n + 1];
  // Se a próxima marca vem logo, a câmera vai direto de uma para a outra; senão, volta ao plano inteiro.
  if (!proxima || proxima.t - saidaDaMarca > IDA + 0.3) pontos.push({ t: saidaDaMarca + IDA, z: 1, cx: 0.5, cy: 0.5 });
});
pontos.sort((a, b) => a.t - b.t);

function curva(campo) {
  let expr = String(pontos.at(-1)[campo].toFixed(5));
  for (let n = pontos.length - 2; n >= 0; n--) {
    const a = pontos[n], b = pontos[n + 1];
    if (b.t - a.t < 0.001) continue;
    const e = `((it-${a.t.toFixed(3)})/${(b.t - a.t).toFixed(3)})`;
    const trecho = a[campo] === b[campo] ? a[campo].toFixed(5) : `(${a[campo].toFixed(5)}+(${(b[campo] - a[campo]).toFixed(5)})*${e}*${e}*(3-2*${e}))`;
    expr = `if(lt(it,${b.t.toFixed(3)}),${trecho},${expr})`;
  }
  return expr;
}
const z = curva("z");
const filtro = [
  "fps=30",
  `zoompan=z='${z}':x='(${curva("cx")})*iw-iw/zoom/2':y='(${curva("cy")})*ih-ih/zoom/2':d=1:s=1920x1080:fps=30`,
  `fade=t=out:st=${(fim - 0.5).toFixed(2)}:d=0.5`,
  // Os quadros são JPEG, de faixa cheia. Redes sociais esperam a faixa de vídeo: sem isto o preto sai lavado em alguns tocadores.
  "scale=in_range=pc:out_range=tv",
  "format=yuv420p",
].join(",");

mkdirSync(dirname(saida), { recursive: true });
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", concat, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-vf", filtro, "-t", fim.toFixed(2), "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-color_range", "tv", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", saida], { stdio: "inherit" });
rmSync(pasta, { recursive: true, force: true });
writeFileSync(saida.replace(/\.mp4$/, "") + ".eventos.json", JSON.stringify({ url, semente, fim: Number(fim.toFixed(3)), ida_da_camera: IDA, eventos: eventos.map((e) => Object.fromEntries(Object.entries(e).map(([k, v]) => [k, typeof v === "number" ? Number(v.toFixed(4)) : v]))) }, null, 1));

console.log(JSON.stringify({ saida, segundos: Number(fim.toFixed(1)), quadros: quadros.length, qps: Number((quadros.length / fim).toFixed(1)), marcas: marcas.map((m) => `${m.nome} @${m.t.toFixed(1)}s`), frase: fraseFinal }, null, 1));
