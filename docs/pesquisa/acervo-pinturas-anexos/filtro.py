import json, re, sys, collections as C, random
d = [x for x in json.load(open(sys.argv[1])) if (x.get("description") or "").strip()]
CATS = {
 "nudez_sexo": r"nud(?:e|es|ity)|naked|unclothed|undress\w*|disrob\w*|bare[- ]breasted|breasts?|bathers?|erotic\w*|sexual\w*|sensual\w*|lovemaking|courtesans?|concubines?|prostitut\w*|brothels?|odalisques?|seduc\w*|voluptuous|genital\w*|phallic|orgy|orgies",
 "violencia": r"kill\w*|murder\w*|slay\w*|slain|slaughter\w*|behead\w*|decapitat\w*|severed|martyr\w*|tortur\w*|execut(?:ed|ion|ions|ioner|ioners)|massacre\w*|battle\w*|warfare|wars?|warriors?|wound\w*|blood\w*|bleed\w*|stab\w*|flay\w*|flagellat\w*|scourg\w*|crucif\w*|assassin\w*|rape[sd]?|abduct\w*|violen\w*|brutal\w*|suicide\w*|strangl\w*|drown\w*|poison\w*|whipp\w*|devour\w*|dismember\w*",
 "morte": r"death\w*|dead|dying|die[sd]?|corpses?|cadaver\w*|skulls?|skeletons?|funer\w*|tombs?|graves?|burial\w*|entomb\w*|mourn\w*|lament\w*|piet[aà]|memento mori|deceased|hell|damned|demons?|plague\w*|famine",
}
FORTE = {
 "nudez_sexo": r"nud(?:e|es|ity)|naked|bare[- ]breasted|erotic\w*|sexual\w*|lovemaking|prostitut\w*|brothels?|genital\w*|phallic|orgy|orgies",
 "violencia": r"kill\w*|murder\w*|slay\w*|slain|slaughter\w*|behead\w*|decapitat\w*|severed|tortur\w*|massacre\w*|flay\w*|flagellat\w*|scourg\w*|crucif\w*|assassin\w*|rape[sd]?|suicide\w*|strangl\w*|dismember\w*|bleed\w*|blood(?:y|ied|shed)?",
 "morte": r"corpses?|cadaver\w*|skulls?|skeletons?|entomb\w*|piet[aà]|memento mori|dead (?:christ|body|bodies|child|man|woman)|dying",
}
def comp(dct): return {k: re.compile(r"(?<![A-Za-z])(?:%s)(?![A-Za-z])" % v, re.I) for k, v in dct.items()}
RA, RF = comp(CATS), comp(FORTE)
def scan(x, R, fields):
    out = {}
    for f in fields:
        t = x.get(f) or ""
        for k, r in R.items():
            m = r.findall(t)
            if m: out.setdefault(k, []).extend((f, w.lower()) for w in m)
    return out
def report(name, R, fields):
    hits = [(x, scan(x, R, fields)) for x in d]
    hits = [(x, h) for x, h in hits if h]
    c = C.Counter(k for _, h in hits for k in h)
    print("%s campos=%s: marcadas %d de %d (%.1f%%)" % (name, "+".join(fields), len(hits), len(d), 100*len(hits)/len(d)), dict(c))
    return hits
a_t = report("AMPLO", RA, ["title"])
a_td = report("AMPLO", RA, ["title", "description"])
a_all = report("AMPLO", RA, ["title", "description", "did_you_know"])
f_t = report("FORTE", RF, ["title"])
f_td = report("FORTE", RF, ["title", "description"])
f_all = report("FORTE", RF, ["title", "description", "did_you_know"])
print("\ntermos mais frequentes (AMPLO, titulo+descricao), por categoria:")
for k in CATS:
    c = C.Counter()
    for x, h in a_td:
        for w in {w for _, w in h.get(k, [])}: c[w] += 1
    print(" ", k, c.most_common(14))
print("\nmarcadas por departamento (AMPLO t+d):", C.Counter(x["department"] for x, _ in a_td).most_common(8))
ids_f = {x["id"] for x, _ in f_td}
only_amplo = [(x, h) for x, h in a_td if x["id"] not in ids_f]
print("so no amplo (termos ambiguos):", len(only_amplo))
json.dump({"amplo": [x["id"] for x, _ in a_td], "forte": sorted(ids_f)}, open(sys.argv[2], "w"))
def show(x, h):
    ws = sorted({"%s:%s" % (k, w) for k, v in h.items() for _, w in v})
    desc = x["description"].replace("\n", " ")
    # recorte em torno do primeiro termo
    first = None
    for k, r in RA.items():
        m = r.search(desc)
        if m and (first is None or m.start() < first.start()): first = m
    a = max(0, first.start() - 70) if first else 0
    print("- %s | %s | %s | %s\n    ...%s..." % (x["accession_number"], x["title"][:70], x.get("creation_date"), ",".join(ws)[:110], desc[a:a+190]))
random.seed(7)
print("\n== 12 exemplos FORTE (sorteio seed=7):")
for x, h in random.sample(f_td, 12): show(x, scan(x, RA, ["title", "description"]))
print("\n== 12 exemplos SO-AMPLO (sorteio seed=7), para estimar falso positivo:")
for x, h in random.sample(only_amplo, 12): show(x, h)
