# Acervo de pinturas — pesquisa de 12/Nov/2026

Fonte principal: API aberta do Cleveland Museum of Art (CMA), `https://openaccess-api.clevelandart.org/api/artworks/?type=Painting&has_image=1&cc0=1`, sem chave. Ponto de partida já medido: 3.907 pinturas CC0 com imagem, 2.181 com `description`.
Procedência de cada número: **medido** (comando rodado hoje), **lido** (URL e trecho) ou **memória** (sem prova).
Scripts e lista de candidatas: `docs/pesquisa/acervo-pinturas-anexos/`. Os dados brutos ficaram em pasta temporária e precisam ser baixados de novo pelo pipeline.

## (a) Imagens, estabilidade da URL e licença

| Variante | Formato | Lado maior (px) | Tamanho do arquivo | Uso |
|---|---|---|---|---|
| `images.web` | JPEG | 893 a 1.263, mediana 900 | mediana 0,28 MB | miniatura na janela |
| `images.print` | JPEG | 3.400 em 3.872 de 3.906 (99,1%); mínimo 1.024 | mediana 2,97 MB, máximo 13,2 MB | origem do zoom no rosto |
| `images.full` | TIFF | mediana 7.565; máximo 147.317 | mediana 86 MB, máximo 2,1 GB | não serve para app |

- Medido: as 3.907 têm URL nas três variantes. Baixei 6 `web` e 3 `print` sorteadas; a dimensão real bateu com a da API em 9 de 9.
- Medido: as 11.721 URLs seguem o padrão `https://openaccess-cdn.clevelandart.org/{nº de acesso}/{nº de acesso}_{web|print|full}.{jpg|tif}`. Lido no README do museu: "Images are included in the dataset via permalinks associated with each object record."
- Medido: o endereço é estável, o arquivo não. Nos 9 downloads o número de bytes diferiu do `filesize` da API; `last-modified` do exemplo é 01/Jun/2026. Não fixar hash nem tamanho a partir da API.
- Medido: o CDN responde `cache-control: max-age=14400` e **não** envia `Access-Control-Allow-Origin`, mesmo com cabeçalho `Origin`. A tag de imagem funciona; canvas, WebGL e cache de service worker ficam limitados.
- Medido: 45 registros têm `filesize` vazio e 1 não tem largura/altura. O pipeline precisa tolerar campo vazio.

Termos de uso (lido em `https://www.clevelandart.org/terms-and-conditions`):
- Cópia própria é permitida: "CC0 Content may be used free-of-charge for both commercial and non-commercial purposes without the prior consent or permission of CMA, including copying, modification, distribution or performance."
- Servir direto do CDN não é proibido nem garantido. O texto não fala de hotlink. Sobre a API: "CMA may limit the number of transactions a user may send or receive through the API [...] or may in the future require access through assigned keys" e "does not guarantee availability of the service".
- Alcance do CC0: imagem e dados. Na documentação da API: "While all data in the dataset is released with a CC0 designation, only artworks with the CC0 share_license_status will additionally provide access to CC0 images." Medido: `share_license_status` é "CC0" nas 3.907 e `copyright` é nulo em todas. Ressalva lida nos Termos: o CC0 cobre "portions of its metadata" e o museu não garante direitos de terceiros.
- Crédito: "Works designated as CC0 do not require attribution or citation." Formato sugerido: "Artist. Title. Date (year). Medium. Dimensions. The Cleveland Museum of Art. Credit Line. Accession Number. URL from www.clevelandart.org/". Medido: o campo `tombstone` já traz essa linha pronta em 2.181 de 2.181, e `url` também.
- Duas obrigações lidas no README (`github.com/ClevelandMuseumArt/openaccess`): não usar marca do museu nem sugerir endosso; e "Whenever you transform, translate or otherwise modify the dataset, you must make it clear that the resulting information has been modified." Tradução para pt-BR e zh-CN entra aqui.

Autoria do texto (decisivo para a regra "descrição feita por humanos"):
- Lido em `https://www.clevelandart.org/visual-descriptions-entire-collection`: o museu gerou com Gemini descrições visuais para o acervo inteiro, guardadas em campo separado com marca de humano ou IA. O mesmo texto diz: "Further interpretation and context are for curators to expand on in the 'Did You Know?' and 'Description' sections".
- Medido: o registro completo da API tem 60 campos e nenhum com "visual" no nome. O `description` que usamos é o texto de curadoria (o changelog da API diz que ele substituiu `wall_description` e `digital_description`).
- Risco: se o museu passar a expor a descrição visual na API, o pipeline não pode confundir os dois campos.

