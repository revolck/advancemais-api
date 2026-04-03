# Frontend — Detalhe de Aluno com Currículos e Entrevistas

## Objetivo

Fechar o contrato da tela:

- `/dashboard/cursos/alunos/:id`

para que o frontend consiga:

1. decidir oficialmente se a aba `Entrevistas` deve aparecer
2. carregar as entrevistas do mesmo aluno/candidato por uma rota própria

---

## Rotas

### Detalhe do aluno

`GET /api/v1/cursos/alunos/:alunoId`

### Entrevistas do aluno

`GET /api/v1/cursos/alunos/:alunoId/entrevistas`

---

## Permissão

### Detalhe do aluno

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`
- `ALUNO_CANDIDATO`
- `RECRUTADOR`

Regra de escopo:

- `ALUNO_CANDIDATO` só pode acessar o próprio `alunoId`
- `RECRUTADOR` só pode acessar alunos/candidatos que tenham candidatura no próprio escopo

### Entrevistas do aluno

- `ADMIN`
- `MODERADOR`
- `ALUNO_CANDIDATO`
- `RECRUTADOR`

Regra de escopo:

- `ADMIN` e `MODERADOR` podem visualizar qualquer aluno
- `ALUNO_CANDIDATO` só pode visualizar entrevistas do próprio `alunoId`
- `RECRUTADOR` só pode visualizar entrevistas do aluno quando a candidatura/vaga estiver no próprio escopo

Erro de escopo:

```json
{
  "success": false,
  "code": "INSUFFICIENT_PERMISSIONS",
  "message": "Sem permissão para acessar dados de outro aluno."
}
```

---

## 1. Detalhe do aluno

### Rota

`GET /api/v1/cursos/alunos/:alunoId`

### Campo novo

O payload principal agora inclui:

```json
{
  "success": true,
  "data": {
    "id": "uuid-aluno",
    "nomeCompleto": "Pedro Oliveira",
    "email": "pedro.oliveira@example.com",
    "curriculosResumo": {
      "total": 2,
      "principalId": "uuid-curriculo-principal"
    }
  }
}
```

### Semântica

- `curriculosResumo.total`
  - inteiro `>= 0`
- `curriculosResumo.principalId`
  - `null` quando não houver currículo principal

### Regra da aba

O frontend deve seguir exatamente isto:

- se `curriculosResumo.total >= 1`
  - exibir a aba `Entrevistas`
- se `curriculosResumo.total === 0`
  - não exibir a aba `Entrevistas`

---

## 2. Entrevistas do aluno

### Rota

`GET /api/v1/cursos/alunos/:alunoId/entrevistas`

### Query

- `page` opcional
- `pageSize` opcional
- `statusEntrevista` opcional, csv
- `modalidades` opcional, csv
- `dataInicio` opcional, ISO datetime
- `dataFim` opcional, ISO datetime
- `sortBy` opcional
- `sortDir` opcional

### Valores aceitos

- `statusEntrevista`
  - `AGENDADA`
  - `CANCELADA`
- `modalidades`
  - `ONLINE`
  - `PRESENCIAL`
- `sortBy`
  - `agendadaPara`
  - `criadoEm`
  - `statusEntrevista`
  - `vagaTitulo`
  - `empresaNome`
- `sortDir`
  - `asc`
  - `desc`

### Exemplo

```bash
GET /api/v1/cursos/alunos/da422002-a10d-47c3-b43d-554d8884e804/entrevistas?page=1&pageSize=10&modalidades=ONLINE,PRESENCIAL&statusEntrevista=AGENDADA
```

---

## Resposta

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
        "dataInicio": "2026-03-31T18:00:00.000Z",
        "dataFim": "2026-03-31T19:00:00.000Z",
        "agendadaPara": "2026-03-31T18:00:00.000Z",
        "agendadaParaFormatada": "31/03/2026, 18:00",
        "descricao": "Entrevista técnica online.",
        "meetUrl": "https://meet.google.com/abc-defg-hij",
        "local": null,
        "enderecoPresencial": null,
        "candidato": {
          "id": "uuid-aluno",
          "codigo": "MAT0002",
          "nome": "Pedro Oliveira",
          "email": "pedro.oliveira@example.com",
          "cpf": "12345678900",
          "telefone": "82999999999",
          "cidade": "Maceió",
          "estado": "AL"
        },
        "vaga": {
          "id": "uuid-vaga",
          "codigo": "V51760",
          "titulo": "Estagiário de Recursos Humanos",
          "status": "PUBLICADO"
        },
        "empresa": {
          "id": "uuid-empresa",
          "nomeExibicao": "Consultoria RH Plus",
          "anonima": false,
          "labelExibicao": "Consultoria RH Plus"
        },
        "recrutador": {
          "id": "uuid-usuario",
          "nome": "Ana Setor de Vagas",
          "email": "setor.vagas@advancemais.com.br",
          "avatarUrl": null
        },
        "agenda": {
          "eventoInternoId": "uuid-entrevista",
          "criadoNoSistema": true,
          "provider": "GOOGLE_MEET",
          "organizerSource": "USER_OAUTH"
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

---

## Entrevista presencial

Entrevistas `PRESENCIAL` também entram normalmente:

```json
{
  "id": "uuid-entrevista-presencial",
  "modalidade": "PRESENCIAL",
  "modalidadeLabel": "Presencial",
  "meetUrl": null,
  "local": "Rua Manoel Pedro de Oliveira, 245 | Benedito Bentes - Maceió - AL | Compl.: Sala 5",
  "enderecoPresencial": {
    "cep": "57084-028",
    "logradouro": "Rua Manoel Pedro de Oliveira",
    "numero": "245",
    "complemento": "Sala 5",
    "bairro": "Benedito Bentes",
    "cidade": "Maceió",
    "estado": "AL",
    "pontoReferencia": "Próximo ao shopping"
  },
  "agenda": {
    "eventoInternoId": "uuid-entrevista-presencial",
    "criadoNoSistema": true,
    "provider": "INTERNAL_ONLY",
    "organizerSource": "SYSTEM"
  }
}
```

Regra de renderização:

- `ONLINE`
  - usar `meetUrl`
- `PRESENCIAL`
  - usar `local` e/ou `enderecoPresencial`

---

## Empresa anônima

Quando a vaga estiver em `modoAnonimo`, o contrato já vem tratado:

```json
{
  "empresa": {
    "id": "uuid-empresa",
    "nomeExibicao": null,
    "anonima": true,
    "labelExibicao": "Empresa anônima"
  }
}
```

Regra de UI:

- se `empresa.anonima = true`
  - não exibir nome real
- usar `empresa.labelExibicao` direto

---

## Estados vazios

### Sem currículos

```json
{
  "curriculosResumo": {
    "total": 0,
    "principalId": null
  }
}
```

### Sem entrevistas

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

Nenhum desses casos é erro.

---

## Tratamento de erros

### Detalhe do aluno

- `404 ALUNO_NOT_FOUND`
- `403 INSUFFICIENT_PERMISSIONS`
- `500 ALUNO_DETAILS_ERROR`

### Entrevistas do aluno

- `404 ALUNO_NOT_FOUND`
- `403 INSUFFICIENT_PERMISSIONS`
- `400 INTERVIEWS_INVALID_FILTERS`
- `500 STUDENT_INTERVIEWS_ERROR`

Exemplo:

```json
{
  "success": false,
  "code": "STUDENT_INTERVIEWS_ERROR",
  "message": "Não foi possível carregar as entrevistas do aluno."
}
```

---

## Checklist frontend

- [ ] Ler `curriculosResumo.total` no detalhe do aluno
- [ ] Exibir a aba `Entrevistas` apenas quando `total >= 1`
- [ ] Consumir `GET /api/v1/cursos/alunos/:alunoId/entrevistas`
- [ ] Reaproveitar o mesmo card de entrevista usado no dashboard quando possível
- [ ] Renderizar `ONLINE` com `meetUrl`
- [ ] Renderizar `PRESENCIAL` com `local` e/ou `enderecoPresencial`
- [ ] Usar `empresa.labelExibicao` quando `empresa.anonima = true`
- [ ] Tratar `items: []` como estado válido
- [ ] Tratar `403 INSUFFICIENT_PERMISSIONS`
- [ ] Tratar `400 INTERVIEWS_INVALID_FILTERS`
