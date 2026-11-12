# Eu Não Sei Me Comunicar — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o site instalável em que a pessoa faz três escolhas entre pinturas, sons e palavras e recebe uma frase em segunda pessoa que descreve o que a seleção comunica, em pt-BR, en e zh-CN, com o projeto Capacitor preparado para iOS e Android.

**Architecture:** Um pipeline em Python monta antes um índice curado (`public/indice/acervo.json`) com texto humano, construtos de um glossário fechado e cópia local da mídia. O compositor e o validador da frase existem uma vez, em TypeScript (`src/frase/`), e rodam no navegador e na função do servidor; sem chave e sem rede o app é um site estático completo. O servidor só acrescenta o LLM, com duas tentativas validadas e volta para o compositor.

**Tech Stack:** Python 3.12 com uv, OpenCV 5 (YuNet), Pillow, ffmpeg; Node 22, pnpm, Vite, TypeScript sem framework, Vitest, Playwright; vite-plugin-pwa; Capacitor 8.6.

**Spec:** `docs/superpowers/specs/2026-11-12-eu-nao-sei-me-comunicar-design.md`. Fatos de base: `docs/pesquisa/dossie.md` e os seis relatórios da mesma pasta.

**Recorte:** o desenho cobre quatro subsistemas ligados por um contrato (o esquema do acervo). Este plano os mantém em um arquivo, em quatro partes; cada parte termina em software que roda e se testa sozinho. Deploy, loja e chave de LLM ficam fora e pedem GO do dono.

**Ordem de execução (decidida no grill-me de 12/Nov):** 1, 2, depois a Parte B inteira (9, 10, 11, 12), depois 3 a 8, depois 13 a 18. A frase é o produto e só depende do glossário e de casos de teste; ela é provada antes de o acervo ser montado. A numeração das tarefas segue a ordem de dependência dos dados e não muda.

## Global Constraints

- Fundo da página `#000`. Movimento só com `transform` e `opacity`; `prefers-reduced-motion: reduce` zera a duração.
- Idiomas: `pt-BR`, `en`, `zh-CN`. Toda chave de texto existe nos três.
- Textos do dono, literais em pt-BR: título "Eu Não Sei Me Comunicar"; janelas "Prefiro Me Explicar Escolhendo Imagens Que Me Despertam…", "Prefiro Me Comunicar Ouvindo Sons Que Representem O Que Sinto", "Prefiro Escolher Palavras Soltas".
- Frase: uma única, segunda pessoa, de 15 a 45 palavras em pt-BR e en, de 25 a 80 ideogramas em zh-CN, de 2 a 4 termos do glossário, todos presentes nas anotações dos três itens.
- A frase afirma o que a seleção comunica. Nunca atribui transtorno, sintoma ou diagnóstico, nunca aconselha, nunca menciona ajuda.
- O cliente envia só `{ itens: [id, id, id], idioma }`. Nenhum texto livre, nenhum dado pessoal, nenhum registro de IP.
- Prazo da função: 8.000 ms. Depois disso vale a frase por regra.
- Licenças aceitas no acervo: `CC0-1.0` para pintura e som; `CC-BY-SA-4.0` para glosa; `CC-BY-4.0` e `CC0-1.0` para normas de afeto.
- Nenhum item sem texto escrito por gente. Todo item nasce com `revisao.humana = "pendente"`.
- Índice de demonstração: 30 pinturas, 30 sons, 30 palavras por idioma.
- Som: só `source=freesound`, `license=cc0`, de 2.000 a 20.000 ms, 3 tags ou mais, sem voz humana.
- Openverse: no máximo 200 chamadas por dia, 3 s entre chamadas, `User-Agent: art-index-probe/1.0`. CMA e Wikcionário: 1 s entre chamadas.
- Teste automático não usa rede. Teste que usa rede leva o marcador `rede` e roda só por comando explícito.
- Nada de trabalho em `/tmp`. Captura de tela vai para `docs/capturas/`.
- Ramo `v1`. Commit local ao fim de cada tarefa. Sem remoto, sem push, sem deploy.
- Identificadores de código em português, como nos protótipos de `docs/pesquisa/`.

## Review Focus

1. **Dois sons ao mesmo tempo, ou som que segue tocando depois da escolha.** Tocar um som pausa o anterior; escolher, ver o resultado e recomeçar param o áudio. Teste na Tarefa 15.
2. **Sem rede, ou função lenta, na terceira escolha.** A frase por regra aparece em até 8.000 ms. Teste na Tarefa 16.
3. **Toque duplo na terceira escolha.** Nunca entram 4 itens e sai um pedido só. Testes nas Tarefas 14 e 16.
4. **Troca de idioma com seleção em curso.** As escolhas ficam, a palavra já escolhida mantém o rótulo original, a janela de palavras redistribui no idioma novo e a frase sai no idioma novo. Teste na Tarefa 14.
5. **Janela esgotada.** Com menos de 3 itens ainda não vistos, a distribuição recomeça o ciclo sem repetir item escolhido e sem travar. Teste na Tarefa 14.

## Estrutura de arquivos

```
data/acervo.schema.json        contrato do item e do acervo
data/fontes.json               fontes e licenças aceitas
data/construtos.json           glossário fechado
data/palavras/{pt-BR,en,zh-CN}.json
data/sons-termos.txt  data/sons-barrados.txt  data/ajuda.json
pipeline/pyproject.toml
pipeline/acervo/{esquema,referencias,glosas,afeto,pinturas,rostos,sons,montar,revisao,__main__}.py
pipeline/anotacoes/{pinturas,sons}.json     construtos por item, com trecho do texto humano
pipeline/dados/                             candidatas-cma.csv, glasgow-2019.csv, zheng-2023.csv, sinais-por-rosto.tsv
pipeline/modelos/                           yunet .onnx, LICENSE, ORIGEM
pipeline/saida/                             pinturas.json, sons.json, palavras.json (intermediários versionados)
pipeline/tests/  pipeline/tests/fixtures/
src/frase/{tipos,termos,ajuda,validador,assinatura,compositor,prompt}.ts  src/frase/moldes/{pt-BR,en,zh-CN}.ts
src/servidor/{interpretar,dev}.ts  src/servidor/provedores/{tipos,anthropic,openrouter}.ts
src/ui/{main,i18n,janela,selecao,janela-pinturas,janela-sons,janela-palavras,zoom,audio,bandeja,pedido,resultado,creditos,ajuda}.ts
src/i18n/{pt-BR,en,zh-CN}.json  src/estilo/{base,janela}.css
tests/fixtures/{casos,frases}.json          regressão da frase
e2e/{casca,escolha,sem-rede}.spec.ts
public/indice/  public/midia/{pinturas,rostos,sons}/
index.html  vite.config.ts  capacitor.config.ts  android/  ios/  README.md
```

Formato do item (JSON, o mesmo em Python e em TypeScript):

```json
{ "id": "pintura:cma:121946", "tipo": "pintura", "classe_semiotica": "icone", "idioma": null,
  "rotulo": "Portrait of …", "texto_humano": "…", "origem_do_texto": "curadoria",
  "construtos": ["solitude"], "tema_sensivel": false,
  "afeto": { "metodo": "ausente" },
  "credito": { "autor": "…", "linha": "…", "fonte": "cma", "licenca": "CC0-1.0", "url": "https://…" },
  "revisao": { "humana": "pendente", "por": null, "em": null },
  "midia": { "arquivo": "midia/pinturas/cma-121946.webp", "largura": 1275, "altura": 1600 },
  "rosto": { "x": 0.4389, "y": 0.1838, "w": 0.1272, "h": 0.1477 }, "nitido": "midia/rostos/cma-121946.jpg",
  "sensivel": { "nudez": "nenhuma", "violencia": "nenhuma" } }
```

`tipo` ∈ `pintura | som | palavra`; `classe_semiotica` ∈ `icone | indice | simbolo`; `origem_do_texto` ∈ `curadoria | titulo_e_tags | glosa`; `idioma` só em palavra; `afeto` é `{metodo:"ausente"}` ou `{metodo:"norma_direta", valencia: −1..1, ativacao: 0..1, fonte}`; `midia` de som é `{arquivo, duracao_ms}`; `rosto`, `nitido` e `sensivel` só em pintura. Ids: `pintura:cma:<id>`, `som:freesound:<id>`, `palavra:<idioma>:<palavra>`.

