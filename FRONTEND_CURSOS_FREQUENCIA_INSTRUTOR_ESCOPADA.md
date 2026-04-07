# Frontend — Frequência do `INSTRUTOR` em `/dashboard/cursos/frequencia`

## Status

Backend liberado.

O usuário com:

- `role = INSTRUTOR`

já pode acessar e operar a tela:

- `/dashboard/cursos/frequencia`

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

- nenhum curso, turma, aula, prova, atividade, frequência ou aluno fora do vínculo entra nas respostas
- vínculos sobrepostos são deduplicados no backend
- em frequência, `AULA`, `PROVA` e `ATIVIDADE` com `instrutorId` de outro instrutor têm precedência sobre vínculo amplo de `TURMA` ou `CURSO`
- instrutor vinculado à `TURMA` ou ao `CURSO` só atua nas origens sem dono explícito ou diretamente atribuídas a ele
- lançamento e edição de presença só são permitidos dentro do próprio escopo
- quando o instrutor não possui vínculo ativo, a API responde com sucesso e listas vazias

### Regra crítica de precedência

Se existir instrutor explicitamente vinculado à origem:

- `AULA.instrutorId`
- `PROVA.instrutorId`
- `ATIVIDADE.instrutorId`

esse vínculo da origem prevalece para frequência.

Exemplo:

- instrutor `A` vinculado na `TURMA`
- instrutor `B` vinculado em uma `AULA` específica da mesma turma

Resultado:

- o instrutor `A` continua vendo e operando apenas as origens neutras da turma e as que forem dele
- o instrutor `A` não pode listar, resumir, lançar nem editar frequência da `AULA` do instrutor `B`
- o instrutor `B` pode operar apenas a própria origem vinculada e o que mais estiver diretamente no escopo dele

---

## Endpoints prontos para o frontend

### 1. Cursos

`GET /api/v1/cursos`

Para `INSTRUTOR`, retorna apenas cursos acessíveis pelo escopo dele.

Se `includeTurmas=true`, as turmas também já vêm filtradas.

### 2. Turmas do curso

`GET /api/v1/cursos/:cursoId/turmas`

Para `INSTRUTOR`, retorna apenas turmas acessíveis dentro do curso.

### 3. Aulas

`GET /api/v1/cursos/aulas?turmaId=:turmaId`

Para `INSTRUTOR`:

- se tiver escopo completo da turma, vê as aulas da turma exceto as que possuem outro instrutor explicitamente vinculado
- se tiver vínculo parcial, vê apenas as aulas diretamente vinculadas

### 4. Provas e atividades

`GET /api/v1/cursos/:cursoId/turmas/:turmaId/provas`

Para `INSTRUTOR`:

- se tiver escopo completo da turma, vê provas e atividades da turma exceto as que possuem outro instrutor explicitamente vinculado
- se tiver vínculo parcial, vê apenas as avaliações diretamente vinculadas

### 5. Listagem geral de frequência

`GET /api/v1/cursos/frequencias`

Retorna apenas frequências e pendências dentro do escopo do instrutor.

Importante:

- registros ligados a origem com dono explícito de outro instrutor não aparecem, mesmo que o usuário tenha vínculo de `TURMA` ou `CURSO`

### 6. Listagem por curso/turma

`GET /api/v1/cursos/:cursoId/turmas/:turmaId/frequencias`

Retorna apenas registros visíveis no escopo do instrutor.

### 7. Resumo por aluno

`GET /api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/resumo`

O resumo também respeita o escopo do instrutor.

Importante:

- para vínculo parcial, o total de aulas considera apenas as aulas acessíveis ao instrutor
- para vínculo de `TURMA` ou `CURSO`, aulas com outro instrutor dono não entram no total nem nos agregados

### 8. Lançamento manual

`POST /api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/lancamentos`

Permitido apenas para origens dentro do escopo.

Observação:

