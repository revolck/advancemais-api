# Frontend — Performance das Rotas de Aulas

## Objetivo

Reduzir latência percebida no fluxo de aulas em:

- `GET /api/v1/cursos/aulas`
- `GET /api/v1/cursos/aulas/:id`
- `GET /api/v1/cursos/aulas/:id/materiais`
- `GET /api/v1/cursos/aulas/:id/progresso`
- `GET /api/v1/cursos/aulas/:id/presenca`

## Melhorias aplicadas no backend

### 1) Cache HTTP transversal para GET de aulas

Aplicado cache server-side no prefixo:

- `GET /api/v1/cursos/aulas*`

Detalhes:

- header de diagnóstico: `X-Cache: HIT|MISS`
- chave inclui `method + originalUrl + authorization(hash) + role + userId`
- TTL configurável por ambiente:
  - `CACHE_TTL_CURSOS_AULAS_HTTP_GET` (default `30s`)

Exceções (sem cache):

- `GET /api/v1/cursos/aulas/:id/historico`
- `GET /api/v1/cursos/aulas/materiais/download/:token`

### 2) Invalidação automática em mutações

No mesmo prefixo `aulas*`, toda mutação bem-sucedida (`POST`, `PUT`, `PATCH`, `DELETE`) invalida o cache de GET.

Isso cobre:

- CRUD de aulas
- publicar/despublicar aula
- progresso/presença
- CRUD de materiais e reordenação

### 3) Menos queries no `AulasService.list` para INSTRUTOR

Antes:

- buscava turmas do instrutor em query separada e depois filtrava aulas

Agora:

- filtra direto por relação (`CursosTurmas.instrutorId`) e por templates do instrutor
- elimina 1 query por chamada em cenário de instrutor

### 4) Menos query no `AulasService.getById`

Antes:

- fazia uma query extra para validar instrutor da turma

Agora:

- usa `instrutorId` já carregado na relação de turma
- valida permissão sem round-trip adicional

### 5) Reordenação de materiais em lote

Antes:

- updates sequenciais (N round-trips)

Agora:

- updates dentro de `prisma.$transaction([...])` em lote
- menor latência em reordenação com vários itens

## Recomendações para frontend

### 1) Listagem de aulas

- usar `pageSize` inicial entre `20` e `50`
- evitar `pageSize=200` no first load

### 2) Consultas por aba (lazy)

- carregar progresso/presença/histórico somente quando aba estiver ativa
- evitar disparar histórico no mount da tela

### 3) React Query

- `staleTime` recomendado: `20s` a `45s`
- evitar `refetchOnWindowFocus` agressivo em telas administrativas

### 4) Checklist rápido

- confirmar no Network que GET repetidos retornam `X-Cache: HIT`
- confirmar que mutação seguida de GET volta `MISS` na primeira leitura pós-mudança
- confirmar ausência de chamadas duplicadas por re-render/efeitos

## Exemplos rápidos

```bash
curl -sS -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/v1/cursos/aulas?page=1&pageSize=20"
```

```bash
curl -sS -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/v1/cursos/aulas/<AULA_ID>"
```
