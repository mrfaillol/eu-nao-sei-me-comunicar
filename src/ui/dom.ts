type Filho = Node | string | null | undefined | false;

/** Cria um elemento. Texto entra sempre como nó de texto, nunca como HTML: o acervo traz texto de terceiros. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  atributos: Record<string, string | number | boolean | null | undefined> = {},
  ...filhos: Filho[]
): HTMLElementTagNameMap[K] {
  const no = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    no.setAttribute(nome, valor === true ? "" : String(valor));
  }
  for (const filho of filhos) if (filho) no.append(filho);
  return no;
}