## (b) Filtro de conteúdo seguro

Campos disponíveis: o CMA **não tem campo de assunto, tema ou etiqueta de conteúdo**. `artists_tags` descreve o artista (gênero, grupo), não a obra. Sobram `title`, `description` e `did_you_know`. A ponte para o Wikidata existe (`external_resources.wikidata` em 2.158 das 2.181), mas cobre pouco: só 597 de 2.180 itens têm "depicts" (P180) e 648 têm gênero (P136); ela marcou 5 obras, todas já pegas pelas palavras.

Filtro de palavras em inglês, com fronteira de palavra, sobre as 2.181 (regex em `acervo-pinturas-anexos/filtro.py`):

| Filtro | Só título | Título + descrição | Por categoria (título + descrição) |
|---|---|---|---|
| Estrito (termos explícitos) | 40 (1,8%) | **226 (10,4%)** | violência 161, nudez/sexo 44, morte 36 |
| Amplo (inclui death, war, battle, died, demon) | 122 (5,6%) | **610 (28,0%)** | violência 331, morte 308, nudez/sexo 80 |

- Precisão baixa, por leitura manual de sorteio pequeno: das 12 do filtro estrito, 6 mostram de fato o conteúdo; das 12 que só o filtro amplo pegou, 8 são falso positivo ("executed" = pintado, "War of 1812" em biografia).
- Escapes medidos: 136 obras citam iconografia de risco pelo nome (Venus, sátiro, Salomé, Judite, caça, sacrifício) e 66 delas passam pelo filtro amplo. "Hanged" e "gallows" não estavam na lista e deixaram passar um enforcado.
- 715 das 2.181 descrições têm HTML (`em`, `br`, `a`). Limpar antes de filtrar e antes de mandar ao LLM.

Dez exemplos marcados pelo filtro estrito:

| Nº de acesso | Título | Data | Termo | Leitura |
|---|---|---|---|---|
| 1975.79 | Salome with the Head of Saint John the Baptist | meados de 1600 | severed head | cabeça decepada visível |
| 1962.279.229.b | The princess discovers the dead bodies, with heads severed | c. 1560 | dead bodies, severed | corpos decapitados |
| 1984.4 | Cremation of the demon Putana | c. 1790 | corpse | cadáver esquartejado |
| 2008.71 | The Death of Sophonisba | c. 1810 | suicide | suicídio por veneno |
| 1962.279.242.a | Mahrusa kills herself at the tomb of the king of Zabul | c. 1560 | suicide, bloody | faca no peito |
| 1977.37.2 | Scenes of Witchcraft: Day | c. 1645–49 | skulls, flays, orgy | bruxaria com crânios |
| 1976.2 | The Crucifixion of Saint Andrew | 1606–7 | crucifixion | violência religiosa |
| 1939.269 | Bathers Playing with a Crab | c. 1897 | nude bathers | nu artístico |
| 1966.387 | July | 1893 | nude model | nu artístico |
| 1962.256 | Landscape with a Church by a Torrent | c. 1670 | severed logs | falso positivo (troncos) |

## (c) Fontes secundárias

| Fonte | Sem chave | Texto humano | Licença | Veredito |
|---|---|---|---|---|
| Rijksmuseum (`data.rijksmuseum.nl`) | sim | texto de sala em holandês e inglês | varia por obra | **melhor segunda fonte** |
| National Gallery of Art (CSV no GitHub + IIIF) | sim | misto, sem marca de autoria | CC0 nos dados | só com corte de estilo e revisão |
| Wikidata / Wikipédia / Commons | sim, com limite | quase nenhum para estas obras | CC0 / CC BY-SA 4.0 | não serve como descrição |

