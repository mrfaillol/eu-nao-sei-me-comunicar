# Revisão final do ramo v1 — Eu Não Sei Me Comunicar

Data: 12/Nov/2026. Revisor com contexto novo, somente leitura. Nenhum arquivo do projeto foi alterado além deste relatório.

## Escopo e método

- Pedido: revisar o ramo `v1` no HEAD `984ec57`. Durante a revisão o executor commitou `712b555` (Tarefa 18). Conferido com `git diff --stat 984ec57 HEAD -- . ':!android' ':!ios'`: só mudaram `README.md`, `capacitor.config.ts`, `package.json` e `pnpm-lock.yaml`. Todo o código revisado (`src/`, `pipeline/`, `e2e/`) é idêntico nos dois commits. O README lido é o de `712b555`.
- Lido inteiro: `src/frase/*.ts`, `src/frase/moldes/*.ts`, `src/servidor/**/*.ts`, `src/ui/*.ts`, `src/estilo/*.css`, `index.html`, `vite.config.ts`, `playwright.config.ts`, `pipeline/acervo/*.py`, os testes de unidade de TypeScript, os três specs de navegador, `README.md`, o desenho, o plano e o registro de execução. Dos testes de Python li os nomes e os trechos ligados aos achados.
- Rodado: `pnpm test` (248 passam), `cd pipeline && uv run pytest -q` (91 passam, 1 fora por marcador), `pnpm exec tsc --noEmit` (sem erro). Não rodei `pnpm e2e` nem comando de rede.
- Sondas próprias, fora do projeto, em `<pasta temporária da sessão>/sonda/` (`furos3.mjs`, `varredura.mjs`, `rotulo.mjs`): carregam `validarFrase` e `comporFrase` do próprio repositório com o glossário e o índice reais de `public/indice/`.
- Cada achado diz como foi conferido: **executado** (sonda ou teste), **lido** (leitura do código, sem reprodução em navegador) ou **suspeita** (não conferido).

## Pontos fortes (conferidos)

- O cliente envia só `{ itens, idioma }` (`src/ui/pedido.ts:50`) e o servidor recusa qualquer chave a mais (`src/servidor/interpretar.ts:157-158`). O texto dos itens é lido no servidor.
- Texto de terceiros só chega ao modelo dentro do JSON da mensagem do usuário: `sistema` é a soma de duas constantes (`src/frase/prompt.ts:88`). Não há `credito` no pedido ao modelo.
- Nenhum `innerHTML`, `insertAdjacentHTML`, `outerHTML` ou `document.write` em `src/` e `index.html` (grep). Toda a tela passa por `el()` (`src/ui/dom.ts:4-16`), que usa nó de texto e `setAttribute`. O schema exige `credito.url` com `^https://` (`data/acervo.schema.json:56`), então o `href` não aceita `javascript:`. A folha de revisão escapa tudo com `html.escape` (`pipeline/acervo/revisao.py:43-45`).
- Compositor por regra: varri **todos** os trios do índice real, nos três idiomas (117.480 trios por idioma, 352.440 frases). Zero frases reprovadas pelo validador. Tamanho medido: 23 a 34 palavras em pt-BR, 21 a 31 em en, 42 a 53 ideogramas em zh-CN. Trios de um só termo: 165, 120 e 103 (0,14%, 0,10%, 0,09%), igual ao que o registro declara.
- Estado da seleção em funções puras com teste direto dos focos 3, 4 e 5 (`src/ui/selecao.test.ts:52-114`).
- Resposta atrasada é descartada na tela: `mostrarFrase` compara ids e idioma depois do `await` (`src/ui/main.ts:145`).
- Corpo medido em fluxo com corte em 1 KB e teste de corpo sem fim (`src/servidor/interpretar.ts:122-147`, `interpretar.test.ts:164-184`).
- `montar` não grava nada quando há erro, e a aprovação humana fica presa à impressão digital do item (`pipeline/acervo/montar.py:138-139`, `revisao.py:179`).
- O README separa o que foi medido do que ficou NÃO PROVADO.

## Review Focus, um por um

