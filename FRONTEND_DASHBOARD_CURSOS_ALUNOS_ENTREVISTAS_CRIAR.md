# Frontend — Criar Entrevista no Detalhe do Aluno

## Objetivo

Documentar o fluxo de criação de entrevista diretamente em:

- `/dashboard/cursos/alunos/:id`

Sem sair da tela do aluno/candidato.

---

## Rotas

### Detalhe do aluno

`GET /api/v1/cursos/alunos/:alunoId`

### Listagem de entrevistas do aluno

`GET /api/v1/cursos/alunos/:alunoId/entrevistas`

### Opções para criação

`GET /api/v1/cursos/alunos/:alunoId/entrevistas/opcoes`

### Criação direta

`POST /api/v1/cursos/alunos/:alunoId/entrevistas`

---

## Perfis

### Detalhe do aluno

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`
- `INSTRUTOR`
- `ALUNO_CANDIDATO`
- `RECRUTADOR`

### Entrevistas do aluno

- `ADMIN`
- `MODERADOR`
- `ALUNO_CANDIDATO`
- `RECRUTADOR`

### Criação direta

- `ADMIN`
- `MODERADOR`
- `RECRUTADOR`

### Escopo

- `ADMIN` e `MODERADOR` podem operar qualquer aluno
- `ALUNO_CANDIDATO` só acessa o próprio `alunoId`
- `RECRUTADOR` só acessa alunos e entrevistas quando houver candidatura em vaga do próprio escopo
- `ALUNO_CANDIDATO` não cria entrevista nessa tela

---

## Regra de UI

Na tela `/dashboard/cursos/alunos/:id`:

1. exibir a aba `Entrevistas` apenas quando `curriculosResumo.total >= 1`
2. exibir o botão `Marcar entrevista` apenas para:
   - `ADMIN`
   - `MODERADOR`
   - `RECRUTADOR`
3. só habilitar o botão quando `GET /api/v1/cursos/alunos/:alunoId/entrevistas/opcoes` retornar pelo menos `1` item com `entrevistaAtiva = false`

---

## 1. Opções de criação

### Rota

`GET /api/v1/cursos/alunos/:alunoId/entrevistas/opcoes`

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
    "items": [
      {
        "candidaturaId": "uuid-candidatura",
        "empresa": {
          "id": "uuid-empresa",
          "nomeExibicao": "Consultoria RH Plus",
          "anonima": false,
          "labelExibicao": "Consultoria RH Plus"
        },
        "vaga": {
          "id": "uuid-vaga",
          "codigo": "V51760",
          "titulo": "Estagiário de Recursos Humanos",
          "status": "PUBLICADO",
          "statusLabel": "Publicado"
        },
        "candidato": {
          "id": "uuid-aluno",
          "codigo": "MAT0002",
          "nome": "Pedro Oliveira"
        },
        "statusCandidatura": "ENTREVISTA",
        "statusCandidaturaLabel": "Entrevista",
        "entrevistaAtiva": false,
        "entrevistaAtivaId": null,
        "empresaAnonima": false,
        "anonimatoBloqueado": true,
        "enderecoPadraoEntrevista": {
          "cep": "57084-028",
          "logradouro": "Rua Manoel Pedro de Oliveira",
          "numero": "245",
          "complemento": "Sala 5",
          "bairro": "Benedito Bentes",
          "cidade": "Maceió",
          "estado": "AL",
          "pontoReferencia": null
        }
      }
    ]
  }
}
```

### Semântica

- `items` contém apenas candidaturas daquele aluno no escopo do usuário atual
- `entrevistaAtiva = true` indica que aquela candidatura já possui entrevista ativa
- `empresaAnonima` reflete o anonimato efetivo da vaga
- `anonimatoBloqueado = true` indica que o frontend não deve permitir alterar esse estado nessa tela
- `enderecoPadraoEntrevista` serve para pré-preencher a modalidade `PRESENCIAL`

### Estado vazio válido

```json
{
  "success": true,
  "data": {
    "canCreate": true,
    "canCreateOnline": false,
    "canCreatePresencial": true,
    "requiresGoogleForOnline": true,
    "items": []
  }
}
```

Isso significa:

- o aluno existe
- o usuário tem acesso ao contexto
- mas não há candidatura elegível para criação naquele momento

---

## 2. Criação direta

### Rota

`POST /api/v1/cursos/alunos/:alunoId/entrevistas`

### Body online

