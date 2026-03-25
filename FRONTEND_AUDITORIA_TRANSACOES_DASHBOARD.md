# Frontend — Auditoria de Transações no Dashboard

## Objetivo

Documentar a rota oficial que alimenta a tela:

- `/dashboard/auditoria/transacoes`

Essa rota substitui o uso de mock e entrega paginação, busca, filtros e payload pronto para renderização.

---

## Rota principal

`GET /api/v1/auditoria/transacoes`

---

## Permissões

Perfis com acesso:

- `ADMIN`

Restrição aplicada também nas demais rotas sensíveis do módulo de auditoria:

- `GET /api/v1/auditoria/logs`
- `GET /api/v1/auditoria/usuarios/:usuarioId/historico`
- `GET /api/v1/auditoria/assinaturas`

Sem permissão:

```json
{
  "success": false,
  "code": "AUDITORIA_ACCESS_DENIED",
  "message": "Sem permissão para acessar os dados de auditoria."
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

- `codigoExibicao`
- `descricao`
- `tipo`
- `status`
- `gateway`
- nome, email e código do usuário
- nome e código da empresa
- nome do curso
- nome do plano
- referência externa do gateway

### Filtros

- `tipos` opcional, csv
- `status` opcional, csv
- `usuarioId` opcional
- `empresaId` opcional
- `gateway` opcional
- `dataInicio` opcional, ISO datetime
- `dataFim` opcional, ISO datetime

### Ordenação

- `sortBy` opcional
  - `criadoEm`
  - `tipo`
  - `status`
  - `valor`
  - `gateway`
- `sortDir` opcional
  - `asc`
  - `desc`

### Exemplos

```bash
GET /api/v1/auditoria/transacoes?page=1&pageSize=10
```

```bash
GET /api/v1/auditoria/transacoes?tipos=PAGAMENTO,ASSINATURA&status=APROVADA,PENDENTE
```

```bash
GET /api/v1/auditoria/transacoes?search=mercado%20pago&sortBy=criadoEm&sortDir=desc
```

---

## Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-interno",
        "codigoExibicao": "PGTO-123456",
        "tipo": "PAGAMENTO",
        "tipoLabel": "Pagamento",
        "status": "APROVADA",
        "statusLabel": "Aprovada",
        "valor": 299.9,
        "moeda": "BRL",
        "valorFormatado": "R$ 299,90",
        "gateway": "MERCADO_PAGO",
        "gatewayLabel": "Mercado Pago",
        "gatewayReferencia": "ext-001",
        "descricao": "Compra do curso UX/UI Design.",
        "usuario": {
          "id": "uuid-usuario",
          "nome": "João da Silva",
          "email": "joao@email.com",
          "codigo": "MAT0001"
        },
        "empresa": {
          "id": "uuid-empresa",
          "nomeExibicao": "Inovação Digital S.A.",
          "codigo": "EMP-95946"
        },
        "contexto": {
          "cursoNome": "UX/UI Design",
          "cursoId": "uuid-curso",
          "planoNome": null,
          "planoId": null,
          "origem": "CHECKOUT_CURSO",
          "metodoPagamento": "PIX"
        },
        "meta": {
          "gatewayStatus": "approved",
          "referenciaExterna": "ext-001"
        },
        "criadoEm": "2026-03-25T10:40:00.000Z",
        "atualizadoEm": "2026-03-25T10:41:00.000Z"
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
      "valorTotal": 58240.9,
      "ultimoEventoEm": "2026-03-25T10:41:00.000Z"
    },
    "filtrosDisponiveis": {
      "tipos": [
        {
          "value": "PAGAMENTO",
          "label": "Pagamento",
          "count": 180
        }
      ],
      "status": [
        {
          "value": "APROVADA",
          "label": "Aprovada",
          "count": 160
        }
      ],
      "gateways": [
        {
          "value": "MERCADO_PAGO",
          "label": "Mercado Pago",
          "count": 131
        }
      ]
    }
  }
}
```

---

## Regras importantes

- a coluna `ID` deve usar `codigoExibicao`, não o UUID interno
- `tipoLabel`, `statusLabel` e `gatewayLabel` já vêm prontos para a UI
- `descricao` já vem pronta para tabela
- `usuario`, `empresa`, `contexto` e `meta` ficam disponíveis para drawer/modal futuro
- `filtrosDisponiveis` já entrega labels amigáveis para os selects

---

## Renderização esperada

### Colunas

- `ID` -> `item.codigoExibicao`
- `Tipo` -> `item.tipoLabel`
- `Status` -> `item.statusLabel`
- `Valor` -> `item.valorFormatado`
- `Gateway` -> `item.gatewayLabel`
- `Descrição` -> `item.descricao`
- `Data` -> `item.criadoEm`

### Uso recomendado

```ts
const response = await api.get('/api/v1/auditoria/transacoes', {
  params: {
    page: 1,
    pageSize: 10,
    search: 'mercado pago',
    tipos: 'PAGAMENTO,ASSINATURA',
    status: 'APROVADA,PENDENTE',
    sortBy: 'criadoEm',
    sortDir: 'desc',
  },
});

const payload = response.data?.data;
```

---

## Tratamento de erros

- `400 AUDITORIA_INVALID_FILTERS`
- `400 VALIDATION_ERROR`
- `403 AUDITORIA_ACCESS_DENIED`
- `500 AUDITORIA_TRANSACOES_ERROR`

Exemplo:

```json
{
  "success": false,
  "code": "AUDITORIA_TRANSACOES_ERROR",
  "message": "Não foi possível carregar as transações de auditoria."
}
```

---

## Checklist frontend

- [ ] Substituir o mock da tela por `GET /api/v1/auditoria/transacoes`
- [ ] Usar `codigoExibicao` na coluna `ID`
- [ ] Renderizar `tipoLabel`, `statusLabel` e `gatewayLabel`
- [ ] Consumir `filtrosDisponiveis.tipos`
- [ ] Consumir `filtrosDisponiveis.status`
- [ ] Consumir `filtrosDisponiveis.gateways`
- [ ] Tratar `403 AUDITORIA_ACCESS_DENIED`
- [ ] Tratar `400 AUDITORIA_INVALID_FILTERS`
