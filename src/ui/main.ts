import "../estilo/base.css";
import "../estilo/janela.css";
import { indexarGlossario } from "../frase/glossario";
import { IDIOMAS, type Acervo, type Construto, type Glossario, type Idioma, type Item } from "../frase/tipos";
import { criarAcervoVivo } from "./acervo-vivo";
import { desenharAjuda, type Ajuda } from "./ajuda";
import { criarTocador } from "./audio";
import { criarAutoria } from "./autoria";
import { desenharBandeja } from "./bandeja";
import { desenharCreditos, desenharPinturaInteira } from "./creditos";
import { el } from "./dom";
import { idiomaInicial, t } from "./i18n";
import { criarInfo } from "./info";
import { criarDialogo, criarJanela, definirTitulo } from "./janela";
import { desenharPalavras } from "./janela-palavras";
import { desenharPinturas } from "./janela-pinturas";
import { desenharSons, marcarSomTocando } from "./janela-sons";
import { pedirFrase } from "./pedido";
import { desenharEspera, desenharResultado } from "./resultado";
import { criarEstado, escolher, podeEscolher, pronta, redistribuir, retirar, trocarIdioma, type EstadoSelecao, type Janela } from "./selecao";

const BASE = import.meta.env.BASE_URL;
const API = (import.meta.env.VITE_API_BASE as string | undefined) || null;
const NOMES_DE_IDIOMA: Record<Idioma, string> = { "pt-BR": "Português", en: "English", "zh-CN": "中文" };
// A mídia do acervo conferido mora no site; a do ampliado, nos servidores de origem, com endereço completo.
const midia = (caminho: string) => (/^https:\/\//.test(caminho) ? caminho : `${BASE}${caminho}`);

async function carregar<T>(arquivo: string): Promise<T> {
  const resposta = await fetch(`${BASE}indice/${arquivo}`);
  if (!resposta.ok) throw new Error(`${arquivo}: ${resposta.status}`);
  return (await resposta.json()) as T;
}

function idiomaGuardado(): Idioma | null {
  try {
    const guardado = localStorage.getItem("idioma");
    return IDIOMAS.includes(guardado as Idioma) ? (guardado as Idioma) : null;
  } catch {
    return null; // modo privado ou armazenamento bloqueado
  }
}

function iniciar(raiz: HTMLElement, acervo: Acervo, glossario: Glossario, ajuda: Ajuda): void {
  let idioma: Idioma = idiomaGuardado() ?? idiomaInicial(navigator.languages ?? [navigator.language]);
  const vivo = criarAcervoVivo(acervo.itens, () => navigator.onLine);
  let estado: EstadoSelecao = criarEstado(vivo.disponiveis(), idioma, Math.random);
  let ajudaDestacada = false;
  const ultimaTroca: Partial<Record<Janela, number>> = {};
  const porId = { get: (id: string) => vivo.item(id) };
  const itensDe = (ids: string[]) => ids.flatMap((id) => vivo.item(id) ?? []);
  const tocador = criarTocador();
  const info = criarInfo();
  const autoria = criarAutoria();

  // Esqueleto fixo: as janelas não são recriadas, para não perderem a posição ao serem arrastadas.
  const titulo = el("h1");
  const pocos: Record<Janela, HTMLElement> = {
    pintura: el("div", { class: "poco opcoes" }),
    som: el("div", { class: "poco opcoes" }),
    palavra: el("div", { class: "poco opcoes palavras" }),
  };
  const outras = {} as Record<Janela, HTMLButtonElement>;
  const janelas = {} as Record<Janela, HTMLElement>;
  for (const janela of ["pintura", "som", "palavra"] as const) {
    outras[janela] = el("button", { class: "botao", type: "button", "data-acao": "outras" });
    outras[janela].addEventListener("click", () => {
      if (janela === "som") tocador.parar();
      estado = redistribuir(estado, janela, vivo.disponiveis(), Math.random);
      desenharMesa(janela);
    });
    janelas[janela] = criarJanela({ id: janela, titulo: "", conteudo: pocos[janela], rodape: outras[janela] });
  }

  const conta = el("div", { class: "conta", role: "status", "aria-live": "polite" });
  const lista = el("ul", { class: "escolhas" });
  const botaoVer = el("button", { class: "botao ver-frase", type: "button", "data-acao": "ver-frase" });
  const seletor = el("select", { id: "idioma" }, ...IDIOMAS.map((i) => el("option", { value: i }, NOMES_DE_IDIOMA[i])));
  const rotuloDoSeletor = el("label", { for: "idioma", class: "so-largo" });
  const botaoCreditos = el("button", { class: "botao", type: "button", "data-acao": "creditos" });
  const botaoAjuda = el("button", { class: "botao ajuda", type: "button", "data-acao": "ajuda" });
  const tarefas = el("footer", { class: "tarefas" }, conta, lista, botaoVer, el("div", { class: "sistema" }, botaoAjuda, botaoCreditos, rotuloDoSeletor, seletor, autoria.no));

  const resultado = criarDialogo("resultado", "");
  const inteira = criarDialogo("inteira", "");
  const creditos = criarDialogo("creditos", "");
  const folhaDeAjuda = criarDialogo("ajuda", "");

  raiz.replaceChildren(
    titulo,
    el("main", { class: "mesa-de-trabalho" }, janelas.pintura, janelas.som, janelas.palavra),
    tarefas,
    resultado.dialogo,
    inteira.dialogo,
    creditos.dialogo,
    folhaDeAjuda.dialogo,
    info.caixa,
  );

  function desenharMesa(janela: Janela): void {
    info.fechar(); // os botões (i) desta janela vão ser trocados
    const itens = itensDe(estado.mesas[janela]);
    outras[janela].disabled = itens.length === 0;
    if (itens.length === 0) {
      // Sem teto de escolhas, dá para esvaziar uma janela inteira.
      pocos[janela].replaceChildren(el("p", { class: "esgotada" }, t("janela.esgotada", idioma)));
    } else if (janela === "pintura") {
      desenharPinturas(pocos.pintura, itens, { idioma, midia, info, aoEscolher: escolherItem, aoVer: verInteira, aoFalhar: (id) => midiaFalhou(id, "pintura") });
    } else if (janela === "som") {
      desenharSons(pocos.som, itens, { idioma, midia, tocador, info, aoEscolher: escolherItem });
    } else {
      desenharPalavras(pocos.palavra, itens, idioma, info, escolherItem);
    }
  }

  function desenharBarra(): void {
    desenharBandeja({ conta, lista, ver: botaoVer }, itensDe(estado.escolhidos), idioma, (id) => {
      estado = retirar(estado, id);
      ajudaDestacada = false; // a seleção mudou: o destaque era da frase anterior
      // O item retirado volta a poder aparecer; a janela dele só é refeita se estava vazia.
      const tipo = porId.get(id)?.tipo;
      if (tipo && estado.mesas[tipo].length === 0) {
        estado = redistribuir(estado, tipo, vivo.disponiveis(), Math.random);
        desenharMesa(tipo);
      }
      desenharBarra();
    });
    botaoAjuda.classList.toggle("destacada", ajudaDestacada);
  }

  function desenharTextos(): void {
    document.documentElement.lang = idioma;
    document.title = t("titulo", idioma);
    titulo.textContent = t("titulo", idioma);
    for (const janela of ["pintura", "som", "palavra"] as const) {
      definirTitulo(janelas[janela], t(`janela.${janela}`, idioma));
      outras[janela].textContent = t("janela.outras", idioma);
      desenharMesa(janela);
    }
    rotuloDoSeletor.textContent = t("idioma.rotulo", idioma);
    seletor.value = idioma;
    // No celular a barra é estreita: o botão mostra o rótulo curto, e o nome inteiro segue no aria-label.
    botaoCreditos.replaceChildren(el("span", { class: "so-largo" }, t("creditos.abrir", idioma)), el("span", { class: "so-estreito" }, t("creditos.curto", idioma)));
    botaoCreditos.setAttribute("aria-label", t("creditos.abrir", idioma));
    botaoAjuda.textContent = ajuda.idiomas[idioma].link;
    resultado.titular(t("resultado.titulo", idioma));
    creditos.titular(t("creditos.titulo", idioma));
    folhaDeAjuda.titular(ajuda.idiomas[idioma].titulo);
    autoria.traduzir(idioma);
    desenharBarra();
  }

  function escolherItem(id: string): void {
    const tipo = porId.get(id)?.tipo;
    // Segundo clique de um toque duplo: as opções acabaram de trocar e este toque não foi numa coisa vista.
    if (tipo && !podeEscolher(ultimaTroca[tipo], performance.now())) return;
    const antes = estado;
    estado = escolher(estado, id, vivo.disponiveis(), Math.random);
    if (estado === antes) return; // toque repetido no mesmo item
    if (tipo) ultimaTroca[tipo] = performance.now(); // a escolha troca as opções desta janela no mesmo lugar
    tocador.parar();
    // O destaque da ajuda vale para a frase que foi lida: qualquer escolha nova muda a seleção e o apaga.
    ajudaDestacada = false;
    if (tipo) desenharMesa(tipo);
    desenharBarra();
    // A frase não abre sozinha: não há teto de escolhas, e quem decide que terminou é a pessoa, no botão da barra.
  }

  async function mostrarFrase(): Promise<void> {
    if (!pronta(estado)) return;
    info.fechar();
    tocador.parar();
    const ids = [...estado.escolhidos];
    const noPedido = idioma;
    desenharEspera(resultado.corpo, idioma);
    if (!resultado.dialogo.open) resultado.dialogo.showModal();
    const resposta = await pedirFrase(ids, noPedido, { buscar: fetch.bind(window), base: API, acervo: itensDe(ids), glossario });
    // A pessoa pode ter recomeçado ou trocado de idioma enquanto a frase vinha.
    if (ids.join("|") !== estado.escolhidos.join("|") || noPedido !== idioma) return;
    ajudaDestacada = resposta.ajuda_destacada;
    desenharResultado(resultado.corpo, resposta, itensDe(ids), glossario, idioma, {
      aoRecomecar: recomecar,
      aoContinuar: () => resultado.dialogo.close(),
      ajuda: { texto: ajuda.idiomas[idioma].link, aoAbrir: abrirAjuda },
    });
    desenharBarra();
  }

  function recomecar(): void {
    tocador.parar();
    for (const janela of ["pintura", "som", "palavra"] as const) delete ultimaTroca[janela]; // recomeçar é um gesto novo: a trava de toque duplo zera
    estado = criarEstado(vivo.disponiveis(), idioma, Math.random);
    if (resultado.dialogo.open) resultado.dialogo.close();
    desenharTextos();
  }

  /** A mídia de um item do acervo ampliado não abriu: ele sai de oferta e a janela troca as opções. */
  function midiaFalhou(id: string, janela: Janela): void {
    vivo.falhou(id);
    if (!estado.mesas[janela].includes(id)) return;
    if (janela === "som") tocador.parar();
    estado = redistribuir(estado, janela, vivo.disponiveis(), Math.random);
    desenharMesa(janela);
  }

  function abrirAjuda(): void {
    desenharAjuda(folhaDeAjuda.corpo, ajuda, idioma, () => folhaDeAjuda.dialogo.close());
    folhaDeAjuda.dialogo.showModal();
  }

  function verInteira(item: Item): void {
    inteira.titular(item.rotulo);
    desenharPinturaInteira(inteira.corpo, item, midia, idioma, () => inteira.dialogo.close());
    inteira.dialogo.showModal();
  }

  // Fechar a frase (Esc, × ou "Escolher mais") mantém a seleção: dá para acrescentar, retirar e pedir a frase de novo.
  botaoVer.addEventListener("click", () => void mostrarFrase());
  tocador.aoMudar((id) => marcarSomTocando(pocos.som, id, idioma));
  tocador.aoFalhar((id) => midiaFalhou(id, "som"));
  seletor.addEventListener("change", () => {
    idioma = seletor.value as Idioma;
    try {
      localStorage.setItem("idioma", idioma);
    } catch {
      /* sem armazenamento: o idioma vale só nesta visita */
    }
    tocador.parar();
    estado = trocarIdioma(estado, idioma, vivo.disponiveis(), Math.random);
    desenharTextos();
    if (resultado.dialogo.open) void mostrarFrase();
  });
  botaoCreditos.addEventListener("click", () => {
    desenharCreditos(creditos.corpo, acervo, vivo.tamanho().ampliado, idioma, () => creditos.dialogo.close());
    creditos.dialogo.showModal();
  });
  botaoAjuda.addEventListener("click", abrirAjuda);

  desenharTextos();

  // O acervo ampliado chega depois da primeira tela e não troca o que já está à vista: as pinturas e os
  // sons a mais passam a aparecer nas próximas trocas. Sem ele (sem rede, arquivo ausente), o núcleo basta.
  carregar<Acervo>("ampliado.json")
    .then((mais) => {
      vivo.ampliar(mais.itens);
      raiz.dataset.ampliado = String(vivo.tamanho().ampliado);
    })
    .catch(() => {
      raiz.dataset.ampliado = "0";
    });
}

async function principal(): Promise<void> {
  const raiz = document.getElementById("app");
  if (!raiz) return;
  const idioma = idiomaGuardado() ?? idiomaInicial(navigator.languages ?? [navigator.language]);
  raiz.replaceChildren(el("h1", {}, t("titulo", idioma)), el("p", { class: "estado", role: "status" }, t("carregando", idioma)));
  try {
    const [acervo, lista, ajuda] = await Promise.all([carregar<Acervo>("acervo.json"), carregar<Construto[]>("construtos.json"), carregar<Ajuda>("ajuda.json")]);
    iniciar(raiz, acervo, indexarGlossario(lista), ajuda);
  } catch {
    raiz.replaceChildren(el("h1", {}, t("titulo", idioma)), el("p", { class: "estado", role: "alert" }, t("erro.acervo", idioma)));
  }
}

void principal();
