"""Confere no Crossref se a referência de um construto existe.

O campo `issued` do Crossref não serve como ano de publicação (difere do ano de citação em
6 de 52 DOIs medidos em 12/Nov/2026), então o ano sai de `published-print` e, na falta,
de `published-online`.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

AGENTE = "art-index-probe/1.0"


def conferir_doi(doi: str, prazo_s: float = 25.0) -> dict | None:
    """Devolve {titulo, ano, url} do DOI, ou None se ele não resolver."""
    url = "https://api.crossref.org/works/" + urllib.parse.quote(doi, safe="")
    pedido = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    try:
        with urllib.request.urlopen(pedido, timeout=prazo_s) as resposta:
            mensagem = json.load(resposta)["message"]
    except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError):
        return None

    titulo = (mensagem.get("title") or [""])[0]
    ano = None
    for campo in ("published-print", "published-online"):
        partes = (mensagem.get(campo) or {}).get("date-parts") or []
        if partes and partes[0]:
            ano = partes[0][0]
            break
    return {"titulo": titulo, "ano": ano, "url": f"https://doi.org/{doi}"}