---

# Parte A — O acervo

### Task 1: Fundação e contrato do acervo

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `pipeline/pyproject.toml`, `pipeline/acervo/__init__.py`, `pipeline/acervo/esquema.py`, `data/acervo.schema.json`, `data/fontes.json`, `src/frase/tipos.ts`, `README.md`
- Create (resgate de `pipeline/cache/resgate-2026-11-12/`): `pipeline/dados/{candidatas-cma.csv,glasgow-2019.csv,zheng-2023.csv,sinais-por-rosto.tsv}`, `pipeline/modelos/face_detection_yunet_2023mar.onnx` com `LICENSE.txt` e `ORIGEM.txt` (URL e sha256 `8f2383e4…2fa4`), `pipeline/tests/fixtures/rostos/` (6 retratos e 2 "outras", uma delas página só de texto), `pipeline/tests/fixtures/cma-10.json`, `pipeline/tests/fixtures/openverse-rain.json`, `tests/fixtures/casos.json` (cópia de `docs/pesquisa/pre-prompt-casos.json`), `tests/fixtures/frases.json`
- Test: `pipeline/tests/test_esquema.py`

**Interfaces:**
- Produces: `validar_item(item: dict, construtos: set[str], fontes: dict) -> list[str]` (lista de erros, vazia se válido); tipos `Idioma`, `Tipo`, `Item`, `Glossario`, `Construto` em `src/frase/tipos.ts`, espelhando o JSON acima; `tests/fixtures/frases.json` com as chaves `legitimas` (36), `clinicas` (12) e `defeituosas` (33), cada entrada `{ idioma, frase, caso }`.

- [ ] **Step 1:** `git checkout -b v1`. Criar os arquivos de configuração: scripts `test` (`vitest run`), `build` (`tsc --noEmit && vite build`), `dev`, `e2e` (`playwright test --trace off`); dependências de Python `opencv-python-headless`, `numpy`, `pillow`, `jsonschema`, `pytest`; marcador `rede` registrado no `pyproject.toml` e excluído por padrão (`addopts = "-m 'not rede'"`).
- [ ] **Step 2:** Resgatar os arquivos listados. Extrair de `wf/conferente-pre-prompt/sonda*.py` e `wf/conferente-pre-prompt-lingua/scripts/sondas.py` as frases para `tests/fixtures/frases.json` e conferir as contagens 36, 12 e 33. Se uma contagem não bater, registrar a contagem real no arquivo e seguir.
- [ ] **Step 3:** Escrever os testes que falham em `test_esquema.py`:
  - `test_item_valido_passa`: o item de exemplo deste plano devolve `[]`.
  - `test_licenca_fora_do_catalogo_reprova`: `credito.licenca = "CC-BY-NC-4.0"` devolve erro contendo `licenca`.
  - `test_construto_fora_do_glossario_reprova`: `construtos = ["inexistente"]` devolve erro contendo `construto`.
  - `test_sem_texto_humano_reprova`: `texto_humano = ""` devolve erro contendo `texto_humano`.
  - `test_afeto_ausente_nao_tem_numero`: `{"metodo":"ausente","valencia":0.1}` devolve erro contendo `afeto`.
  - `test_som_cc_by_reprova`: som com `licenca = "CC-BY-4.0"` devolve erro (só `CC0-1.0` para som e pintura).
- [ ] **Step 4:** `cd pipeline && uv run pytest -q` → falha por `validar_item` inexistente.
- [ ] **Step 5:** Implementar `data/acervo.schema.json` (JSON Schema 2020-12), `data/fontes.json` (`cma`, `freesound-via-openverse`, `wikcionario-en`, `zheng-2023`, `glasgow-2019`, cada uma com `nome`, `url`, `licenca`, `credito`) e `validar_item` (schema, mais as regras de licença por tipo e de afeto que o schema não expressa).
- [ ] **Step 6:** `uv run pytest -q` → 6 passam. `pnpm install && pnpm exec tsc --noEmit` → sem erro.
- [ ] **Step 7:** Commit `fundação: contrato do acervo, dados resgatados e configuração`.

### Task 2: Glossário de construtos com referência conferida

**Files:**
- Create: `data/construtos.json`, `pipeline/acervo/referencias.py`
- Test: `pipeline/tests/test_construtos.py`

**Interfaces:**
- Produces: `conferir_doi(doi: str) -> dict | None` (`{titulo, ano, url}` via `https://api.crossref.org/works/<doi>`, ano de `published-print` ou `published-online`, nunca `issued`); entrada do glossário:

```json
{ "id": "nostalgia", "dimensao": false,
  "termo": { "pt-BR": "nostalgia", "en": "nostalgia", "zh-CN": "怀旧" },
  "variantes": { "pt-BR": ["nostálgic"], "en": ["nostalgic"], "zh-CN": [] },
  "definicao": { "pt-BR": "…", "en": "…", "zh-CN": "…" },
  "referencia": { "doi": "10.1037/0022-3514.91.5.975", "citacao": "Wildschut, Sedikides, Arndt e Routledge (2006)", "titulo_contem": "Nostalgia" },
  "revisao": { "humana": "pendente" } }
```

Candidatos, com DOI **de memória, a conferir um a um**; o que não resolver, ou cujo título no Crossref não contiver `titulo_contem`, sai do glossário:

| id | referência | DOI |
|---|---|---|
| nostalgia | Wildschut et al. (2006) | 10.1037/0022-3514.91.5.975 |
| pertencimento | Baumeister e Leary (1995) | 10.1037/0033-2909.117.3.497 |
| apego | Hazan e Shaver (1987) | 10.1037/0022-3514.52.3.511 |
| solidao | Russell, Peplau e Cutrona (1980) | 10.1037/0022-3514.39.3.472 |
| solitude | Long e Averill (2003) | 10.1111/1468-5914.00204 |
| restauracao_da_atencao | Kaplan (1995) | 10.1016/0272-4944(95)90001-2 |
| habituacao | Thompson e Spencer (1966) | 10.1037/h0022681 |
| contagio_emocional | Hatfield, Cacioppo e Rapson (1993) | 10.1111/1467-8721.ep10770953 |
| alienacao | Seeman (1959) | 10.2307/2088565 |
| anomia | Srole (1956) | 10.2307/2088422 |
| tedio | Eastwood et al. (2012) | 10.1177/1745691612456044 |
| assombro | Keltner e Haidt (2003) | 10.1080/02699930302297 |
| luto | Stroebe e Schut (1999) | 10.1080/074811899201046 |
| vigilancia | Mackworth (1948) | 10.1080/17470214808416738 |
| sobrecarga_sensorial | Milgram (1970) | 10.1126/science.167.3924.1461 |
| ambivalencia | Kaplan (1972) | 10.1037/h0032590 |
| esperanca | Snyder et al. (1991) | 10.1037/0022-3514.60.4.570 |
| memoria_autobiografica | Conway e Pleydell-Pearce (2000) | 10.1037/0033-295X.107.2.261 |
| empatia | Davis (1983) | 10.1037/0022-3514.44.1.113 |
| interocepcao | Craig (2002) | 10.1038/nrn894 |
| curiosidade | Loewenstein (1994) | 10.1037/0033-2909.116.1.75 |
| apego_ao_lugar | Scannell e Gifford (2010) | 10.1016/j.jenvp.2009.09.006 |

Termos de dimensão (`"dimensao": true`, referência Russell 1980, DOI 10.1037/h0077714): `valencia_negativa`, `valencia_positiva`, `alta_ativacao`, `baixa_ativacao`.

Fora do glossário por regra: termo que nomeia sintoma ou transtorno (ansiedade, anedonia, ruminação, hipervigilância, desamparo, desesperança, esgotamento).

