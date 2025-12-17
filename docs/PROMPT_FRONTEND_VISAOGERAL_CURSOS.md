# 📋 Prompt para Desenvolvimento Frontend - Visão Geral de Cursos

## 🎯 Objetivo

Criar uma tela de dashboard/visão geral de cursos com métricas, faturamento e análises para ADMIN e MODERADOR do sistema.

---

## 🔗 API Endpoint

```
GET /api/v1/cursos/visaogeral
Authorization: Bearer <token>
```

**Acesso:** Apenas ADMIN e MODERADOR

**Resposta de Sucesso (200):**

```json
{
  "success": true,
  "data": {
    "metricasGerais": {
      "totalCursos": 15,
      "cursosPublicados": 12,
      "cursosRascunho": 3,
      "totalTurmas": 45,
      "turmasAtivas": 20,
      "turmasInscricoesAbertas": 8,
      "totalAlunosInscritos": 350,
      "totalAlunosAtivos": 280,
      "totalAlunosConcluidos": 70
    },
    "cursosProximosInicio": {
      "proximos7Dias": [
        {
          "turmaId": "uuid",
          "cursoId": "uuid",
          "cursoNome": "Desenvolvimento Full Stack",
          "cursoCodigo": "DEV-FULL",
          "turmaNome": "Turma 1 - Desenvolvimento Full Stack",
          "turmaCodigo": "DEV-FULL-T1",
          "dataInicio": "2024-01-15T19:00:00.000Z",
          "diasParaInicio": 3,
          "vagasTotais": 30,
          "vagasDisponiveis": 15,
          "inscricoesAtivas": 15,
          "status": "INSCRICOES_ABERTAS"
        }
      ],
      "proximos15Dias": [...],
      "proximos30Dias": [...]
    },
    "faturamento": {
      "totalFaturamento": 150000.50,
      "faturamentoMesAtual": 25000.00,
      "faturamentoMesAnterior": 30000.00,
      "cursoMaiorFaturamento": {
        "cursoId": "uuid",
        "cursoNome": "Desenvolvimento Full Stack",
        "cursoCodigo": "DEV-FULL",
        "totalFaturamento": 50000.00,
        "totalTransacoes": 150,
        "transacoesAprovadas": 145,
        "transacoesPendentes": 5,
        "ultimaTransacao": "2024-01-10T10:30:00.000Z"
      },
      "topCursosFaturamento": [
        {
          "cursoId": "uuid",
          "cursoNome": "...",
          "cursoCodigo": "...",
          "totalFaturamento": 50000.00,
          "totalTransacoes": 150,
          "transacoesAprovadas": 145,
          "transacoesPendentes": 5,
          "ultimaTransacao": "2024-01-10T10:30:00.000Z"
        }
      ]
    },
    "performance": {
      "cursosMaisPopulares": [
        {
          "cursoId": "uuid",
          "cursoNome": "Desenvolvimento Full Stack",
          "cursoCodigo": "DEV-FULL",
          "totalInscricoes": 250,
          "totalTurmas": 8
        }
      ],
      "taxaConclusao": 20.5,
      "cursosComMaiorTaxaConclusao": [
        {
          "cursoId": "uuid",
          "cursoNome": "...",
          "cursoCodigo": "...",
          "taxaConclusao": 85.5,
          "totalInscricoes": 100,
          "totalConcluidos": 85
        }
      ]
    }
  }
}
```

---

## 📐 Estrutura da Tela

A tela deve ser dividida em **4 seções principais**:

### 1. **Cards de Métricas Gerais** (Topo da página)

Exibir em cards/boxes os principais números:

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Total     │  Publicados │   Turmas    │   Alunos    │
│   Cursos    │   (12)      │   Ativas    │   Ativos    │
│    15       │             │   (20)      │   (280)     │
└─────────────┴─────────────┴─────────────┴─────────────┘

┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Rascunho   │ Inscrições   │  Inscritos  │  Concluídos │
│    (3)      │   Abertas    │   (350)     │    (70)     │
│             │    (8)       │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Design:**

- Cards com ícones relevantes
- Números grandes e destacados
- Cores diferentes para cada tipo de métrica
- Hover effect suave
- Responsivo (mobile: 2 colunas, desktop: 4 colunas)

---

### 2. **Cursos Próximos a Começar** (Seção 1)

Tabs ou Abas para filtrar por período:

