# Frontend — Histórico de Auditoria Global no Dashboard

## Objetivo

Documentar a rota oficial que alimenta a tela:

- `/dashboard/auditoria/historico`

Essa rota substitui o uso de mock e entrega paginação, busca, filtros e payload pronto para renderização.

---

## Rota principal

`GET /api/v1/auditoria/logs`

---

## Permissões

Perfis com acesso:

- `ADMIN`

Restrição aplicada também nas rotas sensíveis do módulo de auditoria:

- `GET /api/v1/auditoria/usuarios/:usuarioId/historico`
- `GET /api/v1/auditoria/assinaturas`
- `GET /api/v1/auditoria/transacoes`

Sem permissão:

```json
{
  "success": false,
  "code": "AUDITORIA_ACCESS_DENIED",
  "message": "Sem permissão para acessar o histórico de auditoria."
}
```

Status HTTP:

- `403`

---

## Query suportada

### Paginação

- `page` opcional, default `1`
- `pageSize` opcional, default `10`, máximo `100`

### Busca

- `search` opcional

A busca cobre pelo menos:

- `descricao`
- `acao`
- `tipo`
- nome e email do ator
- nome/código de entidades conhecidas
- `ip`

### Filtros

- `categorias` opcional, csv
- `tipos` opcional, csv
- `atorId` opcional
- `atorRole` opcional
- `entidadeTipo` opcional
- `entidadeId` opcional
- `dataInicio` opcional, ISO datetime
- `dataFim` opcional, ISO datetime

### Ordenação

- `sortBy` opcional
  - `dataHora`
  - `categoria`
  - `tipo`
  - `acao`
- `sortDir` opcional
  - `asc`
  - `desc`

### Exemplos

```bash
GET /api/v1/auditoria/logs?page=1&pageSize=10
```

```bash
GET /api/v1/auditoria/logs?categorias=USUARIO,SEGURANCA&tipos=USUARIO_ROLE_ALTERADA,USUARIO_ACESSO_LIBERADO
```

```bash
GET /api/v1/auditoria/logs?search=função&sortBy=dataHora&sortDir=desc
```

---

## Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-log",
        "categoria": "USUARIO",
        "tipo": "USUARIO_ROLE_ALTERADA",
        "acao": "Função alterada",
        "descricao": "Função do usuário alterada de Aluno/Candidato para Instrutor.",
        "dataHora": "2026-03-24T18:10:00.000Z",
        "ator": {
          "id": "uuid-admin",
          "nome": "Maria Souza",
          "role": "ADMIN",
          "roleLabel": "Administrador",
          "avatarUrl": null
        },
        "entidade": {
          "id": "uuid-user",
          "tipo": "USUARIO",
          "codigo": "MAT0001",
          "nomeExibicao": "João da Silva"
        },
        "contexto": {
          "ip": "10.0.0.5",
          "userAgent": "Mozilla/5.0...",
          "origem": "PAINEL_ADMIN"
        },
        "dadosAnteriores": {
          "role": "ALUNO_CANDIDATO"
        },
        "dadosNovos": {
          "role": "INSTRUTOR"
        },
        "meta": {
          "motivo": "Ajuste administrativo pelo painel",
          "actorRole": "ADMIN",
          "origem": "PAINEL_ADMIN"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 245,
      "totalPages": 25
    },
    "resumo": {
      "total": 245,
      "ultimoEventoEm": "2026-03-24T18:10:00.000Z"
    },
    "filtrosDisponiveis": {
      "categorias": [
        {
          "value": "USUARIO",
          "label": "Usuário",
          "count": 84
        }
      ],
      "tipos": [
        {
          "value": "USUARIO_ROLE_ALTERADA",
          "label": "Função alterada",
          "count": 12
        }
      ]
    }
  }
}
```

---

## Regras importantes

- o frontend não precisa usar UUID bruto para renderizar ator ou entidade
- `ator.nome` e `ator.roleLabel` já vêm resolvidos
- quando a ação for automática, o ator vem como:
  - `nome: "Sistema"`
  - `role: "SISTEMA"`
  - `roleLabel: "Sistema interno"`
- `descricao` já vem pronta para a tabela
- `dadosAnteriores` e `dadosNovos` continuam disponíveis para evolução futura da UI
- `filtrosDisponiveis` já entrega labels amigáveis para categorias e tipos

---

## Renderização esperada

### Colunas

- `Descrição` -> `item.descricao`
- `Categoria` -> `item.categoria` ou `filtrosDisponiveis.categorias.label`
- `Ação` -> `item.acao`
- `Usuário` -> `item.ator.nome` + `item.ator.roleLabel`
- `IP` -> `item.contexto.ip`
- `Data` -> `item.dataHora`

### Uso recomendado

```ts
const response = await api.get('/api/v1/auditoria/logs', {
  params: {
    page: 1,
    pageSize: 10,
    search: 'função',
    categorias: 'USUARIO,SEGURANCA',
    tipos: 'USUARIO_ROLE_ALTERADA',
    sortBy: 'dataHora',
    sortDir: 'desc',
  },
});

const payload = response.data?.data;
const items = payload?.items ?? [];
const pagination = payload?.pagination;
const filtrosDisponiveis = payload?.filtrosDisponiveis;
```

---

## Erros esperados

- `400 AUDITORIA_INVALID_FILTERS`
- `403 AUDITORIA_ACCESS_DENIED`
- `500 AUDITORIA_LOGS_ERROR`

Exemplo de filtro inválido:

```json
{
  "success": false,
  "code": "AUDITORIA_INVALID_FILTERS",
  "message": "Os filtros informados para o histórico de auditoria são inválidos.",
  "errors": [
    {
      "path": "dataFim",
      "message": "dataFim deve ser maior ou igual a dataInicio"
    }
  ]
}
```

---

## Checklist frontend

- [ ] Remover o mock de `src/mockData/auditoria.ts` desse fluxo
- [ ] Consumir `GET /api/v1/auditoria/logs`
- [ ] Usar `data.items` como fonte da tabela
- [ ] Usar `data.pagination` para paginação real
- [ ] Usar `data.filtrosDisponiveis` para filtros dinâmicos
- [ ] Exibir a tela apenas para `ADMIN`
- [ ] Renderizar `ator.nome` e `ator.roleLabel` sem depender de UUID bruto
- [ ] Exibir `dadosAnteriores` e `dadosNovos` em drawer/modal futuro, se necessário
