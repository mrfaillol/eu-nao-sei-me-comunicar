# Eu Não Sei Me Comunicar

Obra interativa em fundo preto. A pessoa faz três ou mais escolhas entre pinturas, sons e palavras, sem teto, e pede uma frase, em segunda pessoa, que descreve o que a seleção comunica. Idiomas: pt-BR, en, zh-CN.

A frase afirma o que a **seleção** comunica. Ela não diagnostica, não aconselha e não é avaliação de saúde.

- Desenho: `docs/superpowers/specs/2026-11-12-eu-nao-sei-me-comunicar-design.md`
- Plano: `docs/superpowers/plans/2026-11-12-eu-nao-sei-me-comunicar.md`
- Fatos conferidos: `docs/pesquisa/dossie.md`
- Capturas de tela: `docs/capturas/`

## Rodar

```bash
pnpm install
pnpm dev                 # site em http://localhost:5173; a função fica em /api/interpretar, e o site só a usa com VITE_API_BASE
pnpm build               # site de produção em dist/ (cerca de 15 MB, com o acervo dentro)
pnpm test                # testes de unidade (frase, servidor, interface)
pnpm e2e                 # constrói e roda os testes de navegador, em celular e em tela larga

cd pipeline
uv run pytest -q         # testes do acervo
uv run pytest -m rede    # os que usam rede (DOIs no Crossref)
```

Sem chave de modelo e sem rede o site funciona inteiro: a frase é composta por regra, no aparelho.

## CI e publicação

- **CI** (`.github/workflows/ci.yml`): roda em todo pull request e em todo push na `main`. Dois trabalhos: `site` (testes de unidade, build e testes de navegador em Chromium) e `acervo` (testes do pipeline em Python, com `ffmpeg` instalado no runner).
- **Publicação**: o projeto `eunaoseimecomunicar` na Vercel está ligado a este repositório. Push na `main` publica em produção, em https://eunaoseimecomunicar.vercel.app. Push em qualquer outro ramo gera uma prévia, protegida por login da Vercel.
- Vão para a Vercel o site estático e a função `interpretar`, montados por `pnpm build:vercel` (`scripts/saida-vercel.mjs`) e configurados em `vercel.json`. O estado da função está em "A função da frase", mais abaixo.
- A Vercel não espera o CI: ela publica o que chegar na `main`. Quem segura código quebrado é a revisão do pull request, com o CI verde antes de mesclar.
- O repositório é público desde 12/Nov/2026. O `git config user.email` daqui usa o e-mail `noreply` da conta do GitHub: a Vercel reconhece o autor e nenhum e-mail pessoal entra no histórico. Os 23 primeiros commits são anteriores a essa configuração e levam o nome da máquina em que foram feitos.

`node scripts/gravar-demo.mjs [url] [saida.mp4] [semente]` grava o vídeo de divulgação em `divulgacao/`: uma passada pelo site, muda, com zooms. A semente fixa o sorteio das opções; a tomada guardada é a de semente 58, gravada em 12/Nov depois do acervo maior e da versão simples.

O gravador deixa ao lado do vídeo um `.eventos.json` com o instante de cada movimento do cursor, clique e aproximação da câmera. `uv run --project pipeline python scripts/violoncelo.py <tomada>.eventos.json <saida>.wav` escreve uma trilha de violoncelo a partir dele, nota por nota: o cursor em movimento é arco ligado (a altura na tela é a altura da nota, e o deslize é um glissando com a curva do cursor), cada clique é um pizzicato, cada escolha deixa uma nota longa que empilha um acorde até a frase, e cada aproximação da câmera é um crescendo. Tudo em ré menor pentatônico. As amostras são do [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), de Sam Gossner, em domínio público (CC0); o script as baixa para `pipeline/cache/`. O que foi medido na tomada guardada: cada pizzicato começa a no máximo 12 ms do clique (um quadro dura 33 ms), os deslizes chegam à nota escrita, e o volume é de -16,9 LUFS. O que não foi medido: se a música agrada. Ninguém a ouviu antes de publicar. Em `divulgacao/` ficam as duas versões: `eu-nao-sei-me-comunicar.mp4`, muda, e `eu-nao-sei-me-comunicar-violoncelo.mp4`.

