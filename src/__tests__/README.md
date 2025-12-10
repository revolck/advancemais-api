# Testes Automatizados da API

## Estrutura

```
src/__tests__/
├── helpers/
│   ├── auth-helper.ts      # Helpers para criar usuários e tokens de teste
│   ├── test-setup.ts       # Setup do app Express para testes
│   └── test-middleware.ts  # Middlewares para testes (mock IP, etc.)
├── api/
│   ├── auth.test.ts        # Testes de autenticação (login, logout, refresh)
│   ├── perfil.test.ts      # Testes de perfil do usuário
│   └── cursos.test.ts      # Testes de CRUD de cursos
└── README.md
```

## Como Executar

### Executar todos os testes

```bash
npm run test -- src/__tests__/api
```

### Executar teste específico

```bash
npm run test -- src/__tests__/api/auth.test.ts
```

### Executar com cobertura

```bash
npm run test:coverage -- src/__tests__/api
```

### Usar o script helper

```bash
./scripts/run-api-tests.sh
```

## Funcionalidades Testadas

### Autenticação (`auth.test.ts`)

- ✅ Login com credenciais válidas
- ✅ Login com credenciais inválidas
- ✅ Login com email não verificado
- ✅ Refresh token válido
- ✅ Refresh token inválido
- ✅ Logout com token válido
- ✅ Logout sem token

### Perfil (`perfil.test.ts`)

- ✅ GET perfil autenticado
- ✅ GET perfil sem autenticação
- ✅ PUT atualizar perfil
- ✅ PUT validar dados inválidos
- ✅ PUT atualizar múltiplos campos
- ✅ PUT tentar atualizar email (não permitido)

### Cursos (`cursos.test.ts`)

- ✅ GET listar cursos
- ✅ GET filtrar cursos
- ✅ POST criar curso (ADMIN)
- ✅ POST criar curso sem permissão
- ✅ GET curso por ID
- ✅ PUT atualizar curso
- ✅ DELETE deletar curso
- ✅ Validações e edge cases

## Helpers Disponíveis

### `createTestUser(options?)`

Cria um usuário de teste completo com:

- Email verificado
- Sessão no banco
- Tokens de acesso e refresh

```typescript
const user = await createTestUser({
  email: 'test@example.com',
  password: 'Test123!',
  role: Roles.ALUNO_CANDIDATO,
  emailVerificado: true,
});
```

### `createTestAdmin()`

Cria um usuário ADMIN de teste.

### `createTestModerator()`

Cria um usuário MODERADOR de teste.

### `cleanupTestUsers(userIds)`

Limpa usuários de teste do banco.

## Configuração

Os testes:

- Usam `NODE_ENV=test` automaticamente
- Mockam IP para evitar rate limiting
- Criam dados de teste isolados
- Limpam dados após os testes

## Notas

- Os testes precisam de uma conexão com o banco de dados
- Rate limiting é contornado usando IPs únicos por teste
- Refresh tokens precisam de sessão no banco (criada automaticamente)
- Todos os dados de teste são limpos após os testes
