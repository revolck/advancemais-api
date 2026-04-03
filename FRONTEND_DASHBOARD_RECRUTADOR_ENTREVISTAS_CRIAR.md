# Frontend — Criar Entrevista em `/dashboard/empresas/entrevistas` para `RECRUTADOR`

## Objetivo

Documentar o fluxo de `Marcar entrevista` na tela:

- `/dashboard/empresas/entrevistas`

quando o usuário logado tiver:

- `role = RECRUTADOR`

Nessa condição, o frontend deve consumir:

- `GET /api/v1/recrutador/entrevistas/overview`
- `GET /api/v1/recrutador/entrevistas/opcoes/empresas`
- `GET /api/v1/recrutador/entrevistas/opcoes/vagas?empresaUsuarioId=...`
- `GET /api/v1/recrutador/entrevistas/opcoes/candidatos?vagaId=...`
- `POST /api/v1/recrutador/entrevistas`
- `GET /api/v1/recrutador/entrevistas/:entrevistaId`

---

## Regra de compatibilidade

### Fluxo administrativo mantido

Para:

- `ADMIN`
- `MODERADOR`
- `EMPRESA`

continuar usando o contrato atual:

- `GET /api/v1/entrevistas/overview`
- `GET /api/v1/entrevistas/opcoes/empresas`
- `GET /api/v1/entrevistas/opcoes/vagas`
- `GET /api/v1/entrevistas/opcoes/candidatos`
- `POST /api/v1/entrevistas`

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

- o recrutador vê apenas empresas do próprio escopo
- ao selecionar a empresa, vê apenas vagas operáveis daquela empresa
- ao selecionar a vaga, vê apenas candidatos elegíveis daquela vaga

### Vínculo por vaga

- o recrutador vê apenas a empresa dona da vaga vinculada
- vê apenas a vaga vinculada
- vê apenas candidatos elegíveis daquela vaga

### Regra fixa

- itens fora do vínculo não aparecem nos selects
- payload manual fora do vínculo continua bloqueado no backend
- candidatura com entrevista ativa pode aparecer com `entrevistaAtiva = true` para UI bloquear

---

## 1. Overview do recrutador

### Rota

`GET /api/v1/recrutador/entrevistas/overview`

### Regra

- `capabilities.canCreate = true` quando existir ao menos uma opção elegível no escopo
- `capabilities.canCreateOnline = true` quando existir opção elegível e Google conectado sem expiração
- `capabilities.canCreatePresencial = true` quando existir opção elegível para presencial

### Exemplo

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
      "canCreate": true,
      "canCreateOnline": false,
      "canCreatePresencial": true,
      "requiresGoogleForOnline": true,
      "google": {
        "connected": false,
        "expired": false,
        "calendarId": null,
        "expiraEm": null,
        "connectEndpoint": "/api/v1/auth/google/connect",
        "disconnectEndpoint": "/api/v1/auth/google/disconnect",
        "statusEndpoint": "/api/v1/auth/google/status"
      }
    }
  }
}
```

---

## 2. Empresas elegíveis

### Rota

`GET /api/v1/recrutador/entrevistas/opcoes/empresas`

### Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-empresa",
        "nomeExibicao": "Tech Innovations LTDA",
        "codigo": "EMP-009",
        "cnpj": "12345678000190",
        "email": "contato@empresa.com",
        "logoUrl": null,
        "totalVagasElegiveis": 2,
        "enderecoPadraoEntrevista": {
          "cep": "01310-100",
          "logradouro": "Avenida Paulista",
          "numero": "1000",
          "complemento": "Sala 10",
          "bairro": "Bela Vista",
          "cidade": "São Paulo",
          "estado": "SP",
          "pontoReferencia": null
        }
      }
    ]
  }
}
```

### Regras

- só devolve empresas com pelo menos uma vaga elegível no escopo do recrutador
- sem empresas elegíveis:
  - `200`
  - `items: []`

---

## 3. Vagas elegíveis por empresa

### Rota