Depois de publicar, `node scripts/fumaca-producao.mjs` faz o fluxo inteiro contra a URL de produção (celular, tela larga, três idiomas e sem rede) e sai com erro se algo falhar.

O acervo publicado é o de demonstração: os 150 itens estão com revisão humana pendente e o site diz isso nos créditos.

## Como a pessoa usa

- Cada janela mostra três opções e um botão para trocar por outras três. Escolher não tem teto; com três escolhas o botão **Ver a frase** acende na barra de tarefas. A frase não abre sozinha.
- A frase conta quantos itens foram reunidos, nomeia o tema que mais se repete e até três ao fundo. Os demais termos da seleção ficam listados na caixa, com definição e DOI.
- Logo abaixo da frase vem a mesma mensagem **em palavras simples**, sem termo técnico ("apego ao lugar" vira "ligação forte com um lugar"). Cada termo da lista também traz a sua explicação simples antes da definição do artigo. Essas explicações estão em `data/construtos.json`, no campo `simples`; foram escritas para este site com apoio de modelo, não vêm dos artigos citados, e esperam revisão humana. O teste confere que nenhuma delas atribui estado à pessoa nem aconselha.
- Fechar a caixa (Esc ou **Escolher mais**) conserva a seleção. **Recomeçar** apaga.
- O **(i)** acima de cada item abre uma caixa: nas pinturas, palavras tiradas do texto de curadoria do museu; nos sons, as tags de quem publicou; nas palavras, a definição do dicionário. Nenhuma palavra é escrita pelo site: `src/ui/descritores.ts` só separa, tira palavras vazias e amostra o texto humano do item. As palavras ficam no idioma em que foram escritas (inglês).
- Cada língua tem o seu dicionário. Em português, o Dicionário Aberto (Cândido de Figueiredo, 1913), com classe gramatical e a definição seca de dicionário antigo, e o Wikcionário para duas palavras que ele não tem. Em mandarim, o 重編國語辭典修訂本 do Ministério da Educação de Taiwan, com pinyin e, muitas vezes, uma citação clássica; o texto fica em caracteres tradicionais, como foi publicado (a licença é CC BY-ND). Em inglês, o Wiktionary. A definição é copiada; a escolha do verbete e do sentido de cada palavra está em `data/definicoes.json`.
- No canto direito da barra ficam a assinatura do autor, com link para https://vingren.me, e a foice e o martelo, que levam ao repositório no GitHub.

## Como as partes se encaixam

| Pasta | O que faz |
|---|---|
| `data/` | Fonte de verdade editável: glossário de construtos, listas de palavras, fontes e licenças, termos de busca, exclusões de curadoria, textos de ajuda |
| `pipeline/` | Python 3.12 (uv). Monta o acervo: busca, filtra, baixa, detecta rosto, anota e grava `public/indice/` e `public/midia/` |
| `src/frase/` | TypeScript usado no navegador e no servidor: termos permitidos, validador, compositor por regra, pré-prompt |
| `src/servidor/` | A função `interpretar`: duas tentativas do modelo, conferidas pelo validador, e a frase por regra como rede de segurança |
| `src/ui/` | A tela: janelas, seleção, zoom, som, barra de tarefas, a caixa da frase |
| `android/`, `ios/` | Projetos do Capacitor 8.6 |

## O acervo

