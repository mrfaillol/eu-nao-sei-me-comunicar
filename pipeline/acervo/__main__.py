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


def _linhas(caminho: Path) -> list[str]:
    """Linhas úteis de um arquivo de lista: sem vazias, sem comentário de linha inteira ou de fim de linha."""
    uteis = (l.split("#", 1)[0].strip() for l in caminho.read_text(encoding="utf-8").splitlines())
    return [l for l in uteis if l]


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


def cmd_pinturas(args) -> None:
    import csv

    from acervo import pinturas as P

    with open(RAIZ / "pipeline" / "dados" / "candidatas-cma.csv", encoding="utf-8", newline="") as arquivo:
        candidatas = list(csv.DictReader(arquivo))

    fichas: dict[str, dict] = {}
    recusadas: list[str] = []
    excluidas = set(_linhas(RAIZ / "data" / "pinturas-excluidas.txt"))

    def aceita(candidata: dict) -> bool:
        if candidata["id_cma"] in excluidas:
            return False
        ficha = P.buscar_ficha(candidata["id_cma"])
        if P.ficha_serve(ficha):
            fichas[candidata["id_cma"]] = ficha
            return True
        recusadas.append(candidata["id_cma"])
        return False

    escolhidas = P.selecionar(candidatas, args.total, aceita)
    destino = RAIZ / "public" / "midia" / "pinturas"
    itens = []
    for n, candidata in enumerate(escolhidas, 1):
        ficha = fichas[candidata["id_cma"]]
        midia = P.gerar_copia(P.baixar_print(ficha), destino / f"cma-{ficha['id']}.webp")
        item = P.para_item_pintura(ficha, midia)
        # Chaves com sublinhado são do pipeline e não vão para o índice público.
        item["_curadoria"] = {k: candidata[k] for k in ("epoca", "regiao", "generos_por_palavra")}
        itens.append(item)
        print(f"{n:2d}/{len(escolhidas)} {ficha['id']} {ficha['title'][:60]}", flush=True)
    gravar("pinturas.json", itens)
    # Cópia e recorte de pintura que saiu da seleção não ficam no site.
    usadas = {Path(i["midia"]["arquivo"]).stem for i in itens}
    for pasta in ("pinturas", "rostos"):
        for sobra in (RAIZ / "public" / "midia" / pasta).glob("cma-*"):
            if sobra.stem not in usadas:
                sobra.unlink()
    total = sum((RAIZ / "public" / i["midia"]["arquivo"]).stat().st_size for i in itens)
    print(f"pinturas: {len(itens)} | recusadas pela ficha: {len(recusadas)} | cópias: {total / 1e6:.1f} MB")


def cmd_rostos(args) -> None:
    import cv2

    from acervo import rostos as R

    arquivo = SAIDA / "pinturas.json"
    itens = json.loads(arquivo.read_text(encoding="utf-8"))
    # A escolha de quem revisou a folha vence a pontuação automática.
    arquivo_de_decisoes = RAIZ / "pipeline" / "revisao" / "decisoes.json"
    decisoes = json.loads(arquivo_de_decisoes.read_text(encoding="utf-8")) if arquivo_de_decisoes.exists() else {}
    com_rosto = 0
    for item in itens:
        ident = item["id"].rsplit(":", 1)[-1]
        print_ = RAIZ / "pipeline" / "cache" / "prints" / f"{ident}.jpg"
        imagem = cv2.imread(str(print_))
        # Os sinais são medidos numa cópia de até 1.600 px; a detecção reduz por conta própria.
        altura, largura = imagem.shape[:2]
        fator = min(1.0, 1600 / max(altura, largura))
        if fator < 1.0:
            imagem = cv2.resize(imagem, (round(largura * fator), round(altura * fator)), interpolation=cv2.INTER_AREA)
        rostos = [{**caixa, "sinais": R.sinais(imagem, caixa)} for caixa in R.detectar(imagem)]
        manual = decisoes.get(item["id"], {}).get("destaque_manual")
        if manual == "nenhum":
            destaque = None
        else:
            destaque = R.escolher_destaque([r["sinais"] for r in rostos], manual=manual if isinstance(manual, int) else None)
        # Todas as caixas ficam no intermediário, para a folha de revisão; o índice público leva só a escolhida.
        item["_rostos"], item["_destaque"] = rostos, destaque
        if destaque is None:
            item["rosto"], item["nitido"] = None, None
        else:
            item["rosto"] = {k: rostos[destaque][k] for k in ("x", "y", "w", "h")}
            destino = RAIZ / "public" / "midia" / "rostos" / f"cma-{ident}.jpg"
            R.recortar_nitido(print_, item["rosto"], destino)
            item["nitido"] = f"midia/rostos/{destino.name}"
            com_rosto += 1
        print(f"{ident}: {len(rostos)} caixa(s), destaque {destaque}", flush=True)
    gravar("pinturas.json", itens)
    print(f"pinturas com rosto de destaque: {com_rosto} de {len(itens)}")


