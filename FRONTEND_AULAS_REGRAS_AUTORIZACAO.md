# Frontend — Aulas: Regras de Autorização e Gestão

## Objetivo

Documentar as regras aplicadas no backend para:

- listagem/detalhe
- edição
- publicação/despublicação
- exclusão

No módulo de aulas (`/dashboard/cursos/aulas`).

---

## Perfis

Perfis de gestão aceitos nas rotas de aulas:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`

Regra especial do `INSTRUTOR`:

- só pode ver/alterar/excluir aulas com vínculo.

---

## Definição de vínculo (INSTRUTOR)

Uma aula é vinculada ao instrutor quando:

- `aula.instrutorId === usuarioLogado.id`, **ou**
- `aula.turma.instrutorId === usuarioLogado.id`

Sem vínculo:

- leitura de detalhe: `403 FORBIDDEN`
- edição/publicação/exclusão: `403 FORBIDDEN`

---

## Endpoints impactados

### 1) Listagem

`GET /api/v1/cursos/aulas`

- `INSTRUTOR` recebe apenas aulas vinculadas.
- Se `INSTRUTOR` enviar `turmaId` de turma sem vínculo, backend retorna `403 FORBIDDEN`.

### 2) Detalhe

`GET /api/v1/cursos/aulas/:id`

- `INSTRUTOR` só acessa aula vinculada.
- Sem vínculo: `403 FORBIDDEN`.

### 3) Edição

`PUT /api/v1/cursos/aulas/:id`

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: podem editar qualquer aula (respeitando regras de negócio já existentes).
- `INSTRUTOR`: apenas aula vinculada.

### 4) Publicar/Despublicar

`PATCH /api/v1/cursos/aulas/:id/publicar`

Body:

```json
{ "publicar": true }
```

ou

```json
{ "publicar": false }
```

- `INSTRUTOR`: apenas aula vinculada.
- Regras atuais de publicação/despublicação continuam valendo (`CAMPOS_OBRIGATORIOS_FALTANDO`, `DATA_INVALIDA`, `STATUS_INVALIDO`, etc.).

### 5) Exclusão

`DELETE /api/v1/cursos/aulas/:id`

- `INSTRUTOR`: apenas aula vinculada.
- Sem vínculo: `403 FORBIDDEN`.
- Regras de bloqueio existentes permanecem (`AULA_JA_REALIZADA`, `AULA_EM_ANDAMENTO`, `PRAZO_INSUFICIENTE`).

---

## Erros esperados

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 AULA_NOT_FOUND`
- `400 CAMPOS_OBRIGATORIOS_FALTANDO`
- `400 DATA_INVALIDA`
- `400 STATUS_INVALIDO`
- `400 NAO_PODE_DESPUBLICAR`
- `400 AULA_JA_REALIZADA`
- `400 AULA_EM_ANDAMENTO`
- `400 PRAZO_INSUFICIENTE`

---

## Fluxo recomendado no frontend

1. Listagem de aulas do instrutor: consumir direto sem filtro local de permissão.
2. Ao abrir detalhe/editar/publicar/excluir, tratar `403` com mensagem: `Você não tem permissão para esta aula`.
3. Em exclusão bloqueada por regra de negócio (`400`), exibir mensagem do backend.
4. Não assumir que todo instrutor pode ver toda turma/curso.

---

## Status dos testes

Cenário E2E/API validado no backend:

- arquivo: `src/__tests__/api/aulas-publicacao-exclusao.test.ts`
- resultado: `13 passed`.