| # | Foco | Veredito | Onde conferi |
|---|---|---|---|
| 1 | Dois sons ao mesmo tempo; som depois da escolha, do resultado ou de recomeçar | **Cumprido** no código. `tocar` pausa o anterior (`audio.ts:25`); `escolherItem`, `recomecar`, "outras três" de sons e troca de idioma chamam `parar` (`main.ts:131,152,59,177`). A terceira escolha passa por `escolherItem`, então o resultado abre em silêncio. `play()` pendente interrompido cai no `catch` sem reacender o estado (`audio.ts:38-43`). Fica de fora: som segue tocando atrás das caixas "ver inteira", créditos e ajuda (Minor M5). Teste: unidade cobre pausa e `parar`; o e2e confere só `aria-pressed`. |
| 2 | Sem rede ou função lenta na terceira escolha: frase por regra em até 8.000 ms | **Cumprido.** Aborto em 8.000 ms e volta para a regra (`pedido.ts:18,44-60,70-71`). Teste com relógio falso (`pedido.test.ts:34-47`). O prazo depende de `buscar` respeitar o sinal de aborto; o `fetch` real respeita. |
| 3 | Toque duplo na terceira escolha: nunca 4 itens, um pedido só | **Cumprido.** `escolher` devolve o mesmo objeto na quarta (`selecao.ts:63`), `escolherItem` sai cedo (`main.ts:130`), `pedirFrase` reaproveita a promessa (`pedido.ts:64-66`), e a caixa modal deixa o fundo inerte. **Mas** o toque duplo na primeira ou na segunda escolha tem defeito: ver I4. |
| 4 | Troca de idioma com seleção em curso | **Cumprido** por leitura e por teste de estado (`selecao.ts:73-77`, `selecao.test.ts:105-114`; rótulo vem de `item.rotulo` com `lang` do item em `bandeja.ts:16`; a frase usa o `idioma` corrente em `main.ts:140`). Não há teste de tela que escolha, troque o idioma e complete (M10). |
| 5 | Janela esgotada | **Cumprido.** `distribuir` recomeça o ciclo sem o escolhido e sem travar, inclusive com menos de 3 itens no acervo (`selecao.ts:33-44`, `selecao.test.ts:78-90`). Na virada do ciclo a mesa nova pode repetir item que estava na mesa anterior (M9). |

## Achados

### Critical

**C1. O validador aceita frase que atribui estado clínico à pessoa, nos três idiomas.**
- Onde: `src/frase/validador.ts:42-46` (listas de permissão), `:48-54` (lista nosológica), `:143-169` (`segundaPessoaSoDoAto`), `:234`.
- Defeito: V6 só olha a palavra imediatamente depois de "você"/"you"/`你` e os vizinhos de "seu/sua/your". Qualquer atribuição feita por sujeito oculto, pronome oblíquo, contração ou terceira pessoa passa, e a lista nosológica é de bloqueio, com muitas formas de fora (deprimida, doente, ansiosa, compulsão, anxious, unwell, mentally ill, manic, paranoid, 有病, 躁狂, 崩溃).
- Conferido: **executado** (`furos3.mjs`, glossário e itens reais, termos `medo`/`raiva` permitidos). Todas estas voltaram `ok: true`, sem nenhum código:
  - pt-BR: "Você escolheu três signos porque está deprimida e doente, e essa soma comunica medo e raiva sem atenuar nada do que nomeia."
  - pt-BR: "Os três signos que você reuniu comunicam o medo que te consome e a raiva que te adoece há muito tempo sem trégua."
  - pt-BR: "O medo crônico e a raiva adoecida que moram em você comunica aquilo que os três signos reunidos nomeiam sem rodeio algum." (`comunica` está em `ATO_PT`, então "em você comunica" passa.)
  - pt-BR: "Você reuniu três signos e vive ansiosa, com crises e compulsão, e essa soma comunica medo e raiva sem atenuar nada."
  - en: "The three signs you gathered communicate fear and anger, and they state plainly that you're anxious, unwell and mentally ill." (`you're` não casa com `/^you$/`.)
  - en: "The three signs you gathered communicate your own fear and your own anger, which the selection states with no softening at all." (`own` está em `NOME_EN`.)
  - en: "…and whoever gathered them is manic, paranoid and addicted to being alone."
  - zh-CN: "你选的三个符号合在一起传达的是恐惧与愤怒，这表明心里已经有病，整个人处在崩溃和躁狂的边缘。"
  - Controle: "…e você sente depressão profunda…" é barrada com V6, como esperado.