`GET /api/v1/recrutador/entrevistas/opcoes/vagas?empresaUsuarioId=uuid-empresa`

### Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-vaga",
        "codigo": "V51386",
        "titulo": "Desenvolvedor Full Stack Pleno",
        "status": "PUBLICADO",
        "statusLabel": "Publicado",
        "empresaUsuarioId": "uuid-empresa",
        "empresaAnonima": false,
        "anonimatoOrigem": "VAGA",
        "anonimatoBloqueado": true,
        "candidatosElegiveis": 3
      }
    ]
  }
}
```

### Regras

- valida se `empresaUsuarioId` está no escopo do recrutador
- não devolve vagas fora do vínculo
- não devolve vagas sem candidatos elegíveis
- `empresaAnonima`, `anonimatoOrigem` e `anonimatoBloqueado`
  - refletem a regra final de anonimato da vaga

---

## 4. Candidatos elegíveis por vaga

### Rota

`GET /api/v1/recrutador/entrevistas/opcoes/candidatos?vagaId=uuid-vaga`

### Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "candidaturaId": "uuid-candidatura",
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
        "statusCandidatura": "EM_PROCESSO",
        "statusCandidaturaLabel": "Em processo",
        "ultimaAtualizacaoEm": "2026-04-01T18:00:00.000Z",
        "entrevistaAtiva": false,
        "entrevistaAtivaId": null
      }
    ]
  }
}
```

### Regras

- valida se `vagaId` está no escopo do recrutador
- devolve apenas candidatos elegíveis daquela vaga
- `entrevistaAtiva = true` pode ser usado pela UI para bloquear seleção

---

## 5. Criar entrevista

### Rota

`POST /api/v1/recrutador/entrevistas`

### Body online

```json
{
  "empresaUsuarioId": "uuid-empresa",
  "vagaId": "uuid-vaga",
  "candidaturaId": "uuid-candidatura",
  "empresaAnonima": false,
  "modalidade": "ONLINE",
  "dataInicio": "2026-04-10T14:00:00.000Z",
  "dataFim": "2026-04-10T15:00:00.000Z",
  "descricao": "Entrevista técnica online."
}
```

### Body presencial

```json
{
  "empresaUsuarioId": "uuid-empresa",
  "vagaId": "uuid-vaga",
  "candidaturaId": "uuid-candidatura",
  "empresaAnonima": false,
  "modalidade": "PRESENCIAL",
  "dataInicio": "2026-04-10T14:00:00.000Z",
  "dataFim": "2026-04-10T15:00:00.000Z",
  "descricao": "Entrevista presencial.",
  "enderecoPresencial": {
    "cep": "01310-100",
    "logradouro": "Avenida Paulista",
    "numero": "1000",
    "complemento": "Sala 10",
    "bairro": "Bela Vista",
    "cidade": "São Paulo",
    "estado": "SP",
    "pontoReferencia": "Próximo ao metrô"
  }
}
```

### Validações

- `empresaUsuarioId` precisa corresponder à empresa da vaga
- `vagaId` precisa corresponder à vaga da candidatura
- `candidaturaId` precisa pertencer à vaga informada
- o recrutador precisa ter acesso real à empresa e à vaga
- se já existir entrevista ativa:
  - `409 INTERVIEW_ALREADY_EXISTS`
- `ONLINE`
  - exige Google conectado e válido
- `PRESENCIAL`
  - exige `enderecoPresencial`
- `empresaAnonima`
  - deve respeitar a regra final da vaga

### Resposta de sucesso

