import "../estilo/base.css";
import "../estilo/janela.css";
import { indexarGlossario } from "../frase/glossario";
import { IDIOMAS, type Acervo, type Construto, type Glossario, type Idioma, type Item } from "../frase/tipos";
import { desenharAjuda, type Ajuda } from "./ajuda";
import { criarTocador } from "./audio";
import { desenharBandeja } from "./bandeja";
import { desenharCreditos, desenharPinturaInteira } from "./creditos";
import { el } from "./dom";
import { idiomaInicial, t } from "./i18n";
import { criarDialogo, criarJanela, definirTitulo } from "./janela";
import { desenharPalavras } from "./janela-palavras";
import { desenharPinturas } from "./janela-pinturas";
import { desenharSons, marcarSomTocando } from "./janela-sons";
import { pedirFrase } from "./pedido";
import { desenharEspera, desenharResultado } from "./resultado";
import { completa, criarEstado, escolher, redistribuir, retirar, trocarIdioma, type EstadoSelecao, type Janela } from "./selecao";

const BASE = import.meta.env.BASE_URL;
const API = (import.meta.env.VITE_API_BASE as string | undefined) || null;
const NOMES_DE_IDIOMA: Record<Idioma, string> = { "pt-BR": "Português", en: "English", "zh-CN": "中文" };
const midia = (caminho: string) => `${BASE}${caminho}`;

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
  let estado: EstadoSelecao = criarEstado(acervo.itens, idioma, Math.random);
  let ajudaDestacada = false;
  const porId = new Map(acervo.itens.map((i) => [i.id, i]));
  const itensDe = (ids: string[]) => ids.flatMap((id) => porId.get(id) ?? []);
  const tocador = criarTocador();

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
      estado = redistribuir(estado, janela, acervo.itens, Math.random);
      desenharMesa(janela);
    });
    janelas[janela] = criarJanela({ id: janela, titulo: "", conteudo: pocos[janela], rodape: outras[janela] });
  }

  const conta = el("div", { class: "conta", role: "status", "aria-live": "polite" });
  const lista = el("ul", { class: "escolhas" });
  const seletor = el("select", { id: "idioma" }, ...IDIOMAS.map((i) => el("option", { value: i }, NOMES_DE_IDIOMA[i])));
  const rotuloDoSeletor = el("label", { for: "idioma", class: "so-largo" });
  const botaoCreditos = el("button", { class: "botao so-largo", type: "button", "data-acao": "creditos" });
  const botaoAjuda = el("button", { class: "botao ajuda", type: "button", "data-acao": "ajuda" });
  const tarefas = el("footer", { class: "tarefas" }, conta, lista, el("div", { class: "sistema" }, botaoAjuda, botaoCreditos, rotuloDoSeletor, seletor));

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
  );

  function desenharMesa(janela: Janela): void {
    const itens = itensDe(estado.mesas[janela]);
    if (janela === "pintura") {
      desenharPinturas(pocos.pintura, itens, { idioma, midia, aoEscolher: escolherItem, aoVer: verInteira });
    } else if (janela === "som") {
      desenharSons(pocos.som, itens, { idioma, midia, tocador, aoEscolher: escolherItem });
    } else {
      desenharPalavras(pocos.palavra, itens, idioma, escolherItem);
    }
  }

  function desenharBarra(): void {
    desenharBandeja(conta, lista, itensDe(estado.escolhidos), idioma, (id) => {
      estado = retirar(estado, id);
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
    botaoCreditos.textContent = t("creditos.abrir", idioma);
    botaoAjuda.textContent = ajuda.idiomas[idioma].link;
    resultado.titular(t("resultado.titulo", idioma));
    creditos.titular(t("creditos.titulo", idioma));
    folhaDeAjuda.titular(ajuda.idiomas[idioma].titulo);
    desenharBarra();
  }

  function escolherItem(id: string): void {
    const antes = estado;
    estado = escolher(estado, id, acervo.itens, Math.random);
    if (estado === antes) return; // quarta escolha ou toque repetido
    tocador.parar();
    const tipo = porId.get(id)?.tipo;
    if (tipo) desenharMesa(tipo);
    desenharBarra();
    if (completa(estado)) void mostrarFrase();
  }

  async function mostrarFrase(): Promise<void> {
    const ids = [...estado.escolhidos];
    const noPedido = idioma;
    desenharEspera(resultado.corpo, idioma);
    if (!resultado.dialogo.open) resultado.dialogo.showModal();
    const resposta = await pedirFrase(ids, noPedido, { buscar: fetch.bind(window), base: API, acervo: acervo.itens, glossario });
    // A pessoa pode ter recomeçado ou trocado de idioma enquanto a frase vinha.
    if (ids.join("|") !== estado.escolhidos.join("|") || noPedido !== idioma) return;
    ajudaDestacada = resposta.ajuda_destacada;
    desenharResultado(resultado.corpo, resposta, itensDe(ids), glossario, idioma, recomecar);
    desenharBarra();
  }

  function recomecar(): void {
    tocador.parar();
    ajudaDestacada = false;
    estado = criarEstado(acervo.itens, idioma, Math.random);
    if (resultado.dialogo.open) resultado.dialogo.close();
    desenharTextos();
  }

  function verInteira(item: Item): void {
    inteira.titular(item.rotulo);
    desenharPinturaInteira(inteira.corpo, item, midia, idioma, () => inteira.dialogo.close());
    inteira.dialogo.showModal();
  }

  // Fechar a frase com Esc equivale a recomeçar: uma seleção completa sem frase à vista seria um beco.
  resultado.dialogo.addEventListener("close", () => {
    if (completa(estado)) recomecar();
  });
  tocador.aoMudar((id) => marcarSomTocando(pocos.som, id, idioma));
  seletor.addEventListener("change", () => {
    idioma = seletor.value as Idioma;
    try {
      localStorage.setItem("idioma", idioma);
    } catch {
      /* sem armazenamento: o idioma vale só nesta visita */
    }
    tocador.parar();
    estado = trocarIdioma(estado, idioma, acervo.itens, Math.random);
    desenharTextos();
    if (completa(estado)) void mostrarFrase();
  });
  botaoCreditos.addEventListener("click", () => {
    desenharCreditos(creditos.corpo, acervo, idioma, () => creditos.dialogo.close());
    creditos.dialogo.showModal();
  });
  botaoAjuda.addEventListener("click", () => {
    desenharAjuda(folhaDeAjuda.corpo, ajuda, idioma, () => folhaDeAjuda.dialogo.close());
    folhaDeAjuda.dialogo.showModal();
  });

  desenharTextos();
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
