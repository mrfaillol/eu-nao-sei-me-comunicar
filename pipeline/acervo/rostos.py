"""Rosto de maior destaque de uma pintura: detecção, sinais por rosto e escolha.

Medições que moldam este módulo (docs/pesquisa/zoom-no-rosto.md):
- O YuNet foi treinado para rostos de cerca de 10 a 300 px. No arquivo de impressão cheio
  (3.400 px) ele achou 1 de 3 rostos; na cópia de 640 px, 3 de 3. Por isso a detecção roda em
  cópias reduzidas, em três escalas, e as caixas são unidas por sobreposição.
- A confiança do detector não separa rosto de falso positivo: um violino marcou 0,81.
- Caixa com menos de 3% da largura da pintura quase nunca é o rosto que uma pessoa apontaria.
"""
from __future__ import annotations

import io
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageCms

MODELO = Path(__file__).resolve().parents[1] / "modelos" / "face_detection_yunet_2023mar.onnx"
LIMIAR = 0.6
# Lado maior das cópias de trabalho: 640 acha o rosto de retrato, 900 os menores, 480 os closes.
LADOS = (640, 900, 480)
IOU_DE_UNIAO = 0.4
PISO_DE_LARGURA = 0.03

_SRGB = ImageCms.createProfile("sRGB")


@lru_cache(maxsize=1)
def _detector() -> cv2.FaceDetectorYN:
    # O OpenCV 5 imprime um aviso a cada criação do detector; um detector só, com o log em ERROR.
    cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)
    return cv2.FaceDetectorYN.create(str(MODELO), "", (320, 320), LIMIAR, 0.3, 5000)


def _iou(a: dict, b: dict) -> float:
    x0, y0 = max(a["x"], b["x"]), max(a["y"], b["y"])
    x1, y1 = min(a["x"] + a["w"], b["x"] + b["w"]), min(a["y"] + a["h"], b["y"] + b["h"])
    intersecao = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    uniao = a["w"] * a["h"] + b["w"] * b["h"] - intersecao
    return intersecao / uniao if uniao > 0 else 0.0


def detectar(imagem: np.ndarray) -> list[dict]:
    """Caixas de rosto em coordenadas normalizadas (0 a 1), da maior para a menor.

    Cada caixa: x, y (canto superior esquerdo), w, h, conf e pontos (olho direito, olho esquerdo,
    nariz e cantos da boca, como 10 números normalizados).
    """
    altura, largura = imagem.shape[:2]
    detector = _detector()
    achadas: list[dict] = []
    lados_usados: set[int] = set()

    for lado in LADOS:
        escala = min(1.0, lado / max(altura, largura))
        w, h = max(1, round(largura * escala)), max(1, round(altura * escala))
        if max(w, h) in lados_usados:  # imagem menor que o lado pedido: a mesma cópia de novo
            continue
        lados_usados.add(max(w, h))
        copia = imagem if escala == 1.0 else cv2.resize(imagem, (w, h), interpolation=cv2.INTER_AREA)
        detector.setInputSize((w, h))
        _, rostos = detector.detect(copia)
        for r in rostos if rostos is not None else []:
            x, y = max(0.0, float(r[0]) / w), max(0.0, float(r[1]) / h)
            achadas.append(
                {
                    "x": round(x, 4),
                    "y": round(y, 4),
                    "w": round(min(float(r[2]) / w, 1.0 - x), 4),
                    "h": round(min(float(r[3]) / h, 1.0 - y), 4),
                    "conf": round(float(r[14]), 4),
                    "pontos": [round(float(v) / (w if i % 2 == 0 else h), 4) for i, v in enumerate(r[4:14])],
                }
            )

    # União entre escalas: fica a caixa de maior confiança de cada grupo sobreposto.
    unidas: list[dict] = []
    for caixa in sorted(achadas, key=lambda c: -c["conf"]):
        if caixa["w"] > 0 and caixa["h"] > 0 and all(_iou(caixa, outra) < IOU_DE_UNIAO for outra in unidas):
            unidas.append(caixa)
    return sorted(unidas, key=lambda c: -(c["w"] * c["h"]))


