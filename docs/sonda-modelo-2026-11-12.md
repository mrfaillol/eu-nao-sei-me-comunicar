# Sonda do modelo com o pré-prompt que pede a versão simples

12 de novembro de 2026. Pré-prompt na versão `2026-11-12.3`.

## O que foi medido

Dez seleções sorteadas do acervo real (núcleo e ampliado), de 3 a 8 itens, em português, inglês e mandarim. Cada pedido foi montado por `montarMensagens`, como a função faz, e respondido por um modelo Haiku num subagente da sessão de desenvolvimento. As respostas passaram pelo caminho de conferência da função (`escreverFrase`): o validador inteiro na frase e as regras V6, V7, V8 e V10 mais o teto de tamanho na versão simples.

**O que isto não é:** uma medição da função em produção. No dia, o AI Gateway da Vercel recusou o projeto com `403 customer_verification_required` (falta cartão na conta), e nenhuma chamada real chegou a um provedor. O modelo do subagente é da mesma família do padrão do gateway, mas roda em outro arnês.

## Resultado

| # | Idioma | Itens | Frase | Versão simples | Motivo |
|---|---|---|---|---|---|
| 1 | pt-BR | 3 | aprovada | aprovada |  |
| 2 | pt-BR | 3 | aprovada | aprovada |  |
| 3 | pt-BR | 5 | aprovada | aprovada |  |
| 4 | pt-BR | 8 | reprovada | não conferida | V9: sem verbo de mensagem ("mostram") |
| 5 | en | 3 | aprovada | aprovada |  |
| 6 | en | 4 | aprovada | aprovada |  |
| 7 | en | 6 | reprovada | não conferida | V9: sem verbo de mensagem ("stands against") |
| 8 | zh-CN | 3 | aprovada | aprovada |  |
| 9 | zh-CN | 4 | aprovada | aprovada |  |
| 10 | zh-CN | 6 | aprovada | aprovada |  |

- **Primeira passada: 5 de 10 frases aprovadas.** As três em mandarim caíram na regra V6 por um furo do validador: ele aceitava `你选的` e não `你挑选了` nem `你挑选的`, que também são "você escolheu".
- **Depois de corrigir o validador: 8 de 10.** As duas que continuam reprovadas não têm verbo de mensagem para o conjunto, que o pré-prompt pede. Em produção elas ganhariam a segunda tentativa, com a correção apontada.
- **Versão simples: 8 de 8 aprovadas** entre as frases aprovadas.

## O que o validador não pega

Na resposta 5, a versão simples diz "a sound of rain". O item era um som de moedas caindo. A frase está certa de forma e errada de fato, e nenhuma regra do validador confere fato contra o item. O pré-prompt passou a dizer que detalhe concreto só entra se estiver escrito no rótulo ou no texto do item (versão `2026-11-12.4`). Isso reduz o risco; não o elimina, e a nova redação não foi sondada.

Na resposta 1, a frase descreve "uma pintura de cenas de carnificina" e a versão simples, "uma pintura cheia de sangue". O texto do museu sustenta a descrição, e o item tem tema sensível marcado. Fica o registro de que o modelo descreve com crueza o que o texto humano traz.

## As respostas

Guardadas como estão em `tests/fixtures/sonda-modelo-v3.json` e usadas em `src/frase/validador.test.ts`.

**1. pt-BR, 3 itens**

- Frase: Você reuniu uma pintura de cenas de carnificina, um som de vento uivante e a palavra pasmo, e essa seleção comunica assombro, medo e solitude.
- Simples: O que você escolheu foi uma pintura cheia de sangue, um som de vento que uiva num prédio vazio e a palavra que quer dizer um susto muito grande. Juntas, essas escolhas falam de espanto, de receio e de estar sozinho.

**2. pt-BR, 3 itens**

- Frase: Você reuniu uma pintura de dois pescadores sentados, um som de gotas repetidas e a palavra devaneio, e essa seleção comunica divagação mental, habituação e tédio.
- Simples: O que você escolheu é uma pintura de dois pescadores sentados num barco, um som de água pingando e a palavra que quer dizer pensar em outras coisas sem prestar atenção. Juntas, essas escolhas falam de uma mente que vagueia.

**3. pt-BR, 5 itens**

- Frase: Você reuniu cinco escolhas e elas dizem juntas que o luto e o alívio convivem, enquanto o fogo e os sinos apontam para restauração da atenção e para solidão.
- Simples: O que você escolheu junta coisas tristes com coisas que acalmam. Um fogo que estala e sinos ao vento mostram descanso, e a palavra alívio quer dizer quando um incômodo sai do caminho.

**4. pt-BR, 8 itens**

- Frase: Você reuniu oito escolhas que se opõem, pois o estalar do fogo e o barulho de uma porta batida mostram restauração da atenção ao lado de sobrecarga sensorial, e o som de lápis aponta para memória autobiográfica.
- Simples: O que você escolheu junta sons que acalmam com sons que cansam. O barulho do fogo e de uma porta batida mostram muita coisa chegando aos ouvidos ao mesmo tempo, e o som do lápis lembra algo que já aconteceu.

**5. en, 3 itens**

- Frase: You gathered a painting of a deity of mercy, a sound of falling coins and the word forlorn, and together they communicate compassion, attention restoration and loneliness.
- Simples: What you chose is a calm picture, a sound of rain and a sad word. Together they point to kindness, quiet focus and being alone.

**6. en, 4 itens**

- Frase: You gathered four choices in which attention restoration repeats, and that repetition intensifies what your selection communicates about mind wandering, compassion and nostalgia.
- Simples: What you chose is a painting, a sound of shaking leaves and a longing word. Together they point to a drifting mind, rest for tired focus and care for others.

**7. en, 6 itens**

- Frase: You gathered six choices in which belonging stands against loneliness, and envy and awe appear among them.
- Simples: What you chose is two paintings of mothers and children, sounds of water and fire, and two feeling words. Together they show a pull between feeling at home and feeling abandoned.

**8. zh-CN, 3 itens**

- Frase: 你挑选了一幅描绘嫉妒的画、一段踩水脚步的声音和一个写着母爱的词，这些选择共同传达依恋、嫉妒与注意恢复。
- Simples: 你选的东西有一幅画、一段踩水的声音和一个词，它们放在一起，说的是温暖的亲情，还有想要别人拥有的那种心情。

**9. zh-CN, 4 itens**

- Frase: 你挑选的几件东西里情绪感染重复出现，这种重复加强了所传达的信息，恐惧与注意恢复也因此被一并说出。
- Simples: 你选的东西有一幅描绘富贵花的画、火柴擦燃的声音、一个表示害怕的词和一幅描绘乡村节庆的画。它们一起说明，情绪会从一样东西传到另一样东西。

**10. zh-CN, 6 itens**

- Frase: 你挑选的东西里，积极情绪与哀伤彼此相对，敬畏与感觉超载也同时出现，这些选择共同传达一种并存的张力。
- Simples: 你选的东西有风铃声，也有嗡嗡的电流声，还有一个表示悲痛的词。它们放在一起，说的是快乐与悲伤摆在一起。