- [ ] **Step 1:** Testes que falham: `test_tres_idiomas` (todo `termo` e toda `definicao` têm as três chaves, não vazias); `test_ids_em_snake_case_e_unicos`; `test_nenhum_termo_da_lista_de_sintomas`; `test_minimo_de_construtos` (ao menos 16 com `dimensao: false` e exatamente os 4 de dimensão); `test_doi_resolve` com marcador `rede` (para cada entrada, `conferir_doi` devolve título que contém `titulo_contem`, sem diferenciar maiúsculas).
- [ ] **Step 2:** `uv run pytest -q tests/test_construtos.py` → falha por arquivo ausente.
- [ ] **Step 3:** Implementar `conferir_doi` e escrever `data/construtos.json`. Definição em uma frase por idioma, descrevendo o construto como a referência o define. Termo em zh-CN no uso da literatura continental; onde houver dúvida, registrar em `revisao.nota`.
- [ ] **Step 4:** `uv run pytest -q -m rede tests/test_construtos.py`. Remover do glossário cada construto reprovado e anotar no commit quais caíram. `uv run pytest -q` → passa.
- [ ] **Step 5:** Commit `glossário: N construtos com DOI conferido no Crossref`.

### Task 3: Palavras, glosa humana e norma direta de afeto

**Files:**
- Create: `data/palavras/{pt-BR,en,zh-CN}.json`, `pipeline/acervo/glosas.py`, `pipeline/acervo/afeto.py`, `pipeline/saida/palavras.json`, `pipeline/tests/fixtures/wikcionario-saudade.json`
- Test: `pipeline/tests/test_palavras.py`

**Interfaces:**
- Consumes: `validar_item`, `data/construtos.json`.
- Produces: `listar_sentidos(palavra: str, secao: str) -> list[str]` (todas as definições da seção, sem HTML); `buscar_glosa(palavra: str, secao: str, sentido: int) -> dict | None` (`{texto, url, licenca: "CC-BY-SA-4.0"}`; `secao` é a chave do idioma na resposta de `https://en.wiktionary.org/api/rest_v1/page/definition/<palavra>`: `pt` ou `en`; `sentido` é o índice em `listar_sentidos`; texto copiado sem alteração, até 600 caracteres); `normalizar_valencia(valor, minimo, maximo) -> float` (para −1..1); `normalizar_ativacao(valor, minimo, maximo) -> float` (para 0..1); `norma_glasgow(palavra) -> dict | None`; `norma_zheng(palavra) -> dict | None`; `para_item_palavra(entrada, idioma) -> dict`.
- Entrada das listas: `{ "palavra": "saudade", "sentido": 0, "construtos": ["nostalgia", "apego"], "tema_sensivel": false }`. Em zh-CN não há `sentido`.

Medido em 12/Nov: o endpoint do Wikcionário responde 200 para `saudade` e `ennui` e 404 para `无奈`. A primeira definição é o sentido errado em 4 de 12 palavras testadas (`fossa`, `marasmo`, `numb`, `restless`), então o sentido é escolhido palavra a palavra, lendo `uv run python -m acervo sentidos <palavra> <secao>`. Palavra cujo sentido de estado mental não existe na seção sai da lista. A lista de zh-CN é a mais fraca das três: as glosas de Zheng são curtas e algumas são ruins; escolher só linhas cuja `Translation` descreve um estado mental de forma clara. Por isso:
- **pt-BR:** glosa da seção `pt`; `afeto` ausente.
- **en:** glosa da seção `en`; afeto do Glasgow (colunas `VAL` e `AROU`, escala de 1 a 9; ignorar linha cujo `Words` tem parênteses).
- **zh-CN:** lista tirada das 264 linhas com `VAL_ARO_SOURCE = "Questionnaires"` de `zheng-2023.csv`; `texto_humano` é a coluna `Translation` (glosa dos autores, CC0, `origem_do_texto: "glosa"`, `credito.fonte: "zheng-2023"`); afeto das colunas `VAL` e `ARO`.

- [ ] **Step 1:** Ler no artigo de Zheng et al. (2023) ou no registro do Figshare (`api.figshare.com/v2/articles/20209859`) a escala nominal de `VAL` e de `ARO`. Medido no arquivo: `VAL` de −2,42 a 2,48 e `ARO` de 0,50 a 3,74. Sem a escala nominal confirmada, as palavras de zh-CN ficam com `afeto.metodo = "ausente"` e o motivo vai em `data/fontes.json`.
- [ ] **Step 2:** Testes que falham:
  - `test_normalizacao`: `normalizar_valencia(5, 1, 9) == 0.0`, `(1, 1, 9) == -1.0`, `(9, 1, 9) == 1.0`; `normalizar_ativacao(1, 1, 9) == 0.0`, `(9, 1, 9) == 1.0`.
  - `test_glasgow_ignora_sentido_com_parenteses`.
  - `test_zheng_so_questionario`: o carregador expõe exatamente 264 palavras.
  - `test_glosa_da_fixture`: sobre `wikcionario-saudade.json`, `listar_sentidos(secao="pt")` devolve ao menos 1 texto sem `<`; `buscar_glosa(..., sentido=0)` devolve esse texto com até 600 caracteres; `sentido=99` devolve `None`.
  - `test_listas`: cada lista final tem 30 palavras; nenhuma palavra aparece em duas listas; todo construto existe no glossário; todo item passa em `validar_item`.
- [ ] **Step 3:** `uv run pytest -q tests/test_palavras.py` → falha.
- [ ] **Step 4:** Implementar `glosas.py` e `afeto.py`. Escrever 40 candidatas por idioma: palavras de estado mental muito específico, próprias de cada língua, sem nome de transtorno. `uv run python -m acervo palavras` busca a glosa (1 s entre chamadas, cache em `pipeline/cache/glosas/`), descarta palavra sem glosa e grava as 30 primeiras de cada idioma em `pipeline/saida/palavras.json`. Menos de 30 com glosa: acrescentar candidatas e rodar de novo.
- [ ] **Step 5:** `uv run pytest -q` → passa. Conferir no terminal: `30 30 30`, e quantas têm `norma_direta` por idioma.
- [ ] **Step 6:** Commit `palavras: três listas com glosa humana e norma direta`.

### Task 4: Pinturas

**Files:**
- Create: `pipeline/acervo/pinturas.py`, `pipeline/saida/pinturas.json`, `public/midia/pinturas/`
- Test: `pipeline/tests/test_pinturas.py`

**Interfaces:**
- Produces: `selecionar(candidatas: list[dict], total: int = 30) -> list[dict]`; `limpar_texto(bruto: str, limite: int = 600) -> str`; `gerar_copia(origem: Path, destino: Path, lado: int = 1600) -> dict` (`{arquivo, largura, altura}`); `para_item_pintura(ficha: dict, midia: dict) -> dict`.

Regras de `selecionar`, sobre `candidatas-cma.csv` (1.174 linhas, medido):
- cota por época para 30: `antes de 1400` 4, `1400-1599` 7, `1600-1799` 7, `1800-1899` 7, `1900+` 5;
- teto de 6 por `regiao`; piso de 12 com `retrato` em `generos_por_palavra`;
- ordem determinística: `destaque_do_museu` decrescente, depois `id_cma` crescente;
- ficam fora, ao ler a ficha na API: proporção fora de 1:2 a 2:1, e `description` com menos de 200 caracteres depois de limpa. Cada exclusão puxa a próxima candidata da mesma época.

- [ ] **Step 1:** Testes que falham:
  - `test_selecao_respeita_cotas`: sobre o CSV real, 30 linhas, com as cotas, o teto e o piso acima.
  - `test_selecao_deterministica`: duas chamadas devolvem a mesma lista de ids.
  - `test_limpar_texto`: `"<em>Hurd</em> was… https://x.org\u0007"` sai sem tag, sem URL e sem caractere de controle; texto de 900 caracteres sai com até 600 e termina em fim de frase.
  - `test_copia_em_srgb`: sobre uma fixture com perfil Adobe RGB, a saída é WebP, lado maior ≤ 1.600, sem ampliar imagem menor, com perfil sRGB ou sem perfil depois de convertida.
  - `test_item_passa_no_esquema`: `para_item_pintura` sobre um registro de `cma-10.json` devolve item com `origem_do_texto == "curadoria"`, `classe_semiotica == "icone"`, `credito.licenca == "CC0-1.0"`, `credito.linha` igual ao `tombstone`, `rosto is None`.
- [ ] **Step 2:** `uv run pytest -q tests/test_pinturas.py` → falha.
- [ ] **Step 3:** Implementar. `para_item_pintura` lê só `description` (ignora `images.annotation` e `alternate_images`). `gerar_copia` usa Pillow com `ImageCms` e WebP qualidade 80.
- [ ] **Step 4:** `uv run pytest -q` → passa.
- [ ] **Step 5:** `uv run python -m acervo pinturas --total 30`: lê a ficha de cada selecionada na API do CMA, baixa `images.print` para `pipeline/cache/prints/`, gera a cópia e grava `pipeline/saida/pinturas.json`. Esperado: 30 arquivos `.webp`; imprimir o total em MB.
- [ ] **Step 6:** Commit `pinturas: 30 obras CC0 do CMA com cópia local`.

