"""Sons CC0 do Freesound, localizados pelo Openverse.

Medições que moldam este módulo (docs/pesquisa/acervo-sons.md):
- O acesso anônimo ao Openverse declara 200 chamadas por dia e 20 por minuto. A fonte guarda um
  contador próprio em disco e para antes de estourar.
- O Openverse não devolve descrição: o texto humano do som é o título mais as tags do autor.
- O campo `mature` é falso em tudo e conteúdo sexual passa pelo filtro deles; por isso a lista de
  termos barrados é nossa, e a escuta humana de cada som continua obrigatória antes de publicar.
"""
from __future__ import annotations

import json
import re
import subprocess
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Callable

from acervo.rede import abrir_com_recuo
from acervo.texto import limpar_texto

AGENTE = "art-index-probe/1.0"
DURACAO_MINIMA_MS, DURACAO_MAXIMA_MS = 2000, 20000
TAGS_MINIMAS = 3
ROTULO_MAXIMO = 120
EXTENSOES = re.compile(r"\.(wav|mp3|flac|ogg|aiff?|m4a|wma)$", re.IGNORECASE)


class LimiteDiario(RuntimeError):
    """O teto diário de chamadas ao Openverse foi atingido; o pipeline para e segue no dia seguinte."""


def _slug(termo: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", termo.lower()).strip("-")


class FonteOpenverse:
    def __init__(
        self,
        cache: Path,
        limite_diario: int = 200,
        intervalo_s: float = 3.0,
        abrir: Callable = urllib.request.urlopen,
        dormir: Callable[[float], None] = time.sleep,
    ):
        self.cache, self.limite, self.intervalo = cache, limite_diario, intervalo_s
        self.abrir, self.dormir = abrir, dormir
        self.cache.mkdir(parents=True, exist_ok=True)

    def _gastar_uma_chamada(self) -> None:
        arquivo = self.cache / "contador.json"
        hoje = date.today().isoformat()
        contador = json.loads(arquivo.read_text(encoding="utf-8")) if arquivo.exists() else {}
        chamadas = contador.get("chamadas", 0) if contador.get("dia") == hoje else 0
        if chamadas >= self.limite:
            raise LimiteDiario(f"{chamadas} chamadas ao Openverse hoje; o teto é {self.limite}")
        arquivo.write_text(json.dumps({"dia": hoje, "chamadas": chamadas + 1}), encoding="utf-8")

    def buscar(self, termo: str, paginas: int = 1) -> list[dict]:
        """Resultados do termo, da página 1 até `paginas`. Página em cache não gasta chamada."""
        resultados: list[dict] = []
        for pagina in range(1, paginas + 1):
            arquivo = self.cache / (_slug(termo) + ("" if pagina == 1 else f"-p{pagina}") + ".json")
            if not arquivo.exists():
                self._gastar_uma_chamada()
                consulta = f"q={urllib.parse.quote(termo)}&source=freesound&license=cc0&length=shortest&page_size=20&page={pagina}"
                pedido = urllib.request.Request(f"https://api.openverse.org/v1/audio/?{consulta}", headers={"User-Agent": AGENTE})
                with self.abrir(pedido, timeout=40) as resposta:
                    arquivo.write_bytes(resposta.read())
                self.dormir(self.intervalo)
            resultados.extend(json.loads(arquivo.read_text(encoding="utf-8")).get("results", []))
        return resultados


def _tags(resultado: dict) -> list[str]:
    vistas: list[str] = []
    for tag in resultado.get("tags") or []:
        nome = (tag.get("name") or "").strip().lower()
        if nome and nome not in vistas:
            vistas.append(nome)
    return vistas


def filtrar(resultados: list[dict], barrados: set[str], duracao_maxima_ms: int = DURACAO_MAXIMA_MS) -> list[dict]:
    """Fica só o que pode entrar: CC0, do Freesound, de 2 a 20 s, com 3 tags ou mais e sem termo barrado.

    O acervo conferido recorta o som em até 20 s. O ampliado toca o arquivo de origem inteiro e aceita até 30 s.
    """
    padrao = re.compile(r"(?<![a-z])(" + "|".join(re.escape(b.lower()) for b in sorted(barrados)) + r")(?![a-z])") if barrados else None
    aceitos = []
    for r in resultados:
        tags = _tags(r)
        texto = " | ".join([(r.get("title") or "").lower().replace("_", " "), *tags])
        if r.get("license") != "cc0" or r.get("source") != "freesound" or r.get("mature"):
            continue
        if not DURACAO_MINIMA_MS <= (r.get("duration") or 0) <= duracao_maxima_ms or len(tags) < TAGS_MINIMAS:
            continue
        if padrao and padrao.search(texto):
            continue
        aceitos.append(r)
    return aceitos


def limpar_titulo(titulo: str) -> str:
    """Título de arquivo vira título de leitura: sem extensão, sem sublinhado, sem espaço sobrando."""
    sem_extensao = EXTENSOES.sub("", (titulo or "").strip())
    return re.sub(r"\s+", " ", sem_extensao.replace("_", " ")).strip()


def escolher_sons(por_termo: dict[str, list[dict]], total: int = 30) -> list[dict]:
    """Um som por termo na primeira volta, para variar; depois completa. Sempre na mesma ordem.

    Dentro de cada termo vale a ordem recebida, que é a de relevância da busca.
    """
    filas = {termo: list(sons) for termo, sons in sorted(por_termo.items())}
    escolhidos: list[dict] = []
    vistos: set[str] = set()
    while len(escolhidos) < total and any(filas.values()):
        for termo, fila in filas.items():
            while fila and fila[0]["id"] in vistos:
                fila.pop(0)
            if fila and len(escolhidos) < total:
                som = fila.pop(0)
                vistos.add(som["id"])
                escolhidos.append({**som, "_termo": termo})
    return escolhidos


def _baixar(url: str, destino: Path) -> None:
    pedido = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    with abrir_com_recuo(pedido, timeout=60) as resposta:
        destino.write_bytes(resposta.read())


def gerar_recorte(url: str, destino: Path, baixar: Callable[[str, Path], None] = _baixar) -> dict:
    """Baixa a prévia uma vez, normaliza o volume e corta em 20 s. Devolve a mídia do item."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    bruto = destino.with_suffix(".bruto")
    baixar(url, bruto)
    try:
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", str(bruto), "-af", "loudnorm=I=-16:TP=-1.5",
             "-t", "20", "-ar", "44100", "-b:a", "128k", "-f", "mp3", str(destino)],
            check=True,
        )
    finally:
        bruto.unlink(missing_ok=True)
    return medir_recorte(destino)


def medir_recorte(destino: Path) -> dict:
    """Mídia do item para um recorte que já está no disco."""
    duracao = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(destino)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return {"arquivo": f"midia/sons/{destino.name}", "duracao_ms": min(DURACAO_MAXIMA_MS, round(float(duracao) * 1000))}


def numero_no_freesound(r: dict) -> str:
    """Número do som no Freesound, tirado do endereço da página: a API não o devolve em campo próprio."""
    achado = re.search(r"^https://freesound\.org/people/[^/]+/sounds/(\d+)/?$", r.get("foreign_landing_url") or "")
    if not achado:
        raise ValueError(f"endereço que não é de som do Freesound: {r.get('foreign_landing_url')!r}")
    return achado.group(1)


def para_item_som(r: dict, midia: dict) -> dict:
    """Item do acervo para o som. Os construtos entram depois, na anotação."""
    # Título, autor e tags são de terceiros e vão para o prompt: todos passam pela limpeza, com teto.
    titulo = limpar_texto(limpar_titulo(r.get("title") or ""), limite=ROTULO_MAXIMO)
    autor = limpar_texto(r.get("creator") or "", limite=ROTULO_MAXIMO)
    return {
        "id": f"som:freesound:{numero_no_freesound(r)}",
        "tipo": "som",
        "classe_semiotica": "indice",
        "idioma": None,
        "rotulo": titulo,
        # Título e tags são de terceiros: passam pela mesma limpeza do texto de curadoria e entram como dado.
        "texto_humano": limpar_texto(f"{titulo} | {', '.join(_tags(r))}"),
        "origem_do_texto": "titulo_e_tags",
        "construtos": [],
        "tema_sensivel": False,
        "afeto": {"metodo": "ausente"},
        "credito": {
            "autor": autor,
            "linha": f"{titulo}, por {autor}, no Freesound (CC0)",
            "fonte": "freesound-via-openverse",
            "licenca": "CC0-1.0",
            "url": r["foreign_landing_url"],
        },
        "revisao": {"humana": "pendente", "por": None, "em": None},
        "midia": midia,
    }
