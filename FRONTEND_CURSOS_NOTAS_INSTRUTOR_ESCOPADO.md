# Frontend — Notas do `INSTRUTOR` em `/dashboard/cursos/notas`

## Status

Backend liberado.

O usuário com:

- `role = INSTRUTOR`

já pode acessar e operar a tela:

- `/dashboard/cursos/notas`

com dados escopados pelos vínculos ativos do instrutor.

---

## Perfis permitidos

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`

Demais perfis:

- `403 FORBIDDEN`

---

## Regra oficial de escopo do instrutor

O backend monta o escopo do `INSTRUTOR` usando a união de vínculos ativos:

- `AULA`
- `TURMA`
- `CURSO`

Regras aplicadas:

- nenhuma nota fora do vínculo entra nas respostas
- nenhum aluno fora do escopo aparece na listagem de notas
- vínculos sobrepostos são deduplicados no backend
- quando o instrutor não possui vínculo ativo, a API responde com sucesso e lista vazia

---

## Regra crítica de precedência por origem

Para notas ligadas a origens com dono explícito:

- `AULA.instrutorId`
- `PROVA.instrutorId`
- `ATIVIDADE.instrutorId`

esse dono da origem prevalece sobre vínculo amplo de:

- `TURMA`
- `CURSO`

Na prática:

- um instrutor vinculado à turma não pode ver nem operar nota de `AULA`, `PROVA` ou `ATIVIDADE` que pertença a outro instrutor
- um instrutor com vínculo direto na origem vê apenas as notas daquela origem dentro do próprio escopo
- origens neutras da turma continuam visíveis para quem tem escopo amplo da turma/curso

Exemplo:

- instrutor `A` vinculado na `TURMA`
- instrutor `B` vinculado em uma `PROVA` específica da mesma turma

Resultado:

- instrutor `A` não vê nem lança nota naquela `PROVA` do instrutor `B`
- instrutor `B` vê e opera apenas a nota da própria `PROVA`

---

## Endpoints prontos para o frontend

### 1. Listagem geral de notas

`GET /api/v1/cursos/notas`

Para `INSTRUTOR`:

- retorna apenas notas dentro do escopo dele
- nunca retorna listagem global fora do escopo

### 2. Listagem por curso

`GET /api/v1/cursos/:cursoId/notas`

Para `INSTRUTOR`:

- retorna apenas notas visíveis dentro do curso e do escopo dele

### 3. Lançamento manual

`POST /api/v1/cursos/:cursoId/turmas/:turmaId/notas`

Para `INSTRUTOR`:

- permitido apenas dentro do próprio escopo
- retorna `403 FORBIDDEN` fora do escopo

### 4. Remoção em lote de lançamentos manuais

`DELETE /api/v1/cursos/:cursoId/turmas/:turmaId/notas`

Para `INSTRUTOR`:

- só permite limpar lançamentos manuais quando todos os registros envolvidos estiverem no escopo dele
- se existir nota manual fora do escopo, a operação retorna `403 FORBIDDEN`

### 5. Histórico de nota

`GET /api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId/historico`

Para `INSTRUTOR`:

- retorna apenas histórico de notas dentro do próprio escopo
- retorna `403 FORBIDDEN` quando a nota estiver fora do escopo

### 6. Detalhe por inscrição

`GET /api/v1/cursos/inscricoes/:inscricaoId/notas`

Para `INSTRUTOR`:

- a inscrição só pode ser consultada quando a turma estiver no escopo dele
- o payload `notas[]` já vem filtrado pelo mesmo critério de origem

---

## Contrato para o frontend

O contrato principal da tela foi preservado.

Campos usados hoje na listagem:

- `cursoId`
- `cursoNome`
- `turmaId`
- `turmaNome`
- `turmaCodigo`
- `inscricaoId`
- `alunoId`
- `alunoNome`
- `nota`
- `atualizadoEm`
- `motivo`
- `origem`
- `isManual`
- `history[]`

Importante:

- o frontend não precisa recalcular escopo
- o backend já devolve apenas itens autorizados para o instrutor autenticado
- `nota`, `history[]`, `notaId` e `historicoNotaId` já respeitam o mesmo escopo do instrutor

---

## Estado vazio válido

Quando o instrutor não tiver vínculo ativo:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "requestedPage": 1,
      "pageSize": 10,
      "total": 0,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false,
      "isPageAdjusted": false
    }
  }
}
```

Esse retorno deve ser tratado como estado vazio normal da tela.

---

## Tratamento de erros

Erros esperados:

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404` para recurso inexistente no contexto informado
- `500 INSTRUTOR_SCOPE_ERROR`

Exemplo:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso a esta nota."
}
```

Observação prática:

- em listagens de `INSTRUTOR` sem vínculo ativo, o backend responde com sucesso e lista vazia
- em histórico, detalhe e operações fora do escopo, o backend responde `403 FORBIDDEN`

---

## Comportamento esperado na tela

O frontend pode manter o fluxo atual da página.

O que muda na prática:

1. autenticar com usuário `INSTRUTOR`
2. consumir os mesmos endpoints já usados hoje pela tela
3. confiar nas respostas já escopadas pela API
4. renderizar lista vazia quando o instrutor não tiver vínculo
5. tratar `403` como acesso fora do escopo

Não é necessário montar escopo manual no frontend.

Importante:

- não assumir que vínculo de `TURMA` ou `CURSO` dá acesso a toda nota da turma
- `AULA`, `PROVA` e `ATIVIDADE` com dono explícito podem ficar invisíveis para o instrutor amplo da turma

---

## Cenários validados no backend

- instrutor sem vínculo com retorno vazio válido
- instrutor com vínculo por `TURMA`
- instrutor com vínculo parcial por `PROVA`
- instrutor com vínculo parcial por `AULA`
- listagem geral escopada
- listagem por curso escopada
- histórico bloqueado fora do escopo
- lançamento manual permitido apenas dentro do próprio escopo
- instrutor da turma bloqueado em origem com outro instrutor dono
- limpeza de lançamentos manuais bloqueada quando houver registros fora do escopo

---

## Checklist frontend

- [ ] permitir `/dashboard/cursos/notas` para `INSTRUTOR`
- [ ] consumir normalmente `GET /api/v1/cursos/notas`
- [ ] consumir normalmente `GET /api/v1/cursos/:cursoId/notas`
- [ ] consumir normalmente `GET /api/v1/cursos/:cursoId/turmas/:turmaId/notas/:notaId/historico`
- [ ] tratar lista vazia como estado válido
- [ ] tratar `403` como acesso fora do escopo
- [ ] não assumir que vínculo de `TURMA` ou `CURSO` dá acesso a toda nota da turma
- [ ] não tentar complementar escopo manualmente no frontend
