# Frontend — Agenda Unificada do Dashboard

## Objetivo

Documentar a rota oficial da agenda usada em:

- `/dashboard/agenda`

A agenda do dashboard deixa de ser tratada como agenda exclusiva de cursos e passa a aceitar eventos acadêmicos e entrevistas no mesmo contrato.

---

## Rotas

### Principal

`GET /api/v1/agenda`

### Aniversariantes

`GET /api/v1/agenda/aniversariantes`

### Compatibilidade temporária

As rotas antigas continuam respondendo:

- `GET /api/v1/cursos/agenda`
- `GET /api/v1/cursos/agenda/aniversariantes`

Mas o contrato canônico recomendado para o frontend é:

- `GET /api/v1/agenda`

---

## Perfis com acesso à agenda principal

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`
- `ALUNO_CANDIDATO`
- `EMPRESA`
- `SETOR_DE_VAGAS`
- `RECRUTADOR`

### Escopo esperado

- `ADMIN` e `MODERADOR`
  - visão global da agenda
- `PEDAGOGICO`
  - visão acadêmica
- `INSTRUTOR`
  - visão acadêmica própria
- `ALUNO_CANDIDATO`
  - eventos acadêmicos próprios e entrevistas próprias
- `EMPRESA`
  - entrevistas da própria empresa
- `SETOR_DE_VAGAS`
  - visão global operacional de entrevistas
- `RECRUTADOR`
  - entrevistas das vagas no próprio escopo

---

## Query da agenda principal

- `dataInicio` obrigatório, ISO datetime
- `dataFim` obrigatório, ISO datetime
- `tipos` opcional, csv

### Tipos aceitos

- `AULA`
- `PROVA`
- `ATIVIDADE`
- `ENTREVISTA`
- `ANIVERSARIO`
- `TURMA_INICIO`
- `TURMA_FIM`

Observação:

- `TURMA` também é aceito como alias interno para buscar `TURMA_INICIO` e `TURMA_FIM`

### Exemplos

```bash
GET /api/v1/agenda?dataInicio=2026-03-01T00:00:00.000Z&dataFim=2026-03-31T23:59:59.999Z
```

```bash
GET /api/v1/agenda?dataInicio=2026-03-01T00:00:00.000Z&dataFim=2026-03-31T23:59:59.999Z&tipos=AULA,PROVA,ENTREVISTA
```

```bash
GET /api/v1/agenda?dataInicio=2026-03-01T00:00:00.000Z&dataFim=2026-03-31T23:59:59.999Z&tipos=ENTREVISTA
```

---

## Resposta da agenda principal

```json
{
  "success": true,
  "eventos": [
    {
      "id": "uuid-entrevista",
      "tipo": "ENTREVISTA",
      "titulo": "Entrevista — Pedro Oliveira",
      "descricao": "Estagiário de Recursos Humanos",
      "dataInicio": "2026-03-31T18:00:00.000Z",
      "dataFim": "2026-03-31T20:00:00.000Z",
      "cor": "#0F172A",
      "modalidade": "ONLINE",
      "modalidadeLabel": "Online",
      "meetUrl": "https://meet.google.com/abc-defg-hij",
      "local": null,
      "enderecoPresencial": null,
      "usuario": {
        "id": "uuid-usuario",
        "nome": "Ana Setor de Vagas",
        "role": "SETOR_DE_VAGAS"
      },
      "empresa": {
        "id": "uuid-empresa",
        "nomeExibicao": "Consultoria RH Plus"
      },
      "vaga": {
        "id": "uuid-vaga",
        "titulo": "Estagiário de Recursos Humanos"
      },
      "candidato": {
        "id": "uuid-candidato",
        "nome": "Pedro Oliveira"
      },
      "agenda": {
        "eventoInternoId": "uuid-entrevista",
        "criadoNoSistema": true,
        "provider": "GOOGLE_MEET",
        "organizerSource": "USER_OAUTH",
        "organizerUserId": "uuid-usuario",
        "organizerEmail": "setor.vagas@advancemais.com.br"
      }
    }
  ]
}
```

---

## Entrevistas na agenda

Quando uma entrevista existir no intervalo consultado, a agenda pode retornar:

- `tipo = ENTREVISTA`
- `id = entrevista.id`
- `titulo`
- `descricao`
- `dataInicio`
- `dataFim`
- `modalidade`
- `modalidadeLabel`
- `meetUrl`
- `local`
- `enderecoPresencial`
- `empresa`
- `vaga`
- `candidato`
- `agenda`

### Entrevista presencial na agenda

Entrevistas `PRESENCIAL` também entram normalmente na agenda principal.

Exemplo:

```json
{
  "id": "uuid-entrevista",
  "tipo": "ENTREVISTA",
  "titulo": "Entrevista — Mariana Presencial",
  "descricao": "Analista Presencial",
  "dataInicio": "2026-03-31T18:00:00.000Z",
  "dataFim": "2026-03-31T19:00:00.000Z",
  "cor": "#0F172A",
  "modalidade": "PRESENCIAL",
  "modalidadeLabel": "Presencial",
  "meetUrl": null,
  "local": "Rua Manoel Pedro de Oliveira, 245, Sala 5, Benedito Bentes, Maceió - AL",
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
    "eventoInternoId": "uuid-entrevista",
    "criadoNoSistema": true,
    "provider": "INTERNAL_ONLY",
    "organizerSource": "SYSTEM",
    "organizerUserId": null,
    "organizerEmail": null
  }
}
```

### Regra de renderização

Para entrevistas:

- usar `titulo` como label principal
- usar `descricao` como subtítulo
- usar `meetUrl` para CTA de reunião quando existir
- se `modalidade = PRESENCIAL`, usar `local` ou `enderecoPresencial` para exibir o endereço
- usar `agenda` como metadado de integração

---

## Regras funcionais importantes

### 1. Entrevista criada precisa aparecer na agenda

Se o frontend criar uma entrevista por:

- `POST /api/v1/entrevistas`

e depois consultar:

- `GET /api/v1/agenda` no intervalo correspondente

então a entrevista deve aparecer na agenda com:

- `tipo = ENTREVISTA`
- `id = entrevista.id`
- isso vale tanto para `ONLINE` quanto para `PRESENCIAL`

### Recomendação de refetch

Depois da criação da entrevista, o frontend deve invalidar/refazer:

- `GET /api/v1/entrevistas/overview`
- `GET /api/v1/agenda` no intervalo visível do calendário

Para depuração, o backend pode ser validado com:

```bash
GET /api/v1/agenda?dataInicio=2026-03-01T00:00:00.000Z&dataFim=2026-03-31T23:59:59.999Z&tipos=ENTREVISTA
```

Observação:

- o intervalo consultado precisa cobrir `dataInicio` da entrevista criada
- se a API devolver o item e a UI não mostrar, o problema deixa de ser de backend

### 2. Sem dados não é erro

Quando não houver eventos no período:

```json
{
  "success": true,
  "eventos": []
}
```

### 3. Escopo por perfil

- `SETOR_DE_VAGAS` vê entrevistas globais do recrutamento
- `RECRUTADOR` vê entrevistas das vagas vinculadas ao próprio escopo
- `EMPRESA` vê entrevistas da própria empresa
- `PEDAGOGICO` não depende de entrevistas para a agenda funcionar

---

## Aniversariantes

### Rota

`GET /api/v1/agenda/aniversariantes`

### Query

- `dataInicio` obrigatório
- `dataFim` obrigatório
- `roles` opcional, csv
- `incluirInativos` opcional, boolean

### Resposta

```json
{
  "success": true,
  "data": {
    "eventos": [
      {
        "id": "birthday-uuid-2026-03-15",
        "tipo": "ANIVERSARIO",
        "titulo": "Aniversário - Ana Silva",
        "descricao": "SETOR_DE_VAGAS",
        "data": "2026-03-15T00:00:00.000Z",
        "cor": "#10B981",
        "usuario": {
          "id": "uuid-usuario",
          "nome": "Ana Silva",
          "role": "SETOR_DE_VAGAS",
          "avatarUrl": null
        }
      }
    ],
    "resumo": {
      "total": 1
    }
  }
}
```

---

## Tratamento de erros

### Agenda principal

- `400 AGENDA_INVALID_FILTERS`
- `403 INSUFFICIENT_PERMISSIONS`
- `500 AGENDA_ERROR`

Exemplo:

```json
{
  "success": false,
  "code": "AGENDA_INVALID_FILTERS",
  "message": "Os filtros informados para a agenda são inválidos."
}
```

### Aniversariantes

- `400 VALIDATION_ERROR`
- `403 INSUFFICIENT_PERMISSIONS`
- `500 INTERNAL_SERVER_ERROR`

---

## Checklist frontend

- [ ] trocar o consumo canônico para `GET /api/v1/agenda`
- [ ] manter `GET /api/v1/agenda/aniversariantes` para o card/lista de aniversariantes
- [ ] aceitar `ENTREVISTA` como tipo oficial da agenda
- [ ] renderizar `meetUrl` quando o evento for entrevista online
- [ ] tratar `empresa`, `vaga`, `candidato` e `agenda` como metadados opcionais do evento
- [ ] considerar `eventos: []` como estado válido
- [ ] tratar `400 AGENDA_INVALID_FILTERS`
- [ ] tratar `403 INSUFFICIENT_PERMISSIONS`
