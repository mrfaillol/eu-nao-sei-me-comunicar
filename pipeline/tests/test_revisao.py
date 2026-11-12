"""Folha de revisão humana: o dono vê, ouve e lê cada item, e a decisão dele manda no índice."""
import json
import re

from acervo.montar import montar
from acervo.revisao import aplicar_decisoes, gerar_folha, impressao
from tests.test_montar import palavra, pintura


def pintura_com_rostos(n: int) -> dict:
    item = pintura(n)
    item["construtos"] = ["solitude"]
    item["_rostos"] = [
        {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2, "conf": 0.9, "sinais": {"area": 0.04, "larg_rel": 0.2}},
        {"x": 0.6, "y": 0.5, "w": 0.1, "h": 0.1, "conf": 0.8, "sinais": {"area": 0.01, "larg_rel": 0.1}},
    ]
    item["_destaque"] = 0
    item["rosto"] = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}
    item["nitido"] = f"midia/rostos/cma-{n}.jpg"
    return item


def som(n: int) -> dict:
    return {
        "id": f"som:freesound:{n}", "tipo": "som", "classe_semiotica": "indice", "idioma": None, "rotulo": f"Som {n}",
        "texto_humano": "Rain | rain, window, night", "origem_do_texto": "titulo_e_tags", "construtos": ["solitude"],
        "tema_sensivel": False, "afeto": {"metodo": "ausente"},
        "credito": {"autor": "a", "linha": "l", "fonte": "freesound-via-openverse", "licenca": "CC0-1.0", "url": "https://x.test"},
        "revisao": {"humana": "pendente", "por": None, "em": None},
        "midia": {"arquivo": f"midia/sons/fs-{n}.mp3", "duracao_ms": 5000},
    }


def test_folha_lista_todos_os_ids(tmp_path):
    itens = [pintura_com_rostos(1), som(2), palavra(3, ["apego"])]
    gerar_folha(itens, tmp_path)
    pagina = (tmp_path / "index.html").read_text(encoding="utf-8")
    assert set(re.findall(r'data-id="([^"]+)"', pagina)) == {i["id"] for i in itens}
    assert "<audio" in pagina and "fs-2.mp3" in pagina
    assert pagina.count('class="caixa') == 2, "as duas caixas de rosto aparecem, numeradas"
    assert "decisoes.json" in pagina


def test_folha_escapa_texto_de_terceiros(tmp_path):
    malicioso = som(2)
    malicioso["rotulo"] = '<script>alert(1)</script>'
    malicioso["texto_humano"] = '"><img src=x onerror=alert(1)>'
    gerar_folha([malicioso], tmp_path)
    pagina = (tmp_path / "index.html").read_text(encoding="utf-8")
    assert "<script>alert(1)</script>" not in pagina
    assert "<img src=x" not in pagina
    assert "&lt;script&gt;" in pagina


def test_aprovar_muda_o_estado():
    itens, avisos = aplicar_decisoes([som(2)], {"som:freesound:2": {"humana": "aprovada", "por": "Victor", "em": "2026-11-12", "impressao": impressao(som(2))}})
    assert itens[0]["revisao"] == {"humana": "aprovada", "por": "Victor", "em": "2026-11-12"}
    assert avisos == []


def test_decisao_sem_nome_ou_de_item_desconhecido_vira_aviso():
    itens, avisos = aplicar_decisoes(
        [som(2)],
        {"som:freesound:2": {"humana": "aprovada", "por": "", "em": "2026-11-12"}, "som:freesound:99": {"humana": "aprovada", "por": "V", "em": "2026-11-12"}},
    )
    assert itens[0]["revisao"]["humana"] == "pendente", "aprovação sem nome de quem revisou não vale"
    assert len(avisos) == 2


def test_destaque_manual_troca_o_rosto():
    itens, _ = aplicar_decisoes(
        [pintura_com_rostos(1)],
        {"pintura:cma:1": {"humana": "aprovada", "por": "Victor", "em": "2026-11-12", "destaque_manual": 1, "nudez": "parcial", "violencia": "nenhuma", "impressao": impressao(pintura_com_rostos(1))}},
    )
    item = itens[0]
    assert item["rosto"] == {"x": 0.6, "y": 0.5, "w": 0.1, "h": 0.1}
    assert item["_destaque_manual"] == 1
    assert item["nitido"] is None, "o recorte nítido antigo não vale para o rosto novo"
    assert item["sensivel"] == {"nudez": "parcial", "violencia": "nenhuma"}


