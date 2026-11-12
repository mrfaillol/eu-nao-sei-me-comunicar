import json, re, html, collections as C, statistics as st
allr = json.load(open("cma_join.json"))
f = json.load(open("filtro_ids.json")); amplo = set(f["amplo"]); forte = set(f["forte"])
tag = re.compile(r"<[^>]+>")
def clean(s): return re.sub(r"\s+", " ", html.unescape(tag.sub(" ", s or ""))).strip()
def num(v):
    try: return int(v)
    except Exception: return 0
def era(x):
    y = x.get("creation_date_earliest")
    if y is None: return "sem data"
    return "antes de 1400" if y < 1400 else "1400-1599" if y < 1600 else "1600-1799" if y < 1800 else "1800-1899" if y < 1900 else "1900+"
REG = {"Indian and Southeast Asian Art": "Índia e Sudeste Asiático", "Chinese Art": "China", "Japanese Art": "Japão", "Korean Art": "Coreia",
       "European Painting and Sculpture": "Europa até c. 1800", "Modern European Painting and Sculpture": "Europa moderna", "Medieval Art": "Europa medieval",
       "American Painting and Sculpture": "Estados Unidos"}
def reg(x): return REG.get(x.get("department"), "outros")
G = [("retrato", r"\bportraits?\b|\bself-portrait|\bsitter\b|\blikeness\b"),
     ("paisagem", r"\blandscapes?\b|\bmountains?\b|\briver\b|\bseascape|\bview of\b|\bforest\b|\bcoast\b|\bharbor\b"),
     ("natureza-morta", r"\bstill lifes?\b|\bstill-life\b|\bvase of\b|\bbouquet\b"),
     ("religiosa", r"\bchrist\b|\bvirgin\b|\bmadonna\b|\bsaints?\b|\bbuddha\b|\bbodhisattva\b|\bkrishna\b|\bvishnu\b|\bshiva\b|\bdeit(y|ies)\b|\baltarpiece\b|\bgospel|\bbiblical\b|\bquran\b|\bjain\b|\bdaoist\b"),
     ("mitologia/literatura", r"\bmytholog|\bvenus\b|\bapollo\b|\bdiana\b|\bcupid\b|\bramayana\b|\bmahabharata\b|\bepic\b|\btale of\b|\bpoem\b|\bfable\b|\bovid\b|\bhomer\b"),
     ("cena cotidiana", r"\bgenre\b|\bpeasants?\b|\bdaily life\b|\bmarket\b|\btavern\b|\binterior\b|\bfestival\b|\bdancers?\b|\bmusicians?\b"),
     ("animais/flores", r"\bbirds?\b|\bflowers?\b|\bhorses?\b|\btigers?\b|\bbamboo\b|\bplum\b|\blotus\b|\bcranes?\b|\binsects?\b")]
GR = [(n, re.compile(p, re.I)) for n, p in G]
def genres(x):
    t = x["title"] + " " + x["_d"]
    return [n for n, r in GR if r.search(t)] or ["sem gênero detectado"]
pool = allr
def step(name, fn, pool):
    new = [x for x in pool if fn(x)]
    print("%-58s %5d  (saem %d)" % (name, len(new), len(pool) - len(new)))
    return new
for x in allr:
    x["_d"] = clean(x.get("description")); im = x.get("images") or {}
    p = im.get("print") or {}; x["_pw"], x["_ph"] = num(p.get("width")), num(p.get("height")); x["_purl"] = p.get("url")
    x["_ratio"] = (max(x["_pw"], x["_ph"]) / min(x["_pw"], x["_ph"])) if min(x["_pw"], x["_ph"]) > 0 else 99
    x["_serie"] = ".".join(x["accession_number"].split(".")[:2])