```
┌─────────────────────────────────────────────────────┐
│  Cursos Próximos a Começar                          │
│  ┌─────────┬─────────┬─────────┐                    │
│  │ 7 dias  │ 15 dias │ 30 dias │                    │
│  └─────────┴─────────┴─────────┘                    │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📚 Desenvolvimento Full Stack                │  │
│  │    Turma: DEV-FULL-T1                        │  │
│  │    🗓️ Inicia em 3 dias (15/01/2024 19:00)    │  │
│  │    👥 15/30 vagas ocupadas                   │  │
│  │    ✅ Inscrições Abertas                     │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📚 React Avançado e Next.js                  │  │
│  │    Turma: REACT-ADV-T1                       │  │
│  │    🗓️ Inicia em 5 dias (17/01/2024 19:00)    │  │
│  │    👥 20/25 vagas ocupadas                   │  │
│  │    ✅ Inscrições Abertas                     │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Funcionalidades:**

- Tabs para alternar entre 7, 15 e 30 dias
- Lista de turmas com informações principais
- Badge de status (Inscrições Abertas, Encerradas, etc.)
- Barra de progresso visual para vagas ocupadas
- Link para ver detalhes da turma
- Se não houver cursos, mostrar mensagem: "Nenhum curso próximo a começar neste período"

**Design:**

- Cards por turma com borda suave
- Cores diferentes para status (verde = aberto, amarelo = encerrado, etc.)
- Ícones para facilitar leitura rápida
- Responsivo

---

### 3. **Faturamento** (Seção 2)

**⚠️ DADOS SENSÍVEIS - Mostrar apenas para ADMIN e MODERADOR**

```
┌─────────────────────────────────────────────────────┐
│  💰 Faturamento                                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  Total Geral: R$ 150.000,50                  │  │
│  │  ┌──────────────┬──────────────┐            │  │
│  │  │ Mês Atual    │ Mês Anterior │            │  │
│  │  │ R$ 25.000,00 │ R$ 30.000,00 │            │  │
│  │  │ ⬇️ -16.67%   │              │            │  │
│  │  └──────────────┴──────────────┘            │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  🏆 Curso com Maior Faturamento                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📚 Desenvolvimento Full Stack                │  │
│  │    R$ 50.000,00                               │  │
│  │    📊 150 transações (145 aprovadas, 5 pend.)│  │
│  │    🕐 Última: 10/01/2024                     │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  📈 Top 10 Cursos por Faturamento                  │
│  ┌──────────────────────────────────────────────┐  │
│  │ 1. Desenvolvimento Full Stack    R$ 50.000,00│  │
│  │ 2. React Avançado                R$ 30.000,00│  │
│  │ 3. SQL Completo                  R$ 20.000,00│  │
│  │ ...                                              │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Funcionalidades:**

- Gráfico de comparação mês atual vs anterior (opcional)
- Percentual de variação (⬆️ ou ⬇️)
- Destaque para curso com maior faturamento
- Tabela/lista dos top 10 cursos
- Formatação de valores em R$ (BRL)
- Tooltip ou modal com detalhes ao clicar

**Design:**

- Cards com fundo diferente (ex: amarelo/ouro) para destacar dados financeiros
- Gráfico de barras ou linha para comparação mensal
- Ícone de cadeado 🔒 ou badge "Sensível" para indicar dados confidenciais
- Responsivo

---

### 4. **Performance** (Seção 3)

