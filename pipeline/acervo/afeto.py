"""Afeto por norma direta: o número só entra quando a própria palavra foi avaliada por pessoas.

Fontes embarcáveis (docs/pesquisa/dossie.md, 1.3):
- Glasgow Norms (Scott et al., 2019), inglês, CC BY 4.0. Valência e ativação de 1 a 9.
Fonte que NÃO entra como número: Zheng et al. (2023), mandarim, CC0. As 264 linhas de questionário
próprio trazem valência incoerente com o sentido da palavra (恨意, ódio, +1,22; 狂喜, êxtase, -0,96),
então daqui só sai a glosa em inglês dos autores. O teste test_zheng_tem_valencia_incoerente guarda
a evidência: se o conjunto for corrigido na origem, o teste falha e a decisão pode ser revista.
Português do Brasil não tem norma de uso livre. Mandarim e português ficam sem número.
"""
from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

DADOS = Path(__file__).resolve().parents[1] / "dados"


def normalizar_valencia(valor: float, minimo: float, maximo: float) -> float:
    """Leva a valência da escala original para -1..1."""
    return round(2 * (valor - minimo) / (maximo - minimo) - 1, 4)


def normalizar_ativacao(valor: float, minimo: float, maximo: float) -> float:
    """Leva a ativação da escala original para 0..1."""
    return round((valor - minimo) / (maximo - minimo), 4)


@lru_cache(maxsize=1)
def _glasgow() -> dict[str, tuple[float, float]]:
    """palavra -> (valência, ativação), nas escalas originais. Sentidos com parênteses ficam fora."""
    normas: dict[str, tuple[float, float]] = {}
    with open(DADOS / "glasgow-2019.csv", encoding="utf-8-sig", newline="") as arquivo:
        linhas = csv.reader(arquivo)
        cabecalho, _sub = next(linhas), next(linhas)
        arou, val = cabecalho.index("AROU"), cabecalho.index("VAL")
        for linha in linhas:
            palavra = linha[0].strip().lower()
            if not palavra or "(" in palavra:
                continue
            normas[palavra] = (float(linha[val]), float(linha[arou]))
    return normas


def norma_glasgow(palavra: str) -> dict | None:
    achado = _glasgow().get(palavra.strip().lower())
    if achado is None:
        return None
    valencia, ativacao = achado
    return {
        "metodo": "norma_direta",
        "valencia": normalizar_valencia(valencia, 1, 9),
        "ativacao": normalizar_ativacao(ativacao, 1, 9),
        "fonte": "glasgow-2019",
    }


@lru_cache(maxsize=1)
def linhas_zheng() -> list[dict]:
    """As linhas de Zheng et al. (2023) cujos números vieram de questionário próprio."""
    with open(DADOS / "zheng-2023.csv", encoding="utf-8-sig", newline="") as arquivo:
        return [
            {chave: (valor or "").strip() for chave, valor in linha.items()}
            for linha in csv.DictReader(arquivo)
            if (linha.get("VAL_ARO_SOURCE") or "").strip() == "Questionnaires"
        ]


def linha_zheng(palavra: str) -> dict | None:
    return next((l for l in linhas_zheng() if l["Item"] == palavra), None)
