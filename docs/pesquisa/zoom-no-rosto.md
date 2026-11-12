# Zoom no rosto de maior destaque — pesquisa de 12/Nov/2026
Amostra: 80 pinturas CC0 do Cleveland Museum of Art no arquivo `web` (lado maior de 893 a 1.263 px): 40 com "Portrait" no título, 40 sem. Detector: YuNet (`face_detection_yunet_2023mar.onnx`) no OpenCV 5.0.0, limiar 0,6. Desenhei as caixas e olhei as 80 imagens uma a uma, em cópias de 640 px com recorte ampliado de cada caixa. O juiz foi um só (este agente); "uma pessoa aponta" é a minha leitura, a conferir pelo dono na folha de casos.
Procedência: **medido** (comando rodado hoje), **lido** (URL e trecho) ou **memória** (sem prova). Anexos duráveis em `docs/pesquisa/zoom-no-rosto-anexos/`: `sinais-por-rosto.tsv` (88 caixas com sinais e rótulos), `casos-2-ou-mais-rostos.jpg` (os 14 casos da seção b), scripts e o trecho testado (`zoom.css`, `zoom.js`, `ciclo.html`). As 80 cópias anotadas ficaram em pasta temporária, que some em reinício: `<pasta temporária da sessão>/wf/zoom-no-rosto/`.

## (a) Falsos positivos e falsos negativos — medido
| Grupo | Imagens | Caixas | Rosto certo | Rosto de ornamento | Falso positivo | Imagens com rosto principal perdido |
|---|---|---|---|---|---|---|
| Retratos | 40 | 61 | 55 | 2 | 4 | 0 |
| Outras | 40 | 27 | 26 | 0 | 1 | 4 (mais 1 mandala) |

- Retratos: a maior caixa é a pessoa retratada em 40 de 40, e nenhum rosto humano legível ficou sem caixa (uma máscara entalhada em 153603 ficou). Falsos positivos: um violino (confiança 0,81), uma mão sobre o instrumento (0,67) e duas manchas na estampa de um sofá (0,61 e 0,67). Ornamento: dois rostos entalhados numa cadeira (0,75 e 0,87).
- Outras, 12 imagens com caixa: em 6 a maior caixa é o rosto que uma pessoa apontaria (145923, 94979, 152184, 152411, 163140, 314455); 1 é cena narrativa ambígua (137932); em 5 a maior caixa é ruim (126722, 130392, 143813, 157147, 167661).
- Outras, 28 imagens sem caixa: 24 não têm rosto legível (10 delas são páginas só de texto); 2 têm o rosto principal perdido (156155, demônio de boca aberta; 166508, mulher deitada com o rosto girado perto de 90°); 2 têm só rostos de cerca de 10 px (117660, 133075).
- Principal perdido com outras caixas presentes: Buda central em 126722 e 167661, divindade central em 157147. Secundários perdidos: José em 130392, quatro ou mais figuras em 163140, a consorte em 314455. 15 das 27 caixas de "outras" têm menos de 3% da largura da imagem, e todas estão nas imagens ruins.

A resolução em que o detector roda muda o resultado:

| Lado maior na detecção | Retratos com o principal | Outras com caixa | Caixas | Falsos positivos |
|---|---|---|---|---|
| 640 px | 40/40 (confiança mínima 0,89) | 7 | 63 | 2: o violino (0,82) e um enfeite de cabelo novo (0,63) |
| web, cerca de 900 px | 40/40 (mínima 0,87) | 12 | 88 | 5 |
| 1.800 px (web ampliada) | 40/40 (mínima 0,69) | 14 | 156 | não inspecionadas |

- Arquivo `print` (3.400 px), 3 imagens baixadas: no tamanho cheio o detector achou 1 de 3 rostos (os de 991 px e 1.561 px de largura passaram sem caixa, em 238 a 640 ms por imagem); reduzido para 640 px achou 3 de 3 em 7 a 17 ms. Lido no README do modelo: "This model can detect faces of pixels between around 10x10 to 300x300 due to the training scheme" (`github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet`).
- A 640 px o detector acha o demônio de 156155 (0,72), mas perde o rei de 163140 (4,4% da largura) e o marajá de 314455 (6,7%).
- Passada extra a 640 px com a imagem girada 90° para cada lado: recupera a mulher deitada de 166508 (0,89) e cria 13 caixas falsas ou frouxas (0,60 a 0,73).

