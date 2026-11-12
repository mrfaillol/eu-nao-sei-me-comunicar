# SDD ledger — plan: docs/superpowers/plans/2026-11-12-eu-nao-sei-me-comunicar.md
Executor: inline (executing-plans). Ramo v1. Ordem: 1, 2, 9, 10, 11, 12, 3-8, 13-18.
Setup: Ruling: repo novo sem commits, trabalho no ramo v1 no próprio diretório, sem worktree — não há histórico a isolar — custo se errado: nenhum, main nunca existiu.

## Pre-flight (interfaces compartilhadas)
- T1→T3,T4,T6,T7: validar_item(item, construtos, fontes) -> list[str]. Consistente.
- T1→T9..T16: Item em snake_case igual ao JSON. Consistente.
- T2→T9: glossário real {id, termo, variantes, definicao, referencia, dimensao}; fixture casos.json tem outro formato. Coberto pelo adaptador glossarioDosCasos() da T9.
- T9→T10→T11→T12: termosPermitidos / validarFrase(frase, construtosUsados, itens, idioma, glossario) / comporFrase -> {frase, construtos_usados}. Consistente.
- T12→T16: Resposta.origem "modelo"|"modelo_2"|"regra". Consistente.
- T5→T8: CONFLITO. T8 exige todas as caixas em saida/pinturas.json; T5 só fala de rosto e nitido. Ruling: T5 grava `rostos` (todas as caixas aceitas com sinais) e `destaque` no intermediário; o item público leva só `rosto` e `nitido` — a T8 depende disso — custo se errado: um campo a mais no intermediário.
- T12 (ordem nova): Step 4 pede curl com 3 ids reais, mas o acervo real só existe depois da T7. Ruling: na T12 o plugin de dev e o curl usam tests/fixtures/acervo-de-teste.json gerado de casos.json; o curl com ids reais é repetido ao fim da T7 — a ordem B-antes-de-A foi decidida no grill-me — custo se errado: nenhum, a verificação real acontece depois.

