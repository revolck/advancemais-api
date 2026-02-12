# Frontend — Performance das Rotas de Turmas

## Objetivo

Reduzir latência percebida no conjunto de rotas de turmas em:

- `/:cursoId/turmas`
- `/:cursoId/turmas/:turmaId`
- e subrotas (`agenda`, `aulas`, `inscricoes`, `modulos`, `notas`, `provas`, `frequencias`, `regras-avaliacao`, `certificados`, etc.)

## Melhorias aplicadas no backend

### 1) Cache HTTP transversal para GET de turmas

Foi aplicado cache HTTP server-side no prefixo:

- `GET /api/v1/cursos/:cursoId/turmas*`

Implementação:

- middleware global no router de cursos para `/:cursoId/turmas`
- chave por `method + originalUrl + role + userId`
- header de diagnóstico: `X-Cache: HIT|MISS`
- TTL configurável por ambiente:
  - `CACHE_TTL_CURSOS_TURMAS_HTTP_GET` (default `30s`)

### 2) Invalidação automática em mutações de turmas

No mesmo prefixo `/:cursoId/turmas*`, toda mutação bem-sucedida invalida cache:

- métodos: `POST`, `PUT`, `PATCH`, `DELETE`
- invalidação por prefixo: `cursos:turmas:http:get*`

Isso cobre mudanças de:

- turma
- agenda
- aulas
- avaliações/provas/questões
- frequências
- inscrições
- regras de avaliação
- publicação/despublicação
- certificados

## Recomendações para frontend

### 1) First load da tela de turma

- manter consumo leve no primeiro paint
- carregar conteúdos pesados por aba (estrutura, inscrições, notas, histórico)

### 2) Estratégia de cache no cliente

- `staleTime` recomendado: `20s` a `45s`
- evitar `refetchOnWindowFocus` agressivo para telas administrativas

### 3) Paginação

- usar `pageSize` inicial entre `20` e `50`
- evitar `200` no carregamento inicial de listas

### 4) Checklist rápido

- verificar no Network se chamadas GET repetidas retornam `X-Cache: HIT`
- confirmar que mutações invalidam e próxima leitura volta `MISS` (e depois `HIT`)
- confirmar ausência de chamadas duplicadas por re-render/efeitos
