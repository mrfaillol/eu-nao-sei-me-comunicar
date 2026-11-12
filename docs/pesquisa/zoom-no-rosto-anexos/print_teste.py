"""Arquivo de impressão (3400 px): detectar no tamanho cheio x em cópia reduzida; gerar recorte do rosto."""
import sys, time
from pathlib import Path
import cv2
modelo, pasta, saida = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]); saida.mkdir(exist_ok=True)
det = cv2.FaceDetectorYN.create(modelo, "", (320, 320), 0.6, 0.3, 5000)
def detectar(img):
    a, l = img.shape[:2]; det.setInputSize((l, a)); t = time.perf_counter(); _, r = det.detect(img); dt = (time.perf_counter() - t) * 1000
    return ([] if r is None else [(float(x[0]) / l, float(x[1]) / a, float(x[2]) / l, float(x[3]) / a, float(x[14])) for x in r]), dt
for arq in sorted(pasta.glob("*_print.jpg")):
    img = cv2.imread(str(arq)); a, l = img.shape[:2]
    cheio, t1 = detectar(img)
    linha = [f"{arq.name} {l}x{a} | cheio: {len(cheio)} caixas" + (f" (maior {max(c[2] for c in cheio)*l:.0f}px conf {max(cheio, key=lambda c: c[2]*c[3])[4]:.2f})" if cheio else "") + f" {t1:.0f} ms"]
    for lado in (900, 640):
        f = lado / max(a, l); red, t2 = detectar(cv2.resize(img, (round(l * f), round(a * f)), interpolation=cv2.INTER_AREA))
        linha.append(f"{lado}: {len(red)} caixas" + (f" (maior {max(c[2] for c in red)*100:.1f}% conf {max(red, key=lambda c: c[2]*c[3])[4]:.2f})" if red else "") + f" {t2:.0f} ms")
        if lado == 640 and red:
            x, y, w, h, _ = max(red, key=lambda c: c[2] * c[3])
            fw = w * l  # largura do rosto em px no arquivo de impressão
            # janela final: o rosto ocupa metade da largura -> região visível = 2 x largura do rosto, quadrada
            lado_reg = 2 * fw; cx, cy = (x + w / 2) * l, (y + h / 2) * a
            x0 = int(max(0, min(l - lado_reg, cx - lado_reg / 2))); y0 = int(max(0, min(a - lado_reg, cy - lado_reg / 2)))
            rec = img[y0:y0 + int(lado_reg), x0:x0 + int(lado_reg)]
            alvo = cv2.resize(rec, (840, 840), interpolation=cv2.INTER_AREA if rec.shape[1] > 840 else cv2.INTER_CUBIC)
            pj = saida / (arq.stem + "_rosto840.jpg"); pw = saida / (arq.stem + "_rosto840.webp")
            cv2.imwrite(str(pj), alvo, [cv2.IMWRITE_JPEG_QUALITY, 80]); cv2.imwrite(str(pw), alvo, [cv2.IMWRITE_WEBP_QUALITY, 80])
            b840 = saida / (arq.stem + "_base840.jpg"); fb = 840 / l
            cv2.imwrite(str(b840), cv2.resize(img, (840, round(a * fb)), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 80])
            linha.append(f"rosto no print: {fw:.0f}px de largura (precisa 420) | recorte 840x840: jpg {pj.stat().st_size//1024} KB, webp {pw.stat().st_size//1024} KB | base 840 de largura: {b840.stat().st_size//1024} KB | print inteiro: {arq.stat().st_size//1024} KB")
    print("\n  ".join(linha))
