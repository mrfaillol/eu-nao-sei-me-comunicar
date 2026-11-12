import json, sys
def walk(o, out):
    if isinstance(o, dict):
        if o.get("type") == "LinguisticObject" and isinstance(o.get("content"), str):
            langs = ",".join((l.get("id", "").rsplit("/", 1)[-1]) for l in o.get("language", []) if isinstance(l, dict))
            cls = ",".join((c.get("id", "").rsplit("/", 1)[-1]) for c in o.get("classified_as", []) if isinstance(c, dict))
            out.append((cls, langs, o["content"]))
        for v in o.values(): walk(v, out)
    elif isinstance(o, list):
        for v in o: walk(v, out)
for p in sys.argv[1:]:
    try: o = json.load(open(p))
    except Exception as e: print(p, "erro", e); continue
    out = []; walk(o, out)
    longs = sorted(out, key=lambda t: -len(t[2]))[:3]
    title = next((n.get("content") for n in o.get("identified_by", []) if n.get("type") == "Name"), "?")
    print(p.rsplit("/",1)[-1], "|", str(title)[:60], "| textos:", len(out))
    for cls, lang, txt in longs: print("    len=%d aat=%s lang=%s :: %s" % (len(txt), cls, lang, txt[:200].replace("\n", " ")))
    subj = [s.get("id") for s in (o.get("shows") or [])][:2] + [s.get("id") for s in (o.get("subject_of") or [])][:3]
    print("    shows/subject_of:", subj)
