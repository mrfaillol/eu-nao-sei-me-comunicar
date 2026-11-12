import { describe, expect, it } from "vitest";
import type { Item } from "../frase/tipos";
import { criarAcervoVivo } from "./acervo-vivo";

function item(id: string, tipo: Item["tipo"], arquivo: string | null): Item {
  return { id, tipo, classe_semiotica: "icone", idioma: null, rotulo: id, texto_humano: "t", origem_do_texto: "curadoria", construtos: ["nostalgia"], tema_sensivel: false, afeto: { metodo: "ausente" }, credito: { autor: "", linha: "l", fonte: "cma", licenca: "CC0-1.0", url: "https://exemplo.test" }, revisao: { humana: "pendente", por: null, em: null }, midia: arquivo === null ? null : tipo === "som" ? { arquivo, duracao_ms: 3000 } : { arquivo, largura: 10, altura: 10 } };
}

const nucleo = [item("p1", "pintura", "midia/pinturas/1.webp"), item("s1", "som", "midia/sons/1.mp3"), item("w1", "palavra", null)];
const remotas = Array.from({ length: 5 }, (_, n) => item(`r${n}`, "pintura", `https://openaccess-cdn.clevelandart.org/${n}.jpg`));
const somRemoto = item("rs", "som", "https://cdn.freesound.org/previews/1.mp3");

describe("acervo vivo", () => {
  it("começa só com o núcleo, e o ampliado entra quando chega", () => {
    const vivo = criarAcervoVivo(nucleo, () => true);
    expect(vivo.disponiveis().map((i) => i.id)).toEqual(["p1", "s1", "w1"]);
    vivo.ampliar([...remotas, somRemoto]);
    expect(vivo.disponiveis()).toHaveLength(9);
    expect(vivo.item("r3")?.id).toBe("r3");
  });

  it("sem rede oferece só o que tem mídia no aparelho, mas ainda reconhece o que já foi escolhido", () => {
    let emRede = true;
    const vivo = criarAcervoVivo(nucleo, () => emRede);
    vivo.ampliar(remotas);
    emRede = false;
    expect(vivo.disponiveis().map((i) => i.id)).toEqual(["p1", "s1", "w1"]);
    expect(vivo.item("r0")?.id).toBe("r0");
  });

  it("item cuja mídia remota falhou deixa de ser oferecido", () => {
    const vivo = criarAcervoVivo(nucleo, () => true);
    vivo.ampliar([...remotas, somRemoto]);
    vivo.falhou("r1");
    expect(vivo.disponiveis().some((i) => i.id === "r1")).toBe(false);
    expect(vivo.disponiveis()).toHaveLength(8);
  });

  it("três falhas seguidas num tipo desligam o remoto daquele tipo: a origem está fora do ar", () => {
    const vivo = criarAcervoVivo(nucleo, () => true);
    vivo.ampliar([...remotas, somRemoto]);
    for (const id of ["r0", "r1", "r2"]) vivo.falhou(id);
    expect(vivo.disponiveis().filter((i) => i.tipo === "pintura").map((i) => i.id)).toEqual(["p1"]);
    expect(vivo.disponiveis().some((i) => i.id === "rs")).toBe(true); // os sons seguem
  });

  it("falha num item do núcleo não o retira: a mídia dele está no aparelho", () => {
    const vivo = criarAcervoVivo(nucleo, () => true);
    vivo.falhou("p1");
    expect(vivo.disponiveis().some((i) => i.id === "p1")).toBe(true);
  });

  it("não aceita no ampliado um item que repete id do núcleo", () => {
    const vivo = criarAcervoVivo(nucleo, () => true);
    vivo.ampliar([item("p1", "pintura", "https://openaccess-cdn.clevelandart.org/x.jpg"), remotas[0]!]);
    expect(vivo.disponiveis().filter((i) => i.id === "p1")).toHaveLength(1);
    expect(vivo.item("p1")?.midia).toEqual({ arquivo: "midia/pinturas/1.webp", largura: 10, altura: 10 });
  });
});
