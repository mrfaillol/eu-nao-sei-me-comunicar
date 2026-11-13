# Sonda de modelos gratuitos, 12/Nov/2026

Pergunta: dá para ligar a frase por modelo com uma chave que o dono já tem (OpenCode, Command Code, OpenRouter) e um modelo gratuito?

Resposta curta: dá, com o `particle-ai/particle-1:free` pelo OpenRouter, desde que a função espere mais. Ele acertou 10 de 12 frases no validador, em 4,7 a 13,8 segundos. Com os 7 segundos de hoje, nenhum modelo gratuito entregou.

## De onde a chave pode vir

| Serviço | Serve para a função? | Como foi conferido |
|---|---|---|
| OpenCode (Zen) | Não com modelo gratuito. A documentação diz: "Free-tier chat models require OpenCode; use paid models or Go from other clients." | Lido em opencode.ai/docs/zen, duas leituras independentes |
| Command Code | Em tese sim: a API aceita uso fora do CLI e lista dois modelos gratuitos. Na prática, a chave `CMD_API_KEY` deste Mac foi recusada com 401 nos três nomes de modelo tentados. | Lido em commandcode.ai/docs/provider-api; 401 medido em `api.commandcode.ai/provider/v1/chat/completions` |
| OpenRouter | Sim. A chave do ambiente é válida e a conta já comprou créditos, o que dá 1.000 pedidos gratuitos por dia e 20 por minuto. | `GET /api/v1/key` e as sondas abaixo |

## O que cada modelo gratuito fez

Todas as sondas usam `scripts/sonda-provedor.ts`: seleções reais do acervo, de três a sete signos, nos três idiomas, passadas pela mesma função de produção, com o mesmo validador. "Passou" é frase aprovada pelo validador na primeira ou na segunda tentativa.

| Modelo | Condição | Passou | Tempo | O que travou |
|---|---|---|---|---|
| `google/gemma-4-31b-it:free` | prazo de 7 s e de 45 s | 0 de 12 | | 429 em todos os pedidos: o serviço gratuito estava no limite |
| `baidu/ernie-5.5-flash-preview:free` | 7 s e 45 s | 0 de 24 | | resposta vazia ou erro da API |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 45 s, teto de 4.000 tokens | 1 de 6 | 31 s | prazo |
| `nvidia/nemotron-3.5-lightning:free` | 7 s, raciocínio desligado | 0 de 12 | cerca de 1 s por tentativa | reprova no validador (número em algarismo, contagem de termos, estado atribuído à pessoa) |
| `dots-studio/dots-3-note-preview:free` | 7 s, raciocínio desligado | 1 de 12 | 3,3 s | reprova no validador |
| `particle-ai/particle-1:free` | 45 s, teto de 4.000, raciocínio padrão | 5 de 6 | mediana 11,9 s, maior 36,5 s | |
| `particle-ai/particle-1:free` | **20 s, teto de 2.000, raciocínio baixo** | **10 de 12** | **mediana 8,6 s, de 4,7 a 13,8 s** | 2 por prazo |

Dois pontos de leitura:

- Os modelos que raciocinam gastam o teto de saída pensando. Com o teto padrão de 700 tokens eles devolvem texto vazio. Por isso o provedor ganhou `MODELO_TETO` e `MODELO_EXTRA`.
- `thinkingmachines/inkling-2-small:free` devolveu 403 no OpenRouter e não foi medido.

## Frases do modelo escolhido

Seis das dez aprovadas, como saíram:

- **pt-BR, 5 signos, 8.0 s.** Suas escolhas comunicam que a restauração da atenção e a solitude convivem com a sobrecarga sensorial, e essa oposição afirma uma esperança que se mantém no que você reuniu.
  Em palavras simples: O que você escolheu junta passos sobre terra e concreto, folhas caindo, um retrato e um barco que liga e desliga, além de uma palavra sobre coragem. Essas escolhas mostram calma e barulho no mesmo lugar.
- **pt-BR, 6 signos, 4.8 s.** Suas escolhas comunicam que a habituação e a restauração da atenção convivem com a vigilância, e o apego ao lugar aponta para o que se repete e se conserva.
  (versão simples reprovada; o aparelho compõe a dele)
- **en, 5 signos, 13.8 s.** Your selection communicates that attachment and ostracism oppose each other and that vigilance and attention restoration oppose each other, so the chosen items together say that closeness and banishment and alertness and quiet belong to one message.
  (versão simples reprovada; o aparelho compõe a dele)
- **en, 4 signos, 4.7 s.** Your choices communicate that compassion and gratitude stand beside grief, and that attention restoration gathers the shared cloak, the river’s sound and the feast into one message.
  Em palavras simples: What you chose brings together a man sharing his cloak, a river sound, a word about loss, and a feast. Together they say that kindness and thankfulness can sit beside loss.
- **en, 6 signos, 9.2 s.** You gathered a mountain retreat, tap water, bird song, paper cutting and printed lake views, and your selection communicates anger beside attention restoration, with domestic repetition gathering belonging and nostalgia.
  Em palavras simples: What you chose puts a word for being very mad next to water, birds, paper cutting and mountain and lake scenes. Together they say that being very mad and calm noticing can sit side by side, and that small familiar actions and old places can point to being part of a group and longing for the past.
