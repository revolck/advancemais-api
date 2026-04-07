# Frontend — Overview do Dashboard com Consistência de Totais

## Objetivo

Padronizar o consumo do card:

- `Total de Usuários` em `/dashboard`

para bater com o total da listagem:

- `/dashboard/usuarios`

no mesmo login/contexto de permissão.

Também alinhar o comportamento de vagas expiradas para que vagas com inscrição vencida não continuem aparecendo como `PUBLICADA`.

---

## Rota de overview

`GET /api/v1/dashboard/overview`

Perfis permitidos:

- `ADMIN`
- `MODERADOR`
- `SETOR_DE_VAGAS`
- `RECRUTADOR`

---

## Contrato de resposta

```json
{
  "success": true,
  "data": {
    "metricasGerais": {
      "totalUsuarios": 108,
      "totalCursos": 14,
      "totalEmpresas": 7,
      "totalVagas": 1
    },
    "cards": {
      "cursos": {
        "total": 14,
        "publicados": 0,
        "turmasAtivas": 0
      },
      "alunos": {
        "total": 5,
        "concluidos": 0
      },
      "instrutores": {
        "total": 17,
        "ativos": 1
      },
      "empresas": {
        "total": 7,
        "ativas": 7
      },
      "vagas": {
        "publicadas": 1,
        "emAnalise": 0,
        "encerradas": 9
      }
    },
    "usuariosPorTipo": {
      "total": 108,
      "items": [
        {
          "role": "ALUNO_CANDIDATO",
          "label": "Alunos",
          "total": 5,
          "percentual": 4.6
        }
      ]
    },
    "statusPorCategoria": {
      "usuarios": {
        "ativo": 90,
        "bloqueado": 2,
        "inativo": 6,
        "pendente": 8,
        "suspenso": 2,
        "total": 108
      },
      "cursos": {
        "publicado": 0,
        "encerrado": 0
      },
      "empresas": {
        "ativo": 7,
        "bloqueado": 0
      },
      "vagas": {
        "publicado": 1,
        "encerrado": 9
      }
    },
    "atualizadoEm": "2026-04-03T16:00:00.000Z"
  }
}
```

---

## Regra de consistência (Total de Usuários)

No mesmo contexto de autenticação:

- `data.metricasGerais.totalUsuarios` (overview)
- deve ser igual a `pagination.total` de:
- `GET /api/v1/usuarios/usuarios?page=1&limit=10`

---

## Regra de vagas expiradas

Antes de montar métricas/listagens administrativas, o backend sincroniza vagas:

- `status = PUBLICADO` **e** `inscricoesAte < now`
- passam para `status = EXPIRADO`

Impacto esperado:

- vaga vencida deixa de aparecer como `Publicada`
- cards e gráficos de vagas passam a refletir o status correto

---

## Impacto no frontend

1. manter o card `Total de Usuários` lendo:
   - `data.metricasGerais.totalUsuarios`
2. manter listagem `/dashboard/usuarios` como fonte comparável de total:
   - `pagination.total`
3. usar `cards.vagas.publicadas` e `statusPorCategoria.vagas` para visualizações de status
4. não assumir que vaga com `inscricoesAte` vencida continuará `PUBLICADA`
5. para validação de consistência de usuários:
   - `statusPorCategoria.usuarios.total` deve ser igual a `metricasGerais.totalUsuarios`

---

## Checklist frontend

- [ ] consumir `GET /api/v1/dashboard/overview`
- [ ] renderizar `metricasGerais.totalUsuarios` no card
- [ ] manter comparação funcional com total de `/dashboard/usuarios`
- [ ] ajustar UI de vagas para respeitar retorno já sincronizado (`EXPIRADO`)
- [ ] não manter cache local de status de vaga sem revalidação
