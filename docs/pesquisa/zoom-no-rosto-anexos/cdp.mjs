// Abre a página de teste num Chrome sem interface, espera em tempo real e lê o resultado.
// Uso: node cdp.mjs <url> <porta> [flags extras do Chrome...]
import { spawn } from 'node:child_process';
const [url, porta, ...extras] = process.argv.slice(2);
const perfil = process.env.PERFIL;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${perfil}`,
  `--remote-debugging-port=${porta}`, '--window-size=1400,1400', ...extras, url,
], { stdio: 'ignore' });
const dorme = ms => new Promise(r => setTimeout(r, ms));
try {
  let alvo;
  for (let i = 0; i < 40 && !alvo; i++) {
    await dorme(250);
    try { alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find(t => t.type === 'page' && t.url.startsWith('file:')); } catch {}
  }
  if (!alvo) throw new Error('página não encontrada');
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((ok, erro) => { ws.onopen = ok; ws.onerror = erro; });
  const expr = `new Promise(r => { const t0 = Date.now(); const ver = () => { const s = document.getElementById('saida').textContent; if (s !== 'aguardando' || Date.now() - t0 > 8000) r(s); else setTimeout(ver, 100); }; ver(); })`;
  const resp = await new Promise(ok => { ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === 1) ok(m); }; ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })); });
  console.log(resp.result?.result?.value ?? JSON.stringify(resp));
  ws.close();
} finally { chrome.kill(); }
