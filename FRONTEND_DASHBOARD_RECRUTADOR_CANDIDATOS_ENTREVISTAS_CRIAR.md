# Frontend — Criar Entrevista no Detalhe do Candidato para `RECRUTADOR`

## Objetivo

Documentar o fluxo de criação de entrevista em:

- `/dashboard/empresas/candidatos/:id`

quando o usuário logado tiver:

- `role = RECRUTADOR`

Nessa condição, o frontend deve consumir:

- `GET /api/v1/recrutador/candidatos/:candidatoId/entrevistas/opcoes`
- `POST /api/v1/recrutador/candidatos/:candidatoId/entrevistas`

---

## Regra de escopo

### Vínculo por empresa

- o recrutador pode criar entrevista apenas para candidaturas do candidato em vagas operáveis da empresa
- `tipoAcesso = EMPRESA`

### Vínculo por vaga

- o recrutador pode criar entrevista apenas na vaga vinculada
- `tipoAcesso = VAGA`

### Regra fixa

- o recrutador nunca pode criar entrevista fora do próprio escopo
- se a candidatura já tiver entrevista ativa:
  - a API sinaliza `entrevistaAtiva = true`
  - a criação continua bloqueada no backend

---

## Rotas

### Opções no detalhe do candidato

`GET /api/v1/recrutador/candidatos/:candidatoId/entrevistas/opcoes`

### Criação direta no detalhe do candidato

`POST /api/v1/recrutador/candidatos/:candidatoId/entrevistas`

---

## 1. Opções de criação

### Resposta

