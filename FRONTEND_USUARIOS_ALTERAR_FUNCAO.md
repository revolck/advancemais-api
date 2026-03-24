# Frontend — Alterar Função e Privilégios do Usuário

## Objetivo

Documentar a ação administrativa para alterar a função principal de um usuário no detalhe:

- `/dashboard/usuarios/:userId`

A ação deve ficar no menu `Ações` como:

- `Alterar função`

---

## Nova rota

`PATCH /api/v1/usuarios/usuarios/:userId/role`

---

## Permissões

Perfis com permissão de gestão:

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

### Regra por perfil

#### `ADMIN`

Pode alterar para qualquer função válida:

- `ADMIN`
- `MODERADOR`
- `EMPRESA`
- `ALUNO_CANDIDATO`
- `INSTRUTOR`
- `PEDAGOGICO`
- `SETOR_DE_VAGAS`
- `RECRUTADOR`
- `FINANCEIRO`

#### `MODERADOR`

Pode gerenciar apenas usuários fora da gestão alta.

Regras aplicadas:

- não pode alterar usuário `ADMIN`
- não pode alterar usuário `MODERADOR`
- não pode promover para `ADMIN`
- não pode promover para `MODERADOR`

Funções de destino permitidas:

- `EMPRESA`
- `ALUNO_CANDIDATO`
- `INSTRUTOR`
- `PEDAGOGICO`
- `SETOR_DE_VAGAS`
- `RECRUTADOR`
- `FINANCEIRO`

#### `PEDAGOGICO`

Pode gerenciar somente:

- usuários com role atual `ALUNO_CANDIDATO`
- usuários com role atual `INSTRUTOR`

E pode alterar apenas entre:

- `ALUNO_CANDIDATO`
- `INSTRUTOR`

---

## Restrições de negócio

### Autoalteração

O usuário logado não pode alterar a própria função.

Erro esperado:

- `403 FORBIDDEN_SELF_ROLE_CHANGE`

### Role inválida para o gestor logado

Quando a role logada não puder aplicar a função desejada:

- `403 FORBIDDEN_USER_ROLE`

### Fluxos bloqueados

Combinações bloqueadas por regra interna retornam erro explícito.

Exemplo atual:

- tentar trocar para a mesma função atual

Erro esperado:

- `409 USER_ROLE_UPDATE_BLOCKED`

---

## Body

```json
{
  "role": "INSTRUTOR",
  "motivo": "Ajuste administrativo pelo painel"
}
```

### Regras do body

- `role` obrigatório
- `role` deve ser uma função válida
- `motivo` opcional
- `motivo` mínimo `3`
- `motivo` máximo `500`

---

## Resposta de sucesso

```json
{
  "success": true,
  "code": "USER_ROLE_UPDATED",
  "message": "Função do usuário alterada com sucesso.",
  "data": {
    "id": "uuid",
    "nomeCompleto": "Usuário Exemplo",
    "email": "usuario@email.com",
    "roleAnterior": "ALUNO_CANDIDATO",
    "role": "INSTRUTOR",
    "status": "ATIVO",
    "emailVerificado": true,
    "emailVerificadoEm": "2026-03-24T18:10:00.000Z",
    "atualizadoEm": "2026-03-24T18:10:00.000Z"
  }
}
```

### Uso esperado no frontend

No sucesso, o frontend deve atualizar imediatamente:

- `role`
- `atualizadoEm`
- badges/labels de função
- aba `Histórico` via re-fetch
- listagem de usuários via invalidação de cache

---

## Histórico

A alteração aparece em:

- `GET /api/v1/usuarios/usuarios/:userId/historico`

### Evento esperado

- `USUARIO_ROLE_ALTERADA`

### Categoria esperada

- `ADMINISTRATIVO`

### Diff esperado

```json
{
  "dadosAnteriores": {
    "role": "ALUNO_CANDIDATO"
  },
  "dadosNovos": {
    "role": "INSTRUTOR"
  },
  "meta": {
    "motivo": "Ajuste administrativo pelo painel"
  }
}
```

---

## Erros esperados

- `400 INVALID_ID`
- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `403 FORBIDDEN_USER_ROLE`
- `403 FORBIDDEN_SELF_ROLE_CHANGE`
- `404 USER_NOT_FOUND`
- `409 USER_ROLE_UPDATE_BLOCKED`
- `500 USER_ROLE_UPDATE_ERROR`

---

## Fluxo esperado no frontend

1. Abrir detalhe do usuário.
2. Clicar em `Ações > Alterar função`.
3. Selecionar a nova função.
4. Confirmar a alteração.
5. Após sucesso:
   - atualizar badge de função na tela
   - atualizar a aba `Sobre`
   - invalidar listagem
   - recarregar histórico

---

## Checklist frontend

- [ ] Adicionar ação `Alterar função` no menu `Ações`
- [ ] Consumir `PATCH /api/v1/usuarios/usuarios/:userId/role`
- [ ] Restringir opções por role do usuário logado
- [ ] Impedir alteração da própria função
- [ ] Atualizar a tela com o retorno do sucesso
- [ ] Refletir a mudança no histórico com `USUARIO_ROLE_ALTERADA`
