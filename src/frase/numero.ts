// Número por extenso, de 1 a 999, nos três idiomas. A frase não aceita dígito (regra V2 do validador),
// e a seleção não tem teto: "os catorze signos que você reuniu" precisa sair em letras.
import type { Idioma } from "./tipos";

export type Genero = "m" | "f";

const PT_ATE_19 = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const PT_DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const PT_CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ptUnidade(n: number, genero: Genero): string {
  if (genero === "f" && n === 1) return "uma";
  if (genero === "f" && n === 2) return "duas";
  return PT_ATE_19[n]!;
}

function pt(n: number, genero: Genero): string {
  if (n === 100) return "cem";
  const partes: string[] = [];
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  if (centena > 0) partes.push(genero === "f" && centena >= 2 ? PT_CENTENAS[centena]!.replace(/os$/, "as") : PT_CENTENAS[centena]!);
  if (resto > 0 && resto < 20) partes.push(ptUnidade(resto, genero));
  if (resto >= 20) {
    partes.push(PT_DEZENAS[Math.floor(resto / 10)]!);
    if (resto % 10 > 0) partes.push(ptUnidade(resto % 10, genero));
  }
  return partes.join(" e ");
}

const EN_ATE_19 = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_DEZENAS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enAte99(n: number): string {
  if (n < 20) return EN_ATE_19[n]!;
  const unidade = n % 10;
  return unidade === 0 ? EN_DEZENAS[n / 10]! : `${EN_DEZENAS[Math.floor(n / 10)]}-${EN_ATE_19[unidade]}`;
}

function en(n: number): string {
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  if (centena === 0) return enAte99(resto);
  return resto === 0 ? `${EN_ATE_19[centena]} hundred` : `${EN_ATE_19[centena]} hundred and ${enAte99(resto)}`;
}

const ZH = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

function zh(n: number): string {
  const centena = Math.floor(n / 100);
  const dezena = Math.floor((n % 100) / 10);
  const unidade = n % 10;
  let texto = "";
  if (centena > 0) texto += `${ZH[centena]}百`;
  if (dezena > 0) texto += centena === 0 && dezena === 1 ? "十" : `${ZH[dezena]}十`;
  else if (centena > 0 && unidade > 0) texto += "零";
  if (unidade > 0) texto += ZH[unidade];
  return texto;
}

/** `n` por extenso. Fora de 1 a 999 não há seleção possível, e a função recusa em vez de inventar. */
export function porExtenso(n: number, idioma: Idioma, genero: Genero = "m"): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) throw new RangeError(`porExtenso: ${n} fora de 1 a 999`);
  if (idioma === "pt-BR") return pt(n, genero);
  return idioma === "en" ? en(n) : zh(n);
}
