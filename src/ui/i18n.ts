import en from "../i18n/en.json";
import ptBR from "../i18n/pt-BR.json";
import zhCN from "../i18n/zh-CN.json";
import type { Idioma } from "../frase/tipos";

const TEXTOS: Record<Idioma, Record<string, string>> = { "pt-BR": ptBR, en, "zh-CN": zhCN };

/** Idioma de partida, a partir das preferências do navegador (navigator.languages). */
export function idiomaInicial(preferencias: readonly string[]): Idioma {
  for (const p of preferencias) {
    const base = p.toLowerCase().split("-")[0];
    if (base === "pt") return "pt-BR";
    if (base === "zh") return "zh-CN";
    if (base === "en") return "en";
  }
  return "en";
}

/** Texto da interface. Chave ausente lança erro: melhor quebrar no teste que mostrar a chave na tela. */
export function t(chave: string, idioma: Idioma, variaveis: Record<string, string | number> = {}): string {
  const texto = TEXTOS[idioma][chave];
  if (texto === undefined) throw new Error(`texto ausente em ${idioma}: ${chave}`);
  return texto.replace(/\{(\w+)\}/g, (_, nome: string) => String(variaveis[nome] ?? `{${nome}}`));
}