```json
{
  "candidaturaId": "uuid-candidatura",
  "modalidade": "ONLINE",
  "dataInicio": "2026-03-31T18:00:00.000Z",
  "dataFim": "2026-03-31T19:00:00.000Z",
  "descricao": "Entrevista técnica online.",
  "empresaAnonima": false
}
```

### Body presencial

```json
{
  "candidaturaId": "uuid-candidatura",
  "modalidade": "PRESENCIAL",
  "dataInicio": "2026-03-31T16:00:00.000Z",
  "dataFim": "2026-03-31T17:00:00.000Z",
  "descricao": "Entrevista presencial.",
  "empresaAnonima": false,
  "enderecoPresencial": {
    "cep": "57084-028",
    "logradouro": "Rua Manoel Pedro de Oliveira",
    "numero": "245",
    "complemento": "Sala 5",
    "bairro": "Benedito Bentes",
    "cidade": "Maceió",
    "estado": "AL",
    "pontoReferencia": "Próximo ao shopping"
  }
}
```

### Regras

- `alunoId` da URL precisa corresponder ao candidato da `candidaturaId`
- `RECRUTADOR` só cria no próprio escopo
- `ONLINE` usa Google do usuário logado
- `PRESENCIAL` registra agenda interna
- `empresaAnonima` deve refletir o anonimato configurado na vaga
- nessa tela o anonimato vem bloqueado para alteração (`anonimatoBloqueado = true`)

### Resposta de sucesso

A resposta reaproveita o contrato do `POST /api/v1/entrevistas`, com a empresa já tratada para anonimato:

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
    "dataInicio": "2026-03-31T16:00:00.000Z",
    "dataFim": "2026-03-31T17:00:00.000Z",
    "descricao": "Entrevista presencial.",
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
    "empresa": {
      "id": "uuid-empresa",
      "nomeExibicao": "Consultoria RH Plus",
      "anonima": false,
      "labelExibicao": "Consultoria RH Plus"
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

## Google para `ONLINE`

Quando `modalidade = ONLINE`:

- o usuário criador precisa estar conectado ao Google
- `canCreateOnline` depende de `google.connected`
- se não estiver conectado, o backend retorna:

```json
{
  "success": false,
  "code": "INTERVIEW_GOOGLE_NOT_CONNECTED",
  "message": "Para criar entrevista ONLINE, conecte sua conta Google primeiro."
}
```

---

## Revalidação após sucesso

Depois da criação da entrevista, o frontend deve invalidar/refazer:

- `GET /api/v1/cursos/alunos/:alunoId/entrevistas`
- `GET /api/v1/cursos/alunos/:alunoId/entrevistas/opcoes`
- `GET /api/v1/entrevistas/overview`
- `GET /api/v1/agenda` no intervalo visível

---

## Tratamento de erros

### Opções

- `404 ALUNO_NOT_FOUND`
- `403 INSUFFICIENT_PERMISSIONS`
- `500 STUDENT_INTERVIEW_OPTIONS_ERROR`

### Criação

- `404 ALUNO_NOT_FOUND`
- `404 CANDIDATURA_NOT_FOUND`
- `403 INSUFFICIENT_PERMISSIONS`
- `400 INTERVIEW_INVALID_PAYLOAD`
- `400 INTERVIEW_GOOGLE_NOT_CONNECTED`
- `409 INTERVIEW_ALREADY_EXISTS`
- `500 INTERVIEW_MEET_CREATE_ERROR`
- `500 STUDENT_INTERVIEW_CREATE_ERROR`

---

## Checklist frontend

- [ ] Exibir botão `Marcar entrevista` apenas para `ADMIN`, `MODERADOR` e `RECRUTADOR`
- [ ] Consumir `GET /api/v1/cursos/alunos/:alunoId/entrevistas/opcoes`
- [ ] Só habilitar criação quando houver item com `entrevistaAtiva = false`
- [ ] Usar `google.connected` para decidir a modalidade `ONLINE`
- [ ] Pré-preencher `enderecoPresencial` com `enderecoPadraoEntrevista`
- [ ] Tratar `empresa.labelExibicao` como fonte oficial de exibição
- [ ] Invalidar entrevistas/opções/overview/agenda após sucesso
- [ ] Tratar `403 INSUFFICIENT_PERMISSIONS`
- [ ] Tratar `400 INTERVIEW_INVALID_PAYLOAD`
- [ ] Tratar `400 INTERVIEW_GOOGLE_NOT_CONNECTED`
- [ ] Tratar `409 INTERVIEW_ALREADY_EXISTS`
