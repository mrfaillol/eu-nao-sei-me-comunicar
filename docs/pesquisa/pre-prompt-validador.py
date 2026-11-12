#!/usr/bin/env python3
"""Protótipo de pesquisa do validador da frase e do compositor de demonstração.

Só biblioteca padrão. Não chama modelo nem rede. Serve para provar que as regras
do relatório pre-prompt.md são executáveis; não é o código de produção.

Uso: python3 pre-prompt-validador.py pre-prompt-casos.json
"""
import hashlib
import json
import re
import sys

IDIOMAS = ("pt-BR", "en", "zh-CN")
CJK = re.compile(r"[一-鿿]")
LIMITE = {"pt-BR": (15, 45), "en": (15, 45), "zh-CN": (25, 80)}  # palavras; zh conta ideogramas
PONTO_FINAL = {"pt-BR": ".", "en": ".", "zh-CN": "。"}
PONTUACAO_PROIBIDA = re.compile(r"[.!?…;:。！？；：—()（）\"“”«»]")
SEGUNDA_PESSOA = {
    "pt-BR": re.compile(r"\b(você|seu|sua|seus|suas)\b", re.I),
    "en": re.compile(r"\b(you|your)\b", re.I),
    "zh-CN": re.compile(r"你"),
}
VERBO_DE_MENSAGEM = {
    "pt-BR": re.compile(r"\b(comunica|comunicam|diz|dizem|sinaliza|sinalizam|expressa|expressam|afirma|afirmam|nomeia|nomeiam)\b", re.I),
    "en": re.compile(r"\b(communicates?|says?|signals?|express(es)?|states?|conveys?|names?)\b", re.I),
    "zh-CN": re.compile(r"传达|表达|说出|说明|表明|诉说"),
}
ATRIBUICAO = {
    "pt-BR": re.compile(r"\bvocê (é|está|tem|sofre|sente|padece|apresenta|vive|carrega)\b", re.I),
    "en": re.compile(r"\byou (are|feel|suffer|seem|carry)\b|\byou have (a|an|the|some|no|this|that)\b|\byou'(re|ve)\b", re.I),
    "zh-CN": re.compile(r"你(是|有|患|感到|觉得|正在经历|处于)"),
}
NOSOLOGIA = {
    "pt-BR": re.compile(r"transtorno|depress|bipolar|esquizo|síndrome|sintoma|diagnóst|patolog|doença|distúrbio|psicose|neurose|tdah|autis|borderline|pânico|fobia|suicid|clínic|paciente", re.I),
    "en": re.compile(r"disorder|depress|bipolar|schizo|syndrome|symptom|diagnos|patholog|illness|psychosis|neurosis|adhd|autis|borderline|panic|phobia|suicid|clinical|patient", re.I),
    "zh-CN": re.compile(r"障碍|抑郁|双相|精神分裂|综合征|症状|诊断|病理|疾病|精神病|神经症|多动症|自闭|恐慌|恐惧症|自杀|临床|患者|焦虑症"),
}
CONSELHO = {
    "pt-BR": re.compile(r"\b(procure|busque|tente|deveria|deve|precisa|recomendo|considere|permita-se|cuide|respire|vai passar)\b|é importante", re.I),
    "en": re.compile(r"\b(should|try to|consider|seek|need to|must|recommend|take care|remember to|will pass)\b", re.I),
    "zh-CN": re.compile(r"应该|建议|需要|试着|不妨|最好|寻求|记得|会过去"),
}
AUTOR_E_TEORIA = {
    "pt-BR": re.compile(r"\bsegundo\b|de acordo com|conforme|materialis|dialétic|semiótic|behavioris|marxis", re.I),
    "en": re.compile(r"according to|materialis|dialectic|semiotic|behaviou?ris|marxis", re.I),
    "zh-CN": re.compile(r"根据|认为|唯物|辩证|符号学|行为主义|马克思|恩格斯|弗洛伊德|斯金纳|巴甫洛夫|皮尔斯|索绪尔|维果茨基|拉康|荣格|涂尔干|黑格尔"),
}
TEORICOS = re.compile(r"\b(Marx|Engels|Freud|Skinner|Pavlov|Peirce|Saussure|Vygotsky|Vigotski|Lacan|Jung|Durkheim|Adorno|Benjamin|Bakhtin|Russell|Lukács|Gramsci|Hegel)\b", re.I)
VOTO_PT = re.compile(r"\b(que|uma|você|sua|suas|com|em|da|do|pela|não)\b", re.I)
VOTO_EN = re.compile(r"\b(the|and|you|your|of|which|that|with|in|by)\b", re.I)


