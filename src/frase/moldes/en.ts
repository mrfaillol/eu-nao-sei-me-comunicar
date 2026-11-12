import type { Moldes } from "./tipos";

// REVISÃO NATIVA PENDENTE. Escritos em inglês, não traduzidos do português, por um modelo.
// Um redator nativo com formação em psicologia precisa ler antes de qualquer publicação.
// "you" só aparece seguido de verbo do ato de escolher; nenhum "your"; nenhum termo do glossário fora das lacunas.
export const moldes: Moldes = {
  doisTermos: {
    sensivel: {
      pinturas: [
        "The three paintings you gathered show grave scenes, and together they communicate {lista} without softening what the images show.",
      ],
      sons: [
        "The three sounds you gathered point to grave events, and together they communicate {lista} without softening what can be heard.",
      ],
      palavras: [
        "The three words you gathered name grave things plainly, and together they communicate {lista} without softening any of the terms.",
      ],
      mista: [
        "The three signs you gathered are of different kinds and all deal with grave matter, and together they communicate {lista} without softening any of them.",
      ],
    },
    convergente: {
      pinturas: [
        "The three paintings you gathered show the same theme more than once, and that repetition communicates {c1}, with {c2} in the background.",
      ],
      sons: [
        "The three sounds you gathered point to the same theme more than once, like traces of a single scene, and that repetition communicates {c1}, with {c2} in the background.",
      ],
      palavras: [
        "The three words you gathered name the same theme more than once, and that repetition communicates {c1}, with {c2} in the background.",
      ],
      mista: [
        "The three signs you gathered are of different kinds and return to the same theme, and that convergence communicates {c1}, with {c2} in the background.",
      ],
    },
    divergente: {
      pinturas: [
        "The three paintings you gathered show themes that do not repeat, and together they communicate {lista}, with no theme cancelling another.",
      ],
      sons: [
        "The three sounds you gathered point to scenes that do not repeat, and together they communicate {lista}, with no scene cancelling another.",
      ],
      palavras: [
        "The three words you gathered name different things, and together they communicate {lista}, with no name cancelling another.",
      ],
      mista: [
        "The three signs you gathered are of different kinds and deal with different themes, and together they communicate {lista}, with none cancelling another.",
      ],
    },
  },
  umTermo:
    "The three signs you gathered keep returning to the same point, and that insistence communicates {c1} without sharing the message with any other theme.",
  semTermo:
    "You gathered three signs, and together they communicate a message that the collection cannot yet name with a catalogued term.",
  juntar: (termos) => (termos.length <= 2 ? termos.join(" and ") : `${termos.slice(0, -1).join(", ")} and ${termos.at(-1)}`),
};
