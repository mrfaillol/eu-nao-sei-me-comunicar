"""Pinturas: seleção com cotas, texto de curadoria limpo e cópia local em sRGB."""
import csv
import io
import json
from collections import Counter
from pathlib import Path

from PIL import Image, ImageCms

from acervo.esquema import validar_item
from acervo.pinturas import COTAS_POR_EPOCA, gerar_copia, limpar_texto, para_item_pintura, selecionar

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).parent / "fixtures"


def candidatas():
    with open(RAIZ / "pipeline" / "dados" / "candidatas-cma.csv", encoding="utf-8", newline="") as arquivo:
        return list(csv.DictReader(arquivo))


def test_selecao_respeita_cotas():
    escolhidas = selecionar(candidatas(), total=30)
    assert len(escolhidas) == 30
    assert Counter(c["epoca"] for c in escolhidas) == COTAS_POR_EPOCA
    assert COTAS_POR_EPOCA == {"antes de 1400": 4, "1400-1599": 7, "1600-1799": 7, "1800-1899": 7, "1900+": 5}
    assert max(Counter(c["regiao"] for c in escolhidas).values()) <= 6
    assert sum("retrato" in c["generos_por_palavra"] for c in escolhidas) >= 12
    assert len({c["id_cma"] for c in escolhidas}) == 30


def test_selecao_deterministica():
    a = [c["id_cma"] for c in selecionar(candidatas(), total=30)]
    b = [c["id_cma"] for c in selecionar(list(reversed(candidatas())), total=30)]
    assert a == b


def test_candidata_recusada_cede_lugar_a_outra_da_mesma_epoca():
    todas = candidatas()
    primeira = selecionar(todas, total=30)
    recusada = primeira[0]
    segunda = selecionar(todas, total=30, aceita=lambda c: c["id_cma"] != recusada["id_cma"])
    assert recusada["id_cma"] not in {c["id_cma"] for c in segunda}
    assert Counter(c["epoca"] for c in segunda) == COTAS_POR_EPOCA


def test_limpar_texto_tira_marcacao_endereco_e_controle():
    limpo = limpar_texto("<em>Hurd</em> was a silversmith &amp; engraver. See https://x.org/a?b=1 for more.\u0007\n\nSecond  line.")
    assert limpo == "Hurd was a silversmith & engraver. See for more. Second line."


def test_limpar_texto_corta_em_fim_de_frase():
    longo = " ".join(f"Sentence number {n} has exactly some words in it." for n in range(40))
    assert len(longo) > 900
    limpo = limpar_texto(longo)
    assert len(limpo) <= 600
    assert limpo.endswith(".")
    assert longo.startswith(limpo)


def test_copia_em_srgb(tmp_path):
    origem = FIXTURES / "rostos" / "121946.jpg"  # traz perfil Adobe RGB (1998)
    assert "Adobe RGB" in ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(Image.open(origem).info["icc_profile"])))
    midia = gerar_copia(origem, tmp_path / "cma-121946.webp", lado=400)
    copia = Image.open(tmp_path / "cma-121946.webp")
    assert copia.format == "WEBP"
    assert max(copia.size) == 400
    assert midia == {"arquivo": "midia/pinturas/cma-121946.webp", "largura": copia.width, "altura": copia.height}
    perfil = copia.info.get("icc_profile")
    assert perfil is None or "sRGB" in ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(perfil)))
    # a conversão muda os números dos pixels: copiar os bytes sem converter deixaria as cores erradas
    sem_converter = Image.open(origem).convert("RGB").resize(copia.size)
    assert copia.convert("RGB").tobytes()[:1500] != sem_converter.tobytes()[:1500]


def test_copia_nao_amplia_imagem_menor(tmp_path):
    origem = FIXTURES / "rostos" / "102578.jpg"  # 939 x 893, sem perfil
    midia = gerar_copia(origem, tmp_path / "cma-102578.webp", lado=1600)
    assert (midia["largura"], midia["altura"]) == (939, 893)


def test_item_passa_no_esquema():
    ficha = json.loads((FIXTURES / "cma-94979.json").read_text(encoding="utf-8"))["data"]
    midia = {"arquivo": "midia/pinturas/cma-94979.webp", "largura": 1341, "altura": 1600}
    item = para_item_pintura(ficha, midia)
    assert item["id"] == "pintura:cma:94979"
    assert item["origem_do_texto"] == "curadoria"
    assert item["classe_semiotica"] == "icone"
    assert item["texto_humano"] == limpar_texto(ficha["description"])
    assert item["credito"]["licenca"] == "CC0-1.0"
    assert item["credito"]["linha"] == ficha["tombstone"]
    assert item["credito"]["autor"] == "John Singleton Copley"
    assert item["credito"]["url"] == "https://clevelandart.org/art/1915.534"
    assert item["rosto"] is None and item["nitido"] is None
    assert item["construtos"] == []  # a anotação entra na montagem
    fontes = json.loads((RAIZ / "data" / "fontes.json").read_text(encoding="utf-8"))
    anotado = {**item, "construtos": ["apego"]}
    assert validar_item(anotado, {"apego"}, fontes) == []


def test_item_ignora_descricao_de_maquina():
    ficha = json.loads((FIXTURES / "cma-94979.json").read_text(encoding="utf-8"))["data"]
    ficha = {**ficha, "images": {**ficha["images"], "annotation": "TEXTO GERADO POR MAQUINA"}}
    assert "MAQUINA" not in json.dumps(para_item_pintura(ficha, {"arquivo": "midia/pinturas/x.webp", "largura": 1, "altura": 1}))


def test_rotulo_de_terceiro_e_limpo_e_tem_teto():
    ficha = json.loads((FIXTURES / "cma-94979.json").read_text(encoding="utf-8"))["data"]
    ficha = {**ficha, "title": "<b>Título</b> https://x.test/a\u0007 " + "muito longo " * 40}
    item = para_item_pintura(ficha, {"arquivo": "midia/pinturas/x.webp", "largura": 1, "altura": 1})
    assert len(item["rotulo"]) <= 120
    assert "<" not in item["rotulo"] and "https://" not in item["rotulo"] and "\u0007" not in item["rotulo"]
