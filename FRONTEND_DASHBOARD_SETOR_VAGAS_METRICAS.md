# Frontend — Dashboard Setor de Vagas

## Objetivo

Documentar a rota oficial que alimenta a visão geral de:

- `/dashboard/setor-de-vagas`

Essa rota entrega as métricas consolidadas do dashboard e deve continuar estável mesmo quando não houver dados.

---

## Rota

`GET /api/v1/dashboard/setor-de-vagas/metricas`

---

## Permissões

Perfis com acesso:

- `ADMIN`
- `MODERADOR`
- `SETOR_DE_VAGAS`
- `RECRUTADOR`

### Observação

- `RECRUTADOR` recebe visão filtrada pelas vagas às quais está vinculado
- `SETOR_DE_VAGAS` recebe a visão geral do módulo

---

## Contrato de resposta

A rota responde com payload direto, sem envelope `success/data`.

```json
{
  "metricasGerais": {
    "totalEmpresas": 0,
    "empresasAtivas": 0,
    "totalVagas": 0,
    "vagasAbertas": 0,
    "vagasPendentes": 0,
    "vagasEncerradas": 0,
    "totalCandidatos": 0,
    "candidatosEmProcesso": 0,
    "candidatosContratados": 0,
    "solicitacoesPendentes": 0,
    "solicitacoesAprovadasHoje": 0,
    "solicitacoesRejeitadasHoje": 0
  }
}
```

---

## Campos retornados

- `totalEmpresas`
- `empresasAtivas`
- `totalVagas`
- `vagasAbertas`
- `vagasPendentes`
- `vagasEncerradas`
- `totalCandidatos`
- `candidatosEmProcesso`
- `candidatosContratados`
- `solicitacoesPendentes`
- `solicitacoesAprovadasHoje`
- `solicitacoesRejeitadasHoje`

Todos os campos são numéricos.

---

## Regra importante

A rota não deve retornar `500` quando não houver dados.

### Cenários sem dados

Quando não existir base suficiente para compor as métricas:

- `SETOR_DE_VAGAS` ainda recebe `200`
- `RECRUTADOR` sem vínculos de vaga ainda recebe `200`
- os campos voltam com `0`

Exemplo:

```json
{
  "metricasGerais": {
    "totalEmpresas": 0,
    "empresasAtivas": 0,
    "totalVagas": 0,
    "vagasAbertas": 0,
    "vagasPendentes": 0,
    "vagasEncerradas": 0,
    "totalCandidatos": 0,
    "candidatosEmProcesso": 0,
    "candidatosContratados": 0,
    "solicitacoesPendentes": 0,
    "solicitacoesAprovadasHoje": 0,
    "solicitacoesRejeitadasHoje": 0
  }
}
```

---

## Comportamento esperado no frontend

### Tela de visão geral

O frontend deve:

- consumir `GET /api/v1/dashboard/setor-de-vagas/metricas`
- renderizar diretamente `response.data.metricasGerais`
- tratar ausência de dados como estado válido
- exibir `0` normalmente quando vier zero da API

### Importante

O frontend não deve:

- tratar payload zerado como erro
- depender de campos opcionais fora de `metricasGerais`
- esperar wrapper `success`

---

## Exemplo de consumo

```ts
const response = await api.get('/api/v1/dashboard/setor-de-vagas/metricas');

const metricas = response.data?.metricasGerais;
```

---

## Tratamento de erros

### `401 UNAUTHORIZED`

Quando o token estiver ausente ou inválido.

### `403 INSUFFICIENT_PERMISSIONS`

Quando o perfil logado não tiver acesso à rota.

Exemplo esperado:

```json
{
  "success": false,
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

### `500 METRICAS_ERROR`

Erro interno real de processamento.

Observação:

- ausência de dados não deve mais cair nesse caso

---

## Checklist frontend

- [ ] Consumir `GET /api/v1/dashboard/setor-de-vagas/metricas`
- [ ] Ler `response.data.metricasGerais`
- [ ] Não esperar wrapper `success/data`
- [ ] Exibir zeros normalmente
- [ ] Não tratar dashboard vazio como erro
- [ ] Tratar `401 UNAUTHORIZED`
- [ ] Tratar `403 INSUFFICIENT_PERMISSIONS`