**Rijksmuseum.** Medido: `https://data.rijksmuseum.nl/search/collection?type=painting&imageAvailable=true` devolve 4.928 pinturas. Em 24 sorteadas dos 200 primeiros resultados, 19 têm texto de sala com 200 caracteres ou mais, as 19 com versão em inglês. A imagem sai por IIIF (`iiif.micr.io`) com `access-control-allow-origin: *`. Custos: 3 requisições por obra (objeto, item visual, objeto digital) e nenhum filtro por "tem texto" na busca. Direitos por obra: em 31 objetos, 30 com Public Domain Mark e 1 "In Copyright". Lido em `https://data.rijksmuseum.nl/policy/`: "In some cases, copyright does apply. If so, a Creative Commons BY 4.0 (CC BY 4.0) licence is indicated", e o museu pede crédito mesmo quando não é obrigatório. A amostra não é aleatória sobre o acervo inteiro.

**National Gallery of Art.** Medido em `objects.csv` e `published_images.csv` (export de 11/Nov/2026): 4.455 pinturas; 2.946 imagens primárias de acesso aberto, 2.943 delas com `assistivetext` (mediana 777 caracteres), o que cobre 2.924 pinturas distintas. Os números de estilo abaixo contam imagens. O IIIF `api.nga.gov/iiif` responde sem chave, com CORS `*` e recorte por região. Problema: o CSV não tem coluna de autoria e há duas populações de texto. 1.476 usam a perspectiva "to our left", "looks at us" (mediana 1.325 caracteres); 1.467 não usam (mediana 534) e 1.211 dessas abrem com "The image shows", "The artwork depicts". Lido na programação do MCN 2026 (`https://mcn2026.sched.com/event/2RWqk`): sessão "Accessibility at Scale: Two Case Studies in Using AI to Write and Publish Visual Descriptions", com NGA e CMA. Que as 1.476 sejam humanas é inferência por estilo, não fato. `nga.gov` devolveu 403 ao curl e ao WebFetch, então a política de acesso aberto da NGA não foi lida no site; a licença CC0 vem do README do repositório, que avisa que as imagens não fazem parte do dataset.

**Wikidata, Wikipédia e Commons.** Falharam como fonte de descrição. O serviço SPARQL respondeu 429 na segunda consulta ("Aggressively rate-limiting to 1 req / min"). A API de ação recusou 16 de 44 chamadas com 1,2 s de intervalo e só completou com 12 s. Cobertura para as pinturas do CMA com descrição: 31 de 2.180 têm artigo na Wikipédia em inglês, 0 em português, 2 em chinês. O texto da Wikipédia é CC BY-SA 4.0 (medido em `siteinfo`), o que obriga crédito e mesma licença. Um ponto útil: 2.074 de 2.180 itens têm imagem no Commons, marcada CC0 no exemplo testado e servida com CORS `*`, mas em TIFF de centenas de MB no caso medido.

Já descartadas antes desta frente: Art Institute of Chicago (403 do Cloudflare) e Met (sem texto descritivo).

## (d) Critérios de seleção para cerca de 150 pinturas

Funil medido (`acervo-pinturas-anexos/funil.py`):

| Passo | Critério | Passam | Saem |
|---|---|---|---|
| 0 | pintura CC0 com imagem | 3.907 | |
| 1 | `description` não vazia | 2.181 | 1.726 |
| 2 | descrição com 200 caracteres ou mais, HTML removido | 2.139 | 42 |
| 3 | `print` com lado maior de 2.000 px ou mais | 2.135 | 4 |
| 4 | título sem "(verso)", caligrafia, página de texto, capa | 2.014 | 121 |
| 5 | proporção lado maior/menor até 2,2 (tira rolos e biombos) | 1.722 | 292 |
| 6a | fora do filtro estrito | 1.525 | 197 |
| 6b | alternativa: fora do filtro amplo | 1.225 | 497 |
| 7 | no máximo 2 por série (prefixo do nº de acesso), partindo de 6a | **1.174** | 351 |

O passo 7 existe porque uma única série (1962.279, o manuscrito Tuti-nama) ocupa 174 linhas. Partindo de 6b, o passo 7 deixa 959.

Variedade nas 1.174 candidatas (`candidatas-cma.csv`):

| Época | Qtde | | Região (departamento) | Qtde |
|---|---|---|---|---|
| antes de 1400 | 79 | | Índia e Sudeste Asiático | 337 |
| 1400–1599 | 209 | | Europa até c. 1800 | 210 |
| 1600–1799 | 526 | | Europa moderna | 189 |
| 1800–1899 | 321 | | Japão | 153 |
| 1900 em diante | **39** | | China | 109 |
| | | | Estados Unidos 85, Europa medieval 51, Coreia 36, outros 4 | |

