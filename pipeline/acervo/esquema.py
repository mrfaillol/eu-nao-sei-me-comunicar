"""Contrato do item do acervo.

O JSON Schema (data/acervo.schema.json) confere a forma. As regras abaixo conferem o que
o schema não expressa: construto dentro do glossário, fonte e licença dentro do catálogo,
e a combinação certa de tipo, classe semiótica, origem do texto e mídia.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator

RAIZ = Path(__file__).resolve().parents[2]

# Onde a imagem de cada museu pode morar quando não está no site.
SERVIDOR_DA_FONTE = {
    "cma": ("https://openaccess-cdn.clevelandart.org/",),
    "mia": tuple(f"https://{n}.api.artsmia.org/800/" for n in range(7)),
}

# tipo -> (classe semiótica, origem do texto)
PERFIL = {
    "pintura": ("icone", "curadoria"),
    "som": ("indice", "titulo_e_tags"),
    "palavra": ("simbolo", "glosa"),
}


@lru_cache(maxsize=1)
def _validador_de_item() -> Draft202012Validator:
    schema = json.loads((RAIZ / "data" / "acervo.schema.json").read_text(encoding="utf-8"))
    return Draft202012Validator({"$ref": "#/$defs/item", "$defs": schema["$defs"]})


def validar_item(item: dict, construtos: set[str], fontes: dict) -> list[str]:
    """Devolve a lista de erros do item; lista vazia quer dizer item válido."""
    erros = [
        f"{'.'.join(str(p) for p in e.absolute_path) or 'item'}: {e.message}"
        for e in _validador_de_item().iter_errors(item)
    ]
    if erros:
        return erros

    definicao = item.get("definicao")
    if definicao:
        if item["tipo"] != "palavra":
            erros.append("definicao: só palavra tem definição de dicionário")
        elif fontes["fontes"].get(definicao["fonte"], {}).get("licenca") != definicao["licenca"]:
            erros.append(f"definicao.licenca: {definicao['licenca']} não é a licença de {definicao['fonte']} no catálogo")

    tipo = item["tipo"]
    classe, origem = PERFIL[tipo]
    if item["classe_semiotica"] != classe:
        erros.append(f"classe_semiotica: {tipo} pede {classe}")
    if item["origem_do_texto"] != origem:
        erros.append(f"origem_do_texto: {tipo} pede {origem}")

    for c in item["construtos"]:
        if c not in construtos:
            erros.append(f"construto fora do glossário: {c}")

    credito = item["credito"]
    if credito["fonte"] not in fontes["fontes"]:
        erros.append(f"fonte fora do catálogo: {credito['fonte']}")
    if credito["licenca"] not in fontes["licencas_por_tipo"][tipo]:
        erros.append(f"licenca não aceita para {tipo}: {credito['licenca']}")

    afeto = item["afeto"]
    if afeto["metodo"] == "norma_direta":
        if tipo != "palavra":
            erros.append("afeto: norma_direta só vale para palavra")
        if afeto["fonte"] not in fontes["fontes"]:
            erros.append(f"afeto: fonte fora do catálogo: {afeto['fonte']}")

    if tipo == "palavra":
        if item["idioma"] is None:
            erros.append("idioma: palavra precisa de idioma")
        if item["midia"] is not None:
            erros.append("midia: palavra não tem mídia")
        for campo in ("rosto", "nitido", "sensivel"):
            if campo in item:
                erros.append(f"{campo}: só existe em pintura")
    else:
        if item["idioma"] is not None:
            erros.append(f"idioma: {tipo} não tem idioma")
        # A mídia mora no site (acervo conferido) ou no servidor de origem do próprio tipo (acervo ampliado).
        # Imagem de fora só vale no servidor da própria fonte, e com a licença dela: é o que impede uma foto
        # de uso restrito de entrar no acervo como se fosse de domínio público.
        fonte = credito["fonte"]
        if tipo == "pintura":
            lugares = ("midia/pinturas/", *SERVIDOR_DA_FONTE.get(fonte, ()))
            if fonte in fontes["fontes"] and credito["licenca"] != fontes["fontes"][fonte]["licenca"]:
                erros.append(f"licenca: imagem de {fonte} pede {fontes['fontes'][fonte]['licenca']}")
        else:
            lugares = ("midia/sons/", "https://cdn.freesound.org/previews/")
        if item["midia"] is None or not item["midia"]["arquivo"].startswith(lugares):
            erros.append(f"midia: {tipo} pede arquivo em {' ou em '.join(lugares)}")
        if tipo == "pintura":
            for campo in ("rosto", "nitido", "sensivel"):
                if campo not in item:
                    erros.append(f"{campo}: obrigatório em pintura")
        else:
            for campo in ("rosto", "nitido", "sensivel"):
                if campo in item:
                    erros.append(f"{campo}: só existe em pintura")
    return erros
