import { describe, expect, it } from "vitest";
import { porExtenso } from "./numero";

describe("porExtenso", () => {
  it("em português concorda em gênero só onde a língua concorda", () => {
    expect(porExtenso(3, "pt-BR", "m")).toBe("três");
    expect(porExtenso(3, "pt-BR", "f")).toBe("três");
    expect(porExtenso(14, "pt-BR", "f")).toBe("catorze");
    expect(porExtenso(21, "pt-BR", "m")).toBe("vinte e um");
    expect(porExtenso(21, "pt-BR", "f")).toBe("vinte e uma");
    expect(porExtenso(32, "pt-BR", "f")).toBe("trinta e duas");
    expect(porExtenso(40, "pt-BR", "m")).toBe("quarenta");
    expect(porExtenso(100, "pt-BR", "m")).toBe("cem");
    expect(porExtenso(101, "pt-BR", "f")).toBe("cento e uma");
    expect(porExtenso(222, "pt-BR", "f")).toBe("duzentas e vinte e duas");
    expect(porExtenso(350, "pt-BR", "m")).toBe("trezentos e cinquenta");
  });

  it("em inglês usa hífen entre dezena e unidade", () => {
    expect(porExtenso(3, "en")).toBe("three");
    expect(porExtenso(12, "en")).toBe("twelve");
    expect(porExtenso(20, "en")).toBe("twenty");
    expect(porExtenso(47, "en")).toBe("forty-seven");
    expect(porExtenso(100, "en")).toBe("one hundred");
    expect(porExtenso(115, "en")).toBe("one hundred and fifteen");
    expect(porExtenso(342, "en")).toBe("three hundred and forty-two");
  });

  it("em mandarim escreve com numerais chineses", () => {
    expect(porExtenso(3, "zh-CN")).toBe("三");
    expect(porExtenso(10, "zh-CN")).toBe("十");
    expect(porExtenso(14, "zh-CN")).toBe("十四");
    expect(porExtenso(20, "zh-CN")).toBe("二十");
    expect(porExtenso(57, "zh-CN")).toBe("五十七");
    expect(porExtenso(100, "zh-CN")).toBe("一百");
    expect(porExtenso(105, "zh-CN")).toBe("一百零五");
    expect(porExtenso(110, "zh-CN")).toBe("一百一十");
    expect(porExtenso(342, "zh-CN")).toBe("三百四十二");
  });

  it("nunca devolve dígito: a frase só aceita letras", () => {
    for (const idioma of ["pt-BR", "en", "zh-CN"] as const) {
      for (let n = 1; n <= 999; n++) expect(porExtenso(n, idioma, "f")).not.toMatch(/\d/);
    }
  });
});