### Task 5: Rosto de maior destaque

**Files:**
- Create: `pipeline/acervo/rostos.py`, `public/midia/rostos/`
- Modify: `pipeline/saida/pinturas.json` (campos `rosto` e `nitido`)
- Test: `pipeline/tests/test_rostos.py`

**Interfaces:**
- Produces: `detectar(imagem: np.ndarray) -> list[dict]` (caixas `{x, y, w, h, conf, pontos}` normalizadas de 0 a 1, cortadas em [0, 1], com 4 casas); `sinais(imagem, caixa) -> dict` com `area`, `larg_rel`, `dist_centro`, `conf`, `nitidez_96`, `contraste_rms`, `figura_fundo`, `frontal`, definidos em `docs/pesquisa/zoom-no-rosto.md` seção (b); `pontuar_rosto(s: dict) -> float`; `escolher_destaque(rostos: list[dict], piso_largura: float = 0.03, manual: int | None = None) -> int | None`; `recortar_nitido(print_: Path, caixa: dict, destino: Path, lado: int = 840) -> None`.

Regras medidas no dossiê: detectar em cópias com lado maior de 640, 900 e 480 px, nunca no print cheio; unir caixas com IoU ≥ 0,4 mantendo a de maior confiança; limiar 0,6; um detector só, com `cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)` antes de criá-lo. `escolher_destaque`: `manual` vence; rosto com `larg_rel < piso_largura` sai; sem rosto restante devolve `None`; senão o índice de maior `pontuar_rosto`.

**`pontuar_rosto` é escrita pelo dono.** O corpo nasce com `# TODO(human)` e uma regra provisória (`return s["area"]`), para o pipeline rodar antes de a função chegar.

- [ ] **Step 1:** Testes que falham:
  - `test_retratos_tem_o_rosto_principal`: nas 6 fixtures de retrato, alguma caixa tem o centro a menos de 0,05 do centro da linha `destaque_humano = sim` de `sinais-por-rosto.tsv`.
  - `test_coordenadas_normalizadas`: toda caixa tem `0 <= x`, `x + w <= 1`, `0 <= y`, `y + h <= 1`.
  - `test_pagina_de_texto_sem_rosto`: a fixture só de texto devolve `[]`.
  - `test_piso`: `escolher_destaque([{"larg_rel": 0.02, …}])` devolve `None`.
  - `test_manual_vence`: `manual=1` devolve `1` mesmo com pontuação menor.
  - `test_gabarito_do_dono`: para as imagens de `sinais-por-rosto.tsv` com resposta única na coluna `destaque_humano`, `escolher_destaque` acerta ao menos 6 de 8 (a regra provisória de área acerta 6, medido).
- [ ] **Step 2:** `uv run pytest -q tests/test_rostos.py` → falha.
- [ ] **Step 3:** Implementar. `recortar_nitido` porta `alvo()` de `docs/pesquisa/zoom-no-rosto-anexos/recorte.py` e converte para sRGB.
- [ ] **Step 4:** `uv run pytest -q` → passa.
- [ ] **Step 5:** `uv run python -m acervo rostos`: grava `rosto` e `nitido` em cada pintura. Imprimir quantas das 30 ficaram com rosto. Esperado pelo piso de retratos: ao menos 12.
- [ ] **Step 6:** Commit `rostos: detecção em três escalas e destaque com piso de 3%`.

### Task 6: Sons

**Files:**
- Create: `pipeline/acervo/sons.py`, `data/sons-termos.txt`, `data/sons-barrados.txt`, `pipeline/saida/sons.json`, `public/midia/sons/`
- Test: `pipeline/tests/test_sons.py`

**Interfaces:**
- Produces: `class FonteOpenverse(cache: Path, limite_diario: int = 200, intervalo_s: float = 3.0)` com `buscar(termo: str, paginas: int = 1) -> list[dict]` e exceção `LimiteDiario`; `filtrar(resultados: list[dict], barrados: set[str]) -> list[dict]`; `limpar_titulo(titulo: str) -> str`; `escolher_sons(por_termo: dict[str, list[dict]], total: int = 30) -> list[dict]`; `gerar_recorte(url: str, destino: Path) -> dict` (`{arquivo, duracao_ms}`); `para_item_som(r: dict, midia: dict) -> dict`.

Consulta: `https://api.openverse.org/v1/audio/?q=<termo>&source=freesound&license=cc0&length=shortest&page_size=20`. `filtrar` aceita só `license == "cc0"`, `source == "freesound"`, `2000 <= duration <= 20000`, 3 tags ou mais, `mature` falso e nenhum termo barrado em título ou tags (palavra inteira, sem diferenciar maiúsculas). `data/sons-termos.txt` parte de `docs/pesquisa/acervo-sons-termos.tsv`, sem os termos de corpo e de voz. `data/sons-barrados.txt` inclui ao menos: moan, sex, scream, gunshot, baby cry, voice, speech, laugh, whisper, breath, cough, vomit. `escolher_sons` pega um por termo na primeira volta e completa na segunda, em ordem de id. `gerar_recorte` baixa a prévia e roda `ffmpeg -af loudnorm=I=-16:TP=-1.5 -t 20 -ar 44100 -b:a 128k`. `texto_humano` do som: `"<título limpo> | tag, tag, …"`, até 600 caracteres.

- [ ] **Step 1:** Testes que falham, sobre `openverse-rain.json` e dados sintéticos:
  - `test_filtro`: rejeita `by`, 25.000 ms, 1.000 ms, 2 tags e título com `moan`; aceita um CC0 de 12.000 ms com 5 tags.
  - `test_limpar_titulo`: `"Rain, Moderate, C.wav"` vira `"Rain, Moderate, C"`; `"door_slam_02.mp3"` vira `"door slam 02"`.
  - `test_contador_diario`: a 201ª busca sem cache levanta `LimiteDiario`; busca em cache não conta.
  - `test_item_passa_no_esquema`: `tipo == "som"`, `classe_semiotica == "indice"`, `origem_do_texto == "titulo_e_tags"`, `credito.licenca == "CC0-1.0"`, `credito.url` igual ao `foreign_landing_url`.
  - `test_escolha_varia_os_termos`: com 40 termos e `total=30`, nenhum termo aparece duas vezes.
- [ ] **Step 2:** `uv run pytest -q tests/test_sons.py` → falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `uv run pytest -q` → passa.
- [ ] **Step 5:** `uv run python -m acervo sons --total 30`. Esperado: 30 arquivos `.mp3`; imprimir o total em MB e o número de chamadas gastas.
- [ ] **Step 6:** Commit `sons: 30 sons CC0 do Freesound via Openverse`.

### Task 7: Anotação, montagem e invariantes

**Files:**
- Create: `pipeline/anotacoes/pinturas.json`, `pipeline/anotacoes/sons.json`, `pipeline/acervo/montar.py`, `pipeline/acervo/__main__.py`, `data/ajuda.json`, `public/indice/{acervo,construtos,ajuda}.json`
- Test: `pipeline/tests/test_montar.py`

**Interfaces:**
- Consumes: `validar_item`, `pipeline/saida/*.json`.
- Produces: `validar_acervo(itens: list[dict]) -> list[str]`; `montar(destino: Path, apenas_aprovados: bool = False) -> dict` (`{por_tipo, pendentes, erros}`); `public/indice/acervo.json` no formato `{ "versao": "2026-11-12.1", "demonstracao": true, "itens": [...] }`.
- Anotação por item: `{ "<id>": { "construtos": ["…"], "tema_sensivel": false, "sensivel": {"nudez": "nenhuma", "violencia": "nenhuma"}, "anotado_por": "modelo", "trecho": "…" } }`.

