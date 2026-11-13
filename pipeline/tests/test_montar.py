"""Montagem do índice: anotação ancorada no texto humano, invariantes e versão publicável."""
import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator

from acervo.montar import aplicar_anotacao, fracao_de_trios_de_um_construto, montar, publico, validar_acervo

RAIZ = Path(__file__).resolve().parents[2]
CONSTRUTOS = {"apego", "luto", "nostalgia", "solitude"}
DIMENSOES = {"valencia_negativa"}


def palavra(n: int, construtos: list[str], idioma: str = "pt-BR", humana: str = "pendente") -> dict:
    return {
        "id": f"palavra:{idioma}:p{n}", "tipo": "palavra", "classe_semiotica": "simbolo", "idioma": idioma,
        "rotulo": f"p{n}", "texto_humano": "a feeling of longing for something lost", "origem_do_texto": "glosa",
        "construtos": construtos, "tema_sensivel": False, "afeto": {"metodo": "ausente"},
        "credito": {"autor": "x", "linha": "x", "fonte": "wikcionario-en", "licenca": "CC-BY-SA-4.0", "url": "https://x.test"},
        "revisao": {"humana": humana, "por": None, "em": None}, "midia": None,
    }


def pintura(n: int) -> dict:
    return {
        "id": f"pintura:cma:{n}", "tipo": "pintura", "classe_semiotica": "icone", "idioma": None, "rotulo": f"Quadro {n}",
        "texto_humano": "A woman sits alone by the window in grey light.", "origem_do_texto": "curadoria",
        "construtos": [], "tema_sensivel": False, "afeto": {"metodo": "ausente"},
        "credito": {"autor": "x", "linha": "x", "fonte": "cma", "licenca": "CC0-1.0", "url": "https://x.test"},
        "revisao": {"humana": "pendente", "por": None, "em": None},
        "midia": {"arquivo": f"midia/pinturas/cma-{n}.webp", "largura": 10, "altura": 10},
        "rosto": None, "nitido": None, "sensivel": {"nudez": "nenhuma", "violencia": "nenhuma"},
        "_curadoria": {"epoca": "1900+"}, "_rostos": [],
    }


def test_anotacao_entra_quando_o_trecho_esta_no_texto():
    item, erros = aplicar_anotacao(pintura(1), {"construtos": ["solitude"], "tema_sensivel": True, "trecho": "sits alone by the window"}, CONSTRUTOS, DIMENSOES)
    assert erros == []
    assert item["construtos"] == ["solitude"] and item["tema_sensivel"] is True


def test_trecho_fora_do_texto_reprova():
    _, erros = aplicar_anotacao(pintura(1), {"construtos": ["solitude"], "tema_sensivel": False, "trecho": "weeps in the dark"}, CONSTRUTOS, DIMENSOES)
    assert any("trecho" in e for e in erros)


def test_anotacao_recusa_construto_de_fora_e_termo_de_dimensao():
    _, fora = aplicar_anotacao(pintura(1), {"construtos": ["inexistente"], "tema_sensivel": False, "trecho": "sits alone"}, CONSTRUTOS, DIMENSOES)
    _, dim = aplicar_anotacao(pintura(1), {"construtos": ["valencia_negativa"], "tema_sensivel": False, "trecho": "sits alone"}, CONSTRUTOS | DIMENSOES, DIMENSOES)
    _, muitos = aplicar_anotacao(pintura(1), {"construtos": ["apego", "luto", "nostalgia", "solitude"], "tema_sensivel": False, "trecho": "sits alone"}, CONSTRUTOS, DIMENSOES)
    assert any("construto" in e for e in fora) and any("dimens" in e for e in dim) and any("1 a 3" in e for e in muitos)


def test_item_sem_anotacao_reprova():
    _, erros = aplicar_anotacao(pintura(1), None, CONSTRUTOS, DIMENSOES)
    assert any("sem anota" in e for e in erros)


def test_publico_tira_as_chaves_do_pipeline():
    item = publico(pintura(1))
    assert not any(chave.startswith("_") for chave in item)
    assert item["midia"]["arquivo"] == "midia/pinturas/cma-1.webp"


def test_fracao_de_trios_de_um_construto():
    # 4 itens só de luto entre 10: C(4,3) = 4 trios degenerados em C(10,3) = 120
    itens = [palavra(n, ["luto"]) for n in range(4)] + [palavra(n, ["apego", "nostalgia"]) for n in range(4, 10)]
    assert fracao_de_trios_de_um_construto(itens) == 4 / 120