def termos_permitidos(itens):
    """Construtos anotados nos três itens mais os termos de dimensão que os números sustentam."""
    ids = []
    for item in itens:
        for c in item.get("construtos", []):
            if c not in ids:
                ids.append(c)
    v = [i["valencia"] for i in itens if i.get("valencia") is not None]
    a = [i["ativacao"] for i in itens if i.get("ativacao") is not None]
    if any(x <= -0.3 for x in v):
        ids.append("valencia_negativa")
    if any(x >= 0.3 for x in v):
        ids.append("valencia_positiva")
    if any(x >= 0.6 for x in a):
        ids.append("alta_ativacao")
    if any(x <= 0.3 for x in a):
        ids.append("baixa_ativacao")
    return ids


def contem(frase, termo, idioma):
    if idioma == "zh-CN":
        return termo in frase
    return re.search(r"(?<!\w)" + re.escape(termo) + r"(?!\w)", frase, re.I) is not None


def validar(frase, usados, itens, idioma, glossario):
    """Devolve a lista de códigos violados; lista vazia significa frase aceita."""
    erros = []
    if not isinstance(frase, str) or not isinstance(usados, list):
        return ["V1"]
    frase = frase.strip()
    corpo = frase[:-1]
    if "\n" in frase or not frase.endswith(PONTO_FINAL[idioma]) or PONTUACAO_PROIBIDA.search(corpo):
        erros.append("V2")
    n = len(CJK.findall(frase)) if idioma == "zh-CN" else len(frase.split())
    minimo, maximo = LIMITE[idioma]
    if not minimo <= n <= maximo:
        erros.append("V3")
    if not SEGUNDA_PESSOA[idioma].search(frase):
        erros.append("V4")
    permitidos = termos_permitidos(itens)
    fora = [t for t in glossario if t not in permitidos and contem(frase, glossario[t][idioma], idioma)]
    usados_ok = all(u in permitidos and contem(frase, glossario[u][idioma], idioma) for u in usados)
    presentes = [t for t in permitidos if contem(frase, glossario[t][idioma], idioma)]
    if fora or not usados_ok or not 2 <= len(presentes) <= 4:
        erros.append("V5")
    if NOSOLOGIA[idioma].search(frase) or ATRIBUICAO[idioma].search(frase):
        erros.append("V6")
    if CONSELHO[idioma].search(frase):
        erros.append("V7")
    nomes = [p for i in itens for p in re.split(r"[\s-]+", i.get("autor", "")) if len(p) >= 4]
    if (AUTOR_E_TEORIA[idioma].search(frase) or TEORICOS.search(frase) or re.search(r"\d", frase)
            or any(contem(frase, p, "pt-BR") for p in nomes)):
        erros.append("V8")
    if not VERBO_DE_MENSAGEM[idioma].search(frase):
        erros.append("V9")
    rotulos = " ".join(i["rotulo"] for i in itens if i["tipo"] == "palavra")
    if idioma == "zh-CN":
        latinas = [w for w in re.findall(r"[A-Za-zÀ-ÿ]+", frase) if w.lower() not in rotulos.lower()]
        if latinas:
            erros.append("V10")
    elif CJK.search(frase) or (len(VOTO_EN.findall(frase)) > len(VOTO_PT.findall(frase))) != (idioma == "en"):
        erros.append("V10")
    return erros


