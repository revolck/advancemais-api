# Frontend — Alunos do `INSTRUTOR` em `/dashboard/cursos/alunos`

## Status

Backend liberado.

O usuário com:

- `role = INSTRUTOR`

agora pode consumir:

- `GET /api/v1/cursos/alunos`
- `GET /api/v1/cursos/alunos/:id`

com dados escopados pelos vínculos ativos do instrutor.

---

## Regra oficial de escopo do instrutor

O backend monta o escopo do `INSTRUTOR` usando a união de vínculos ativos:

- `AULA`
- `TURMA`
- `CURSO`

Regras aplicadas:

- nenhum aluno fora do escopo pode aparecer na listagem
- o detalhe do aluno só abre quando existir ao menos uma inscrição do aluno dentro do escopo do instrutor
- vínculos sobrepostos são deduplicados no backend
- se o instrutor não tiver vínculo ativo, a listagem responde com sucesso e vazia
- a visibilidade do aluno é decidida pelas inscrições relevantes no escopo, nunca apenas por `ultimoCurso`

---

## Endpoints prontos para o frontend

### 1. Listagem de alunos

`GET /api/v1/cursos/alunos`

Para `INSTRUTOR`:

- retorna apenas alunos com pelo menos uma inscrição em turma acessível no escopo do instrutor
- `ultimoCurso` já é calculado apenas dentro do escopo do instrutor
- se o aluno tiver uma inscrição mais recente fora do escopo e outra válida dentro do escopo, o backend usa a inscrição em escopo

### 2. Detalhe do aluno

`GET /api/v1/cursos/alunos/:id`

Para `INSTRUTOR`:

- retorna `200` apenas se o aluno tiver pelo menos uma inscrição no escopo do instrutor
- retorna `403 FORBIDDEN` quando o aluno não tiver nenhuma inscrição dentro do escopo
- o array `inscricoes` já vem filtrado para o escopo do instrutor
- `totalInscricoes` e `estatisticas` também passam a refletir apenas as inscrições visíveis no escopo do instrutor

---

## Contrato para o frontend

O contrato principal foi preservado.

Na listagem:

- `data[]`
- `pagination`
- `ultimoCurso`

Importante:

- não foi necessário adicionar `inscricoesResumo[]`
- `ultimoCurso` agora já vem corretamente calculado dentro do escopo do instrutor

No detalhe:

- a estrutura principal continua a mesma
- `inscricoes` passa a conter somente inscrições visíveis ao instrutor autenticado

---

## Estado vazio válido

Se o instrutor não tiver vínculo ativo:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

Esse retorno deve ser tratado como estado vazio normal da tela.

---

## Erros esperados

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `500 INSTRUTOR_SCOPE_ERROR`

Exemplo de `403` no detalhe:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso a este aluno."
}
```

---

## Comportamento esperado na tela

O frontend pode manter o fluxo atual.

O que muda na prática:

1. autenticar com usuário `INSTRUTOR`
2. consumir normalmente os endpoints já existentes de listagem e detalhe
3. confiar no backend para decidir visibilidade por todas as inscrições relevantes no escopo
4. tratar lista vazia como estado válido
5. tratar `403` no detalhe como aluno fora do escopo do instrutor

Não é necessário montar escopo manual no frontend.

---

## Cenários validados no backend

- instrutor com escopo por `TURMA`
- instrutor com escopo por `AULA`
- aluno com múltiplas inscrições, sendo a mais recente fora do escopo
- `ultimoCurso` calculado dentro do escopo
- detalhe retornando apenas inscrições em escopo
- detalhe bloqueado com `403` para aluno fora do escopo
- instrutor sem vínculo ativo com retorno vazio válido

---

## Checklist frontend

- [ ] permitir a experiência de listagem de alunos para `INSTRUTOR`
- [ ] consumir normalmente `GET /api/v1/cursos/alunos`
- [ ] consumir normalmente `GET /api/v1/cursos/alunos/:id`
- [ ] tratar `data: []` como estado vazio válido
- [ ] tratar `403` no detalhe como aluno fora do escopo
- [ ] não recalcular `ultimoCurso` no frontend
- [ ] não tentar complementar escopo manualmente no frontend
