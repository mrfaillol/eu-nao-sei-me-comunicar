"""Análise de rostos em pinturas: sinais por rosto, cópias anotadas e ROI de saliência.

Uso: python -I analise.py <modelo.onnx> <pasta_faces> <pasta_saida>
  <pasta_faces> contém as subpastas retratos/ e outras/.
Grava <pasta_saida>/rostos.json e cópias anotadas em <pasta_saida>/anotadas/<grupo>/.
"""
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np

LIMIAR, NMS, TOPK = 0.6, 0.3, 5000
LADO_ANOTADA = 640


def saliencia_sr(cinza: np.ndarray) -> np.ndarray:
    """Saliência por resíduo espectral (Hou & Zhang, 2007) em 64x64."""
    p = cv2.resize(cinza, (64, 64), interpolation=cv2.INTER_AREA).astype(np.float32)
    f = np.fft.fft2(p)
    logamp = np.log(np.abs(f) + 1e-8)
    fase = np.angle(f)
    resid = logamp - cv2.blur(logamp, (3, 3))
    sal = np.abs(np.fft.ifft2(np.exp(resid + 1j * fase))) ** 2
    sal = cv2.GaussianBlur(sal.astype(np.float32), (0, 0), 2.5)
    return sal / (sal.max() + 1e-12)


def roi_saliencia(cinza: np.ndarray, frac: float = 0.4):
    """Janela de frac x frac do quadro com maior soma de saliência."""
    sal = saliencia_sr(cinza)
    n = sal.shape[0]
    k = max(2, int(round(n * frac)))
    integ = cv2.integral(sal)
    melhor, pos = -1.0, (0, 0)
    for y in range(0, n - k + 1):
        for x in range(0, n - k + 1):
            s = integ[y + k, x + k] - integ[y, x + k] - integ[y + k, x] + integ[y, x]
            if s > melhor:
                melhor, pos = s, (x, y)
    total = float(sal.sum())
    return {
        "x": pos[0] / n, "y": pos[1] / n, "w": k / n, "h": k / n,
        "concentracao": float(melhor) / total,  # 0,16 = uniforme para janela de 40% x 40%
    }


def sinais(img, cinza, r):
    alt, larg = img.shape[:2]
    x, y, w, h = [float(v) for v in r[:4]]
    x0, y0 = max(0, int(round(x))), max(0, int(round(y)))
    x1, y1 = min(larg, int(round(x + w))), min(alt, int(round(y + h)))
    rec = cinza[y0:y1, x0:x1]
    if rec.size == 0:
        return None
    # nitidez: variância do Laplaciano no recorte nativo e no recorte reamostrado a 96x96
    lap_nat = float(cv2.Laplacian(rec, cv2.CV_64F).var())
    rec96 = cv2.resize(rec, (96, 96), interpolation=cv2.INTER_AREA if rec.shape[0] > 96 else cv2.INTER_CUBIC)
    lap_96 = float(cv2.Laplacian(rec96, cv2.CV_64F).var())
    # contraste: RMS dentro da caixa e diferença de luminância rosto x anel em volta
    rms = float(rec.std()) / 255.0
    ex0, ey0 = max(0, int(x0 - w / 2)), max(0, int(y0 - h / 2))
    ex1, ey1 = min(larg, int(x1 + w / 2)), min(alt, int(y1 + h / 2))
    anel = cinza[ey0:ey1, ex0:ex1].astype(np.float64)
    soma_anel = anel.sum() - rec.astype(np.float64).sum()
    n_anel = anel.size - rec.size
    fig_fundo = (float(rec.mean()) - soma_anel / n_anel) / 255.0 if n_anel > 0 else 0.0
    cx, cy = (x + w / 2) / larg, (y + h / 2) / alt
    dist = math.hypot(cx - 0.5, cy - 0.5) / math.hypot(0.5, 0.5)  # 0 = centro, 1 = canto
    # frontalidade pelos 5 pontos: desvio do nariz em relação ao meio dos olhos / distância entre olhos
    od, oe, nariz = r[4:6], r[6:8], r[8:10]
    d_olhos = math.hypot(float(od[0] - oe[0]), float(od[1] - oe[1]))
    desvio = abs(float(nariz[0]) - float(od[0] + oe[0]) / 2) / d_olhos if d_olhos > 0 else None
    return {
        "caixa": {"x": max(0.0, x) / larg, "y": max(0.0, y) / alt,
                  "w": (min(larg, x + w) - max(0.0, x)) / larg, "h": (min(alt, y + h) - max(0.0, y)) / alt},
        "px": [x0, y0, x1 - x0, y1 - y0],
        "area_rel": (w * h) / (larg * alt),
        "larg_rel": w / larg,
        "dist_centro": dist,
        "conf": float(r[14]),
        "lap_nat": lap_nat, "lap_96": lap_96,
        "contraste_rms": rms, "contraste_fig_fundo": fig_fundo,
        "desvio_nariz": desvio,
    }