```bash
cd pipeline
uv run python -m acervo palavras     # glosas do Wiktionary e de Zheng et al. (2023)
uv run python -m acervo pinturas     # Cleveland Museum of Art, CC0
uv run python -m acervo rostos       # rosto de destaque e recorte nítido
uv run python -m acervo sons         # Freesound via Openverse, CC0
uv run python -m acervo definicoes   # a definição de cada palavra no dicionário da sua língua
uv run python -m acervo montar       # grava public/indice/ e confere as invariantes
uv run python -m acervo ampliar      # grava public/indice/ampliado.json, o acervo além do conferido
uv run python -m acervo revisao      # gera revisao/index.html
```

Regras que o pipeline faz valer:

- Nenhum item entra sem texto escrito por gente: descrição da curadoria (pintura), título e tags do autor (som), glosa de dicionário (palavra).
- Cada anotação de pintura e de som cita o trecho literal do texto humano que a sustenta. Item cujo texto não sustenta nenhum construto sai do acervo (`data/pinturas-excluidas.txt`, `data/sons-excluidos.txt`).
- Todo construto do glossário tem referência com DOI que resolve no Crossref.
- CC0 para pintura e som, com uma exceção desde 12/Nov/2026: as imagens do Minneapolis Institute of Art, que o museu oferece só para uso não comercial e educativo (ver "Lote 3").
- Os sons vêm de termos de busca sem voz e passam por uma lista de termos barrados em título e tags. Isso reduz, mas não garante, a ausência de voz ou de conteúdo impróprio: quem garante é a escuta humana, na folha de revisão.

### Acervo conferido e acervo ampliado

O site carrega dois índices.

| | Conferido (`acervo.json`) | Ampliado (`ampliado.json`) |
|---|---|---|
| Tamanho | 30 pinturas, 30 sons, 606 palavras (177 em português, 190 em inglês, 239 em mandarim) | 6.337 imagens (3.999 de Cleveland, 2.338 de Minneapolis) e 2.369 sons |
| Mídia | no próprio site; funciona sem rede | nos servidores de origem: os dos dois museus e o CDN do Freesound |
| Anotação | lida item a item, com trecho citado | automática, por léxico (`data/lexico-construtos.json`), com trecho citado |
| Rosto | detectado na imagem grande, com recorte nítido | detectado na imagem web; 1.542 imagens têm rosto de destaque |
| Quando entra | na primeira tela | depois dela, nas próximas trocas; só com rede |

A regra do ampliado: um construto só entra quando uma pista dele está escrita, por uma pessoa, no texto do item (curadoria do museu, ou título e tags de quem publicou o som). O trecho que casou fica em `pipeline/saida/ampliado-evidencias.json`, e o comando recusa gravar se algum trecho não estiver no texto do item. Texto sem pista deixa o item de fora; texto com nudez ou violência gráfica também.

Em 12/Nov o ampliado cresceu de 615 imagens e 873 sons para os números acima, a pedido do dono:

