# Eu Não Sei Me Comunicar

Obra interativa em fundo preto. A pessoa faz três escolhas entre pinturas, sons e palavras e recebe uma frase, em segunda pessoa, que descreve o que a seleção comunica. Idiomas: pt-BR, en, zh-CN.

A frase afirma o que a **seleção** comunica. Ela não diagnostica, não aconselha e não é avaliação de saúde.

- Desenho: `docs/superpowers/specs/2026-11-12-eu-nao-sei-me-comunicar-design.md`
- Plano: `docs/superpowers/plans/2026-11-12-eu-nao-sei-me-comunicar.md`
- Fatos conferidos: `docs/pesquisa/dossie.md`
- Capturas de tela: `docs/capturas/`

## Rodar

```bash
pnpm install
pnpm dev                 # site em http://localhost:5173, com a função em /api/interpretar
pnpm build               # site de produção em dist/ (cerca de 15 MB, com o acervo dentro)
pnpm test                # testes de unidade (frase, servidor, interface)
pnpm e2e                 # constrói e roda os testes de navegador, em celular e em tela larga

cd pipeline
uv run pytest -q         # testes do acervo
uv run pytest -m rede    # os que usam rede (DOIs no Crossref)
```

Sem chave de modelo e sem rede o site funciona inteiro: a frase é composta por regra, no aparelho.

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
- Só CC0 para pintura e som. Sem voz humana nos sons.

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
| `FRASE_MODELO` | Troca o modelo. Padrão: `claude-opus-5-5` |
| `FRASE_PROVEDOR=nenhum` | Desliga o modelo mesmo com chave |
| `VITE_API_BASE` | No site: endereço da função. Vazio: modo de demonstração, tudo no aparelho |

A função recebe só três identificadores e o idioma. Ela recusa origem de navegador fora da lista (403), tipo de conteúdo sem preflight (415) e corpo acima de 1 KB (413). **Antes de publicar com chave**, ponha limite de pedidos por cliente na hospedagem: quem chama sem navegador não manda origem, e contar pedidos por IP é trabalho da hospedagem.

O servidor de produção ainda não tem adaptador: `criarInterpretar` recebe um `Request` e devolve um `Response`, e o adaptador da hospedagem escolhida é um arquivo de poucas linhas.

## Estado, medido em 12/Nov/2026

- Acervo: 30 pinturas (20 com rosto de destaque), 30 sons, 90 palavras. 150 itens com revisão pendente. Glossário com 34 construtos e 4 termos de dimensão.
- Testes: 91 em Python, 248 de unidade em TypeScript, 34 de navegador.
- Validador: rejeita 33 de 33 frases defeituosas do conjunto de regressão e aceita 18 de 18 de referência.
- Sonda do pré-prompt com modelo real: 17 de 18 respostas aprovadas na primeira tentativa. A reprovada, em mandarim, não tinha verbo de mensagem. Uma tentativa de injeção plantada nas tags de um som foi tratada como dado nos três idiomas.
- Pareamento cego: um juiz que só viu o texto humano dos itens ligou 6 de 6 frases por regra à seleção certa.
- Sem rede: depois da primeira visita, o site funciona inteiro (teste de navegador corta a rede e refaz o fluxo).

### NÃO PROVADO

- Nenhuma chamada à API de um provedor. A sonda e o pareamento usaram subagentes da sessão de desenvolvimento, dentro de outro arnês.
- Nada rodou em aparelho. Som em iPhone real, instalação da PWA e o app do Capacitor em uso ficam por testar.
- O pareamento cego usou modelo como juiz, não gente.

### Revisão nativa pendente

Os moldes da frase em inglês e em mandarim (`src/frase/moldes/`), os termos em mandarim do glossário e o título em mandarim foram escritos com apoio de modelo.

## Plataformas

| Plataforma | Estado |
|---|---|
| Web | Pronta. PWA instalável, com manifesto, ícones e service worker |
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
