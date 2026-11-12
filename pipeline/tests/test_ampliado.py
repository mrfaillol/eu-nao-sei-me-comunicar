from acervo.ampliado import TETO_POR_TEXTO, limitar_series


def _item(n: int, texto: str) -> dict:
    return {"id": f"pintura:cma:{n:04d}", "tipo": "pintura", "texto_humano": texto}


def test_serie_com_o_mesmo_texto_fica_no_teto():
    # Um livro encadernado tem centenas de páginas com a mesma descrição da curadoria.
    serie = [_item(n, "Uma página do mesmo livro.") for n in range(40)]
    ficam = limitar_series(serie, teto=5)
    assert [i["id"] for i in ficam] == [f"pintura:cma:{n:04d}" for n in range(5)]


def test_textos_diferentes_nao_disputam_o_mesmo_teto():
    itens = [_item(1, "A"), _item(2, "B"), _item(3, "A"), _item(4, "C")]
    assert limitar_series(itens, teto=1) == [_item(1, "A"), _item(2, "B"), _item(4, "C")]


def test_a_escolha_nao_depende_da_ordem_de_chegada():
    serie = [_item(n, "Mesmo texto.") for n in (9, 3, 7, 1)]
    assert [i["id"] for i in limitar_series(serie, teto=2)] == ["pintura:cma:0001", "pintura:cma:0003"]


def test_o_teto_padrao_do_acervo_e_doze():
    assert TETO_POR_TEXTO == 12
    assert len(limitar_series([_item(n, "Mesmo texto.") for n in range(30)])) == 12


def test_imagem_em_tira_fica_fora():
    # Fragmentos de tecido chegam a 75 de largura para 1 de altura: na moldura viram um risco.
    from acervo.ampliado import proporcao_serve

    assert proporcao_serve(900, 300) and proporcao_serve(300, 900) and proporcao_serve(800, 800)
    assert not proporcao_serve(901, 300)
    assert not proporcao_serve(300, 901)
    assert not proporcao_serve(0, 500) and not proporcao_serve(500, 0)
