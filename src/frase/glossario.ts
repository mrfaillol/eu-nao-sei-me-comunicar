import type { Construto, Glossario } from "./tipos";

/** O glossário viaja como lista (data/construtos.json); o código o consulta por id. */
export function indexarGlossario(lista: Construto[]): Glossario {
  const glossario: Glossario = {};
  for (const construto of lista) {
    if (glossario[construto.id]) throw new Error(`construto repetido no glossário: ${construto.id}`);
    glossario[construto.id] = construto;
  }
  return glossario;
}
