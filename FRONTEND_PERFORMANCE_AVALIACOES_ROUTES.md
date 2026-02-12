# Frontend — Performance das Rotas de Avaliações

## Objetivo

Reduzir latência percebida no fluxo de avaliações em:

- `GET /api/v1/cursos/avaliacoes`
- `GET /api/v1/cursos/avaliacoes/:id`
- `POST /api/v1/cursos/avaliacoes`
- `PUT /api/v1/cursos/avaliacoes/:id`
- `DELETE /api/v1/cursos/avaliacoes/:id`
- `GET /api/v1/cursos/avaliacoes/instrutores`
- `GET /api/v1/cursos/avaliacoes/turmas`

## Melhorias aplicadas no backend

### 1) Cache HTTP para GET de avaliações

Aplicado cache server-side nas rotas GET acima.

Detalhes:

- header de diagnóstico: `X-Cache: HIT|MISS`
- chave por `method + originalUrl + role + userId`
- TTL configurável por ambiente:
  - `CACHE_TTL_CURSOS_AVALIACOES_HTTP_GET` (default `30s`)

### 2) Invalidação automática em mutações

As seguintes mutações invalidam automaticamente o cache de avaliações:

- `POST /api/v1/cursos/avaliacoes`
- `PUT /api/v1/cursos/avaliacoes/:id`
- `DELETE /api/v1/cursos/avaliacoes/:id`
- `POST /api/v1/cursos/:cursoId/turmas/:turmaId/avaliacoes/clone`

### 3) Menos query para INSTRUTOR na listagem

Em `list` (service de avaliações):

- removida query extra para buscar IDs de turmas do instrutor
- filtro agora usa relação direta (`CursosTurmas.instrutorId`) na própria consulta

### 4) Listagem mais eficiente (count + findMany)

Em `list`:

- `count` e `findMany` executam em paralelo
- quando a `page` solicitada é válida, evita uma segunda consulta de paginação

### 5) Menos round-trip no GET por ID

Em `get`:

- removida consulta extra da turma para validação de permissão de INSTRUTOR
- validação usa `instrutorId` já carregado na relação da própria avaliação

## Recomendações para frontend

### 1) Lista de avaliações

- usar `pageSize` inicial entre `10` e `50`
- evitar `pageSize=200` no first load

### 2) Carga por contexto (lazy)

- carregar `GET /avaliacoes/instrutores` apenas ao abrir formulário de criação/edição
- carregar `GET /avaliacoes/turmas` apenas quando o campo de turma estiver visível

### 3) React Query

- `staleTime` recomendado: `20s` a `45s`
- evitar `refetchOnWindowFocus` agressivo em telas administrativas

### 4) Checklist rápido

- validar no Network se GET repetidas retornam `X-Cache: HIT`
- validar que após `POST/PUT/DELETE` a próxima GET retorna `MISS`
- validar ausência de chamadas duplicadas no mount (StrictMode/efeitos)

## Exemplos rápidos

```bash
curl -sS -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/v1/cursos/avaliacoes?page=1&pageSize=10"
```

```bash
curl -sS -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/v1/cursos/avaliacoes/instrutores"
```
