"""Contrato do item do acervo: o que entra e o que é barrado."""
import copy
import json
from pathlib import Path

from acervo.esquema import validar_item

RAIZ = Path(__file__).resolve().parents[2]
FONTES = json.loads((RAIZ / "data" / "fontes.json").read_text(encoding="utf-8"))
CONSTRUTOS = {"solitude", "nostalgia", "apego"}

PINTURA = {
    "id": "pintura:cma:121946",
    "tipo": "pintura",
    "classe_semiotica": "icone",
    "idioma": None,
    "rotulo": "Portrait of a Woman",
    "texto_humano": "A woman sits alone by a window, her hands folded, in grey northern light.",
    "origem_do_texto": "curadoria",
    "construtos": ["solitude"],
    "tema_sensivel": False,
    "afeto": {"metodo": "ausente"},
    "credito": {
        "autor": "Artista Exemplo",
        "linha": "Portrait of a Woman, c. 1650. Artista Exemplo. Oil on canvas.",
        "fonte": "cma",
        "licenca": "CC0-1.0",
        "url": "https://clevelandart.org/art/1950.1",
    },
    "revisao": {"humana": "pendente", "por": None, "em": None},
    "midia": {"arquivo": "midia/pinturas/cma-121946.webp", "largura": 1275, "altura": 1600},
    "rosto": {"x": 0.4389, "y": 0.1838, "w": 0.1272, "h": 0.1477},
    "nitido": "midia/rostos/cma-121946.jpg",
    "sensivel": {"nudez": "nenhuma", "violencia": "nenhuma"},
}

SOM = {
    "id": "som:freesound:401275",
    "tipo": "som",
    "classe_semiotica": "indice",
    "idioma": None,
    "rotulo": "Rain, Moderate, C",
    "texto_humano": "Rain, Moderate, C | rain, raindrops, weather, moderate",
    "origem_do_texto": "titulo_e_tags",
    "construtos": ["nostalgia"],
    "tema_sensivel": False,
    "afeto": {"metodo": "ausente"},
    "credito": {
        "autor": "autor-exemplo",
        "linha": "Rain, Moderate, C, por autor-exemplo",
        "fonte": "freesound-via-openverse",
        "licenca": "CC0-1.0",
        "url": "https://freesound.org/people/autor-exemplo/sounds/401275",
    },
    "revisao": {"humana": "pendente", "por": None, "em": None},
    "midia": {"arquivo": "midia/sons/fs-401275.mp3", "duracao_ms": 12000},
}


def erros(item):
    return validar_item(item, CONSTRUTOS, FONTES)


def test_item_valido_passa():
    assert erros(PINTURA) == []
    assert erros(SOM) == []


def test_licenca_fora_do_catalogo_reprova():
    item = copy.deepcopy(PINTURA)
    item["credito"]["licenca"] = "CC-BY-NC-4.0"
    assert any("licenca" in e for e in erros(item))


def test_construto_fora_do_glossario_reprova():
    item = copy.deepcopy(PINTURA)
    item["construtos"] = ["inexistente"]
    assert any("construto" in e for e in erros(item))


def test_sem_texto_humano_reprova():
    item = copy.deepcopy(PINTURA)
    item["texto_humano"] = ""
    assert any("texto_humano" in e for e in erros(item))


def test_afeto_ausente_nao_tem_numero():
    item = copy.deepcopy(PINTURA)
    item["afeto"] = {"metodo": "ausente", "valencia": 0.1}
    assert any("afeto" in e for e in erros(item))


def test_som_cc_by_reprova():
    item = copy.deepcopy(SOM)
    item["credito"]["licenca"] = "CC-BY-4.0"
    assert any("licenca" in e for e in erros(item))


def test_rotulo_acima_de_120_caracteres_reprova():
    item = copy.deepcopy(PINTURA)
    item["rotulo"] = "x" * 121
    assert any("rotulo" in e for e in erros(item))