- **Imagens** deixaram de ser só pinturas: entram gravuras, desenhos, fotografias, páginas de manuscrito e miniaturas do mesmo museu, todas CC0. O texto humano passou a somar a descrição da curadoria e a nota "você sabia?" do museu, com mínimo de 100 caracteres.
- **Lotes.** O acervo cresce em lotes. O de 12/Nov/2026 trouxe tecidos, bordados, tapeçarias, caligrafias, portfólios e páginas de livro do mesmo museu, 16 termos de busca de som e 114 palavras. Dois cortes entraram junto: no máximo 12 imagens com o mesmo texto de curadoria (um livro encadernado repetia a mesma descrição em 571 páginas) e proporção entre 1:3 e 3:1 (tiras de tecido chegavam a 75:1). Os cortes tiraram 303 imagens que estavam no ar; entraram 404. O Openverse aceita 200 buscas por dia sem cadastro: o lote de sons de cada dia para nesse teto e continua no dia seguinte.
- **Lote 2, 12/Nov/2026.** 121 palavras e 374 imagens. As imagens são fichas de Cleveland que já tinham texto de curadoria e não tinham anotação: o léxico ganhou pistas de natureza (flores, pássaros, rio, árvores), de bons votos (sorte, longevidade) e de pesar. Nenhum som: a cota do dia estava gasta. Três fontes novas de imagem foram medidas e ficaram de fora, cada uma por um motivo: o Art Institute of Chicago responde às imagens com um desafio do Cloudflare fora do próprio site; o Minneapolis Institute of Art declara as fotos só para uso não comercial e educativo; e as descrições da National Gallery of Art têm estilo de legenda automática (87% começam por "The image shows", "This is a" e parecidos), o que quebraria a regra de texto escrito por gente.
- **Lote 3, 12/Nov/2026.** 2.338 imagens do Minneapolis Institute of Art e 75 palavras. O dono do projeto decidiu incluir esse museu "com crédito e aviso": o texto de curadoria é CC0, mas **a foto não é de domínio público**; o museu a oferece para uso não comercial e educativo. Por isso a imagem nunca é copiada para cá (o item aponta para o servidor do museu), o crédito de cada item diz `Non-commercial use (Mia image policy)` no (i) e junto da frase, e o validador do acervo recusa imagem de um museu com a licença ou o servidor de outro. Consequência prática: um uso comercial do site ou do app teria de tirar essas 2.338 imagens antes (`fonte: mia` no índice). A página da política de imagens do museu respondeu 429 nas tentativas de leitura de 12/Nov; a regra citada aqui é a do README do repositório de dados do museu (`artsmia/collection`).
- **O léxico ganhou pistas de cena** (mãe, mercado, tempestade, ofício) além das de afeto. Elas trazem volume e são mais frouxas: uma obra com "mother" recebe "apego" sem que o texto fale de vínculo.
- **Sons** de até 30 segundos (o acervo conferido segue com o teto de 20) e 46 termos de busca a mais.
- **Palavras** passaram de 30 para cerca de 100 por idioma. A escolha de cada palavra, do construto e do sentido no dicionário foi feita com apoio de modelo e espera revisão.

O que isso custa, dito às claras:

- **Léxico não é leitura.** "Retro video game sfx - Ocean wave" recebe o mesmo construto de uma gravação de mar. O léxico foi escrito com apoio de modelo e não passou por revisão humana.
- **Ninguém ouviu os 2.369 sons nem olhou as 6.337 imagens.** Os filtros (CC0, sem voz nos termos de busca, lista de termos barrados, marcação de conteúdo adulto da fonte, exclusão por palavra no texto) reduzem o risco e não o eliminam.
- **O navegador de quem visita passa a falar com o museu e com o Freesound**, que recebem o pedido da imagem e do som. O site diz isso nos créditos. Fora esses dois, nenhum endereço de fora é chamado, e um teste confere.
- Se o servidor de origem falhar, o item sai de oferta; com três falhas seguidas a janela volta a oferecer só o acervo conferido.

### Revisão humana

Todo item nasce com revisão pendente, e o site avisa nos créditos que o acervo é de demonstração. Para publicar:

1. `uv run python -m acervo revisao` e abra `revisao/index.html`.
2. Veja cada pintura com as caixas de rosto, ouça cada som, leia cada palavra. Aprove ou reprove, escreva o seu nome e baixe `decisoes.json`.
3. Salve o arquivo em `pipeline/revisao/decisoes.json`.
4. `uv run python -m acervo rostos` (se trocou algum rosto de destaque) e `uv run python -m acervo montar --publicavel`.

A aprovação vale só para o conteúdo revisado: se o pipeline rodar de novo e mudar o texto ou o arquivo de um item, a aprovação dele volta a pendente.

## A função da frase

O site publicado chama `/api/interpretar`, uma função na Vercel (`src/servidor/vercel.ts`, empacotada por `scripts/saida-vercel.mjs`). Ela pede a um modelo de linguagem a frase e a versão em palavras simples, confere as duas e, se qualquer coisa falhar, devolve a frase por regra.

