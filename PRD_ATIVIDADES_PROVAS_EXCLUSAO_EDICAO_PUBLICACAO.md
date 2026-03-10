# PRD — Atividades/Provas: Exclusão, Edição, Publicação e Despublicação (v1)

## 1) Contexto

Temos o módulo de avaliações (atividades e provas) com uso nas rotas:

- `GET /api/v1/cursos/avaliacoes`
- `GET /api/v1/cursos/avaliacoes/:id`
- `POST /api/v1/cursos/avaliacoes`
- `PUT /api/v1/cursos/avaliacoes/:id`
- `DELETE /api/v1/cursos/avaliacoes/:id`

Também existem rotas legadas por turma/prova (`/:cursoId/turmas/:turmaId/provas...`).

Precisamos fechar as regras de autorização e ciclo de vida, alinhadas ao padrão aplicado em aulas.

---

## 2) Problema

- Falta contrato único para edição/publicação/despublicação/exclusão de atividades e provas.
- Precisamos garantir que `INSTRUTOR` só opere itens vinculados.
- Precisamos bloquear edição/exclusão quando a avaliação **já aconteceu**.

---

## 3) Objetivo

Definir regras únicas para:

- visualização (listagem e detalhe)
- edição
- publicação/despublicação
- exclusão

Com comportamento previsível para backend e frontend.

---

## 4) Perfis e autorização

Perfis de gestão:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`

Matriz:

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: gestão completa.
- `INSTRUTOR`: apenas avaliações vinculadas.

---

## 5) Definição de vínculo do instrutor

Avaliação vinculada quando:

- `avaliacao.instrutorId = usuarioLogado.id`; ou
- `avaliacao.turma.instrutorId = usuarioLogado.id`.

Sem vínculo:

- leitura de detalhe: `403 FORBIDDEN`
- edição/publicação/despublicação/exclusão: `403 FORBIDDEN`

---

## 6) Definição de "já aconteceu"

Uma avaliação é considerada "já aconteceu" quando **qualquer** condição for verdadeira:

1. `status` em `EM_ANDAMENTO` ou `CONCLUIDA`; ou
2. `dataInicio` + `horaInicio` <= agora (timezone do sistema); ou
3. existe envio/resposta/submissão de aluno vinculada (`enviosCount > 0`).

---

## 7) Regras de visibilidade

### 7.1 Listagem

`GET /api/v1/cursos/avaliacoes`

- `INSTRUTOR` vê apenas avaliações vinculadas.
- Filtro explícito de turma sem vínculo deve retornar `403 FORBIDDEN`.
- Não pode haver vazamento por filtros (`cursoId`, `turmaId`, `instrutorId`, etc.).

### 7.2 Detalhe

`GET /api/v1/cursos/avaliacoes/:id`

- `INSTRUTOR` só acessa se houver vínculo.
- Sem vínculo: `403 FORBIDDEN`.

---

## 8) Regras de edição

`PUT /api/v1/cursos/avaliacoes/:id`

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: podem editar quando avaliação ainda não aconteceu.
- `INSTRUTOR`: pode editar apenas avaliação vinculada e ainda não acontecida.
- Se já aconteceu: bloquear edição para todos os perfis de gestão.

Erro sugerido:

- `409 AVALIACAO_JA_INICIADA_OU_REALIZADA`

---

## 9) Regras de publicação/despublicação

## 9.1 Rota recomendada (nova)

`PATCH /api/v1/cursos/avaliacoes/:id/publicar`

Body:

```json
{ "publicar": true }
```

ou

```json
{ "publicar": false }
```

## 9.2 Regras

- Publicar permitido para gestão (com vínculo para `INSTRUTOR`) se avaliação não aconteceu e requisitos obrigatórios estiverem completos.
- Despublicar permitido apenas se avaliação não aconteceu.
- Se já aconteceu: bloquear publicar/despublicar.

Erros sugeridos:

- `400 CAMPOS_OBRIGATORIOS_FALTANDO`
- `400 DATA_INVALIDA`
- `409 AVALIACAO_JA_INICIADA_OU_REALIZADA`
- `403 FORBIDDEN`

> Compatibilidade: até criar `PATCH /publicar`, manter via `PUT` com troca de `status`, aplicando as mesmas validações.

---

## 10) Regras de exclusão

`DELETE /api/v1/cursos/avaliacoes/:id`

### 10.1 Tipo

- Exclusão lógica (soft delete) recomendada:
  - `deletedAt`
  - `deletedById`
  - `status = CANCELADA`

### 10.2 Permissão

- `ADMIN`, `MODERADOR`, `PEDAGOGICO`: podem excluir se não aconteceu.
- `INSTRUTOR`: pode excluir apenas vinculada e se não aconteceu.
- Sem vínculo: `403 FORBIDDEN`.

### 10.3 Bloqueios

- Se já aconteceu (regras da seção 6), bloquear exclusão.

Erro sugerido:

- `409 AVALIACAO_JA_INICIADA_OU_REALIZADA`

---

## 11) Contrato de erro esperado

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 AVALIACAO_NOT_FOUND`
- `400 CAMPOS_OBRIGATORIOS_FALTANDO`
- `400 DATA_INVALIDA`
- `409 AVALIACAO_JA_INICIADA_OU_REALIZADA`
- `400 STATUS_INVALIDO`

---

## 12) Compatibilidade

- Manter rotas atuais sem quebra.
- Aplicar regras novas no fluxo principal de `/avaliacoes`.
- Rotas legadas de `/provas` devem herdar as mesmas políticas progressivamente.

---

## 13) Critérios de aceite

- [ ] `INSTRUTOR` não visualiza avaliações sem vínculo.
- [ ] `INSTRUTOR` não edita/publica/despublica/exclui sem vínculo (`403`).
- [ ] Avaliação que já aconteceu não pode ser editada/excluída/despublicada.
- [ ] Perfis `ADMIN`, `MODERADOR`, `PEDAGOGICO` mantêm gestão completa respeitando bloqueio temporal.
- [ ] Sem regressão nas rotas atuais.

---

## 14) Testes E2E mínimos

1. Instrutor lista avaliações: só vinculadas.
2. Instrutor abre detalhe não vinculado: `403`.
3. Instrutor tenta editar não vinculada: `403`.
4. Instrutor tenta excluir não vinculada: `403`.
5. Admin tenta editar avaliação já iniciada: `409 AVALIACAO_JA_INICIADA_OU_REALIZADA`.
6. Admin tenta excluir avaliação com envios: `409 AVALIACAO_JA_INICIADA_OU_REALIZADA`.
7. Instrutor edita avaliação vinculada futura: `200`.
8. Instrutor exclui avaliação vinculada futura sem envios: `200`.

---

## 15) Plano de rollout

1. Implementar validação de vínculo para leitura/edição/exclusão/publicação.
2. Implementar regra central `jaAconteceu` no serviço.
3. Implementar `PATCH /avaliacoes/:id/publicar` (ou consolidar no `PUT` com contrato claro).
4. Adicionar soft delete em avaliações (se ainda não existir).
5. Atualizar frontend com tratamento de `403` e `409`.
6. Cobrir com testes E2E.