MOLDES = {
    "sensivel": {
        "pt-BR": "Suas três escolhas comunicam {c1} e {c2} com peso evidente, e a soma das três afirma uma mensagem grave que você reuniu sem dizer com palavras suas.",
        "en": "Your three choices communicate {c1} and {c2} with evident weight, and the sum of the three states a grave message that you gathered without saying it in words of your own.",
        "zh-CN": "你的三个选择传达出分量明显的{c1}与{c2}，三者相加，说出了一条你没有用自己的话讲出来的沉重信息。",
    },
    "contraste": {
        "pt-BR": "Suas três escolhas comunicam {c1} e {c2} em oposição, e essa oposição entre os itens é a mensagem que você reuniu sem dizer com palavras suas.",
        "en": "Your three choices communicate {c1} in opposition to {c2}, and this opposition between the items is the message that you gathered without saying it in words of your own.",
        "zh-CN": "你的三个选择传达出与{c2}相对立的{c1}，这些选项之间的对立，正是你没有用自己的话讲出来的那条信息。",
    },
    "negativa_baixa": {
        "pt-BR": "Suas três escolhas comunicam {c1} e {c2} em tom contido, e a repetição desse tom nas três afirma a mensagem que você reuniu sem dizer com palavras suas.",
        "en": "Your three choices communicate {c1} and {c2} in a subdued tone, and the repetition of that tone across the three states the message that you gathered without saying it yourself.",
        "zh-CN": "你的三个选择以克制的语调传达出{c1}与{c2}，这种语调在三者中重复，说出了你没有用自己的话讲出来的那条信息。",
    },
    "negativa_alta": {
        "pt-BR": "Suas três escolhas comunicam {c1} e {c2} em intensidade elevada, e a soma das três afirma uma mensagem de urgência que você reuniu sem dizer com palavras suas.",
        "en": "Your three choices communicate {c1} and {c2} at high intensity, and the sum of the three states an urgent message that you gathered without saying it in words of your own.",
        "zh-CN": "你的三个选择以很高的强度传达出{c1}与{c2}，三者相加，说出了一条你没有用自己的话讲出来的紧迫信息。",
    },
    "positiva_baixa": {
        "pt-BR": "Suas três escolhas comunicam {c1} e {c2} em tom sereno, e a soma das três afirma uma mensagem de repouso que você reuniu sem dizer com palavras suas.",
        "en": "Your three choices communicate {c1} and {c2} in a calm tone, and the sum of the three states a message of rest that you gathered without saying it in words of your own.",
        "zh-CN": "你的三个选择以平静的语调传达出{c1}与{c2}，三者相加，说出了一条你没有用自己的话讲出来的安宁信息。",
    },
    "positiva_alta": {
        "pt-BR": "Suas três escolhas comunicam {c1} e {c2} em intensidade elevada, e a soma das três afirma uma mensagem de expansão que você reuniu sem dizer com palavras suas.",
        "en": "Your three choices communicate {c1} and {c2} at high intensity, and the sum of the three states an expansive message that you gathered without saying it in words of your own.",
        "zh-CN": "你的三个选择以很高的强度传达出{c1}与{c2}，三者相加，说出了一条你没有用自己的话讲出来的舒展信息。",
    },
    "neutra": {
        "pt-BR": "Suas três escolhas comunicam {c1} e {c2} sem direção afetiva dominante, e a soma das três afirma uma mensagem em suspenso que você reuniu sem dizer.",
        "en": "Your three choices communicate {c1} and {c2} without a dominant affective direction, and the sum of the three states a suspended message that you gathered without saying it.",
        "zh-CN": "你的三个选择传达出{c1}与{c2}，没有占主导的情感方向，三者相加，说出了一条你没有讲出来的悬而未决的信息。",
    },
}


def ajuda_destacada(itens):
    v = [i["valencia"] for i in itens if i.get("valencia") is not None]
    return any(i.get("tema_sensivel") for i in itens) or sum(1 for x in v if x <= -0.6) >= 2


def assinatura(itens):
    if ajuda_destacada(itens):
        return "sensivel"
    v = [i["valencia"] for i in itens if i.get("valencia") is not None]
    a = [i["ativacao"] for i in itens if i.get("ativacao") is not None]
    if (v and max(v) - min(v) >= 0.8) or (a and max(a) - min(a) >= 0.5):
        return "contraste"
    mv = sum(v) / len(v) if v else 0.0
    ma = sum(a) / len(a) if a else 0.0
    if -0.2 <= mv <= 0.2:
        return "neutra"
    return ("negativa" if mv < 0 else "positiva") + ("_alta" if ma >= 0.5 else "_baixa")


