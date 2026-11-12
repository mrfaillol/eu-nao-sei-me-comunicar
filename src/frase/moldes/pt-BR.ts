import type { Moldes } from "./tipos";

// Regras de escrita destes moldes:
// - a lacuna nunca vem depois de preposição que contrai com artigo (de, em, a, por);
// - "você" só aparece seguido de verbo do ato de escolher; nenhum possessivo;
// - nenhuma palavra do glossário fora das lacunas; nenhuma maiúscula no meio da frase.
export const moldes: Moldes = {
  doisTermos: {
    sensivel: {
      pinturas: [
        "As {n} imagens que você reuniu mostram cenas graves, e essa soma comunica {lista} sem atenuar o que as imagens mostram.",
      ],
      sons: [
        "Os {n} sons que você reuniu apontam para acontecimentos graves, e essa soma comunica {lista} sem atenuar o que se ouve.",
      ],
      palavras: [
        "As {n} palavras que você reuniu nomeiam coisas graves sem rodeio, e essa soma comunica {lista} sem atenuar nenhum dos nomes.",
      ],
      mista: [
        "Os {n} signos que você reuniu são de naturezas diferentes e tratam de matéria grave, e essa soma comunica {lista} sem atenuar nenhum deles.",
      ],
    },
    convergente: {
      pinturas: [
        "As {n} imagens que você reuniu mostram por semelhança o mesmo tema mais de uma vez, e essa repetição comunica {c1}, com {c2} ao fundo.",
      ],
      sons: [
        "Os {n} sons que você reuniu apontam mais de uma vez para o mesmo tema, como vestígios de uma mesma cena, e essa repetição comunica {c1}, com {c2} ao fundo.",
      ],
      palavras: [
        "As {n} palavras que você reuniu nomeiam mais de uma vez o mesmo tema, e essa repetição comunica {c1}, com {c2} ao fundo.",
      ],
      mista: [
        "Os {n} signos que você reuniu são de naturezas diferentes e voltam ao mesmo tema, e essa convergência comunica {c1}, com {c2} ao fundo.",
      ],
    },
    divergente: {
      pinturas: [
        "As {n} imagens que você reuniu mostram temas que não se repetem, e a soma delas comunica {lista}, sem que um tema anule outro.",
      ],
      sons: [
        "Os {n} sons que você reuniu apontam para cenas que não se repetem, e a soma deles comunica {lista}, sem que uma cena anule outra.",
      ],
      palavras: [
        "As {n} palavras que você reuniu nomeiam coisas distintas, e a soma delas comunica {lista}, sem que um nome anule outro.",
      ],
      mista: [
        "Os {n} signos que você reuniu são de naturezas diferentes e tratam de temas distintos, e a soma deles comunica {lista}, sem que um anule outro.",
      ],
    },
  },
  umTermo:
    "Os {n} signos que você reuniu voltam sempre ao mesmo ponto, e essa insistência comunica {c1} sem dividir a mensagem com outro tema.",
  semTermo:
    "Você reuniu {n} signos, e a soma deles comunica uma mensagem que o acervo ainda não sabe nomear com um termo catalogado.",
  juntar: (termos) => (termos.length <= 2 ? termos.join(" e ") : `${termos.slice(0, -1).join(", ")} e ${termos.at(-1)}`),
};
