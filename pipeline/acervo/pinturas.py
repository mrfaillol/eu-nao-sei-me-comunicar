"""Pinturas do Cleveland Museum of Art (CC0): seleção, texto de curadoria e cópia local.

O app nunca chama o museu em uso: a imagem é copiada, convertida para sRGB e servida junto do site.
Só o campo `description` entra como texto humano. O museu também publica descrições visuais geradas
por modelo, em outros campos (`images.annotation`); elas ficam de fora por regra do projeto.
"""
from __future__ import annotations

import html
import io
import json
import re
import time
import urllib.request
from pathlib import Path
from typing import Callable

from PIL import Image, ImageCms

from acervo.rede import abrir_com_recuo
from acervo.texto import limpar_texto  # noqa: F401  (reexportado: os testes e o CLI o importam daqui)

AGENTE = "art-index-probe/1.0"
RAIZ = Path(__file__).resolve().parents[2]
CACHE = RAIZ / "pipeline" / "cache"

# Cotas para 30 pinturas, na proporção 20/35/35/35/25 que o dossiê fechou para 150.
COTAS_POR_EPOCA = {"antes de 1400": 4, "1400-1599": 7, "1600-1799": 7, "1800-1899": 7, "1900+": 5}
TETO_POR_REGIAO = 6
PISO_DE_RETRATOS = 12
DESCRICAO_MINIMA = 200
ROTULO_MAXIMO = 120
PROPORCAO_MINIMA, PROPORCAO_MAXIMA = 0.5, 2.0

_SRGB = ImageCms.createProfile("sRGB")


def _ordem(candidata: dict) -> tuple[int, int]:
    return (-int(candidata["destaque_do_museu"] or 0), int(candidata["id_cma"]))


def selecionar(candidatas: list[dict], total: int = 30, aceita: Callable[[dict], bool] = lambda c: True) -> list[dict]:
    """Escolhe `total` pinturas com cota por época, teto por região e piso de retratos.

    A ordem é determinística: destaque do museu primeiro, depois id. `aceita` permite recusar uma
    candidata ao olhar a ficha (proporção, descrição curta); a vaga passa à seguinte da mesma época.
    """
    fator = total / sum(COTAS_POR_EPOCA.values())
    cotas = {epoca: round(n * fator) for epoca, n in COTAS_POR_EPOCA.items()}
    piso = round(PISO_DE_RETRATOS * fator)
    teto = max(1, round(TETO_POR_REGIAO * fator))

    fila = sorted(candidatas, key=_ordem)
    escolhidas: list[dict] = []
    por_epoca = {epoca: 0 for epoca in cotas}
    por_regiao: dict[str, int] = {}
    recusadas: set[str] = set()

    def tenta(candidata: dict) -> bool:
        epoca, regiao, ident = candidata["epoca"], candidata["regiao"], candidata["id_cma"]
        if ident in recusadas or any(c["id_cma"] == ident for c in escolhidas):
            return False
        if por_epoca.get(epoca, cotas.get(epoca, 0)) >= cotas.get(epoca, 0) or por_regiao.get(regiao, 0) >= teto:
            return False
        if not aceita(candidata):
            recusadas.add(ident)
            return False
        escolhidas.append(candidata)
        por_epoca[epoca] += 1
        por_regiao[regiao] = por_regiao.get(regiao, 0) + 1
        return True

    # Primeiro os retratos, para o zoom no rosto ter material; depois o resto das cotas.
    for candidata in fila:
        if sum("retrato" in c["generos_por_palavra"] for c in escolhidas) >= piso:
            break
        if "retrato" in candidata["generos_por_palavra"]:
            tenta(candidata)
    for candidata in fila:
        if len(escolhidas) >= total:
            break
        tenta(candidata)
    return escolhidas


def _para_srgb(imagem: Image.Image) -> Image.Image:
    """Converte para sRGB. 20 das 80 imagens medidas trazem Adobe RGB; sem converter, as cores saem erradas."""
    perfil = imagem.info.get("icc_profile")
    if imagem.mode not in ("RGB", "L"):
        imagem = imagem.convert("RGB")
    if perfil:
        origem = ImageCms.ImageCmsProfile(io.BytesIO(perfil))
        imagem = ImageCms.profileToProfile(imagem, origem, _SRGB, outputMode="RGB")
    return imagem.convert("RGB")


