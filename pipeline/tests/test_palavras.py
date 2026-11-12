"""Palavras: glosa humana copiada sem alteração e afeto só por norma direta."""
import json
from pathlib import Path

import pytest

from acervo.afeto import (
    linhas_zheng,
    glosa_zheng,
    linha_zheng,
    norma_glasgow,
    normalizar_ativacao,
    normalizar_valencia,
)
from acervo.esquema import validar_item
from acervo.glosas import buscar_glosa, listar_sentidos, sugerir_sentido

RAIZ = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).parent / "fixtures"
IDIOMAS = ("pt-BR", "en", "zh-CN")


def saudade(_palavra):
    return json.loads((FIXTURES / "wikcionario-saudade.json").read_text(encoding="utf-8"))


def test_normalizacao():
    assert normalizar_valencia(5, 1, 9) == 0.0
    assert normalizar_valencia(1, 1, 9) == -1.0
    assert normalizar_valencia(9, 1, 9) == 1.0
    assert normalizar_ativacao(1, 1, 9) == 0.0
    assert normalizar_ativacao(9, 1, 9) == 1.0
    # Zheng et al. (2023): valência de -3 a +3, ativação de 0 a 4 (lido no artigo)
    assert normalizar_valencia(-3, -3, 3) == -1.0
    assert normalizar_ativacao(2, 0, 4) == 0.5


def test_glasgow_devolve_norma_de_palavra_simples():
    norma = norma_glasgow("abattoir")  # primeira linha do CSV: AROU 4.200, VAL 2.864
    assert norma == {
        "metodo": "norma_direta",
        "valencia": normalizar_valencia(2.864, 1, 9),
        "ativacao": normalizar_ativacao(4.200, 1, 9),
        "fonte": "glasgow-2019",
    }


def test_glasgow_ignora_sentido_com_parenteses():
    assert norma_glasgow("address (postal)") is None
    assert norma_glasgow("palavra-que-nao-existe") is None


def test_zheng_so_questionario():
    linhas = linhas_zheng()
    assert len(linhas) == 264
    assert all(l["VAL_ARO_SOURCE"] == "Questionnaires" for l in linhas)


def test_zheng_tem_valencia_incoerente_e_por_isso_nao_vira_norma():
    # Palavras de sentido inequívoco com o sinal trocado nas linhas de questionário próprio.
    assert float(linha_zheng("恨意")["VAL"]) > 1  # ódio, avaliado como positivo
    assert float(linha_zheng("狂喜")["VAL"]) < 0  # êxtase, avaliado como negativo
    assert float(linha_zheng("盼望")["VAL"]) < -1  # esperança, avaliada como muito negativa


def test_glosa_da_fixture():
    sentidos = listar_sentidos("saudade", "pt", carregar=saudade)
    assert len(sentidos) >= 1
    assert all("<" not in s for s in sentidos)
    glosa = buscar_glosa("saudade", "pt", 0, carregar=saudade)
    assert glosa["texto"] == sentidos[0]
    assert len(glosa["texto"]) <= 600
    assert glosa["licenca"] == "CC-BY-SA-4.0"
    assert glosa["url"] == "https://en.wiktionary.org/wiki/saudade"
    assert buscar_glosa("saudade", "pt", 99, carregar=saudade) is None
    assert buscar_glosa("saudade", "xx", 0, carregar=saudade) is None


def test_sugerir_sentido_prefere_o_de_estado_mental():
    sentidos = ["hole, hollow, cavity", "septic tank", "(colloquial) sadness, depression, the blues"]
    assert sugerir_sentido(sentidos) == 2
    assert sugerir_sentido(["a kind of fish", "a tool"]) is None


def test_listas():
    saida = json.loads((RAIZ / "pipeline" / "saida" / "palavras.json").read_text(encoding="utf-8"))
    construtos = {c["id"] for c in json.loads((RAIZ / "data" / "construtos.json").read_text(encoding="utf-8"))}
    fontes = json.loads((RAIZ / "data" / "fontes.json").read_text(encoding="utf-8"))
    por_idioma = {i: [p for p in saida if p["idioma"] == i] for i in IDIOMAS}
    for idioma in IDIOMAS:
        assert len(por_idioma[idioma]) >= 90, idioma  # eram 30 por idioma até 12/Nov/2026
    rotulos = [p["rotulo"] for p in saida]
    assert len(rotulos) == len(set(rotulos)), "palavra repetida entre listas"
    for item in saida:
        assert validar_item(item, construtos, fontes) == [], item["id"]
    assert all(p["afeto"]["metodo"] == "ausente" for p in por_idioma["pt-BR"])
    assert all(p["afeto"]["metodo"] == "ausente" for p in por_idioma["zh-CN"])
    assert any(p["afeto"]["metodo"] == "norma_direta" for p in por_idioma["en"])
    for p in por_idioma["zh-CN"]:
        assert p["credito"]["fonte"] == "zheng-2023" and p["texto_humano"] == glosa_zheng(p["rotulo"])


def test_carregador_espera_e_tenta_de_novo_quando_o_servidor_pede_calma(tmp_path):
    import io
    import urllib.error

    from acervo.glosas import carregar_definicoes

    chamadas, esperas = [], []

    def abrir(pedido, timeout):
        chamadas.append(pedido.full_url)
        if len(chamadas) < 3:
            raise urllib.error.HTTPError(pedido.full_url, 429, "Too Many Requests", {"Retry-After": "7"}, None)
        return io.BytesIO(b'{"pt": [{"definitions": [{"definition": "ok"}]}]}')

    dado = carregar_definicoes("palavra", cache=tmp_path, abrir=abrir, dormir=esperas.append)
    assert dado["pt"][0]["definitions"][0]["definition"] == "ok"
    assert len(chamadas) == 3
    assert esperas[:2] == [7, 7]  # respeita o Retry-After do servidor
    # a segunda leitura vem do cache e não chama a rede
    carregar_definicoes("palavra", cache=tmp_path, abrir=abrir, dormir=esperas.append)
    assert len(chamadas) == 3


def test_carregador_desiste_depois_de_quatro_recusas(tmp_path):
    import urllib.error

    from acervo.glosas import carregar_definicoes

    def abrir(pedido, timeout):
        raise urllib.error.HTTPError(pedido.full_url, 429, "Too Many Requests", {}, None)

    with pytest.raises(urllib.error.HTTPError):
        carregar_definicoes("palavra", cache=tmp_path, abrir=abrir, dormir=lambda s: None)
    assert not list(tmp_path.iterdir()), "falha não pode virar cache"
