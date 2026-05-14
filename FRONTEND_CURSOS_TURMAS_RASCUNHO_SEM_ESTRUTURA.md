# Frontend - Turmas em Rascunho Sem Estrutura

## Contexto

Nas telas de cadastro e edição de turmas:

- `/dashboard/cursos/turmas/cadastrar`
- `/dashboard/cursos/:cursoId/turmas/:turmaId/editar`

o frontend pode criar e editar turmas antes de a estrutura final de aulas, atividades e provas estar pronta.

A estrutura vazia passa a ser um estado válido somente quando a turma permanecer em `RASCUNHO`.

Turmas sem itens efetivos não podem ser publicadas.

## Perfis permitidos

Podem criar, editar, publicar e despublicar turmas:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

Demais perfis continuam sem permissão para criar ou editar turmas.

Erro esperado para perfil sem permissão:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Sem permissão para executar esta ação"
}
```

Status HTTP:

- `403 Forbidden`

## Definição de estrutura vazia

A estrutura é considerada vazia quando a quantidade de itens efetivos for `0`.

Itens efetivos:

```ts
estrutura.modules[].items.length + estrutura.standaloneItems.length
```

Exemplos vazios:

```json
{
  "modules": [],
  "standaloneItems": []
}
```

```json
{
  "modules": [
    {
      "title": "Módulo 1",
      "items": []
    }
  ],
  "standaloneItems": []
}
```

Exemplo preenchido:

```json
{
  "modules": [],
  "standaloneItems": [
    {
      "type": "AULA",
      "title": "Aula 1",
      "templateId": "uuid-template",
      "ordem": 1,
      "obrigatoria": true
    }
  ]
}
```

## Criar turma

```http
POST /api/v1/cursos/:cursoId/turmas
```

### Criar rascunho sem estrutura

Permitido para `ADMIN`, `MODERADOR` e `PEDAGOGICO`.

Payload:

```json
{
  "estruturaTipo": "PADRAO",
  "nome": "Turma Maio 2026",
  "turno": "NOITE",
  "metodo": "ONLINE",
  "status": "RASCUNHO",
  "instrutorIds": [],
  "dataInscricaoInicio": "2026-05-01T00:00:00.000Z",
  "dataInscricaoFim": "2026-05-10T00:00:00.000Z",
  "dataInicio": "2026-05-20T00:00:00.000Z",
  "dataFim": "2026-07-20T00:00:00.000Z",
  "vagasIlimitadas": false,
  "vagasTotais": 30,
  "estrutura": {
    "modules": [],
    "standaloneItems": []
  }
}
```

Resposta `201`:

```json
{
  "id": "uuid-turma",
  "codigo": "TRM-000001",
  "nome": "Turma Maio 2026",
  "status": "RASCUNHO",
  "publicacaoStatus": "RASCUNHO",
  "publicado": false,
  "estruturaTipo": "PADRAO",
  "estrutura": {
    "modules": [],
    "standaloneItems": []
  },
  "estruturaResumo": {
    "itemCount": 0,
    "modulesCount": 0,
    "standaloneItemsCount": 0
  }
}
```

### Status default

Se o frontend não enviar `status`, a API cria a turma como rascunho:

```json
{
  "status": "RASCUNHO",
  "publicacaoStatus": "RASCUNHO",
  "publicado": false
}
```

## Bloqueio de publicação sem estrutura

A API bloqueia qualquer tentativa de deixar a turma pública quando a estrutura final tiver `0` itens efetivos.

Campos que contam como tentativa de publicação:

- `status: "PUBLICADO"`
- `publicacaoStatus: "PUBLICADO"`
- `publicado: true`
- `PATCH publicar=true`

Erro esperado:

```json
{
  "success": false,
  "code": "TURMA_ESTRUTURA_OBRIGATORIA_PUBLICACAO",
  "message": "Para publicar a turma, adicione pelo menos 1 item na estrutura.",
  "details": {
    "itemCount": 0,
    "modulesCount": 0,
    "standaloneItemsCount": 0
  }
}
```

Status HTTP:

- `422 Unprocessable Entity`

## Editar turma

```http
PUT /api/v1/cursos/:cursoId/turmas/:turmaId
```

### Permitido

Editar mantendo a turma em `RASCUNHO` é permitido mesmo com estrutura vazia.

Exemplo:

```json
{
  "nome": "Turma Maio 2026 - Revisada",
  "status": "RASCUNHO",
  "estrutura": {
    "modules": [],
    "standaloneItems": []
  }
}
```

Resposta `200`:

```json
{
  "id": "uuid-turma",
  "nome": "Turma Maio 2026 - Revisada",
  "status": "RASCUNHO",
  "publicacaoStatus": "RASCUNHO",
  "publicado": false,
  "estrutura": {
    "modules": [],
    "standaloneItems": []
  },
  "estruturaResumo": {
    "itemCount": 0,
    "modulesCount": 0,
    "standaloneItemsCount": 0
  }
}
```

### Bloqueado

Editar uma turma vazia tentando publicar retorna `422`.

Exemplos bloqueados:

```json
{
  "status": "PUBLICADO",
  "estrutura": {
    "modules": [],
    "standaloneItems": []
  }
}
```

```json
{
  "publicacaoStatus": "PUBLICADO"
}
```

```json
{
  "publicado": true
}
```

## Publicar e despublicar

```http
PATCH /api/v1/cursos/:cursoId/turmas/:turmaId/publicar
```

### Publicar

Payload:

```json
{
  "publicar": true
}
```

Para `publicar=true`, a API valida a estrutura persistida da turma.

Permite publicar quando:

- o usuário é `ADMIN`, `MODERADOR` ou `PEDAGOGICO`;
- a turma tem `1` ou mais itens efetivos.

Bloqueia publicar quando:

- a turma tem `0` itens efetivos.

Resposta de sucesso:

```json
{
  "success": true,
  "data": {
    "id": "uuid-turma",
    "status": "PUBLICADO",
    "publicacaoStatus": "PUBLICADO",
    "publicado": true,
    "estruturaResumo": {
      "itemCount": 1,
      "modulesCount": 0,
      "standaloneItemsCount": 1
    }
  },
  "message": "Turma publicada com sucesso"
}
```

### Despublicar

Payload:

```json
{
  "publicar": false
}
```

`PATCH publicar=false` continua permitido mesmo se a estrutura estiver vazia.

Resposta de sucesso:

```json
{
  "success": true,
  "data": {
    "id": "uuid-turma",
    "status": "RASCUNHO",
    "publicacaoStatus": "RASCUNHO",
    "publicado": false
  },
  "message": "Turma despublicada com sucesso"
}
```

## Listagem e detalhe

As respostas de listagem e detalhe passam a retornar estes campos de forma consistente:

```json
{
  "id": "uuid-turma",
  "status": "RASCUNHO",
  "publicacaoStatus": "RASCUNHO",
  "publicado": false,
  "estrutura": {
    "modules": [],
    "standaloneItems": []
  },
  "estruturaResumo": {
    "itemCount": 0,
    "modulesCount": 0,
    "standaloneItemsCount": 0
  }
}
```

Endpoints:

```http
GET /api/v1/cursos/:cursoId/turmas
GET /api/v1/cursos/:cursoId/turmas/:turmaId
```

O frontend deve usar os campos retornados pela API como fonte da verdade:

```ts
const estaPublicada = turma.publicado === true;
const podePublicar = (turma.estruturaResumo?.itemCount ?? 0) >= 1;
```

## Regra atual de composição mínima

Para publicação, a regra atual é:

```ts
itemCount >= 1;
```

Não é mais exigido ter ao mesmo tempo:

- pelo menos `1` aula;
- pelo menos `1` prova ou atividade.

Se houver `1` item efetivo na estrutura, a turma pode ser publicada.

## Regras por ação

| Ação                       | Estrutura vazia | Estrutura com 1+ itens |
| -------------------------- | --------------- | ---------------------- |
| Criar como `RASCUNHO`      | Permitir        | Permitir               |
| Criar como `PUBLICADO`     | Bloquear `422`  | Permitir               |
| Editar mantendo `RASCUNHO` | Permitir        | Permitir               |
| Editar publicando          | Bloquear `422`  | Permitir               |
| `PATCH publicar=true`      | Bloquear `422`  | Permitir               |
| `PATCH publicar=false`     | Permitir        | Permitir               |

## Ajustes esperados no frontend

Na criação e edição:

- permitir concluir cadastro sem itens somente quando a turma ficar em `RASCUNHO`;
- bloquear botão/ação de publicar quando `estruturaResumo.itemCount === 0`;
- exibir aviso operacional de que a turma foi salva como rascunho e precisa de estrutura antes da publicação;
- tratar `422 TURMA_ESTRUTURA_OBRIGATORIA_PUBLICACAO` mostrando a mensagem da API;
- após criar, editar, publicar ou despublicar, atualizar a tela usando o objeto retornado pela API.

Mensagens locais antigas como:

- `Estrutura padrão: adicione ao menos 1 item.`
- `Estrutura modular: adicione ao menos 1 módulo.`
- `Estrutura dinâmica: adicione ao menos 1 módulo ou item avulso.`

devem ser restritas ao fluxo de publicação. Elas não devem bloquear o salvamento em `RASCUNHO`.