## (b) Dois ou mais rostos: sinais, casos e dilemas — medido
Sinais por rosto (todos no TSV): **área** = área da caixa ÷ área da imagem; **centro** = distância do centro da caixa ao centro do quadro ÷ meia diagonal (0 no centro, 1 no canto); **confiança** do YuNet; **nitidez nativa** = variância do Laplaciano no recorte em cinza; **nitidez 96** = a mesma conta com o recorte reamostrado para 96×96; **contraste RMS** = desvio padrão da luminância na caixa ÷ 255; **figura-fundo** = média da caixa menos média do anel em volta, ÷ 255; **frontal** (extra, dos 5 pontos do YuNet) = desvio do nariz em relação ao meio dos olhos ÷ distância entre os olhos (0 = de frente). Na tabela, cada célula traz o número da caixa que o sinal, sozinho, escolheria; a numeração é por área, da maior para a menor; `*` marca falso positivo e `°` marca ornamento.

| Imagem | Caixas | Uma pessoa aponta | Área | Centro | Conf. | Nitidez nativa | Nitidez 96 | RMS | Figura-fundo | Frontal |
|---|---|---|---|---|---|---|---|---|---|---|
| 122346 irmãs Carteret-Hardy | 2 | empate | 1 | 2 | 1 | 1 | 1 | 2 | 2 | 1 |
| 122349 irmãs Yorke | 2 | 2 (provável) | 1 | 2 | 1 | 1 | 1 | 1 | 2 | 2 |
| 128391 família tocando música | 8 | 1 | 1 | 4* | 1 | 8 | 1 | 5* | 3 | 7 |
| 150083 Seaside | 3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2* |
| 153603 Machtelt Suijs | 3 | 1 | 1 | 1 | 1 | 3° | 1 | 1 | 1 | 1 |
| 170082 autorretrato com cinco musas | 6 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 3 |
| 170835 Nur Jahan com retrato de Jahangir | 2 | 1 (provável) | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 2 |
| 96262 retratos pendentes do casal David | 2 | empate | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 |
| 97155 retrato de um casal | 2 | empate | 1 | 2 | 2 | 1 | 1 | 2 | 2 | 2 |
| 126722 Buda | 10 | principal sem caixa | 1 | 4 | 7 | 8 | 8 | 6 | 3 | 3 |
| 130392 retorno da Sagrada Família | 3 | 3, a Virgem (provável) | 1 | 3 | 2 | 3 | 1 | 3 | 2 | 3 |
| 137932 Tuti-nama | 3 | 1 (provável) | 1 | 1 | 2 | 1 | 1 | 1 | 2 | 1 |
| 157147 mandala | 2 | principal sem caixa | 1 | 2* | 1 | 2* | 1 | 2* | 2* | 2* |
| 167661 tríade de Shakyamuni | 2 | principal sem caixa | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

Nos 8 casos em que há um rosto a apontar (4 claros, 4 prováveis), cada sinal sozinho acerta: centro 7, área 6, nitidez 96 6, RMS 6, confiança 5, figura-fundo 5, frontal 4, nitidez nativa 3. Com 8 casos isso não ordena os sinais; serve para ver onde cada um falha. Dilemas que a fórmula precisa responder:
1. **Retrato duplo e pendentes** (122346, 96262, 97155): áreas quase iguais (1,51% e 1,50%; 1,95% e 1,73%). Não existe "o" rosto. Saídas: escolher um, alternar a cada visita, enquadrar os dois com zoom menor, ou tratar 96262 como duas pinturas.
2. **Área contra olhar e centro** (122349): a irmã mais velha tem a maior caixa (0,59% contra 0,49%); a menor está no centro (0,10 contra 0,41) e olha de frente (0,01 contra 0,18).
3. **Retrato dentro do quadro** (170835): Jahangir aparece numa pintura que Nur Jahan segura; o título cita os dois.
4. **Cena narrativa** (130392, 137932): a maior caixa de 130392 é um anjo secundário com caixa frouxa (9,2% da largura, frontal 0,98); a Virgem tem 3,1%.
5. **Principal sem caixa** (126722, 157147, 167661, e 156155 e 166508 sem caixa nenhuma): nenhuma fórmula conserta. Um piso de 3% da largura tira as 4 imagens ruins de rosto minúsculo (maiores caixas de 1,1% a 2,4%) e mantém as 6 boas (a menor tem 4,4%); sobra 130392.
6. **Confiança não separa falso de verdadeiro**: violino 0,81; rostos certos pequenos de 0,60 a 0,80; principais de retrato a partir de 0,87; principais bons fora dos retratos 0,68 (145923, rosto de 412 px, acima do limite do modelo), 0,75 e 0,81.
7. **Nitidez**: no recorte nativo premia rosto minúsculo (as musas de 170082 marcam até 2.409 contra 249 do autorretrato); reamostrada para 96×96 escolhe o mesmo que a área em 13 de 14.
8. **Rosto não humano ou de ornamento** (demônio, divindades, entalhes): entra ou não entra.

