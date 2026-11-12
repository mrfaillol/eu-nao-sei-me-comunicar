"""Glossário fechado: três idiomas, sem nome de sintoma, referência que existe."""
import json
import re
import time
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
IDIOMAS = ("pt-BR", "en", "zh-CN")
DIMENSOES = {"valencia_negativa", "valencia_positiva", "alta_ativacao", "baixa_ativacao"}
# Termos que também nomeiam sintoma ou transtorno ficam fora do glossário (desenho, seção 4).
SINTOMAS = {
    "ansiedade", "anedonia", "ruminação", "hipervigilância", "desamparo", "desesperança", "esgotamento",
    "depressão", "insônia", "pânico", "trauma", "dissociação",
    "anxiety", "anhedonia", "rumination", "hypervigilance", "helplessness", "hopelessness", "burnout",
    "depression", "insomnia", "panic", "dissociation",
}


def carregar():
    return json.loads((RAIZ / "data" / "construtos.json").read_text(encoding="utf-8"))


def test_tres_idiomas():
    for c in carregar():
        for campo in ("termo", "definicao", "variantes"):
            assert set(c[campo]) == set(IDIOMAS), f"{c['id']}.{campo}"
        for idioma in IDIOMAS:
            assert c["termo"][idioma].strip(), f"{c['id']} sem termo em {idioma}"
            assert c["definicao"][idioma].strip(), f"{c['id']} sem definição em {idioma}"


def test_ids_em_snake_case_e_unicos():
    ids = [c["id"] for c in carregar()]
    assert len(ids) == len(set(ids))
    for i in ids:
        assert re.fullmatch(r"[a-z]+(_[a-z]+)*", i), i


def test_nenhum_termo_da_lista_de_sintomas():
    for c in carregar():
        for idioma in ("pt-BR", "en"):
            assert c["termo"][idioma].lower() not in SINTOMAS, c["id"]


def test_minimo_de_construtos():
    glossario = carregar()
    dimensoes = {c["id"] for c in glossario if c["dimensao"]}
    assert dimensoes == DIMENSOES
    assert sum(not c["dimensao"] for c in glossario) >= 16


def test_toda_referencia_tem_doi_citacao_e_titulo():
    for c in carregar():
        ref = c["referencia"]
        assert ref["doi"].startswith("10."), c["id"]
        assert ref["citacao"].strip() and ref["titulo_contem"].strip(), c["id"]


@pytest.mark.rede
def test_doi_resolve():
    from acervo.referencias import conferir_doi

    vistos: dict[str, dict | None] = {}
    for c in carregar():
        doi = c["referencia"]["doi"]
        if doi not in vistos:
            vistos[doi] = conferir_doi(doi)
            time.sleep(1)
        achado = vistos[doi]
        assert achado is not None, f"{c['id']}: DOI {doi} não resolve"
        assert c["referencia"]["titulo_contem"].lower() in achado["titulo"].lower(), (
            f"{c['id']}: título no Crossref é {achado['titulo']!r}"
        )
