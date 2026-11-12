"""Anotação automática do acervo ampliado.

O acervo conferido tem anotação lida item a item. O ampliado tem milhares de itens, e a anotação
dele é por léxico: um construto só entra quando uma pista do léxico está escrita, por uma pessoa,
no texto do item. O trecho que casou é guardado junto, para qualquer um conferir.

Nada aqui interpreta a imagem nem o som. Item cujo texto não traz pista fica fora do acervo.
"""
from __future__ import annotations

import re
from functools import lru_cache

MAXIMO_DE_CONSTRUTOS = 3


@lru_cache(maxsize=None)
def _padrao(pista: str) -> re.Pattern[str]:
    """Pista vira expressão regular de palavra inteira. Asterisco no fim aceita flexões."""
    flexiona = pista.endswith("*")
    corpo = r"\s+".join(re.escape(p) for p in pista.rstrip("*").split())
    return re.compile(rf"(?<![\w'’-]){corpo}{r'[\w-]*' if flexiona else ''}(?![\w-])", re.IGNORECASE)


def casa(pista: str, texto: str) -> str | None:
    """O trecho de `texto` que casa com a pista, como está escrito, ou None."""
    achado = _padrao(pista).search(texto)
    return achado.group(0) if achado else None


def anotar(texto: str, lexico: dict[str, list[str]]) -> list[dict]:
    """Construtos que o texto sustenta, do que tem mais pistas para o que tem menos, com o trecho literal.

    Empate fica na ordem do léxico. O teto é de três construtos por item, para um texto longo
    não puxar o acervo inteiro para os mesmos temas.
    """
    achados = []
    for ordem, (construto, pistas) in enumerate(lexico.items()):
        trechos = [t for t in (casa(p, texto) for p in pistas) if t]
        if trechos:
            achados.append((-len(trechos), ordem, {"construto": construto, "trecho": trechos[0], "pistas": len(trechos)}))
    return [a for _, _, a in sorted(achados, key=lambda x: (x[0], x[1]))][:MAXIMO_DE_CONSTRUTOS]


def classificar(texto: str, lexico: dict) -> dict:
    """Tema grave (a frase muda de tom e a ajuda ganha destaque) e exclusão (nudez e violência gráfica ficam fora)."""
    excluir = any(casa(p, texto) for p in lexico["excluir"])
    grave = not excluir and any(casa(p, texto) for p in lexico["grave"])
    return {"excluir": bool(excluir), "tema_sensivel": bool(grave)}
