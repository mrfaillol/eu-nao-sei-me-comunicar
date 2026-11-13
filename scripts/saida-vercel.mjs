// Monta .vercel/output (Build Output API v3) depois do `vite build`: o site estático de dist/ e a função
// /api/interpretar empacotada num arquivo só, com os índices ao lado. Uso: pnpm build:vercel
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const saida = join(raiz, ".vercel", "output");
const funcao = join(saida, "functions", "api", "interpretar.func");

rmSync(saida, { recursive: true, force: true });
mkdirSync(funcao, { recursive: true });
cpSync(join(raiz, "dist"), join(saida, "static"), { recursive: true });

await build({
  entryPoints: [join(raiz, "src", "servidor", "vercel.ts")],
  outfile: join(funcao, "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // Dependência em CommonJS dentro de um pacote ESM pede `require`: o pacote não o define sozinho.
  banner: { js: "import { createRequire as __criarRequire } from 'node:module'; const require = __criarRequire(import.meta.url);" },
  logLevel: "warning",
});
for (const indice of ["acervo.json", "ampliado.json", "construtos.json"]) cpSync(join(raiz, "public", "indice", indice), join(funcao, indice));
writeFileSync(join(funcao, ".vc-config.json"), JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, maxDuration: 30 }, null, 2));

// Os mesmos cabeçalhos que o vercel.json declarava: com a saída pronta, quem vale é este arquivo.
const seguranca = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY" };
writeFileSync(
  join(saida, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/(.*)", headers: seguranca, continue: true },
        { src: "/assets/(.*)", headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
        { src: "/(sw.js|registerSW.js|manifest.webmanifest)", headers: { "Cache-Control": "no-cache" }, continue: true },
        { handle: "filesystem" },
      ],
    },
    null,
    2,
  ),
);
console.log(`saída da Vercel em ${saida}`);
