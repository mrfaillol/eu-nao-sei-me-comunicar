import csv, sys, collections as C, statistics as st, re, json
csv.field_size_limit(10**9)
objs = {}
with open(sys.argv[1], newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        objs[r["objectid"]] = r
print("objetos:", len(objs))
print("classification:", C.Counter(r["classification"] for r in objs.values()).most_common(8))
paint = {k: r for k, r in objs.items() if r["classification"] == "Painting"}
print("pinturas:", len(paint), "com wikidataid:", sum(1 for r in paint.values() if r["wikidataid"].strip()))
imgs = []
with open(sys.argv[2], newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        imgs.append(r)
print("imagens publicadas:", len(imgs), "openaccess:", C.Counter(r["openaccess"] for r in imgs).most_common(4), "viewtype:", C.Counter(r["viewtype"] for r in imgs).most_common(4))
has_alt = [r for r in imgs if r["assistivetext"].strip()]
print("imagens com assistivetext:", len(has_alt))
pi = [r for r in imgs if r["depictstmsobjectid"] in paint and r["viewtype"] == "primary"]
print("imagens primarias de pinturas:", len(pi), "objetos distintos:", len({r["depictstmsobjectid"] for r in pi}))
pio = [r for r in pi if r["openaccess"] == "1"]
print("  open access:", len(pio))
pia = [r for r in pio if r["assistivetext"].strip()]
print("  open access + assistivetext:", len(pia))
L = [len(r["assistivetext"]) for r in pia]
if L: print("  len assistivetext min/med/max:", min(L), st.median(L), max(L), ">=200:", sum(1 for x in L if x >= 200))
starts = C.Counter(" ".join(r["assistivetext"].split()[:3]) for r in pia)
print("  inicios mais comuns:", starts.most_common(8))
allstarts = C.Counter(" ".join(r["assistivetext"].split()[:3]) for r in has_alt)
print("inicios (todas as imagens com alt):", allstarts.most_common(5))
shows = [r for r in pia if re.match(r"\s*(The|This) (image|painting|artwork|picture) (shows|depicts|features|is)", r["assistivetext"])]
print("  pinturas OA cujo alt comeca com 'The/This image|painting shows/depicts...':", len(shows))
other = [r for r in pia if r not in shows]
print("  demais:", len(other))
mod = C.Counter(r["modified"][:7] for r in pia)
print("  modified (ano-mes) top:", mod.most_common(6))
dims = [max(int(r["width"] or 0), int(r["height"] or 0)) for r in pia]
print("  lado maior px min/med/max:", min(dims), st.median(dims), max(dims))
import random; random.seed(3)
for r in random.sample(shows, 2) + random.sample(other, min(4, len(other))):
    o = paint[r["depictstmsobjectid"]]
    print("\n -", o["accessionnum"], "|", o["title"][:60], "|", o["displaydate"], "|", o["attribution"][:40], "| mod", r["modified"][:10], "\n   ", r["assistivetext"][:420].replace("\n", " "))
def sec(r):
    try: y = int(r["beginyear"])
    except: return "sem data"
    return "antes de 1400" if y < 1400 else "1400-1599" if y < 1600 else "1600-1799" if y < 1800 else "1800-1899" if y < 1900 else "1900+"
print("\nepoca das pinturas OA com alt:", C.Counter(sec(paint[r["depictstmsobjectid"]]) for r in pia).most_common())
json.dump([{"objectid": r["depictstmsobjectid"], "acc": paint[r["depictstmsobjectid"]]["accessionnum"], "title": paint[r["depictstmsobjectid"]]["title"], "iiif": r["iiifurl"], "alt": r["assistivetext"], "w": r["width"], "h": r["height"], "wikidata": paint[r["depictstmsobjectid"]]["wikidataid"]} for r in pia], open(sys.argv[3], "w"))
