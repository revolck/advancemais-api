# Módulo de Auditoria

Este módulo implementa um sistema completo de auditoria para a API Advance+, fornecendo rastreamento detalhado de atividades do sistema, usuários, scripts, assinaturas e transações.

## Estrutura

### Tabelas de Banco de Dados

1. **AuditoriaLogs** - Logs gerais do sistema
2. **AuditoriaScripts** - Scripts executados no sistema
3. **AuditoriaTransacoes** - Transações financeiras e de pagamento

### Seções da API

1. **Logs** (`/api/v1/auditoria/logs`) - Logs gerais de auditoria
2. **Histórico de Usuários** (`/api/v1/auditoria/usuarios/{usuarioId}/historico`) - Histórico de ações de usuários
3. **Scripts** (`/api/v1/auditoria/scripts`) - Scripts executados no sistema
4. **Assinaturas** (`/api/v1/auditoria/assinaturas`) - Logs e transações de assinaturas
5. **Transações** (`/api/v1/auditoria/transacoes`) - Transações financeiras

## Funcionalidades

### Logs Gerais

- Listagem de logs de auditoria com filtros
- Visualização detalhada de logs específicos
- Filtros por categoria, tipo, ação, usuário, entidade
- Paginação e ordenação por data

### Histórico de Usuários

- Combina logs de `AuditoriaLogs` e `PermissoesAuditoriaAcessos`
- Histórico completo de ações de um usuário específico
- Filtros por ação, tipo de entidade, role
- Ordenação cronológica

### Scripts

- Registro de scripts executados no sistema
- Controle de status (PENDENTE, EXECUTANDO, CONCLUIDO, ERRO, CANCELADO)
- Tipos de scripts (MIGRACAO, BACKUP, LIMPEZA, RELATORIO, INTEGRACAO, MANUTENCAO)
- Rastreamento de duração e resultados

### Assinaturas

- Combina dados de `LogsPagamentosDeAssinaturas` e `AuditoriaTransacoes`
- Filtros por usuário, plano empresarial, tipo, status
- Visualização unificada de logs de pagamento e transações

### Transações

- Gestão completa de transações financeiras
- Tipos: PAGAMENTO, REEMBOLSO, ESTORNO, ASSINATURA, CUPOM, TAXA
- Status: PENDENTE, PROCESSANDO, APROVADA, RECUSADA, CANCELADA, ESTORNADA
- Integração com gateways de pagamento

## Segurança

- Todas as rotas requerem autenticação
- Middleware de permissões granular (RBAC + ACL)
- Logs de acesso e tentativas de acesso
- Validação rigorosa de entrada com Zod

## Uso

### Exemplo de Registro de Log

```typescript
import { auditoriaService } from '@/modules/auditoria';

await auditoriaService.registrarLog({
  categoria: 'USUARIO',
  tipo: 'LOGIN',
  acao: 'AUTENTICACAO',
  usuarioId: 'user-id',
  descricao: 'Usuário fez login no sistema',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
});
```

### Exemplo de Registro de Script

```typescript
import { scriptsAuditoriaService } from '@/modules/auditoria';

await scriptsAuditoriaService.registrarScript({
  nome: 'Backup de Dados',
  tipo: 'BACKUP',
  status: 'EXECUTANDO',
  executadoPor: 'admin-user-id',
  parametros: { tabelas: ['usuarios', 'empresas'] },
});
```

### Exemplo de Registro de Transação

```typescript
import { transacoesAuditoriaService } from '@/modules/auditoria';

await transacoesAuditoriaService.registrarTransacao({
  tipo: 'PAGAMENTO',
  status: 'APROVADA',
  valor: 99.9,
  usuarioId: 'user-id',
  gateway: 'mercadopago',
  gatewayId: 'mp-123456',
  referencia: 'ASSINATURA-001',
});
```

## Documentação da API

A documentação completa da API está disponível através do Swagger/Redoc em `/docs` quando o servidor estiver rodando.

## Enums

### AuditoriaCategoria

- SISTEMA
- USUARIO
- EMPRESA
- VAGA
- CURSO
- PAGAMENTO
- SCRIPT
- SEGURANCA

### ScriptTipo

- MIGRACAO
- BACKUP
- LIMPEZA
- RELATORIO
- INTEGRACAO
- MANUTENCAO

### ScriptStatus

- PENDENTE
- EXECUTANDO
- CONCLUIDO
- ERRO
- CANCELADO

### TransacaoTipo

- PAGAMENTO
- REEMBOLSO
- ESTORNO
- ASSINATURA
- CUPOM
- TAXA

### TransacaoStatus

- PENDENTE
- PROCESSANDO
- APROVADA
- RECUSADA
- CANCELADA
- ESTORNADA
