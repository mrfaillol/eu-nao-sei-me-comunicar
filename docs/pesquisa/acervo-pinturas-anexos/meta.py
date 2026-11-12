import json, sys, collections as C
base = {x["id"]: x for x in json.load(open(sys.argv[1]))}
meta = {x["id"]: x for x in json.load(open(sys.argv[2]))}
print("ids iguais:", set(base) == set(meta))
allr = []
for i, b in base.items():
    r = dict(meta[i]); r.update({k: b[k] for k in ("description", "did_you_know", "images")}); allr.append(r)
json.dump(allr, open(sys.argv[3], "w"))
def cnt(pop, f, n=40):
    c = C.Counter(f(x) for x in pop)
    return c.most_common(n)
desc = [x for x in allr if (x.get("description") or "").strip()]
print("todas", len(allr), "com desc", len(desc))
print("share_license_status todas:", cnt(allr, lambda x: x.get("share_license_status")))
print("copyright nao nulo:", sum(1 for x in allr if x.get("copyright")), "image_credit nao nulo:", sum(1 for x in allr if x.get("image_credit")))
print("is_highlight todas/desc:", sum(1 for x in allr if x.get("is_highlight")), sum(1 for x in desc if x.get("is_highlight")))
print("artlens_description todas/desc:", sum(1 for x in allr if (x.get("artlens_description") or "").strip()), sum(1 for x in desc if (x.get("artlens_description") or "").strip()))
print("early_education_description todas:", sum(1 for x in allr if (x.get("early_education_description") or "").strip()))
print("wikidata link todas/desc:", sum(1 for x in allr if (x.get("external_resources") or {}).get("wikidata")), sum(1 for x in desc if (x.get("external_resources") or {}).get("wikidata")))
print("current_location nao nulo (em exposicao) desc:", sum(1 for x in desc if x.get("current_location")))
print("\ndepartment (com desc):")
for k, v in cnt(desc, lambda x: x.get("department")): print("  %5d  %s" % (v, k))
print("\ndepartment (todas):")
for k, v in cnt(allr, lambda x: x.get("department")): print("  %5d  %s" % (v, k))
print("\ncultura principal (com desc), top 25:")
for k, v in cnt(desc, lambda x: (x.get("culture") or ["?"])[0].split(",")[0], 25): print("  %5d  %s" % (v, k))
def sec(x):
    y = x.get("creation_date_earliest")
    if y is None: return "sem data"
    if y < 1400: return "antes de 1400"
    if y < 1600: return "1400-1599"
    if y < 1800: return "1600-1799"
    if y < 1900: return "1800-1899"
    return "1900+"
print("\nepoca (com desc):", cnt(desc, sec))
print("epoca (todas):", cnt(allr, sec))
print("\ntecnica top 15 (com desc):")
for k, v in cnt(desc, lambda x: (x.get("technique") or "?").lower()[:40], 15): print("  %5d  %s" % (v, k))
print("\nartists_tags:", cnt(desc, lambda x: tuple(x.get("artists_tags") or [])))
print("updated_at max/min:", max(x.get("updated_at") or "" for x in allr), min(x.get("updated_at") or "z" for x in allr))