```
┌─────────────────────────────────────────────────────┐
│  📊 Performance                                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │  Taxa de Conclusão Geral: 20.5%              │  │
│  │  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  🔥 Cursos Mais Populares                           │
│  ┌──────────────────────────────────────────────┐  │
│  │ 1. Desenvolvimento Full Stack                │  │
│  │    250 inscrições | 8 turmas                  │  │
│  │ 2. React Avançado                             │  │
│  │    180 inscrições | 5 turmas                  │  │
│  │ ...                                            │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ✅ Cursos com Maior Taxa de Conclusão             │
│  ┌──────────────────────────────────────────────┐  │
│  │ 1. SQL Completo                              │  │
│  │    85.5% de conclusão (85/100 inscrições)    │  │
│  │ 2. Gestão de Projetos                        │  │
│  │    78.0% de conclusão (78/100 inscrições)    │  │
│  │ ...                                            │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Funcionalidades:**

- Barra de progresso visual para taxa de conclusão
- Lista de cursos mais populares (por número de inscrições)
- Lista de cursos com maior taxa de conclusão
- Gráfico de barras comparativo (opcional)
- Link para ver detalhes do curso

**Design:**

- Cards/tabelas limpas e organizadas
- Badges de percentual destacados
- Cores para diferentes níveis de performance (verde = bom, amarelo = médio, vermelho = baixo)
- Responsivo

---

## 🎨 Diretrizes de Design

### Cores Sugeridas:

- **Métricas Gerais:** Azul (#3B82F6) / Verde (#10B981)
- **Faturamento:** Amarelo/Ouro (#F59E0B) / Verde (#10B981)
- **Performance:** Roxo (#8B5CF6) / Azul (#3B82F6)
- **Status:**
  - Sucesso/Ativo: Verde (#10B981)
  - Aviso: Amarelo (#F59E0B)
  - Erro: Vermelho (#EF4444)
  - Info: Azul (#3B82F6)

### Componentes Necessários:

1. **Cards de Métricas** - Componente reutilizável para números
2. **Tabs/Aba** - Para filtrar cursos próximos
3. **Lista de Turmas** - Cards com informações de turmas
4. **Tabela de Ranking** - Para top cursos
5. **Gráficos** (opcional) - Chart.js, Recharts, ou similar
6. **Loading State** - Skeleton ou spinner durante carregamento
7. **Empty State** - Mensagem quando não há dados
8. **Error State** - Tratamento de erros

### Responsividade:

- **Mobile:** 1 coluna, cards empilhados
- **Tablet:** 2 colunas
- **Desktop:** 3-4 colunas conforme seção

### Estados da Interface:

- ✅ **Loading:** Mostrar skeleton ou spinner
- ✅ **Success:** Mostrar dados normalmente
- ✅ **Empty:** Mensagem amigável quando não há dados
- ✅ **Error:** Mostrar mensagem de erro com opção de retry

---

## 🔧 Funcionalidades Técnicas

### 1. **Tratamento de Erros:**

```typescript
// Se retornar 403 (Forbidden), redirecionar ou mostrar mensagem
// Se retornar 401 (Unauthorized), redirecionar para login
// Se retornar 500, mostrar mensagem de erro com opção de retry
```

### 2. **Formatação de Dados:**

- **Valores Monetários:** Formatar como R$ (BRL)
  ```typescript
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  ```
- **Datas:** Formatar como DD/MM/YYYY HH:mm
- **Percentuais:** Formatar com 1-2 casas decimais e símbolo %
- **Números:** Formatar com separador de milhar

### 3. **Loading e Cache:**

- Implementar loading state durante requisição
- Considerar cache local (opcional) para melhorar UX
- Atualizar dados periodicamente ou com botão de refresh

### 4. **Navegação:**

- Links clicáveis para:
  - Ver detalhes do curso
  - Ver detalhes da turma
  - Ver lista completa de cursos

---

## 📱 Exemplo de Layout Mobile

```
┌─────────────────────────┐
│  📊 Visão Geral         │
│                         │
│ ┌───────┬───────┐      │
│ │Total  │Public │      │
│ │  15   │  12   │      │
│ └───────┴───────┘      │
│                         │
│ ┌───────┬───────┐      │
│ │Turmas │Alunos │      │
│ │  20   │  280  │      │
│ └───────┴───────┘      │
│                         │
│ Próximos Cursos         │
│ [7d] [15d] [30d]        │
│                         │
│ ┌───────────────────┐  │
│ │ 📚 Full Stack     │  │
│ │ Inicia em 3 dias  │  │
│ └───────────────────┘  │
│                         │
│ 💰 Faturamento          │
│ R$ 150.000,50          │
│                         │
│ 📊 Performance          │
│ Taxa: 20.5%            │
└─────────────────────────┘
```

---

## ✅ Checklist de Implementação

- [ ] Criar página/rota `/cursos/visaogeral`
- [ ] Implementar autenticação/autorização (ADMIN/MODERADOR)
- [ ] Criar componente de Cards de Métricas
- [ ] Criar seção de Cursos Próximos com Tabs
- [ ] Criar seção de Faturamento (com aviso de dados sensíveis)
- [ ] Criar seção de Performance
- [ ] Implementar formatação de valores (R$, datas, percentuais)
- [ ] Adicionar loading states
- [ ] Adicionar empty states
- [ ] Adicionar error handling
- [ ] Implementar responsividade (mobile/tablet/desktop)
- [ ] Adicionar links de navegação
- [ ] Testar com dados reais da API
- [ ] Adicionar acessibilidade (ARIA labels, keyboard navigation)

---

## 🎯 Prioridades

1. **Alta:** Cards de métricas, Cursos próximos, Faturamento básico
2. **Média:** Performance, Gráficos, Comparações
3. **Baixa:** Animações, Tooltips avançados, Exportação de dados

---

## 📝 Observações Importantes

1. **Dados Sensíveis:** Faturamento deve ter indicação visual clara de que são dados confidenciais
2. **Performance:** Considerar paginação ou lazy loading se houver muitos dados
3. **Acessibilidade:** Seguir padrões WCAG 2.1
4. **Testes:** Testar com diferentes tamanhos de tela e dados vazios
5. **Documentação:** Documentar componentes criados para reutilização

---

## 🚀 Próximos Passos (Opcional)

Após implementação básica, considerar:

- Exportação de relatórios (PDF/Excel)
- Filtros por período (últimos 30 dias, trimestre, etc.)
- Gráficos interativos
- Notificações para cursos próximos
- Comparação entre períodos
- Dashboard personalizável (drag & drop)

---

**Qualquer dúvida sobre a API, consultar a documentação Swagger em `/api/docs`**
