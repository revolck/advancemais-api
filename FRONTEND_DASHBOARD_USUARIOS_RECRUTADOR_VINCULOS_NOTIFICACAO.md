# Frontend — Notificação ao Recrutador Quando Receber Vínculo

## Objetivo

Documentar a notificação criada para o recrutador quando um:

- `ADMIN`
- `MODERADOR`

criar um vínculo em:

- `/dashboard/usuarios/:userId`
- aba `Vínculos`

---

## Rotas impactadas

### Ação que dispara

`POST /api/v1/usuarios/usuarios/:userId/vinculos-recrutador`

### Consumo já existente no frontend

- `GET /api/v1/notificacoes`
- `GET /api/v1/notificacoes/contador`

---

## Regra funcional

Quando um vínculo for criado com sucesso para um usuário com:

- `role = RECRUTADOR`

o backend cria uma notificação para o próprio recrutador alvo.

### Quando envia

- vínculo por `EMPRESA`
- vínculo por `VAGA`

### Quando não envia

- vínculo duplicado
- vínculo redundante
- erro de validação
- erro de permissão

---

## Contrato da notificação

### Tipo

- `SISTEMA`

### Status inicial

- `NAO_LIDA`

### Prioridade

- `NORMAL`

---

## 1. Vínculo por empresa

### Exemplo

```json
{
  "id": "uuid-notificacao",
  "tipo": "SISTEMA",
  "status": "NAO_LIDA",
  "prioridade": "NORMAL",
  "titulo": "Novo acesso liberado",
  "mensagem": "Você agora pode operar a empresa Consultoria RH Plus e as vagas vinculadas a ela.",
  "linkAcao": "/dashboard/empresas",
  "criadoEm": "2026-04-01T18:10:00.000Z",
  "dados": {
    "evento": "RECRUTADOR_VINCULO_CRIADO",
    "tipoVinculo": "EMPRESA",
    "empresaId": "uuid-empresa",
    "empresaNome": "Consultoria RH Plus",
    "empresaCodigo": "EMP-001",
    "atorId": "uuid-admin",
    "atorNome": "Maria Souza",
    "atorRole": "ADMIN",
    "origem": "PAINEL_ADMIN"
  }
}
```

---

## 2. Vínculo por vaga

### Exemplo

```json
{
  "id": "uuid-notificacao",
  "tipo": "SISTEMA",
  "status": "NAO_LIDA",
  "prioridade": "NORMAL",
  "titulo": "Novo acesso liberado",
  "mensagem": "Você agora pode operar a vaga Estagiário de Recursos Humanos da empresa Consultoria RH Plus.",
  "linkAcao": "/dashboard/empresas/vagas/uuid-vaga",
  "criadoEm": "2026-04-01T18:15:00.000Z",
  "dados": {
    "evento": "RECRUTADOR_VINCULO_CRIADO",
    "tipoVinculo": "VAGA",
    "empresaId": "uuid-empresa",
    "empresaNome": "Consultoria RH Plus",
    "empresaCodigo": "EMP-001",
    "vagaId": "uuid-vaga",
    "vagaTitulo": "Estagiário de Recursos Humanos",
    "vagaCodigo": "V51760",
    "atorId": "uuid-moderador",
    "atorNome": "Maria Souza",
    "atorRole": "MODERADOR",
    "origem": "PAINEL_ADMIN"
  }
}
```

---

## Semântica de `dados`

Campos relevantes:

- `evento`
- `tipoVinculo`
- `empresaId`
- `empresaNome`
- `empresaCodigo`
- `vagaId`
- `vagaTitulo`
- `vagaCodigo`
- `atorId`
- `atorNome`
- `atorRole`
- `origem`

### Regra

- vínculo por `EMPRESA`
  - não envia `vagaId`, `vagaTitulo`, `vagaCodigo`
- vínculo por `VAGA`
  - envia também os dados da vaga

---

## Caso especial: criação por empresa com limpeza de redundância

Quando um vínculo por empresa é criado e o backend remove vínculos por vaga redundantes da mesma empresa:

- o recrutador recebe apenas uma notificação de acesso liberado por empresa

Motivo:

- a mudança relevante é o ganho de acesso mais amplo
- a limpeza de redundância não deve gerar ruído no sino

---

## Impacto no frontend

O frontend já está pronto para isso.

Basta continuar consumindo:

- `GET /api/v1/notificacoes`
- `GET /api/v1/notificacoes/contador`

A notificação entra automaticamente:

- no sino
- na aba `Sistema`
- no contador de não lidas

---

## Checklist frontend

- [ ] Não criar tipo novo de notificação no frontend
- [ ] Exibir a notificação na aba `Sistema`
- [ ] Usar `titulo`, `mensagem` e `linkAcao` normalmente
- [ ] Tratar `dados.tipoVinculo = EMPRESA`
- [ ] Tratar `dados.tipoVinculo = VAGA`
- [ ] Atualizar contador de não lidas após criação do vínculo
