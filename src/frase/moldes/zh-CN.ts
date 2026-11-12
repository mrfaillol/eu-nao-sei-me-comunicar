import type { Moldes } from "./tipos";

// REVISÃO NATIVA PENDENTE. Escritos em chinês simplificado, não traduzidos do português, por um modelo.
// Um redator nativo com formação em psicologia precisa ler antes de qualquer publicação.
// 你 só aparece seguido de 选的; sem 您, sem palavra latina, sem termo do glossário fora das lacunas.
export const moldes: Moldes = {
  doisTermos: {
    sensivel: {
      pinturas: ["你选的{n}幅画展示的都是沉重的场面，{todos}合在一起传达的是{lista}，没有淡化画面所展示的内容。"],
      sons: ["你选的{n}个声音指向的都是沉重的事件，{todos}合在一起传达的是{lista}，没有淡化其中能够听到的内容。"],
      palavras: ["你选的{n}个词直接说出了沉重的事情，{todos}合在一起传达的是{lista}，没有淡化其中任何一个词的分量。"],
      mista: ["你选的{n}个符号种类不同，谈的却都是沉重的事情，{todos}合在一起传达的是{lista}，没有淡化其中任何一个。"],
    },
    convergente: {
      pinturas: ["你选的{n}幅画不止一次展示了同一个主题，这种重复传达的是{c1}，{c2}则处在这一主题的背景之中。"],
      sons: ["你选的{n}个声音不止一次指向同一个主题，像是同一场景留下的痕迹，这种重复传达的是{c1}，{c2}则处在背景之中。"],
      palavras: ["你选的{n}个词不止一次说出了同一个主题，这种重复传达的是{c1}，{c2}则处在这一主题的背景之中。"],
      mista: ["你选的{n}个符号种类不同，却都回到同一个主题，这种汇合传达的是{c1}，{c2}则处在这一主题的背景之中。"],
    },
    divergente: {
      pinturas: ["你选的{n}幅画展示的主题各不相同，{todos}合在一起传达的是{lista}，这些主题并存而互不抵消。"],
      sons: ["你选的{n}个声音指向的场景各不相同，{todos}合在一起传达的是{lista}，这些场景并存而互不抵消。"],
      palavras: ["你选的{n}个词说的是不同的事情，{todos}合在一起传达的是{lista}，这些说法并存而互不抵消。"],
      mista: ["你选的{n}个符号种类不同，主题也各不相同，{todos}合在一起传达的是{lista}，它们并存而互不抵消。"],
    },
  },
  umTermo: "你选的{n}个符号反复回到同一个地方，这种坚持传达的是{c1}，整条信息没有分给别的主题。",
  semTermo: "你选的{n}个符号合在一起传达了一条信息，只是这份收藏里还没有一个编目过的术语可以称呼它。",
  juntar: (termos) => (termos.length <= 2 ? termos.join("与") : `${termos.slice(0, -1).join("、")}与${termos.at(-1)}`),
};
