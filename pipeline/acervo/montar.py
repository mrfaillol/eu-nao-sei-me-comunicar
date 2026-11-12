"""Monta o índice público a partir dos intermediários e das anotações.

Regras que este módulo faz valer:
- a anotação de pintura e de som cita um trecho literal do texto humano que a sustenta;
- construto só do glossário, e nunca termo de dimensão (esse vem de norma, não de anotação);
- nenhum item entra sem construto;
- seleção de três itens com um único construto precisa ser rara: a frase pede de 2 a 4 termos.
"""
from __future__ import annotations

import json
from collections import Counter
from math import comb
from pathlib import Path

from acervo.esquema import validar_item

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "pipeline" / "saida"
ANOTACOES = RAIZ / "pipeline" / "anotacoes"
VERSAO = "2026-11-12.1"
IDIOMAS = ("pt-BR", "en", "zh-CN")
TETO_DE_TRIOS_DE_UM_CONSTRUTO = 0.005


def _ler(caminho: Path):
    return json.loads(caminho.read_text(encoding="utf-8"))


def aplicar_anotacao(item: dict, anotacao: dict | None, construtos: set[str], dimensoes: set[str]) -> tuple[dict, list[str]]:
    """Devolve o item anotado e os erros da anotação."""
    ident = item["id"]
    if anotacao is None:
        return item, [f"{ident}: sem anotação"]
    erros = []
    escolhidos = anotacao.get("construtos", [])
    if not 1 <= len(escolhidos) <= 3:
        erros.append(f"{ident}: a anotação pede de 1 a 3 construtos")
    for c in escolhidos:
        if c in dimensoes:
            erros.append(f"{ident}: termo de dimensão não entra por anotação: {c}")
        elif c not in construtos:
            erros.append(f"{ident}: construto fora do glossário: {c}")
    trecho = anotacao.get("trecho", "")
    if not trecho or trecho not in item["texto_humano"]:
        erros.append(f"{ident}: o trecho não está no texto humano: {trecho!r}")
    anotado = {**item, "construtos": list(escolhidos), "tema_sensivel": bool(anotacao.get("tema_sensivel", False))}
    if item["tipo"] == "pintura" and "sensivel" in anotacao:
        anotado["sensivel"] = anotacao["sensivel"]
    return anotado, erros


def publico(item: dict) -> dict:
    """O item como vai para o site: sem as chaves de trabalho do pipeline, que começam com sublinhado."""
    return {chave: valor for chave, valor in item.items() if not chave.startswith("_")}


def fracao_de_trios_de_um_construto(itens: list[dict]) -> float:
    """Fração dos trios possíveis cujos três itens carregam o mesmo e único construto."""
    total = comb(len(itens), 3)
    if total == 0:
        return 0.0
    unicos = Counter(i["construtos"][0] for i in itens if len(i["construtos"]) == 1)
    return sum(comb(n, 3) for n in unicos.values()) / total


def validar_acervo(itens: list[dict]) -> list[str]:
    erros = []
    repetidos = [ident for ident, n in Counter(i["id"] for i in itens).items() if n > 1]
    erros += [f"id repetido: {ident}" for ident in repetidos]
    erros += [f"{i['id']}: sem construto" for i in itens if not i["construtos"]]
    # Numa sessão a pessoa vê pinturas, sons e as palavras de um idioma.
    for idioma in IDIOMAS:
        sessao = [i for i in itens if i["idioma"] in (None, idioma)]
        if not any(i["idioma"] == idioma for i in sessao):
            continue
        fracao = fracao_de_trios_de_um_construto(sessao)
        if fracao >= TETO_DE_TRIOS_DE_UM_CONSTRUTO:
            erros.append(f"{idioma}: {fracao:.2%} dos trios têm um só construto (teto de {TETO_DE_TRIOS_DE_UM_CONSTRUTO:.1%})")
    return erros


def montar(destino: Path, apenas_aprovados: bool = False, origem: Path = SAIDA, anotacoes: dict | None = None) -> dict:
    """Grava acervo.json, construtos.json e ajuda.json em `destino`. Com erro, não grava nada."""
    glossario = _ler(RAIZ / "data" / "construtos.json")
    fontes = _ler(RAIZ / "data" / "fontes.json")
    construtos = {c["id"] for c in glossario}
    dimensoes = {c["id"] for c in glossario if c["dimensao"]}
    if anotacoes is None:
        anotacoes = {"pinturas": _ler(ANOTACOES / "pinturas.json"), "sons": _ler(ANOTACOES / "sons.json")}

    itens, erros = [], []
    for nome in ("pinturas", "sons"):
        usadas = set()
        for item in _ler(origem / f"{nome}.json"):
            anotado, falhas = aplicar_anotacao(item, anotacoes[nome].get(item["id"]), construtos, dimensoes)
            usadas.add(item["id"])
            erros += falhas
            itens.append(publico(anotado))
        erros += [f"{ident}: anotação de item que não está em {nome}.json" for ident in anotacoes[nome] if ident not in usadas]
    itens += [publico(p) for p in _ler(origem / "palavras.json")]

    if apenas_aprovados:
        itens = [i for i in itens if i["revisao"]["humana"] == "aprovada"]
    for item in itens:
        erros += [f"{item['id']}: {e}" for e in validar_item(item, construtos - dimensoes, fontes)]
    erros += validar_acervo(itens)

    pendentes = sum(i["revisao"]["humana"] == "pendente" for i in itens)
    relatorio = {
        "por_tipo": {t: sum(i["tipo"] == t for i in itens) for t in ("pintura", "som", "palavra")},
        "pendentes": pendentes,
        "erros": erros,
    }
    if erros:
        return relatorio

    destino.mkdir(parents=True, exist_ok=True)
    acervo = {"versao": VERSAO, "demonstracao": pendentes > 0, "itens": itens}
    (destino / "acervo.json").write_text(json.dumps(acervo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (destino / "construtos.json").write_text(json.dumps(glossario, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (destino / "ajuda.json").write_text(json.dumps(_ler(RAIZ / "data" / "ajuda.json"), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return relatorio
