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

### A frase (Parte B do plano) — pronta

- `src/frase/`: termos permitidos, validador, compositor por regra e pré-prompt, em TypeScript, usados pelo navegador e pelo servidor.
- `src/servidor/`: a função `interpretar` (duas tentativas validadas, depois a frase por regra) e o provedor Anthropic pelo SDK oficial.
- Modelo padrão `claude-opus-5-5`, trocável por `FRASE_MODELO`. Sem `ANTHROPIC_API_KEY` a função responde só pela regra. `FRASE_PROVEDOR=nenhum` desliga o modelo.
- Medido em 12/Nov/2026:
  - 33 de 33 frases defeituosas do conjunto de regressão são rejeitadas pelo validador; 18 de 18 frases de referência são aceitas.
  - 18 de 18 frases compostas por regra com o glossário real passam no validador (6 seleções, 3 idiomas).
  - Sonda do pré-prompt com modelo real: 17 de 18 respostas aprovadas na primeira tentativa; a reprovada (zh-CN, só sons) não tinha verbo de mensagem. A tentativa de injeção plantada nas tags de um som foi tratada como dado nos três idiomas.
- NÃO PROVADO: nenhuma chamada à API de um provedor. A sonda usou um subagente da sessão de desenvolvimento, dentro de outro arnês. A taxa de violação em produção só se mede com chave.
- Revisão nativa pendente: os moldes em inglês e em mandarim (`src/frase/moldes/`) e os termos em mandarim do glossário.
