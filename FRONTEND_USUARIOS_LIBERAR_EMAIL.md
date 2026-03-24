# Frontend — Liberar Validação de Email no Painel de Usuários

## Objetivo

Documentar a nova ação administrativa para liberar manualmente o acesso de um usuário sem exigir a validação de email pelo link enviado.

Tela alvo:

- `/dashboard/usuarios/:userId`

> Se o objetivo for tirar o usuário de `PENDENTE` e liberar acesso real à plataforma, usar a rota nova
> `PATCH /api/v1/usuarios/usuarios/:userId/liberar-acesso`.
> Esta documentação permanece válida apenas para o bypass isolado da verificação de email.

---

## Regra de negócio

A ação libera apenas a pendência de validação de email.

Ela:

- marca o email como verificado manualmente
- limpa token pendente de verificação
- permite login quando o único bloqueio era `EMAIL_NOT_VERIFIED`

Ela **não** substitui bloqueios por status.

Se o usuário estiver:

- `BLOQUEADO`
- `INATIVO`
- `SUSPENSO`
- `PENDENTE`

o backend ainda retorna sucesso para a liberação do email, mas o frontend deve olhar `statusPermiteLogin`.

---

## Nova rota

`PATCH /api/v1/usuarios/usuarios/:userId/liberar-email`

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

### Não permitido

- `SETOR_DE_VAGAS`
- `RECRUTADOR`
- `INSTRUTOR`
- demais perfis fora da gestão

---

## Body

Body opcional:

```json
{
  "motivo": "Liberação manual pelo painel"
}
```

### Regras do campo `motivo`

- opcional
- mínimo: `3` caracteres
- máximo: `500` caracteres

---

## Resposta de sucesso

```json
{
  "success": true,
  "code": "EMAIL_VALIDATION_BYPASSED",
  "message": "Validação de email liberada manualmente com sucesso.",
  "data": {
    "id": "uuid",
    "email": "usuario@email.com",
    "nomeCompleto": "Usuário Exemplo",
    "role": "ALUNO_CANDIDATO",
    "status": "ATIVO",
    "emailVerificado": true,
    "emailVerificadoEm": "2026-03-24T12:53:23.297Z",
    "alreadyVerified": false,
    "statusPermiteLogin": true
  }
}
```

### Campo `alreadyVerified`

- `false`: a liberação foi aplicada agora
- `true`: o usuário já estava com email liberado/verificado

### Campo `statusPermiteLogin`

- `true`: o status atual permite login após a liberação do email
- `false`: ainda existe bloqueio por status do usuário

---

## Erros esperados

### `400 INVALID_ID`

Quando `userId` não for UUID válido.

### `400 VALIDATION_ERROR`

Quando o body vier inválido.

Exemplo:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos para liberação da validação de email",
  "errors": [
    {
      "path": "motivo",
      "message": "Motivo deve ter pelo menos 3 caracteres"
    }
  ]
}
```

### `403 FORBIDDEN`

Quando a role logada não pode executar a ação.

### `403 FORBIDDEN_USER_ROLE`

Quando `PEDAGOGICO` tenta liberar um usuário com role diferente de:

- `ALUNO_CANDIDATO`
- `INSTRUTOR`

### `404 USER_NOT_FOUND`

Quando o usuário não existir.

---

## Detalhe do usuário

O endpoint de detalhe:

`GET /api/v1/usuarios/usuarios/:userId`

agora retorna também o resumo da verificação de email:

```json
{
  "usuario": {
    "id": "uuid",
    "emailVerificado": false,
    "emailVerificadoEm": null,
    "UsuariosVerificacaoEmail": {
      "verified": false,
      "verifiedAt": null,
      "tokenExpiration": null,
      "attempts": 0,
      "lastAttemptAt": null
    }
  }
}
```

### Uso recomendado

No detalhe do usuário:

- mostrar status de email com base em `emailVerificado`
- exibir ação `Liberar acesso por email` quando fizer sentido
- após sucesso, atualizar a tela com o `data` retornado pelo `PATCH`

---

## Fluxo recomendado no frontend

### 1) Carregar detalhe do usuário

Usar:

- `GET /api/v1/usuarios/usuarios/:userId`

### 2) Mostrar ação no menu

Sugestão de label:

- `Liberar acesso por email`

### 3) Ao confirmar ação

Chamar:

```ts
await api.patch(`/api/v1/usuarios/usuarios/${userId}/liberar-email`, {
  motivo: 'Liberação manual pelo painel',
});
```

### 4) Após sucesso

- atualizar `emailVerificado`
- atualizar `emailVerificadoEm`
- atualizar badge/estado local
- se `statusPermiteLogin === false`, mostrar aviso de que ainda existe bloqueio por status

---

## Exemplo de tratamento

```ts
try {
  const response = await api.patch(`/api/v1/usuarios/usuarios/${userId}/liberar-email`, {
    motivo: 'Liberação manual pelo painel',
  });

  const data = response.data?.data;

  setUsuarioAtual((prev) => ({
    ...prev,
    emailVerificado: data.emailVerificado,
    emailVerificadoEm: data.emailVerificadoEm,
    status: data.status,
    UsuariosVerificacaoEmail: {
      ...(prev?.UsuariosVerificacaoEmail ?? {}),
      verified: data.emailVerificado,
      verifiedAt: data.emailVerificadoEm,
    },
  }));

  if (!data.statusPermiteLogin) {
    toast.warning('O email foi liberado, mas o usuário ainda possui bloqueio por status.');
  } else {
    toast.success('Validação de email liberada com sucesso.');
  }
} catch (error: any) {
  const code = error?.response?.data?.code;

  if (code === 'FORBIDDEN_USER_ROLE') {
    toast.error('O setor pedagógico só pode liberar alunos e instrutores.');
    return;
  }

  throw error;
}
```

---

## Checklist frontend

- [ ] Adicionar ação `Liberar acesso por email` no detalhe do usuário
- [ ] Consumir `PATCH /api/v1/usuarios/usuarios/:userId/liberar-email`
- [ ] Tratar `statusPermiteLogin`
- [ ] Tratar `403 FORBIDDEN_USER_ROLE` para `PEDAGOGICO`
- [ ] Atualizar a tela com o payload retornado no sucesso
- [ ] Usar `emailVerificado` do detalhe para renderizar estado atual
