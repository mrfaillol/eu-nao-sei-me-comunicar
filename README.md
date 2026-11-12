# Eu Não Sei Me Comunicar

Obra interativa em fundo preto. A pessoa faz três escolhas entre pinturas, sons e palavras e recebe uma frase, em segunda pessoa, que descreve o que a seleção comunica. Idiomas: pt-BR, en, zh-CN.

- Desenho: `docs/superpowers/specs/2026-11-12-eu-nao-sei-me-comunicar-design.md`
- Plano: `docs/superpowers/plans/2026-11-12-eu-nao-sei-me-comunicar.md`
- Fatos conferidos: `docs/pesquisa/dossie.md`

## Rodar os testes

```bash
pnpm install && pnpm test          # frase e site (TypeScript)
cd pipeline && uv run pytest -q    # acervo (Python 3.12)
```

Teste que usa rede leva o marcador `rede` e só roda com `uv run pytest -m rede`.

## Estado

Em construção. Esta seção é atualizada a cada parte entregue.
