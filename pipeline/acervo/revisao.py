"""Folha de revisão humana do acervo.

Agente não ouve som nem assina como revisor. Este módulo gera uma página local em que o dono vê
cada pintura com as caixas de rosto, ouve cada som e lê cada palavra, aprova ou reprova, e baixa
um decisoes.json. A montagem do índice aplica essas decisões: item reprovado nunca vai para o site,
e o índice publicável só leva item aprovado.
"""
from __future__ import annotations

import hashlib
import html
import json
from pathlib import Path

MIDIA = Path(__file__).resolve().parents[2] / "public"

ESTADOS = {"aprovada", "reprovada"}
NUDEZ = ("nenhuma", "parcial", "frontal")
VIOLENCIA = ("nenhuma", "historica", "grafica")


def impressao(item: dict, raiz_da_midia: Path = MIDIA) -> str:
    """Impressão digital do que o revisor vê, ouve e lê num item.

    A aprovação fica amarrada a ela: se o pipeline rodar de novo e trocar o texto, os construtos
    ou o arquivo do item, a impressão muda e a aprovação antiga deixa de valer.
    """
    visto = {
        "rotulo": item["rotulo"],
        "texto_humano": item["texto_humano"],
        "construtos": sorted(item["construtos"]),
        "tema_sensivel": item["tema_sensivel"],
        "credito": item["credito"],
        "rostos": [[r["x"], r["y"], r["w"], r["h"]] for r in item.get("_rostos", [])],
    }
    resumo = hashlib.sha256(json.dumps(visto, ensure_ascii=False, sort_keys=True).encode("utf-8"))
    arquivo = raiz_da_midia / item["midia"]["arquivo"] if item.get("midia") else None
    if arquivo is not None and arquivo.is_file():
        resumo.update(arquivo.read_bytes())
    return resumo.hexdigest()[:32]


def _e(texto) -> str:
    """Todo texto de terceiros entra escapado: título e tags de som são escritos por desconhecidos."""
    return html.escape(str(texto), quote=True)


def _midia(item: dict) -> str:
    if item["tipo"] == "pintura":
        caixas = "".join(
            f'<div class="caixa{" destaque" if n == item.get("_destaque") else ""}" '
            f'style="left:{r["x"] * 100:.2f}%;top:{r["y"] * 100:.2f}%;width:{r["w"] * 100:.2f}%;height:{r["h"] * 100:.2f}%"><b>{n}</b></div>'
            for n, r in enumerate(item.get("_rostos", []))
        )
        return f'<div class="quadro"><img loading="lazy" src="../public/{_e(item["midia"]["arquivo"])}" alt="">{caixas}</div>'
    if item["tipo"] == "som":
        return f'<audio controls preload="none" src="../public/{_e(item["midia"]["arquivo"])}"></audio>'
    return f'<p class="palavra" lang="{_e(item["idioma"])}">{_e(item["rotulo"])}</p>'


def _campos_de_pintura(item: dict) -> str:
    def opcoes(valores, atual):
        return "".join(f'<option{" selected" if v == atual else ""}>{v}</option>' for v in valores)

    sensivel = item.get("sensivel", {})
    rostos = "".join(f'<option value="{n}"{" selected" if n == item.get("_destaque") else ""}>rosto {n}</option>' for n in range(len(item.get("_rostos", []))))
    return (
        f'<label>nudez <select name="nudez">{opcoes(NUDEZ, sensivel.get("nudez"))}</select></label>'
        f'<label>violência <select name="violencia">{opcoes(VIOLENCIA, sensivel.get("violencia"))}</select></label>'
        f'<label>rosto de destaque <select name="destaque_manual"><option value="">manter o automático</option>'
        f'<option value="nenhum">nenhum (sem zoom)</option>{rostos}</select></label>'
    )


def _cartao(item: dict) -> str:
    credito = item["credito"]
    return f"""<article data-id="{_e(item["id"])}" data-tipo="{item["tipo"]}" data-impressao="{impressao(item)}">
  {_midia(item)}
  <h3>{_e(item["rotulo"])}</h3>
  <p class="texto">{_e(item["texto_humano"])}</p>
  <p class="meta">construtos: {_e(", ".join(item["construtos"]))} · tema sensível: {"sim" if item["tema_sensivel"] else "não"} · <a href="{_e(credito["url"])}" rel="noopener noreferrer">{_e(credito["linha"])}</a></p>
  <fieldset>
    <label><input type="radio" name="d-{_e(item["id"])}" value="aprovada"> aprovar</label>
    <label><input type="radio" name="d-{_e(item["id"])}" value="reprovada"> reprovar</label>
    {_campos_de_pintura(item) if item["tipo"] == "pintura" else ""}
  </fieldset>
</article>"""


