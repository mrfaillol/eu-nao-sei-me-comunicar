"""A definição de cada palavra no dicionário da própria língua.

A glosa que serve de texto humano às palavras em português e em mandarim veio em inglês (Wiktionary em
inglês e Zheng et al., 2023). Quem lê em português ou em chinês precisa do dicionário da sua língua:

- português: Dicionário Aberto (dicionario-aberto.net), que parte do Novo Diccionário de Cândido de
  Figueiredo (1913) com a grafia atualizada. Traz a classe gramatical e a definição seca dos dicionários antigos.
- mandarim: Wikcionário em chinês, com pinyin, classe da palavra e definição. O verbete é escrito em
  chinês tradicional e é convertido aqui para o simplificado (a licença CC BY-SA permite).

A definição entra copiada, sem reescrita. A escolha do sentido de cada palavra fica em data/palavras/.
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Callable

from acervo.rede import abrir_com_recuo

RAIZ = Path(__file__).resolve().parents[2]
CACHE = RAIZ / "pipeline" / "cache" / "dicionarios"
AGENTE = "art-index-probe/1.0"


def _baixar(endereco: str, arquivo: Path, dormir: Callable[[float], None] = time.sleep) -> str:
    if arquivo.exists():
        return arquivo.read_text(encoding="utf-8")
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    with abrir_com_recuo(urllib.request.Request(endereco, headers={"User-Agent": AGENTE}), timeout=40, dormir=dormir) as resposta:
        texto = resposta.read().decode("utf-8")
    arquivo.write_text(texto, encoding="utf-8")
    dormir(1.5)
    return texto


# ---------- português: Dicionário Aberto ----------

def ler_dicionario_aberto(bruto: str) -> list[dict]:
    """Sentidos de um verbete do Dicionário Aberto: classe gramatical e definição, uma linha por sentido."""
    sentidos: list[dict] = []
    for registro in json.loads(bruto):
        try:
            entrada = ET.fromstring(registro["xml"])
        except ET.ParseError:
            continue
        for sentido in entrada.iter("sense"):
            classe = " ".join((sentido.findtext("gramGrp") or "").split())
            for linha in "".join(sentido.find("def").itertext()).splitlines() if sentido.find("def") is not None else []:
                texto = " ".join(linha.split())
                if texto:
                    sentidos.append({"classe": classe, "texto": texto})
    return sentidos


def sentidos_pt(palavra: str, dormir: Callable[[float], None] = time.sleep) -> list[dict]:
    endereco = f"https://api.dicionario-aberto.net/word/{urllib.parse.quote(palavra)}"
    return ler_dicionario_aberto(_baixar(endereco, CACHE / "pt" / f"{palavra}.json", dormir))


# ---------- mandarim: Wikcionário em chinês ----------

def _sem_marcacao(linha: str) -> str:
    """Tira a marcação do wikitexto de uma linha de definição, deixando só o que a pessoa leria."""
    texto = re.sub(r"\{\{(?:lb|label|lbl|標籤|标签)\|zh\|([^{}]*)\}\}", "", linha)
    texto = re.sub(r"\{\{(?:l|m|link|zh-l|zh-m)\|(?:zh\|)?([^{}|]+)[^{}]*\}\}", r"\1", texto)
    texto = re.sub(r"\{\{[^{}]*\}\}", "", texto)
    texto = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", r"\1", texto)
    texto = re.sub(r"'{2,}|<[^>]+>", "", texto)
    return " ".join(texto.split()).strip(" ：:;；")


def ler_wikcionario_zh(wikitexto: str, simplificar: Callable[[str], str]) -> dict:
    """Pinyin e sentidos (classe da palavra e definição) da seção de chinês de um verbete."""
    secao = re.search(r"^==\s*(?:漢語|汉语)\s*==\s*$(.*?)(?=^==[^=]|\Z)", wikitexto, flags=re.S | re.M)
    corpo = secao.group(1) if secao else wikitexto
    pinyin = re.search(r"\|\s*m\s*=\s*([^\n|}]+)", corpo)
    sentidos: list[dict] = []
    classe = ""
    for linha in corpo.splitlines():
        titulo = re.match(r"^={3,4}\s*(.+?)\s*={3,4}\s*$", linha)
        if titulo:
            classe = titulo.group(1)
        elif re.match(r"^#(?![#*:])", linha):
            texto = _sem_marcacao(linha[1:])
            if texto:
                sentidos.append({"classe": simplificar(classe), "texto": simplificar(texto)})
    return {"pinyin": pinyin.group(1).split(",")[0].strip() if pinyin else "", "sentidos": sentidos}


def verbete_zh(palavra: str, dormir: Callable[[float], None] = time.sleep) -> dict:
    from opencc import OpenCC

    consulta = urllib.parse.urlencode({"action": "parse", "page": palavra, "prop": "wikitext", "format": "json", "formatversion": 2, "redirects": 1})
    dado = json.loads(_baixar(f"https://zh.wiktionary.org/w/api.php?{consulta}", CACHE / "zh" / f"{palavra}.json", dormir))
    wikitexto = (dado.get("parse") or {}).get("wikitext") or ""
    return ler_wikcionario_zh(wikitexto, OpenCC("t2s").convert)


# ---------- mandarim: 重編國語辭典修訂本, pelo moedict ----------

def ler_moedict(bruto: str) -> dict:
    """Pinyin e definições de um verbete. O texto fica como foi publicado, em caracteres tradicionais."""
    dado = json.loads(bruto)
    variantes = dado.get("heteronyms") or []
    sentidos = [{"classe": d.get("type") or "", "texto": " ".join((d.get("def") or "").split())} for v in variantes for d in v.get("definitions") or []]
    return {"pinyin": (variantes[0].get("pinyin") or "") if variantes else "", "sentidos": [s for s in sentidos if s["texto"]]}


def verbete_moedict(tradicional: str, dormir: Callable[[float], None] = time.sleep) -> dict:
    endereco = f"https://www.moedict.tw/uni/{urllib.parse.quote(tradicional)}"
    return ler_moedict(_baixar(endereco, CACHE / "moedict" / f"{tradicional}.json", dormir))


# ---------- português: Wikcionário, para o que o Dicionário Aberto não tem ----------

def ler_wikcionario_pt(wikitexto: str) -> list[dict]:
    sentidos: list[dict] = []
    classe = ""
    for linha in wikitexto.splitlines():
        titulo = re.match(r"^==\s*(?:\{\{)?([^|}=]+)", linha)
        if titulo and linha.startswith("==") and not linha.startswith("==="):
            classe = titulo.group(1).strip()
        elif re.match(r"^#(?![#*:])", linha):
            texto = _sem_marcacao(linha[1:])
            if texto:
                sentidos.append({"classe": classe, "texto": texto})
    return sentidos


def sentidos_wikcionario_pt(palavra: str, dormir: Callable[[float], None] = time.sleep) -> list[dict]:
    consulta = urllib.parse.urlencode({"action": "parse", "page": palavra, "prop": "wikitext", "format": "json", "formatversion": 2})
    dado = json.loads(_baixar(f"https://pt.wiktionary.org/w/api.php?{consulta}", CACHE / "ptwikt" / f"{palavra}.json", dormir))
    return ler_wikcionario_pt((dado.get("parse") or {}).get("wikitext") or "")


# ---------- a definição de cada palavra ----------

CLASSES_PT = {"m.": "s. m.", "f.": "s. f.", "Adj.": "adj.", "Substantivo": "s."}
ENDERECO = {
    "dicionario-aberto": "https://dicionario-aberto.net/search/{}",
    "wikcionario-pt": "https://pt.wiktionary.org/wiki/{}",
    "moedict": "https://www.moedict.tw/{}",
}


def _limpar_dicionario_aberto(texto: str) -> str:
    """Tira os sinais de composição do dicionário (_itálico_ e ^índice): sobra o texto que se lê na página."""
    return " ".join(re.sub(r"\^\d+", "", texto.replace("_", "")).split())


def definir(idioma: str, palavra: str, escolha: dict, fontes: dict) -> dict:
    """A definição escolhida para a palavra, com classe, pronúncia e crédito. Lança erro se o sentido não existe."""
    fonte, numero = escolha["fonte"], escolha["sentido"]
    pronuncia = ""
    if fonte == "dicionario-aberto":
        verbete = escolha.get("verbete", palavra)
        sentidos = sentidos_pt(verbete)
        # No Dicionário Aberto a classe gramatical vem só no primeiro sentido de cada grupo.
        for n, s in enumerate(sentidos):
            if not s["classe"] and n > 0:
                s["classe"] = sentidos[n - 1]["classe"]
        sentidos = [{"classe": CLASSES_PT.get(s["classe"], s["classe"]), "texto": _limpar_dicionario_aberto(s["texto"])} for s in sentidos]
    elif fonte == "wikcionario-pt":
        verbete = escolha.get("verbete", palavra)
        sentidos = [{"classe": CLASSES_PT.get(s["classe"], s["classe"]), "texto": s["texto"]} for s in sentidos_wikcionario_pt(verbete)]
    elif fonte == "moedict":
        from opencc import OpenCC

        verbete = escolha.get("verbete") or OpenCC("s2tw").convert(palavra)
        lido = verbete_moedict(verbete)
        sentidos, pronuncia = lido["sentidos"], lido["pinyin"]
    else:
        raise ValueError(f"{palavra}: fonte de definição desconhecida ({fonte})")
    if numero >= len(sentidos):
        raise ValueError(f"{palavra}: o verbete {verbete!r} em {fonte} tem {len(sentidos)} sentido(s), e a escolha pede o {numero}")
    sentido = sentidos[numero]
    return {
        "texto": sentido["texto"][:400],
        "classe": sentido["classe"],
        "pronuncia": pronuncia,
        "fonte": fonte,
        "licenca": fontes["fontes"][fonte]["licenca"],
        "url": ENDERECO[fonte].format(urllib.parse.quote(verbete)),
    }


def definicoes(escolhas: dict, fontes: dict) -> dict[str, dict]:
    """id do item -> definição, para todas as palavras de data/definicoes.json."""
    return {f"palavra:{idioma}:{palavra}": definir(idioma, palavra, escolha, fontes) for idioma in ("pt-BR", "zh-CN") for palavra, escolha in escolhas[idioma].items()}
