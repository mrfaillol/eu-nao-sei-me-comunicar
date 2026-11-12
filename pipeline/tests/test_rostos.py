"""Rosto de maior destaque: detecção em três escalas, sinais por rosto e escolha com piso de tamanho."""
import csv
import io
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
import pytest
from PIL import Image, ImageCms, ImageDraw

from acervo.rostos import alvo, detectar, escolher_destaque, recortar_nitido, sinais

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).parent / "fixtures" / "rostos"
RETRATOS = ("102578", "109507", "121946", "122344", "122347", "124080")
CAMPOS = {"area", "larg_rel", "dist_centro", "conf", "nitidez_96", "contraste_rms", "figura_fundo", "frontal"}


def gabarito() -> dict[str, list[dict]]:
    por_imagem = defaultdict(list)
    with open(RAIZ / "pipeline" / "dados" / "sinais-por-rosto.tsv", encoding="utf-8", newline="") as arquivo:
        for linha in csv.DictReader(arquivo, delimiter="\t"):
            por_imagem[linha["id"]].append(linha)
    return por_imagem


def do_gabarito(linha: dict) -> dict:
    """Converte uma linha do TSV de pesquisa nos sinais que o pipeline calcula."""
    return {
        "area": float(linha["area_rel"]),
        "larg_rel": float(linha["larg_rel"]),
        "dist_centro": float(linha["dist_centro"]),
        "conf": float(linha["conf"]),
        "nitidez_96": float(linha["lap_96"]),
        "contraste_rms": float(linha["contraste_rms"]),
        "figura_fundo": float(linha["contraste_fig_fundo"]),
        "frontal": float(linha["desvio_nariz"]),
    }


@pytest.mark.parametrize("ident", RETRATOS)
def test_retratos_tem_o_rosto_principal(ident):
    principal = next(l for l in gabarito()[ident] if l["destaque_humano"] == "sim")
    cx = float(principal["x"]) + float(principal["w"]) / 2
    cy = float(principal["y"]) + float(principal["h"]) / 2
    caixas = detectar(cv2.imread(str(FIXTURES / f"{ident}.jpg")))
    assert caixas, "nenhum rosto detectado"
    assert any(abs(c["x"] + c["w"] / 2 - cx) < 0.05 and abs(c["y"] + c["h"] / 2 - cy) < 0.05 for c in caixas)


def test_coordenadas_normalizadas():
    for arquivo in sorted(FIXTURES.glob("*.jpg")):
        for c in detectar(cv2.imread(str(arquivo))):
            assert 0 <= c["x"] and c["x"] + c["w"] <= 1.0001, arquivo.name
            assert 0 <= c["y"] and c["y"] + c["h"] <= 1.0001, arquivo.name
            assert 0.6 <= c["conf"] <= 1
            assert len(c["pontos"]) == 10


def test_nao_devolve_a_mesma_caixa_duas_vezes():
    caixas = detectar(cv2.imread(str(FIXTURES / "121946.jpg")))
    centros = [(round(c["x"] + c["w"] / 2, 2), round(c["y"] + c["h"] / 2, 2)) for c in caixas]
    assert len(centros) == len(set(centros)), "a união entre escalas deixou caixa repetida"


def test_pagina_de_texto_sem_rosto():
    pagina = Image.new("RGB", (700, 900), (236, 226, 200))
    lapis = ImageDraw.Draw(pagina)
    for linha in range(40):
        lapis.text((40, 30 + linha * 21), "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod", fill=(40, 30, 20))
    assert detectar(cv2.cvtColor(np.array(pagina), cv2.COLOR_RGB2BGR)) == []


def test_sinais_tem_os_oito_campos_em_faixa_plausivel():
    imagem = cv2.imread(str(FIXTURES / "121946.jpg"))
    caixa = max(detectar(imagem), key=lambda c: c["w"] * c["h"])
    s = sinais(imagem, caixa)
    assert set(s) == CAMPOS
    assert s["larg_rel"] == pytest.approx(caixa["w"])
    assert s["area"] == pytest.approx(caixa["w"] * caixa["h"], abs=1e-5)  # o sinal é gravado com 5 casas
    assert 0 <= s["dist_centro"] <= 1 and 0 <= s["contraste_rms"] <= 1 and -1 <= s["figura_fundo"] <= 1
    assert s["nitidez_96"] > 0 and s["frontal"] >= 0
    # confere com a medição da pesquisa para o mesmo rosto (TSV), com folga para a diferença de escala
    ref = do_gabarito(next(l for l in gabarito()["121946"] if l["destaque_humano"] == "sim"))
    assert s["larg_rel"] == pytest.approx(ref["larg_rel"], abs=0.02)
    assert s["dist_centro"] == pytest.approx(ref["dist_centro"], abs=0.05)


def test_piso_tira_rosto_minusculo():
    assert escolher_destaque([{**do_gabarito(gabarito()["121946"][0]), "larg_rel": 0.02}]) is None
    assert escolher_destaque([]) is None


def test_manual_vence():
    grande = {**do_gabarito(gabarito()["121946"][0]), "area": 0.2, "larg_rel": 0.4}
    pequeno = {**grande, "area": 0.01, "larg_rel": 0.05, "dist_centro": 0.9}
    assert escolher_destaque([grande, pequeno], manual=1) == 1
    assert escolher_destaque([grande, pequeno], manual=7) is None  # índice que não existe não escolhe nada


def test_gabarito_do_dono():
    """A função de pontuação precisa acertar ao menos 6 dos 8 casos em que uma pessoa aponta um rosto.

    Medido em 12/Nov/2026 com piso de 3%: só área acerta 6, só centro acerta 8, só confiança acerta 5.
    """
    casos = {
        ident: linhas
        for ident, linhas in gabarito().items()
        if len(linhas) >= 2 and sum(l["destaque_humano"] in ("sim", "provavel") for l in linhas) == 1
    }
    assert len(casos) == 8
    acertos = 0
    for linhas in casos.values():
        escolhido = escolher_destaque([do_gabarito(l) for l in linhas])
        acertos += escolhido is not None and linhas[escolhido]["destaque_humano"] in ("sim", "provavel")
    assert acertos >= 6, f"só {acertos} de 8"


def test_alvo_bate_com_a_conta_da_pesquisa():
    a = alvo({"x": 0.4389, "y": 0.1838, "w": 0.1272, "h": 0.1477})
    assert a["s"] == pytest.approx(3.931, abs=0.001)
    assert a["tx"] == pytest.approx(-1.4752, abs=0.001)
    assert a["ty"] == pytest.approx(-0.5128, abs=0.001)
    assert alvo({"x": 0.2, "y": 0.2, "w": 0.58, "h": 0.5})["s"] == 1.0


def test_recorte_nitido_em_srgb(tmp_path):
    origem = FIXTURES / "121946.jpg"  # Adobe RGB
    caixa = max(detectar(cv2.imread(str(origem))), key=lambda c: c["w"] * c["h"])
    recortar_nitido(origem, caixa, tmp_path / "rosto.jpg", lado=300)
    recorte = Image.open(tmp_path / "rosto.jpg")
    assert recorte.format == "JPEG" and max(recorte.size) <= 300
    perfil = recorte.info.get("icc_profile")
    assert perfil is None or "sRGB" in ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(perfil)))
    # o recorte tem a proporção da pintura, porque a camada nítida cobre a moldura inteira
    inteira = Image.open(origem)
    assert recorte.width / recorte.height == pytest.approx(inteira.width / inteira.height, abs=0.02)
