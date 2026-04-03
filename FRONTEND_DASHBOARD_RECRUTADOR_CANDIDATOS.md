# Frontend — Candidatos no Escopo do Recrutador

## Objetivo

Documentar o consumo das telas:

- `/dashboard/empresas/candidatos`
- `/dashboard/empresas/candidatos/:id`

quando o usuário logado tiver:

- `role = RECRUTADOR`

Nessa condição, o frontend deve consumir:

- `GET /api/v1/recrutador/candidatos`
- `GET /api/v1/recrutador/candidatos/:candidatoId`

---

## Regra de escopo

### Vínculo por empresa

- o recrutador vê candidatos das vagas operáveis da empresa
- pode abrir o detalhe desses candidatos
- o detalhe devolve apenas candidaturas visíveis dentro do escopo

### Vínculo por vaga

- o recrutador vê apenas candidatos daquela vaga
- pode abrir apenas candidatos com candidatura naquela vaga
- o detalhe devolve apenas as candidaturas vinculadas ao escopo permitido

### Regra fixa

- o recrutador nunca recebe candidatos fora do próprio vínculo
- se o candidato possuir múltiplas candidaturas, a API devolve apenas as candidaturas visíveis

---

## Rotas

### Listagem

`GET /api/v1/recrutador/candidatos`

### Detalhe

`GET /api/v1/recrutador/candidatos/:candidatoId`

### Currículo visível da candidatura

`GET /api/v1/recrutador/candidatos/:candidatoId/curriculos/:curriculoId`

---

## 1. Listagem de candidatos

### Query

- `search` opcional
- `empresaUsuarioId` opcional
- `vagaId` opcional
- `criadoDe` opcional, ISO datetime
- `criadoAte` opcional, ISO datetime
- `page` opcional
- `pageSize` opcional

### Resposta

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-candidato",
      "nomeCompleto": "Pedro Oliveira",
      "cpf": "12345678901",
      "codUsuario": "MAT0002",
      "email": "pedro@email.com",
      "telefone": "82999999999",
      "avatarUrl": null,
      "cidade": "Maceió",
      "estado": "AL",
      "curriculos": 1,
      "criadoEm": "2026-04-01T15:10:00.000Z",
      "atualizadoEm": "2026-04-01T18:00:00.000Z",
      "candidaturasResumo": {
        "total": 2,
        "empresaIds": ["uuid-empresa"],
        "vagaIds": ["uuid-vaga-1", "uuid-vaga-2"]
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
```

### Semântica dos filtros

- `search`
  - nome
  - email
  - CPF
  - código interno
- `empresaUsuarioId`
  - limita às vagas da empresa dentro do escopo do recrutador
- `vagaId`
  - limita à vaga, desde que esteja no escopo do recrutador
- `criadoDe` e `criadoAte`
  - filtram `candidato.criadoEm`

### Regras

- `pageSize` default: `10`
- se o recrutador não possuir vagas no escopo:
  - retorna `200`
  - `data: []`
- a listagem não inclui candidatos fora do escopo

---

## 2. Detalhe de candidato

### Rota

`GET /api/v1/recrutador/candidatos/:candidatoId`

### Resposta

```json
{
  "success": true,
  "data": {
    "candidato": {
      "id": "uuid-candidato",
      "nomeCompleto": "Pedro Oliveira",
      "cpf": "12345678901",
      "codUsuario": "MAT0002",
      "email": "pedro@email.com",
      "telefone": "82999999999",
      "avatarUrl": null,
      "cidade": "Maceió",
      "estado": "AL"
    },
    "curriculosResumo": {
      "total": 1
    },
    "candidaturas": [
      {
        "id": "uuid-candidatura",
        "statusId": "uuid-status",
        "status": "Em processo",
        "vaga": {
          "id": "uuid-vaga",
          "titulo": "Desenvolvedor Full Stack Pleno",
          "codigo": "V51386",
          "status": "PUBLICADO"
        },
        "empresa": {
          "id": "uuid-empresa",
          "nomeExibicao": "Tech Innovations LTDA",
          "codigo": "EMP-009"
        },
        "curriculo": {
          "id": "uuid-curriculo",
          "titulo": "Currículo Desenvolvedor Full Stack",
          "principal": false,
          "ultimaAtualizacao": "2026-04-01T18:00:00.000Z"
        }
      }
    ],
    "escopo": {
      "totalCandidaturasVisiveis": 1,
      "tipoAcesso": "VAGA"
    }
  }
}
```

### Semântica

- `curriculosResumo.total`
  - quantidade de currículos do candidato
- `candidaturas`
  - apenas candidaturas visíveis dentro do escopo do recrutador
- `candidaturas[].curriculo`
  - currículo ligado à candidatura visível
  - pode ser `null` se a candidatura não tiver currículo vinculado
- `escopo.tipoAcesso`
  - `EMPRESA` quando ao menos uma candidatura visível vier de empresa com vínculo amplo
  - `VAGA` quando o acesso visível for apenas por vínculo de vaga

### Visualização segura do currículo

Para abrir modal ou drawer de currículo no detalhe do candidato, o frontend deve usar:

- `GET /api/v1/recrutador/candidatos/:candidatoId/curriculos/:curriculoId`

Regra:

- só retorna `200` quando o currículo estiver ligado a pelo menos uma candidatura visível daquele candidato no escopo atual do recrutador
- currículo fora do escopo retorna `403 FORBIDDEN`

---

## Tratamento de erros

### Listagem

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 EMPRESA_NOT_FOUND`
- `404 VAGA_NOT_FOUND`
- `500 RECRUITER_SCOPE_ERROR`

### Detalhe

- `403 FORBIDDEN`
- `404 CANDIDATO_NOT_FOUND`
- `500 RECRUITER_SCOPE_ERROR`

### Currículo

- `403 FORBIDDEN`
- `404 CANDIDATO_NOT_FOUND`
- `404 CURRICULO_NOT_FOUND`
- `500 RECRUITER_SCOPE_ERROR`

Exemplo fora do escopo:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso a este candidato."
}
```

---

## Fluxo recomendado no frontend

1. detectar `role = RECRUTADOR`
2. manter as páginas:
   - `/dashboard/empresas/candidatos`
   - `/dashboard/empresas/candidatos/:id`
3. trocar apenas o consumo da API para:
   - `/api/v1/recrutador/candidatos`
   - `/api/v1/recrutador/candidatos/:candidatoId`
   - `/api/v1/recrutador/candidatos/:candidatoId/curriculos/:curriculoId`
4. manter o fluxo atual de:
   - `ADMIN`
   - `MODERADOR`
   - `EMPRESA`
   - `SETOR_DE_VAGAS`

---

## Checklist frontend

- [ ] detectar `RECRUTADOR` no usuário logado
- [ ] usar `/api/v1/recrutador/candidatos` na listagem
- [ ] usar `/api/v1/recrutador/candidatos/:candidatoId` no detalhe
- [ ] usar `candidaturas[].curriculo` na coluna `Currículo`
- [ ] usar `/api/v1/recrutador/candidatos/:candidatoId/curriculos/:curriculoId` para visualizar o currículo
- [ ] manter paginação de `10` itens
- [ ] tratar `403 FORBIDDEN`
- [ ] tratar `404 CANDIDATO_NOT_FOUND`
- [ ] tratar `404 CURRICULO_NOT_FOUND`
- [ ] não exibir candidaturas fora do escopo do recrutador
