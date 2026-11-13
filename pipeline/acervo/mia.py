"""Imagens do Minneapolis Institute of Art para o acervo ampliado.

Os dados do museu, com o texto de curadoria, são CC0. As fotos não: o museu as oferece para uso não
comercial e educativo. Por isso a imagem nunca é copiada para cá: o item aponta para o servidor do
museu, leva o nome dele no crédito e traz a licença escrita por extenso, que o site mostra junto.
Entrou em 12/Nov/2026, por decisão do dono do projeto, "com crédito e aviso".
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

from acervo.anotador import anotar, classificar
from acervo.rede import abrir_com_recuo
from acervo.texto import limpar_texto

RAIZ = Path(__file__).resolve().parents[2]
FICHAS = RAIZ / "pipeline" / "cache" / "mia"
AGENTE = "art-index-probe/1.0"
LICENCA_DO_MIA = "Non-commercial use (Mia image policy)"
# Só o que é imagem plana, como nas outras fontes. A classificação do museu pode trazer mais de um nome.
CLASSES_PLANAS = ("Paintings", "Prints", "Drawings", "Photographs", "Textiles", "Books", "Calligraphy", "Works on Paper")
LADO_MAIOR = 800
POR_PAGINA = 100


def endereco_da_imagem(ident: int) -> str:
    """A cópia de 800 px no servidor do museu. São sete servidores, escolhidos pelo resto do id."""
    return f"https://{ident % 7}.api.artsmia.org/{LADO_MAIOR}/{ident}.jpg"


def buscar_fichas_do_mia(dormir=time.sleep) -> list[dict]:
    """Obras em domínio público, com imagem válida e texto, das classes planas. Página em cache não gasta chamada."""
    FICHAS.mkdir(parents=True, exist_ok=True)
    fichas: dict[int, dict] = {}
    for classe in CLASSES_PLANAS:
        consulta = urllib.parse.quote(f'rights_type:"Public Domain" AND image:valid AND _exists_:text AND classification:"{classe}"')
        salto = 0
        while True:
            arquivo = FICHAS / f"{classe.replace(' ', '_')}-p{salto}.json"
            if not arquivo.exists():
                pedido = urllib.request.Request(f"https://search.artsmia.org/{consulta}?size={POR_PAGINA}&from={salto}", headers={"User-Agent": AGENTE})
                with abrir_com_recuo(pedido, timeout=90, dormir=dormir) as resposta:
                    arquivo.write_bytes(resposta.read())
                dormir(1.5)
            achados = json.loads(arquivo.read_text(encoding="utf-8")).get("hits", {}).get("hits", [])
            for achado in achados:
                ficha = achado.get("_source") or {}
                if "id" in ficha:
                    fichas[int(ficha["id"])] = ficha
            if len(achados) < POR_PAGINA or salto + POR_PAGINA >= 10_000:
                break
            salto += POR_PAGINA
    return [fichas[i] for i in sorted(fichas)]


def item_do_mia(ficha: dict, lexico: dict) -> tuple[dict, list[dict]] | None:
    """O item e as evidências da anotação, ou None quando a ficha não entra."""
    from acervo.ampliado import DESCRICAO_MINIMA, proporcao_serve

    classes = [c.strip() for c in str(ficha.get("classification") or "").split(",") if c.strip()]
    if not classes or any(c not in CLASSES_PLANAS for c in classes):
        return None
    if ficha.get("rights_type") != "Public Domain" or ficha.get("image") != "valid" or str(ficha.get("restricted") or "0") not in ("0", "False"):
        return None
    titulo = limpar_texto(ficha.get("title") or "", limite=120)
    texto = limpar_texto(ficha.get("text") or "")
    try:
        ident, largura, altura = int(ficha["id"]), int(ficha["image_width"]), int(ficha["image_height"])
    except (KeyError, TypeError, ValueError):
        return None
    if not titulo or len(texto) < DESCRICAO_MINIMA or not proporcao_serve(largura, altura):
        return None
    classe = classificar(f"{titulo}. {texto}", lexico)
    evidencias = anotar(texto, lexico["texto"])
    if classe["excluir"] or not evidencias:
        return None
    escala = LADO_MAIOR / max(largura, altura)
    autor = limpar_texto(ficha.get("artist") or "", limite=120)
    partes = [titulo, ficha.get("dated"), "Minneapolis Institute of Art", ficha.get("creditline"), ficha.get("accession_number")]
    item = {
        "id": f"pintura:mia:{ident}",
        "tipo": "pintura",
        "classe_semiotica": "icone",
        "idioma": None,
        "rotulo": titulo,
        "texto_humano": texto,
        "origem_do_texto": "curadoria",
        "construtos": [e["construto"] for e in evidencias],
        "tema_sensivel": classe["tema_sensivel"],
        "afeto": {"metodo": "ausente"},
        "credito": {
            "autor": autor,
            "linha": limpar_texto(", ".join(str(p).strip() for p in partes if p and str(p).strip()), limite=400),
            "fonte": "mia",
            "licenca": LICENCA_DO_MIA,
            "url": f"https://collections.artsmia.org/art/{ident}",
        },
        "revisao": {"humana": "pendente", "por": None, "em": None},
        "midia": {"arquivo": endereco_da_imagem(ident), "largura": max(1, round(largura * escala)), "altura": max(1, round(altura * escala))},
        "rosto": None,
        "nitido": None,
        "sensivel": {"nudez": "nenhuma", "violencia": "historica" if classe["tema_sensivel"] else "nenhuma"},
    }
    return item, evidencias
