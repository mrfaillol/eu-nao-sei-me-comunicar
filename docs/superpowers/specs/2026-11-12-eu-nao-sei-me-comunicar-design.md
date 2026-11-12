# Eu Não Sei Me Comunicar — desenho

Data: 12/Nov/2026. Dono: Victor. Estado: decisões de 1 a 3 confirmadas por ele nesta data; o resto é proposta.

## 1. O que é

Uma obra interativa em fundo preto. A pessoa não consegue pôr um estado interno em frase, mas consegue apontar para uma pintura, um som ou uma palavra solta. Ela faz três escolhas e recebe uma frase, em segunda pessoa e com vocabulário científico, que descreve o que a seleção comunica.

Nome por idioma:

| Idioma | Título |
|---|---|
| pt-BR | Eu Não Sei Me Comunicar |
| en | I Don't Know How to Communicate |
| zh-CN | 我不会表达自己 (a revisar por falante nativo) |

## 2. Decisões confirmadas pelo dono

1. **Mecânica:** três escolhas livres, em qualquer janela. Três pinturas, ou uma de cada, ou dois sons e uma palavra. A frase sai na terceira escolha.
2. **Plataformas:** site instalável (PWA) e Capacitor para iOS e Android. Um código só.
3. **LLM:** provedor trocável. Sem chave configurada, o app funciona em modo de demonstração.

## 3. A tela

- Fundo `#000`. Título grande. Três janelas em estilo Windows clássico (barra de título, botões decorativos, borda em relevo), arrastáveis em tela larga e empilhadas em tela estreita.
- O texto do botão de cada janela é do dono e fica literal em pt-BR:
  - Pinturas: "Prefiro Me Explicar Escolhendo Imagens Que Me Despertam…"
  - Sons: "Prefiro Me Comunicar Ouvindo Sons Que Representem O Que Sinto"
  - Palavras: "Prefiro Escolher Palavras Soltas"
- Cada janela mostra **três opções por vez**. Escolher uma opção a leva para a bandeja de seleção e a janela distribui três novas, sem repetir item já escolhido. Um controle "outras três" redistribui sem escolher.
- A bandeja mostra as escolhas feitas (de 0 a 3). Uma escolha pode ser retirada antes da terceira.
- **Pintura com rosto:** a miniatura faz um zoom lento até o rosto de maior destaque. Sem rosto, a miniatura fica parada. Um gesto secundário mostra a pintura inteira com título, autor e crédito.
- **Som:** a opção toca ao toque (nunca sozinha). O título aparece depois da escolha, para a pessoa escolher pelo ouvido.
- **Palavra:** três palavras em corpo grande.
- **Resultado:** a frase, e abaixo dela "de onde veio cada termo": cada termo científico da frase aponta para o item e para a referência que o sustenta. Depois, os créditos das obras e dos sons, e "recomeçar".
- Rodapé com seletor de idioma e um link discreto de ajuda.
- Movimento só com `transform` e `opacity`, com `prefers-reduced-motion` respeitado desde a primeira animação.

## 4. O acervo (índice curado)

O acervo é montado antes, por um pipeline em Python, e entra no app como arquivo estático.

| Tipo | Fonte | Texto humano de origem | Licença aceita |
|---|---|---|---|
| Pintura | Cleveland Museum of Art, API aberta | `description` da curadoria (200 caracteres ou mais) | CC0 |
| Som | Openverse, só sons vindos do Freesound, com até 20 s | título e tags do autor | só CC0 |
| Palavra | três listas autorais, uma por idioma | glosa do Wikcionário, copiada sem alteração e com crédito | CC BY-SA 4.0 |

Regras:
- Nenhum item entra sem texto escrito por gente. Visão de máquina não descreve pintura.
- Conteúdo seguro: som marcado como `mature` fica fora; pintura passa por filtro de termos e por revisão.
- As três listas de palavras não são tradução uma da outra. Cada idioma tem as suas palavras de estado mental muito específico.
- Palavra sem glosa humana disponível sai da lista.
- Mídia fica hospedada junto do app (cópia local), para o app funcionar sem depender do servidor de terceiros.
- **Índice de demonstração:** 30 pinturas, 30 sons e 30 palavras por idioma, todos com `revisao.humana = "pendente"`. A tela de créditos avisa que o acervo é de demonstração.
- **Índice publicável:** só itens aprovados pelo dono na folha de revisão (pintura vista, som ouvido, palavra lida). Agente não ouve som nem assina como falante nativo.
- Premissa registrada: o app não tem receita. Os termos do Freesound e as normas brasileiras em CC BY-NC dependem disso.

### Anotação científica

Cada item carrega, além do texto humano:
- **classe semiótica** (Peirce): ícone para pintura, índice para som ambiente, símbolo para palavra;
- **construtos** tirados de um glossário fechado, em que cada construto tem termo nos três idiomas, definição e referência;
- **valência e ativação**, só por norma direta e só para palavra: Glasgow Norms (inglês, CC BY 4.0) e as 264 linhas de questionário próprio de Zheng et al. 2023 (mandarim, CC0). Pintura, som e palavra em pt-BR ficam com `afeto.metodo = "ausente"`. Motivo medido: afeto derivado da descrição comprime as 2.177 pinturas entre −0,23 e +0,49 de valência.
- **tema sensível** (sim ou não), marcado na anotação.

