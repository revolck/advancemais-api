# Frontend — Entrevistas no Detalhe do Candidato para `RECRUTADOR`

## Objetivo

Permitir que a tela:

- `/dashboard/empresas/candidatos/:id`

mostre, para `RECRUTADOR`, a aba:

- `Entrevistas`

com apenas as entrevistas visíveis no escopo atual do recrutador.

---

## Rotas

### Listagem de entrevistas do candidato

`GET /api/v1/recrutador/candidatos/:candidatoId/entrevistas`

### Detalhe da entrevista

`GET /api/v1/recrutador/entrevistas/:entrevistaId`

### Criação no detalhe do candidato

Para o fluxo de `Marcar entrevista` nessa mesma tela, consumir:

- `FRONTEND_DASHBOARD_RECRUTADOR_CANDIDATOS_ENTREVISTAS_CRIAR.md`

---

## Regra de escopo

### Vínculo por empresa

- o recrutador vê entrevistas das candidaturas visíveis nas vagas operáveis da empresa

### Vínculo por vaga

- o recrutador vê apenas entrevistas ligadas à vaga vinculada

### Regra fixa

- o recrutador nunca recebe entrevistas fora do próprio escopo
- se o candidato tiver entrevistas fora do escopo, elas não aparecem

---

## 1. Listagem de entrevistas do candidato

### Query

- `page` opcional
- `pageSize` opcional
- `sortBy` opcional
- `sortDir` opcional
- `statusEntrevista` opcional, csv
- `modalidades` opcional, csv
- `dataInicio` opcional, ISO datetime
- `dataFim` opcional, ISO datetime

### Valores aceitos

- `sortBy`
  - `agendadaPara`
  - `criadoEm`
  - `statusEntrevista`
  - `vagaTitulo`
  - `empresaNome`
- `sortDir`
  - `asc`
  - `desc`
- `statusEntrevista`
  - `AGENDADA`
  - `CANCELADA`
- `modalidades`
  - `ONLINE`
  - `PRESENCIAL`

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
        "agenda": {
          "eventoInternoId": "uuid-entrevista",
          "criadoNoSistema": true,
          "provider": "GOOGLE_MEET",
          "organizerSource": "USER_OAUTH"
        },
        "vaga": {
          "id": "uuid-vaga",
          "titulo": "Desenvolvedor Full Stack Pleno",
          "codigo": "V51386",
          "status": "PUBLICADO"
        },
        "empresa": {
          "id": "uuid-empresa",
          "nomeExibicao": "Tech Innovations LTDA",
          "anonima": false,
          "labelExibicao": "Tech Innovations LTDA"
        },
        "recrutador": {
          "id": "uuid-recrutador",
          "nome": "Carlos Recrutador",
          "email": "carlos@empresa.com",
          "avatarUrl": null
        }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

### Regras

- `pageSize` default: `10`
- só devolver entrevistas das candidaturas visíveis no escopo do recrutador
- se o candidato estiver no escopo mas não tiver entrevistas visíveis:
  - retorna `200`
  - `items: []`

---

## 2. Detalhe da entrevista

### Rota

`GET /api/v1/recrutador/entrevistas/:entrevistaId`

### Regra

- a entrevista precisa pertencer ao escopo atual do recrutador
- entrevista fora do escopo retorna `403 FORBIDDEN`

Observação:

- o backend já normaliza o erro de escopo para `FORBIDDEN`

---

## Tratamento de erros

### Listagem

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 CANDIDATO_NOT_FOUND`
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

1. detectar `role = RECRUTADOR`
2. abrir `/dashboard/empresas/candidatos/:id`
3. carregar `GET /api/v1/recrutador/candidatos/:candidatoId`
4. carregar a aba `Entrevistas` com:
   - `GET /api/v1/recrutador/candidatos/:candidatoId/entrevistas`
5. ao clicar em visualizar:
   - usar `GET /api/v1/recrutador/entrevistas/:entrevistaId`

---

## Checklist frontend

- [ ] detectar `RECRUTADOR` no usuário logado
- [ ] usar `GET /api/v1/recrutador/candidatos/:candidatoId/entrevistas` na aba `Entrevistas`
- [ ] usar `GET /api/v1/recrutador/entrevistas/:entrevistaId` no detalhe
- [ ] manter `pageSize` padrão de `10`
- [ ] tratar `403 FORBIDDEN`
- [ ] tratar `404 CANDIDATO_NOT_FOUND`
- [ ] tratar `404 ENTREVISTA_NOT_FOUND`
- [ ] não exibir entrevistas fora do escopo do recrutador
