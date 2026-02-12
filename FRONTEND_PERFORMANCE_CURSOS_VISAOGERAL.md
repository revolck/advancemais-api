# Frontend — Performance de Visão Geral de Cursos

## Objetivo

Reduzir latência percebida nas rotas:

- `GET /api/v1/cursos/visaogeral`
- `GET /api/v1/cursos/visaogeral/faturamento`

## Melhorias aplicadas no backend

### 1) Cache de resposta por rota (server-side)

Aplicado cache curto no controller para:

- `GET /api/v1/cursos/visaogeral`
- `GET /api/v1/cursos/visaogeral/faturamento`

Chave de cache:

- `method + rota + query + role`

TTL configurável por ambiente:

- `CACHE_TTL_CURSOS_VISAOGERAL` (default `30s`)
- `CACHE_TTL_CURSOS_VISAOGERAL_FATURAMENTO` (default `30s`)

### 2) Otimização SQL em faturamento por período

No serviço `faturamento-tendencias`:

- adicionado pré-filtro por janela de datas em UTC na `AuditoriaTransacoes`
- redução de varredura desnecessária fora do período consultado
- mantém o mesmo contrato de resposta

### 3) Menos processamento em memória na visão geral

No serviço de `visaogeral`:

- agregações de faturamento movidas para SQL (totais + top cursos)
- reduzido processamento em loop no Node
- consultas independentes de performance rodam em paralelo

## Medição local (Neon)

Ambiente local com cache quente:

- `GET /api/v1/cursos/visaogeral`: `~2.44s` (cold) / `~0.003s` a `0.006s` (warm)
- `GET /api/v1/cursos/visaogeral/faturamento?period=month&top=10`: `~3.04s` (cold) / `~0.001s` a `0.004s` (warm)

## Recomendações para frontend

### 1) First load do dashboard

- Carregar `GET /api/v1/cursos/visaogeral` no mount.
- Evitar chamar `.../faturamento` em paralelo no primeiro paint, a menos que o bloco esteja visível.

### 2) Faturamento sob demanda

- Buscar `GET /api/v1/cursos/visaogeral/faturamento` ao abrir aba/bloco de faturamento.
- Em filtros de período (`period`, `startDate`, `endDate`, `top`), usar debounce de `300ms` a `500ms`.

### 3) Estratégia de cache no cliente

- `staleTime`: `30s` a `60s`
- evitar `refetchOnWindowFocus` agressivo para dashboard administrativo

### 4) Parâmetros recomendados

- `top=10` para ranking inicial
- aumentar `top` apenas quando o usuário realmente pedir mais itens

## Exemplo (React Query)

```ts
const visaoGeralQuery = useQuery({
  queryKey: ['cursos', 'visaogeral'],
  queryFn: () => api.get('/api/v1/cursos/visaogeral'),
  staleTime: 30_000,
});

const faturamentoQuery = useQuery({
  queryKey: ['cursos', 'visaogeral', 'faturamento', period, startDate, endDate, top],
  queryFn: () =>
    api.get(
      `/api/v1/cursos/visaogeral/faturamento?period=${period}&top=${top}${
        startDate ? `&startDate=${startDate}` : ''
      }${endDate ? `&endDate=${endDate}` : ''}`,
    ),
  enabled: showFaturamento,
  staleTime: 30_000,
});
```

## Checklist rápido de diagnóstico no front

- confirmar que `visaogeral/faturamento` não dispara em duplicidade no mount
- confirmar ausência de chamadas repetidas por mudança de estado irrelevante
- validar uso de debounce ao alterar filtros de período customizado
- validar redução de latência entre primeira chamada e chamadas subsequentes (cache warm)
