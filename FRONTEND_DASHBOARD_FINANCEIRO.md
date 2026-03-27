# Frontend — Dashboard Financeiro

## Objetivo

Documentar a rota oficial que alimenta a tela:

- `/dashboard/financeiro`

Essa rota substitui o uso de mock e entrega cards, gráficos, rankings e preview de transações com filtros reais.

---

## Rotas

### Principal

`GET /api/v1/dashboard/financeiro`

### Filtros auxiliares

`GET /api/v1/dashboard/financeiro/filtros`

---

## Permissões

Perfis com acesso:

- `ADMIN`

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

### Filtros principais

- `periodo` opcional
  - `7d`
  - `30d`
  - `90d`
  - `12m`
  - `month`
  - `custom`
- `mesReferencia` opcional no formato `YYYY-MM`
- `dataInicio` opcional, ISO datetime
- `dataFim` opcional, ISO datetime
- `agruparPor` opcional
  - `day`
  - `week`
  - `month`
- `timezone` opcional
  - default `America/Maceio`
- `ultimasTransacoesLimit` opcional
  - default `5`
  - máximo `20`

### Regras de precedência

1. `mesReferencia`
2. `periodo=custom`
3. `periodo`
4. fallback `30d`

### Regras adicionais

- se `mesReferencia` for enviado, o backend considera o mês fechado correspondente
- se `periodo=month` sem `mesReferencia`, usa o mês atual
- se `periodo=custom`, `dataInicio` e `dataFim` são obrigatórios
- se `dataFim < dataInicio`, retorna `400 DASHBOARD_FINANCEIRO_INVALID_FILTERS`

### Exemplos

```bash
GET /api/v1/dashboard/financeiro?mesReferencia=2026-03
```

```bash
GET /api/v1/dashboard/financeiro?periodo=30d&agruparPor=day
```

```bash
GET /api/v1/dashboard/financeiro?periodo=custom&dataInicio=2026-03-01T00:00:00.000Z&dataFim=2026-03-31T23:59:59.999Z
```

---

## Resposta principal

```json
{
  "success": true,
  "data": {
    "filtrosAplicados": {
      "periodo": "month",
      "mesReferencia": "2026-03",
      "dataInicio": "2026-03-01T00:00:00.000Z",
      "dataFim": "2026-03-31T23:59:59.999Z",
      "agruparPor": "day",
      "timezone": "America/Maceio"
    },
    "cards": {
      "receitaBruta": {
        "valor": 400,
        "valorFormatado": "R$ 400,00",
        "variacaoPercentual": 100,
        "tendencia": "up"
      },
      "receitaLiquida": {
        "valor": 330,
        "valorFormatado": "R$ 330,00",
        "variacaoPercentual": 65,
        "tendencia": "up"
      },
      "ticketMedio": {
        "valor": 200,
        "valorFormatado": "R$ 200,00",
        "variacaoPercentual": 0,
        "tendencia": "stable"
      },
      "transacoesAprovadas": {
        "valor": 2,
        "variacaoPercentual": 100,
        "tendencia": "up"
      },
      "transacoesPendentes": {
        "valor": 1,
        "variacaoPercentual": 100,
        "tendencia": "up"
      },
      "estornosEReembolsos": {
        "valor": 70,
        "valorFormatado": "R$ 70,00",
        "variacaoPercentual": 100,
        "tendencia": "up"
      }
    },
    "graficos": {
      "evolucaoReceita": [],
      "evolucaoTransacoes": [],
      "distribuicaoPorStatus": [],
      "distribuicaoPorTipo": [],
      "distribuicaoPorGateway": []
    },
    "rankings": {
      "topCursos": [],
      "topPlanos": [],
      "topEmpresas": [],
      "topAlunos": []
    },
    "assinaturas": {
      "ativas": 1,
      "novasNoPeriodo": 1,
      "canceladasNoPeriodo": 1,
      "renovacoesNoPeriodo": 1,
      "receitaAssinaturas": 100,
      "receitaAssinaturasFormatada": "R$ 100,00",
      "taxaRetencao": 0
    },
    "ultimasTransacoes": [
      {
        "id": "uuid",
        "codigoExibicao": "FIN-CASE-005",
        "tipo": "PAGAMENTO",
        "tipoLabel": "Pagamento",
        "status": "PENDENTE",
        "statusLabel": "Pendente",
        "valor": 80,
        "valorFormatado": "R$ 80,00",
        "gateway": "PAGARME",
        "gatewayLabel": "Pagar.me",
        "descricao": "Pagamento pendente do curso Dashboard Financeiro Case 1.",
        "criadoEm": "2026-03-21T13:00:00.000Z"
      }
    ],
    "acoesRapidas": {
      "detalhesTransacoesUrl": "/dashboard/auditoria/transacoes",
      "detalhesAssinaturasUrl": "/dashboard/auditoria/assinaturas"
    }
  }
}
```

