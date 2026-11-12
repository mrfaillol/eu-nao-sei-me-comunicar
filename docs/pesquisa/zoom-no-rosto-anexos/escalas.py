"""Detecção em várias resoluções de trabalho e com rotação. Uso: python -I escalas.py <modelo> <faces> <rostos.json>"""
import json, sys, statistics as st
from pathlib import Path
import cv2

modelo, raiz = sys.argv[1], Path(sys.argv[2]); base = json.loads(Path(sys.argv[3]).read_text())
det = cv2.FaceDetectorYN.create(modelo, "", (320, 320), 0.6, 0.3, 5000)

def detectar(img):
    a, l = img.shape[:2]; det.setInputSize((l, a)); _, r = det.detect(img)
    return [] if r is None else [(float(x[0]) / l, float(x[1]) / a, float(x[2]) / l, float(x[3]) / a, float(x[14])) for x in r]

def iou(p, q):
    x0, y0 = max(p[0], q[0]), max(p[1], q[1]); x1, y1 = min(p[0] + p[2], q[0] + q[2]), min(p[1] + p[3], q[1] + q[3])
    i = max(0, x1 - x0) * max(0, y1 - y0); return i / (p[2] * p[3] + q[2] * q[3] - i + 1e-12)

FP = {"retratos/128391": [4, 5], "retratos/150083": [2, 3], "outras/157147": [2]}  # rótulos da inspeção visual
for lado in (320, 480, 640, 0, 1350, 1800):
    com = {"retratos": 0, "outras": 0}; caixas = 0; confp = []; fp_vivos = 0; principal_ok = 0
    for chave, v in base.items():
        img = cv2.imread(str(raiz / f"{chave}.jpg")); a, l = img.shape[:2]
        if lado:
            f = lado / max(a, l)
            img = cv2.resize(img, (max(1, round(l * f)), max(1, round(a * f))), interpolation=cv2.INTER_AREA if f < 1 else cv2.INTER_CUBIC)
        rs = detectar(img); caixas += len(rs); g = chave.split("/")[0]; com[g] += bool(rs)
        if g == "retratos":
            pr = max(v["rostos"], key=lambda r: r["area_rel"])["caixa"]; pr = (pr["x"], pr["y"], pr["w"], pr["h"])
            m = [r for r in rs if iou(r, pr) > 0.4]
            if m: principal_ok += 1; confp.append(max(r[4] for r in m))
        for i in FP.get(chave, []):
            c = v["rostos"][i - 1]["caixa"]; c = (c["x"], c["y"], c["w"], c["h"])
            fp_vivos += any(iou(r, c) > 0.3 for r in rs)
    print(f"lado maior {lado or 'nativo(web)'}: retratos com rosto {com['retratos']}/40 | principal reencontrado {principal_ok}/40 (conf mediana {st.median(confp):.2f}, min {min(confp):.2f}) | outras com rosto {com['outras']}/40 | caixas {caixas} | falsos positivos rotulados ainda presentes {fp_vivos}/5")

print("\nCasos de rosto principal não detectado, por escala e rotação:")
for chave in ("outras/166508", "outras/156155", "outras/126722", "outras/167661", "outras/145923"):
    img0 = cv2.imread(str(raiz / f"{chave}.jpg")); a, l = img0.shape[:2]; linha = []
    for lado in (480, 0, 1800):
        img = img0 if not lado else cv2.resize(img0, (round(l * lado / max(a, l)), round(a * lado / max(a, l))), interpolation=cv2.INTER_AREA if lado < max(a, l) else cv2.INTER_CUBIC)
        for rot, cod in ((0, None), (90, cv2.ROTATE_90_CLOCKWISE), (270, cv2.ROTATE_90_COUNTERCLOCKWISE)):
            rs = detectar(img if cod is None else cv2.rotate(img, cod))
            linha.append(f"{lado or 'nat'}/{rot}°:{len(rs)}" + (f"(maior {max(r[2] for r in rs)*100:.0f}% conf {max(rs, key=lambda r: r[2]*r[3])[4]:.2f})" if rs else ""))
    print(" ", chave, " | ".join(linha))