def sinais(imagem: np.ndarray, caixa: dict) -> dict:
    """Os oito sinais de um rosto, como definidos em docs/pesquisa/zoom-no-rosto.md, seção (b)."""
    altura, largura = imagem.shape[:2]
    cinza = cv2.cvtColor(imagem, cv2.COLOR_BGR2GRAY) if imagem.ndim == 3 else imagem
    x0, y0 = int(caixa["x"] * largura), int(caixa["y"] * altura)
    x1, y1 = max(x0 + 1, int((caixa["x"] + caixa["w"]) * largura)), max(y0 + 1, int((caixa["y"] + caixa["h"]) * altura))
    recorte = cinza[y0:y1, x0:x1].astype(np.float64)

    # Anel em volta da caixa (a caixa ampliada 1,5 vez, menos a própria caixa), para figura e fundo.
    mx, my = (x1 - x0) // 4, (y1 - y0) // 4
    ax0, ay0, ax1, ay1 = max(0, x0 - mx), max(0, y0 - my), min(largura, x1 + mx), min(altura, y1 + my)
    ampliada = cinza[ay0:ay1, ax0:ax1].astype(np.float64)
    soma_anel = ampliada.sum() - recorte.sum()
    area_anel = ampliada.size - recorte.size
    media_anel = soma_anel / area_anel if area_anel > 0 else recorte.mean()

    cx, cy = (caixa["x"] + caixa["w"] / 2 - 0.5) * largura, (caixa["y"] + caixa["h"] / 2 - 0.5) * altura
    meia_diagonal = 0.5 * float(np.hypot(largura, altura))

    p = caixa["pontos"]
    olho_d, olho_e, nariz = (p[0] * largura, p[1] * altura), (p[2] * largura, p[3] * altura), (p[4] * largura, p[5] * altura)
    entre_olhos = float(np.hypot(olho_d[0] - olho_e[0], olho_d[1] - olho_e[1]))
    desvio_do_nariz = abs(nariz[0] - (olho_d[0] + olho_e[0]) / 2)

    return {
        "area": round(caixa["w"] * caixa["h"], 5),
        "larg_rel": caixa["w"],
        "dist_centro": round(float(np.hypot(cx, cy)) / meia_diagonal, 3),
        "conf": caixa["conf"],
        "nitidez_96": round(float(cv2.Laplacian(cv2.resize(recorte, (96, 96), interpolation=cv2.INTER_AREA), cv2.CV_64F).var()), 1),
        "contraste_rms": round(float(recorte.std()) / 255, 3),
        "figura_fundo": round(float(recorte.mean() - media_anel) / 255, 3),
        "frontal": round(desvio_do_nariz / entre_olhos, 2) if entre_olhos > 0 else 9.99,
    }


def pontuar_rosto(s: dict) -> float:
    """Nota de destaque de um rosto: quanto maior, mais ele é "o" rosto da pintura.

    `s` traz os sinais de um rosto: area, larg_rel, dist_centro (0 no centro do quadro, 1 no canto),
    conf, nitidez_96, contraste_rms, figura_fundo e frontal (0 = olhando de frente).
    """
    # TODO(human): escreva a fórmula de destaque. A regra provisória abaixo usa só a área.
    return s["area"]


def escolher_destaque(rostos: list[dict], piso_largura: float = PISO_DE_LARGURA, manual: int | None = None) -> int | None:
    """Índice do rosto de destaque em `rostos` (lista de sinais), ou None se não houver zoom a fazer.

    `manual` é a escolha de quem revisou a folha de contato e vence a pontuação.
    """
    if manual is not None:
        return manual if 0 <= manual < len(rostos) else None
    candidatos = [i for i, s in enumerate(rostos) if s["larg_rel"] >= piso_largura]
    if not candidatos:
        return None
    return max(candidatos, key=lambda i: pontuar_rosto(rostos[i]))


def alvo(caixa: dict, k: float = 0.5, k_alt: float = 0.8, s_max: float = 8.0) -> dict:
    """A mesma conta do navegador (src/ui/zoom.ts): escala e deslocamento que centram o rosto.

    Devolve também a região da pintura que fica visível depois do zoom, em fração da imagem.
    """
    s = max(1.0, min(k / caixa["w"], k_alt / caixa["h"], s_max))

    def limitar(v: float) -> float:  # a pintura sempre cobre a moldura
        return min(0.0, max(1.0 - s, v))

    tx = limitar(0.5 - s * (caixa["x"] + caixa["w"] / 2))
    ty = limitar(0.5 - s * (caixa["y"] + caixa["h"] / 2))
    return {"s": s, "tx": tx, "ty": ty, "regiao": {"x": -tx / s, "y": -ty / s, "w": 1 / s, "h": 1 / s}}


def recortar_nitido(print_: Path, caixa: dict, destino: Path, lado: int = 840) -> None:
    """Corta do arquivo de maior resolução a região que o zoom mostra, em sRGB, para a camada nítida."""
    regiao = alvo(caixa)["regiao"]
    with Image.open(print_) as aberta:
        perfil = aberta.info.get("icc_profile")
        imagem = aberta.convert("RGB")
    if perfil:
        imagem = ImageCms.profileToProfile(imagem, ImageCms.ImageCmsProfile(io.BytesIO(perfil)), _SRGB, outputMode="RGB")
    largura, altura = imagem.size
    recorte = imagem.crop(
        (
            round(regiao["x"] * largura),
            round(regiao["y"] * altura),
            round((regiao["x"] + regiao["w"]) * largura),
            round((regiao["y"] + regiao["h"]) * altura),
        )
    )
    if max(recorte.size) > lado:
        recorte.thumbnail((lado, lado), Image.Resampling.LANCZOS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    recorte.save(destino, "JPEG", quality=80)
