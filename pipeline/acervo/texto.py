"""Limpeza do texto que vem de terceiros antes de ele entrar no acervo."""
from __future__ import annotations

import html
import re


def limpar_texto(bruto: str, limite: int = 600) -> str:
    """Tira marcação, endereços e caracteres de controle; corta em fim de frase se passar do limite."""
    texto = re.sub(r"<[^>]+>", "", bruto or "")
    texto = html.unescape(texto)
    texto = re.sub(r"https?://\S+", "", texto)
    texto = "".join(c if c.isprintable() or c.isspace() else " " for c in texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    if len(texto) <= limite:
        return texto
    corte = texto[:limite]
    fim = max(corte.rfind(". "), corte.rfind("! "), corte.rfind("? "))
    if corte.endswith((".", "!", "?")):
        return corte
    return corte[: fim + 1] if fim > 0 else corte[: corte.rfind(" ")]
