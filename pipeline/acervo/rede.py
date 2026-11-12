"""Chamada de rede com paciência: erro passageiro espera e tenta de novo.

Medido em 12/Nov/2026: o Wiktionary devolveu 429 na 25ª consulta e a API do Cleveland Museum of Art
devolveu 522 no meio de uma rodada. Sem recuo, um erro desses derruba o comando inteiro.
"""
from __future__ import annotations

import time
import urllib.error
import urllib.request
from typing import Callable

TENTATIVAS = 4
PASSAGEIROS = {408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524}


def abrir_com_recuo(
    pedido: urllib.request.Request,
    timeout: float = 40,
    abrir: Callable = urllib.request.urlopen,
    dormir: Callable[[float], None] = time.sleep,
):
    """Abre o pedido. Em erro passageiro espera o Retry-After do servidor, ou 5, 10, 20 s, e repete até 4 vezes."""
    for tentativa in range(TENTATIVAS):
        ultima = tentativa == TENTATIVAS - 1
        try:
            return abrir(pedido, timeout=timeout)
        except urllib.error.HTTPError as erro:
            if erro.code not in PASSAGEIROS or ultima:
                raise
            pedido_do_servidor = str((erro.headers or {}).get("Retry-After", ""))
            dormir(int(pedido_do_servidor) if pedido_do_servidor.isdigit() else 5 * 2**tentativa)
        except (urllib.error.URLError, TimeoutError):
            if ultima:
                raise
            dormir(5 * 2**tentativa)