Regras:
- `trecho` é substring literal do `texto_humano` do item: a anotação cita a passagem humana que a sustenta.
- De 1 a 3 construtos por pintura e por som, todos do glossário, nenhum de dimensão.
- `validar_acervo`: ids únicos; todo item com 1 a 4 construtos; para cada construto, no máximo 2 itens cujo conjunto de construtos é só ele (garante 2 termos ou mais em qualquer seleção de 3).
- `data/ajuda.json`: `conferido_em: "2026-11-12"`; por idioma, o texto do link, a linha padrão (pt-BR: CVV 188; en: 988; zh-CN: 12356) e o diretório `https://findahelpline.com/pt-BR`, `https://findahelpline.com` e `https://findahelpline.com/zh-CN`.

- [ ] **Step 1:** Testes que falham:
  - `test_trecho_fora_do_texto_reprova`.
  - `test_terceiro_item_de_construto_unico_reprova`: três itens com `construtos == ["luto"]` geram erro; dois não geram.
  - `test_montagem_valida`: sobre fixtures, o arquivo gerado valida no schema e tem `demonstracao == true` enquanto houver pendente.
  - `test_apenas_aprovados`: com `apenas_aprovados=True`, nenhum item pendente ou reprovado entra.
  - `test_ajuda_tem_tres_idiomas`.
- [ ] **Step 2:** `uv run pytest -q tests/test_montar.py` → falha.
- [ ] **Step 3:** Implementar `montar.py` e o `__main__.py` com os comandos `palavras`, `pinturas`, `rostos`, `sons`, `montar`, `revisao`.
- [ ] **Step 4:** Escrever as anotações das 30 pinturas e dos 30 sons lendo o texto humano de cada item. `tema_sensivel: true` quando o texto humano trata de morte, violência ou perda.
- [ ] **Step 5:** `uv run pytest -q` → passa. `uv run python -m acervo montar` → imprime `pintura 30 | som 30 | palavra 90 | pendentes 150 | erros 0`.
- [ ] **Step 6:** Commit `acervo: anotações ancoradas no texto humano e índice de demonstração`.

### Task 8: Folha de revisão humana

**Files:**
- Create: `pipeline/acervo/revisao.py`, `pipeline/revisao/decisoes.json` (inicial `{}`)
- Test: `pipeline/tests/test_revisao.py`

**Interfaces:**
- Produces: `gerar_folha(itens: list[dict], destino: Path) -> None` (um `index.html` autônomo em `revisao/`, fora do `public/`); `aplicar_decisoes(itens: list[dict], decisoes: dict) -> list[dict]`. Decisão: `{ "<id>": { "humana": "aprovada" | "reprovada", "por": "nome", "em": "2026-11-12", "destaque_manual": 0, "nudez": "nenhuma", "violencia": "nenhuma" } }`.

A folha mostra, por item: a pintura com todas as caixas de rosto desenhadas e numeradas, ou o som com `<audio controls>`, ou a palavra com a glosa; o texto humano; os construtos e o trecho; botões aprovar e reprovar; para pintura, nudez, violência e número do rosto de destaque. Um botão baixa `decisoes.json`, que o dono salva em `pipeline/revisao/`. `montar` aplica as decisões antes de validar.

- [ ] **Step 1:** Testes que falham: `test_folha_lista_todos_os_ids`; `test_aprovar_muda_o_estado` (grava `humana`, `por` e `em`); `test_reprovado_fica_fora_do_publicavel`; `test_destaque_manual_troca_o_rosto` (o `rosto` do item passa a ser a caixa indicada).
- [ ] **Step 2:** `uv run pytest -q tests/test_revisao.py` → falha.
- [ ] **Step 3:** Implementar. Para o `destaque_manual`, `pipeline/saida/pinturas.json` guarda todas as caixas aceitas em `rostos`, e o item público leva só a escolhida.
- [ ] **Step 4:** `uv run pytest -q` → passa. `uv run python -m acervo revisao` → gera `revisao/index.html`; abrir e conferir que os 60 itens de mídia e as 90 palavras aparecem.
- [ ] **Step 5:** Commit `revisão: folha para o dono aprovar pintura, som e palavra`.

---

# Parte B — A frase

### Task 9: Termos permitidos e regra de ajuda

**Files:**
- Create: `src/frase/termos.ts`, `src/frase/ajuda.ts`
- Test: `src/frase/termos.test.ts`

**Interfaces:**
- Produces: `termosPermitidos(itens: Item[], idioma: Idioma, glossario: Glossario): Termo[]` com `Termo = { id: string; termo: string; variantes: string[]; itens: string[] }`; `ajudaDestacada(itens: Item[]): boolean`.

Regras: os termos são a união dos construtos dos três itens, ordenados por frequência decrescente e depois por id. Termo de dimensão só entra quando ao menos 2 itens têm `afeto.metodo === "norma_direta"`: média de valência ≤ −0,3 dá `valencia_negativa`, ≥ 0,3 dá `valencia_positiva`; média de ativação ≥ 0,6 dá `alta_ativacao`, ≤ 0,3 dá `baixa_ativacao`. `ajudaDestacada` é verdadeiro com 2 ou mais itens de `tema_sensivel`.

Os casos de `tests/fixtures/casos.json` trazem `valencia` e `ativacao` soltos no item. Criar `tests/fixtures/adaptar.ts` com `itemDoCaso(bruto): Item`, que converte número não nulo em `afeto.metodo = "norma_direta"` e `null` em `"ausente"`, e `glossarioDosCasos(): Glossario`. Todo teste da Parte B usa esse adaptador.

- [ ] **Step 1:** Testes que falham, com o glossário de `tests/fixtures/casos.json`:
  - caso 1 (três palavras com norma): ids `["apego", "nostalgia", "pertencimento", "baixa_ativacao", "valencia_negativa"]`, nessa ordem de grupo (construtos primeiro, dimensão depois).
  - pintura e som sem número mais uma palavra com norma: nenhum termo de dimensão.
  - `idioma = "zh-CN"`: `termo` vem em chinês.
  - `ajudaDestacada`: 1 sensível dá `false`; 2 dão `true`.