- **en, 5 signos, 6.7 s.** Your choices communicate that attention restoration and sensory overload meet under ambivalence, and that the gathered images and sounds affirm belonging.
  Em palavras simples: What you chose brings a quiet, restoring kind of focus together with a feeling of too much noise and stuff, and it also holds being unsure between options together with being part of a group.

## Limites desta sonda

- Doze seleções é pouco. O número serve para escolher um candidato, não para garantir a taxa em produção.
- Só o validador julgou as frases. Nenhuma pessoa as leu além desta amostra.
- Modelo gratuito pode sair do ar ou mudar sem aviso, e o provedor pode guardar o que recebe. O pedido leva só texto do acervo (rótulos, descrições de curadoria, tags), nunca dado de quem visita.
- Medido num único horário, em 12/Nov/2026. Latência de serviço gratuito varia com a fila.

## Em produção, na mesma noite

Com a autorização do dono, a chave do OpenRouter foi gravada na Vercel e o modelo ligado. Dezoito frases foram pedidas à função publicada, com seleções sorteadas do acervo, em duas configurações.

| Configuração | Do modelo | Espera quando veio do modelo | Espera quando caiu na regra |
|---|---|---|---|
| raciocínio baixo, teto 2.000, prazo de 16 s | 6 de 9 | 10,6 a 15,9 s | 16,2 a 16,5 s |
| **sem raciocínio, teto 2.000, prazo de 10 s** (a que ficou) | 4 de 9 | 1,9 a 7,1 s | 4,3 a 5,9 s |

A sonda fora de produção, mais cedo, tinha medido de 4,7 a 13,8 s com raciocínio baixo: à noite o serviço gratuito estava mais lento. Com raciocínio a pessoa esperava até 16 s e, uma vez em três, recebia a frase por regra do mesmo jeito. Sem raciocínio o modelo erra mais a contagem de termos (regra V5 do validador) e cai mais na regra, mas ninguém espera mais de 7 s. Ficou a segunda.

Frases do modelo com raciocínio baixo:

- **pt-BR, 3 signos, 10.6 s.** Você reuniu uma imagem devocional, um som de datilografia e a palavra fúria, e suas escolhas comunicam ambivalência entre compaixão e raiva, com nostalgia no que se repete.
  Em palavras simples: O que você escolheu reúne uma imagem religiosa, um som de máquina de escrever e a palavra fúria. Juntas, essas escolhas mostram lados opostos que convivem e uma lembrança do que se repete.
- **en, 4 signos, 10.9 s.** Your selection of a family portrait with storm sounds and the word anger communicates belonging set against fear and anger, while repeated thunder turns the storm into sensory overload.
  Em palavras simples: What you chose joins a family portrait, storm sounds, and a word for strong displeasure. Together they say that a place in a family can sit beside that displeasure and a storm that is too loud and too much at once.
- **en, 6 signos, 11.0 s.** Your choices of a posthumous child portrait, a stream, kindness, a falconer, a rooster and a contemplator communicate belonging, attention restoration, compassion and grief together, joining remembered family, nature and kindness with loss.
  Em palavras simples: What you chose brings together a child remembered after death, a stream, kindness, a falconer, a rooster and a watcher of stars. Together they say that being part of something, calm attention and care can sit with loss.
- **en, 5 signos, 15.9 s.** Your choices communicate that embarrassment and attachment coexist, and that attention restoration arrives through both ordinary mechanical repetition and awe at what overwhelms.
- **zh-CN, 4 signos, 14.6 s.** 你选择的图画、警报声、表示犹豫的词语和版画共同传达心流与恐惧的对立，以及矛盾态度与自传体记忆在同一个选择中的并存。
  Em palavras simples: 你选的东西把被音乐吸引的画面、像警报的声音、表示拿不定主意的词和一幅版画放在一起，这些放在一起说的是，人被吸引的同时也保持紧张，并且会回到过去的事上。
- **zh-CN, 5 signos, 13.2 s.** 你选的图像、滴水声和词语共同传达敬畏、同情与嫉妒、恐惧的并置，表明这组选择让这些感受彼此依存。

Frases do modelo sem raciocínio:

- **pt-BR, 3 signos, 3.1 s.** Suas escolhas comunicam que o deleite nomeia o afeto, o zumbido do refrigerador aponta a habituação ao lar e a pintura mostra a restauração da atenção, e juntas afirmam que a emoção positiva depende desse apego ao lugar.
- **pt-BR, 3 signos, 7.1 s.** Sua seleção reúne o ícone de uma paisagem coreana observada, o índice de um coaxar gravado e o símbolo de aconchego, e comunica que a curiosidade pelo real se completa no conforto de emoções positivas e na restauração da atenção.
  Em palavras simples: O que você escolheu junta uma paisagem feita a partir de lugares que existem de verdade, um coaxar de sapo gravado e a ideia de aconchego. Essas escolhas dizem juntas que olhar o mundo com atenção convive com uma sensação de bem-estar.