def anotar(img, rostos, roi, destino: Path):
    alt, larg = img.shape[:2]
    esc = LADO_ANOTADA / max(alt, larg)
    base = cv2.resize(img, (max(1, int(larg * esc)), max(1, int(alt * esc))), interpolation=cv2.INTER_AREA)
    if base.shape[0] < 60:  # imagens muito achatadas: amplia para dar leitura
        f = 60 / base.shape[0]
        base = cv2.resize(base, (int(base.shape[1] * f), 60))
        esc *= f
    for i, r in enumerate(rostos, 1):
        x, y, w, h = [int(v * esc) for v in r["px"]]
        cv2.rectangle(base, (x, y), (x + w, y + h), (0, 255, 0), 2)
        cv2.putText(base, str(i), (x, max(14, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 4)
        cv2.putText(base, str(i), (x, max(14, y - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    if roi is not None:
        bh, bw = base.shape[:2]
        p0 = (int(roi["x"] * bw), int(roi["y"] * bh))
        p1 = (int((roi["x"] + roi["w"]) * bw), int((roi["y"] + roi["h"]) * bh))
        cv2.rectangle(base, p0, p1, (0, 220, 255), 2)
    # tira com os recortes dos rostos (até 6), 150 px de altura
    if rostos:
        recs = []
        for i, r in enumerate(rostos[:6], 1):
            x, y, w, h = r["px"]
            m = int(0.25 * max(w, h))
            c = img[max(0, y - m): y + h + m, max(0, x - m): x + w + m]
            f = 150 / c.shape[0]
            c = cv2.resize(c, (max(1, int(c.shape[1] * f)), 150), interpolation=cv2.INTER_CUBIC)
            cv2.putText(c, str(i), (4, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 4)
            cv2.putText(c, str(i), (4, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            recs.append(c)
        tira = np.hstack(recs)
        lw = max(base.shape[1], tira.shape[1])
        tela = np.zeros((base.shape[0] + 150 + 6, lw, 3), np.uint8)
        tela[: base.shape[0], : base.shape[1]] = base
        tela[base.shape[0] + 6:, : tira.shape[1]] = tira
        base = tela
    cv2.imwrite(str(destino), base, [cv2.IMWRITE_JPEG_QUALITY, 82])


def main() -> int:
    modelo, raiz, saida = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    det = cv2.FaceDetectorYN.create(modelo, "", (320, 320), LIMIAR, NMS, TOPK)
    resultado = {}
    for grupo in ("retratos", "outras"):
        (saida / "anotadas" / grupo).mkdir(parents=True, exist_ok=True)
        for arq in sorted((raiz / grupo).glob("*.jpg")):
            img = cv2.imread(str(arq))
            if img is None:
                continue
            alt, larg = img.shape[:2]
            cinza = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            det.setInputSize((larg, alt))
            _, brutos = det.detect(img)
            rostos = []
            if brutos is not None:
                for r in brutos:
                    s = sinais(img, cinza, r)
                    if s:
                        rostos.append(s)
            rostos.sort(key=lambda s: -s["area_rel"])  # numeração por área, só para leitura
            roi = roi_saliencia(cinza) if not rostos else None
            anotar(img, rostos, roi, saida / "anotadas" / grupo / arq.name)
            resultado[f"{grupo}/{arq.stem}"] = {"larg": larg, "alt": alt, "rostos": rostos, "roi": roi}
    (saida / "rostos.json").write_text(json.dumps(resultado, indent=1))
    for grupo in ("retratos", "outras"):
        itens = [v for k, v in resultado.items() if k.startswith(grupo)]
        print(grupo, "imagens:", len(itens), "| com 1+ rosto:", sum(1 for v in itens if v["rostos"]),
              "| com 2+:", sum(1 for v in itens if len(v["rostos"]) > 1),
              "| total de caixas:", sum(len(v["rostos"]) for v in itens))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
