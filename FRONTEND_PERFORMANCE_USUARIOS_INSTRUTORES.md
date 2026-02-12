# Frontend — Performance das Rotas de Instrutores

## Objetivo

Reduzir latência percebida nas rotas:

- `GET /api/v1/usuarios/instrutores`
- `GET /api/v1/usuarios/instrutores/:instrutorId`
- `PUT /api/v1/usuarios/instrutores/:instrutorId`
- `GET /api/v1/usuarios/instrutores/:userId/bloqueios`
- `POST /api/v1/usuarios/instrutores/:userId/bloqueios`
- `POST /api/v1/usuarios/instrutores/:userId/bloqueios/revogar`

## Melhorias aplicadas no backend

### 1) Cache HTTP transversal para GET de instrutores

Aplicado cache server-side em:

- `GET /api/v1/usuarios/instrutores`
- `GET /api/v1/usuarios/instrutores/:instrutorId`
- `GET /api/v1/usuarios/instrutores/:userId/bloqueios`

Detalhes:

- header de diagnóstico: `X-Cache: HIT|MISS`
- chave por `method + originalUrl + role`
- TTL configurável por ambiente:
  - `CACHE_TTL_USUARIOS_INSTRUTORES_HTTP_GET` (default `30s`)

### 2) Invalidação automática em mutações

As seguintes rotas agora invalidam automaticamente o cache de GET de instrutores:

- `PUT /api/v1/usuarios/instrutores/:instrutorId`
- `POST /api/v1/usuarios/instrutores/:userId/bloqueios`
- `POST /api/v1/usuarios/instrutores/:userId/bloqueios/revogar`

Também invalida o cache interno de listagem (`instrutores:list*`) para evitar dado antigo.

### 3) Menos latência em listagem de instrutores

Em `listarInstrutores`:

- `findMany` e `count` passaram a rodar em paralelo
- chave de cache interno passou a considerar `role`

### 4) Menos overhead em bloqueios de instrutor

Em `listarBloqueiosInstrutor`:

- `count` e `findMany` passaram de transação de leitura para execução paralela (`Promise.all`)

## Recomendações para frontend

### 1) Lista de instrutores

- usar `limit` inicial entre `10` e `50`
- evitar `100` no first load

### 2) Detalhe e bloqueios

- buscar `/:instrutorId` somente ao abrir o detalhe
- buscar `/bloqueios` apenas ao abrir a aba/modal de bloqueios

### 3) React Query

- `staleTime` recomendado: `20s` a `45s`
- evitar `refetchOnWindowFocus` agressivo para telas administrativas

### 4) Checklist rápido

- validar no Network se GET repetidas retornam `X-Cache: HIT`
- validar que após `PUT/POST` a primeira GET volta `MISS` e depois `HIT`
- validar ausência de chamadas duplicadas por re-render/efeitos

## Exemplos rápidos

```bash
curl -sS -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/v1/usuarios/instrutores?page=1&limit=10"
```

```bash
curl -sS -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/v1/usuarios/instrutores/<INSTRUTOR_ID>/bloqueios?page=1&pageSize=10"
```