- Cenário: chave configurada; o modelo, por desobediência ou empurrado por título ou tag de som, escreve "o medo que te consome" (forma natural em português) ou "porque está deprimida"; a frase passa na primeira tentativa e aparece para a pessoa com a nota "conferida contra as anotações dos itens".
- Alcance: o caminho só existe com `ANTHROPIC_API_KEY`. No modo de demonstração a frase vem do compositor e o defeito não é alcançado. Classifico como Critical porque o validador é a única barreira automática da promessa central do produto e o README (linha 86) apresenta "33 de 33" como evidência dela. **Bloqueia ligar o modelo; não bloqueia a demonstração.**
- Conserto, em linha: tratar como violação toda segunda pessoa fora do sujeito do ato (te, ti, lhe, contigo, você depois de preposição, you're/you've/you'll/yourself, 你 em qualquer posição que não as permitidas), tirar `comunica` de `ATO_PT` e `own` de `NOME_EN`, e trocar a pergunta "há palavra clínica?" por lista de permissão do predicado: depois do verbo de mensagem só podem vir termos permitidos e conectivos. Acrescentar estas frases a `tests/fixtures/frases.json`.

### Important

**I1. O validador aceita conselho e menção de ajuda, nos três idiomas.**
- Onde: `src/frase/validador.ts:57-62`, `:235`.
- Defeito: V7 é lista de bloqueio de formas exatas; infinitivo, sinônimo e composto escapam (`procurar`, `psiquiatra`, `desabafar`, `convém`, `tratamento`, `remédio`, `doctor`, `helpline`, `support`, `it is time to`, `必须`, `医生`, `治疗`, `不要`).
- Conferido: **executado**. Passaram sem código:
  - "Os três signos que você reuniu comunicam medo e raiva, e é hora de procurar um psiquiatra e desabafar com alguém de confiança."
  - "…e convém iniciar tratamento com remédio e telefonar ao centro de valorização da vida."
  - "The three signs you gathered communicate fear and anger, and it is time to see a doctor or ring a helpline tonight." (`\bhelp\b` não casa com `helpline`.)
  - "…and they state that harming yourself is close and getting support matters now."
  - "你选的三个符号合在一起传达的是恐惧与愤怒，这表明必须尽快去看心理医生并接受治疗，不要独自承受。"
- Cenário: o mesmo de C1; a frase aconselha e cita ajuda, o que a restrição global do plano proíbe ("nunca aconselha, nunca menciona ajuda").
- Mesmo alcance de C1: só com chave.

**I2. O link de ajuda fica inalcançável e escondido justamente na tela do resultado, e o destaque some ao fechar.**
- Onde: `src/ui/main.ts:142` (`showModal`), `:146-148` (liga o destaque), `:151-153` (`recomecar` zera o destaque); `src/ui/resultado.ts:45-55` (a caixa da frase não tem link de ajuda); `src/estilo/janela.css:346-348` (fundo a 72% de preto).
- Defeito: o botão de ajuda mora na barra de tarefas, que fica inerte e atrás do fundo escuro enquanto a caixa modal do resultado está aberta; fechar a caixa (Recomeçar ou Esc) executa `ajudaDestacada = false`.
- Cenário: a pessoa escolhe dois itens de tema sensível e um terceiro → a frase aparece → o botão "Precisa falar com alguém?" recebe a classe `destacada` atrás do fundo escuro, sem poder ser tocado → ela fecha a caixa → o destaque já sumiu. O destaque nunca fica visível e clicável ao mesmo tempo. O desenho pede link "fixo em todas as telas" com destaque nesse caso.
- Conferido: **lido**. O plano previa o teste "o link de ajuda existe antes e depois do resultado"; o e2e só confere antes (`e2e/casca.spec.ts:48-52`).
- Conserto: pôr o link de ajuda dentro da caixa do resultado, com o destaque, e manter o destaque na barra até a próxima seleção começar.

**I3. Depois de onze toques nas janelas, elas passam a cobrir a barra de tarefas fixa.**
- Onde: `src/ui/janela.ts:28` e `:48` (`zIndex = ++topo`), `:38` (`topo = 10`); `src/estilo/janela.css:237` (`.tarefas { z-index: 20 }`).
- Defeito: cada `pointerdown` em qualquer ponto de uma janela soma 1 ao z-index, sem teto, e a barra fixa tem z-index 20 no mesmo contexto de empilhamento.
- Cenário: no celular a pessoa toca 11 vezes (tocar sons, "outras três", escolher) → a janela tocada fica com z-index 21 → ao rolar, a janela passa por cima da barra e cobre a contagem, as escolhas, o seletor de idioma e o link de ajuda; toques nessa área vão para a janela. Em tela larga, a terceira janela fica logo acima de "Precisa falar com alguém?" e cobre o botão ao rolar 60 px. O contador não zera em "recomeçar", então a segunda rodada já começa nesse estado.
- Conferido: **lido** (não reproduzido em navegador). Os e2e fazem poucos toques e não pegam.
- Conserto: z-index da barra acima de qualquer janela (por exemplo 1000 com teto no contador), ou renumerar as três janelas em 1 a 3 a cada toque.

**I4. Toque duplo na primeira ou na segunda escolha escolhe um item que a pessoa não viu nem ouviu.**
- Onde: `src/ui/main.ts:127-136`; `src/ui/janela-pinturas.ts:16,26`; `src/ui/janela-sons.ts:15,24`; `src/ui/janela-palavras.ts:6,10`.
- Defeito: a escolha troca as três opções na hora, no mesmo lugar, e o segundo clique do toque duplo cai no item novo da mesma posição, que é aceito como escolha.
- Cenário: toque duplo numa pintura como primeira escolha → entram duas pinturas, a segunda sem ter sido vista. Toque duplo na segunda escolha → a terceira entra sozinha e a frase sai sobre um som que a pessoa nunca ouviu. O foco 3 do plano cobre só a terceira escolha.
- Conferido: **lido**. O e2e "três escolhas na mesma janela" clica três vezes em `.first()` e passa exatamente por esse mecanismo (`e2e/escolha.spec.ts:47-54`).
- Conserto: ignorar escolha na mesma janela por 300 a 400 ms depois de uma redistribuição, ou só aceitar clique cujo `pointerdown` nasceu no próprio elemento depois de desenhado.

**I5. A procedência dos termos confia na lista que o modelo declara, e o validador aceita lista incompleta.**
- Onde: `src/frase/validador.ts:231-232`; `src/servidor/interpretar.ts:112`; `src/ui/resultado.ts:44`.
- Defeito: V5 confere que todo id declarado é permitido e está na frase, mas não que todo termo presente foi declarado; a resposta devolve a lista do modelo e a tela monta "de onde veio cada termo" a partir dela.
- Conferido: **executado**. Frase com "medo e raiva" e `construtos_usados: []` → `ok: true`; com `["raiva"]` → `ok: true`.
- Cenário: o modelo devolve a frase com dois termos e `construtos_usados` vazio → a pessoa vê a frase com vocabulário científico e a lista de procedência vazia, contra o contrato do desenho ("cada termo científico da frase aponta para o item e para a referência").
- Conserto: o servidor devolve os termos que ele mesmo achou na frase (`presentes`), não a lista do modelo.

**I6. Toda falha do provedor é engolida sem registro.**
- Onde: `src/servidor/interpretar.ts:99-104`; `src/servidor/provedores/anthropic.ts:27-49` (a classificação `FalhaDoProvedor.tipo` não é lida por ninguém). Grep por `console.` em `src/servidor` e `src/frase`: nada.
- Defeito: chave errada, modelo inexistente, parâmetro rejeitado (400), limite de uso e recusa caem todos no mesmo `catch { break; }`, sem log, sem contador e sem campo na resposta.
- Cenário: o dono grava a chave; a primeira chamada real devolve 400 (nenhuma chamada à API foi feita até hoje, segundo o README) → todos os pedidos passam a responder `origem: "regra"` para sempre, cada um ainda tentando uma chamada, e ninguém fica sabendo.
- Conferido: **lido**.
- Conserto: `deps.aoFalhar?.(tipo)` ou log de uma linha com o tipo da falha (sem a mensagem do provedor), e teste.

**I7. O endereço da função gasta a chave para qualquer chamador, e o modelo padrão é o mais caro.**
- Onde: `src/servidor/interpretar.ts:178` (só barra origem presente e fora da lista); `interpretar.test.ts:220-230` (fixa que pedido sem origem é aceito); `src/servidor/provedores/anthropic.ts:12,61`.
- Defeito: pedido sem cabeçalho `Origin` (curl) é aceito; as origens do app empacotado (`capacitor://localhost`, `https://localhost`) são as mesmas de qualquer app Capacitor; não há limite por cliente nem cache por trio; cada pedido pode custar duas chamadas de até 4.096 tokens no `claude-opus-5-5`. O comentário de `src/frase/prompt.ts:2-3` fala em "chave de cache" que não existe.
- Cenário: `curl -X POST <função> -H 'content-type: application/json' -d '{"itens":[3 ids públicos],"idioma":"en"}'` em laço → gasto sem teto.
- Conferido: **lido**. O executor declarou o limite por cliente como trabalho da hospedagem (README linha 78 e registro da T12). Mantenho como Important porque é condição para gravar a chave, junto de C1, I1, I5 e I6.

**I8. A folha de revisão reassina aprovação antiga com a impressão digital nova.**
- Onde: `pipeline/acervo/revisao.py:122-126` (pré-marca o rádio a partir de `anteriores` sem comparar impressões) e `:135` (grava `impressao: a.dataset.impressao`, a atual).
- Defeito: uma aprovação cujo item mudou volta a pendente em `montar` (correto), mas a folha gerada em seguida mostra o item já marcado como aprovado e, ao baixar, exporta a aprovação com a impressão do conteúdo novo, que ninguém reviu.
- Cenário: o dono aprova o som X → o pipeline roda de novo e o arquivo de X muda → `montar` avisa e X volta a pendente → `acervo revisao` gera a folha com X em verde → o dono revisa outros itens e baixa `decisoes.json` → X sai aprovado com a impressão nova → `montar --publicavel` publica X sem escuta.
- Conferido: **lido** (o JavaScript é estático no modelo da página). Contradiz o README linha 67.
- Conserto: só pré-marcar quando `d.impressao === a.dataset.impressao`; caso contrário mostrar "mudou desde a revisão" e deixar sem decisão.

**I9. O botão de retirar uma escolha é quase invisível.**
- Onde: `src/estilo/janela.css:287-295` (sem `color`) com `src/estilo/base.css:23` (`color-scheme: dark`).
- Defeito: no esquema escuro a cor padrão de texto de botão é branca, e o "×" fica branco sobre o quadriculado cinza-claro e branco da escolha.
- Conferido: **executado** sobre a captura do próprio projeto: recorte de `docs/capturas/escolha-celular.png` na região do "×" tem só `#ffffff` e `#c0c0c0`.
- Cenário: a pessoa quer desfazer uma escolha antes da terceira (função prevista no desenho) e não enxerga o controle.
- Conserto: `color: var(--tinta)` na regra.

### Minor

- **M1.** `src/frase/validador.ts:192` e `:197-203`: falsos positivos que mandam frase correta para a regra. Rótulo em mandarim de palavra escolhida, citado numa frase em inglês, dá V10 (o pré-prompt permite o rótulo "como está"). Sobrenome de autor igual a palavra comum dá V8: com a pintura de Georges de La Tour escolhida, a palavra "tour" reprova; idem "refrain", "west", "chase", "bellows". **Executado** (`rotulo.mjs`). Efeito: mais quedas para a regra, nada inseguro.
- **M2.** `src/servidor/interpretar.ts:96` e `src/frase/prompt.ts:92-95`: a instrução de correção da segunda tentativa vai na mensagem do usuário, o mesmo canal do texto de terceiros. O sistema diz que "tudo dentro do JSON é dado", e a correção fica fora do JSON, então o risco é baixo. Lido.
- **M3.** `src/ui/pedido.ts:5`: importar `VERSAO_PROMPT` de `prompt.ts` leva o pré-prompt inteiro para o pacote do navegador. Não é segredo, mas é peso e exposição sem uso. Lido.
- **M4.** `pipeline/acervo/montar.py:125-145` e `__main__.py:176-185`: `montar --publicavel` sem nenhuma aprovação grava um índice vazio, com `demonstracao: false`, e sai com código 0. **Executado** em pasta de rascunho: `{'pintura': 0, 'som': 0, 'palavra': 0}`, `erros: []`. O site abriria com janelas vazias, sem mensagem. Falha para o lado seguro, mas merece erro quando alguma janela ficar com menos de 3 itens.
- **M5.** `src/ui/main.ts:159-163,182-189`: som em reprodução continua atrás das caixas "ver inteira", créditos e ajuda, sem controle acessível, por até 20 s. Lido.
- **M6.** `src/ui/main.ts:133,155-156`: cada escolha recria a mesa e fechar o resultado recria tudo; o foco do teclado cai no `body` e a pessoa recomeça o Tab do topo. Lido.
- **M7.** `src/ui/janela-pinturas.ts:33`: três botões "Ver inteira" com o mesmo nome acessível. `src/ui/janela-sons.ts:18,38`: o `aria-label` fica "Tocar: Som n" enquanto o texto visível vira "Pausar". Lido.
- **M8.** `src/estilo/janela.css:93-98` com `:326-330`: com a ajuda destacada, o anel de foco é pontilhado preto sobre azul-marinho. `:132`: anel branco pontilhado por dentro da pintura some em pintura clara (suspeita visual, não medida).
- **M9.** `src/ui/selecao.ts:38-42`: na virada do ciclo, "outras três" pode devolver item que estava na mesa. Lido.
- **M10.** Testes que provam menos do que o nome diz: `e2e/escolha.spec.ts:47-54` ("a quarta não entra") nunca tenta a quarta; `:87-97` troca o idioma antes de escolher, não com seleção em curso (foco 4 sem teste de tela); `e2e/sem-rede.spec.ts:37` clica em tocar sem conferir que tocou (o plano pedia "um som, que precisa tocar"); nenhum teste confere a ajuda depois do resultado; `playwright.config.ts:17-20` só tem Chromium.
- **M11.** `src/frase/compositor.test.ts:10`: o compositor é testado só contra o glossário de teste. A varredura que fiz sobre o índice real (352.440 frases, zero reprovadas) caberia como teste do repositório, para o próximo acréscimo ao glossário não quebrar em silêncio.
- **M12.** Pipeline: `rede.py:31-32` obedece `Retry-After` sem teto (um valor de 86400 dorme um dia); `__main__.py:108-110` quebra com `AttributeError` se o print não estiver em `pipeline/cache/` (pasta fora do git), que é o passo 4 do README num clone novo; `sons.py:129-132` com `__main__.py:155` baixa a URL que a API devolve sem conferir o esquema (`urllib` abre `file://`); `sons.py:89` não barra variante com hífen ("baby-cry").
- **M13.** `pipeline/acervo/revisao.py:185-186`: nudez e violência são coletadas na folha e gravadas no item, e o site não usa esses campos (grep em `src/ui`).
- **M14.** README: linha 56 lista "Sem voz humana nos sons" entre as regras que o pipeline faz valer; o código só barra palavras em título e tags (`sons.py:87-101`) e a escuta está pendente. Linha 16 diz que `pnpm dev` sobe o site "com a função em /api/interpretar"; o site só chama a função com `VITE_API_BASE` preenchido (`main.ts:20`), então em `pnpm dev` puro a função fica sem uso.
- **M15.** `src/ui/janela.ts:52-56`: a janela pode ser arrastada para fora da tela sem volta (o `body` corta o transbordo lateral). `janela.css:60-63`: a barra das caixas de diálogo mostra cursor de arrastar e não arrasta.
- **M16.** `src/ui/pedido.ts` e `main.ts:151-157`: recomeçar durante a espera não aborta o pedido; a chamada ao modelo segue e é cobrada. O servidor também não observa o cliente desistir.
- **M17.** `e2e/escolha.spec.ts:21,39,94` e `e2e/casca.spec.ts:19`: cada rodada de e2e regrava arquivos versionados em `docs/capturas/`.

### Suspeita não conferida

- **S1 (seria Important).** `vite.config.ts:27-31`: os `.mp3` entram no pré-cache do Workbox sem tratamento de pedido com `Range` (não há `RangeRequestsPlugin` nem `createPartialResponse` em `dist/sw.js`, conferido por grep). O Safari pede mídia com `Range` e costuma recusar resposta 200 inteira vinda do service worker. Se valer aqui, no iPhone os sons deixam de tocar na PWA assim que o service worker assume a página, com ou sem rede. Os testes só rodam em Chromium. O README já lista "som em iPhone real" como NÃO PROVADO; esta é a hipótese concreta a testar primeiro. Dentro do app Capacitor não há service worker e a suspeita não se aplica.

## Decisões do executor ("Ruling"), pesadas uma a uma

| Decisão | Sustenta-se? |
|---|---|
| Setup: ramo `v1` sem worktree | Sim. |
| T5→T8: gravar `rostos` e `destaque` no intermediário | Sim; `publico()` tira as chaves de trabalho (`montar.py:53-55`). |
| T12: curl com ids reais adiado para depois da T7 | Sim; cumprido no registro. |
| T10: termo mais longo primeiro em vez de `Intl.Segmenter` | Sim. O erro possível é falso V5 (lado seguro). |
| T10: variantes curadas em vez de radical | **Em parte.** O custo declarado ("forma derivada passa por V5 e depende de V6") vale só se V6 segurar, e C1 mostra que não segura: "lonely", "angry", "ansiosa" passam nos dois. |
| T10: frases gravadas conferidas em tudo menos V5 | Sim. |
| T11: `{lista}` com um termo por item | Sim; a varredura dos 352.440 trios confirma. |
| T11: "ao fundo" em vez de "segundo plano" | Sim. |
| T11: pareamento cego adiado para o acervo real | Sim; feito depois (6 de 6, com modelo como juiz). |
| T12: SDK oficial e `claude-opus-5-5` como padrão | **Não como está.** O plano nomeava `claude-haiku-5-5` e o desenho deixa o provedor como decisão aberta do dono. O custo declarado ("custo por frase maior") ignora dois efeitos: endereço sem limite de pedidos (I7) e prazo de 7 s com raciocínio sempre ligado, nunca medido contra a API. Deve voltar ao dono. |
| T12: `tentativa` no lugar de `temperature` | Sustenta-se como interface. A justificativa "o modelo rejeita temperature (400)" não foi medida: o README diz que nenhuma chamada à API foi feita. |
| T12: 7.000 ms no servidor, 8.000 ms no cliente | Sim. |
| T12: `openrouter.ts` não escrito | Aceitável; fica só a interface. `escolherProvedor` mora em `anthropic.ts`. |
| T12: `fallbacks: "default"` | Não julgo (ver "Declined to judge"). |
| T3: mandarim sem número de afeto | Sim; conservadora, com teste que guarda a evidência. Desvia do desenho (seção 4) e pede ratificação do dono. |
| T3: 12 construtos novos no glossário | Sim, com revisão humana pendente declarada. |
| T3: palavra de polaridade oposta fica fora | Sim. |
| T7: invariante vira "menos de 0,5% dos trios com um só construto" | Sim; medi 0,14%, 0,10% e 0,09%. Consequência a registrar: esses trios recebem frase de um termo, fora da restrição global "de 2 a 4 termos". |
| T7: itens sem construto sustentado saem do acervo | Sim. |
| T7: The Fourth King of Hell fora | Sim; decisão final é do dono. |
| T8: reprovado sai também da demonstração | Sim. |
| T8: aprovação sem nome não vale | Sim. A amarração à impressão digital tem o furo de I8. |
| T4: `para_item_pintura` com construtos vazios | Sim. |
| T6: cache semeado com respostas da pesquisa | Sim; o filtro local confere fonte e licença (`sons.py:94`). |
| T6: ordem de relevância dentro do termo | Sim. |
| T6: termos de voz barrados | Sim; ver M14 sobre o que isso garante. |
| T13-16: quatro tarefas num commit só | **Fraca.** A afirmação "testes vistos falhar antes do código" não tem como ser conferida num commit único (`1a30106`), e a revisão por tarefa se perdeu. Os defeitos I2, I3, I4 e I9 estão todos nesse commit. |
| T13: pilha de fontes do sistema | Sim. |
| T13: bandeja como barra de tarefas com idioma, créditos e ajuda | Sustenta-se como desenho; é a origem de I2 e I3. |
| T15: zoom ao aparecer, corte seco com movimento reduzido | Sim; a escolha fina é do dono. |
| T16: Esc na frase equivale a recomeçar | Sustenta-se, com custo não declarado: Esc por engano apaga frase e seleção, inclusive durante a espera, e zera o destaque da ajuda (I2). |
| T18: `appId` provisório | Sim. |

## Declined to judge

- Conteúdo editorial de `data/*.json`: definições do glossário, listas de palavras, anotações, textos e números das linhas de ajuda (188, 988, 12356). Fora do pedido.
- A superfície da API da Anthropic usada em `anthropic.ts` (`claude-opus-5-5`, `fallbacks`, o beta `server-side-fallback-2026-07-01`, `output_config.effort` e `format`, SDK 1.8): não tenho como conferir sem rede nem documentação, e ninguém fez chamada real.
- `android/`, `ios/` e a afirmação `BUILD SUCCEEDED`: fora do pedido; não rodei `xcodebuild`.
- O número "34 testes de navegador": não rodei `pnpm e2e`, por instrução.
- Conformidade de licença (CC BY-SA sobre glosa dentro do índice, termos do Freesound, premissa de app sem receita).
- Qualidade linguística dos moldes em inglês e mandarim e dos termos em mandarim: revisão nativa pendente, declarada.
- `pontuar_rosto` com a regra provisória: é do dono, por plano.
- `User-Agent` sem contato nas chamadas ao Wiktionary frente à política da Wikimedia.
- Peso do primeiro acesso (12,6 MB no pré-cache) em rede de celular: decisão de desenho.
- Botão de denúncia da frase e a citação com "e" em português nas telas em inglês e mandarim: o executor já adiou os dois.
- Resolução dos DOIs no Crossref: teste com marcador `rede`, não rodado.
- Qualidade visual do desenho das janelas, além dos pontos de contraste e sobreposição acima.
- A sobreposição de 28 px da segunda janela sobre a borda direita da primeira em tela larga (`base.css:84-87`, visível em `docs/capturas/casca-mesa.png`): cobre poucos pixels da terceira pintura; parece intenção de desenho.

## Recomendações

1. Antes de qualquer chave: C1, I1, I5, I6 e I7, nessa ordem, com as frases das sondas como casos de regressão. Devolver ao dono a escolha do modelo padrão.
2. Antes de mostrar a demonstração a alguém: I2, I3, I4 e I9. São quatro mudanças pequenas, todas em `src/ui/main.ts`, `src/ui/janela.ts` e `src/estilo/janela.css`, cada uma com um teste de navegador que hoje falta.
3. Antes da primeira revisão humana do acervo: I8 e M4.
4. Testar S1 num iPhone ou acrescentar um projeto WebKit ao Playwright.
5. Levar a varredura do índice real para dentro da suíte (M11).

## Avaliação

**Pronto para merge? Com consertos.**

O compositor por regra, o contrato do pedido, o escape de texto de terceiros e o estado da seleção estão sólidos e conferidos por execução. Como demonstração sem chave, o ramo tem quatro defeitos de tela que afetam o link de ajuda e a escolha (I2, I3, I4, I9). O caminho do modelo não deve ser ligado enquanto o validador aceitar as frases de C1 e I1.
