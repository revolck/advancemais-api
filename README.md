# 👥 Módulo de Usuários

Sistema completo de gestão de usuários com controle de acesso, auditoria e banimentos.

## 📁 Estrutura do Módulo

```
src/modules/usuarios/
├── controllers/
│   ├── usuarios.controller.ts      # CRUD de usuários
│   ├── perfil.controller.ts        # Perfis complementares
│   ├── banimento.controller.ts     # Sistema de banimentos
│   └── auditoria.controller.ts     # Logs e auditoria
├── services/
│   ├── usuarios.service.ts         # Lógica principal de usuários
│   ├── perfil.service.ts          # Gestão de perfis
│   ├── banimento.service.ts       # Controle de banimentos
│   ├── auditoria.service.ts       # Sistema de auditoria
│   └── validacao.service.ts       # Validações de negócio
├── dto/
│   ├── criar-usuario.dto.ts       # DTO de criação
│   ├── atualizar-usuario.dto.ts   # DTOs de atualização
│   ├── perfil.dto.ts              # DTOs de perfil
│   └── banimento.dto.ts           # DTOs de banimento
└── usuarios.module.ts             # Configuração do módulo
```

## 🔐 Sistema de Autenticação Refatorado

### Principais Melhorias

- **Roles avançadas**: Sistema completo de permissões
- **Controle de banimento**: Temporário e permanente com auditoria
- **Validação aprimorada**: CPF/CNPJ, força de senha, idade mínima
- **Auditoria completa**: Logs detalhados de todas as ações

### Tipos de Usuário

```typescript
enum TipoUsuario {
  PESSOA_FISICA    // CPF obrigatório
  PESSOA_JURIDICA  // CNPJ obrigatório
}

enum Role {
  ADMIN           // Acesso total
  ADMINISTRATOR   // Gestão administrativa
  FINANCIAL       // Operações financeiras
  PROFESSOR       // Ensino e avaliações
  STUDENT         // Acesso básico de aluno
  COMPANY         // Empresas parceiras
  PEDAGOGICAL     // Coordenação pedagógica
  RECRUITER       // Recrutamento
  HR              // Recursos humanos
}
```

## 🚫 Sistema de Banimentos

### Tipos de Banimento

```typescript
enum TipoBanimento {
  TEMPORARIO_15_DIAS   // 15 dias
  TEMPORARIO_30_DIAS   // 30 dias
  TEMPORARIO_90_DIAS   // 90 dias
  TEMPORARIO_120_DIAS  // 120 dias
  PERMANENTE           // Sem prazo
}
```

### Funcionalidades

- ✅ **Aplicação automática**: Com cálculo de data de expiração
- ✅ **Processamento de expiração**: Job automático para liberar banimentos vencidos
- ✅ **Auditoria completa**: Registro de quem aplicou e removeu banimentos
- ✅ **Relatórios**: Estatísticas e métricas de banimentos

## 📋 Sistema de Perfis Complementares

### Dados Armazenados

- **Empresariais**: Razão social, nome fantasia (PJ)
- **Endereço completo**: CEP, logradouro, número, complemento, bairro, cidade, estado
- **Referência**: Ponto de referência para localização

### Funcionalidades

- ✅ **Validação de CEP**: Formato brasileiro
- ✅ **Busca por endereço**: Integração futura com APIs dos Correios
- ✅ **Estatísticas geográficas**: Distribuição por estado/cidade

## 📊 Sistema de Auditoria

### Tipos de Ação Monitorados

```typescript
enum TipoAcao {
  LOGIN                 // Entrada no sistema
  LOGOUT               // Saída do sistema
  CRIACAO              // Criação de registros
  ATUALIZACAO          // Modificação de dados
  EXCLUSAO             // Remoção de registros
  ACESSO_NEGADO        // Tentativas de acesso não autorizado
  TENTATIVA_SUSPEITA   // Atividades suspeitas
  BANIMENTO_APLICADO   // Aplicação de banimento
  BANIMENTO_REMOVIDO   // Remoção de banimento
  BANIMENTO_EXPIRADO   // Expiração automática
}
```

### Funcionalidades

- ✅ **Logs detalhados**: IP, User-Agent, descrição da ação
- ✅ **Relatórios**: Estatísticas de uso e atividades suspeitas
- ✅ **Limpeza automática**: Remoção de logs antigos (90+ dias)
- ✅ **Filtros avançados**: Por usuário, ação, período

## 🛡️ Sistema de Permissões

### Guards Implementados

1. **JwtAuthGuard**: Verificação de token JWT
2. **RolesGuard**: Controle de acesso por role

### Decorators Disponíveis