def frase_gravada(itens, idioma, glossario):
    """Modo de demonstração: molde escolhido pela assinatura, lacunas pelos construtos mais frequentes."""
    contagem = {}
    for item in itens:
        for c in item.get("construtos", []):
            contagem[c] = contagem.get(c, 0) + 1
    ordem = sorted(contagem, key=lambda c: -contagem[c])  # sorted é estável: empate mantém a ordem de chegada
    ordem += [t for t in termos_permitidos(itens) if t not in ordem]
    if assinatura(itens) == "contraste":
        v = sorted((i for i in itens if i.get("valencia") is not None), key=lambda i: i["valencia"])
        polos = [v[0]["construtos"][0], v[-1]["construtos"][0]] if len(v) >= 2 else ordem[:2]
        ordem = polos if polos[0] != polos[1] else ordem
    c1, c2 = ordem[0], ordem[1]
    chave = hashlib.sha256("|".join(sorted(i["id"] for i in itens)).encode()).hexdigest()
    molde = MOLDES[assinatura(itens)][idioma]  # com mais variantes: int(chave, 16) % n escolhe a variante
    return molde.format(c1=glossario[c1][idioma], c2=glossario[c2][idioma]), [c1, c2], chave[:12]


def main(caminho):
    dados = json.load(open(caminho, encoding="utf-8"))
    g = dados["glossario"]
    casos = {c["id"]: c for c in dados["casos"]}
    ok = total = 0
    razoes = []
    for c in dados["casos"]:
        assert ajuda_destacada(c["itens"]) == c["ajuda_destacada"], c["id"]
        for idioma in IDIOMAS:
            total += 1
            erros = validar(c["frase"][idioma], c["construtos_usados"], c["itens"], idioma, g)
            ok += not erros
            if erros:
                print("ESPERADA REPROVADA", c["id"], idioma, erros)
        razoes.append(len(CJK.findall(c["frase"]["zh-CN"])) / len(c["frase"]["en"].split()))
        print(f'{c["id"]}: pt={len(c["frase"]["pt-BR"].split())} en={len(c["frase"]["en"].split())} '
              f'zh={len(CJK.findall(c["frase"]["zh-CN"]))} assinatura={assinatura(c["itens"])}')
    print(f"frases esperadas aceitas: {ok}/{total}")
    print(f"ideogramas por palavra em inglês: min={min(razoes):.2f} max={max(razoes):.2f}")
    pegas = 0
    for m in dados["mutacoes"]:
        erros = validar(m["frase"], m["construtos_usados"], casos[m["caso"]]["itens"], m["idioma"], g)
        certo = m["deve_falhar"] in erros
        pegas += certo
        print(("  rejeitada " if certo else "  NÃO PEGOU ") + f'{m["deve_falhar"]} em {m["caso"]} [{m["idioma"]}] -> {erros}')
    print(f'mutações rejeitadas pelo código esperado: {pegas}/{len(dados["mutacoes"])}')
    demo_ok = demo_total = 0
    for c in dados["casos"]:
        for idioma in IDIOMAS:
            demo_total += 1
            frase, usados, _ = frase_gravada(c["itens"], idioma, g)
            erros = validar(frase, usados, c["itens"], idioma, g)
            demo_ok += not erros
            if erros:
                print("DEMO REPROVADA", c["id"], idioma, erros, frase)
    print(f"frases gravadas (demonstração) aceitas pelo mesmo validador: {demo_ok}/{demo_total}")
    for lac in dados.get("lacunas_conhecidas", []):
        erros = validar(lac["frase"], lac["construtos_usados"], casos[lac["caso"]]["itens"], lac["idioma"], g)
        print(f'lacuna conhecida ({lac["nome"]}): ' + ("PASSA, como previsto" if not erros else f"rejeitada {erros}"))
    return 0 if (ok == total and pegas == len(dados["mutacoes"]) and demo_ok == demo_total) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