def gerar_copia(origem: Path, destino: Path, lado: int = 1600) -> dict:
    """Grava a cópia local em WebP, em sRGB, com o lado maior limitado a `lado`, sem ampliar."""
    with Image.open(origem) as aberta:
        imagem = _para_srgb(aberta)
    if max(imagem.size) > lado:
        imagem.thumbnail((lado, lado), Image.Resampling.LANCZOS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    imagem.save(destino, "WEBP", quality=80, method=6)
    return {"arquivo": f"midia/pinturas/{destino.name}", "largura": imagem.width, "altura": imagem.height}


def _autor(ficha: dict) -> str:
    criadores = ficha.get("creators") or []
    descricao = (criadores[0].get("description") or "") if criadores else ""
    return descricao.split(" (")[0].strip()


def para_item_pintura(ficha: dict, midia: dict) -> dict:
    """Item do acervo para a pintura. Os construtos entram depois, na anotação."""
    return {
        "id": f"pintura:cma:{ficha['id']}",
        "tipo": "pintura",
        "classe_semiotica": "icone",
        "idioma": None,
        # O título é de terceiros e vai para o prompt como rótulo: mesma limpeza do texto humano, com teto curto.
        "rotulo": limpar_texto(ficha["title"], limite=ROTULO_MAXIMO),
        "texto_humano": limpar_texto(ficha.get("description") or ""),
        "origem_do_texto": "curadoria",
        "construtos": [],
        "tema_sensivel": False,
        "afeto": {"metodo": "ausente"},
        "credito": {
            "autor": _autor(ficha),
            "linha": ficha["tombstone"],
            "fonte": "cma",
            "licenca": "CC0-1.0",
            "url": ficha["url"],
        },
        "revisao": {"humana": "pendente", "por": None, "em": None},
        "midia": midia,
        "rosto": None,
        "nitido": None,
        "sensivel": {"nudez": "nenhuma", "violencia": "nenhuma"},
    }


def buscar_ficha(id_cma: str, dormir: Callable[[float], None] = time.sleep) -> dict:
    """Ficha completa da obra na API aberta do museu, com cache em disco e 1 s entre chamadas."""
    arquivo = CACHE / "cma" / f"{id_cma}.json"
    if arquivo.exists():
        return json.loads(arquivo.read_text(encoding="utf-8"))
    pedido = urllib.request.Request(
        f"https://openaccess-api.clevelandart.org/api/artworks/{id_cma}", headers={"User-Agent": AGENTE}
    )
    with abrir_com_recuo(pedido, timeout=40, dormir=dormir) as resposta:
        ficha = json.load(resposta)["data"]
    arquivo.parent.mkdir(parents=True, exist_ok=True)
    arquivo.write_text(json.dumps(ficha, ensure_ascii=False), encoding="utf-8")
    dormir(1)
    return ficha


def ficha_serve(ficha: dict) -> bool:
    """Critérios que só a ficha responde: CC0, imagem de impressão, proporção e descrição de curadoria."""
    imagem = (ficha.get("images") or {}).get("print") or {}
    largura, altura = int(imagem.get("width") or 0), int(imagem.get("height") or 0)
    if ficha.get("share_license_status") != "CC0" or not imagem.get("url") or not largura or not altura:
        return False
    if not PROPORCAO_MINIMA <= largura / altura <= PROPORCAO_MAXIMA:
        return False
    return len(limpar_texto(ficha.get("description") or "")) >= DESCRICAO_MINIMA and bool(ficha.get("tombstone") and ficha.get("url"))


def baixar_print(ficha: dict, dormir: Callable[[float], None] = time.sleep) -> Path:
    """Baixa a imagem de impressão (3.400 px no lado maior) para o cache, uma vez."""
    destino = CACHE / "prints" / f"{ficha['id']}.jpg"
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    destino.parent.mkdir(parents=True, exist_ok=True)
    pedido = urllib.request.Request(ficha["images"]["print"]["url"], headers={"User-Agent": AGENTE})
    with abrir_com_recuo(pedido, timeout=120, dormir=dormir) as resposta:
        destino.write_bytes(resposta.read())
    dormir(1)
    return destino