**Estado em 12/Nov/2026, à noite: o modelo está ligado**, com `particle-ai/particle-1:free` pelo OpenRouter e a chave do dono (ver "Modelo gratuito com uma chave que você já tem"). Em nove pedidos reais à função publicada, quatro frases vieram do modelo, em 2 a 7 segundos, e cinco da regra. O parágrafo seguinte descreve o caminho do gateway, que continua parado e hoje não é usado. O AI Gateway da Vercel aceitou o token do projeto e respondeu `403 customer_verification_required`: falta um cartão cadastrado na conta para liberar os créditos gratuitos. Enquanto isso, toda resposta sai pela regra. Para ligar, uma das duas:

1. Cadastrar um cartão em Vercel → AI Gateway. Nada mais muda: a função se autentica com o token que a Vercel dá ao próprio projeto, sem chave guardada.
2. Ou gravar uma chave da Anthropic no projeto, você mesmo, sem colar em chat: `pnpm dlx vercel@latest env add ANTHROPIC_API_KEY production`.

| Variável | Efeito |
|---|---|
| (nenhuma) | Usa o AI Gateway com o token do projeto e o modelo `anthropic/claude-haiku-5.5` |
| `ANTHROPIC_API_KEY` | Vai direto à Anthropic, com `claude-opus-5-5` por padrão |
| `FRASE_MODELO` | Troca o modelo de qualquer um dos dois caminhos |
| `MODELO_URL`, `MODELO_CHAVE`, `MODELO_NOME` | As três juntas ligam um serviço no formato chat/completions (OpenRouter, Command Code e outros). Ficam atrás da chave da Anthropic e na frente do gateway |
| `MODELO_EXTRA` | Objeto JSON somado ao corpo do pedido, para o que só um serviço entende (ex.: `{"reasoning":{"effort":"low"}}`) |
| `MODELO_TETO` | Teto de tokens de saída, de 200 a 4.096 (padrão 700). Modelo que raciocina precisa de mais |
| `FRASE_PRAZO_MS` | Quanto a função espera pelo modelo, de 3.000 a 20.000 (padrão 7.000) |
| `FRASE_PROVEDOR=nenhum` | Desliga o modelo |
| `VITE_API_BASE` | No build do site: endereço da função. O `vercel.json` põe `.`; sem ela (testes, Capacitor), tudo fica no aparelho |
| `VITE_FRASE_ESPERA_MS` | No build do site: quanto o navegador espera pela função, de 3.000 a 30.000 (padrão 8.000). Tem de ser maior que `FRASE_PRAZO_MS` |

Custo de referência no gateway: o `claude-haiku-5.5` sai a US$ 0,10 por milhão de tokens de entrada e US$ 0,50 de saída; um pedido tem cerca de 1.500 tokens de entrada e 150 de saída, perto de US$ 0,0002.

### Modelo gratuito com uma chave que você já tem

Medido em 12/Nov/2026, com detalhe em `docs/sonda-modelos-gratuitos-2026-11-12.md`:

- **OpenCode:** os modelos gratuitos só valem dentro do próprio OpenCode, segundo a documentação deles. Fora.
- **Command Code:** a API aceita uso externo e tem dois modelos gratuitos, mas a chave `CMD_API_KEY` deste Mac foi recusada (401). Com uma chave nova daria para medir.
- **OpenRouter:** a chave do ambiente vale e dá 1.000 pedidos gratuitos por dia. O `particle-ai/particle-1:free`, com raciocínio baixo, acertou 10 de 12 frases no validador, em 4,7 a 13,8 segundos. Os outros seis gratuitos testados reprovaram, travaram no limite ou demoraram demais.

O custo é a espera: a pessoa vê "Escrevendo a frase…" por alguns segundos, em vez de menos de um. Se o modelo falhar ou passar do prazo, a frase por regra entra no lugar.