- [ ] **Step 2:** `pnpm test src/frase/termos.test.ts` → falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm test` → passa.
- [ ] **Step 5:** Commit `frase: termos permitidos e regra de ajuda`.

### Task 10: Validador

**Files:**
- Create: `src/frase/validador.ts`
- Test: `src/frase/validador.test.ts`

**Interfaces:**
- Consumes: `termosPermitidos`.
- Produces: `validarFrase(frase: string, construtosUsados: string[], itens: Item[], idioma: Idioma, glossario: Glossario): { ok: boolean; codigos: Codigo[] }` com `Codigo = "V2" | "V3" | "V4" | "V5" | "V6" | "V7" | "V8" | "V9" | "V10"`.

Regras, já com os consertos medidos em `docs/pesquisa/dossie.md` seção 2:

| Código | Regra |
|---|---|
| V2 | lista de permissão de caracteres: letras do idioma, espaço, vírgula (em zh-CN `，` e `、`) e um único ponto final (`.` ou `。`) no fim; o rótulo de palavra escolhida passa como está |
| V3 | pt-BR e en: de 15 a 45 palavras; zh-CN: de 25 a 80 caracteres `\p{Script=Han}` |
| V4 | segunda pessoa presente (`você, seu, sua, seus, suas`; `you, your`; `你`); zh-CN com `您` reprova |
| V5 | de 2 a 4 termos permitidos na frase, por termo ou variante; nenhum termo do glossário fora dos permitidos; todo id de `construtosUsados` é permitido e aparece. pt-BR e en casam por palavra inteira; zh-CN casa só em fronteira de `Intl.Segmenter("zh", {granularity: "word"})` |
| V6 | lista de permissão da segunda pessoa: o pronome sujeito só é aceito seguido de verbo do ato de escolher ou de comunicar (`reuniu, escolheu, juntou, pôs, colocou, selecionou, comunica`; `gathered, chose, placed, selected, put, communicate`; `把, 选, 选的, 选择, 放在, 传达`); o possessivo só é aceito antes de `escolhas, seleção, mensagem`, `choices, selection, message`, `选择, 信息`, com até dois modificadores no meio ("your three choices", "suas escolhas sonoras", `你的三个选择`). Mais a lista nosológica por idioma |
| V7 | sem conselho e sem menção de ajuda (`procure, tente, deveria, ajuda, ligue, terapia`; `should, try to, seek, help, therapy, call`; `应该, 建议, 试着, 求助, 帮助, 热线`) |
| V8 | sem dígito, sem nome de teórico ou de teoria, sem `segundo`, `according to`, `根据`, sem o sobrenome em `credito.autor` das pinturas escolhidas |
| V9 | verbo de mensagem presente (`comunica, comunicam, diz, afirma, nomeia`; `communicate, communicates, state, states`; `传达, 说出, 表明`) |
| V10 | pt-BR e en sem ideograma e com voto de palavras funcionais; zh-CN sem palavra latina fora dos rótulos escolhidos e sem caractere só tradicional (lista mínima: 們 這 個 說 會 來 時 為 無 傳 達 選 擇 語 聲 畫 詞) |

- [ ] **Step 1:** Testes que falham:
  - as 18 frases de referência de `casos.json` são aceitas;
  - as 15 mutações de `casos.json` são rejeitadas com o código de `deve_falhar`;
  - de `frases.json`: toda `legitimas` aceita, toda `clinicas` rejeitada com `V6`, toda `defeituosas` rejeitada com algum código;
  - `"…差异化…"` sem `异化` permitido não acusa V5 por substring;
  - frase em zh-CN com `您` dá `V4`; frase com "procure ajuda" dá `V7`.
- [ ] **Step 2:** `pnpm test src/frase/validador.test.ts` → falha.
- [ ] **Step 3:** Implementar. O protótipo `docs/pesquisa/pre-prompt-validador.py` é referência de V3, V8, V9 e V10.
- [ ] **Step 4:** `pnpm test`. Frase de `frases.json` que continuar passando indevidamente fica listada no teste como `it.fails` com o motivo, e o número vai para o commit. Nenhuma frase de `legitimas` pode ser rejeitada.
- [ ] **Step 5:** Commit `frase: validador com listas de permissão`.

### Task 11: Compositor por regra

**Files:**
- Create: `src/frase/assinatura.ts`, `src/frase/compositor.ts`, `src/frase/moldes/{pt-BR,en,zh-CN}.ts`
- Test: `src/frase/compositor.test.ts`

**Interfaces:**
- Consumes: `termosPermitidos`, `ajudaDestacada`, `validarFrase`.
- Produces: `assinatura(itens: Item[]): { tom: "sensivel" | "convergente" | "divergente"; abertura: "pinturas" | "sons" | "palavras" | "mista" }`; `comporFrase(itens: Item[], idioma: Idioma, glossario: Glossario): { frase: string; construtos_usados: string[] }`; moldes no formato `{ doisTermos: Record<Tom, Record<Abertura, string[]>>; umTermo: string; semTermo: string }`.

Regras: `tom` é `sensivel` se `ajudaDestacada`; `convergente` se algum construto aparece em 2 itens ou mais; senão `divergente`. `abertura` é o tipo comum aos três itens, ou `mista`. Em `convergente`, `{c1}` é o construto repetido e `{c2}` o seguinte em frequência; em `divergente`, `{c1}` e `{c2}` vêm de itens diferentes. A variante do molde sai de um hash estável (FNV-1a) dos ids ordenados. Cada idioma tem ao menos 1 molde por célula (12), mais `umTermo` e `semTermo`: 42 moldes ao todo. Em pt-BR a lacuna nunca vem depois de preposição que contrai com artigo. Os moldes de en e de zh-CN são escritos no idioma, não traduzidos, e ficam marcados "revisão nativa pendente" no cabeçalho do arquivo.

- [ ] **Step 1:** Testes que falham:
  - para cada `tom` × `abertura` × idioma (36 combinações), uma seleção sintética gera frase que `validarFrase` aceita;
  - seleção com 1 termo permitido usa `umTermo` e não lança erro; item sem construto (dado inválido) usa `semTermo` e não lança erro;
  - um item sensível entre dois não sensíveis nunca dá `tom === "sensivel"`;
  - os mesmos três ids em outra ordem dão a mesma frase;
  - duas seleções sem construto em comum dão frases diferentes, e nenhum termo permitido de uma aparece na frase da outra.
- [ ] **Step 2:** `pnpm test src/frase/compositor.test.ts` → falha.
- [ ] **Step 3:** Implementar e escrever os moldes.
- [ ] **Step 4:** `pnpm test` → passa.
- [ ] **Step 5:** Sonda de pareamento cego, com modelo como juiz (aproximação; com gente fica NÃO PROVADO): compor a frase em pt-BR para 6 seleções de construtos distintos, embaralhar e pedir a um subagente, que só vê as 6 seleções e as 6 frases, o pareamento. Menos de 5 acertos em 6: os moldes estão genéricos demais; reescrever para que cada molde cite a classe de signo e a relação entre os itens, e repetir. Registrar o número no README.
- [ ] **Step 6:** Commit `frase: compositor por regra nos três idiomas`.

### Task 12: Função interpretar e provedores

**Files:**
- Create: `src/frase/prompt.ts`, `src/servidor/interpretar.ts`, `src/servidor/dev.ts`, `src/servidor/provedores/{tipos,anthropic,openrouter}.ts`
- Modify: `vite.config.ts` (plugin de desenvolvimento que monta a função em `/api/interpretar`)
- Test: `src/servidor/interpretar.test.ts`

**Interfaces:**
- Consumes: `termosPermitidos`, `ajudaDestacada`, `validarFrase`, `comporFrase`.
- Produces:
  - `VERSAO_PROMPT = "2026-11-12.1"`; `montarMensagens(itens: Item[], idioma: Idioma, glossario: Glossario): { sistema: string; usuario: string }` (pré-prompt mestre e blocos de idioma de `docs/pesquisa/pre-prompt.md` seção (c), copiados sem alteração; `usuario` é o JSON da seção (a), sem `credito`);
  - `Provedor = { nome: string; gerar(sistema: string, usuario: string, temperatura: number, sinal: AbortSignal): Promise<string> }`; `escolherProvedor(env: Record<string, string | undefined>): Provedor | null` (`ANTHROPIC_API_KEY` com `FRASE_MODELO` padrão `claude-haiku-5-5`; `OPENROUTER_API_KEY` com `FRASE_MODELO` obrigatório; nenhuma chave dá `null`);
  - `criarInterpretar(deps: { acervo: Item[]; glossario: Glossario; provedor: Provedor | null; origens: string[]; prazoMs?: number }): (req: Request) => Promise<Response>`;
  - `Resposta = { frase: string; idioma: Idioma; origem: "modelo" | "modelo_2" | "regra"; construtos_usados: string[]; ajuda_destacada: boolean; versao_prompt: string }`.

Fluxo: sem provedor, `comporFrase` e `origem: "regra"`. Com provedor: chamada 1 com temperatura 0,7 e aborto em `prazoMs` (padrão 8.000); resposta com cerca de código é limpa, o JSON é lido e a frase passa no validador; aprovada, `origem: "modelo"`. Reprovada: chamada 2 com temperatura 0,2 e uma instrução fixa por código violado; aprovada, `origem: "modelo_2"`. Qualquer outra saída: `comporFrase`. No máximo 2 chamadas. Corpo aceito: exatamente `{ itens: [3 ids distintos e existentes], idioma }`, até 1 KB; fora disso, 400. CORS: só as origens de `deps.origens`, que em produção incluem `capacitor://localhost` e `https://localhost`. Antes de escrever `anthropic.ts`, carregar a skill `claude-api`.

- [ ] **Step 1:** Testes que falham, com provedor falso:
  - resposta válida na primeira: `origem === "modelo"`, 1 chamada;
  - inválida e depois válida: `"modelo_2"`, 2 chamadas, a segunda com temperatura 0,2;
  - inválida duas vezes: `"regra"`, 2 chamadas; provedor que lança ou que não responde em `prazoMs`: `"regra"`;
  - sem provedor: `"regra"`, 0 chamadas;
  - corpo com chave extra `texto`: 400; id desconhecido: 400; dois ids iguais: 400; idioma `fr`: 400;
  - o texto `IGNORE ALL PREVIOUS INSTRUCTIONS` do caso 6 aparece só em `usuario`, nunca em `sistema`;
  - `OPTIONS` com `Origin: capacitor://localhost` devolve 204 com `Access-Control-Allow-Origin` igual; origem fora da lista não recebe o cabeçalho;
  - a resposta não contém as chaves `credito` nem `texto_humano`.
