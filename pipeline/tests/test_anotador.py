"""Anotação automática do acervo ampliado: só vale o que está escrito no texto humano."""
import json
from pathlib import Path

from acervo.anotador import anotar, casa, classificar

RAIZ = Path(__file__).resolve().parents[2]
LEXICO = json.loads((RAIZ / "data" / "lexico-construtos.json").read_text(encoding="utf-8"))
CONSTRUTOS = {c["id"] for c in json.loads((RAIZ / "data" / "construtos.json").read_text(encoding="utf-8")) if not c.get("dimensao")}


def test_o_lexico_so_fala_de_construtos_do_glossario():
    for campo in ("texto", "tags"):
        assert set(LEXICO[campo]) <= CONSTRUTOS, set(LEXICO[campo]) - CONSTRUTOS


def test_pista_casa_palavra_inteira_e_nao_pedaco_de_outra():
    assert casa("awe", "a scene of awe and wonder") == "awe"
    assert casa("awe", "an awesome sight") is None
    assert casa("fear", "the fearless rider") is None


def test_asterisco_casa_flexoes():
    assert casa("mourn*", "Women mourning at the tomb") == "mourning"
    assert casa("mourn*", "a morning walk") is None


def test_expressao_de_varias_palavras_casa_inteira():
    assert casa("mother and child", "A tender Mother and Child in a garden") == "Mother and Child"


def test_anotar_devolve_o_trecho_literal_que_sustenta_cada_construto():
    texto = "A solitary monk reads by a window. The serene light suggests stillness."
    anotacao = anotar(texto, LEXICO["texto"])
    assert [a["construto"] for a in anotacao] == ["restauracao_da_atencao", "solitude"]
    for a in anotacao:
        assert a["trecho"] in texto


def test_o_construto_com_mais_pistas_vem_primeiro_e_o_teto_e_tres():
    texto = "Joy, delight and happiness fill the festive scene; a peaceful, calm, serene river; memories of childhood; awe."
    anotacao = anotar(texto, LEXICO["texto"])
    assert anotacao[0]["construto"] in {"emocoes_positivas", "restauracao_da_atencao"}
    assert len(anotacao) == 3


def test_texto_sem_pista_nao_recebe_construto():
    assert anotar("Oil on canvas, signed lower left.", LEXICO["texto"]) == []


def test_classificar_marca_tema_grave_e_exclui_o_que_nao_e_para_todos():
    assert classificar("Soldiers after the battle.", LEXICO) == {"excluir": False, "tema_sensivel": True}
    assert classificar("A reclining nude by a window.", LEXICO) == {"excluir": True, "tema_sensivel": False}
    assert classificar("A bowl of fruit.", LEXICO) == {"excluir": False, "tema_sensivel": False}


def _ficha(**mudancas):
    base = {
        "id": 1,
        "accession_number": "1950.1",
        "title": "A Quiet Harbor",
        "tombstone": "A Quiet Harbor, 1880. Artista Exemplo. Oil on canvas.",
        "url": "https://clevelandart.org/art/1950.1",
        "creators": [{"description": "Artista Exemplo (American, 1840-1900)"}],
        "description": "A serene harbor at dusk, where a solitary fisherman mends his nets in the peaceful evening light. " * 3,
        "images": {"web": {"url": "https://openaccess-cdn.clevelandart.org/1950.1/1950.1_web.jpg", "width": "900", "height": "600"}},
    }
    return {**base, **mudancas}


def test_ficha_do_museu_vira_item_com_midia_remota_e_trecho_que_esta_no_texto():
    from acervo.ampliado import item_de_pintura

    item, evidencias = item_de_pintura(_ficha(), LEXICO)
    assert item["midia"] == {"arquivo": "https://openaccess-cdn.clevelandart.org/1950.1/1950.1_web.jpg", "largura": 900, "altura": 600}
    assert item["credito"]["autor"] == "Artista Exemplo"
    assert item["construtos"] == [e["construto"] for e in evidencias]
    for e in evidencias:
        assert e["trecho"] in item["texto_humano"]


def test_ficha_sem_medida_de_imagem_sem_pista_ou_com_nudez_nao_entra():
    from acervo.ampliado import item_de_pintura

    assert item_de_pintura(_ficha(images={"web": {"url": "https://openaccess-cdn.clevelandart.org/x.jpg", "width": "", "height": ""}}), LEXICO) is None
    assert item_de_pintura(_ficha(description="Oil on canvas, signed and dated lower left by the painter. " * 5), LEXICO) is None
    assert item_de_pintura(_ficha(description="A serene nude reclines by a peaceful window in calm light. " * 5), LEXICO) is None
    assert item_de_pintura(_ficha(images={"web": {"url": "https://exemplo.test/x.jpg", "width": "9", "height": "9"}}), LEXICO) is None


def test_cena_de_flagelacao_fica_fora_do_acervo_ampliado():
    # Achado no vídeo de divulgação de 12/Nov: um díptico da Paixão entrou anotado como "divagação mental".
    texto = "Diptych with the Passion of Christ (left wing): Flagellation and Christ Before Pilate. A contemplative devotional image."
    assert classificar(texto, LEXICO)["excluir"] is True


def test_nudez_dita_com_outras_palavras_tambem_exclui():
    # Escapes medidos em 12/Nov/2026: "nakedness" numa Criação e "homoerotic" numa aquarela.
    for texto in ("The pair is unaware of their nakedness, a sign of a sinless state.", "Demuth kept these homoerotic watercolors private.", "A bacchanal in a wooded glade."):
        assert classificar(texto, LEXICO)["excluir"] is True, texto
    # e palavra que só contém as letras não exclui
    assert classificar("Sussex landscape with sextant and unsexed figures of saints.", LEXICO)["excluir"] is False
