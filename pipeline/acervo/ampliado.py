"""Acervo ampliado: as pinturas e os sons que vão além do acervo conferido.

O acervo conferido (public/indice/acervo.json) tem mídia local, recorte de rosto e anotação lida item
a item. O ampliado (public/indice/ampliado.json) existe para a seleção não ter teto: a mídia fica nos
servidores de origem (o CDN aberto do museu e o do Freesound) e a anotação é automática, por léxico,
sempre presa a um trecho literal do texto humano do item (ver anotador.py).
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from acervo import sons as S
from acervo.anotador import anotar, classificar
from acervo.esquema import validar_item
from acervo.rede import abrir_com_recuo
from acervo.texto import limpar_texto

RAIZ = Path(__file__).resolve().parents[2]
CACHE = RAIZ / "pipeline" / "cache"
PAGINAS_DO_MUSEU = CACHE / "resgate-2026-11-12" / "cma"
FICHAS = CACHE / "cma-ampliado"
IMAGENS = CACHE / "web"
AGENTE = "art-index-probe/1.0"
DESCRICAO_MINIMA = 200
VERSAO = "2026-11-12.1"
CAMPOS = "id,accession_number,title,tombstone,creators,url,description,images"


def _ler(caminho: Path):
    return json.loads(caminho.read_text(encoding="utf-8"))


def _linhas(caminho: Path) -> set[str]:
    if not caminho.exists():
        return set()
    return {l.strip() for l in caminho.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")}


# ---------- pinturas ----------

def buscar_fichas_do_museu(dormir=time.sleep) -> list[dict]:
    """Todas as pinturas CC0 com imagem, com os campos do crédito. Página em cache não gasta chamada."""
    FICHAS.mkdir(parents=True, exist_ok=True)
    fichas: list[dict] = []
    salto = 0
    while True:
        arquivo = FICHAS / f"p{salto}.json"
        if not arquivo.exists():
            endereco = f"https://openaccess-api.clevelandart.org/api/artworks/?cc0=1&type=Painting&has_image=1&limit=1000&skip={salto}&fields={CAMPOS}"
            with abrir_com_recuo(urllib.request.Request(endereco, headers={"User-Agent": AGENTE}), timeout=120, dormir=dormir) as resposta:
                arquivo.write_bytes(resposta.read())
            dormir(2)
        pagina = _ler(arquivo)["data"]
        fichas.extend(pagina)
        if len(pagina) < 1000:
            return fichas
        salto += 1000


def fichas_em_cache() -> list[dict]:
    """As páginas guardadas pela pesquisa: têm texto e imagem, mas não o nome do autor."""
    return [f for arquivo in sorted(PAGINAS_DO_MUSEU.glob("p[0-9]*.json")) for f in _ler(arquivo)["data"]]


def _autor(ficha: dict) -> str:
    criadores = ficha.get("creators") or []
    descricao = (criadores[0].get("description") or "") if criadores else ""
    return limpar_texto(descricao.split(" (")[0], limite=120)


def item_de_pintura(ficha: dict, lexico: dict) -> tuple[dict, list[dict]] | None:
    """O item e as evidências da anotação, ou None quando a ficha não entra."""
    web = ((ficha.get("images") or {}).get("web") or {})
    texto = limpar_texto(ficha.get("description") or "")
    titulo = limpar_texto(ficha.get("title") or "", limite=120)
    if len(texto) < DESCRICAO_MINIMA or not web.get("url", "").startswith("https://openaccess-cdn.clevelandart.org/") or not titulo:
        return None
    # Algumas fichas do museu trazem a imagem sem largura ou altura: sem a proporção, a moldura não tem como ser desenhada.
    try:
        largura, altura = int(web["width"]), int(web["height"])
    except (KeyError, TypeError, ValueError):
        return None
    if largura < 1 or altura < 1:
        return None
    classe = classificar(f"{titulo}. {texto}", lexico)
    evidencias = anotar(texto, lexico["texto"])
    if classe["excluir"] or not evidencias:
        return None
    acesso = ficha.get("accession_number") or ""
    item = {
        "id": f"pintura:cma:{ficha['id']}",
        "tipo": "pintura",
        "classe_semiotica": "icone",
        "idioma": None,
        "rotulo": titulo,
        "texto_humano": texto,
        "origem_do_texto": "curadoria",
        "construtos": [e["construto"] for e in evidencias],
        "tema_sensivel": classe["tema_sensivel"],
        "afeto": {"metodo": "ausente"},
        "credito": {
            "autor": _autor(ficha),
            "linha": limpar_texto(ficha.get("tombstone") or f"{titulo}. The Cleveland Museum of Art, {acesso}", limite=400),
            "fonte": "cma",
            "licenca": "CC0-1.0",
            "url": ficha.get("url") or f"https://clevelandart.org/art/{acesso}",
        },
        "revisao": {"humana": "pendente", "por": None, "em": None},
        "midia": {"arquivo": web["url"], "largura": largura, "altura": altura},
        "rosto": None,
        "nitido": None,
        "sensivel": {"nudez": "nenhuma", "violencia": "historica" if classe["tema_sensivel"] else "nenhuma"},
    }
    return item, evidencias


def _baixar_imagem(item: dict) -> Path | None:
    destino = IMAGENS / f"{item['id'].rsplit(':', 1)[-1]}.jpg"
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    try:
        with abrir_com_recuo(urllib.request.Request(item["midia"]["arquivo"], headers={"User-Agent": AGENTE}), timeout=60) as resposta:
            destino.write_bytes(resposta.read())
        return destino
    except (urllib.error.URLError, OSError):
        return None


def marcar_rostos(itens: list[dict], paralelos: int = 6) -> int:
    """Baixa a imagem de cada pintura para o cache e grava a caixa do rosto de destaque. Devolve quantas têm rosto."""
    import cv2

    from acervo import rostos as R

    IMAGENS.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(paralelos) as fila:
        arquivos = list(fila.map(_baixar_imagem, itens))
    com_rosto = 0
    for item, arquivo in zip(itens, arquivos):
        imagem = cv2.imread(str(arquivo)) if arquivo else None
        if imagem is None:
            item["_sem_imagem"] = True
            continue
        caixas = R.detectar(imagem)
        destaque = R.escolher_destaque([R.sinais(imagem, c) for c in caixas])
        if destaque is not None:
            item["rosto"] = {k: caixas[destaque][k] for k in ("x", "y", "w", "h")}
            com_rosto += 1
    return com_rosto


# ---------- sons ----------

def buscar_sons(termos_novos: list[str], termos_antigos: list[str], paginas_antigos: int = 3, paginas_novos: int = 2) -> list[dict]:
    """Resultados do Openverse para os termos. Para em silêncio quando o teto diário ou o servidor recusam."""
    fonte = S.FonteOpenverse(CACHE / "openverse")
    resultados: list[dict] = []
    for termo, paginas in [(t, paginas_antigos) for t in termos_antigos] + [(t, paginas_novos) for t in termos_novos]:
        for n in range(1, paginas + 1):
            try:
                resultados.extend(fonte.buscar(termo, n)[(n - 1) * 20 :])
            except (S.LimiteDiario, urllib.error.URLError, OSError) as erro:
                print(f"busca interrompida em {termo!r}, página {n}: {erro}", flush=True)
                return resultados + _so_do_cache(fonte)
    return resultados


def _so_do_cache(fonte: S.FonteOpenverse) -> list[dict]:
    return [r for arquivo in sorted(fonte.cache.glob("*.json")) if arquivo.name != "contador.json" for r in _ler(arquivo).get("results", [])]


def item_de_som(r: dict, lexico: dict) -> tuple[dict, list[dict]] | None:
    endereco = r.get("url") or ""
    if not endereco.startswith("https://cdn.freesound.org/previews/"):
        return None
    try:
        item = S.para_item_som(r, {"arquivo": endereco, "duracao_ms": int(r["duration"])})
    except ValueError:
        return None
    evidencias = anotar(item["texto_humano"], lexico["tags"])
    if not evidencias or not item["rotulo"]:
        return None
    item["construtos"] = [e["construto"] for e in evidencias]
    return item, evidencias


# ---------- montagem ----------

def montar(fichas: list[dict], resultados_de_som: list[dict], com_rostos: bool = True) -> dict:
    lexico = _ler(RAIZ / "data" / "lexico-construtos.json")
    fontes = _ler(RAIZ / "data" / "fontes.json")
    construtos = {c["id"] for c in _ler(RAIZ / "data" / "construtos.json") if not c.get("dimensao")}
    do_conferido = {i["id"] for i in _ler(RAIZ / "public" / "indice" / "acervo.json")["itens"]}
    fora = {f"pintura:cma:{n}" for n in _linhas(RAIZ / "data" / "pinturas-excluidas.txt")} | {f"som:freesound:{n}" for n in _linhas(RAIZ / "data" / "sons-excluidos.txt")}
    barrados = _linhas(RAIZ / "data" / "sons-barrados.txt")

    itens: dict[str, dict] = {}
    evidencias: dict[str, list[dict]] = {}

    def entra(par) -> None:
        if par is None:
            return
        item, provas = par
        if item["id"] in itens or item["id"] in do_conferido or item["id"] in fora:
            return
        itens[item["id"]], evidencias[item["id"]] = item, provas

    for ficha in fichas:
        entra(item_de_pintura(ficha, lexico))
    pinturas = [i for i in itens.values() if i["tipo"] == "pintura"]
    com_rosto = marcar_rostos(pinturas) if com_rostos else 0
    # Pintura cuja imagem não baixou agora não entra: não dá para prometer que ela abre no site.
    for item in pinturas:
        if item.pop("_sem_imagem", False):
            del itens[item["id"]], evidencias[item["id"]]

    for r in S.filtrar(resultados_de_som, barrados):
        entra(item_de_som(r, lexico))

    erros = [f"{i['id']}: {e}" for i in itens.values() for e in validar_item(i, construtos, fontes)]
    # A promessa do acervo: toda anotação cita um trecho que está escrito no texto humano do item.
    for ident, provas in evidencias.items():
        erros += [f"{ident}: trecho fora do texto ({p['trecho']!r})" for p in provas if p["trecho"] not in itens[ident]["texto_humano"]]
    lista = sorted(itens.values(), key=lambda i: i["id"])
    return {
        "acervo": {"versao": VERSAO, "demonstracao": True, "itens": lista},
        "evidencias": {i["id"]: evidencias[i["id"]] for i in lista},
        "erros": erros,
        "resumo": {"pinturas": sum(i["tipo"] == "pintura" for i in lista), "com_rosto": com_rosto, "sons": sum(i["tipo"] == "som" for i in lista), "tema_sensivel": sum(i["tema_sensivel"] for i in lista)},
    }
