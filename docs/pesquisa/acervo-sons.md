# Acervo de sons — fontes, licenças e termos de busca

Medido em 12/Nov/2026, entre 04:02 e 04:25 UTC, sem chave de API, com `User-Agent: art-index-probe/1.0`. Foram 64 chamadas ao Openverse (o limite anônimo é 200 por dia) e leitura da documentação pública do Openverse, do Freesound e da Creative Commons.
Respostas brutas e scripts ficaram em `<pasta temporária da sessão>/wf/acervo-sons/`, pasta temporária que some; a tabela dos 40 termos foi copiada para `docs/pesquisa/acervo-sons-termos.tsv`.
Procedência: **[medido]** comando executado e número obtido · **[lido]** documento público com trecho citado · **[memória]** crença sem prova. Nenhuma afirmação deste relatório depende de memória.

## Resumo

- O Openverse anônimo basta para montar o índice: 20 chamadas por minuto, 200 por dia, 20 resultados por página, 240 resultados por busca.
- Só CC0 já dá material: nos 40 termos testados, a primeira página (20 resultados CC0 com menos de 30 s) trouxe de 4 a 20 sons com até 20 s; mediana 16.
- O Openverse não devolve descrição e não garante conteúdo seguro. A anotação de cada som será título e tags; o filtro de segurança tem de ser nosso, com escuta humana.
- Recomendação: só CC0, fonte Freesound via Openverse, recorte hospedado por nós e tela de créditos mesmo sem obrigação.
- A chave gratuita do Freesound acrescenta descrição humana e marcação de conteúdo explícito, mas a API só é gratuita para uso não comercial.

## (a) Limites do acesso anônimo ao Openverse

| Limite | Valor | Procedência |
|---|---|---|
| Rajada | 20 chamadas por minuto | [medido] cabeçalho `x-ratelimit-limit-anon_burst: 20/min` |
| Diário | 200 chamadas por dia | [medido] cabeçalho `x-ratelimit-limit-anon_sustained: 200/day` |
| Tamanho de página | 20 | [medido] `page_size=21` devolve 401, `page_size may not exceed 20 for anonymous requests` |
| Profundidade | 240 resultados por busca (12 páginas) | [medido] `page=13` devolve 401, `pagination depth may not exceed 240 for anonymous requests`; `result_count` trava em 240 |
| Com cadastro | 100 por minuto, 10.000 por dia | [lido] `api/conf/settings/rest_framework.py` do repositório WordPress/openverse: `"oauth2_client_credentials_sustained": "10000/day"` e `"..._burst": "100/min"` |

