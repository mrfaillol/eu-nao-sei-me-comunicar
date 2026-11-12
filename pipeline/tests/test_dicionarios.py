"""Leitura dos dicionários de cada língua: a definição entra como está escrita na fonte."""
import json

from acervo.dicionarios import _limpar_dicionario_aberto, ler_dicionario_aberto, ler_moedict, ler_wikcionario_pt

ABERTO = json.dumps([{"word": "saudade", "xml": '<entry id="saudade">\n<form>\n<orth>Saudade</orth>\n</form>\n<sense>\n<gramGrp>f.</gramGrp>\n<def>\nLembrança triste e suave de pessoas ou coisas distantes.\nNostalgia.\n</def>\n</sense>\n<sense>\n<def>\nEfeito de _aliviar_ o terno^2.\n</def>\n</sense>\n</entry>'}])
MOEDICT = json.dumps({"title": "孤單", "heteronyms": [{"pinyin": "gū dān", "definitions": [{"def": "單獨無依。", "quote": ["《紅樓夢》…"]}, {"type": "形", "def": "人單勢孤，力量單薄。"}]}]}, ensure_ascii=False)
WIKCIONARIO = "={{-pt-}}=\n=={{Substantivo|pt}}==\n'''den.go'''\n# [[denguice]], [[carinho|carinho]], [[carícia]]\n#: ''Ele é meu dengo.''\n# [[birra]] [[infantil]]\n=={{Etimologia|pt}}=="


def test_dicionario_aberto_da_um_sentido_por_linha_com_a_classe_gramatical():
    sentidos = ler_dicionario_aberto(ABERTO)
    assert sentidos[0] == {"classe": "f.", "texto": "Lembrança triste e suave de pessoas ou coisas distantes."}
    assert sentidos[1] == {"classe": "f.", "texto": "Nostalgia."}
    assert sentidos[2]["classe"] == ""  # a classe do grupo seguinte não vem escrita


def test_sinais_de_composicao_do_dicionario_aberto_saem_e_o_texto_fica():
    assert _limpar_dicionario_aberto("Efeito de _aliviar_ o terno^2.") == "Efeito de aliviar o terno."


def test_verbete_ausente_no_dicionario_aberto_da_lista_vazia():
    assert ler_dicionario_aberto("[]") == []


def test_moedict_traz_pinyin_e_a_definicao_em_caracteres_tradicionais():
    lido = ler_moedict(MOEDICT)
    assert lido["pinyin"] == "gū dān"
    assert lido["sentidos"] == [{"classe": "", "texto": "單獨無依。"}, {"classe": "形", "texto": "人單勢孤，力量單薄。"}]


def test_wikcionario_em_portugues_tira_a_marcacao_e_pula_os_exemplos():
    assert ler_wikcionario_pt(WIKCIONARIO) == [
        {"classe": "Substantivo", "texto": "denguice, carinho, carícia"},
        {"classe": "Substantivo", "texto": "birra infantil"},
    ]