## Tarefas
Task 1: complete (commits ebcdc54..1a3d7fb, tests: bash -c 'cd pipeline && uv run pytest -q' → 6 passed in 0.05s)
Task 2: complete (commits 1a3d7fb..0be72c1, tests: bash -c 'cd pipeline && uv run pytest -q' → 11 passed, 1 deselected in 0.07s)
Task 9: complete (commits 0be72c1..de79903, tests: pnpm test →    Duration  190ms (transform 43%, import 27%, tests 22%, worker 8%))
Task 10: Ruling: o plano pedia casar termo em zh-CN só em fronteira de Intl.Segmenter; medido que o ICU segmenta 是正|性|效|价 e o termo 正性效价 nunca cai em fronteira (a frase de referência do caso 5 era rejeitada) — troquei por termo mais longo primeiro + lista PALAVRAS_COMUNS_QUE_CONTEM_TERMO (差异化, 单独处理) — custo se errado: palavra comum fora da lista gera falso V5, que só leva à segunda tentativa ou à frase por regra.
Task 10: Ruling: "detecção por radical ou lema" virou variantes curadas no glossário, sem stemming automático — stemming automático confundiria empatia/empate e solidão/solidário — custo se errado: forma derivada não listada passa por V5 e depende de V6.
Task 10: Ruling: as 18 frases "gravadas" do protótipo são conferidas em todos os códigos menos V5 — o protótipo liberava termo de dimensão quando UM item passava do corte; a T9 usa média de itens com norma direta — custo se errado: nenhum, o compositor do protótipo é substituído na T11.
Task 10: nenhuma frase de frases.json ficou como it.fails: 33/33 defeituosas rejeitadas, 12/12 clínicas com V6, 18/18 de referência aceitas, 10/10 sondas de língua no esperado.
Task 10: complete (commits de79903..6960fc1, tests: pnpm test →    Duration  9.05s (tests 40%, transform 36%, import 21%, worker 3%))
Task 11: Ruling: o plano previa duas lacunas {c1} {c2} em todo molde; na leitura das frases, o tom divergente citava 2 de 3 construtos e um item escolhido sumia da frase — os tons sensível e divergente passaram a usar {lista}, com um termo por item (2 ou 3), e cada idioma tem a sua função juntar — custo se errado: frase um pouco mais longa; o validador aceita até 4 termos.
Task 11: Ruling: o molde em pt-BR não pode usar "segundo plano" porque V8 barra a palavra "segundo" — troquei por "ao fundo" em vez de afrouxar o validador — custo se errado: nenhum.
Task 11: Ruling: a sonda de pareamento cego (Step 5) fica para depois da T7 — com itens sintéticos o juiz parearia pelos próprios termos e o teste não mediria nada; com o acervo real ele vê só o texto humano dos itens — custo se errado: descobrir molde genérico mais tarde, com o acervo já montado.
Task 11: medido com o glossário real: 18 de 18 frases de amostra (6 seleções × 3 idiomas) passam no validador.
Task 11: complete (commits 6960fc1..a2c6736, tests: pnpm test →    Duration  5.24s (tests 45%, transform 34%, import 17%, worker 4%))
Task 12: Ruling: o plano previa adaptador sem SDK e modelo padrão claude-haiku-5-5; a skill claude-api manda usar o SDK oficial e claude-opus-5-5 quando o dono não nomeia modelo (ele respondeu "decidir depois") — segui a skill; FRASE_MODELO troca o modelo — custo se errado: custo por frase maior até o dono escolher.
Task 12: Ruling: claude-opus-5-5 rejeita temperature (400) — a interface do provedor recebe `tentativa` (1 ou 2) em vez de temperatura, e a segunda tentativa se apoia na instrução de correção por código violado — custo se errado: nenhum para provedores que aceitem temperatura, que podem derivá-la da tentativa.
Task 12: Ruling: o prazo de 8.000 ms é do cliente; o servidor usa 7.000 ms no total das duas tentativas, para a resposta chegar antes de o cliente desistir — custo se errado: segunda tentativa cortada em rede lenta, e a pessoa recebe a frase por regra.
Task 12: Ruling: openrouter.ts não foi escrito — sem chave não há como testar, e o dono não escolheu esse provedor; a interface Provedor deixa o acréscimo em um arquivo — custo se errado: uma tarefa pequena depois.
Task 12: Ruling: fallbacks "default" ligado no provedor (beta server-side-fallback-2026-07-01), como a skill recomenda para claude-opus-5-5; se ainda houver recusa, cai na regra — custo se errado: nenhum.
Task 12: o plugin de dev responde 503 sem public/indice; o curl com ids reais (Step 4) fica para o fim da T7, como decidido no pre-flight.
Task 12: sonda com modelo real (subagente, família Opus): 17/18 aprovadas na 1ª tentativa; reprovada zh-CN caso 2 por V9, recusa correta; injeção do caso 6 tratada como dado nos 3 idiomas. As 18 respostas viraram regressão em tests/fixtures/sonda-modelo.json.
Task 12: complete (commits a2c6736..5db133b, tests: pnpm test →    Duration  2.62s (import 51%, tests 26%, transform 19%, worker 4%))
Task 12 (pós-conclusão): revisão automática de segurança apontou 2 achados médios em src/servidor/interpretar.ts; corrigidos com teste RED→GREEN: origem fora da lista agora dá 403 antes do modelo; content-type sem preflight dá 415; corpo medido em fluxo, 413 acima de 1 KB (o teste do corpo sem fim travava o processo antes do conserto); max_tokens 4096. Suite 222/222. Fica em aberto, por desenho: limite de pedidos por cliente é da hospedagem.
Task 3: Ruling: o plano previa afeto de zh-CN pelas 264 linhas de questionário de Zheng; lendo os valores, há valência com sinal trocado (恨意 +1,22; 国耻 +1,46; 狂喜 -0,96; 盼望 -1,67) — as palavras de zh-CN ficam com afeto ausente, norma_zheng saiu do código e um teste guarda a evidência — custo se errado: perder número bom em mandarim; ganho: não embarcar número errado. Norma direta ficou só no inglês: 10 de 30 palavras têm entrada no Glasgow.
Task 3: Ruling: o glossário ganhou 12 construtos (gratidão, compaixão, inveja, constrangimento, divagação mental, ostracismo, dissonância cognitiva, fluxo, medo, raiva, emoções positivas, arrependimento), todos com DOI conferido — com 22 faltava construto para boa parte das palavras — custo se errado: definições novas à espera de revisão humana. Total: 34 + 4 de dimensão, 35 DOIs resolvem.
Task 3: Ruling: palavra cujo construto teria polaridade oposta à do termo (desalento → esperança) ficou fora; anotação só entra quando a glosa a sustenta.
Task 3: o Wiktionary devolveu 429 na 25ª consulta com 1 s de intervalo; o carregador ganhou recuo com Retry-After (teste RED→GREEN) e intervalo de 2,5 s.
Task 7 (antecipado): Ruling: a invariante "no máximo 2 itens com um único e mesmo construto" é impraticável com 150 itens e 34 construtos — vira "menos de 0,5% dos trios de um idioma têm um só construto", e a seleção de um só termo recebe o molde de um termo sem chamar o modelo — custo se errado: frase de um termo em caso raro.
Task 3: complete (commits 5db133b..87cc0fc, tests: bash -c 'cd pipeline && uv run pytest -q' → 21 passed, 1 deselected in 7.73s)
Task 4: Ruling: para_item_pintura devolve construtos vazios e o teste valida o item já anotado — a anotação é da T7 e o schema exige ao menos 1 construto — custo se errado: nenhum.
Task 4: medido: 30 pinturas, 1 candidata recusada pela ficha, cópias WebP somam 6,9 MB. limpar_texto foi para acervo/texto.py porque os sons usam a mesma limpeza.
Task 5: medido: 20 das 30 pinturas ficaram com rosto de destaque (o plano esperava ao menos 12). Regra provisória de área acerta 6 de 8 no gabarito; só centro acertaria 8 de 8, só confiança 5 de 8, com piso de 3%. pontuar_rosto está com TODO(human).
Task 6: Ruling: o cache de buscas foi semeado com as 30 respostas do Openverse que a pesquisa já tinha baixado (consulta sem source=freesound; o filtro local garante a fonte) — o teto anônimo é de 200 chamadas por dia e a pesquisa gastou boa parte — custo se errado: nenhum, são as mesmas respostas da API.
Task 6: Ruling: dentro de cada termo vale a ordem de relevância da busca, não a ordem de id que o plano dizia — a ordem de id escolhia som arbitrário — custo se errado: nenhum, continua determinístico.
Task 6: Ruling: saíram os termos "crowd murmur" e "playground" e entraram na lista de barrados announcement, crowd, children, people e afins — três sons escolhidos tinham voz humana e a primeira versão é sem voz — custo se errado: menos variedade; dois termos cedem um segundo som.
Task 6: a API real não devolve foreign_identifier (a fixture sintética inventava o campo e o comando quebrou em produção de dados); o número do som sai do endereço da página no Freesound, com teste sobre a resposta real. Medido: 30 sons, 4,6 MB.
Task 4: complete (commits 87cc0fc..a32ac61, tests: bash -c 'cd pipeline && uv run pytest -q tests/test_pinturas.py' → 9 passed in 3.82s)
Task 5: complete (commits a32ac61..5e2e782, tests: bash -c 'cd pipeline && uv run pytest -q tests/test_rostos.py' → 15 passed in 6.54s)
Task 6: complete (commits 5e2e782..b9e0310, tests: bash -c 'cd pipeline && uv run pytest -q' → 59 passed, 1 deselected in 18.14s)
Task 7: Ruling: itens cujo texto humano não sustenta nenhum construto saem do acervo em vez de receber construto forçado — Swift Bull, The Stubble Field e o som Church Bells (data/pinturas-excluidas.txt, data/sons-excluidos.txt) e os termos match strike e train station — custo se errado: acervo um pouco menos variado.
Task 7: Ruling: The Fourth King of Hell (cena de tortura) fica fora do acervo de demonstração por violência gráfica — a decisão sobre o que conta como seguro é do dono — custo se errado: uma pintura a menos do período anterior a 1400.
Task 7: medido: índice com pintura 30 | som 30 | palavra 90 | pendentes 150 | erros 0; os 60 trechos de anotação existem no texto humano; trios de um só construto: pt-BR 0,140%, en 0,102%, zh-CN 0,088% (teto 0,5%). Seleção com menos de 2 termos vai direto para a regra, sem chamar o modelo (teste RED→GREEN).
Task 7: Step 4 da T12 cumprido aqui: curl no servidor de dev com 3 ids reais devolveu frase por regra nos 3 idiomas; origem de fora 403; texto livre 400.
Task 7: achados de segurança corrigidos no caminho: rótulo de terceiros limpo e limitado a 120 (schema inclusive); chamadas de rede do pipeline com recuo em erro passageiro (o 522 do museu derrubava o comando).
Task 7: complete (commits b9e0310..478b4ac, tests: bash -c 'cd pipeline && uv run pytest -q && cd .. && pnpm test' →    Duration  687ms (tests 53%, import 29%, transform 16%, worker 2%))
Task 11 (Step 5, feito com o acervo real): pareamento cego com modelo como juiz, que só viu o texto humano dos itens: 6 de 6 frases pareadas com a seleção certa, confiança alta em todas. Aproximação; com gente, NÃO PROVADO.
Task 8: Ruling: item reprovado sai também do índice de demonstração, não só do publicável — reprovar e continuar mostrando não faria sentido — custo se errado: nenhum.
Task 8: Ruling: aprovação sem nome de quem revisou não vale e vira aviso na montagem — o registro de quem viu e ouviu é a razão de a folha existir — custo se errado: o dono precisa preencher o nome.
Task 8: a folha (revisao/index.html, fora do git e fora de public/) lista os 150 itens; texto de terceiros entra escapado (teste com <script>). `acervo rostos` lê as decisões, então o destaque manual gera o recorte nítido certo.
Task 8: complete (commits 478b4ac..159ee4c, tests: bash -c 'cd pipeline && uv run pytest -q' → 86 passed, 1 deselected in 3.48s)
Task 8 (pós-conclusão): achado de segurança corrigido com teste RED→GREEN: a aprovação carrega a impressão digital do item (texto, construtos, crédito, caixas e bytes da mídia) e só vale se o item não mudou; reprovação vale sempre.
Task 13-16: Ruling: as quatro tarefas do site foram executadas juntas, com os testes de lógica (i18n, seleção, zoom, áudio, pedido) escritos e vistos falhar antes do código, e a tela depois — os módulos de tela dependem uns dos outros e separá-los em quatro commits exigiria telas intermediárias que não rodam — custo se errado: revisão por tarefa menos granular; o intervalo de commits é o mesmo para as quatro.
Task 13: Ruling: fontes pela pilha do sistema (serifada para a voz humana, sans para a máquina), nada baixado — funciona sem rede e sem licença a conferir — custo se errado: a serifada varia entre aparelhos.
Task 13: Ruling: a bandeja das escolhas é a barra de tarefas, com idioma, créditos e ajuda no canto direito — decisão de desenho coerente com as janelas — custo se errado: nenhum funcional.
Task 15: Ruling: o zoom começa quando a distribuição aparece (300 ms por posição, 1.400 ms); com movimento reduzido a duração é zero e o quadro salta para o rosto — é o comportamento medido na pesquisa; a escolha fina é do dono (decisão 15 do dossiê).
Task 16: Ruling: fechar a caixa da frase (Esc) equivale a recomeçar — uma seleção completa sem frase à vista seria um beco sem saída.
Task 13-16: medido: 248 testes de unidade e 32 de navegador (celular 390x844 e mesa 1280x800) passam; nenhuma requisição para fora do site em uso; capturas em docs/capturas/. Defeitos vistos nas capturas e corrigidos: barra de tarefas espremia as escolhas no celular; a terceira janela cobria o botão da segunda.
Final: minor (deferred): a citação da referência ("Keltner e Haidt") usa "e" em português também nas telas em inglês e mandarim.
Final: minor (deferred): o botão de denúncia da frase (política do Google Play) não existe; depende de um canal de contato do dono.
Task 13: complete (commits 159ee4c..1a30106, tests: pnpm test →    Duration  804ms (transform 42%, import 30%, tests 25%, worker 3%))
Task 14: complete (commits 159ee4c..1a30106, tests: pnpm test →    Duration  1.02s (transform 38%, tests 30%, import 29%, worker 2%))
Task 15: complete (commits 159ee4c..1a30106, tests: pnpm test →    Duration  1.32s (transform 35%, import 32%, tests 29%, worker 4%))
Task 16: complete (commits 159ee4c..1a30106, tests: pnpm test →    Duration  770ms (transform 38%, tests 31%, import 28%, worker 3%))
Task 17: medido: site construído com 15 MB; service worker guarda 94 arquivos (12,6 MB); teste de navegador corta a rede, recarrega, faz 3 escolhas e recebe a frase. Manifesto com nome, ícones 192 e 512, standalone, preto. base "./" no Vite para o mesmo pacote servir na web e no Capacitor. 34 testes de navegador passam (2 pulados de propósito: o teste sem rede roda num projeto só).
Task 17: complete (commits 1a30106..984ec57, tests: pnpm test →    Duration  801ms (transform 43%, tests 28%, import 26%, worker 2%))
Task 18: medido: cap add android, cap add ios e cap sync com código 0; xcodebuild (Xcode 27.1 via DEVELOPER_DIR, sem sudo, CODE_SIGNING_ALLOWED=NO, sdk iphoneos) terminou em ** BUILD SUCCEEDED **, App.app de 14 MB com public/indice dentro. Android não compilado: falta o SDK; instalar é decisão do dono.
Task 18: Ruling: appId provisório art.eunaoseimecomunicar.app — o identificador definitivo depende das contas de loja do dono — custo se errado: renomear o identificador nos dois projetos nativos.
Task 18: complete (commits 984ec57..712b555, tests: pnpm test →    Duration  1.07s (transform 62%, import 20%, tests 15%, worker 3%))
Final review: revisor de contexto novo (modelo mais capaz), relatório em docs/revisao-final-2026-11-12.md: 1 Critical, 9 Important, 17 Minor, 1 suspeita.
Final: fixed C1 (validador aceitava atribuição de estado por oblíquo, sujeito oculto, contração e terceira pessoa) — 8 frases do revisor em tests/fixtures/revisao-final.json RED→GREEN, suite 269/269
Final: fixed I1 (conselho e menção de ajuda passavam) — 5 frases do revisor RED→GREEN, suite 269/269
Final: fixed I2 (ajuda inerte atrás da caixa da frase; destaque sumia ao fechar) — e2e "a ajuda aparece destacada dentro da caixa da frase" RED→GREEN, e2e 44/44
Final: fixed I3 (janelas passavam por cima da barra de tarefas depois de 11 toques) — e2e "a barra de tarefas continua por cima" RED→GREEN
Final: fixed I4 (toque duplo escolhia item não visto) — podeEscolher RED→GREEN e e2e "toque duplo numa pintura escolhe uma só" RED→GREEN
Final: fixed I5 (procedência confiava na lista do modelo) — "a procedência vem dos termos que o servidor achou" RED→GREEN
Final: fixed I6 (falha do provedor engolida) — aoFalhar com tipo, 3 testes RED→GREEN
Final: fixed I8 (folha reassinava aprovação antiga) — a regra no script da folha; teste confere a presença da regra na página. NÃO PROVEI em navegador: o teste foi escrito junto com o conserto e não foi visto falhar.
Final: fixed I9 (× de retirar invisível) — e2e de cor RED→GREEN
Final: Ruling: I7 (pedido sem Origin gasta a chave; sem limite por cliente nem cache) fica como está — limite por cliente exige estado que a função sem servidor não tem; está no README como condição para gravar a chave, junto de medir o validador — custo se errado: gasto sem teto se o dono ligar a chave sem o limite da hospedagem.
Final: Ruling: "yourself" barrado em inglês, com falso positivo conhecido em duas frases do compositor antigo — fecha "harming yourself"; a queda é para a frase por regra — custo se errado: frase boa do modelo descartada.
Final: Ruling: o modelo padrão continua claude-opus-5-5 (a skill claude-api manda quando o dono não nomeia modelo) mas o revisor tem razão em que o plano previa um menor; a decisão vai ao dono no fecho — custo se errado: custo por frase.
Final: minor (deferred): M1 falsos positivos de V10 e V8 (rótulo em mandarim citado em frase em inglês; sobrenome de autor igual a palavra comum, como "tour").
Final: minor (deferred): M2 a correção da segunda tentativa vai no canal do usuário.
Final: minor (deferred): M3 o pré-prompt inteiro vai no pacote do navegador por causa de VERSAO_PROMPT.
Final: minor (deferred): M4 montar --publicavel sem aprovações grava índice vazio com código 0.
Final: minor (deferred): M5 som continua tocando atrás das caixas de ver inteira, créditos e ajuda.
Final: minor (deferred): M6 o foco do teclado volta ao topo a cada escolha.
Final: minor (deferred): M7 três botões "Ver inteira" com o mesmo nome acessível; aria-label "Tocar" com texto "Pausar".
Final: minor (deferred): M8 anel de foco pouco visível sobre azul-marinho e sobre pintura clara.
Final: minor (deferred): M9 na virada do ciclo, "outras três" pode repetir item da mesa.
Final: minor (deferred): M10 testes de navegador só em Chromium; foco 4 (troca de idioma com seleção em curso) sem teste de tela.
Final: minor (deferred): M12 Retry-After sem teto; `acervo rostos` quebra em clone novo sem o cache de prints; URL de prévia sem conferir esquema; termo barrado com hífen passa.
Final: minor (deferred): M13 nudez e violência coletadas na folha e não usadas pelo site.
Final: minor (deferred): M15 janela pode ser arrastada para fora da tela; barra de diálogo mostra cursor de arrastar.
Final: minor (deferred): M16 recomeçar durante a espera não aborta o pedido ao modelo.
Final: minor (deferred): M17 cada rodada de e2e regrava as capturas versionadas.
Final: suspeita (não conferida): S1 mp3 no pré-cache do service worker sem Range; no Safari do iPhone o som pode não tocar na PWA.
