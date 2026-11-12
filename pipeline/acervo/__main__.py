"""Comandos do pipeline: uv run python -m acervo <comando>."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "pipeline" / "saida"


def gravar(nome: str, dado) -> Path:
    SAIDA.mkdir(parents=True, exist_ok=True)
    destino = SAIDA / nome
    destino.write_text(json.dumps(dado, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return destino


def cmd_sentidos(args) -> None:
    from acervo.glosas import listar_sentidos, sugerir_sentido

    sentidos = listar_sentidos(args.palavra, args.secao)
    sugestao = sugerir_sentido(sentidos)
    for i, texto in enumerate(sentidos):
        print(f"{'>' if i == sugestao else ' '} [{i}] {texto}")
    if not sentidos:
        print("sem definição nessa seção")


def cmd_palavras(args) -> None:
    from acervo.palavras import montar_palavras

    itens, descartadas = montar_palavras(args.por_idioma)
    gravar("palavras.json", itens)
    por_idioma = Counter(i["idioma"] for i in itens)
    com_norma = Counter(i["idioma"] for i in itens if i["afeto"]["metodo"] == "norma_direta")
    print(" ".join(f"{idioma}={por_idioma[idioma]}" for idioma in ("pt-BR", "en", "zh-CN")))
    print("com norma direta:", dict(com_norma))
    if descartadas:
        print("sem texto humano, fora:", ", ".join(descartadas))


def main() -> None:
    parser = argparse.ArgumentParser(prog="acervo")
    sub = parser.add_subparsers(dest="comando", required=True)

    p = sub.add_parser("sentidos", help="lista as definições de uma palavra no Wiktionary")
    p.add_argument("palavra")
    p.add_argument("secao", help="pt ou en")
    p.set_defaults(func=cmd_sentidos)

    p = sub.add_parser("palavras", help="monta pipeline/saida/palavras.json")
    p.add_argument("--por-idioma", type=int, default=30)
    p.set_defaults(func=cmd_palavras)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