**Ligado em 12/Nov/2026**, com autorização do dono: a chave foi copiada do ambiente deste Mac para a Vercel, sem aparecer em tela, com `printf %s "$OPENROUTER_API_KEY" | pnpm dlx vercel@latest env add MODELO_CHAVE production`. As outras variáveis em produção: `MODELO_URL=https://openrouter.ai/api/v1`, `MODELO_NOME=particle-ai/particle-1:free`, `MODELO_EXTRA={"reasoning":{"enabled":false}}`, `MODELO_TETO=2000`, `FRASE_PRAZO_MS=10000` e `VITE_FRASE_ESPERA_MS=12000`.

Duas configurações foram medidas em produção, nove pedidos cada. Com raciocínio baixo e prazo de 16 s, seis frases vieram do modelo, em 10,6 a 15,9 s, e três caíram na regra depois de 16 s. Sem raciocínio e com prazo de 10 s, quatro vieram do modelo, em 1,9 a 7,1 s, e cinco da regra, em até 5,9 s. Ficou a segunda: menos frases do modelo, e ninguém espera mais de 7 s. Para voltar à primeira, troque `MODELO_EXTRA` para `{"reasoning":{"effort":"low"}}`, `FRASE_PRAZO_MS` para `16000` e `VITE_FRASE_ESPERA_MS` para `18000`, e publique de novo.

Para desligar: `pnpm dlx vercel@latest env rm MODELO_CHAVE production` e publicar de novo. Mudança de variável só vale depois de nova publicação (`pnpm dlx vercel@latest redeploy https://eunaoseimecomunicar.vercel.app`).

O que protege o gasto e a pessoa:

- A função recebe só os identificadores das escolhas (três ou mais) e o idioma. Recusa origem de navegador fora da lista (403), tipo de conteúdo sem preflight (415) e corpo acima de 16 KB (413).
- Limite dentro da função: 6 chamadas ao modelo por visitante por minuto e 400 por hora no total, por instância. Quem passa do limite recebe a frase por regra. É uma contenção, não uma barreira perfeita: cada instância conta a sua.
- Com mais de doze itens, a resposta sai pela regra: o pedido levaria o texto de todos e a frase nomeia no máximo quatro termos.
- A frase do modelo passa pelo validador inteiro; a versão simples, pelas regras que valem para ela (não atribuir estado à pessoa, não aconselhar, não citar autor, idioma certo) e por um teto de tamanho. Versão simples reprovada é descartada, e o aparelho compõe a dele por regra.
- Se a conta recusar a credencial, a função pausa o modelo por dez minutos em vez de insistir a cada pedido.

## Estado, medido em 12/Nov/2026

- Acervo conferido: 30 pinturas (20 com rosto de destaque), 30 sons, 606 palavras, 416 delas (as de português e de mandarim) com definição no dicionário da própria língua. Acervo ampliado: 6.337 imagens (2.434 com rosto) e 2.369 sons, com os 34 construtos representados. Tudo com revisão humana pendente. Glossário com 34 construtos e 4 termos de dimensão.
- Testes: 146 em Python, 352 de unidade em TypeScript, 86 de navegador (celular e tela larga, só em Chromium).
- Validador: rejeita 33 de 33 frases defeituosas do conjunto de regressão e aceita 18 de 18 de referência. **É uma barreira, não uma prova.** A revisão final fez passar 13 frases que atribuíam estado à pessoa ou aconselhavam ("o medo que te consome", "you're anxious"); hoje elas são rejeitadas e viraram teste, mas a regra continua sendo lista, com furos por natureza.
- O compositor por regra não gera frase reprovada: conferido pelo revisor em 352.440 frases (todos os trios do índice, nos três idiomas) e, no repositório, por um teste sobre uma amostra fixa.
- Sonda do pré-prompt com modelo real: 17 de 18 respostas aprovadas na primeira tentativa. A reprovada, em mandarim, não tinha verbo de mensagem. Uma tentativa de injeção plantada nas tags de um som foi tratada como dado nos três idiomas.
- Pareamento cego: um juiz que só viu o texto humano dos itens ligou 6 de 6 frases por regra à seleção certa.
- Sem rede: depois da primeira visita, o site funciona inteiro (teste de navegador corta a rede e refaz o fluxo).