def test_destaque_manual_vazio_tira_o_zoom():
    itens, _ = aplicar_decisoes(
        [pintura_com_rostos(1)], {"pintura:cma:1": {"humana": "aprovada", "por": "V", "em": "2026-11-12", "destaque_manual": "nenhum", "impressao": impressao(pintura_com_rostos(1))}}
    )
    assert itens[0]["rosto"] is None and itens[0]["nitido"] is None


def test_reprovado_fica_fora_ate_do_indice_de_demonstracao(tmp_path):
    origem = tmp_path / "saida"
    origem.mkdir()
    (origem / "pinturas.json").write_text("[]", encoding="utf-8")
    (origem / "sons.json").write_text("[]", encoding="utf-8")
    (origem / "palavras.json").write_text(json.dumps([palavra(n, ["apego", "nostalgia"]) for n in range(3)]), encoding="utf-8")
    decisoes = {"palavra:pt-BR:p0": {"humana": "reprovada", "por": "Victor", "em": "2026-11-12"},
                "palavra:pt-BR:p1": {"humana": "aprovada", "por": "Victor", "em": "2026-11-12", "impressao": impressao(palavra(1, ["apego", "nostalgia"]))}}
    relatorio = montar(tmp_path / "indice", origem=origem, anotacoes={"pinturas": {}, "sons": {}}, decisoes=decisoes)
    acervo = json.loads((tmp_path / "indice" / "acervo.json").read_text(encoding="utf-8"))
    assert relatorio["erros"] == []
    assert [i["id"] for i in acervo["itens"]] == ["palavra:pt-BR:p1", "palavra:pt-BR:p2"]
    assert acervo["itens"][0]["revisao"]["humana"] == "aprovada"


def test_aprovacao_so_vale_para_o_conteudo_que_foi_revisado():
    revisado = som(2)
    decisao = {"som:freesound:2": {"humana": "aprovada", "por": "Victor", "em": "2026-11-12", "impressao": impressao(revisado)}}
    # o pipeline rodou de novo e o texto do item mudou depois da revisão
    trocado = {**revisado, "texto_humano": "Outro texto | outra, coisa, diferente"}
    itens, avisos = aplicar_decisoes([trocado], decisao)
    assert itens[0]["revisao"]["humana"] == "pendente"
    assert any("mudou depois da revisão" in a for a in avisos)


def test_aprovacao_sem_impressao_nao_vale():
    itens, avisos = aplicar_decisoes([som(2)], {"som:freesound:2": {"humana": "aprovada", "por": "Victor", "em": "2026-11-12"}})
    assert itens[0]["revisao"]["humana"] == "pendente" and avisos


def test_reprovacao_vale_mesmo_se_o_item_mudou():
    # Reprovar é a decisão segura: um item reprovado não volta só porque o texto mudou.
    itens, _ = aplicar_decisoes([{**som(2), "texto_humano": "mudou"}], {"som:freesound:2": {"humana": "reprovada", "por": "V", "em": "2026-11-12", "impressao": "velha"}})
    assert itens[0]["revisao"]["humana"] == "reprovada"


def test_impressao_muda_com_texto_construto_e_arquivo(tmp_path):
    base = som(2)
    assert impressao(base) == impressao(dict(base))
    assert impressao(base) != impressao({**base, "rotulo": "outro"})
    assert impressao(base) != impressao({**base, "construtos": ["luto"]})
    (tmp_path / "midia" / "sons").mkdir(parents=True)
    arquivo = tmp_path / "midia" / "sons" / "fs-2.mp3"
    arquivo.write_bytes(b"primeiro")
    antes = impressao(base, raiz_da_midia=tmp_path)
    arquivo.write_bytes(b"segundo")
    assert impressao(base, raiz_da_midia=tmp_path) != antes


def test_folha_grava_a_impressao_de_cada_item(tmp_path):
    item = som(2)
    gerar_folha([item], tmp_path)
    pagina = (tmp_path / "index.html").read_text(encoding="utf-8")
    assert f'data-impressao="{impressao(item)}"' in pagina
    assert "impressao: a.dataset.impressao" in pagina


def test_folha_nao_remarca_aprovacao_de_item_que_mudou(tmp_path):
    item = som(2)
    antiga = {"som:freesound:2": {"humana": "aprovada", "por": "Victor", "em": "2026-11-12", "impressao": "impressao-do-conteudo-antigo"}}
    gerar_folha([item], tmp_path, antiga)
    pagina = (tmp_path / "index.html").read_text(encoding="utf-8")
    # a regra está no script da página: só pré-marca quando a impressão guardada é a do item de agora
    assert "d.impressao === a.dataset.impressao" in pagina
    assert "Este item mudou desde a sua revisão" in pagina
