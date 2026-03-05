# Frontend — Exclusão Definitiva de Curso (Soft Delete)

## Objetivo

Documentar o novo fluxo de exclusão de curso no dashboard, separado do fluxo de despublicação.

---

## Rotas

### 1) Excluir curso (novo)

`DELETE /api/v1/cursos/:cursoId/exclusao-definitiva`

Permissões:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

Regras:

- Só exclui se o curso **não tiver nenhuma turma vinculada**.
- Se existir qualquer turma (inclusive `CONCLUIDO` ou `CANCELADO`), retorna bloqueio `409`.

Resposta de sucesso:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "excluidoEm": "2026-03-05T15:10:00.000Z",
    "excluidoPorId": "uuid"
  }
}
```

Resposta de bloqueio:

```json
{
  "success": false,
  "code": "CURSO_EXCLUSAO_BLOQUEADA_TURMAS_VINCULADAS",
  "message": "Não é possível excluir curso com turmas vinculadas. Use despublicar/arquivar.",
  "details": [
    {
      "id": "uuid-turma",
      "codigo": "DEV-FULL-T1",
      "nome": "Turma 1",
      "status": "EM_ANDAMENTO"
    }
  ]
}
```

Erros esperados:

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 CURSO_NOT_FOUND`
- `409 CURSO_EXCLUSAO_BLOQUEADA_TURMAS_VINCULADAS`

---

### 2) Despublicar/Arquivar (já existente)

`DELETE /api/v1/cursos/:cursoId`

Observação:

- Esta rota **não é exclusão**.
- Ela mantém o fluxo de despublicar/arquivar.

---

## Impacto nas listagens

- Cursos excluídos logicamente não aparecem por padrão em:
  - `GET /api/v1/cursos`
  - `GET /api/v1/cursos/:cursoId`
  - rotas públicas de curso

- Para perfis de gestão (`ADMIN`, `MODERADOR`, `PEDAGOGICO`), a listagem aceita:
  - `GET /api/v1/cursos?includeExcluidos=true`

---

## Fluxo recomendado no frontend

1. Botão `Excluir curso` chama `DELETE /api/v1/cursos/:cursoId/exclusao-definitiva`.
2. Se `200`, mostrar sucesso e remover item da lista.
3. Se `409`, abrir modal com mensagem de bloqueio e listar `details[]` (turmas vinculadas).
4. No `409`, oferecer ação alternativa `Despublicar/Arquivar` usando rota antiga.
5. Em `403`, exibir mensagem de permissão.

---

## Exemplo (axios/fetch)

```ts
await api.delete(`/api/v1/cursos/${cursoId}/exclusao-definitiva`);
```

Tratamento de bloqueio:

```ts
if (
  error?.response?.status === 409 &&
  error?.response?.data?.code === 'CURSO_EXCLUSAO_BLOQUEADA_TURMAS_VINCULADAS'
) {
  const turmas = error.response.data.details ?? [];
  // exibir no modal
}
```