- [medido] O cabeçalho `x-ratelimit-available-anon_sustained` ficou em 199 nas 64 chamadas (causa não investigada). Ele não serve de contador; o pipeline conta as próprias chamadas.
- [medido] `result_count` exagera: nos 4 termos paginados até o fim vieram 25 de 28, 22 de 23, 32 de 34 e 37 de 47 anunciados.
- [medido] Tamanho do acervo de áudio (`/v1/audio/stats/`): Wikimedia 3.986.828, Jamendo 644.709, Freesound 591.898.
- [lido] Termos de serviço (https://docs.openverse.org/terms_of_service.html). Seção 2: "You must adhere to all rate limits", "You must not scrape the content in the Openverse catalog", e exige "providing proper attribution to CC-licensed works and respecting the terms and conditions of platforms hosting CC-licensed works". Seção 3: o Openverse "does not verify its licensing status". Seção 4: "you must prominently indicate that it was made using Openverse but is not endorsed or certified by Openverse". Seção 5: "reserves the right to charge fees for commercial uses of Openverse and/or for heavy usage".
- Leitura para o plano: busca dirigida por termo, seguida de curadoria, cabe nos termos; cópia em massa do catálogo não cabe.

## (b) Tocar a prévia direto da CDN ou hospedar o arquivo

- [medido] `https://cdn.freesound.org/previews/...-hq.mp3` responde 200 sem chave, com `access-control-allow-origin: *` e `accept-ranges: bytes`, sem `cache-control`. Há quatro variantes (`-hq.mp3`, `-lq.mp3`, `-hq.ogg`, `-lq.ogg`), todas 200. Tocar direto funciona no navegador.
- [lido] Nenhum documento lido autoriza nem proíbe, com todas as letras, que um app de terceiros toque a prévia direto da CDN (lidos: termos do Openverse, termos da API e do site do Freesound, FAQ e documentação da API). O que existe: a documentação pede "Do not abuse server bandwidth"; os termos da API, que valem para quem usa chave, proíbem "allow access or linking to the Freesound API or Content from any location or source other than your Application" e permitem "limited intermediate copies of Content [...] Without prejudice to any Content License terms".
- [lido] A licença de cada som permite a cópia. CC0 é renúncia de direitos. CC BY 4.0, seção 2(a)(1)(A): "reproduce and Share the Licensed Material, in whole or in part". Os termos do site do Freesound dizem que sons e metadados "are distributed under the Creative Commons license indicated for each item" e que "The license applied to a sound applies also to associated metadata".
- Recomendação: hospedar nós mesmos o recorte de até 20 s (no pacote do app ou no nosso domínio) e guardar no índice a página de origem. Motivos: funciona sem rede, não depende da CDN de uma universidade, não envia o IP de quem usa o app a terceiros e não gasta a banda deles.
- O que cada licença exige ao hospedar: CC0, nada; CC BY, crédito completo e aviso de que o som foi cortado; CC BY-SA, o mesmo, mais a regra de mesma licença se o som for adaptado.
- [medido] Tamanho: nos 572 sons do Freesound com até 20 s, a prévia `-hq.mp3` (128 kbps) tem mediana de 150 KB, média de 186 KB e máximo de 518 KB; duração mediana de 7,7 s. Cem sons somam de 15 a 19 MB.

## (c) Crédito em CC BY, efeito de CC BY-SA e recomendação

- [lido] CC BY 4.0, seção 3(a)(1) (https://creativecommons.org/licenses/by/4.0/legalcode.en): manter "identification of the creator(s)", "a copyright notice", "a notice that refers to this Public License", "a notice that refers to the disclaimer of warranties" e "a URI or hyperlink to the Licensed Material"; "indicate if You modified the Licensed Material"; indicar a licença com o texto ou o link. Seção 3(a)(2): vale "any reasonable manner", inclusive "providing a URI or hyperlink to a resource that includes the required information". Seção 3(a)(3): retirar o crédito se o autor pedir.
- [lido] FAQ da Creative Commons (https://creativecommons.org/faq/): "For versions prior to 4.0, you must also provide the title of the work"; cortar um trecho conta como modificação ("if you have taken an excerpt"). [medido] Em 18 sons CC BY do Freesound (busca `rain`), 7 são BY 3.0 e 11 são BY 4.0.
- No app, isso vira uma tela "Créditos" alcançável da janela Sons, com título, autor, link da página do som, licença com link e a nota "recortado e normalizado", nos três idiomas. O campo `attribution` do Openverse traz a frase pronta, só em inglês.
- [lido] CC BY-SA 4.0, seção 3(b): a mesma licença só é exigida "if You Share Adapted Material You produce". FAQ: obras CC podem entrar em coleções e isso "does not change the license applicable to the original material". Empacotar o som inalterado não obriga o app a ser BY-SA. Duas ressalvas: há adaptação sempre que o som é "synched in timed relation with a moving image"; e todas as licenças CC, BY inclusive, proíbem "Effective Technological Measures". A wiki da CC (https://wiki.creativecommons.org/wiki/4.0/Technical_protection_measures) registra que distribuir pela App Store "may constitute a violation of the license" e pede mais estudo.
- [lido] O Freesound só oferece CC0, BY e BY-NC (FAQ do Freesound); o BY-SA que aparece no Openverse vem de Jamendo e Wikimedia.
- [lido] CC0 não resolve tudo. Seção 4(c): "Affirmer disclaims responsibility for clearing rights of other persons". Voz de terceiros (riso, choro, sussurro) continua sendo risco de quem publica.

| Opção | O que se ganha | Custo |
|---|---|---|
| Só CC0 (recomendada) | Nenhuma obrigação de crédito, nenhuma dúvida sobre loja de apps, índice e testes simples | Perde cerca de metade do acervo (medição anterior: 70 CC0, 73 BY e 17 BY-SA em 160). Os 40 termos mostram que o CC0 basta |
| CC0 + BY | Dobra os candidatos | Tela de créditos obrigatória em 3 idiomas, nota de modificação por som, BY 3.0 e 4.0 misturados, pedido de retirada de crédito, dúvida da App Store e teste que barra som sem crédito |

## (d) Parâmetros do Openverse e o que devolvem de fato

Tudo [medido], na busca `rain` com `license=cc0`, salvo indicação.

| Parâmetro ou campo | Comportamento |
|---|---|
| `license=cc0` | 792 de 792 resultados únicos dos 40 termos vieram `cc0` |
| `length=shortest` | menos de 30 s (5,4 a 24,8 s em `rain`; máximo de 29,98 s nos 40 termos). Não há filtro de 20 s: corta-se depois pelo campo `duration`, em milissegundos |
| `length=short`, `medium`, `long` | 30 a 104 s; 120 a 526 s; acima de 600 s |
| `category=sound_effect` | 0 resultados, com ou sem filtro de licença. Dos 792, 748 têm `category` nulo e 44 são `pronunciation` da Wikimedia. Não serve para o Freesound |
| `category=music` | só Jamendo (20 de 20), nenhum CC0 |
| `source=freesound` | tira as pronúncias da Wikimedia: em `hospital`, os sons do Freesound na página sobem de 11 para 20 |
| padrão, sem parâmetro de sensíveis | esconde só o que foi marcado por texto. Em `moan` passam "women moaning" e "Female Moaning 1.wav" |
| `unstable__include_sensitive_results=true` | inclui os marcados: 4 de 20 em `moan`, com `unstable__sensitivity: ["sensitive_text"]` |
| campo `mature` | falso em todos, inclusive nos 4 explícitos. [lido] no código do Openverse, a marcação vinda da fonte "is currently unused" |
| campo `description` | ausente da resposta e do esquema; `fields_matched` cita `description`, então ela é indexada e não devolvida |
| campo `tags` | 6.396 tags nos 792 resultados, todas com `unstable__provider: freesound` e `accuracy: null`, ou seja, escritas por quem subiu o som |
| `q` | reduz a palavra à raiz: `humming` devolve "Fluorescent Light Hum" junto com voz cantarolando |

## (e) API do Freesound com chave gratuita

Tudo [lido] em https://freesound.org/docs/api/ (visão geral, autenticação, recursos e termos). Nada medido, porque exige chave.

- Chave: criar conta no Freesound e pedir a credencial em https://freesound.org/apiv2/apply. Usa-se a coluna "Client secret/Api key" como `token=` na URL ou no cabeçalho `Authorization: Token`.
- Limites: "60 requests per minute and 2000 requests per day"; `page_size` até 150.
- Campos: `description` ("The textual description the user gave to the sound"), `name`, `tags`, `username`, `license`, `duration` em segundos, `previews` (quatro URLs), `category` e `subcategory` da Broad Sound Taxonomy ("filled out by an algorithm if not provided"), `category_is_user_provided`, `avg_rating`, `num_downloads`.
- Filtros: `license:"Creative Commons 0"`, `duration:[0 TO 20]`, `tag:`, `description:`. Conteúdo explícito: a tabela de campos traz "is explicit [...] Whether the sound is marked as explicit", filtrável; a FAQ chama o campo de `is_explicit`.
- Restrição: "You can use the Freesound API for free only for non-commercial purposes. To use the Freesound API for commercial purposes, please contact us". Os termos (https://freesound.org/help/tos_api/) também proíbem raspagem e "build similar databases".
- O arquivo original exige OAuth2; a prévia não ("Retrieving previews does not require OAuth2 authentication").

## (f) Quarenta termos e quantos sons CC0 com até 20 s existem

Consulta: `GET https://api.openverse.org/v1/audio/?q=TERMO&license=cc0&length=shortest&page_size=20`, uma página por termo, 3,6 s entre chamadas. Em cada célula: termo, `result_count` (CC0 com menos de 30 s; 240 é o teto anônimo e quer dizer "240 ou mais") e, depois do ponto, quantos dos 20 primeiros têm até 20 s. Tabela bruta em `docs/pesquisa/acervo-sons-termos.tsv`.

| Ambiente | Corpo | Objeto | Natureza |
|---|---|---|---|
| room tone 164 · 7 | heartbeat 108 · 18 | clock ticking 232 · 18 | thunder 240 · 12 |
| distant traffic 47 · 4 | breathing 240 · 20 | door slam 240 · 19 | wind howling 34 · 14 |
| crowd murmur 28 · 11 | sigh 183 · 19 | door creak 240 · 20 | ocean waves 142 · 13 |
| train station 240 · 10 | footsteps 240 · 16 | keys 240 · 19 | fire crackling 111 · 18 |
| hospital 114 · 16 | swallow 128 · 17 | glass breaking 240 · 20 | birdsong 240 · 12 |
| church bells 140 · 17 | laughter 240 · 18 | phone ringing 240 · 15 | crickets 240 · 15 |
| playground 83 · 15 | sobbing 23 · 17 | typing 240 · 15 | stream 240 · 15 |
| elevator 240 · 19 | whisper 236 · 15 | kettle 133 · 16 | water dripping 240 · 15 |
| electric hum 240 · 17 | yawn 61 · 17 | match strike 94 · 19 | rain on window 61 · 11 |
| radio static 240 · 17 | humming 240 · 13 | music box 168 · 15 | leaves rustling 123 · 19 |

- [medido] 800 resultados, 792 únicos, 618 com até 20 s (572 do Freesound e 46 da Wikimedia); 567 deles têm 3 tags ou mais. Por termo: mínimo 4, mediana 16, máximo 20. Dezenove termos bateram no teto de 240.
- [medido] Contagem exata dos quatro termos mais fracos, paginados até o fim: distant traffic 17, crowd murmur 15, sobbing 19, wind howling 24.
- Limite da medição: o total exato dos outros 36 termos não pôde ser contado, por causa do teto de 240 e da falta de filtro de 20 s. Piso aproximado (`result_count` vezes a fração da primeira página): cerca de 5.500 sons nos 40 termos.
- [medido] Qualidade da anotação nos 572 sons do Freesound com até 20 s: mediana de 7 tags, 5 com menos de 3 tags. Dos 618 títulos, 271 terminam em extensão de arquivo (".wav", ".mp3") e pedem limpeza.
- [medido] Ruído: `hospital`, `playground`, `stream` e `kettle` trazem pronúncias da Wikimedia (some com `source=freesound`). `sobbing` mistura choro de bebê e de adultos, e passa pela curadoria humana.

## Afirmações de que o plano depende

| Id | Afirmação | Procedência |
|---|---|---|
| acervo-sons-01 | Openverse anônimo: 20 por minuto, 200 por dia, página de 20, teto de 240 resultados por busca | medido |
| acervo-sons-02 | Os termos do Openverse proíbem raspagem, exigem crédito e o aviso "made using Openverse", e reservam cobrança por uso comercial | lido |
| acervo-sons-03 | Em 40 termos há de 4 a 20 sons CC0 com até 20 s na primeira página (mediana 16); 618 únicos no total | medido |
| acervo-sons-04 | `category` não funciona para o Freesound; o filtro útil é `source=freesound` com `length=shortest` e corte local por `duration` | medido |
| acervo-sons-05 | O filtro de sensíveis é textual e `mature` é sempre falso; conteúdo sexual passa com o filtro ligado | medido |
| acervo-sons-06 | O Openverse não devolve descrição; a anotação disponível é título e tags humanas (mediana 7) | medido |
| acervo-sons-07 | A API do Freesound com chave gratuita dá descrição, filtro de licença e de duração e marcação de explícito, a 60 por minuto e 2.000 por dia | lido |
| acervo-sons-08 | A API do Freesound só é gratuita para uso não comercial | lido |
| acervo-sons-09 | A CDN de prévias aceita reprodução direta (CORS aberto, range); cem sons com até 20 s pesam de 15 a 19 MB | medido |
| acervo-sons-10 | CC0 e CC BY permitem hospedar o arquivo; nenhum documento lido autoriza ou proíbe tocar direto da CDN em app de terceiros | lido |
| acervo-sons-11 | CC BY exige autor, aviso de licença com link, link do som e aviso de modificação; BY 3.0 exige também o título | lido |
| acervo-sons-12 | CC BY-SA não contamina o app se o som entrar inalterado, mas toda licença CC proíbe medida tecnológica restritiva e a wiki da CC aponta dúvida na App Store | lido |

## Recomendações para o plano

1. Fonte padrão do pipeline: Openverse anônimo com `source=freesound&license=cc0&length=shortest&page_size=20`, até 2 páginas por termo, 3 s ou mais entre chamadas, contador próprio (máximo de 200 por dia) e cache em disco das respostas.
2. Filtro local: `duration` até 20.000 ms, 3 tags ou mais, título sem extensão de arquivo, lista de termos barrados aplicada a título e tags.
3. Conteúdo seguro: escuta humana de cada som antes de entrar no índice, com registro de quem ouviu e quando. `mature` e o filtro do Openverse não contam como garantia.
4. Baixar a prévia `-hq.mp3` uma vez, cortar e normalizar com ffmpeg (instalado nesta máquina, versão 9.0.1) e empacotar o recorte no app.
5. Guardar por som: id do Openverse, página de origem, autor e link do autor, licença, versão e link da licença, título original, título limpo, tags e hash do arquivo.
6. Tela de créditos nos três idiomas, gerada do índice, com a linha exigida pelo Openverse ("feito com o Openverse; sem endosso nem certificação").
7. Fonte trocável: `OpenverseSource` (padrão, sem chave) e `FreesoundSource` (opcional, chave por variável de ambiente), que acrescenta `description`, `is_explicit` e filtro exato de duração.
8. Teste do pipeline que falha se entrar som que não seja CC0, com mais de 20 s, sem dados de origem ou sem registro de escuta.
9. No pré-prompt, tratar título e tags do som como a descrição humana disponível; sem a chave do Freesound não há texto corrido.

## Decisões que só o dono pode tomar

1. O app será comercial (pago, com anúncio ou compra interna)? Disso depende poder usar a chave gratuita do Freesound.
2. Só CC0 (recomendado) ou CC0 mais CC BY?
3. Criar conta e chave no Freesound para ter descrição humana e marcação de explícito, ou ficar com título e tags do Openverse?
4. Entram sons com voz humana (riso, choro, sussurro)? CC0 não cobre direitos da pessoa gravada.
5. Quem faz a escuta de cada som e quais temas ficam fora (gemido, grito, choro de bebê)?
6. Recortes dentro do pacote do app (15 a 19 MB por cem sons) ou servidos do nosso domínio?
