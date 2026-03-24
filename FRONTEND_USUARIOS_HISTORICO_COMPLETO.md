# Frontend — Histórico Completo de Usuário

## Objetivo

Documentar a rota oficial de histórico/auditoria para a tela:

- `/dashboard/usuarios/:userId`

Essa rota alimenta a aba `Histórico` do detalhe do usuário no painel.

---

## Nova rota

`GET /api/v1/usuarios/usuarios/:userId/historico`

### Permissões

Mesmas permissões do detalhe do usuário no painel.

Perfis que já conseguem acessar o detalhe continuam podendo acessar o histórico.

---

## Query

Parâmetros suportados:

- `page` opcional, default `1`
- `pageSize` opcional, default `10`, máximo `50`
- `tipos` opcional, csv
- `categorias` opcional, csv
- `atorId` opcional
- `atorRole` opcional
- `dataInicio` opcional, ISO datetime
- `dataFim` opcional, ISO datetime
- `search` opcional

Exemplos:

```bash
GET /api/v1/usuarios/usuarios/:userId/historico?page=1&pageSize=10
```

```bash
GET /api/v1/usuarios/usuarios/:userId/historico?categorias=SEGURANCA,ACESSO&tipos=USUARIO_LOGIN,USUARIO_ACESSO_LIBERADO
```

---

## Tipos retornados

O backend já normaliza a timeline para estes tipos:

- `USUARIO_CRIADO`
- `USUARIO_ATUALIZADO`
- `USUARIO_STATUS_ALTERADO`
- `USUARIO_ROLE_ALTERADA`
- `USUARIO_ACESSO_LIBERADO`
- `USUARIO_BLOQUEADO`
- `USUARIO_DESBLOQUEADO`
- `USUARIO_EMAIL_LIBERADO`
- `USUARIO_EMAIL_VERIFICADO`
- `USUARIO_SENHA_RESETADA`
- `USUARIO_LOGIN`
- `USUARIO_LOGOUT`
- `USUARIO_ENDERECO_ATUALIZADO`
- `USUARIO_SOCIAL_LINK_ATUALIZADO`
- `USUARIO_AVATAR_ATUALIZADO`
- `USUARIO_CPF_ATUALIZADO`
- `USUARIO_TELEFONE_ATUALIZADO`

## Categorias retornadas

- `CADASTRO`
- `PERFIL`
- `SEGURANCA`
- `ACESSO`
- `STATUS`
- `ADMINISTRATIVO`

---

## Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-log",
        "tipo": "USUARIO_ACESSO_LIBERADO",
        "categoria": "ACESSO",
        "titulo": "Acesso liberado manualmente",
        "descricao": "Acesso liberado manualmente para usuario@email.com.",
        "dataHora": "2026-03-24T12:53:23.297Z",
        "ator": {
          "id": "uuid-admin",
          "nome": "Maria Souza",
          "role": "PEDAGOGICO",
          "roleLabel": "Setor Pedagógico",
          "avatarUrl": null
        },
        "alvo": {
          "id": "uuid-user",
          "nomeCompleto": "Usuário Exemplo",
          "email": "usuario@email.com",
          "role": "ALUNO_CANDIDATO",
          "status": "PENDENTE"
        },
        "contexto": {
          "ip": "10.0.0.5",
          "userAgent": "Mozilla/5.0...",
          "origem": "PAINEL_ADMIN"
        },
        "dadosAnteriores": {
          "status": "PENDENTE",
          "emailVerificado": false,
          "emailVerificadoEm": null
        },
        "dadosNovos": {
          "status": "ATIVO",
          "emailVerificado": true,
          "emailVerificadoEm": "2026-03-24T12:53:23.297Z"
        },
        "meta": {
          "motivo": "Liberação manual pelo painel"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 27,
      "totalPages": 3
    },
    "resumo": {
      "total": 27,
      "ultimoEventoEm": "2026-03-24T12:53:23.297Z"
    }
  }
}
```

---

## Regras importantes

- a timeline é imutável
- eventos antigos continuam disponíveis mesmo após novas alterações
- `ator.nome` e `ator.roleLabel` já vêm prontos para renderização
- em criação:
  - `dadosAnteriores` pode vir `null`
  - `dadosNovos` vem preenchido
- em alteração:
  - `dadosAnteriores` e `dadosNovos` vêm preenchidos quando houver diff
- em login/logout:
  - `dadosAnteriores` e `dadosNovos` podem vir `null`
  - `contexto.ip` e `contexto.userAgent` podem vir preenchidos

---

## Fluxo recomendado no frontend

1. Abrir aba `Histórico` no detalhe do usuário.
2. Buscar:

```ts
const response = await api.get(`/api/v1/usuarios/usuarios/${userId}/historico`, {
  params: {
    page: 1,
    pageSize: 10,
  },
});
```

3. Renderizar:

- data/hora
- ator
- role do ator
- ação
- valores anteriores
- valores novos

4. Aplicar filtros usando a própria rota.

---

## Tratamento de erros

- `400 INVALID_ID`
- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `403 FORBIDDEN_USER_ROLE`
- `404 USER_NOT_FOUND`
- `500 USER_HISTORY_ERROR`

---

## Checklist frontend

- [ ] Criar aba `Histórico` no detalhe do usuário
- [ ] Consumir `GET /api/v1/usuarios/usuarios/:userId/historico`
- [ ] Suportar paginação
- [ ] Exibir ator com `nome`, `role` e `roleLabel`
- [ ] Exibir diff usando `dadosAnteriores` e `dadosNovos`
- [ ] Aplicar filtros por tipo, categoria, ator e período
- [ ] Tratar `403 FORBIDDEN_USER_ROLE` quando o perfil logado não puder acessar aquele usuário
