"""Monta os itens de palavra a partir das três listas autorais em data/palavras/."""
from __future__ import annotations

import json
from pathlib import Path

from acervo.afeto import glosa_zheng, norma_glasgow
from acervo.glosas import buscar_glosa

RAIZ = Path(__file__).resolve().parents[2]
# idioma do app -> seção da página do Wiktionary em inglês
SECAO = {"pt-BR": "pt", "en": "en"}
REVISAO = {"humana": "pendente", "por": None, "em": None}


def carregar_lista(idioma: str) -> list[dict]:
    return json.loads((RAIZ / "data" / "palavras" / f"{idioma}.json").read_text(encoding="utf-8"))


def para_item_palavra(entrada: dict, idioma: str, buscar=buscar_glosa) -> dict | None:
    """Item do acervo para a palavra, ou None se não houver texto humano para ela."""
    palavra = entrada["palavra"]
    if idioma == "zh-CN":
        texto = glosa_zheng(palavra)
        if texto is None:
            return None
        credito = {
            "autor": "Zheng et al. (2023)",
            "linha": f"Glosa em inglês de “{palavra}” em Zheng et al. (2023), copiada sem alteração (CC0)",
            "fonte": "zheng-2023",
            "licenca": "CC0-1.0",
            "url": "https://doi.org/10.6084/m9.figshare.20209859",
        }
        afeto = {"metodo": "ausente"}
    else:
        glosa = buscar(palavra, SECAO[idioma], entrada["sentido"])
        if glosa is None:
            return None
        texto = glosa["texto"]
        credito = {
            "autor": "Colaboradores do Wiktionary",
            "linha": f"Definição de “{palavra}” no Wiktionary em inglês, copiada sem alteração (CC BY-SA 4.0)",
            "fonte": "wikcionario-en",
            "licenca": glosa["licenca"],
            "url": glosa["url"],
        }
        afeto = (norma_glasgow(palavra) if idioma == "en" else None) or {"metodo": "ausente"}

    return {
        "id": f"palavra:{idioma}:{palavra}",
        "tipo": "palavra",
        "classe_semiotica": "simbolo",
        "idioma": idioma,
        "rotulo": palavra,
        "texto_humano": texto,
        "origem_do_texto": "glosa",
        "construtos": entrada["construtos"],
        "tema_sensivel": entrada["tema_sensivel"],
        "afeto": afeto,
        "credito": credito,
        "revisao": dict(REVISAO),
        "midia": None,
    }


def montar_palavras(por_idioma: int = 30) -> tuple[list[dict], list[str]]:
    """Devolve (itens, descartadas). Palavra sem texto humano fica fora, e a falta é relatada."""
    itens, descartadas = [], []
    for idioma in ("pt-BR", "en", "zh-CN"):
        do_idioma = []
        for entrada in carregar_lista(idioma):
            item = para_item_palavra(entrada, idioma)
            if item is None:
                descartadas.append(f"{idioma}:{entrada['palavra']}")
            elif len(do_idioma) < por_idioma:
                do_idioma.append(item)
        itens.extend(do_idioma)
    return itens, descartadas