- instrutor de `TURMA` ou `CURSO` recebe `403` ao tentar lançar presença em origem com `instrutorId` de outro instrutor

### 9. Edição pontual

`PUT /api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/:frequenciaId`

Permitido apenas para registros dentro do escopo.

Observação:

- frequência vinculada a origem de outro instrutor não pode ser editada por instrutor da `TURMA` ou do `CURSO`

---

## Contrato para o frontend

O contrato principal da tela foi preservado.

Campos usados na listagem:

- `cursoId`
- `cursoNome`
- `turmaId`
- `turmaNome`
- `turmaCodigo`
- `inscricaoId`
- `alunoId`
- `alunoNome`
- `tipoOrigem`
- `origemId`
- `origemTitulo`
- `status`
- `modoLancamento`
- `minutosPresenca`
- `minimoMinutosParaPresenca`
- `evidencia`
- `atualizadoEm`

Campos usados no resumo:

- `alunoId`
- `alunoNome`
- `totalAulas`
- `presencas`
- `ausencias`
- `justificadas`
- `atrasados`
- `taxaPresencaPct`

---

## Estado vazio válido

Quando o instrutor não tiver vínculo ativo, o frontend deve tratar como estado vazio normal.

Exemplo:

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

Para cursos:

```json
{
  "data": [],
  "meta": {
    "empty": true
  }
}
```

---

## Tratamento de erros

Erros esperados:

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404` para recurso inexistente no contexto informado
- `500 INSTRUTOR_SCOPE_ERROR`

Observação prática:

- em listagens fora do escopo do instrutor, o backend pode responder com lista vazia
- em detalhe, lançamento, upsert, histórico e edição fora do escopo, inclusive por conflito com dono da origem, o backend responde `403 FORBIDDEN`

Exemplo:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso a esta frequência."
}
```

---

## Comportamento esperado na tela

O frontend pode manter o fluxo atual da página.

O que muda na prática:

1. autenticar com usuário `INSTRUTOR`
2. consumir os mesmos endpoints já usados hoje pela tela
3. confiar nas respostas já escopadas pela API
4. renderizar listas vazias quando o instrutor não tiver vínculo
5. tratar `403` como acesso fora do escopo

Regra importante para UX:

- um instrutor de `TURMA` ou `CURSO` pode deixar de ver parte da turma na frequência quando determinadas aulas ou avaliações tiverem outro instrutor dono
- isso é comportamento esperado do backend, não erro de carregamento

Não é necessário montar escopo manual no frontend.

---

## Cenários validados no backend

- instrutor com vínculo parcial por aula e prova
- filtros de curso e turma escopados
- select de aulas escopado
- select de provas/atividades escopado
- listagem geral de frequência escopada
- resumo por aluno escopado
- bloqueio de interferência do instrutor da turma em aula ou avaliação com outro instrutor dono
- lançamento permitido dentro do escopo
- edição bloqueada fora do escopo
- instrutor sem vínculo com retorno vazio válido

---

## Checklist frontend

- [ ] permitir `/dashboard/cursos/frequencia` para `INSTRUTOR`
- [ ] consumir normalmente `GET /api/v1/cursos`
- [ ] consumir normalmente `GET /api/v1/cursos/:cursoId/turmas`
- [ ] consumir normalmente `GET /api/v1/cursos/aulas?turmaId=:turmaId`
- [ ] consumir normalmente `GET /api/v1/cursos/:cursoId/turmas/:turmaId/provas`
- [ ] consumir normalmente `GET /api/v1/cursos/frequencias`
- [ ] consumir normalmente `GET /api/v1/cursos/:cursoId/turmas/:turmaId/frequencias/resumo`
- [ ] tratar lista vazia como estado válido
- [ ] tratar `403` como acesso fora do escopo
- [ ] não assumir que vínculo de `TURMA` ou `CURSO` dá acesso a toda origem da turma
- [ ] não tentar complementar escopo no frontend
