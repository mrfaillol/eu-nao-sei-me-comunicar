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
- O que vai para a Vercel é só o site estático (`dist/`), configurado em `vercel.json`. A função `interpretar` não é publicada: sem chave de modelo ela só repetiria a frase por regra, que o navegador já compõe sozinho.
- A Vercel não espera o CI: ela publica o que chegar na `main`. Quem segura código quebrado é a revisão do pull request, com o CI verde antes de mesclar.
- No plano gratuito da Vercel, commit de repositório privado só é publicado quando o autor é reconhecido pelo GitHub. Por isso o `git config user.email` deste repositório usa o e-mail `noreply` da conta.

Depois de publicar, `node scripts/fumaca-producao.mjs` faz o fluxo inteiro contra a URL de produção (celular, tela larga, três idiomas e sem rede) e sai com erro se algo falhar.

O acervo publicado é o de demonstração: os 150 itens estão com revisão humana pendente e o site diz isso nos créditos.

## Como a pessoa usa

- Cada janela mostra três opções e um botão para trocar por outras três. Escolher não tem teto; com três escolhas o botão **Ver a frase** acende na barra de tarefas. A frase não abre sozinha.
- A frase conta quantos itens foram reunidos, nomeia o tema que mais se repete e até três ao fundo. Os demais termos da seleção ficam listados na caixa, com definição e DOI.
- Fechar a caixa (Esc ou **Escolher mais**) conserva a seleção. **Recomeçar** apaga.
- O **(i)** acima de cada item abre uma caixa: nas pinturas, palavras tiradas do texto de curadoria do museu; nos sons, as tags de quem publicou; nas palavras, a definição do dicionário. Nenhuma palavra é escrita pelo site: `src/ui/descritores.ts` só separa, tira palavras vazias e amostra o texto humano do item. As palavras ficam no idioma em que foram escritas (inglês).
- Limitação conhecida: a definição das palavras em português e em mandarim está em inglês, porque vem do Wiktionary em inglês e de Zheng et al. (2023).
- No canto direito da barra ficam a assinatura do autor, com link para https://vingren.me, e a foice e o martelo.

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
uv run python -m acervo montar       # grava public/indice/ e confere as invariantes
uv run python -m acervo revisao      # gera revisao/index.html
```

Regras que o pipeline faz valer:

- Nenhum item entra sem texto escrito por gente: descrição da curadoria (pintura), título e tags do autor (som), glosa de dicionário (palavra).
- Cada anotação de pintura e de som cita o trecho literal do texto humano que a sustenta. Item cujo texto não sustenta nenhum construto sai do acervo (`data/pinturas-excluidas.txt`, `data/sons-excluidos.txt`).
- Todo construto do glossário tem referência com DOI que resolve no Crossref.
- Só CC0 para pintura e som.
- Os sons vêm de termos de busca sem voz e passam por uma lista de termos barrados em título e tags. Isso reduz, mas não garante, a ausência de voz ou de conteúdo impróprio: quem garante é a escuta humana, na folha de revisão.

### Revisão humana

Todo item nasce com revisão pendente, e o site avisa nos créditos que o acervo é de demonstração. Para publicar:

1. `uv run python -m acervo revisao` e abra `revisao/index.html`.
2. Veja cada pintura com as caixas de rosto, ouça cada som, leia cada palavra. Aprove ou reprove, escreva o seu nome e baixe `decisoes.json`.
3. Salve o arquivo em `pipeline/revisao/decisoes.json`.
4. `uv run python -m acervo rostos` (se trocou algum rosto de destaque) e `uv run python -m acervo montar --publicavel`.

A aprovação vale só para o conteúdo revisado: se o pipeline rodar de novo e mudar o texto ou o arquivo de um item, a aprovação dele volta a pendente.

## A função da frase

| Variável | Efeito |
|---|---|
| `ANTHROPIC_API_KEY` | Liga o modelo. Sem ela, a função responde só pela regra |
| `FRASE_MODELO` | Troca o modelo. Padrão: `claude-opus-5-5`, o mais caro da família; a escolha do modelo é do dono e o plano original previa um menor |
| `FRASE_PROVEDOR=nenhum` | Desliga o modelo mesmo com chave |
| `VITE_API_BASE` | No site: endereço da função. Vazio: modo de demonstração, tudo no aparelho |

A função recebe só os identificadores das escolhas (três ou mais) e o idioma. Ela recusa origem de navegador fora da lista (403), tipo de conteúdo sem preflight (415) e corpo acima de 16 KB (413). Com mais de doze itens ela responde pela regra, sem chamar o modelo: o pedido levaria o texto de todos os itens e a frase nomeia no máximo quatro termos. **Antes de publicar com chave**, ponha limite de pedidos por cliente na hospedagem: quem chama sem navegador não manda origem, e contar pedidos por IP é trabalho da hospedagem.

O servidor de produção ainda não tem adaptador: `criarInterpretar` recebe um `Request` e devolve um `Response`, e o adaptador da hospedagem escolhida é um arquivo de poucas linhas.

## Estado, medido em 12/Nov/2026

- Acervo: 30 pinturas (20 com rosto de destaque), 30 sons, 90 palavras. 150 itens com revisão pendente. Glossário com 34 construtos e 4 termos de dimensão.
- Testes: 92 em Python, 293 de unidade em TypeScript, 64 de navegador (celular e tela larga, só em Chromium).
- Validador: rejeita 33 de 33 frases defeituosas do conjunto de regressão e aceita 18 de 18 de referência. **É uma barreira, não uma prova.** A revisão final fez passar 13 frases que atribuíam estado à pessoa ou aconselhavam ("o medo que te consome", "you're anxious"); hoje elas são rejeitadas e viraram teste, mas a regra continua sendo lista, com furos por natureza.
- O compositor por regra não gera frase reprovada: conferido pelo revisor em 352.440 frases (todos os trios do índice, nos três idiomas) e, no repositório, por um teste sobre uma amostra fixa.
- Sonda do pré-prompt com modelo real: 17 de 18 respostas aprovadas na primeira tentativa. A reprovada, em mandarim, não tinha verbo de mensagem. Uma tentativa de injeção plantada nas tags de um som foi tratada como dado nos três idiomas.
- Pareamento cego: um juiz que só viu o texto humano dos itens ligou 6 de 6 frases por regra à seleção certa.
- Sem rede: depois da primeira visita, o site funciona inteiro (teste de navegador corta a rede e refaz o fluxo).

### Antes de ligar o modelo

1. Medir a taxa de escape do validador com saída real do provedor escolhido, nos três idiomas, e ler uma amostra das frases aprovadas.
2. Pôr limite de pedidos por cliente na hospedagem.
3. Sondar o pré-prompt de novo: a versão `2026-11-12.2` passou a dizer "três ou mais itens", e a sonda de 17 em 18 foi feita com a versão anterior, sempre com três.
4. Confirmar na primeira chamada que o pedido é aceito. Que `claude-opus-5-5` rejeita `temperature` foi lido na documentação do SDK, não medido. Falha do provedor aparece no registro do servidor como `[interpretar] caminho do modelo falhou: <tipo>`.

### NÃO PROVADO

- Nenhuma chamada à API de um provedor. A sonda e o pareamento usaram subagentes da sessão de desenvolvimento, dentro de outro arnês.
- Nada rodou em aparelho. Som em iPhone real, instalação da PWA e o app do Capacitor em uso ficam por testar. Hipótese a testar primeiro: o service worker entrega os `.mp3` sem tratar pedidos com `Range`, e o Safari costuma recusar isso; se valer, os sons não tocam na PWA instalada no iPhone (dentro do app Capacitor não há service worker e a hipótese não se aplica).
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