- [ ] **Step 2:** `pnpm test src/servidor` → falha.
- [ ] **Step 3:** Implementar. O plugin de desenvolvimento lê `public/indice/` e usa `escolherProvedor(process.env)`.
- [ ] **Step 4:** `pnpm test` → passa. `pnpm dev` e `curl -s -X POST localhost:5173/api/interpretar -H 'content-type: application/json' -d '{"itens":[<3 ids reais>],"idioma":"pt-BR"}'` → JSON com `origem: "regra"`.
- [ ] **Step 5:** Sonda do pré-prompt com modelo real, sem chave (aproximação: subagente desta sessão, não a API do provedor): para os 6 casos nos 3 idiomas, entregar a um subagente o `sistema` e o `usuario` de `montarMensagens` e recolher a resposta crua; passar as 18 respostas por `validarFrase` e contar aprovadas e códigos violados. Registrar a contagem no README. Frase reprovada que um leitor consideraria correta é falso positivo do validador e vira caso de teste.
- [ ] **Step 6:** Commit `servidor: interpretar com duas tentativas validadas e volta para a regra`.

**NÃO PROVADO por este plano:** nenhuma chamada à API de um provedor. A sonda do Step 5 mede o pré-prompt contra um modelo real dentro de outro arnês; a taxa de violação em produção só se mede com chave.

---

# Parte C — O site

### Task 13: Casca, três janelas e idiomas

**Files:**
- Create: `index.html`, `src/ui/main.ts`, `src/ui/i18n.ts`, `src/ui/janela.ts`, `src/i18n/{pt-BR,en,zh-CN}.json`, `src/estilo/{base,janela}.css`, `playwright.config.ts`
- Test: `src/ui/i18n.test.ts`, `e2e/casca.spec.ts`

**Interfaces:**
- Produces: `idiomaInicial(preferencias: readonly string[]): Idioma` (`pt*` dá `pt-BR`; `zh*` dá `zh-CN`; o resto dá `en`); `t(chave: string, idioma: Idioma): string` (lança erro em chave ausente); `criarJanela(opcoes: { id: "pintura" | "som" | "palavra"; titulo: string; conteudo: HTMLElement }): HTMLElement`.

Textos por idioma:

| chave | pt-BR | en | zh-CN |
|---|---|---|---|
| `titulo` | Eu Não Sei Me Comunicar | I Don't Know How to Communicate | 我不会表达自己 |
| `janela.pintura` | Prefiro Me Explicar Escolhendo Imagens Que Me Despertam… | I'd Rather Explain Myself by Choosing Images That Stir Something in Me… | 我宁愿挑选触动我的画面来解释自己…… |
| `janela.som` | Prefiro Me Comunicar Ouvindo Sons Que Representem O Que Sinto | I'd Rather Communicate by Listening to Sounds That Stand for What I Feel | 我宁愿用能代表我感受的声音来沟通 |
| `janela.palavra` | Prefiro Escolher Palavras Soltas | I'd Rather Choose Loose Words | 我宁愿挑选零散的词语 |

Antes do CSS, carregar a skill `frontend-design`. Limites: fundo `#000`; janela em estilo Windows clássico desenhada só em CSS (barra de título, três botões decorativos, borda em relevo), sem arquivo de imagem nem fonte de terceiros com licença fechada; fonte com licença aberta hospedada no próprio site, ou pilha do sistema; janela é `role="group"` com `aria-labelledby`; arrastável pela barra só em `(min-width: 900px) and (pointer: fine)`; em tela estreita as três empilham.

- [ ] **Step 1:** Testes que falham: `i18n.test.ts` (as três línguas têm o mesmo conjunto de chaves; `idiomaInicial(["pt-PT"]) === "pt-BR"`, `(["zh-TW"]) === "zh-CN"`, `(["fr"]) === "en"`; `t("inexistente", "en")` lança). `e2e/casca.spec.ts`, em 390×844 e em 1280×800: fundo computado `rgb(0, 0, 0)`; `h1` igual a `titulo`; três janelas visíveis com os textos acima; `document.documentElement.scrollWidth <= window.innerWidth`; trocar o idioma no rodapé muda o `h1`; a tecla Tab alcança a primeira opção de cada janela.
- [ ] **Step 2:** `pnpm test` e `pnpm e2e` → falham.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm test && pnpm e2e` → passam. Gravar capturas em `docs/capturas/casca-390.png` e `casca-1280.png` e olhar as duas.
- [ ] **Step 5:** Commit `site: página preta, três janelas e três idiomas`.

### Task 14: Seleção e distribuição

**Files:**
- Create: `src/ui/selecao.ts`
- Test: `src/ui/selecao.test.ts`

**Interfaces:**
- Produces:

```ts
type Janela = "pintura" | "som" | "palavra"
interface EstadoSelecao { idioma: Idioma; mesas: Record<Janela, string[]>; vistos: Record<Janela, string[]>; escolhidos: string[] }
criarEstado(acervo: Item[], idioma: Idioma, sorteio: () => number): EstadoSelecao
redistribuir(e: EstadoSelecao, janela: Janela, acervo: Item[], sorteio: () => number): EstadoSelecao
escolher(e: EstadoSelecao, id: string, acervo: Item[], sorteio: () => number): EstadoSelecao
retirar(e: EstadoSelecao, id: string): EstadoSelecao
trocarIdioma(e: EstadoSelecao, idioma: Idioma, acervo: Item[], sorteio: () => number): EstadoSelecao
completa(e: EstadoSelecao): boolean
```

Regras: cada mesa tem 3 ids distintos; a janela de palavras só usa palavras de `e.idioma`; item escolhido nunca volta à mesa; `escolher` redistribui a janela do item enquanto houver menos de 3 escolhidos; funções puras, que devolvem estado novo.

- [ ] **Step 1:** Testes que falham:
  - `criarEstado` dá 3 ids distintos por janela e, em palavras, só do idioma;
  - `escolher` acrescenta o id e troca as 3 opções da janela por outras ainda não vistas;
  - a quarta chamada de `escolher` devolve o mesmo objeto recebido (Review Focus 3);
  - `retirar` tira o id e `completa` volta a `false`;
  - com 4 pinturas no acervo e 1 escolhida, `redistribuir` devolve as 3 restantes sem lançar; a chamada seguinte recomeça o ciclo e nunca inclui a escolhida (Review Focus 5);
  - `trocarIdioma("en")` mantém `escolhidos`, inclusive uma palavra de pt-BR, e a mesa de palavras passa a ter só itens de `en` (Review Focus 4).
- [ ] **Step 2:** `pnpm test src/ui/selecao.test.ts` → falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm test` → passa.
- [ ] **Step 5:** Commit `seleção: três escolhas livres com redistribuição`.

### Task 15: Conteúdo das janelas

**Files:**
- Create: `src/ui/zoom.ts`, `src/ui/audio.ts`, `src/ui/janela-pinturas.ts`, `src/ui/janela-sons.ts`, `src/ui/janela-palavras.ts`, `src/ui/bandeja.ts`
- Modify: `src/ui/main.ts`, `src/estilo/janela.css`
- Test: `src/ui/zoom.test.ts`, `src/ui/audio.test.ts`, `e2e/escolha.spec.ts`

**Interfaces:**
- Consumes: `EstadoSelecao` e suas funções; `Item`.
- Produces: `alvo(caixa: { x: number; y: number; w: number; h: number }, k = 0.5, kAlt = 0.8, sMax = 8): { s: number; tx: number; ty: number }`, `aproximar(moldura: HTMLElement, caixa)`, `afastar(moldura: HTMLElement)`, copiados de `docs/pesquisa/zoom-no-rosto-anexos/zoom.js` e `zoom.css`; `criarTocador(novoAudio?: () => HTMLAudioElement): { tocar(id: string, url: string): Promise<void>; parar(): void; tocando(): string | null }`.