- Gênero só por palavra-chave, porque não há campo: paisagem 300, religiosa 257, retrato 229, animais e flores 219, cena cotidiana 98, mitologia e literatura 92, natureza-morta 34, sem gênero detectado 262.
- 45 são destaque do museu (`is_highlight`), 312 estão em exposição, 738 têm também `did_you_know`. Mediana da descrição: 543 caracteres.
- Simulação de cota (20/35/35/35/25 por época, teto de 30 por região): fecha em 150, com 29 retratos, 41 paisagens, 35 religiosas e só 2 naturezas-mortas. A cota por gênero precisa ser explícita.
- Limite do acervo: depois de 1900 só restam 39 candidatas. Arte do século XX em diante quase não entra por CC0.

## Afirmações de que o plano depende

| Id | Afirmação | Procedência |
|---|---|---|
| 01 | `print` é JPEG de 3.400 px no lado maior em 99,1% das pinturas, mediana de 3 MB; dimensão real igual à da API em 9 de 9 | medido |
| 02 | `full` é TIFF com mediana de 86 MB; fica fora do app e do pipeline normal | medido |
| 03 | URL previsível pelo nº de acesso em 11.721 de 11.721, mas bytes mudam e o CDN não envia CORS | medido |
| 04 | Os Termos permitem copiar, modificar e distribuir conteúdo CC0, inclusive comercialmente; a API pode ser limitada ou exigir chave | lido |
| 05 | CC0 cobre imagem e dados; crédito não é obrigatório; tradução deve ser sinalizada; marca do museu não pode ser usada | lido |
| 06 | `description` é texto de curadoria; a descrição visual gerada por IA mora em outro campo, ausente do registro da API hoje | lido + medido |
| 07 | Não há campo de assunto; filtro de palavras marca 226 (estrito) ou 610 (amplo) das 2.181 | medido |
| 08 | O filtro erra para os dois lados: metade de falso positivo no estrito (12 lidas) e 66 obras de risco fora do amplo | medido |
| 09 | NGA tem 2.924 pinturas abertas com texto assistivo, mas sem coluna de autoria e com duas populações de estilo | medido |
| 10 | Rijksmuseum responde sem chave, 4.928 pinturas, 19 de 24 com texto de sala em inglês; direitos variam por obra | medido |
| 11 | Wikidata e Wikipédia não servem de descrição: 429 em uso leve e 31 artigos em 2.180 | medido |
| 12 | O funil deixa 1.174 candidatas; 150 com cota de época e região é viável; só 39 são de 1900 em diante | medido |

## Recomendações para o plano

1. Fonte única na primeira versão: CMA. Guardar por item `id`, nº de acesso, `tombstone`, `url`, descrição limpa, `did_you_know` e a data da coleta.
2. Hospedar cópia própria: derivar do `print` um WebP de cerca de 1.600 px e o recorte do rosto. Não depender do CDN em tempo de uso.
3. Limpar HTML e marcar toda tradução como "traduzido do texto do Cleveland Museum of Art".
4. Usar o filtro de palavras como triagem e fechar a lista por revisão humana das 150. Acrescentar à lista "hanged", "gallows" e os nomes de iconografia.
5. Aplicar o funil dos passos 1 a 7 e depois cotas explícitas de época, região e gênero, com piso de retratos para o zoom no rosto.
6. Mostrar o crédito do museu em cada pintura, com link para a página da obra.
7. Deixar o Rijksmuseum como segunda fonte opcional, atrás de um adaptador, com checagem de direitos por obra.
8. Não usar o texto assistivo da NGA enquanto a autoria não for conferida obra a obra.

## Decisões que só o dono pode tomar

1. O que é "seguro" em pintura: nu artístico, violência religiosa (crucificação, martírio) e morte entram, entram com revisão ou saem?
2. Hospedar cópia própria das imagens (recomendado) ou servir do CDN do museu.
3. Composição do acervo: o CMA pende para Índia, China e Japão e quase não tem século XX. Manter esse perfil ou forçar mais pintura europeia e americana?
4. Abrir já a segunda fonte (Rijksmuseum, com crédito obrigatório em parte dos textos) ou lançar só com o CMA.
5. Aceitar texto da NGA que parece humano pelo estilo, sabendo que a autoria não está declarada.
6. Quem revisa as 150 pinturas e as traduções para pt-BR e zh-CN antes de publicar.
