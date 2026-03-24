# Frontend — Liberar Acesso Completo no Painel de Usuários

## Objetivo

Documentar a ação administrativa de liberação completa de acesso no detalhe do usuário:

- `/dashboard/usuarios/:userId`

Essa ação deve substituir o uso do fluxo antigo de apenas liberar email quando o usuário estiver `PENDENTE`.

---

## Nova rota

`PATCH /api/v1/usuarios/usuarios/:userId/liberar-acesso`

### Permissões

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

### Restrição para `PEDAGOGICO`

Pode liberar somente usuários com role:

- `ALUNO_CANDIDATO`
- `INSTRUTOR`

Se tentar liberar outra role:

- `403 FORBIDDEN_USER_ROLE`

---

## Regra de negócio

Quando o usuário estiver em `PENDENTE`, a ação deve concluir a ativação real:

- marcar email como verificado
- limpar token pendente de verificação
- alterar `status` de `PENDENTE` para `ATIVO`
- permitir login imediatamente

### Se o email já estiver verificado

Mesmo assim, se o usuário ainda estiver `PENDENTE`, a rota deve ativar:

- mantém `emailVerificado = true`
- altera `status = ATIVO`

### Status bloqueantes

Se o usuário estiver em:

- `BLOQUEADO`
- `INATIVO`
- `SUSPENSO`

a rota retorna erro de negócio e não ativa a conta.

---

## Body

Body opcional:

```json
{
  "motivo": "Liberação manual pelo painel"
}
```

### Validação do `motivo`

- opcional
- mínimo: `3`
- máximo: `500`

---

## Resposta de sucesso

```json
{
  "success": true,
  "code": "USER_ACCESS_RELEASED",
  "message": "Acesso do usuário liberado com sucesso.",
  "data": {
    "id": "uuid",
    "email": "usuario@email.com",
    "nomeCompleto": "Usuário Exemplo",
    "role": "ALUNO_CANDIDATO",
    "statusAnterior": "PENDENTE",
    "status": "ATIVO",
    "emailVerificado": true,
    "emailVerificadoEm": "2026-03-24T15:10:00.000Z",
    "alreadyVerified": false,
    "statusPermiteLogin": true,
    "acessoLiberado": true
  }
}
```

### Campos principais

- `statusAnterior`
  - status antes da ação

- `status`
  - status final persistido

- `alreadyVerified`
  - `true` se o email já estava verificado antes

- `statusPermiteLogin`
  - `true` quando o status final permite login

- `acessoLiberado`
  - `true` quando o usuário terminou a ação apto a acessar a plataforma

---

## Erros esperados

- `400 INVALID_ID`
- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `403 FORBIDDEN_USER_ROLE`
- `404 USER_NOT_FOUND`
- `409 USER_ACCESS_RELEASE_BLOCKED_BY_STATUS`
- `500 USER_ACCESS_RELEASE_ERROR`

### Exemplo de bloqueio por status

```json
{
  "success": false,
  "code": "USER_ACCESS_RELEASE_BLOCKED_BY_STATUS",
  "message": "Não é possível liberar acesso para usuários bloqueados, inativos ou suspensos.",
  "details": {
    "statusAtual": "BLOQUEADO"
  }
}
```

---

## Histórico

Essa ação gera evento na aba de histórico do usuário:

- `USUARIO_ACESSO_LIBERADO`

Categoria:

- `ACESSO`

Diff esperado:

```json
{
  "dadosAnteriores": {
    "status": "PENDENTE",
    "emailVerificado": false
  },
  "dadosNovos": {
    "status": "ATIVO",
    "emailVerificado": true
  }
}
```

---

## Fluxo recomendado no frontend

1. No detalhe do usuário pendente, exibir ação `Liberar acesso`.
2. Chamar `PATCH /api/v1/usuarios/usuarios/:userId/liberar-acesso`.
3. Após sucesso:
   - atualizar `status`
   - atualizar `emailVerificado`
   - atualizar `emailVerificadoEm`
   - atualizar badges/estado local
4. Não exibir mais aviso de “email liberado mas usuário continua pendente”.

---

## Exemplo de consumo

```ts
try {
  const response = await api.patch(`/api/v1/usuarios/usuarios/${userId}/liberar-acesso`, {
    motivo: 'Liberação manual pelo painel',
  });

  const data = response.data?.data;

  setUsuarioAtual((prev) => ({
    ...prev,
    status: data.status,
    emailVerificado: data.emailVerificado,
    emailVerificadoEm: data.emailVerificadoEm,
    UsuariosVerificacaoEmail: {
      ...(prev?.UsuariosVerificacaoEmail ?? {}),
      verified: data.emailVerificado,
      verifiedAt: data.emailVerificadoEm,
    },
  }));

  toast.success('Acesso do usuário liberado com sucesso.');
} catch (error: any) {
  const code = error?.response?.data?.code;

  if (code === 'USER_ACCESS_RELEASE_BLOCKED_BY_STATUS') {
    toast.error('Esse usuário precisa de outro fluxo administrativo para voltar a acessar.');
    return;
  }

  if (code === 'FORBIDDEN_USER_ROLE') {
    toast.error('O setor pedagógico só pode liberar alunos e instrutores.');
    return;
  }

  throw error;
}
```

---

## Checklist frontend

- [ ] Adicionar ação `Liberar acesso` no detalhe do usuário
- [ ] Consumir `PATCH /api/v1/usuarios/usuarios/:userId/liberar-acesso`
- [ ] Atualizar `status`, `emailVerificado` e `emailVerificadoEm` no sucesso
- [ ] Tratar `409 USER_ACCESS_RELEASE_BLOCKED_BY_STATUS`
- [ ] Tratar `403 FORBIDDEN_USER_ROLE` para `PEDAGOGICO`
- [ ] Remover aviso antigo de que o usuário continua pendente após a liberação