### Quando o modelo ligar

1. Ler uma amostra maior das frases e das versões simples aprovadas, nos três idiomas. O validador já recebeu saída real da função (dezoito pedidos em 12/Nov), mas só ele e a sessão de desenvolvimento leram o resultado.
2. Ler `docs/sonda-modelo-2026-11-12.md`: uma sonda fora de produção deu 8 de 10 frases aprovadas na primeira tentativa, achou um furo do validador em mandarim (corrigido) e mostrou uma versão simples com um detalhe inventado, que o validador não pega. O pré-prompt está na versão `2026-11-12.4`, que não foi sondada.
3. Olhar o registro da função: falha do modelo aparece como `[interpretar] caminho do modelo falhou: <tipo>`.

### NÃO PROVADO

- O modelo está ligado desde a noite de 12/Nov, e o que se sabe dele em produção são dezoito pedidos de teste. Nenhuma pessoa leu as frases dele além das que estão em `docs/sonda-modelos-gratuitos-2026-11-12.md`. A taxa de frases do modelo (4 de 9 na configuração atual) vem de amostra pequena, num único horário. Modelo gratuito pode sair do ar ou mudar sem aviso; quando isso acontecer, a função registra a falha e responde por regra.
- Em aparelho há uma prova só: uma captura do dono num iPhone, em 12/Nov, com a tela, a barra e o (i) desenhados certo. Fora isso, nada foi medido em aparelho. Som em iPhone real, instalação da PWA e o app do Capacitor em uso ficam por testar. Hipótese a testar primeiro: o service worker entrega os `.mp3` sem tratar pedidos com `Range`, e o Safari costuma recusar isso; se valer, os sons não tocam na PWA instalada no iPhone (dentro do app Capacitor não há service worker e a hipótese não se aplica).
- O pareamento cego usou modelo como juiz, não gente.

### Revisão nativa pendente

Os moldes da frase em inglês e em mandarim (`src/frase/moldes/`), os termos em mandarim do glossário e o título em mandarim foram escritos com apoio de modelo.

## Plataformas

| Plataforma | Estado |
|---|---|
| Web | Publicada em https://eunaoseimecomunicar.vercel.app. PWA instalável, com manifesto, ícones e service worker |
| iOS | Projeto gerado em `ios/`. Compila com o Xcode 27.1 já instalado, sem sudo e sem assinatura: `** BUILD SUCCEEDED **`, app de 14 MB com o acervo dentro. Falta assinar e rodar em aparelho ou simulador |
| Android | Projeto gerado em `android/`. Não compilado: falta o SDK (plataforma 36 e build-tools). O JDK 21 que o Capacitor pede está em `/opt/homebrew/opt/openjdk@21` |

Depois de mudar o site: `pnpm build && pnpm exec cap sync`.

Prova de compilação do iOS, sem ativar o Xcode no sistema:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project ios/App/App.xcodeproj -scheme App -sdk iphoneos -configuration Debug \
  CODE_SIGNING_ALLOWED=NO build
```

## O que depende do dono

- Escrever `pontuar_rosto` em `pipeline/acervo/rostos.py` (hoje com a regra provisória de área).
- Revisar os 150 itens na folha de revisão.
- Escolher o provedor de modelo e a hospedagem, e gravar a chave no servidor.
- Identificador definitivo do app (`capacitor.config.ts` traz um provisório), contas de loja, política de privacidade publicada.
- Instalar o SDK do Android, ativar o Xcode (`xcode-select` pede sudo) e testar em aparelho.
- As 37 decisões listadas na seção 5 de `docs/pesquisa/dossie.md`.
- Os 17 achados menores da revisão final, em `docs/revisao-final-2026-11-12.md`.
