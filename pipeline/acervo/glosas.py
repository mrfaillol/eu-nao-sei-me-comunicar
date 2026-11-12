"""Glosa humana das palavras, copiada sem alteração do Wiktionary em inglês (CC BY-SA 4.0).

A primeira definição nem sempre é o sentido de estado mental: medido em 12/Nov/2026, "fossa"
abre com "hole, hollow, cavity" e "marasmo" com "marasmus (any wasting disease)". Por isso a
lista de palavras guarda o índice do sentido escolhido, e este módulo só lista e busca.
"""
from __future__ import annotations

import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable

AGENTE = "art-index-probe/1.0"
CACHE = Path(__file__).resolve().parents[1] / "cache" / "glosas"
LIMITE = 600
TENTATIVAS = 4
INTERVALO_S = 2.5
# Palavras que indicam definição de estado mental, para sugerir um sentido a quem monta a lista.
PISTAS = re.compile(
    r"\b(feeling|feelings|felt|emotion|emotional|mood|state of mind|sentiment|sadness|sad|longing|yearning|"
    r"melanchol|wistful|anxi|worr|fear|afraid|joy|happy|happiness|calm|tranquil|peace|uneas|restless|"
    r"bored|boredom|weary|wearin|listless|apath|tender|affection|grief|sorrow|regret|shame|resentment|"
    r"anger|angry|delight|astonish|amaze|wonder|lonel|nostalgi|relief|despair|discourag|dismay|"
    r"enthusias|energy|spirit|mental|mind|depress|upset|distress|comfort|cosy|cozy|pleasure)",
    re.IGNORECASE,
)

Carregador = Callable[[str], dict]


def carregar_definicoes(
    palavra: str,
    cache: Path = CACHE,
    abrir: Callable = urllib.request.urlopen,
    dormir: Callable[[float], None] = time.sleep,
) -> dict:
    """Resposta do Wiktionary para a palavra, com cache em disco. Dicionário vazio se não houver página.

    O servidor responde 429 quando os pedidos vêm depressa (medido: na 25ª consulta com 1 s de intervalo).
    Nesse caso espera o que o `Retry-After` pedir, ou um recuo crescente, e tenta de novo até 4 vezes.
    """
    cache.mkdir(parents=True, exist_ok=True)
    arquivo = cache / (urllib.parse.quote(palavra, safe="") + ".json")
    if arquivo.exists():
        return json.loads(arquivo.read_text(encoding="utf-8"))
    url = "https://en.wiktionary.org/api/rest_v1/page/definition/" + urllib.parse.quote(palavra, safe="")
    pedido = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    for tentativa in range(TENTATIVAS):
        try:
            with abrir(pedido, timeout=25) as resposta:
                dado = json.load(resposta)
            break
        except urllib.error.HTTPError as erro:
            if erro.code == 404:
                dado = {}
                break
            if erro.code != 429 or tentativa == TENTATIVAS - 1:
                raise
            pedido_do_servidor = (erro.headers or {}).get("Retry-After", "")
            dormir(int(pedido_do_servidor) if str(pedido_do_servidor).isdigit() else 5 * 2**tentativa)
    arquivo.write_text(json.dumps(dado, ensure_ascii=False), encoding="utf-8")
    dormir(INTERVALO_S)  # intervalo entre chamadas; leitura de cache não espera
    return dado


def _texto(bruto: str) -> str:
    sem_tags = re.sub(r"<[^>]+>", "", bruto)
    return re.sub(r"\s+", " ", html.unescape(sem_tags)).strip()


def listar_sentidos(palavra: str, secao: str, carregar: Carregador = carregar_definicoes) -> list[str]:
    """Todas as definições não vazias da seção do idioma (ex.: "pt", "en"), na ordem da página."""
    sentidos = []
    for bloco in carregar(palavra).get(secao, []):
        for definicao in bloco.get("definitions", []):
            texto = _texto(definicao.get("definition", ""))
            if texto:
                sentidos.append(texto)
    return sentidos


def sugerir_sentido(sentidos: list[str]) -> int | None:
    """Índice do primeiro sentido que fala de estado mental. É sugestão: quem decide é quem monta a lista."""
    return next((i for i, s in enumerate(sentidos) if PISTAS.search(s)), None)


def buscar_glosa(palavra: str, secao: str, sentido: int, carregar: Carregador = carregar_definicoes) -> dict | None:
    sentidos = listar_sentidos(palavra, secao, carregar)
    if not 0 <= sentido < len(sentidos):
        return None
    texto = sentidos[sentido]
    if len(texto) > LIMITE:
        return None  # não se corta glosa: a cópia é sem alteração
    return {
        "texto": texto,
        "url": "https://en.wiktionary.org/wiki/" + urllib.parse.quote(palavra, safe=""),
        "licenca": "CC-BY-SA-4.0",
    }