- **en, 3 signos, 5.5 s.** Your choices set an alarm that marks vigilance and habituation against painted light and a retreat, so the selection communicates that positive emotions and solitude sit side by side with what interrupts them.
  Em palavras simples: What you chose puts a ringing alarm next to a painted face and a quiet place. Together they say that calm and bright feelings sit beside the noise that keeps breaking in.
- **zh-CN, 5 signos, 1.9 s.** 你选的水灾画作和街景画作指向归属感，闹钟声表明警觉，兴高采烈一词传达积极情绪，这些选择共同说出日常安稳与被打断之间的对照。
  Em palavras simples: 你选的东西里有受灾人家的画面、街角日常的画面、闹钟的响声，还有一个表示高兴的词。它们放在一起说的是平常生活和突然被打断之间的对照。

## Por que o modelo sem raciocínio reprovava, e o que mudou

Um diagnóstico com a frase crua de cada tentativa mostrou duas causas para a regra V5 (de dois a quatro termos permitidos), que era a reprovação mais comum:

1. Quando a seleção permitia mais de quatro termos, o modelo usava todos: cinco, seis, sete. O pré-prompt (versão `2026-11-12.6`) passou a entregar só os termos que a frase por regra escolheria para a mesma seleção, e a tirar dos itens os construtos que ficaram de fora.
2. O modelo declarava um termo e escrevia um sinônimo ("regozijo" por "emoções positivas"). A frase estava dentro do contrato; só a lista declarada não batia. O validador passou a julgar o que está escrito. A declaração só precisa caber na seleção, e a procedência já saía do que o servidor acha na frase.

Mesmas duas sementes, nove seleções cada, modelo sem raciocínio, prazo de 10 s:

| Estado do código | Aprovadas | Tempo das aprovadas |
|---|---|---|
| antes (só a semente 23) | 5 de 9 | 2,0 a 7,7 s |
| com o corte de termos | 12 de 18 | 1,8 a 8,0 s |
| com o corte e o julgamento pelo que está escrito | 15 de 18 | 1,4 a 9,5 s, a maioria abaixo de 3 s |

As 33 frases defeituosas do conjunto de regressão continuam reprovadas depois da mudança no validador.

### Em produção, depois das duas correções

Nove pedidos reais à função publicada, na mesma noite: as nove frases vieram do modelo (seis de primeira, três na segunda tentativa), em 1,6 a 6,1 s. Antes das correções, na mesma configuração, eram quatro em nove.

- **pt-BR, 4 signos, 6.1 s.** Ao reunir tapeçaria com panteras, o som de gaivotas, a palavra calma e a pintura do devoto que toca os pés do santo, você escolheu itens que apontam para uma restauração da atenção e comunicam compaixão e fluxo.
- **pt-BR, 4 signos, 3.5 s.** Suas escolhas comunicam ambivalência ao mostrar um interior que se repete e esconde figuras, apontam emoções positivas no ronronar de um gato, nomeiam apego ao lugar em pátria e afirmam assombro diante de uma montanha moldada por erupções.
  Em palavras simples: O que você escolheu junta coisas que aconchegam e coisas que inquietam. De um lado, um gato ronronando e a palavra pátria, que fala do lugar onde a pessoa nasceu. Do outro, um cômodo com paredes estampadas que esconde vultos e uma montanha de formato impressionante, feita pela lava.
- **pt-BR, 5 signos, 3.2 s.** Suas escolhas comunicam nostalgia e assombro, pois você reuniu o sino antigo e a saudade ao lado do ser celestial e do monstro marinho, e essa oposição restaura a atenção ao que aponta para o passado e para o espanto.
- **en, 6 signos, 2.8 s.** Your choices gather a flood that sweeps the young, a portrait kept as a memento, an elephant circled by children at play and the word astonishment, so danger and delight communicate together as curiosity and awe hold the same message.
- **en, 5 signos, 3.7 s.** Your choices communicate a pull between the kept page and open nature against exclusion, where the rain and bonfire point to attention restoration and a door squeak names the edge, so the gathering holds awe and mind wandering together.
- **en, 3 signos, 2.2 s.** Your selection communicates that a printed landscape, a clock's chime and the word calm together hold fear beside place attachment, and attention restoration names what softens it.
  Em palavras simples: What you chose brings together a printed landscape, the sound of bells and the word calm. Together they show that a quiet, familiar place is what makes room for rest.
- **zh-CN, 6 signos, 2.1 s.** 你选的东西放在一起，传达出矛盾态度与后悔，也表明异化和希望感并非彼此取消。
- **zh-CN, 5 signos, 3.6 s.** 你选择的风扇声和山水画中的月光、水面与山峦传达感觉超载，而挽歌与重逢的画面说出依恋，为难一词表明矛盾态度。
- **zh-CN, 3 signos, 1.6 s.** 你的选择传达出恐惧与敬畏，画作中被惊醒的武士与破碎玻璃的声音指向突变，字词怕则直接说出这种恐惧。
  Em palavras simples: 你选的东西里，有画中武士突然惊醒的画面，有玻璃破碎的声音，还有一个表示害怕的字，它们合在一起说出一种突然而来的害怕。
