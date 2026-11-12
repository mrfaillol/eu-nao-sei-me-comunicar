

def test_a_glosa_de_zheng_vale_para_qualquer_linha_do_arquivo():
    # 高兴 tem valência importada de Xu et al. (2022): a linha fica fora das normas, mas a glosa é do arquivo de Zheng.
    from acervo.afeto import glosa_zheng, linha_zheng

    assert linha_zheng("高兴") is None
    assert glosa_zheng("高兴") == "happy"
    assert glosa_zheng("孤单") == "lonely"
    assert glosa_zheng("palavra-que-não-existe") is None
