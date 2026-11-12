import { describe, expect, it } from "vitest";
import en from "../i18n/en.json";
import pt from "../i18n/pt-BR.json";
import zh from "../i18n/zh-CN.json";
import { idiomaInicial, t } from "./i18n";

describe("textos", () => {
  it("os três idiomas têm exatamente as mesmas chaves, todas preenchidas", () => {
    const chaves = Object.keys(pt).sort();
    expect(Object.keys(en).sort()).toEqual(chaves);
    expect(Object.keys(zh).sort()).toEqual(chaves);
    for (const dicionario of [pt, en, zh]) for (const v of Object.values(dicionario)) expect(String(v).trim()).not.toBe("");
  });

  it("guarda os textos do dono literalmente em pt-BR", () => {
    expect(t("titulo", "pt-BR")).toBe("Eu Não Sei Me Comunicar");
    expect(t("janela.pintura", "pt-BR")).toBe("Prefiro Me Explicar Escolhendo Imagens Que Me Despertam…");
    expect(t("janela.som", "pt-BR")).toBe("Prefiro Me Comunicar Ouvindo Sons Que Representem O Que Sinto");
    expect(t("janela.palavra", "pt-BR")).toBe("Prefiro Escolher Palavras Soltas");
    expect(t("titulo", "en")).toBe("I Don't Know How to Communicate");
  });

  it("preenche as variáveis do texto", () => {
    expect(t("bandeja.conta", "pt-BR", { n: 2 })).toBe("2 de 3");
  });

  it("chave que não existe lança erro, para o defeito aparecer no teste e não na tela", () => {
    expect(() => t("inexistente", "en")).toThrow(/inexistente/);
  });
});

describe("idiomaInicial", () => {
  it("lê a preferência do navegador", () => {
    expect(idiomaInicial(["pt-PT"])).toBe("pt-BR");
    expect(idiomaInicial(["zh-TW", "en"])).toBe("zh-CN");
    expect(idiomaInicial(["fr", "de"])).toBe("en");
    expect(idiomaInicial(["fr", "pt-BR"])).toBe("pt-BR");
    expect(idiomaInicial([])).toBe("en");
  });
});
