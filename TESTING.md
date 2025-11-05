# 🧪 Sistema de Testes Automatizados

## 📋 Visão Geral

Sistema completo de testes automatizados que valida a API sem necessidade de intervenção manual.

### ✅ O que é testado?

- **Conectividade**: Health checks, banco de dados, endpoints
- **Performance**: Tempo de resposta, queries lentas, carga
- **Funcionalidade**: Filtros, paginação, estrutura de dados
- **Resiliência**: Retry logic, reconexão automática
- **Índices**: Validação de índices no banco

---

## 🚀 Como Usar

### Teste Rápido (10 segundos)

```bash
# Teste rápido - apenas API e endpoints
./scripts/quick-test.sh
```

**O que valida:**

- ✅ API está respondendo
- ✅ Performance < 500ms
- ✅ Endpoints principais acessíveis

### Testes de Integração (1-2 minutos)

```bash
# Testes completos com banco de dados
pnpm test:integration
```

**O que valida:**

- ✅ Conectividade com banco
- ✅ Queries com filtros
- ✅ Paginação
- ✅ Performance de índices
- ✅ Estrutura de dados

### Testes de Performance

```bash
# Apenas testes de performance e resiliência
pnpm test:performance
```

**O que valida:**

- ✅ Retry logic
- ✅ Reconexão automática
- ✅ Performance sob carga
- ✅ Queries complexas

### Teste Completo com Relatório

```bash
# Testes completos + script de validação
./scripts/test-api.sh
```

**O que valida:**

- ✅ Tudo dos testes anteriores
- ✅ Relatório colorido
- ✅ Estatísticas detalhadas

---

## 📊 Comandos Disponíveis

| Comando                   | Descrição                    | Tempo    |
| ------------------------- | ---------------------------- | -------- |
| `./scripts/quick-test.sh` | Teste rápido de API          | ~10s     |
| `pnpm test`               | Todos os testes Jest         | ~2min    |
| `pnpm test:integration`   | Testes de integração         | ~1min    |
| `pnpm test:performance`   | Testes de performance        | ~30s     |
| `pnpm test:watch`         | Modo watch (desenvolvimento) | Contínuo |
| `pnpm test:coverage`      | Com relatório de cobertura   | ~3min    |
| `./scripts/test-api.sh`   | Teste completo automatizado  | ~3min    |

---

## 🎯 Estrutura de Testes

```
src/modules/cursos/__tests__/
├── alunos.integration.test.ts    # Testes de integração
└── performance.test.ts            # Testes de performance

scripts/
├── quick-test.sh                  # Teste rápido
└── test-api.sh                    # Teste completo
```

---

## 📝 Exemplos de Saída

### Teste Rápido

```
🚀 TESTE RÁPIDO DA API

1. Health Check...
✅ API está respondendo

2. Performance...
✅ Performance excelente: 8ms

3. Verificando endpoints...
  ✅ /health - HTTP 200
  ✅ /api/v1/usuarios - HTTP 200
  ✅ /api/v1/cursos - HTTP 200

=====================================
✅ TESTES RÁPIDOS CONCLUÍDOS!
=====================================
```

### Teste de Integração

```
PASS src/modules/cursos/__tests__/alunos.integration.test.ts

Conectividade com Banco de Dados
  ✓ deve conectar ao banco de dados (120ms)
  ✓ deve ter usuários do tipo ALUNO_CANDIDATO (45ms)
  ✓ deve ter alunos com inscrições (38ms)

Performance dos Índices
  ✓ deve filtrar por cidade rapidamente (< 1s) (234ms)
  ✓ deve contar alunos rapidamente (< 500ms) (156ms)
  ✓ deve filtrar por status de inscrição rapidamente (< 1s) (287ms)

Filtros
  ✓ deve filtrar alunos por cidade (198ms)
  ✓ deve filtrar alunos por status de inscrição (245ms)
  ✓ deve buscar alunos por nome (search) (167ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Time:        3.456s
```

---

## 🔧 Configuração

### Pré-requisitos

```bash
# Instalar dependências
pnpm install

# Configurar banco de dados
cp .env.example .env
# Editar .env com suas credenciais

# Gerar cliente Prisma
pnpm prisma:generate
```

### Variáveis de Ambiente para Testes

```env
# .env.test (opcional)
DATABASE_URL="postgresql://..."
NODE_ENV=test
```

---

## 🎯 Casos de Uso

### 1. Desenvolvimento Local

```bash
# Durante desenvolvimento, use modo watch
pnpm test:watch
```

Os testes rodam automaticamente quando você salvar arquivos.

### 2. Antes de Commit

```bash
# Validar tudo antes de commitar
./scripts/quick-test.sh && pnpm test:integration
```

### 3. CI/CD Pipeline

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: |
    pnpm install
    pnpm test:integration
    pnpm test:performance
```

### 4. Validação de Deploy

```bash
# Após deploy, validar produção
API_URL=https://api.seudominio.com ./scripts/quick-test.sh
```

---

## 📊 Métricas de Performance

Os testes validam automaticamente:

| Métrica               | Limite   | Teste |
| --------------------- | -------- | ----- |
| Health Check          | < 500ms  | ✅    |
| Query Simples         | < 500ms  | ✅    |
| Query Complexa        | < 1000ms | ✅    |
| Filtro com Índice     | < 1000ms | ✅    |
| 10 Requests Paralelas | < 3000ms | ✅    |

---

## 🐛 Troubleshooting

### Teste Falha: "Can't reach database"

```bash
# Verificar se banco está acessível
nc -zv aws-1-sa-east-1.pooler.supabase.com 5432

# Verificar variáveis de ambiente
echo $DATABASE_URL
```

### Teste Falha: "Timeout"

```bash
# Verificar se há queries lentas
# Ver logs em tempo real
tail -f server.log | grep "Query lenta"
```

### Teste Falha: "No tests found"

```bash
# Gerar cliente Prisma
pnpm prisma:generate

# Limpar cache do Jest
pnpm jest --clearCache
```

---

## 📈 Melhorias Futuras

- [ ] Testes E2E com Playwright
- [ ] Testes de carga com Artillery
- [ ] Testes de segurança com OWASP ZAP
- [ ] Monitoramento contínuo com Datadog
- [ ] Alertas automáticos em caso de falha

---

## 🤝 Contribuindo

Ao adicionar novos endpoints ou features:

1. **Crie testes** em `__tests__/`
2. **Execute** `pnpm test`
3. **Valide performance** `pnpm test:performance`
4. **Commit** apenas se todos passarem

---

## 📚 Referências

- [Jest Documentation](https://jestjs.io/)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing)
- [Supertest](https://github.com/ladjs/supertest)

---

**✅ Sistema de testes configurado e funcionando!**

Execute `./scripts/quick-test.sh` para validar agora mesmo! 🚀
