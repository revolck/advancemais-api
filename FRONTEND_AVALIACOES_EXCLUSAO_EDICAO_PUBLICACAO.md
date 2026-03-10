# Frontend — Avaliações/Provas: Novas Regras de Gestão

## Objetivo

Consolidar o contrato do frontend para avaliações/provas em:

- visualização
- edição
- publicação/despublicação
- exclusão lógica

Base: `GET|POST|PUT|PATCH|DELETE /api/v1/cursos/avaliacoes`

---

## Perfis e acesso

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: gestão completa (respeitando bloqueios de negócio).
- `INSTRUTOR`: só opera avaliações com vínculo.

### Vínculo do instrutor

Uma avaliação é vinculada quando:

- `avaliacao.instrutorId === usuarioLogado.id`, ou
- `avaliacao.turma.instrutorId === usuarioLogado.id`.

Sem vínculo:

- `GET /api/v1/cursos/avaliacoes/:id` -> `403 FORBIDDEN`
- `PUT /api/v1/cursos/avaliacoes/:id` -> `403 FORBIDDEN`
- `PATCH /api/v1/cursos/avaliacoes/:id/publicar` -> `403 FORBIDDEN`
- `DELETE /api/v1/cursos/avaliacoes/:id` -> `403 FORBIDDEN`

---

## Endpoints e regras

### 1) Listagem

`GET /api/v1/cursos/avaliacoes`

- `INSTRUTOR` recebe somente avaliações vinculadas.
- Se `INSTRUTOR` enviar `turmaId` sem vínculo, backend responde `403 FORBIDDEN`.
- Por padrão, status `CANCELADA` não aparece na listagem.

### 2) Detalhe

`GET /api/v1/cursos/avaliacoes/:id`

- `INSTRUTOR` só acessa item vinculado.

### 3) Edição

`PUT /api/v1/cursos/avaliacoes/:id`

- Permitida somente quando a avaliação ainda não aconteceu.
- Se já aconteceu, retorna:
  - `409 AVALIACAO_JA_INICIADA_OU_REALIZADA`

### 4) Publicar/Despublicar

`PATCH /api/v1/cursos/avaliacoes/:id/publicar`

Body:

```json
{ "publicar": true }
```

ou

```json
{ "publicar": false }
```

Regras:

- só pode publicar/despublicar se ainda não aconteceu;
- ao publicar, valida dados obrigatórios;
- ao publicar, a avaliação precisa ter `turmaId` válido;
- sem turma vinculada, a API bloqueia a publicação e o item deve continuar em `RASCUNHO`;
- instrutor precisa de vínculo.

Erros comuns:

- `400 CAMPOS_OBRIGATORIOS_FALTANDO`
- `400 DATA_INVALIDA`
- `400 STATUS_INVALIDO`
- `403 FORBIDDEN`
- `409 AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA`
- `409 AVALIACAO_JA_INICIADA_OU_REALIZADA`

Resposta de sucesso:

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

Observações:

- o campo `data.status` sempre reflete o status final persistido;
- a resposta também mantém `avaliacao` por compatibilidade, mas o frontend deve preferir `data`;
- se `publicar=false`, o retorno vem com status final `RASCUNHO`.

Erro de negócio sem turma:

```json
{
  "success": false,
  "code": "AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA",
  "message": "Vincule uma turma antes de publicar esta avaliação."
}
```

### 5) Exclusão

`DELETE /api/v1/cursos/avaliacoes/:id`

Não remove fisicamente; faz cancelamento lógico:

- `status = CANCELADA`
- `ativo = false`

Bloqueio:

- se já aconteceu -> `409 AVALIACAO_JA_INICIADA_OU_REALIZADA`

---

## Regra “já aconteceu”

O backend considera que já aconteceu quando qualquer condição for verdadeira:

- status `EM_ANDAMENTO` ou `CONCLUIDA`;
- `dataInicio + horaInicio <= agora`;
- existe envio/submissão de aluno (`CursosTurmasProvasEnvios`).

---

## Normalização de legado

Existe tratamento no backend para registros antigos inconsistentes:

- se o banco tiver `status = PUBLICADA` e `turmaId = null`, a API normaliza a resposta para `RASCUNHO`;
- esse item não deve aparecer como `PUBLICADA` na listagem;
- em detalhe e listagem, a regra final é sempre:
  - sem `turmaId` -> `RASCUNHO`
  - com `turmaId` -> pode ser `PUBLICADA`, respeitando as demais validações

---

## Contrato de erros esperado

- `400 VALIDATION_ERROR`
- `400 CAMPOS_OBRIGATORIOS_FALTANDO`
- `400 DATA_INVALIDA`
- `400 STATUS_INVALIDO`
- `403 FORBIDDEN`
- `404 AVALIACAO_NOT_FOUND`
- `409 AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA`
- `409 AVALIACAO_JA_INICIADA_OU_REALIZADA`

---

## Implementação recomendada no frontend

1. Não aplicar filtro local de permissão para instrutor; confiar na API.
2. Tratar `403` com mensagem de falta de permissão.
3. Tratar `409 AVALIACAO_PUBLICACAO_EXIGE_TURMA_VINCULADA` com CTA para vincular turma antes de publicar.
4. Tratar `409 AVALIACAO_JA_INICIADA_OU_REALIZADA` como bloqueio de negócio.
5. Usar `PATCH /publicar` para troca de publicação, não `PUT` para esse caso.
6. Após `PATCH /publicar`, atualizar a UI usando `response.data.status` e `response.data.turmaId`.

Exemplos:

```ts
await api.patch(`/api/v1/cursos/avaliacoes/${id}/publicar`, { publicar: true });
await api.delete(`/api/v1/cursos/avaliacoes/${id}`);
```

---

## Status de validação

Coberto por testes API/E2E do backend:

- `src/__tests__/api/avaliacoes-form-helpers.test.ts`
- `src/__tests__/api/avaliacoes-edicao-publicada-lock.e2e.test.ts`
