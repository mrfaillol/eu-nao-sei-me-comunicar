"""Fichas do Minneapolis Institute of Art: o texto de curadoria é CC0, a foto é de uso não comercial e fica no servidor do museu."""

import json
from pathlib import Path

import pytest

from acervo.esquema import validar_item
from acervo.mia import LICENCA_DO_MIA, endereco_da_imagem, item_do_mia

RAIZ = Path(__file__).resolve().parents[2]
LEXICO = json.loads((RAIZ / "data" / "lexico-construtos.json").read_text(encoding="utf-8"))
FONTES = json.loads((RAIZ / "data" / "fontes.json").read_text(encoding="utf-8"))
CONSTRUTOS = {c["id"] for c in json.loads((RAIZ / "data" / "construtos.json").read_text(encoding="utf-8")) if not c.get("dimensao")}

FICHA = {
    "id": 1218,
    "title": "Olive Trees",
    "artist": "Vincent van Gogh",
    "dated": "1889",
    "classification": "Paintings",
    "rights_type": "Public Domain",
    "image": "valid",
    "restricted": 0,
    "image_width": 10501,
    "image_height": 8342,
    "creditline": "The William Hood Dunwoody Fund",
    "accession_number": "51.7",
    "text": "This is one of fifteen canvases of olive trees that van Gogh executed in 1889, in the peaceful garden of the asylum where he had interned himself. He found the grove serene.",
}


def test_ficha_vira_item_com_a_imagem_no_servidor_do_museu_e_o_aviso_de_uso():
    item, evidencias = item_do_mia(FICHA, LEXICO)
    assert item["id"] == "pintura:mia:1218" and item["tipo"] == "pintura" and item["rotulo"] == "Olive Trees"
    assert item["midia"] == {"arquivo": "https://0.api.artsmia.org/800/1218.jpg", "largura": 800, "altura": 636}
    assert item["credito"]["fonte"] == "mia" and item["credito"]["licenca"] == LICENCA_DO_MIA
    assert item["credito"]["autor"] == "Vincent van Gogh"
    assert item["credito"]["url"] == "https://collections.artsmia.org/art/1218"
    assert "Minneapolis Institute of Art" in item["credito"]["linha"] and "The William Hood Dunwoody Fund" in item["credito"]["linha"]
    assert item["origem_do_texto"] == "curadoria" and item["texto_humano"] == FICHA["text"]
    assert item["construtos"] and all(e["trecho"] in item["texto_humano"] for e in evidencias)
    assert validar_item(item, CONSTRUTOS, FONTES) == []


def test_a_imagem_fica_num_dos_sete_servidores_escolhido_pelo_resto_do_id():
    assert endereco_da_imagem(1218) == "https://0.api.artsmia.org/800/1218.jpg"
    assert endereco_da_imagem(1219) == "https://1.api.artsmia.org/800/1219.jpg"
    assert endereco_da_imagem(6) == "https://6.api.artsmia.org/800/6.jpg"


def test_imagem_em_pe_tem_a_altura_como_lado_maior():
    item, _ = item_do_mia({**FICHA, "image_width": 3000, "image_height": 4000}, LEXICO)
    assert item["midia"]["largura"] == 600 and item["midia"]["altura"] == 800


@pytest.mark.parametrize(
    "troca",
    [
        {"rights_type": "Copyright Protected"},
        {"restricted": 1},
        {"restricted": "1"},
        {"image": "invalid"},
        {"classification": "Sculpture"},
        {"classification": "Ceremonial Objects, Sculpture"},
        {"text": "Short label."},
        {"text": "x" * 30 + " A plain technical note about the paper, the plate, the edition and the printer, with nothing else to say about it at all."},
        {"image_width": 9000, "image_height": 1000},
        {"image_width": None},
        {"title": ""},
    ],
)
def test_ficha_que_nao_serve_fica_fora(troca):
    assert item_do_mia({**FICHA, **troca}, LEXICO) is None


def test_o_validador_prende_a_imagem_e_a_licenca_a_fonte():
    item, _ = item_do_mia(FICHA, LEXICO)
    fora_do_museu = {**item, "midia": {**item["midia"], "arquivo": "https://exemplo.test/800/1218.jpg"}}
    assert any("midia" in e for e in validar_item(fora_do_museu, CONSTRUTOS, FONTES))
    servidor_de_outra_fonte = {**item, "midia": {**item["midia"], "arquivo": "https://openaccess-cdn.clevelandart.org/x_web.jpg"}}
    assert any("midia" in e for e in validar_item(servidor_de_outra_fonte, CONSTRUTOS, FONTES))
    licenca_de_outra_fonte = {**item, "credito": {**item["credito"], "licenca": "CC0-1.0"}}
    assert any("licenca" in e for e in validar_item(licenca_de_outra_fonte, CONSTRUTOS, FONTES))