```typescript
@Public()                    // Endpoint público
@Roles(Role.ADMIN)          // Roles específicas
@AdminOnly()                // Apenas administradores
@ManagerOnly()              // Gestores e administradores
@AcademicOnly()             // Professores e pedagogos
@FinancialOnly()            // Operações financeiras
@BusinessOnly()             // Empresas e recrutadores
```

## 🔧 Validações Implementadas

### Dados Pessoais

- **Email**: Formato válido + unicidade
- **CPF**: Validação algoritmo + unicidade
- **CNPJ**: Validação algoritmo + unicidade
- **Senha**: Força (maiúscula, minúscula, número, especial)
- **Telefone**: Formato brasileiro + DDD válido
- **Idade**: Mínimo 16 anos

### Dados de Endereço

- **CEP**: Formato brasileiro (8 dígitos)
- **Estado**: UF válida (2 letras)

## 📡 API Endpoints

### Usuários

```
GET    /api/v1/usuarios           # Listar usuários (filtros)
POST   /api/v1/usuarios           # Criar usuário (admin)
GET    /api/v1/usuarios/me        # Meu perfil
GET    /api/v1/usuarios/:id       # Buscar por ID (admin)
PATCH  /api/v1/usuarios/me        # Atualizar meu perfil
PATCH  /api/v1/usuarios/:id       # Atualizar usuário (admin)
DELETE /api/v1/usuarios/:id       # Excluir usuário (admin)
```

### Perfis

```
POST   /api/v1/usuarios/perfil/me        # Criar meu perfil
GET    /api/v1/usuarios/perfil/me        # Buscar meu perfil
PATCH  /api/v1/usuarios/perfil/me        # Atualizar meu perfil
DELETE /api/v1/usuarios/perfil/me        # Excluir meu perfil
GET    /api/v1/usuarios/perfil/cep/:cep  # Buscar por CEP
```

### Banimentos

```
POST   /api/v1/usuarios/banimentos/:id         # Aplicar banimento
PATCH  /api/v1/usuarios/banimentos/:id/remover # Remover banimento
GET    /api/v1/usuarios/banimentos             # Listar banimentos
GET    /api/v1/usuarios/banimentos/:id         # Detalhes do banimento
POST   /api/v1/usuarios/banimentos/processar-expirados # Processar expirados
```

### Auditoria

```
GET    /api/v1/auditoria                    # Listar logs
GET    /api/v1/auditoria/me                 # Meus logs
GET    /api/v1/auditoria/usuario/:id        # Logs por usuário
GET    /api/v1/auditoria/stats              # Estatísticas
GET    /api/v1/auditoria/suspeitas          # Atividades suspeitas
POST   /api/v1/auditoria/limpar-antigos     # Limpar logs antigos
```

## 🚀 Melhorias Futuras

### Integração com APIs Externas

- [ ] **ViaCEP**: Preenchimento automático de endereço
- [ ] **Receita Federal**: Validação de CNPJ em tempo real
- [ ] **Serasa/SPC**: Verificação de CPF

### Recursos Avançados

- [ ] **2FA**: Autenticação de dois fatores
- [ ] **SSO**: Single Sign-On com Google/Microsoft
- [ ] **Rate Limiting**: Por usuário e IP
- [ ] **Sessões múltiplas**: Controle de dispositivos conectados

### Dashboards e Relatórios

- [ ] **Métricas em tempo real**: Usuários online, logins por hora
- [ ] **Relatórios de conformidade**: LGPD, auditoria
- [ ] **Alertas automáticos**: Atividades suspeitas, múltiplos logins

## 📈 Métricas de Performance

### Otimizações Implementadas

- **Índices de banco**: Email, CPF, CNPJ, matrícula, status
- **Paginação**: Limite máximo de 100 registros por página
- **Soft delete**: Preservação de dados para auditoria
- **Limpeza automática**: Logs antigos removidos automaticamente

### Monitoramento

- **Logs estruturados**: JSON com campos padronizados
- **Tempo de resposta**: Interceptor de logging inclui métricas
- **Rate limiting**: Proteção contra abuso da API

## 🔒 Segurança

### Implementações

- **Hash Argon2**: Senhas com salt automático
- **JWT seguro**: jose library com HS256
- **Validação rigorosa**: class-validator em todos os endpoints
- **Sanitização**: Transformação automática de dados
- **Auditoria completa**: Rastreamento de todas as ações sensíveis

### Conformidade

- **LGPD**: Logs de acesso e modificação de dados pessoais
- **Banimento auditado**: Histórico completo de penalidades
- **Retenção de dados**: Política de limpeza automática
