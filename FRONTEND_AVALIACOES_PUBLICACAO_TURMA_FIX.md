# Frontend — Fix Rápido: Publicação de Avaliações exige Turma

## Objetivo

Ajustar a tela:

- `/dashboard/cursos/atividades-provas/:id`

para respeitar a regra nova do backend:

- avaliação sem `turmaId` não pode ser publicada.

---

## Regra de negócio

- Se `turmaId` for `null`, a avaliação deve permanecer em `RASCUNHO`.
- Não mostrar sucesso falso ao clicar em `Publicar`.
- O frontend deve usar o status retornado pela API como fonte da verdade.

---

## Endpoint

`PATCH /api/v1/cursos/avaliacoes/:id/publicar`

Body:

```json
{ "publicar": true }
```

ou

```json
{ "publicar": false }
```

---

## Novo erro de negócio

Quando tentar publicar sem turma:

```json
{
  "success": false,
  "code": "AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA",
  "message": "Vincule uma turma antes de publicar esta avaliação."
}
```

Status HTTP:

- `409`

---

## Contrato de sucesso

Quando a API responder sucesso, usar sempre `response.data.data`:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "PUBLICADA",
    "turmaId": "uuid",
    "atualizadoEm": "2026-03-10T14:22:00.000Z"
  }
}
```

Ou, ao despublicar:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "RASCUNHO",
    "turmaId": "uuid",
    "atualizadoEm": "2026-03-10T14:22:00.000Z"
  }
}
```

---

## O que o frontend deve fazer

### 1) Desabilitar botão `Publicar` se não houver turma

Condição:

```ts
const podePublicar = Boolean(avaliacao?.turmaId);
```

Se não houver turma:

- desabilitar ação;
- ou manter habilitado, mas mostrar aviso antes da chamada;
- texto sugerido: `Vincule uma turma antes de publicar`.

### 2) Ao clicar em publicar

- chamar `PATCH /publicar`;
- se `200`, atualizar badge/status com `response.data.status`;
- se `409 AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA`, mostrar toast de erro e não alterar UI para `PUBLICADA`.

### 3) No detalhe e na listagem

Tratar a regra:

- sem `turmaId` -> status efetivo `RASCUNHO`
- com `turmaId` -> usar status retornado

---

## Exemplo de tratamento

```ts
try {
  const response = await api.patch(`/api/v1/cursos/avaliacoes/${id}/publicar`, {
    publicar: true,
  });

  const avaliacao = response.data?.data;

  updateState({
    id: avaliacao.id,
    status: avaliacao.status,
    turmaId: avaliacao.turmaId,
    atualizadoEm: avaliacao.atualizadoEm,
  });
} catch (error: any) {
  const code = error?.response?.data?.code;

  if (code === 'AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA') {
    toast.error('Vincule uma turma antes de publicar esta avaliação.');
    return;
  }

  throw error;
}
```

---

## Checklist

- [ ] Não mostrar sucesso falso ao publicar sem turma
- [ ] Badge usa status retornado pela API
- [ ] Toast de erro para `409 AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA`
- [ ] Botão `Publicar` bloqueado/ajustado quando `turmaId` for `null`
- [ ] Listagem e detalhe consistentes com a API
