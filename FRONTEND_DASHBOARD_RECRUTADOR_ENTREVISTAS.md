# Frontend — Acesso do `RECRUTADOR` à Rota `/dashboard/empresas/entrevistas`

## Objetivo

Documentar o branch de API da tela:

- `/dashboard/empresas/entrevistas`

quando o usuário logado tiver:

- `role = RECRUTADOR`

Nessa condição, o frontend deve consumir:

- `GET /api/v1/recrutador/entrevistas/overview`
- `GET /api/v1/recrutador/entrevistas/:entrevistaId`

Para o fluxo de criação nessa mesma rota, ver:

- `FRONTEND_DASHBOARD_RECRUTADOR_ENTREVISTAS_CRIAR.md`

---

## Regra de compatibilidade

### Perfis já estáveis

Para:

- `ADMIN`
- `MODERADOR`
- `EMPRESA`

continuar usando exatamente o fluxo atual:

- `GET /api/v1/entrevistas/overview`
- `GET /api/v1/entrevistas/:entrevistaId`

### Branch exclusivo do recrutador

Para:

- `RECRUTADOR`

manter a mesma rota de página:

- `/dashboard/empresas/entrevistas`

mas trocar apenas o namespace da API para:

- `/api/v1/recrutador/...`

---

## Regra de escopo

### Vínculo por empresa

- o recrutador vê entrevistas das vagas operáveis daquela empresa

### Vínculo por vaga

- o recrutador vê apenas entrevistas da vaga vinculada

### Regra fixa

- entrevistas fora do vínculo não aparecem
- entrevistas fora do vínculo não influenciam:
  - `items`
  - `summary`
  - `filtrosDisponiveis`
  - `pagination`

---

## Rotas

### Overview escopado

`GET /api/v1/recrutador/entrevistas/overview`

### Detalhe escopado

`GET /api/v1/recrutador/entrevistas/:entrevistaId`

---

## 1. Overview do recrutador

### Query

- `page` opcional
- `pageSize` opcional
- `search` opcional
- `empresaUsuarioId` opcional
- `vagaId` opcional
- `recrutadorId` opcional
- `statusEntrevista` opcional, csv
- `modalidades` opcional, csv
- `dataInicio` opcional, ISO datetime
- `dataFim` opcional, ISO datetime
- `sortBy` opcional
- `sortDir` opcional

### Valores aceitos

- `sortBy`
  - `agendadaPara`
  - `criadoEm`
  - `statusEntrevista`
  - `vagaTitulo`
  - `empresaNome`
  - `candidatoNome`
- `sortDir`
  - `asc`
  - `desc`
- `statusEntrevista`
  - `AGENDADA`
  - `CONFIRMADA`
  - `REALIZADA`
  - `CANCELADA`
  - `REAGENDADA`
  - `NAO_COMPARECEU`
- `modalidades`
  - `ONLINE`
  - `PRESENCIAL`

### Regras

- `pageSize` default: `10`
- `capabilities.canCreate`
  - `true` quando existir ao menos uma combinação elegível de empresa, vaga e candidato no escopo
- `capabilities.canCreateOnline`
  - `true` apenas quando houver opção elegível e Google conectado sem expiração
- `capabilities.canCreatePresencial`
  - `true` quando houver opção elegível para criação presencial

### Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-entrevista",
        "candidaturaId": "uuid-candidatura",
        "statusEntrevista": "AGENDADA",
        "statusEntrevistaLabel": "Agendada",
        "modalidade": "ONLINE",
        "modalidadeLabel": "Online",
        "agendadaPara": "2026-04-10T14:00:00.000Z",
        "agendadaParaFormatada": "10/04/2026, 11:00",
        "dataInicio": "2026-04-10T14:00:00.000Z",
        "dataFim": "2026-04-10T15:00:00.000Z",
        "descricao": "Entrevista técnica online.",
        "meetUrl": "https://meet.google.com/abc-defg-hij",
        "local": null,
        "enderecoPresencial": null,
        "candidato": {
          "id": "uuid-candidato",
          "codigo": "MAT0004",
          "nome": "Ana Costa",
          "email": "ana@email.com",
          "cpf": "12345678901",
          "telefone": "82999999999",
          "avatarUrl": null,
          "cidade": "Maceió",
          "estado": "AL"
        },
        "vaga": {
          "id": "uuid-vaga",
          "codigo": "V51386",
          "titulo": "Desenvolvedor Full Stack Pleno",
          "status": "PUBLICADO"
        },
        "empresa": {
          "id": "uuid-empresa",
          "nomeExibicao": "Tech Innovations LTDA",
          "anonima": false,
          "labelExibicao": "Tech Innovations LTDA",
          "logoUrl": null
        },
        "recrutador": {
          "id": "uuid-recrutador",
          "nome": "Carlos Recrutador",
          "email": "carlos@empresa.com",
          "avatarUrl": null
        },
        "agenda": {
          "eventoInternoId": "uuid-entrevista",
          "criadoNoSistema": true,
          "provider": "GOOGLE_MEET",
          "organizerSource": "USER_OAUTH"
        },
        "criadoEm": "2026-04-01T18:00:00.000Z",
        "atualizadoEm": "2026-04-01T18:10:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 1,
      "totalPages": 1
    },
    "summary": {
      "totalEntrevistas": 1,
      "agendadas": 1,
      "confirmadas": 0,
      "realizadas": 0,
      "canceladas": 0,
      "naoCompareceram": 0
    },
    "filtrosDisponiveis": {
      "statusEntrevista": [{ "value": "AGENDADA", "label": "Agendada", "count": 1 }],
      "modalidades": [{ "value": "ONLINE", "label": "Online", "count": 1 }]
    },
    "capabilities": {
      "canCreate": false,
      "canCreateOnline": false,
      "canCreatePresencial": false,
      "requiresGoogleForOnline": true,
      "google": {
        "connected": true,
        "expired": false,
        "calendarId": "primary",
        "expiraEm": "2026-04-10T22:10:00.000Z",
        "connectEndpoint": "/api/v1/auth/google/connect",
        "disconnectEndpoint": "/api/v1/auth/google/disconnect",
        "statusEndpoint": "/api/v1/auth/google/status"
      }
    }
  }
}
```

### Estado vazio válido

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 0,
      "totalPages": 1
    },
    "summary": {
      "totalEntrevistas": 0,
      "agendadas": 0,
      "confirmadas": 0,
      "realizadas": 0,
      "canceladas": 0,
      "naoCompareceram": 0
    },
    "filtrosDisponiveis": {
      "statusEntrevista": [],
      "modalidades": []
    },
    "capabilities": {
      "canCreate": false,
      "canCreateOnline": false,
      "canCreatePresencial": false,
      "requiresGoogleForOnline": true
    }
  }
}
```

---

## 2. Detalhe da entrevista

### Rota

`GET /api/v1/recrutador/entrevistas/:entrevistaId`

### Regra

- a entrevista só abre se estiver no escopo atual do recrutador
- entrevista fora do escopo retorna `403 FORBIDDEN`

---

## Tratamento de erros

### Overview

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `500 RECRUITER_SCOPE_ERROR`

### Detalhe

- `403 FORBIDDEN`
- `404 ENTREVISTA_NOT_FOUND`
- `500 RECRUITER_SCOPE_ERROR`

Exemplo fora do escopo:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso a esta entrevista."
}
```

---

## Fluxo recomendado no frontend

1. manter a rota:
   - `/dashboard/empresas/entrevistas`
2. manter `ADMIN`, `MODERADOR` e `EMPRESA` como já estão
3. adicionar branch exclusivo para `RECRUTADOR`
4. nesse branch, consumir:
   - `GET /api/v1/recrutador/entrevistas/overview`
   - `GET /api/v1/recrutador/entrevistas/:entrevistaId`
5. manter o botão `Marcar entrevista` oculto enquanto `capabilities.canCreate = false`

---

## Checklist frontend

- [ ] detectar `RECRUTADOR` no usuário logado
- [ ] manter a mesma rota `/dashboard/empresas/entrevistas`
- [ ] trocar apenas o consumo para `/api/v1/recrutador/...`
- [ ] usar `GET /api/v1/recrutador/entrevistas/overview`
- [ ] usar `GET /api/v1/recrutador/entrevistas/:entrevistaId`
- [ ] tratar `summary` e `filtrosDisponiveis` como dados já escopados
- [ ] manter o botão `Marcar entrevista` oculto com `capabilities.canCreate = false`
- [ ] tratar `400 VALIDATION_ERROR`
- [ ] tratar `403 FORBIDDEN`
