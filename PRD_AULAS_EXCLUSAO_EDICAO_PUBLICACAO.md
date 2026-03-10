# PRD — Aulas: Exclusão, Edição, Publicação e Despublicação (v1)

## 1) Contexto

Temos o módulo de aulas em:

- `GET /api/v1/cursos/aulas`
- `GET /api/v1/cursos/aulas/:id`
- `POST /api/v1/cursos/aulas`
- `PUT /api/v1/cursos/aulas/:id`
- `PATCH /api/v1/cursos/aulas/:id/publicar`
- `DELETE /api/v1/cursos/aulas/:id`

Agora precisamos formalizar regras de autorização e visibilidade por role, com foco no perfil `INSTRUTOR`.

---

## 2) Problema

- Falta contrato fechado de governança para ações de gestão de aulas.
- Precisamos garantir que `INSTRUTOR`:
  - não exclua aula sem vínculo;
  - não visualize aulas sem vínculo.

---

## 3) Objetivo

Definir regras únicas para:

- visualização;
- edição;
- publicação/despublicação;
- exclusão (soft delete) de aulas.

Com comportamento previsível para frontend e backend.

---

## 4) Perfis e autorização

Perfis de gestão:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`

Matriz de acesso:

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: acesso total de gestão.
- `INSTRUTOR`: acesso **somente** às aulas vinculadas.

---

## 5) Definição de vínculo do instrutor

Uma aula é considerada vinculada ao instrutor quando pelo menos uma condição for verdadeira:

- `aula.instrutorId = usuarioLogado.id`; ou
- `aula.turma.instrutorId = usuarioLogado.id`.

Se não houver vínculo, acesso negado.

---

## 6) Regras de visibilidade (leitura)

### 6.1 Listagem

`GET /api/v1/cursos/aulas`

- Para `INSTRUTOR`, backend deve filtrar sempre para aulas vinculadas.
- Mesmo com filtros (`turmaId`, `cursoId`, etc.), não pode vazar aula não vinculada.
- Se `INSTRUTOR` filtrar explicitamente uma turma sem vínculo, retornar `403 FORBIDDEN`.

### 6.2 Detalhe

`GET /api/v1/cursos/aulas/:id`

- `INSTRUTOR` só acessa se a aula for vinculada.
- Sem vínculo: `403 FORBIDDEN`.

---

## 7) Regras de edição

`PUT /api/v1/cursos/aulas/:id`

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: podem editar qualquer aula.
- `INSTRUTOR`: pode editar apenas aula vinculada.
- Aula concluída mantém restrições atuais de negócio (sem regressão).

---

## 8) Regras de publicação/despublicação

`PATCH /api/v1/cursos/aulas/:id/publicar` (`{ publicar: boolean }`)

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: podem publicar/despublicar qualquer aula.
- `INSTRUTOR`: pode publicar/despublicar apenas aula vinculada.
- Regras já existentes continuam:
  - não despublicar `EM_ANDAMENTO`/`CONCLUIDA`;
  - validar campos obrigatórios para publicação por modalidade.

---

## 9) Regras de exclusão

`DELETE /api/v1/cursos/aulas/:id`

### 9.1 Tipo de exclusão

- Exclusão lógica (soft delete): marcar `deletedAt`, `deletedBy`, `status=CANCELADA`.

### 9.2 Permissão

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: podem excluir qualquer aula elegível.
- `INSTRUTOR`: pode excluir somente aula vinculada.
- Sem vínculo: `403 FORBIDDEN`.

### 9.3 Regras de bloqueio (negócio)

Mantém regras atuais:

- aula já realizada: bloqueia;
- aula em andamento: bloqueia;
- prazo mínimo de antecedência (quando aplicável): bloqueia;
- aula obrigatória com progresso concluído: restrição adicional por role (sem regressão).

---

## 10) Contrato de erro esperado

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 AULA_NOT_FOUND`
- `400 AULA_JA_REALIZADA`
- `400 AULA_EM_ANDAMENTO`
- `400 PRAZO_INSUFICIENTE`

---

## 11) Compatibilidade

- Mantém endpoints atuais (sem quebra de rota).
- A mudança principal é de regra de autorização para `INSTRUTOR` em `DELETE` e blindagem de visibilidade.

---

## 12) Critérios de aceite

- [ ] `INSTRUTOR` não visualiza aulas sem vínculo (listagem e detalhe).
- [ ] `INSTRUTOR` não exclui aula sem vínculo (`403`).
- [ ] `INSTRUTOR` consegue editar/publicar/despublicar/excluir apenas aulas vinculadas e elegíveis.
- [ ] `ADMIN`, `MODERADOR`, `PEDAGOGICO` mantêm gestão completa.
- [ ] Regras atuais de bloqueio de exclusão/publicação continuam válidas.

---

## 13) Testes E2E mínimos

- Instrutor lista aulas: retorna apenas vinculadas.
- Instrutor tenta `GET /aulas/:id` de aula não vinculada: `403`.
- Instrutor tenta `DELETE /aulas/:id` de aula não vinculada: `403`.
- Instrutor exclui aula vinculada elegível: `200`.
- Admin exclui aula elegível: `200`.
- Exclusão de aula já realizada: `400 AULA_JA_REALIZADA`.