PAGINA = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revisão do acervo</title>
<style>
  body {{ background:#111; color:#eee; font:15px/1.5 system-ui,sans-serif; margin:0; padding:16px; }}
  header {{ position:sticky; top:0; background:#111; padding:12px 0; border-bottom:1px solid #444; z-index:2; display:flex; gap:12px; flex-wrap:wrap; align-items:center; }}
  input[type=text], select, button {{ font:inherit; padding:8px 10px; border-radius:6px; border:1px solid #666; background:#222; color:#eee; }}
  button {{ cursor:pointer; background:#eee; color:#111; }}
  main {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; margin-top:16px; }}
  article {{ border:1px solid #333; border-radius:8px; padding:12px; }}
  article.aprovada {{ border-color:#3c8; }} article.reprovada {{ border-color:#e55; opacity:.6; }}
  .quadro {{ position:relative; }} .quadro img {{ width:100%; display:block; }}
  .caixa {{ position:absolute; border:2px solid #e55; }} .caixa.destaque {{ border-color:#3c8; }}
  .caixa b {{ position:absolute; top:-1.4em; left:0; background:#000; padding:0 4px; font-size:12px; }}
  audio {{ width:100%; }} .palavra {{ font-size:28px; margin:8px 0; }}
  .texto {{ color:#ccc; }} .meta {{ color:#999; font-size:13px; }} .meta a {{ color:#9cf; }}
  fieldset {{ border:0; padding:0; display:flex; gap:12px; flex-wrap:wrap; }} h2 {{ grid-column:1/-1; margin:16px 0 0; }}
</style></head><body>
<header>
  <label>Seu nome <input type="text" id="por" placeholder="quem está revisando"></label>
  <button id="baixar">baixar decisoes.json</button>
  <span id="conta"></span>
  <span>Salve o arquivo em <code>pipeline/revisao/decisoes.json</code> e rode <code>uv run python -m acervo montar</code>.</span>
</header>
<main>{cartoes}</main>
<script>
const anteriores = {decisoes};
const hoje = new Date().toISOString().slice(0, 10);
function conta() {{
  const feitos = document.querySelectorAll('article input[type=radio]:checked').length;
  document.getElementById('conta').textContent = feitos + ' de ' + document.querySelectorAll('article').length + ' decididos';
}}
document.querySelectorAll('article').forEach((a) => {{
  const d = anteriores[a.dataset.id];
  if (d && d.humana) {{ const r = a.querySelector('input[value="' + d.humana + '"]'); if (r) {{ r.checked = true; a.classList.add(d.humana); }} }}
  a.addEventListener('change', (e) => {{ if (e.target.type === 'radio') {{ a.classList.remove('aprovada', 'reprovada'); a.classList.add(e.target.value); conta(); }} }});
}});
conta();
document.getElementById('baixar').addEventListener('click', () => {{
  const por = document.getElementById('por').value.trim();
  if (!por) {{ alert('Escreva o seu nome: aprovação sem nome não vale.'); return; }}
  const saida = {{}};
  document.querySelectorAll('article').forEach((a) => {{
    const r = a.querySelector('input[type=radio]:checked');
    if (!r) return;
    const d = {{ humana: r.value, por, em: hoje, impressao: a.dataset.impressao }};
    a.querySelectorAll('select').forEach((s) => {{ if (s.value !== '') d[s.name] = s.name === 'destaque_manual' && s.value !== 'nenhum' ? Number(s.value) : s.value; }});
    saida[a.dataset.id] = d;
  }});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(saida, null, 1)], {{ type: 'application/json' }}));
  link.download = 'decisoes.json';
  link.click();
}});
</script></body></html>
"""


def gerar_folha(itens: list[dict], destino: Path, decisoes: dict | None = None) -> Path:
    """Grava destino/index.html. Os caminhos de mídia são relativos à raiz do projeto (../public/...)."""
    titulos = {"pintura": "Pinturas", "som": "Sons", "palavra": "Palavras"}
    blocos = []
    for tipo, titulo in titulos.items():
        do_tipo = [i for i in itens if i["tipo"] == tipo]
        if do_tipo:
            blocos.append(f"<h2>{titulo} ({len(do_tipo)})</h2>" + "".join(_cartao(i) for i in do_tipo))
    destino.mkdir(parents=True, exist_ok=True)
    pagina = destino / "index.html"
    # "</" não pode aparecer cru dentro de <script>: fecharia a tag.
    seguro = json.dumps(decisoes or {}, ensure_ascii=False).replace("</", "<\\/")
    pagina.write_text(PAGINA.format(cartoes="".join(blocos), decisoes=seguro), encoding="utf-8")
    return pagina


def aplicar_decisoes(itens: list[dict], decisoes: dict) -> tuple[list[dict], list[str]]:
    """Devolve os itens com as decisões aplicadas e os avisos sobre decisões que não valeram."""
    por_id = {i["id"]: i for i in itens}
    avisos = [f"{ident}: decisão para item que não existe" for ident in decisoes if ident not in por_id]
    saida = []
    for item in itens:
        d = decisoes.get(item["id"])
        if d is None:
            saida.append(item)
            continue
        if d.get("humana") not in ESTADOS or not str(d.get("por") or "").strip() or not d.get("em"):
            avisos.append(f"{item['id']}: decisão sem estado, nome ou data não vale")
            saida.append(item)
            continue
        # Aprovação só vale para o conteúdo que foi revisado. Reprovação vale sempre: é a decisão segura.
        if d["humana"] == "aprovada" and d.get("impressao") != impressao(item):
            avisos.append(f"{item['id']}: o item mudou depois da revisão (ou a decisão não traz impressão); volta a pendente")
            saida.append(item)
            continue
        novo = {**item, "revisao": {"humana": d["humana"], "por": str(d["por"]).strip(), "em": d["em"]}}
        if item["tipo"] == "pintura":
            if d.get("nudez") in NUDEZ and d.get("violencia") in VIOLENCIA:
                novo["sensivel"] = {"nudez": d["nudez"], "violencia": d["violencia"]}
            manual = d.get("destaque_manual")
            rostos = item.get("_rostos", [])
            if manual == "nenhum":
                novo.update({"_destaque_manual": None, "_sem_zoom": True, "rosto": None, "nitido": None})
            elif isinstance(manual, int) and 0 <= manual < len(rostos) and manual != item.get("_destaque"):
                # O recorte nítido antigo é do outro rosto; `acervo rostos` gera o novo.
                novo.update({"_destaque_manual": manual, "rosto": {k: rostos[manual][k] for k in ("x", "y", "w", "h")}, "nitido": None})
        saida.append(novo)
    return saida, avisos