```json
{
  "success": true,
  "data": {
    "id": "uuid-entrevista",
    "candidaturaId": "uuid-candidatura",
    "statusEntrevista": "AGENDADA",
    "statusEntrevistaLabel": "Agendada",
    "modalidade": "ONLINE",
    "modalidadeLabel": "Online",
    "dataInicio": "2026-04-10T14:00:00.000Z",
    "dataFim": "2026-04-10T15:00:00.000Z",
    "agendadaPara": "2026-04-10T14:00:00.000Z",
    "agendadaParaFormatada": "10/04/2026, 11:00",
    "descricao": "Entrevista técnica online.",
    "meetUrl": "https://meet.google.com/abc-defg-hij",
    "local": null,
    "enderecoPresencial": null,
    "vaga": {
      "id": "uuid-vaga",
      "codigo": "V51386",
      "titulo": "Desenvolvedor Full Stack Pleno"
    },
    "empresa": {
      "id": "uuid-empresa",
      "nomeExibicao": "Tech Innovations LTDA",
      "anonima": false,
      "labelExibicao": "Tech Innovations LTDA"
    },
    "candidato": {
      "id": "uuid-candidato",
      "codigo": "MAT0004",
      "nome": "Ana Costa"
    },
    "recrutador": {
      "id": "uuid-recrutador",
      "nome": "Carlos Recrutador"
    },
    "agenda": {
      "eventoInternoId": "uuid-entrevista",
      "criadoNoSistema": true,
      "provider": "GOOGLE_MEET",
      "organizerSource": "USER_OAUTH"
    }
  }
}
```

---

## Erros esperados

### Overview

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `500 RECRUITER_SCOPE_ERROR`

### Opções

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 EMPRESA_NOT_FOUND`
- `404 VAGA_NOT_FOUND`
- `500 RECRUITER_INTERVIEW_OPTIONS_ERROR`

### Criação

- `400 VALIDATION_ERROR`
- `400 INTERVIEW_GOOGLE_NOT_CONNECTED`
- `400 INTERVIEW_INVALID_PAYLOAD`
- `403 FORBIDDEN`
- `404 CANDIDATURA_NOT_FOUND`
- `409 INTERVIEW_ALREADY_EXISTS`
- `409 RECRUITER_SCOPE_CONFLICT`
- `500 RECRUITER_INTERVIEW_CREATE_ERROR`

---

## Fluxo recomendado no frontend

1. manter a mesma rota:
   - `/dashboard/empresas/entrevistas`
2. manter `ADMIN`, `MODERADOR` e `EMPRESA` como já estão
3. no branch de `RECRUTADOR`, usar:
   - `GET /api/v1/recrutador/entrevistas/overview`
4. usar `capabilities.canCreate` para exibir o botão `Marcar entrevista`
5. ao abrir o modal, buscar:
   - `GET /api/v1/recrutador/entrevistas/opcoes/empresas`
6. ao selecionar empresa, buscar:
   - `GET /api/v1/recrutador/entrevistas/opcoes/vagas?empresaUsuarioId=...`
7. ao selecionar vaga, buscar:
   - `GET /api/v1/recrutador/entrevistas/opcoes/candidatos?vagaId=...`
8. ao confirmar:
   - `POST /api/v1/recrutador/entrevistas`
9. após sucesso, invalidar:
   - `GET /api/v1/recrutador/entrevistas/overview`

---

## Checklist frontend

- [ ] detectar `RECRUTADOR` no usuário logado
- [ ] usar `capabilities.canCreate` do overview para exibir o botão
- [ ] consumir `GET /api/v1/recrutador/entrevistas/opcoes/empresas`
- [ ] consumir `GET /api/v1/recrutador/entrevistas/opcoes/vagas`
- [ ] consumir `GET /api/v1/recrutador/entrevistas/opcoes/candidatos`
- [ ] consumir `POST /api/v1/recrutador/entrevistas`
- [ ] ocultar itens com `entrevistaAtiva = true` ou bloquear seleção
- [ ] tratar `403 FORBIDDEN`
- [ ] tratar `404 EMPRESA_NOT_FOUND`
- [ ] tratar `404 VAGA_NOT_FOUND`
- [ ] tratar `404 CANDIDATURA_NOT_FOUND`
- [ ] tratar `409 INTERVIEW_ALREADY_EXISTS`
- [ ] tratar `409 RECRUITER_SCOPE_CONFLICT`
