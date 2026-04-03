# Frontend — Editar Status da Candidatura na Aba `Candidatos` da Vaga para `RECRUTADOR`

## Objetivo

Documentar a ação:

- `Editar status`

na aba:

- `Candidatos`

da tela:

- `/dashboard/empresas/vagas/:id`

quando o usuário logado tiver:

- `role = RECRUTADOR`

Nessa condição, o frontend deve consumir:

- `GET /api/v1/recrutador/vagas/:vagaId/candidatos`
- `PATCH /api/v1/recrutador/vagas/:vagaId/candidaturas/:candidaturaId/status`

Para listar os status disponíveis, o frontend pode continuar usando:

- `GET /api/v1/candidatos/candidaturas/status-disponiveis`

Essa rota já aceita `RECRUTADOR`.

---

## Efeito colateral

Quando a alteração de status for concluída com sucesso, o backend também cria uma notificação para o candidato na rota:

- `GET /api/v1/notificacoes`

Semântica:

- a notificação é criada apenas quando o status muda de fato
- o destinatário é o candidato da candidatura alterada
- a notificação entra com `tipo = SISTEMA`
- o payload em `dados` inclui:
  - `evento = CANDIDATURA_STATUS_ATUALIZADO`
  - `candidaturaId`
  - `vagaId`
  - `empresaUsuarioId`
  - `vagaTitulo`
  - `statusIdAnterior`
  - `statusAnterior`
  - `statusAnteriorLabel`
  - `statusIdNovo`
  - `statusNovo`
  - `statusNovoLabel`
  - `atualizadoEm`

---

## Regra de escopo

### Vínculo por empresa

- o recrutador pode alterar apenas candidaturas pertencentes às vagas operáveis da empresa
- no detalhe da vaga, pode alterar apenas candidaturas da vaga da URL

### Vínculo por vaga

- o recrutador pode alterar apenas candidaturas da vaga vinculada
- nenhuma candidatura de outra vaga da mesma empresa pode ser alterada

### Regra fixa

- candidatura fora do escopo retorna `403 FORBIDDEN`
- vaga fora do escopo retorna `403 FORBIDDEN`
- se `candidaturaId` não pertencer à `vagaId` da URL:
  - a API retorna `409 RECRUITER_SCOPE_CONFLICT`

---

## Rota

### Atualizar status da candidatura no detalhe da vaga

`PATCH /api/v1/recrutador/vagas/:vagaId/candidaturas/:candidaturaId/status`

---

## Body

```json
{
  "statusId": "uuid-status"
}
```

### Semântica

- `statusId`
  - UUID do status de candidatura que deve ser aplicado

---

## Resposta de sucesso

```json
{
  "success": true,
  "data": {
    "candidaturaId": "uuid-candidatura",
    "vagaId": "uuid-vaga",
    "statusId": "uuid-status",
    "status": "EM_PROCESSO",
    "statusLabel": "Em processo",
    "atualizadoEm": "2026-04-02T18:10:00.000Z"
  }
}
```

### Semântica

- `candidaturaId`
  - candidatura alterada
- `vagaId`
  - vaga validada no contexto da URL
- `statusId`
  - UUID persistido do status aplicado
- `status`
  - código funcional do status
- `statusLabel`
  - label pronta para a UI
- `atualizadoEm`
  - usar para atualizar a linha da tabela com segurança

---

## Tratamento de erros

### Atualização

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 VAGA_NOT_FOUND`
- `404 CANDIDATURA_NOT_FOUND`
- `404 STATUS_NOT_FOUND`
- `409 RECRUITER_SCOPE_CONFLICT`
- `500 RECRUITER_CANDIDATURA_STATUS_ERROR`

### Exemplo fora do escopo

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso para alterar o status desta candidatura."
}
```

### Exemplo de conflito entre URL e candidatura

```json
{
  "success": false,
  "code": "RECRUITER_SCOPE_CONFLICT",
  "message": "A candidatura informada não pertence à vaga selecionada."
}
```

---

## Fluxo recomendado no frontend

1. detectar `role = RECRUTADOR`
2. abrir `/dashboard/empresas/vagas/:vagaId`
3. abrir a aba `Candidatos`
4. listar candidatos com:
   - `GET /api/v1/recrutador/vagas/:vagaId/candidatos`
5. ao clicar em `Editar status`:
   - abrir o mesmo modal visual já usado por `ADMIN` e `MODERADOR`
6. carregar os status disponíveis com:
   - `GET /api/v1/candidatos/candidaturas/status-disponiveis`
7. ao salvar:
   - `PATCH /api/v1/recrutador/vagas/:vagaId/candidaturas/:candidaturaId/status`
8. após sucesso:
   - invalidar `GET /api/v1/recrutador/vagas/:vagaId/candidatos`
   - ou atualizar a linha localmente com `statusId`, `status`, `statusLabel` e `atualizadoEm`

---

## Checklist frontend

- [ ] detectar `RECRUTADOR` no usuário logado
- [ ] exibir a ação `Editar status` na aba `Candidatos` da vaga
- [ ] consumir `GET /api/v1/candidatos/candidaturas/status-disponiveis`
- [ ] consumir `PATCH /api/v1/recrutador/vagas/:vagaId/candidaturas/:candidaturaId/status`
- [ ] invalidar a query de candidatos da vaga após sucesso
- [ ] tratar `400 VALIDATION_ERROR`
- [ ] tratar `403 FORBIDDEN`
- [ ] tratar `404 VAGA_NOT_FOUND`
- [ ] tratar `404 CANDIDATURA_NOT_FOUND`
- [ ] tratar `404 STATUS_NOT_FOUND`
- [ ] tratar `409 RECRUITER_SCOPE_CONFLICT`