print("%-58s %5d" % ("0. pinturas CC0 com imagem (API)", len(pool)))
pool = step("1. description não vazia", lambda x: x["_d"], pool)
print("    (só para comparar) description >= 200 sem limpar HTML:", sum(1 for x in pool if len(x.get("description") or "") >= 200))
pool = step("2. description >= 200 caracteres (HTML removido)", lambda x: len(x["_d"]) >= 200, pool)
pool = step("3. imagem print com URL e lado maior >= 2000 px", lambda x: x["_purl"] and max(x["_pw"], x["_ph"]) >= 2000, pool)
pool = step("4. título sem (verso)/caligrafia/página de texto", lambda x: not re.search(r"\(verso\)|calligraph|text page|colophon|illuminated page|page of text|text,|shamsa|frontispiece|binding|cover", x["title"], re.I), pool)
print("    distribuição da proporção (lado maior/menor) antes do corte: <=1.5: %d | 1.5-2.2: %d | 2.2-3: %d | >3: %d" % (
    sum(1 for x in pool if x["_ratio"] <= 1.5), sum(1 for x in pool if 1.5 < x["_ratio"] <= 2.2), sum(1 for x in pool if 2.2 < x["_ratio"] <= 3), sum(1 for x in pool if x["_ratio"] > 3)))
pool = step("5. proporção lado maior/menor <= 2,2", lambda x: x["_ratio"] <= 2.2, pool)
p5 = list(pool)
poolA = step("6a. não marcada pelo filtro FORTE (título+descrição)", lambda x: x["id"] not in forte, pool)
poolB = step("6b. alternativa: não marcada pelo filtro AMPLO", lambda x: x["id"] not in amplo, pool)
for nm, pl in (("6a", poolA), ("6b", poolB)):
    series = C.Counter(x["_serie"] for x in pl)
    print("  [%s] séries distintas (prefixo do nº de acesso): %d | maiores: %s" % (nm, len(series), series.most_common(5)))
    seen = C.Counter(); capped = []
    for x in sorted(pl, key=lambda x: (-int(bool(x.get("is_highlight"))), -int(bool(x.get("current_location"))), -len(x["_d"]))):
        if seen[x["_serie"]] < 2: capped.append(x); seen[x["_serie"]] += 1
    print("  [%s] 7. no máximo 2 por série: %d | destaques (is_highlight): %d | em exposição: %d" % (nm, len(capped), sum(1 for x in capped if x.get("is_highlight")), sum(1 for x in capped if x.get("current_location"))))
    print("       por época:", dict(C.Counter(era(x) for x in capped).most_common()))
    print("       por região:", dict(C.Counter(reg(x) for x in capped).most_common()))
    gc = C.Counter(g for x in capped for g in genres(x))
    print("       por gênero (palavra-chave, pode somar mais de um):", dict(gc.most_common()))
    cells = C.Counter((era(x), reg(x)) for x in capped)
    print("       células época×região com >=5 candidatas: %d de %d não vazias" % (sum(1 for v in cells.values() if v >= 5), len(cells)))
    L = [len(x["_d"]) for x in capped]
    print("       descrição: mediana %d caracteres | com did_you_know: %d" % (st.median(L), sum(1 for x in capped if (x.get("did_you_know") or "").strip())))
    if nm == "6a":
        # simulação de cota: 150 = 5 épocas x 30, teto de 40 por região, round-robin por gênero
        json.dump([{"id": x["id"], "acc": x["accession_number"], "title": x["title"], "era": era(x), "reg": reg(x), "gen": genres(x), "hl": bool(x.get("is_highlight"))} for x in capped], open("candidatas_6a.json", "w"))
        target = {"antes de 1400": 20, "1400-1599": 35, "1600-1799": 35, "1800-1899": 35, "1900+": 25}
        sel = []; regc = C.Counter()
        for e, n in target.items():
            cand = [x for x in capped if era(x) == e]; took = 0
            byreg = C.defaultdict(list)
            for x in cand: byreg[reg(x)].append(x)
            while took < n and any(byreg.values()):
                for r in sorted(byreg, key=lambda r: regc[r]):
                    if took >= n: break
                    if byreg[r] and regc[r] < 30:
                        sel.append(byreg[r].pop(0)); regc[r] += 1; took += 1
                if all(regc[r] >= 30 or not byreg[r] for r in byreg): break
        print("  [6a] simulação de cota (20/35/35/35/25 por época, teto 30 por região): selecionadas %d" % len(sel))
        print("       época:", dict(C.Counter(era(x) for x in sel)), "\n       região:", dict(regc), "\n       gênero:", dict(C.Counter(g for x in sel for g in genres(x)).most_common()))
print("\nretrato (título com Portrait/Self-Portrait) no funil até o passo 5:", sum(1 for x in p5 if re.search(r"portrait", x["title"], re.I)))
