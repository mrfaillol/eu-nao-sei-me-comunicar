import json, glob, collections as C, sys
ents = {}
bad = 0
for p in glob.glob("wd/ent/r_*.json"):
    try: o = json.load(open(p))
    except Exception: bad += 1; continue
    ents.update(o.get("entities", {}))
print("arquivos invalidos:", bad, "entidades:", len(ents))
def vals(e, prop):
    out = []
    for c in e.get("claims", {}).get(prop, []):
        try: out.append(c["mainsnak"]["datavalue"]["value"]["id"])
        except Exception: pass
    return out
rows = {}
gen = C.Counter(); dep = C.Counter()
for q, e in ents.items():
    if "missing" in e: continue
    g = vals(e, "P136"); d = vals(e, "P180")
    sl = e.get("sitelinks", {})
    rows[q] = {"genre": g, "depicts": d, "enwiki": sl.get("enwiki", {}).get("title"), "ptwiki": sl.get("ptwiki", {}).get("title"), "zhwiki": sl.get("zhwiki", {}).get("title"), "commons": sl.get("commonswiki", {}).get("title"), "p18": bool(e.get("claims", {}).get("P18")), "p921": vals(e, "P921")}
    gen.update(set(g)); dep.update(set(d))
n = len(rows)
print("itens:", n)
print("com P136 genero:", sum(1 for r in rows.values() if r["genre"]), "| com P180 depicts:", sum(1 for r in rows.values() if r["depicts"]), "| com P18 imagem:", sum(1 for r in rows.values() if r["p18"]))
print("com artigo enwiki:", sum(1 for r in rows.values() if r["enwiki"]), "| ptwiki:", sum(1 for r in rows.values() if r["ptwiki"]), "| zhwiki:", sum(1 for r in rows.values() if r["zhwiki"]), "| categoria commons:", sum(1 for r in rows.values() if r["commons"]))
json.dump(rows, open("wd_rows.json", "w"))
json.dump({"genre": gen.most_common(40), "depicts": dep.most_common(120)}, open("wd_top.json", "w"))
need = [q for q, _ in gen.most_common(40)] + [q for q, _ in dep.most_common(110)]
open("wd_label_ids.txt", "w").write("\n".join(dict.fromkeys(need)))
print("QIDs de genero distintos:", len(gen), "| de depicts distintos:", len(dep))
