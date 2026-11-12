"""Caixas que aparecem em outras passadas (640 px; rotação de 90 graus) e não existiam na passada nativa. Gera folha de contato."""
import json, sys
from pathlib import Path
import cv2, numpy as np
modelo, raiz, base, saida = sys.argv[1], Path(sys.argv[2]), json.loads(Path(sys.argv[3]).read_text()), Path(sys.argv[4])
det = cv2.FaceDetectorYN.create(modelo, "", (320, 320), 0.6, 0.3, 5000)
def detectar(img):
    a, l = img.shape[:2]; det.setInputSize((l, a)); _, r = det.detect(img)
    return [] if r is None else [(float(x[0]) / l, float(x[1]) / a, float(x[2]) / l, float(x[3]) / a, float(x[14])) for x in r]
def iou(p, q):
    x0, y0 = max(p[0], q[0]), max(p[1], q[1]); x1, y1 = min(p[0] + p[2], q[0] + q[2]), min(p[1] + p[3], q[1] + q[3])
    i = max(0, x1 - x0) * max(0, y1 - y0); return i / (p[2] * p[3] + q[2] * q[3] - i + 1e-12)
def desgira(c, rot):  # caixa normalizada na imagem girada -> na original
    x, y, w, h, s = c
    if rot == 90:  return (y, 1 - x - w, h, w, s)      # girada 90 horário
    if rot == 270: return (1 - y - h, x, h, w, s)      # girada 90 anti-horário
    return c
tiles, resumo = [], {"640": 0, "rot90": 0, "rot270": 0}
for chave, v in base.items():
    img = cv2.imread(str(raiz / f"{chave}.jpg")); a, l = img.shape[:2]
    nativas = [(r["caixa"]["x"], r["caixa"]["y"], r["caixa"]["w"], r["caixa"]["h"]) for r in v["rostos"]]
    f = 640 / max(a, l); red = cv2.resize(img, (round(l * f), round(a * f)), interpolation=cv2.INTER_AREA)
    passadas = [("640", detectar(red)),
                ("rot90", [desgira(c, 90) for c in detectar(cv2.rotate(red, cv2.ROTATE_90_CLOCKWISE))]),
                ("rot270", [desgira(c, 270) for c in detectar(cv2.rotate(red, cv2.ROTATE_90_COUNTERCLOCKWISE))])]
    vistas = list(nativas)
    for nome, cs in passadas:
        for c in cs:
            if any(iou(c, n) > 0.3 for n in vistas): continue
            vistas.append(c[:4]); resumo[nome] += 1
            x, y, w, h = int(c[0] * l), int(c[1] * a), int(c[2] * l), int(c[3] * a); m = int(1.2 * max(w, h))
            x0, y0, x1, y1 = max(0, x - m), max(0, y - m), min(l, x + w + m), min(a, y + h + m)
            rec = img[y0:y1, x0:x1].copy(); g = 200 / max(rec.shape[:2])
            rec = cv2.resize(rec, (max(1, int(rec.shape[1] * g)), max(1, int(rec.shape[0] * g))), interpolation=cv2.INTER_CUBIC)
            cv2.rectangle(rec, (int((x - x0) * g), int((y - y0) * g)), (int((x + w - x0) * g), int((y + h - y0) * g)), (0, 255, 0), 1)
            t = np.zeros((222, 200, 3), np.uint8); t[: rec.shape[0], : rec.shape[1]] = rec
            cv2.putText(t, f"{chave.split('/')[1]} {nome} {c[2]*100:.0f}% {c[4]:.2f}", (2, 216), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 255, 0), 1)
            tiles.append(t); print(chave, nome, f"larg {c[2]*100:.1f}% conf {c[4]:.2f}")
print(resumo, "total", len(tiles))
if tiles:
    while len(tiles) % 6: tiles.append(np.zeros((222, 200, 3), np.uint8))
    cv2.imwrite(str(saida), np.vstack([np.hstack(tiles[i:i + 6]) for i in range(0, len(tiles), 6)]), [cv2.IMWRITE_JPEG_QUALITY, 85])