---

## Semântica dos cards

- `receitaBruta`
  - soma de transações `PAGAMENTO` e `ASSINATURA` com `status = APROVADA`
- `receitaLiquida`
  - `receitaBruta - reembolsos - estornos`
- `ticketMedio`
  - `receitaBruta / quantidade de transações aprovadas de receita`
- `transacoesAprovadas`
  - quantidade de transações `PAGAMENTO` ou `ASSINATURA` com `status = APROVADA`
- `transacoesPendentes`
  - quantidade de transações com `status = PENDENTE` ou `PROCESSANDO`
- `estornosEReembolsos`
  - soma de `REEMBOLSO` aprovado e `ESTORNO` estornado

---

## Semântica dos gráficos

### `graficos.evolucaoReceita`

Usa apenas transações de receita aprovadas:

- `PAGAMENTO`
- `ASSINATURA`

Campos:

- `label`
- `valor`
- `valorFormatado`
- `quantidade`

### `graficos.evolucaoTransacoes`

Campos:

- `label`
- `aprovadas`
- `pendentes`
- `recusadas`

### Distribuições

- `distribuicaoPorStatus`
- `distribuicaoPorTipo`
- `distribuicaoPorGateway`

Todas já retornam `label` amigável para a UI.

---

## Rankings

O backend retorna:

- `rankings.topCursos`
- `rankings.topPlanos`
- `rankings.topEmpresas`
- `rankings.topAlunos`

Cada item contém:

- `position`
- `name`
- `value`
- `valorFormatado`

Os rankings usam transações de receita aprovadas.

---

## Últimas transações

O preview usa o mesmo modelo amigável da auditoria de transações, mas de forma resumida.

Use para cards/tabela curta da tela.

Para drilldown completo, continue usando:

- `GET /api/v1/auditoria/transacoes`

---

## Rota de filtros auxiliares

`GET /api/v1/dashboard/financeiro/filtros`

Resposta:

```json
{
  "success": true,
  "data": {
    "periodos": [
      { "value": "7d", "label": "7 dias" },
      { "value": "30d", "label": "30 dias" },
      { "value": "90d", "label": "90 dias" },
      { "value": "12m", "label": "12 meses" },
      { "value": "month", "label": "Mês atual" },
      { "value": "custom", "label": "Personalizado" }
    ],
    "agruparPor": [
      { "value": "day", "label": "Dia" },
      { "value": "week", "label": "Semana" },
      { "value": "month", "label": "Mês" }
    ]
  }
}
```

---

## Fluxo recomendado no frontend

1. Carregar a tela com `GET /api/v1/dashboard/financeiro`.
2. Ao trocar o mês, enviar `mesReferencia=YYYY-MM`.
3. Ao trocar o período, enviar `periodo`.
4. Ao usar intervalo manual, enviar `periodo=custom`, `dataInicio` e `dataFim`.
5. Usar `ultimasTransacoes` apenas como preview.
6. Para exploração detalhada, abrir `/dashboard/auditoria/transacoes`.

Exemplo:

```ts
const response = await api.get('/api/v1/dashboard/financeiro', {
  params: {
    mesReferencia: '2026-03',
    agruparPor: 'day',
    ultimasTransacoesLimit: 5,
  },
});

const payload = response.data?.data;
```

---

## Tratamento de erros

- `400 DASHBOARD_FINANCEIRO_INVALID_FILTERS`
- `400 VALIDATION_ERROR`
- `403 AUDITORIA_ACCESS_DENIED`
- `500 DASHBOARD_FINANCEIRO_ERROR`

Exemplo:

```json
{
  "success": false,
  "code": "DASHBOARD_FINANCEIRO_INVALID_FILTERS",
  "message": "Os filtros informados para o dashboard financeiro são inválidos."
}
```

---

## Checklist frontend

- [ ] Substituir o mock da tela por `GET /api/v1/dashboard/financeiro`
- [ ] Recarregar a tela ao trocar `mesReferencia`
- [ ] Recarregar a tela ao trocar `periodo`
- [ ] Enviar `dataInicio` e `dataFim` quando `periodo=custom`
- [ ] Usar `filtrosAplicados` como fonte da verdade da UI
- [ ] Renderizar cards usando `valorFormatado` quando disponível
- [ ] Renderizar rankings com `valorFormatado`
- [ ] Usar `ultimasTransacoes` apenas como preview
- [ ] Continuar usando `GET /api/v1/auditoria/transacoes` para drilldown
- [ ] Tratar `403 AUDITORIA_ACCESS_DENIED`
- [ ] Tratar `400 DASHBOARD_FINANCEIRO_INVALID_FILTERS`