def test_acervo_com_muitos_trios_de_um_construto_reprova():
    itens = [palavra(n, ["luto"]) for n in range(8)] + [palavra(n, ["apego"]) for n in range(8, 10)]
    assert any("um só construto" in e for e in validar_acervo(itens))
    variado = [palavra(n, ["luto", "apego"]) for n in range(10)]
    assert validar_acervo(variado) == []


def test_acervo_recusa_id_repetido():
    assert any("repetido" in e for e in validar_acervo([palavra(1, ["luto", "apego"]), palavra(1, ["luto", "apego"])]))


def montar_de_teste(tmp_path, **opcoes):
    origem = tmp_path / "saida"
    origem.mkdir(exist_ok=True)
    (origem / "pinturas.json").write_text(json.dumps([pintura(1), pintura(2)]), encoding="utf-8")
    (origem / "sons.json").write_text("[]", encoding="utf-8")
    palavras = [palavra(n, ["apego", "nostalgia"]) for n in range(3)] + [palavra(9, ["luto", "apego"], humana="aprovada")]
    (origem / "palavras.json").write_text(json.dumps(palavras), encoding="utf-8")
    anot = {"pintura:cma:1": {"construtos": ["solitude"], "tema_sensivel": False, "trecho": "sits alone"},
            "pintura:cma:2": {"construtos": ["solitude", "luto"], "tema_sensivel": False, "trecho": "grey light"}}
    return montar(tmp_path / "indice", origem=origem, anotacoes={"pinturas": anot, "sons": {}}, **opcoes)


def test_montagem_valida(tmp_path):
    relatorio = montar_de_teste(tmp_path)
    assert relatorio["erros"] == []
    assert relatorio["por_tipo"] == {"pintura": 2, "som": 0, "palavra": 4}
    assert relatorio["pendentes"] == 5
    acervo = json.loads((tmp_path / "indice" / "acervo.json").read_text(encoding="utf-8"))
    assert acervo["demonstracao"] is True
    schema = json.loads((RAIZ / "data" / "acervo.schema.json").read_text(encoding="utf-8"))
    assert list(Draft202012Validator(schema).iter_errors(acervo)) == []
    assert (tmp_path / "indice" / "construtos.json").exists() and (tmp_path / "indice" / "ajuda.json").exists()


def test_apenas_aprovados(tmp_path):
    relatorio = montar_de_teste(tmp_path, apenas_aprovados=True)
    acervo = json.loads((tmp_path / "indice" / "acervo.json").read_text(encoding="utf-8"))
    assert [i["id"] for i in acervo["itens"]] == ["palavra:pt-BR:p9"]
    assert acervo["demonstracao"] is False and relatorio["pendentes"] == 0


def test_erro_de_anotacao_nao_grava_indice(tmp_path):
    origem = tmp_path / "saida"
    origem.mkdir()
    (origem / "pinturas.json").write_text(json.dumps([pintura(1)]), encoding="utf-8")
    (origem / "sons.json").write_text("[]", encoding="utf-8")
    (origem / "palavras.json").write_text("[]", encoding="utf-8")
    relatorio = montar(tmp_path / "indice", origem=origem, anotacoes={"pinturas": {}, "sons": {}})
    assert relatorio["erros"] and not (tmp_path / "indice" / "acervo.json").exists()


def test_ajuda_tem_tres_idiomas():
    ajuda = json.loads((RAIZ / "data" / "ajuda.json").read_text(encoding="utf-8"))
    assert ajuda["conferido_em"] == "2026-11-12"
    assert set(ajuda["idiomas"]) == {"pt-BR", "en", "zh-CN"}
    assert ajuda["idiomas"]["pt-BR"]["linha"]["contato"] == "188"
    assert ajuda["idiomas"]["en"]["linha"]["contato"] == "988"
    assert ajuda["idiomas"]["zh-CN"]["linha"]["contato"] == "12356"
    for idioma in ajuda["idiomas"].values():
        assert idioma["link"] and idioma["titulo"] and idioma["linha"]["detalhe"]
        assert idioma["diretorio"]["url"].startswith("https://findahelpline.com")


def test_acervo_real():
    acervo = json.loads((RAIZ / "public" / "indice" / "acervo.json").read_text(encoding="utf-8"))
    por_tipo = {t: sum(i["tipo"] == t for i in acervo["itens"]) for t in ("pintura", "som", "palavra")}
    assert por_tipo == {"pintura": 30, "som": 30, "palavra": 606}  # 177 em português, 190 em inglês, 239 em mandarim
    assert validar_acervo(acervo["itens"]) == []
    for item in acervo["itens"]:
        assert not any(chave.startswith("_") for chave in item)
        if item["midia"]:
            assert (RAIZ / "public" / item["midia"]["arquivo"]).exists(), item["id"]
        if item.get("nitido"):
            assert (RAIZ / "public" / item["nitido"]).exists(), item["id"]