```json
{
  "success": true,
  "data": {
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
    },
    "defaults": {
      "empresaUsuarioId": "uuid-empresa",
      "vagaId": "uuid-vaga",
      "candidaturaId": "uuid-candidatura"
    },
    "items": [
      {
        "candidaturaId": "uuid-candidatura",
        "empresa": {
          "id": "uuid-empresa",
          "nomeExibicao": "Tech Innovations LTDA",
          "anonima": false,
          "labelExibicao": "Tech Innovations LTDA"
        },
        "vaga": {
          "id": "uuid-vaga",
          "codigo": "V51386",
          "titulo": "Desenvolvedor Full Stack Pleno",
          "status": "PUBLICADO",
          "statusLabel": "Publicado"
        },
        "candidato": {
          "id": "uuid-candidato",
          "codigo": "MAT0004",
          "nome": "Ana Costa"
        },
        "statusCandidatura": "EM_PROCESSO",
        "statusCandidaturaLabel": "Em processo",
        "tipoAcesso": "VAGA",
        "empresaVinculadaDiretamente": false,
        "entrevistaAtiva": false,
        "entrevistaAtivaId": null,
        "empresaAnonima": false,
        "anonimatoBloqueado": true,
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

### Semântica

- `items`
  - contém apenas candidaturas do candidato dentro do escopo atual do recrutador
- `tipoAcesso`
  - `EMPRESA` quando a elegibilidade veio de vínculo amplo por empresa
  - `VAGA` quando a elegibilidade veio apenas de vínculo por vaga
- `empresaVinculadaDiretamente`
  - `true` quando o recrutador possui vínculo amplo com a empresa
- `defaults`
  - calculado apenas com as opções realmente criáveis
  - quando houver apenas `1` empresa, `1` vaga ou `1` candidatura criável, a API já preenche esses ids
- `canCreate`
  - `true` quando existe ao menos `1` item com `entrevistaAtiva = false`

### Estado vazio válido

```json
{
  "success": true,
  "data": {
    "canCreate": false,
    "canCreateOnline": false,
    "canCreatePresencial": true,
    "requiresGoogleForOnline": true,
    "defaults": {
      "empresaUsuarioId": null,
      "vagaId": null,
      "candidaturaId": null
    },
    "items": []
  }
}
```

---

## 2. Criação direta

### Body online

```json
{
  "candidaturaId": "uuid-candidatura",
  "empresaUsuarioId": "uuid-empresa",
  "vagaId": "uuid-vaga",
  "modalidade": "ONLINE",
  "dataInicio": "2026-04-10T14:00:00.000Z",
  "dataFim": "2026-04-10T15:00:00.000Z",
  "descricao": "Entrevista técnica online.",
  "empresaAnonima": false
}
```

### Body presencial

```json
{
  "candidaturaId": "uuid-candidatura",
  "empresaUsuarioId": "uuid-empresa",
  "vagaId": "uuid-vaga",
  "modalidade": "PRESENCIAL",
  "dataInicio": "2026-04-10T14:00:00.000Z",
  "dataFim": "2026-04-10T15:00:00.000Z",
  "descricao": "Entrevista presencial.",
  "empresaAnonima": false,
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

### Regras

- `candidatoId` da URL precisa corresponder ao candidato da `candidaturaId`
- `vagaId` precisa corresponder à vaga da `candidaturaId`
- `empresaUsuarioId` precisa corresponder à empresa da vaga
- o recrutador só cria dentro do próprio escopo
- `ONLINE`
  - usa Google do usuário logado
- `PRESENCIAL`
  - registra evento interno na agenda
- `empresaAnonima`
  - precisa respeitar o anonimato efetivo da vaga

### Resposta de sucesso

A resposta reaproveita o contrato do módulo de entrevistas:

```json
{
  "success": true,
  "data": {
    "id": "uuid-entrevista",
    "candidaturaId": "uuid-candidatura",
    "statusEntrevista": "AGENDADA",
    "statusEntrevistaLabel": "Agendada",
    "modalidade": "PRESENCIAL",
    "modalidadeLabel": "Presencial",
    "dataInicio": "2026-04-10T14:00:00.000Z",
    "dataFim": "2026-04-10T15:00:00.000Z",
    "descricao": "Entrevista presencial.",
    "meetUrl": null,
    "local": "Avenida Paulista, 1000 | Bela Vista - São Paulo - SP | Compl.: Sala 10",
    "enderecoPresencial": {
      "cep": "01310-100",
      "logradouro": "Avenida Paulista",
      "numero": "1000",
      "complemento": "Sala 10",
      "bairro": "Bela Vista",
      "cidade": "São Paulo",
      "estado": "SP",
      "pontoReferencia": "Próximo ao metrô"
    },
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
      "provider": "INTERNAL_ONLY",
      "organizerSource": "SYSTEM"
    }
  }
}
```

---

## Tratamento de erros

### Opções

- `403 FORBIDDEN`
- `404 CANDIDATO_NOT_FOUND`
- `500 RECRUITER_INTERVIEW_OPTIONS_ERROR`

### Criação

- `400 VALIDATION_ERROR`
- `400 INTERVIEW_GOOGLE_NOT_CONNECTED`
- `400 INTERVIEW_INVALID_PAYLOAD`
- `403 FORBIDDEN`
- `404 CANDIDATO_NOT_FOUND`
- `404 CANDIDATURA_NOT_FOUND`
- `409 INTERVIEW_ALREADY_EXISTS`
- `409 RECRUITER_SCOPE_CONFLICT`
- `500 RECRUITER_INTERVIEW_CREATE_ERROR`

Exemplo fora do escopo:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso para criar entrevista nesta candidatura."
}
```

---

## Fluxo recomendado no frontend

1. detectar `role = RECRUTADOR`
2. abrir `/dashboard/empresas/candidatos/:id`
3. mostrar o botão `Marcar entrevista`
4. ao abrir o modal, carregar:
   - `GET /api/v1/recrutador/candidatos/:candidatoId/entrevistas/opcoes`
5. derivar:
   - select de empresa
   - select de vaga
   - candidatura selecionada
   - estado de anonimato
   - endereço padrão
6. ao confirmar:
   - `POST /api/v1/recrutador/candidatos/:candidatoId/entrevistas`
7. após sucesso:
   - invalidar `GET /api/v1/recrutador/candidatos/:candidatoId/entrevistas`
   - invalidar `GET /api/v1/recrutador/candidatos/:candidatoId`

---

## Checklist frontend

- [ ] detectar `RECRUTADOR` no usuário logado
- [ ] usar `GET /api/v1/recrutador/candidatos/:candidatoId/entrevistas/opcoes`
- [ ] usar `POST /api/v1/recrutador/candidatos/:candidatoId/entrevistas`
- [ ] usar `defaults` apenas como pré-preenchimento inicial
- [ ] bloquear seleção com `entrevistaAtiva = true`
- [ ] respeitar `tipoAcesso` e `empresaVinculadaDiretamente` apenas como metadados de UI
- [ ] tratar `403 FORBIDDEN`
- [ ] tratar `404 CANDIDATO_NOT_FOUND`
- [ ] tratar `404 CANDIDATURA_NOT_FOUND`
- [ ] tratar `409 INTERVIEW_ALREADY_EXISTS`
- [ ] tratar `409 RECRUITER_SCOPE_CONFLICT`
