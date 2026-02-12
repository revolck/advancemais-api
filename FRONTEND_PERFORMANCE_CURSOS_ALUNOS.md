# Frontend — Performance das Rotas de Alunos (Cursos)

## Objetivo

Reduzir latência percebida nas rotas:

- `GET /api/v1/cursos/alunos`
- `GET /api/v1/cursos/alunos/:alunoId`
- `PUT /api/v1/cursos/alunos/:alunoId`
- `GET /api/v1/cursos/alunos/:alunoId/inscricoes`

## Melhorias aplicadas no backend

### 1) Cache HTTP para leituras de alunos

Aplicado cache server-side nas rotas GET acima.

Detalhes:

- header de diagnóstico: `X-Cache: HIT|MISS`
- chave de cache: `method + url + role + userId`
- TTL configurável por ambiente:
  - `CACHE_TTL_CURSOS_ALUNOS_HTTP_GET` (default `30s`)

### 2) Invalidação automática após atualização

Na rota:

- `PUT /api/v1/cursos/alunos/:alunoId`

O backend invalida automaticamente o cache HTTP e cache interno relacionado aos endpoints de alunos.

### 3) Menos N+1 no cálculo de progresso

Nas rotas:

- `GET /api/v1/cursos/alunos/:alunoId`
- `GET /api/v1/cursos/alunos/:alunoId/inscricoes`

O cálculo de progresso deixou de executar múltiplas consultas por inscrição e passou para cálculo em batch (`groupBy`), reduzindo round-trips ao banco.

## Recomendações para frontend

### 1) Lista de alunos

- usar `limit` inicial entre `10` e `50`
- evitar listas muito grandes no first load

### 2) Detalhe e histórico

- carregar `/:alunoId` somente ao abrir detalhe
- carregar `/:alunoId/inscricoes` sob demanda na aba de histórico

### 3) React Query

- `staleTime` recomendado: `20s` a `45s`
- evitar `refetchOnWindowFocus` agressivo em telas administrativas

### 4) Checklist rápido

- validar no Network se GET repetidas retornam `X-Cache: HIT`
- validar que após `PUT` a primeira leitura volta `MISS` e depois `HIT`
- validar ausência de chamadas duplicadas por re-render/efeitos

## Exemplos rápidos

```bash
curl -sS -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/v1/cursos/alunos?page=1&limit=10"
```

```bash
curl -sS -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/v1/cursos/alunos/<ALUNO_ID>/inscricoes?page=1&pageSize=10"
```
