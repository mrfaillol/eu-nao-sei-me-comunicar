import json, sys, statistics as st
d = json.load(open(sys.argv[1]))
print("total", len(d), "ids unicos", len({x["id"] for x in d}))
desc = [x for x in d if (x.get("description") or "").strip()]
print("com description", len(desc))
def q(v, p):
    v = sorted(v); return v[min(len(v)-1, int(len(v)*p))]
for name, pop in (("todas", d), ("com_desc", desc)):
    for k in ("web", "print", "full"):
        allim = [x["images"].get(k) for x in pop if x.get("images") and x["images"].get(k) and x["images"][k].get("url")]
        im = [i for i in allim if str(i.get("width") or "").isdigit() and str(i.get("height") or "").isdigit() and str(i.get("filesize") or "").isdigit()]
        print(name, k, "com url", len(allim), "sem dimensao numerica", len(allim) - len(im))
        if not im:
            print(name, k, "nenhuma"); continue
        long_ = [max(int(i["width"]), int(i["height"])) for i in im]
        short = [min(int(i["width"]), int(i["height"])) for i in im]
        fs = [int(i["filesize"]) for i in im]
        ext = {}
        for i in im:
            e = i["url"].rsplit(".", 1)[-1].lower(); ext[e] = ext.get(e, 0) + 1
        print(name, k, "n=%d" % len(im), "lado_maior min/p10/med/p90/max=%d/%d/%d/%d/%d" % (min(long_), q(long_, .1), st.median(long_), q(long_, .9), max(long_)),
              "lado_menor med=%d" % st.median(short),
              "MB min/med/p90/max=%.2f/%.2f/%.2f/%.2f" % (min(fs)/1e6, st.median(fs)/1e6, q(fs, .9)/1e6, max(fs)/1e6), "ext", ext)
    # lado maior do print exatamente 3400?
    pr = [x["images"]["print"] for x in pop if x.get("images") and x["images"].get("print") and x["images"]["print"].get("url") and str(x["images"]["print"].get("width") or "").isdigit() and str(x["images"]["print"].get("height") or "").isdigit()]
    eq = sum(1 for i in pr if max(int(i["width"]), int(i["height"])) == 3400)
    print(name, "print com lado maior == 3400:", eq, "de", len(pr))
    lt2000 = sum(1 for i in pr if max(int(i["width"]), int(i["height"])) < 2000)
    print(name, "print com lado maior < 2000:", lt2000)
# padrao de url
import re
pat = re.compile(r"^https://openaccess-cdn\.clevelandart\.org/([^/]+)/\1_(web|print|full)\.(jpg|tif)$")
bad = 0; tot = 0; hosts = {}
for x in d:
    for k in ("web", "print", "full"):
        i = (x.get("images") or {}).get(k)
        if i and i.get("url"):
            tot += 1
            h = i["url"].split("/")[2]; hosts[h] = hosts.get(h, 0) + 1
            if not pat.match(i["url"]): bad += 1
print("urls", tot, "fora do padrao accession/accession_tipo.ext:", bad, hosts)
# quantas urls usam accession_number do registro
mism = sum(1 for x in d if x.get("images") and x["images"].get("web") and x["images"]["web"].get("url") and ("/" + x["accession_number"] + "/") not in x["images"]["web"]["url"])
print("web url sem o accession_number do registro:", mism)