## (c) Formato da caixa no índice e resolução mínima
```json
{ "id": "cma:121946", "largura": 2709, "altura": 3400,
  "rostos": [ { "x": 0.4389, "y": 0.1838, "w": 0.1272, "h": 0.1477, "conf": 0.92,
                "sinais": { "area": 0.0188, "centro": 0.34, "nitidez_96": 156, "rms": 0.159, "figura_fundo": 0.2, "frontal": 0.3 } } ],
  "destaque": 0, "destaque_manual": null, "zoom": { "s": 3.931, "tx": -1.4752, "ty": -0.5128 }, "nitido": "rostos/cma-121946.jpg",
  "detector": { "modelo": "face_detection_yunet_2023mar.onnx", "lado_trabalho": 640, "limiar": 0.6 } }
```
- `x`, `y` = canto superior esquerdo; `w`, `h` = tamanho. Tudo em fração da largura e da altura da imagem, de 0 a 1, com 4 casas (0,0001 × 3.400 px = 0,34 px). Cortar a caixa em [0, 1] antes de gravar; nenhuma das 88 encostou na borda (medido).
- `destaque` = índice em `rostos` escolhido pela função do dono; `null` = sem zoom. `destaque_manual` sobrepõe. `zoom` e `nitido` são derivados e podem ser recalculados.
- Conta: largura do rosto na tela = 0,5 × 420 px CSS × densidade 2 = **420 px físicos**. Logo **largura mínima da origem = 420 ÷ w**. Para densidade 3, 630 ÷ w.

| Medido nos 40 retratos (rosto principal) | Mínimo | 1º quartil | Mediana | 3º quartil | Máximo |
|---|---|---|---|---|---|
| Largura do rosto `w` | 0,035 | 0,102 | 0,137 | 0,192 | 0,469 |
| Largura mínima da origem (px) | 896 | 2.203 | 3.075 | 4.135 | 12.115 |
| Escala do zoom, 0,5 ÷ w | 1,1 | — | 3,7 | 4,9 | 14,4 |

- Quem atinge 420 px de rosto: arquivo `web` 0 de 40; `print` (largura de 1.605 a 3.400 px) 16 de 40; `print` aceitando ampliar até 1,5× 27 de 40, e até 2× 36 de 40; TIFF cheio 33 de 40. Em densidade 3, `print` 5 de 40. Sem ampliar, o `print` entrega rosto com mediana de 0,45 da janela.
- Peso (medido em 3 imagens): recorte quadrado de 840 px em JPEG 80 pesa de 62 a 195 KB, e o recorte de 840 × 1.053 na proporção da pintura (121946) pesa 77 KB; o `print` inteiro pesa de 2,0 a 9,5 MB (mediana de 4,3 MB nos 40 retratos); o `web`, mediana de 275 KB.

