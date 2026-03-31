# Frontend — Dashboard de Entrevistas

## Objetivo

Documentar a rota oficial que alimenta a tela:

- `/dashboard/empresas/entrevistas`

Essa rota substitui o workaround com candidaturas e entrega paginação, busca, filtros e payload pronto para renderização.

---

## Rota

`GET /api/v1/entrevistas/overview`

---

## Permissões

Perfis com acesso:

- `ADMIN`
- `MODERADOR`
- `SETOR_DE_VAGAS`
- `EMPRESA`
- `RECRUTADOR`

### Escopo

- `ADMIN` e `MODERADOR`: visão global
- `SETOR_DE_VAGAS`: visão operacional global
- `EMPRESA`: apenas entrevistas da própria empresa
- `RECRUTADOR`: apenas entrevistas das vagas vinculadas ao recrutador

Sem permissão:

```json
{
  "success": false,
  "code": "INSUFFICIENT_PERMISSIONS",
  "message": "Sem permissão para acessar as entrevistas."
}
```

---

## Query suportada

- `page` opcional, default `1`
- `pageSize` opcional, default `20`, máximo `100`
- `search` opcional
- `empresaUsuarioId` opcional
- `vagaId` opcional
- `recrutadorId` opcional
- `statusEntrevista` opcional, csv
- `modalidades` opcional, csv
- `dataInicio` opcional, ISO datetime
- `dataFim` opcional, ISO datetime
- `sortBy` opcional
  - `agendadaPara`
  - `criadoEm`
  - `statusEntrevista`
  - `candidatoNome`
  - `vagaTitulo`
- `sortDir` opcional
  - `asc`
  - `desc`

### Exemplos

```bash
GET /api/v1/entrevistas/overview?page=1&pageSize=20
```

```bash
GET /api/v1/entrevistas/overview?statusEntrevista=AGENDADA,CANCELADA&sortBy=agendadaPara&sortDir=asc
```

```bash
GET /api/v1/entrevistas/overview?search=joao%20silva
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
        "agendadaPara": "2026-03-28T14:00:00.000Z",
        "agendadaParaFormatada": "28/03/2026, 11:00",
        "dataInicio": "2026-03-28T14:00:00.000Z",
        "dataFim": "2026-03-28T15:00:00.000Z",
        "descricao": "Entrevista técnica com foco em React e Node.js.",
        "meetUrl": "https://meet.google.com/abc-defg-hij",
        "local": null,
        "enderecoPresencial": null,
        "candidato": {
          "id": "uuid-candidato",
          "codigo": "MAT0001",
          "nome": "João da Silva",
          "email": "joao@email.com",
          "cpf": "12345678900",
          "telefone": "82999999999",
          "avatarUrl": null,
          "cidade": "Maceió",
          "estado": "AL"
        },
        "vaga": {
          "id": "uuid-vaga",
          "codigo": "VAG-0021",
          "titulo": "Desenvolvedor Frontend",
          "status": "PUBLICADO"
        },
        "empresa": {
          "id": "uuid-empresa",
          "nomeExibicao": "Inovação Digital S.A.",
          "logoUrl": null
        },
        "recrutador": {
          "id": "uuid-recrutador",
          "nome": "Maria Souza",
          "email": "maria@empresa.com",
          "avatarUrl": null
        },
        "meta": {
          "origem": "GOOGLE_MEET",
          "calendarEventId": "ext-123",
          "observacoesInternas": null
        },
        "agenda": {
          "eventoInternoId": "uuid-entrevista",
          "criadoNoSistema": true,
          "provider": "GOOGLE_MEET",
          "organizerSource": "USER_OAUTH",
          "organizerUserId": "uuid-recrutador",
          "organizerEmail": "maria@empresa.com"
        },
        "criadoEm": "2026-03-27T09:00:00.000Z",
        "atualizadoEm": "2026-03-27T09:10:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 42,
      "totalPages": 3
    },
    "summary": {
      "totalEntrevistas": 42,
      "agendadas": 18,
      "confirmadas": 0,
      "realizadas": 0,
      "canceladas": 4,
      "naoCompareceram": 0
    },
    "filtrosDisponiveis": {
      "statusEntrevista": [
        {
          "value": "AGENDADA",
          "label": "Agendada",
          "count": 18
        }
      ],
      "modalidades": [
        {
          "value": "ONLINE",
          "label": "Online",
          "count": 27
        }
      ]
    },
    "capabilities": {
      "canCreate": true,
      "canCreatePresencial": true,
      "canCreateOnline": true,
      "requiresGoogleForOnline": true,
      "google": {
        "connected": true,
        "expired": false,
        "calendarId": "primary",
        "expiraEm": "2026-03-30T22:10:00.000Z",
        "connectEndpoint": "/api/v1/auth/google/connect",
        "disconnectEndpoint": "/api/v1/auth/google/disconnect",
        "statusEndpoint": "/api/v1/auth/google/status"
      }
    }
  }
}
```

---

## Regras importantes

- sem dados, a rota retorna `200` com `items: []`
- `pagination.totalPages` volta `1` quando não houver registros
- `statusEntrevistaLabel` e `modalidadeLabel` já vêm prontos para a UI
- `agendadaParaFormatada` já vem formatada no fuso `America/Maceio`
- a coluna visível não precisa depender de UUID bruto
- `agenda` e `enderecoPresencial` podem vir preenchidos quando a entrevista exigir esse contexto
- `capabilities.google.connected` informa se o usuário pode criar entrevista `ONLINE` naquele momento
- para entrevistas `ONLINE`, `agenda.organizerSource = USER_OAUTH` indica que a sala foi criada com o Google do próprio usuário criador

### Capabilities

O overview agora também devolve um bloco:

- `capabilities.canCreate`
- `capabilities.canCreatePresencial`
- `capabilities.canCreateOnline`
- `capabilities.requiresGoogleForOnline`
- `capabilities.google`

Uso recomendado:

- manter o fluxo `PRESENCIAL` disponível mesmo sem Google
- habilitar `ONLINE` apenas quando `capabilities.canCreateOnline = true`
- quando `capabilities.google.connected = false`, usar `GET /api/v1/auth/google/connect`

### Modalidade atual

A API já devolve a modalidade normalizada no payload:

- `ONLINE`
- `PRESENCIAL`

Com `modalidadeLabel` pronto para a UI.

---

## Exemplo de consumo

```ts
const response = await api.get('/api/v1/entrevistas/overview', {
  params: {
    page: 1,
    pageSize: 20,
    search: 'joão',
    statusEntrevista: 'AGENDADA',
    sortBy: 'agendadaPara',
    sortDir: 'asc',
  },
});

const payload = response.data?.data;
```

---

## Tratamento de erros

- `400 INTERVIEWS_INVALID_FILTERS`
- `400 VALIDATION_ERROR`
- `403 INSUFFICIENT_PERMISSIONS`
- `500 INTERVIEWS_OVERVIEW_ERROR`

---

## Checklist frontend

- [ ] Substituir o workaround com `candidaturas/overview`
- [ ] Consumir `GET /api/v1/entrevistas/overview`
- [ ] Usar `filtrosDisponiveis.statusEntrevista`
- [ ] Usar `filtrosDisponiveis.modalidades`
- [ ] Renderizar `statusEntrevistaLabel`
- [ ] Renderizar `modalidadeLabel`
- [ ] Usar `agendadaParaFormatada` na tabela
- [ ] Tratar `403 INSUFFICIENT_PERMISSIONS`
- [ ] Tratar `400 INTERVIEWS_INVALID_FILTERS`
