"""Porta em Python da função alvo() do navegador e corta a região final no arquivo de maior resolução."""
import json, sys
import cv2

def alvo(c, k=0.5, k_alt=0.8, s_max=8.0):
    s = max(1.0, min(k / c["w"], k_alt / c["h"], s_max))
    lim = lambda v: min(0.0, max(1.0 - s, v))
    tx, ty = lim(0.5 - s * (c["x"] + c["w"] / 2)), lim(0.5 - s * (c["y"] + c["h"] / 2))
    return {"s": s, "tx": tx, "ty": ty, "regiao": {"x": -tx / s, "y": -ty / s, "w": 1 / s, "h": 1 / s}}

caixa, origem, saida, larg_saida = json.loads(sys.argv[1]), sys.argv[2], sys.argv[3], int(sys.argv[4])
a = alvo(caixa); r = a["regiao"]; img = cv2.imread(origem); H, W = img.shape[:2]
x0, y0, x1, y1 = round(r["x"] * W), round(r["y"] * H), round((r["x"] + r["w"]) * W), round((r["y"] + r["h"]) * H)
rec = img[y0:y1, x0:x1]; alt_saida = round(larg_saida * rec.shape[0] / rec.shape[1])
cv2.imwrite(saida, cv2.resize(rec, (larg_saida, alt_saida), interpolation=cv2.INTER_AREA if rec.shape[1] > larg_saida else cv2.INTER_CUBIC), [cv2.IMWRITE_JPEG_QUALITY, 80])
print(json.dumps({"s": round(a["s"], 3), "tx": round(a["tx"], 4), "ty": round(a["ty"], 4), "regiao_px": [x0, y0, x1 - x0, y1 - y0], "saida": [larg_saida, alt_saida], "ampliacao": round(larg_saida / rec.shape[1], 2)}))