O glossário não aceita termo que também nomeia sintoma ou transtorno. Cada construto só entra se o DOI da referência resolver no Crossref com o título esperado.

A anotação é feita antes, com apoio de modelo, restrita ao glossário, validada por script e marcada como "revisão humana pendente" até o dono revisar.

### Zoom no rosto

Script em Python com o detector YuNet (OpenCV). Para cada pintura grava a caixa do rosto de maior destaque em coordenadas normalizadas de 0 a 1. Quando há mais de um rosto, uma função de pontuação escolhe o destaque. A função de pontuação é escrita pelo dono.

## 5. A frase

Semente do pré-prompt, texto do dono, literal:

> "Com base na dialética do materialismo histórico-dialético e nos estudos comportamentais e da comunicação social, explique a soma [dos elementos selecionados] em uma resposta que deve ser uma frase em segunda pessoa, descritiva em face ao que o usuário não está falando, mas consegue apenas definir ao escolher imagens, formas, sons, barulhos, palavras de um vocabulário."

Contrato:
- **Entrada:** os identificadores dos três itens e o idioma. O texto dos itens é lido no servidor a partir do índice; o cliente nunca envia texto livre.
- **Saída:** uma única frase, em segunda pessoa, com até 45 palavras, que afirma o que a seleção comunica, mais a lista de procedência dos termos.
- **Proibido:** atribuir transtorno, sintoma ou diagnóstico à pessoa; dar conselho; usar termo científico que não esteja nas anotações dos três itens.
- **Validação no servidor:** resposta do modelo que quebre o contrato é descartada; uma segunda tentativa; se falhar de novo, vale a frase composta por regra.
- **Modo de demonstração:** sem chave, a frase é composta por regra a partir dos construtos dos três itens, nos três idiomas. É o mesmo compositor usado como rede de segurança, e ele roda dentro do site: sem chave e sem rede o app continua inteiro.
- **Prazo:** se a função não responder em 8 s, vale a frase composta por regra.
- **Ajuda:** o link de ajuda é fixo em todas as telas e ganha destaque quando 2 ou mais dos 3 itens têm tema sensível. O modelo nunca escreve sobre ajuda.

Fundamentação da orientação pedida pelo dono: psicologia histórico-cultural (o signo como mediador entre o social e a consciência) e semiótica social. As referências exatas estão no dossiê.

## 6. Arquitetura

```
pipeline/       Python 3.12 (uv): busca, filtro, rosto, anotação, montagem do índice
data/           glossário de construtos, listas de palavras, fontes, ajuda (fonte de verdade editável)
src/frase/      TypeScript, roda no navegador e no servidor: termos permitidos, compositor, validador
src/servidor/   função "interpretar": provedores de LLM, duas tentativas, volta para o compositor
src/ui/         Vite + TypeScript sem framework: tela, seleção, áudio, zoom, idiomas
public/indice/  o índice montado; public/midia/ as cópias locais
android/, ios/  projetos do Capacitor
docs/           pesquisa, desenho, plano
```

O contrato entre as partes é o esquema do índice (`data/acervo.schema.json`). O pipeline escreve, o site e a função leem. O compositor e o validador existem uma vez só, em TypeScript.

Ferramentas nesta máquina (medido): Node 22, uv com Python 3.12, ffmpeg, Xcode 27.1 instalado e não ativo, JDK 21 do Homebrew. Falta o SDK do Android.

## 7. Fora do escopo

- Conta de usuário, histórico, analytics com dado pessoal.
- Imagem ou som gerado por IA.
- Três apps nativos separados.
- Publicação em loja e deploy em produção: dependem de GO explícito do dono, de Xcode e de Android Studio.

## 8. Decisões abertas, do dono

- Qual provedor de LLM vai para produção.
- Onde o site e a função ficam hospedados.
- Chave gratuita do Freesound, para sons com descrição em texto corrido.
- Revisão das três listas de palavras e das anotações.

## 9. Fatos de base

`docs/pesquisa/dossie.md`: acervos, licenças, referências, regras de loja, pré-prompt e zoom, cada afirmação com procedência e veredito de conferência.

## Adendo de 12/Nov/2026: mudanças pedidas pelo dono depois da primeira publicação

Estas decisões substituem o que o texto acima diz sobre "três escolhas" e "frase na terceira":

1. **Mínimo de três, sem máximo.** A pessoa escolhe quantos itens quiser. A frase não abre sozinha: um botão na barra de tarefas a pede, a partir da terceira escolha. Fechar a frase conserva a seleção.
2. **A frase para N itens.** Conta os itens por extenso (o validador não aceita dígito), nomeia o construto mais repetido e até três ao fundo, no máximo quatro termos. Com três itens a frase é idêntica à de antes. Os construtos que a frase não nomeia aparecem na caixa do resultado.
3. **(i) em cada item.** Palavras do texto humano do item (curadoria ou tags) e, nas palavras, a definição do dicionário. Nada é gerado: só extraído.
4. **Assinatura do autor** no canto direito da barra, com link para o site dele e o caractere ☭.
5. **Acervo sem teto para imagens e sons**, com adaptação para o sistema de frases atual: pedido registrado, a fazer no pipeline (anotação automática que cita o trecho do texto humano).

