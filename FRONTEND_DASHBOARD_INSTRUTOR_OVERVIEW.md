# Frontend — Visão Geral do `INSTRUTOR` em `/dashboard`

## Objetivo

Documentar o consumo da visão geral do dashboard para usuário logado com:

- `role = INSTRUTOR`

Nessa condição, o frontend deve consumir:

- `GET /api/v1/instrutor/overview`

---

## Rota

`GET /api/v1/instrutor/overview`

Perfis permitidos:

- `INSTRUTOR`

---

## Regra de escopo

O backend calcula o overview usando a união dos vínculos ativos do instrutor:

- `AULA`
- `TURMA`
- `CURSO`

Comportamento obrigatório:

- deduplicação de entidades sobrepostas (alunos, turmas, cursos, aulas e provas)
- nenhum dado fora do vínculo entra nas métricas

---

## Resposta

```json
{
  "success": true,
  "data": {
    "metricasGerais": {
      "totalAlunos": 12,
      "totalProvas": 6,
      "totalNotasPendentes": 4,
      "totalNotasLancadas": 18,
      "totalCursos": 2,
      "totalTurmas": 3,
      "totalAulas": 14,
      "totalEventosAgenda": 5
    },
    "cards": {
      "alunos": {
        "total": 12,
        "ativos": 10
      },
      "provas": {
        "total": 6,
        "pendentesCorrecao": 2
      },
      "notas": {
        "pendentes": 4,
        "lancadas": 18
      },
      "cursos": {
        "total": 2
      },
      "aulas": {
        "total": 14,
        "hoje": 2
      },
      "agenda": {
        "eventos": 5,
        "proximos7Dias": 3
      }
    },
    "statusPorCategoria": {
      "alunos": {
        "ativos": 10,
        "inativos": 2,
        "total": 12
      },
      "provas": {
        "abertas": 2,
        "encerradas": 4,
        "total": 6
      },
      "notas": {
        "pendentes": 4,
        "concluidas": 18,
        "total": 22
      },
      "aulas": {
        "agendadas": 5,
        "realizadas": 9,
        "total": 14
      }
    },
    "atualizadoEm": "2026-04-03T20:00:00.000Z"
  }
}
```

---

## Estado vazio válido

Quando o instrutor não possuir vínculo ativo:

```json
{
  "success": true,
  "data": {
    "metricasGerais": {
      "totalAlunos": 0,
      "totalProvas": 0,
      "totalNotasPendentes": 0,
      "totalNotasLancadas": 0,
      "totalCursos": 0,
      "totalTurmas": 0,
      "totalAulas": 0,
      "totalEventosAgenda": 0
    },
    "cards": {
      "alunos": { "total": 0, "ativos": 0 },
      "provas": { "total": 0, "pendentesCorrecao": 0 },
      "notas": { "pendentes": 0, "lancadas": 0 },
      "cursos": { "total": 0 },
      "aulas": { "total": 0, "hoje": 0 },
      "agenda": { "eventos": 0, "proximos7Dias": 0 }
    },
    "statusPorCategoria": {
      "alunos": { "ativos": 0, "inativos": 0, "total": 0 },
      "provas": { "abertas": 0, "encerradas": 0, "total": 0 },
      "notas": { "pendentes": 0, "concluidas": 0, "total": 0 },
      "aulas": { "agendadas": 0, "realizadas": 0, "total": 0 }
    },
    "atualizadoEm": "2026-04-03T20:00:00.000Z"
  }
}
```

---

## Tratamento de erros

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `500 INSTRUTOR_SCOPE_ERROR`

Exemplo:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso a esta visão geral."
}
```

---

## Fluxo recomendado no frontend

1. detectar `role = INSTRUTOR`
2. manter a página `/dashboard`
3. trocar consumo para `GET /api/v1/instrutor/overview`
4. renderizar cards/gráficos com `metricasGerais`, `cards` e `statusPorCategoria`
5. exibir estado vazio quando totais vierem zerados

---

## Checklist frontend

- [ ] detectar `INSTRUTOR` no usuário logado
- [ ] consumir `GET /api/v1/instrutor/overview`
- [ ] renderizar `metricasGerais`
- [ ] renderizar `cards`
- [ ] renderizar `statusPorCategoria`
- [ ] tratar `401`, `403` e `500 INSTRUTOR_SCOPE_ERROR`