Comportamento:
- **Pintura:** a moldura tem a proporção da obra. Com `rosto`, a aproximação começa quando a distribuição aparece, com 300 ms de atraso por posição e 1.400 ms de duração, e a camada `nitido` entra ao fim. Sem `rosto`, a imagem fica parada. Tocar na pintura escolhe. Um botão "ver inteira" abre a obra com `rotulo`, `credito.linha` e link. `alt` da imagem: `rotulo` e autor.
- **Som:** botão de tocar e pausar com rótulo "Som 1", "Som 2", "Som 3"; o título só aparece na bandeja, depois da escolha. `tocar` só é chamado dentro de handler de clique. Tocar um som pausa o anterior. Escolher, completar a seleção e recomeçar chamam `parar`.
- **Palavra:** três botões em corpo grande com `lang` do idioma da palavra.
- **Toda janela** tem o controle "outras três" (`janela.outras` nos três idiomas), que chama `redistribuir` sem escolher. No e2e, clicar nele troca as três opções e mantém a bandeja.
- **Bandeja:** de 0 a 3 escolhas, cada uma com botão de retirar; região `aria-live="polite"` anuncia "1 de 3", "2 de 3", "3 de 3".

- [ ] **Step 1:** Testes que falham:
  - `zoom.test.ts`: `alvo({x:0.4389,y:0.1838,w:0.1272,h:0.1477})` dá `s ≈ 3.931`, `tx ≈ -1.4752`, `ty ≈ -0.5128` (tolerância 0,001); caixa com `w = 0.58` dá `s === 1`; para 20 caixas sintéticas, `1 - s <= tx <= 0` e `1 - s <= ty <= 0`.
  - `audio.test.ts`, com áudios falsos: `tocar("b")` depois de `tocar("a")` chama `pause` em `a`; `parar()` pausa e `tocando()` devolve `null`; `tocar("a")` duas vezes alterna tocar e pausar (Review Focus 1).
  - `e2e/escolha.spec.ts`: escolher 1 pintura, 1 som e 1 palavra deixa a bandeja com 3; nenhuma requisição sai para domínio que não seja o do site; com `reducedMotion: "reduce"`, a `transition-duration` da pintura é `0s`.
- [ ] **Step 2:** `pnpm test` e `pnpm e2e` → falham.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm test && pnpm e2e` → passam. Capturas em `docs/capturas/escolha-390.png` e `escolha-1280.png`; olhar as duas.
- [ ] **Step 5:** Commit `janelas: zoom no rosto, som no toque e palavras`.

### Task 16: Resultado, procedência, créditos e ajuda

**Files:**
- Create: `src/ui/pedido.ts`, `src/ui/resultado.ts`, `src/ui/creditos.ts`, `src/ui/ajuda.ts`
- Modify: `src/ui/main.ts`, `src/i18n/*.json`, `src/estilo/base.css`
- Test: `src/ui/pedido.test.ts`, `e2e/escolha.spec.ts`

**Interfaces:**
- Consumes: `comporFrase`, `ajudaDestacada`, `termosPermitidos`, `Resposta`.
- Produces: `pedirFrase(ids: string[], idioma: Idioma, deps: { buscar: typeof fetch; base: string | null; acervo: Item[]; glossario: Glossario; prazoMs?: number }): Promise<Resposta>`.

Regras de `pedirFrase`: `base` nulo compõe no aparelho sem chamar `buscar`; com `base`, POST em `${base}/api/interpretar` com aborto em 8.000 ms; qualquer falha, status diferente de 200 ou corpo fora do contrato cai no compositor; a mesma seleção e idioma em andamento devolvem a mesma promessa. `base` vem de `import.meta.env.VITE_API_BASE`.

Tela do resultado: a frase em corpo grande; "de onde veio cada termo" (termo, definição, citação com link `https://doi.org/<doi>` e os itens escolhidos que carregam o construto); crédito dos três itens; aviso fixo nos três idiomas, em pt-BR "Esta frase descreve o que a sua seleção comunica. Não é diagnóstico nem avaliação de saúde."; botão recomeçar. Link de ajuda fixo no rodapé de todas as telas, com destaque quando `ajuda_destacada`; abre uma folha com a linha padrão do idioma e o diretório internacional, lidos de `public/indice/ajuda.json`. Página de créditos gerada do acervo, com Openverse, Wikcionário (CC BY-SA 4.0), Glasgow Norms (Scott et al., 2019), Zheng et al. (2023), e o aviso "acervo de demonstração, revisão humana pendente" quando `demonstracao` for verdadeiro.

- [ ] **Step 1:** Testes que falham:
  - `buscar` que nunca resolve, com relógio falso: a promessa resolve em 8.000 ms com `origem === "regra"` (Review Focus 2);
  - duas chamadas seguidas com os mesmos ids: `buscar` é chamado 1 vez (Review Focus 3);
  - `base = null`: `buscar` não é chamado;
  - resposta 200 com corpo sem `frase`: `origem === "regra"`;
  - e2e: depois da terceira escolha a frase aparece, termina em ponto final, e a lista de procedência tem de 2 a 4 termos, cada um com link para `doi.org`; "recomeçar" esvazia a bandeja; o link de ajuda existe antes e depois do resultado.
- [ ] **Step 2:** `pnpm test` e `pnpm e2e` → falham.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm test && pnpm e2e` → passam. Capturas `docs/capturas/resultado-{390,1280}-{pt-BR,en,zh-CN}.png`; olhar as seis e conferir que a frase em chinês não estoura a largura em 390 px.
- [ ] **Step 5:** Commit `resultado: frase, procedência dos termos, créditos e ajuda`.

### Task 17: Instalável e sem rede

**Files:**
- Create: `public/manifest.webmanifest`, `public/icones/{192,512,180}.png`
- Modify: `vite.config.ts` (vite-plugin-pwa com pré-cache do app, de `indice/` e de `midia/`), `index.html`
- Test: `e2e/sem-rede.spec.ts`

- [ ] **Step 1:** Teste que falha: carregar o site construído (`vite preview`), esperar o service worker ativo, `context.setOffline(true)`, recarregar, fazer três escolhas (uma delas um som, que precisa tocar) e ver a frase.
- [ ] **Step 2:** `pnpm build && pnpm e2e e2e/sem-rede.spec.ts` → falha.
- [ ] **Step 3:** Implementar. Manifesto com `name`, `short_name`, `start_url: "."`, `display: "standalone"`, `background_color` e `theme_color` `#000000`, ícones de 192 e 512 px; `apple-touch-icon` de 180 px.
- [ ] **Step 4:** `pnpm build && pnpm e2e` → passa. Imprimir o tamanho de `dist/` em MB.
- [ ] **Step 5:** Commit `pwa: instalável e completo sem rede`.

---

# Parte D — Empacotamento

### Task 18: Capacitor e prova de compilação

**Files:**
- Create: `capacitor.config.ts`, `android/`, `ios/`
- Modify: `package.json`, `README.md`

**Interfaces:**
- Produces: `capacitor.config.ts` com `appId: "art.eunaoseimecomunicar.app"` (provisório, decisão do dono), `appName: "Eu Não Sei Me Comunicar"`, `webDir: "dist"`, sem `server.url`.

- [ ] **Step 1:** `pnpm add @capacitor/core@8.6 @capacitor/android@8.6 @capacitor/ios@8.6 && pnpm add -D @capacitor/cli@8.6`.
- [ ] **Step 2:** `pnpm build && pnpm exec cap add android && pnpm exec cap add ios && pnpm exec cap sync` → cada comando sai com código 0.
- [ ] **Step 3:** Prova de compilação do iOS, sem sudo e sem assinatura: `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphoneos -configuration Debug CODE_SIGNING_ALLOWED=NO build`. Registrar no README a última linha da saída, seja `BUILD SUCCEEDED`, seja o erro.
- [ ] **Step 4:** Android: não compilar. Registrar no README que falta o SDK (plataforma 36 e build-tools), que o JDK 21 está em `/opt/homebrew/opt/openjdk@21` e que a instalação é decisão do dono.
- [ ] **Step 5:** README com: como rodar o site, como rodar cada comando do pipeline, o estado de cada plataforma, e a lista do que depende do dono (revisão dos 150 itens, função `pontuar_rosto`, provedor de LLM, hospedagem, contas de loja, SDK do Android).
- [ ] **Step 6:** Commit `capacitor: projetos de android e ios gerados`.

---

## Fora deste plano (pede GO do dono)

- Hospedagem do site e da função, e o adaptador da hospedagem escolhida.
- Chave de LLM e o arnês que mede violações do pré-prompt contra modelo real.
- Compilar e assinar para loja, teste em aparelho, contas de desenvolvedor, política de privacidade publicada, canal para denúncia de frase.
- Instalar o SDK do Android; ativar o Xcode com `xcode-select`.
- Índice publicável: depende da revisão humana da Tarefa 8.
