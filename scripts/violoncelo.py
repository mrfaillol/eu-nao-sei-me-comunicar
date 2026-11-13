"""Trilha de violoncelo para o vídeo de divulgação, escrita a partir dos movimentos da tela.

Uso:  uv run --project pipeline python scripts/violoncelo.py <tomada>.eventos.json <saida>.wav

O gravador (scripts/gravar-demo.mjs) guarda o instante de cada movimento do cursor, clique e aproximação
da câmera. Aqui cada um deles vira uma nota, no instante exato:

- cursor em movimento: arco ligado. A altura na tela é a altura da nota (embaixo grave, em cima agudo),
  o deslize entre duas alturas é um glissando com a mesma curva do cursor, e o lado da tela é o lado do som;
- clique: pizzicato na nota onde o cursor está;
- cada escolha deixa uma nota longa soando baixo, e as escolhas empilham um acorde até a frase;
- aproximação da câmera: crescendo durante a ida, nota sustentada na parada, decrescendo na volta.

Tudo na escala pentatônica de ré menor (ré, fá, sol, lá, dó): qualquer caminho do cursor soa consonante.
As amostras são do VSCO 2 Community Edition, de Sam Gossner, em domínio público (CC0).
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
import wave
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[1]
AMOSTRAS = RAIZ / "pipeline" / "cache" / "vsco-cello"
REPOSITORIO = "sgossner/VSCO-2-CE"
AGENTE = "art-index-probe/1.0"
SR = 44100

# O nome do arquivo usa uma oitava abaixo da que soa (medido: "D2" soa 147 Hz, que é ré 3).
SEMITOM = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
# Do ré 2 ao ré 4, só as notas da pentatônica de ré menor.
ESCALA = [38, 41, 43, 45, 48, 50, 53, 55, 57, 60, 62]
ACORDE_DAS_ESCOLHAS = [38, 45, 53, 60, 55, 50, 57]
NOTAS_DAS_MARCAS = {
    "palavras da pintura": [57],
    "dicionário": [53],
    "escolhas na barra": [55],
    "a frase": [38, 45, 50],
    "em palavras simples": [53, 57],
    "procedência": [60],
    "assinatura": [38, 50],
}


def garantir_amostras() -> None:
    """Baixa as notas sustentadas e os pizzicatos do repositório do VSCO 2 CE, se ainda não estiverem em cache."""
    if len(list(AMOSTRAS.glob("susvib/*.wav"))) >= 27 and len(list(AMOSTRAS.glob("pizzT/*.wav"))) >= 52:
        return
    pedido = urllib.request.Request(f"https://api.github.com/repos/{REPOSITORIO}/git/trees/master?recursive=1", headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(pedido, timeout=60) as resposta:
        arvore = json.load(resposta)["tree"]
    for no in arvore:
        caminho = no["path"]
        partes = caminho.split("/")
        if len(partes) == 4 and partes[1] == "Cello Section" and partes[2] in ("susvib", "pizzT") and caminho.endswith(".wav"):
            destino = AMOSTRAS / partes[2] / partes[3]
            if destino.exists() and destino.stat().st_size > 0:
                continue
            destino.parent.mkdir(parents=True, exist_ok=True)
            bruto = urllib.request.Request(f"https://raw.githubusercontent.com/{REPOSITORIO}/master/{urllib.parse.quote(caminho)}", headers={"User-Agent": AGENTE})
            with urllib.request.urlopen(bruto, timeout=120) as resposta:
                destino.write_bytes(resposta.read())


def ler_wav(arquivo: Path) -> np.ndarray:
    """Estéreo em ponto flutuante, de -1 a 1, com o silêncio antes do ataque cortado."""
    with wave.open(str(arquivo)) as w:
        canais, largura, taxa = w.getnchannels(), w.getsampwidth(), w.getframerate()
        bruto = np.frombuffer(w.readframes(w.getnframes()), dtype=np.uint8).reshape(-1, largura)
    assert taxa == SR and largura == 3, f"{arquivo.name}: esperado 24 bits a 44,1 kHz"
    inteiro = bruto[:, 0].astype(np.int32) | (bruto[:, 1].astype(np.int32) << 8) | (bruto[:, 2].astype(np.int8).astype(np.int32) << 16)
    som = (inteiro.reshape(-1, canais) / 8388608.0).astype(np.float64)
    if canais == 1:
        som = np.repeat(som, 2, axis=1)
    # O ataque começa onde o som passa de 2% do pico; guarda-se 3 ms antes, para o transiente inteiro.
    forte = np.abs(som).max(axis=1)
    inicio = int(np.argmax(forte > 0.02 * forte.max()))
    return som[max(0, inicio - int(0.003 * SR)) :]


def nota_do_nome(nome: str) -> int:
    letra, oitava = nome[0], int(nome[1:])
    return 12 * (oitava + 2) + SEMITOM[letra]


class Banco:
    """As amostras por articulação e dinâmica, com a nota que cada uma soa."""

    def __init__(self) -> None:
        self.arco: dict[str, dict[int, np.ndarray]] = {"suave": {}, "forte": {}}
        self.pizz: dict[str, dict[int, list[np.ndarray]]] = {"suave": {}, "forte": {}}
        for arquivo in sorted(AMOSTRAS.glob("susvib/*.wav")):
            _, nome, dinamica, _ = arquivo.stem.split("_")
            self.arco["suave" if dinamica == "v1" else "forte"].setdefault(nota_do_nome(nome), ler_wav(arquivo))
        for arquivo in sorted(AMOSTRAS.glob("pizzT/*.wav")):
            _, nome, dinamica, _ = arquivo.stem.split("_")
            self.pizz["suave" if dinamica == "v1" else "forte"].setdefault(nota_do_nome(nome), []).append(ler_wav(arquivo))
        self.vez = 0

    def mais_perto(self, tabela: dict[int, object], nota: float) -> int:
        return min(tabela, key=lambda n: (abs(n - nota), n))


def ler_com_velocidade(amostra: np.ndarray, razao: np.ndarray) -> np.ndarray:
    """Toca a amostra com a velocidade de cada instante (1 = como gravada). É o que faz o glissando."""
    posicao = np.concatenate([[0.0], np.cumsum(razao[:-1])])
    posicao = np.minimum(posicao, len(amostra) - 2)
    base = posicao.astype(np.int64)
    resto = (posicao - base)[:, None]
    return amostra[base] * (1 - resto) + amostra[base + 1] * resto


def sustentar(amostra: np.ndarray, precisa: int) -> np.ndarray:
    """Alonga a nota repetindo o miolo dela, com emenda cruzada: as escolhas soam até a frase, mais que os 9 s gravados."""
    if precisa <= len(amostra) - SR // 2:
        return amostra
    fim = len(amostra) - int(1.5 * SR)  # antes de o arco soltar a corda
    inicio, emenda = fim - int(3.0 * SR), int(0.6 * SR)
    sobe = np.sin(np.linspace(0, np.pi / 2, emenda))[:, None]
    desce = np.cos(np.linspace(0, np.pi / 2, emenda))[:, None]
    saida, miolo = amostra[:fim].copy(), amostra[inicio:fim]
    while len(saida) < precisa + emenda:
        saida[-emenda:] = saida[-emenda:] * desce + miolo[:emenda] * sobe
        saida = np.concatenate([saida, miolo[emenda:]])
    return saida


def envelope(n: int, ataque: float, soltura: float) -> np.ndarray:
    e = np.ones(n)
    a, s = min(n // 2, int(ataque * SR)), min(n // 2, int(soltura * SR))
    if a:
        e[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if s:
        e[-s:] *= np.cos(np.linspace(0, np.pi / 2, s)) ** 2
    return e


def lados(pan: np.ndarray | float, n: int) -> np.ndarray:
    """Ganho de cada lado, com potência constante. pan vai de 0 (esquerda) a 1 (direita), sem abrir tudo."""
    p = 0.5 + (np.clip(np.broadcast_to(pan, (n,)), 0, 1) - 0.5) * 0.7
    return np.stack([np.cos(p * np.pi / 2), np.sin(p * np.pi / 2)], axis=1) * np.sqrt(2)


def nota_da_altura(y: float) -> int:
    """A altura do cursor na tela (0 em cima, 1 embaixo) vira uma nota da escala: embaixo grave, em cima agudo."""
    return ESCALA[int(round((1 - min(1.0, max(0.0, y))) * (len(ESCALA) - 1)))]


class Trilha:
    def __init__(self, segundos: float, banco: Banco) -> None:
        self.som = np.zeros((int((segundos + 3) * SR), 2))
        self.banco = banco
        self.partitura: list[dict] = []

    def somar(self, t: float, trecho: np.ndarray) -> None:
        i = int(round(t * SR))
        if i < 0:
            trecho, i = trecho[-i:], 0
        fim = min(len(self.som), i + len(trecho))
        if fim > i:
            self.som[i:fim] += trecho[: fim - i]

    def arco(self, t: float, dura: float, de: float, para: float, ganho: float, pan_de: float = 0.5, pan_para: float = 0.5, tempo_do_deslize: float | None = None, ataque: float = 0.03, soltura: float = 0.22, dinamica: str = "forte", tipo: str = "arco") -> None:
        """Nota de arco de `t` por `dura` segundos. Se `de` e `para` diferem, desliza no começo, com a curva do cursor."""
        n = int(dura * SR)
        if n < 64:
            return
        tabela = self.banco.arco[dinamica]
        origem = self.banco.mais_perto(tabela, (de + para) / 2)
        amostra = tabela[origem]
        d = int((tempo_do_deslize if tempo_do_deslize is not None else dura) * SR)
        e = np.clip(np.arange(n) / max(1, d), 0, 1)
        curva = e * e * (3 - 2 * e)  # a mesma aceleração e freio do cursor
        altura = de + (para - de) * curva
        razao = 2 ** ((altura - origem) / 12)
        trecho = ler_com_velocidade(sustentar(amostra, int(razao.sum()) + SR), razao)
        pan = pan_de + (pan_para - pan_de) * curva
        self.somar(t, trecho * (envelope(n, ataque, soltura) * ganho)[:, None] * lados(pan, n))
        self.partitura.append({"t": round(t, 3), "tipo": tipo, "de": int(de), "para": int(para), "dura": round(dura, 3)})

    def pizzicato(self, t: float, nota: int, ganho: float, pan: float = 0.5, dinamica: str = "forte", tipo: str = "pizzicato") -> None:
        tabela = self.banco.pizz[dinamica]
        origem = self.banco.mais_perto(tabela, nota)
        tomadas = tabela[origem]
        amostra = tomadas[self.banco.vez % len(tomadas)]
        self.banco.vez += 1
        n = int(min(len(amostra) / 2 ** ((nota - origem) / 12) - 2, 2.6 * SR))
        trecho = ler_com_velocidade(amostra, np.full(n, 2 ** ((nota - origem) / 12)))
        self.somar(t - 0.003, trecho * (envelope(n, 0.0, 0.4) * ganho)[:, None] * lados(pan, n))
        self.partitura.append({"t": round(t, 3), "tipo": tipo, "nota": int(nota)})


def compor(dados: dict, banco: Banco) -> Trilha:
    fim, ida = float(dados["fim"]), float(dados.get("ida_da_camera", 0.8))
    eventos = sorted(dados["eventos"], key=lambda e: e.get("t", e.get("t0", 0)))
    trilha = Trilha(fim, banco)
    movimentos = [e for e in eventos if e["tipo"] == "movimento"]
    cliques = [e for e in eventos if e["tipo"] == "clique"]

    # Abertura: o título na tela e as pinturas chegando perto dos rostos. Um ré grave que cresce até o primeiro gesto.
    primeiro = min([e.get("t", e.get("t0", fim)) for e in eventos] + [fim])
    if primeiro > 1.0:
        # Começa em 0,25 s e solta a corda 150 ms antes do primeiro gesto, que entra no silêncio.
        trilha.arco(0.25, primeiro - 0.4, 38, 38, 0.5, ataque=(primeiro - 0.4) * 0.7, soltura=0.4, tipo="abertura")

    # O cursor: cada movimento é um arco ligado, que desliza enquanto o cursor anda e sustenta um pouco onde ele para.
    for n, m in enumerate(movimentos):
        de, para = nota_da_altura(m["de"]["y"]), nota_da_altura(m["para"]["y"])
        anda = max(0.08, m["t1"] - m["t0"])
        distancia = float(np.hypot(m["para"]["x"] - m["de"]["x"], m["para"]["y"] - m["de"]["y"]))
        proximo = movimentos[n + 1]["t0"] if n + 1 < len(movimentos) else fim
        resto = max(0.0, min(0.55, proximo - m["t1"] - 0.02))
        trilha.arco(m["t0"], anda + resto, de, para, 0.22 + 0.5 * min(1.0, distancia / 0.5), m["de"]["x"], m["para"]["x"], tempo_do_deslize=anda, soltura=min(0.3, resto + 0.08), tipo="cursor")

    # Os cliques: pizzicato na nota onde o cursor está. Escolha soa cheia; os outros, de leve.
    escolhas = 0
    ver_frase = next((c["t"] for c in cliques if c["papel"] == "ver-frase"), fim)
    for c in cliques:
        nota = nota_da_altura(c["y"])
        if c["papel"] == "escolha":
            trilha.pizzicato(c["t"], nota, 0.95, c["x"], "forte", "pizzicato da escolha")
            # A escolha fica: uma nota longa e baixa entra no acorde e só sai quando a frase é pedida.
            grave = ACORDE_DAS_ESCOLHAS[escolhas % len(ACORDE_DAS_ESCOLHAS)]
            escolhas += 1
            dura = ver_frase + 1.4 - c["t"]
            trilha.arco(c["t"] + 0.02, dura, grave, grave, 0.9, c["x"], 0.5, ataque=0.7, soltura=min(1.6, dura / 2), dinamica="suave", tipo="nota da escolha")
        elif c["papel"] == "ver-frase":
            trilha.pizzicato(c["t"], 38, 1.0, 0.5, "forte", "pizzicato do pedido")
            trilha.pizzicato(c["t"], 50, 0.7, c["x"], "forte", "pizzicato do pedido")
        else:
            trilha.pizzicato(c["t"], nota, 0.6, c["x"], "suave", f"pizzicato ({c['papel']})")

    for e in eventos:
        if e["tipo"] == "marca":
            # A câmera se aproxima em `ida` segundos, para, e volta. O arco cresce, sustenta e some junto.
            notas = NOTAS_DAS_MARCAS.get(e["nome"], [50])
            dura = e["segura"] - 0.15 + ida
            for k, nota in enumerate(notas):
                trilha.arco(e["t"], dura, nota, nota, (0.62 if e["nome"] == "a frase" else 0.42) / (1 + 0.25 * k), 0.5, 0.5, ataque=ida, soltura=ida, tipo=f"câmera: {e['nome']}")
        elif e["tipo"] == "frase":
            trilha.pizzicato(e["t"], 38, 0.55, 0.5, "suave", "a frase aparece")
        elif e["tipo"] == "rolagem":
            # A caixa rola para baixo: um deslize que desce junto.
            trilha.arco(e["t"], e["dura"] + 0.25, 57, 50, 0.3, tempo_do_deslize=e["dura"], tipo="rolagem")
        elif e["tipo"] == "fecha":
            trilha.pizzicato(e["t"], 62, 0.5, 0.5, "suave", "a caixa fecha")
    return trilha


def sala(som: np.ndarray, segundos: float = 1.7, molhado: float = 0.16) -> np.ndarray:
    """Um pouco de sala: ruído que decai, diferente em cada lado, somado ao som seco."""
    semente = np.random.default_rng(1913)
    n = int(segundos * SR)
    cauda = semente.standard_normal((n, 2)) * np.exp(-np.arange(n) / (segundos * SR / 6.9))[:, None]
    cauda[: int(0.012 * SR)] = 0
    cauda /= np.sqrt((cauda**2).sum(axis=0))
    tamanho = 1 << int(np.ceil(np.log2(len(som) + n)))
    eco = np.stack([np.fft.irfft(np.fft.rfft(som[:, c], tamanho) * np.fft.rfft(cauda[:, c], tamanho), tamanho)[: len(som)] for c in (0, 1)], axis=1)
    return som + molhado * eco


def gravar_wav(arquivo: Path, som: np.ndarray) -> None:
    inteiro = np.clip(np.round(som * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(arquivo), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(inteiro.tobytes())


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("uso: violoncelo.py <tomada>.eventos.json <saida>.wav")
    dados = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    garantir_amostras()
    trilha = compor(dados, Banco())
    fim = float(dados["fim"])
    som = sala(trilha.som)[: int(fim * SR)]
    # O vídeo escurece no último meio segundo; o som sai junto, um pouco antes.
    n = int(0.9 * SR)
    som[-n:] *= (np.cos(np.linspace(0, np.pi / 2, n)) ** 2)[:, None]
    som = np.tanh(som * 1.1) / 1.1  # arredonda os picos em vez de cortar
    som *= 10 ** (-1.5 / 20) / np.abs(som).max()
    saida = Path(sys.argv[2])
    gravar_wav(saida, som)
    saida.with_suffix(".partitura.json").write_text(json.dumps({"fim": fim, "notas": sorted(trilha.partitura, key=lambda x: x["t"])}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"saida": str(saida), "segundos": round(len(som) / SR, 2), "notas": len(trilha.partitura)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
