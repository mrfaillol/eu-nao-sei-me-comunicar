"""Chamadas de rede do pipeline: erro passageiro espera e tenta de novo; erro definitivo sobe na hora."""
import io
import urllib.error

import pytest

from acervo.rede import abrir_com_recuo


def pedido():
    import urllib.request

    return urllib.request.Request("https://exemplo.invalid/x")


def falha(codigo, cabecalhos=None):
    return urllib.error.HTTPError("https://exemplo.invalid/x", codigo, "erro", cabecalhos or {}, None)


def test_erro_passageiro_espera_e_tenta_de_novo():
    chamadas, esperas = [], []

    def abrir(p, timeout):
        chamadas.append(1)
        if len(chamadas) < 3:
            raise falha(522)
        return io.BytesIO(b"ok")

    assert abrir_com_recuo(pedido(), abrir=abrir, dormir=esperas.append).read() == b"ok"
    assert len(chamadas) == 3
    assert esperas == [5, 10]  # recuo crescente


def test_respeita_o_retry_after_do_servidor():
    esperas = []
    respostas = iter([falha(429, {"Retry-After": "7"}), io.BytesIO(b"ok")])

    def abrir(p, timeout):
        r = next(respostas)
        if isinstance(r, Exception):
            raise r
        return r

    abrir_com_recuo(pedido(), abrir=abrir, dormir=esperas.append)
    assert esperas == [7]


def test_erro_definitivo_sobe_sem_tentar_de_novo():
    chamadas = []

    def abrir(p, timeout):
        chamadas.append(1)
        raise falha(404)

    with pytest.raises(urllib.error.HTTPError):
        abrir_com_recuo(pedido(), abrir=abrir, dormir=lambda s: None)
    assert len(chamadas) == 1


def test_desiste_depois_de_quatro_tentativas():
    chamadas = []

    def abrir(p, timeout):
        chamadas.append(1)
        raise urllib.error.URLError("sem rede")

    with pytest.raises(urllib.error.URLError):
        abrir_com_recuo(pedido(), abrir=abrir, dormir=lambda s: None)
    assert len(chamadas) == 4