def cmd_sons(args) -> None:
    import time

    from acervo import sons as S

    termos = _linhas(RAIZ / "data" / "sons-termos.txt")
    barrados = set(_linhas(RAIZ / "data" / "sons-barrados.txt"))
    fonte = S.FonteOpenverse(RAIZ / "pipeline" / "cache" / "openverse")
    excluidos = set(_linhas(RAIZ / "data" / "sons-excluidos.txt"))
    por_termo = {
        termo: [r for r in S.filtrar(fonte.buscar(termo), barrados) if S.numero_no_freesound(r) not in excluidos]
        for termo in termos
    }
    vazios = [t for t, sons in por_termo.items() if not sons]
    itens = []
    for n, r in enumerate(S.escolher_sons(por_termo, args.total), 1):
        destino = RAIZ / "public" / "midia" / "sons" / f"fs-{S.numero_no_freesound(r)}.mp3"
        if destino.exists():  # recorte de uma rodada anterior: não baixa de novo
            midia = S.medir_recorte(destino)
        else:
            midia = S.gerar_recorte(r["url"], destino)
            time.sleep(1)
        item = S.para_item_som(r, midia)
        item["_termo"] = r["_termo"]
        itens.append(item)
        print(f"{n:2d} [{r['_termo']}] {item['rotulo'][:50]} ({item['midia']['duracao_ms']} ms)", flush=True)
    gravar("sons.json", itens)
    # Recorte que saiu da seleção não fica no site.
    usados = {Path(i["midia"]["arquivo"]).name for i in itens}
    for sobra in (RAIZ / "public" / "midia" / "sons").glob("fs-*.mp3"):
        if sobra.name not in usados:
            sobra.unlink()
    total = sum((RAIZ / "public" / i["midia"]["arquivo"]).stat().st_size for i in itens)
    print(f"sons: {len(itens)} | termos sem som aceito: {vazios or 'nenhum'} | recortes: {total / 1e6:.1f} MB")


def cmd_montar(args) -> None:
    import sys

    from acervo.montar import IDIOMAS, fracao_de_trios_de_um_construto, montar

    destino = RAIZ / "public" / "indice"
    r = montar(destino, apenas_aprovados=args.publicavel)
    t = r["por_tipo"]
    print(f"pintura {t['pintura']} | som {t['som']} | palavra {t['palavra']} | pendentes {r['pendentes']} | erros {len(r['erros'])}")
    for erro in r["erros"]:
        print(" -", erro)
    for aviso in r.get("avisos", []):
        print(" ! aviso:", aviso)
    if r["erros"]:
        sys.exit(1)
    itens = json.loads((destino / "acervo.json").read_text(encoding="utf-8"))["itens"]
    for idioma in IDIOMAS:
        sessao = [i for i in itens if i["idioma"] in (None, idioma)]
        print(f"{idioma}: {len(sessao)} itens na sessão, {fracao_de_trios_de_um_construto(sessao):.3%} dos trios com um só construto")


def cmd_revisao(args) -> None:
    from acervo import montar as M
    from acervo.revisao import gerar_folha

    glossario = M._ler(RAIZ / "data" / "construtos.json")
    anotacoes = {"pinturas": M._ler(M.ANOTACOES / "pinturas.json"), "sons": M._ler(M.ANOTACOES / "sons.json")}
    itens, erros = M.juntar_intermediarios(SAIDA, anotacoes, {c["id"] for c in glossario}, {c["id"] for c in glossario if c["dimensao"]})
    for erro in erros:
        print(" -", erro)
    decisoes = M._ler(M.DECISOES) if M.DECISOES.exists() else {}
    pagina = gerar_folha(itens, RAIZ / "revisao", decisoes)
    print(f"folha de revisão: {pagina} | itens: {len(itens)} | decisões já gravadas: {len(decisoes)}")


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

    p = sub.add_parser("pinturas", help="seleciona, baixa e converte as pinturas do CMA")
    p.add_argument("--total", type=int, default=30)
    p.set_defaults(func=cmd_pinturas)

    p = sub.add_parser("rostos", help="detecta o rosto de destaque e corta a camada nítida")
    p.set_defaults(func=cmd_rostos)

    p = sub.add_parser("sons", help="busca, filtra, baixa e normaliza os sons")
    p.add_argument("--total", type=int, default=30)
    p.set_defaults(func=cmd_sons)

    p = sub.add_parser("montar", help="monta public/indice a partir dos intermediários e das anotações")
    p.add_argument("--publicavel", action="store_true", help="só itens aprovados na revisão humana")
    p.set_defaults(func=cmd_montar)

    p = sub.add_parser("revisao", help="gera a folha de revisão humana em revisao/index.html")
    p.set_defaults(func=cmd_revisao)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