## (d) Animação no navegador
A moldura assume a proporção da pintura (`--prop: largura / altura`, do índice). Com `transform-origin: 0 0`, um ponto (u, v) da pintura, em fração, aparece em (s·u + tx, s·v + ty) da moldura. Daí: largura do rosto s·w = 0,5 → **s = 0,5 ÷ w**; centro do rosto no meio → **tx = 0,5 − s·(x + w/2)**, **ty = 0,5 − s·(y + h/2)**; a pintura cobre a moldura quando **1 − s ≤ tx ≤ 0** (idem ty). `translate` em porcentagem é relativo à própria caixa do elemento, então `tx·100%` vale em qualquer largura de janela, sem medir pixel nem recalcular no redimensionamento. Exemplo (121946): s = 3,931, tx = −147,52%, ty = −51,28%. A região que fica visível é x₀ = −tx/s, y₀ = −ty/s, com 1/s da largura e da altura: é esse retângulo que o pipeline recorta do `print` para a camada nítida. Moldura com outra proporção (miniatura quadrada): s = 0,5·Cw ÷ (w·Iw), tx = Cw/2 − ox − s·cx·Iw, ty = Ch/2 − oy − s·cy·Ih, em px, com (ox, oy) o deslocamento da imagem dentro da moldura.
Estrutura: `<div class="moldura" style="--prop: 712 / 893"><div class="pintura"><img src="base.jpg"></div><img class="nitido" src="rosto.jpg"></div>`. Só `transform` (na pintura) e `opacity` (na camada nítida) são animados.
```css
.moldura { position: relative; overflow: hidden; background: #000; width: min(420px, 100%); aspect-ratio: var(--prop); }
.pintura { position: absolute; inset: 0; transform-origin: 0 0;
  transform: translate(var(--tx, 0%), var(--ty, 0%)) scale(var(--s, 1));
  transition: transform var(--dur, 1400ms) cubic-bezier(.22, 1, .36, 1); }
.pintura > img { display: block; width: 100%; height: 100%; }
.nitido { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; }
.nitido.pronto { opacity: 1; transition: opacity 300ms ease-out; }
@media (prefers-reduced-motion: reduce) { .pintura { transition: none; } }
```
```js
function alvo(c, k = 0.5, kAlt = 0.8, sMax = 8) {    // c = caixa normalizada {x, y, w, h}
  const s = Math.max(1, Math.min(k / c.w, kAlt / c.h, sMax));
  const lim = v => Math.min(0, Math.max(1 - s, v));   // a pintura sempre cobre a moldura
  return { s, tx: lim(0.5 - s * (c.x + c.w / 2)), ty: lim(0.5 - s * (c.y + c.h / 2)) };
}
function aproximar(moldura, caixa) {
  const p = moldura.querySelector('.pintura'), n = moldura.querySelector('.nitido'), { s, tx, ty } = alvo(caixa);
  const vez = moldura.vez = (moldura.vez || 0) + 1;   // invalida temporizador e evento de chamadas antigas
  p.style.setProperty('--s', s); p.style.setProperty('--tx', tx * 100 + '%'); p.style.setProperty('--ty', ty * 100 + '%');
  if (!n) return;
  const pronto = () => { if (moldura.vez === vez) n.classList.add('pronto'); };
  const ms = parseFloat(getComputedStyle(p).transitionDuration) * 1000;
  if (ms === 0) return pronto();
  p.addEventListener('transitionend', pronto, { once: true });
  setTimeout(pronto, ms + 400);                        // o evento pode não chegar; o temporizador garante
}
function afastar(moldura) {
  const p = moldura.querySelector('.pintura');
  moldura.vez = (moldura.vez || 0) + 1;
  moldura.querySelector('.nitido')?.classList.remove('pronto');
  ['--s', '--tx', '--ty'].forEach(v => p.style.removeProperty(v));
}
```
Medido no Chrome 157 sem interface, densidade 2, moldura de 420 px:
- 5 casos sem limite: rosto com 0,500 da largura da moldura e desvio 0,000 do centro. 145925 (rosto de 47% da largura): s = 1,067 e a pintura continua cobrindo a moldura. 96262 (formato paisagem): o teto de altura `kAlt` segura o rosto em 0,373 da largura. 145923 (rosto de 58%): s = 1, sem movimento.
- A transição anima: rosto em 0,127 → 0,326 (200 ms) → 0,431 (400 ms) → 0,492 (800 ms) → 0,500 (1.200 ms). `transitionend` chegou entre 1.400 e 1.417 ms em 3 execuções; na primeira execução a frio não chegou antes de 1.800 ms. Por isso o temporizador de reserva.
- Ciclo aproximar → afastar no meio → aproximar de novo: a camada nítida fica oculta durante o movimento, não é revelada pelo temporizador antigo e some no instante do `afastar`. Com `prefers-reduced-motion: reduce`: duração computada de 0 s, o quadro troca num salto, e a camada nítida entra só por opacidade.
- Camada nítida sobre a base ampliada: deslocamento de −0,08 px e −0,09 px por correlação de fase; variância do Laplaciano de 2,5 (base `web` ampliada 3,9×) para 17,5 (recorte do `print`). Com `--virtual-time-budget` do Chrome a transição não avança (a geometria ficou no estado inicial): teste automático tem de rodar em tempo real.

Duração: 1.400 ms com saída suave foi o valor testado. Lido na WCAG 2.2.2 (`w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html`): movimento que "(1) starts automatically, (2) lasts more than five seconds, and (3) is presented in parallel with other content" exige mecanismo de pausa. Zoom disparado pela escolha da pessoa e menor que 5 s fica fora dessa exigência. Lido na WCAG 2.3.3: "Motion animation triggered by interaction can be disabled". Lido em `web.dev/articles/animations-guide`: "restrict animations to opacity and transform to keep animations on the compositing stage".

