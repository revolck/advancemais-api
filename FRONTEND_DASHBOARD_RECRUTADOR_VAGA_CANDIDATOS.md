# Frontend — Aba `Candidatos` no Detalhe da Vaga para `RECRUTADOR`

## Objetivo

Documentar o consumo da aba:

- `Candidatos`

na tela:

- `/dashboard/empresas/vagas/:id`

quando o usuário logado tiver:

- `role = RECRUTADOR`

Nessa condição, o frontend deve consumir:

- `GET /api/v1/recrutador/vagas/:vagaId`
- `GET /api/v1/recrutador/vagas/:vagaId/candidatos`

---

## Regra de escopo

### Vínculo por empresa

- o recrutador pode abrir a vaga se ela estiver em uma empresa do próprio escopo
- na aba `Candidatos`, vê apenas candidatos inscritos na vaga da URL

### Vínculo por vaga

- o recrutador pode abrir apenas a vaga vinculada
- a aba `Candidatos` devolve apenas candidatos dessa vaga

### Regra fixa

- candidato fora do escopo não aparece
- candidatura fora do escopo não aparece
- outra vaga da mesma empresa não influencia a listagem, os filtros nem a paginação

---

## Rota

### Listagem escopada dos candidatos da vaga

`GET /api/v1/recrutador/vagas/:vagaId/candidatos`

---

## Query

- `search` opcional
- `inscricaoDe` opcional, ISO datetime
- `inscricaoAte` opcional, ISO datetime
- `page` opcional
- `pageSize` opcional
- `sortBy` opcional
- `sortDir` opcional

### Valores aceitos em `sortBy`

- `nome`
- `email`
- `codigo`
- `criadoEm`
- `atualizadoEm`
- `statusCandidatura`

### Valores aceitos em `sortDir`

- `asc`
- `desc`

### Semântica

- `search`
  - pesquisa por nome, email ou código do candidato
- `inscricaoDe`
  - filtra `candidatura.aplicadaEm >= inscricaoDe`
- `inscricaoAte`
  - filtra `candidatura.aplicadaEm <= inscricaoAte`
- `pageSize`
  - default `10`

---

## Resposta

```json
{
  "success": true,
  "data": {
    "vaga": {
      "id": "uuid-vaga",
      "titulo": "DevOps Engineer",
      "codigo": "V51689",
      "status": "PUBLICADO"
    },
    "items": [
      {
        "candidaturaId": "uuid-candidatura",
        "candidato": {
          "id": "uuid-candidato",
          "nomeCompleto": "Joao da Silva",
          "cpf": "12312312312",
          "codUsuario": "MAT0001",
          "email": "joao@email.com",
          "telefone": "11988881111",
          "avatarUrl": null,
          "cidade": "Sao Paulo",
          "estado": "SP"
        },
        "statusCandidatura": "EM_PROCESSO",
        "statusCandidaturaLabel": "Em processo",
        "criadoEm": "2026-04-02T10:00:00.000Z",
        "atualizadoEm": "2026-04-02T11:00:00.000Z",
        "curriculosResumo": {
          "total": 1,
          "principalTitulo": "Curriculo DevOps"
        },
        "curriculo": {
          "id": "uuid-curriculo",
          "titulo": "Curriculo DevOps",
          "principal": true,
          "ultimaAtualizacao": "2026-04-01T18:00:00.000Z"
        },
        "experienciaResumo": "3 experiências",
        "formacaoResumo": "Ciencia da Computacao"
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

---

## Campos mínimos por item

### Candidatura

- `candidaturaId`
- `statusCandidatura`
- `statusCandidaturaLabel`
- `criadoEm`
- `atualizadoEm`

### Candidato

- `candidato.id`
- `candidato.nomeCompleto`
- `candidato.cpf`
- `candidato.codUsuario`
- `candidato.email`
- `candidato.telefone`
- `candidato.avatarUrl`
- `candidato.cidade`
- `candidato.estado`

### Currículo

- `curriculosResumo.total`
- `curriculosResumo.principalTitulo`
- `curriculo.id`
- `curriculo.titulo`
- `curriculo.principal`
- `curriculo.ultimaAtualizacao`

### Resumos

- `experienciaResumo`
- `formacaoResumo`

Observação:

- `curriculo` pode ser `null` quando a candidatura não tiver currículo vinculado
- `experienciaResumo` e `formacaoResumo` usam o currículo da candidatura e, quando necessário, fazem fallback para o currículo principal do candidato

---

## Estado vazio válido

```json
{
  "success": true,
  "data": {
    "vaga": {
      "id": "uuid-vaga",
      "titulo": "DevOps Engineer",
      "codigo": "V51689",
      "status": "PUBLICADO"
    },
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 0,
      "totalPages": 1
    }
  }
}
```

---

## Tratamento de erros

### Listagem

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 VAGA_NOT_FOUND`
- `500 RECRUITER_SCOPE_ERROR`

Exemplo fora do escopo:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso aos candidatos desta vaga."
}
```

---

## Fluxo recomendado no frontend

1. detectar `role = RECRUTADOR`
2. abrir `/dashboard/empresas/vagas/:vagaId`
3. carregar `GET /api/v1/recrutador/vagas/:vagaId`
4. habilitar a aba `Candidatos`
5. ao abrir a aba, carregar:
   - `GET /api/v1/recrutador/vagas/:vagaId/candidatos`
6. usar:
   - `search`
   - `inscricaoDe`
   - `inscricaoAte`
   - `page`
   - `pageSize`
   - `sortBy`
   - `sortDir`
7. ao clicar em visualizar candidato, continuar usando:
   - `GET /api/v1/recrutador/candidatos/:candidatoId`

---

## Checklist frontend

- [ ] detectar `RECRUTADOR` no usuário logado
- [ ] habilitar a aba `Candidatos` no detalhe da vaga do recrutador
- [ ] consumir `GET /api/v1/recrutador/vagas/:vagaId/candidatos`
- [ ] usar `search` por nome, email ou código
- [ ] usar filtro de período por `inscricaoDe` e `inscricaoAte`
- [ ] usar `pageSize` default `10`
- [ ] renderizar `curriculosResumo` e `curriculo` na grade
- [ ] renderizar `experienciaResumo` e `formacaoResumo`
- [ ] tratar `400 VALIDATION_ERROR`
- [ ] tratar `403 FORBIDDEN`
- [ ] tratar `404 VAGA_NOT_FOUND`
- [ ] mostrar empty state dentro da área da tabela quando `items = []`
