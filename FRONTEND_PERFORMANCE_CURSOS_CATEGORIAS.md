# Frontend — Performance de Cursos e Categorias

## Objetivo

Reduzir latência percebida nas rotas:

- `GET /api/v1/cursos/categorias`
- `GET /api/v1/cursos/categorias/:categoriaId`
- `GET /api/v1/cursos/categorias/:categoriaId/subcategorias`
- `GET /api/v1/cursos`
- `GET /api/v1/cursos/:cursoId`
- `GET /api/v1/cursos/:cursoId/meta`
- `GET /api/v1/cursos/:cursoId/auditoria`
- `GET /api/v1/cursos/:cursoId/notas`
- `GET /api/v1/cursos/:cursoId/inscricoes` (já otimizada e mantida)

## Melhorias aplicadas no backend

### 1) Cache server-side em rotas de leitura

Aplicado `getCachedOrFetch` com chave estável por rota + query + role em:

- `GET /api/v1/cursos/categorias`
- `GET /api/v1/cursos/categorias/:categoriaId`
- `GET /api/v1/cursos/categorias/:categoriaId/subcategorias`
- `GET /api/v1/cursos`
- `GET /api/v1/cursos/:cursoId`
- `GET /api/v1/cursos/:cursoId/meta`
- `GET /api/v1/cursos/:cursoId/auditoria`
- `GET /api/v1/cursos/:cursoId/notas`

TTLs configuráveis por ambiente:

- `CACHE_TTL_CURSOS_CATEGORIAS` (default `60s`)
- `CACHE_TTL_CURSOS_LIST` (default `45s`)
- `CACHE_TTL_CURSOS_GET` (default `45s`)
- `CACHE_TTL_CURSOS_META` (default `45s`)
- `CACHE_TTL_CURSOS_AUDITORIA` (default `30s`)
- `CACHE_TTL_CURSOS_NOTAS` (default `30s`)
- `CACHE_TTL_CURSOS_INSCRICOES` (já existente)

### 2) Invalidação automática de cache em mutações

Após mutações de curso/categoria/subcategoria/notas, há invalidação por prefixo para evitar dado antigo:

- curso: `POST/PUT/DELETE /api/v1/cursos` e `POST /api/v1/cursos/templates/vincular`
- categorias/subcategorias: `POST/PUT/DELETE`
- notas: `POST/PUT/DELETE` e limpeza manual

### 3) Menos custo no banco em listagem de cursos

Na listagem `GET /api/v1/cursos`:

- `count` e `groupBy(statusPadrao)` agora rodam em paralelo (`Promise.all`)

### 4) Contagem de inscrições mais leve no mapper de cursos

Em `countInscricoesAtivasPorTurma` (usado no mapeamento de cursos/turmas):

- removido `JOIN` com `Usuarios`
- mantida regra de inscrição ativa por status (`!= CANCELADO/TRANCADO`)

### 5) Subcategorias paginadas com leitura paralela

Em `listSubcategorias`:

- `findMany` + `count` em paralelo (`Promise.all`) no lugar de transação de leitura

## Recomendações para frontend

### 1) Lista de cursos

- usar `pageSize` entre `10` e `50` no first load
- evitar `pageSize` muito alto por padrão

### 2) Auditoria

- carregar `GET /:cursoId/auditoria` só quando a aba de histórico estiver ativa

### 3) Notas consolidadas

- carregar `GET /:cursoId/notas` sob demanda (aba/tela de notas)
- debounce para busca/filtro (`300ms` a `500ms`)

### 4) Cache no cliente (React Query)

- `staleTime` recomendado:
  - cursos/categorias: `30s` a `60s`
  - auditoria/notas: `20s` a `30s`
- evitar `refetchOnWindowFocus` agressivo em telas administrativas

## Checklist rápido no frontend

- confirmar se não há requests duplicadas no mount
- confirmar que `auditoria` e `notas` não disparam antes da aba abrir
- validar queda de latência entre primeira chamada (cold) e chamadas seguintes (warm)