## (e) Licenças e aviso do OpenCV 5
- YuNet — lido no README do modelo: "All files in this directory are licensed under MIT License"; o `LICENSE` traz "Copyright (c) 2020 Shiqi Yu". Medido: o arquivo local é o oficial `face_detection_yunet_2023mar.onnx` (sha256 `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` e 232.589 bytes, iguais aos do ponteiro LFS do repositório).
- OpenCV — lido: `LICENSE` do ramo 5.x é Apache 2.0; o pacote instalado declara `License: Apache 2.0`; no README do opencv-python: "All wheels ship with FFmpeg licensed under the LGPLv2.1".
- O `.onnx` pode ficar no repositório: a MIT permite redistribuir com o aviso de copyright, e 227 KB dispensam Git LFS. Guardar ao lado o `LICENSE`, a URL de origem e o sha256. O OpenCV roda só no pipeline e não vai para o app. NÃO PROVEI: os termos do conjunto WIDER FACE, usado no treino (não li).
- Aviso: `[ WARN:0@…] global net_impl_backend.cpp:345 setPreferableTarget Targets are not supported by the new graph engine for now`, uma linha a cada `FaceDetectorYN.create`. Medido: `cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)` antes do `create` zera a saída; `OPENCV_LOG_LEVEL=ERROR` no ambiente também; `cv2.setLogLevel` não existe na 5.0.0. Criar o detector uma vez e chamar `setInputSize` por imagem reduz a 1 linha no total.

## (f) Pintura sem rosto — medido
Testei uma região de interesse automática: saliência por resíduo espectral e a janela de 40% × 40% com maior soma, nas 28 imagens sem caixa. 10 são páginas de texto, sem assunto a enquadrar. Nas outras 18: 9 acertos, 4 parciais (assunto cortado pela janela) e 5 erros (canto preto de uma tela oval, o poleiro em vez do falcão, o manto em vez da cabeça do demônio, texto em vez da miniatura, um rolo de 900 × 42 px). A concentração de saliência não separa acerto de erro: acertos de 0,22 a 0,37, erros de 0,20 a 0,31.
Com 9 acertos em 18, **zoom dirigido sem rosto não se sustenta**. As opções que restam são nenhum movimento ou uma aproximação centrada e leve (escala de 1 a 1,06, que corta 3% de cada borda e não depende de região). 8 das 40 "outras" têm proporção de 4:1 ou mais (folhas de manuscrito e rolos) e 10 são só texto; isso é assunto da curadoria do acervo.

## Recomendações para o plano
1. Detectar em cópia reduzida a 640 px no lado maior e repetir a cerca de 900 px para rostos pequenos, unindo por sobreposição. Nunca detectar no `print` cheio. Criar o detector uma vez, com log em `ERROR`.
2. Gravar no índice todas as caixas com os sinais e os dados do detector, no formato da seção (c).
3. Deixar a função `pontuar_rosto(sinais)` vazia para o dono, com o TSV como caso de teste (8 casos com resposta, 3 empates, 3 sem resposta possível).
4. Incluir revisão humana: o pipeline gera uma folha de contato e aceita `destaque_manual`. Fora dos retratos a maior caixa só serve em 6 de 12.
5. Cortar a camada nítida do `print` pela mesma função `alvo` (porta em Python no anexo `recorte.py`) e hospedar junto do app.
6. Usar o trecho de CSS e JS acima; teste de navegador em tempo real, com e sem movimento reduzido.
7. Sem rosto aprovado, sem zoom dirigido. Passada com rotação só se aceitar caixa com confiança alta (na amostra, 0,89 contra no máximo 0,73 das falsas).
8. Versionar o `.onnx` com `LICENSE`, URL e sha256; `opencv-python-headless` só como dependência do pipeline.

## Decisões que só o dono toma
1. A fórmula de pontuação e as respostas aos 8 dilemas da seção (b).
2. O piso de tamanho do rosto para haver zoom (3% separa a amostra) e o teto de ampliação da imagem (1×, 1,5× ou 2×).
3. Duração e caráter do zoom (1.400 ms testado; abaixo de 5 s não exige botão de pausa).
4. Pintura sem rosto: parada ou aproximação centrada leve.
5. Com movimento reduzido: salto direto para o rosto, como está, ou não aproximar.
6. Quem aprova a folha de contato das caixas, e se rosto não humano conta.
