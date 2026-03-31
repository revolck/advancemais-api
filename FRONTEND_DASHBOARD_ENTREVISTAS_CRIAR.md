# Frontend — Criar Entrevista no Dashboard

## Objetivo

Documentar o fluxo oficial de criação de entrevista na tela:

- `/dashboard/empresas/entrevistas`

O frontend deve usar rotas dedicadas para carregar opções encadeadas do formulário e a rota canônica de criação.

---

## Rotas

### Empresas disponíveis

`GET /api/v1/entrevistas/opcoes/empresas`

### Vagas por empresa

`GET /api/v1/entrevistas/opcoes/vagas?empresaUsuarioId=uuid-empresa`

### Candidatos por vaga

`GET /api/v1/entrevistas/opcoes/candidatos?vagaId=uuid-vaga`

### Criar entrevista

`POST /api/v1/entrevistas`

---

## Permissões

Perfis com acesso:

- `ADMIN`
- `MODERADOR`
- `SETOR_DE_VAGAS`
- `EMPRESA`
- `RECRUTADOR`

### Escopo

- `ADMIN` e `MODERADOR`: podem operar em qualquer empresa/vaga elegível
- `SETOR_DE_VAGAS`: pode operar no escopo global do módulo
- `EMPRESA`: pode operar apenas nas próprias vagas
- `RECRUTADOR`: pode operar apenas nas vagas vinculadas ao seu escopo

Sem permissão:

```json
{
  "success": false,
  "code": "INSUFFICIENT_PERMISSIONS",
  "message": "Sem permissão para criar entrevistas."
}
```

---

## Fluxo recomendado

1. Abrir modal `Marcar entrevista`.
2. Buscar empresas elegíveis.
3. Ao selecionar a empresa, buscar vagas elegíveis.
4. Ao selecionar a vaga, buscar candidatos elegíveis.
5. Preencher modalidade, data/hora e detalhes.
6. Se a modalidade for `PRESENCIAL`, preencher ou revisar o endereço.
7. Confirmar com `POST /api/v1/entrevistas`.
8. Invalidar `GET /api/v1/entrevistas/overview` após sucesso.
9. Invalidar também `GET /api/v1/agenda` para o intervalo visível quando a entrevista for criada com sucesso.

### Regra de Google para `ONLINE`

Para entrevistas `ONLINE`:

- a conta Google usada é a do usuário logado que está criando a entrevista
- o backend não usa fallback automático da conta sistêmica nesse fluxo
- o frontend deve ler `data.capabilities.google.connected` no overview antes de habilitar `ONLINE`

### Regras de dependência

- sem empresa selecionada, não buscar vagas
- ao trocar empresa, limpar `vagaId` e `candidaturaId`
- sem vaga selecionada, não buscar candidatos
- ao trocar vaga, limpar `candidaturaId`
- ao selecionar `PRESENCIAL`, preencher endereço a partir da empresa quando disponível

---

## Modalidades oficiais

A tela do dashboard trabalha apenas com:

- `ONLINE`
- `PRESENCIAL`

A modalidade `TELEFONE` não faz parte do contrato oficial dessa tela.

---

## 1. Empresas elegíveis

### Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-empresa",
        "nomeExibicao": "Inovação Digital S.A.",
        "codigo": "EMP-001",
        "cnpj": "12345678000199",
        "email": "contato@empresa.com",
        "logoUrl": null,
        "totalVagasElegiveis": 4,
        "enderecoPadraoEntrevista": {
          "cep": "57000000",
          "logradouro": "Avenida Empresa",
          "numero": "200",
          "complemento": null,
          "bairro": "Centro",
          "cidade": "Maceió",
          "estado": "AL",
          "pontoReferencia": null
        }
      }
    ]
  }
}
```

### Regras

- `EMPRESA` normalmente recebe apenas `1` item, a própria empresa
- `RECRUTADOR` recebe apenas empresas em que possui vínculo válido
- empresas sem vagas elegíveis não aparecem na lista
- sem empresas elegíveis, retorna `200` com `items: []`
- o frontend usa `codigo`, `cnpj` e `email` para busca interna do select
- `enderecoPadraoEntrevista` pode ser usado para pré-preencher entrevistas presenciais

---

## 2. Vagas elegíveis por empresa

### Query

- `empresaUsuarioId` obrigatório

### Regra de serialização da query

O contrato canônico do frontend deve enviar:

- `empresaUsuarioId` como valor escalar simples

Exemplo recomendado:

```ts
await api.get('/api/v1/entrevistas/opcoes/vagas', {
  params: { empresaUsuarioId },
});
```

Observação:

- o backend já tolera serializações duplicadas e alguns formatos de array por compatibilidade
- mesmo assim, o frontend deve continuar enviando apenas `empresaUsuarioId=<uuid>`

### Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-vaga",
        "codigo": "VAG-0021",
        "titulo": "Desenvolvedor Frontend",
        "status": "PUBLICADO",
        "statusLabel": "Publicado",
        "empresaUsuarioId": "uuid-empresa",
        "candidatosElegiveis": 8
      }
    ]
  }
}
```

### Regras

- valida se o usuário pode operar a empresa informada
- lista apenas vagas fora de `RASCUNHO`
- lista apenas vagas com pelo menos `1` candidato elegível para entrevista
- sem vagas elegíveis, retorna `200` com `items: []`

---

## 3. Candidatos elegíveis por vaga

### Query

- `vagaId` obrigatório

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
          "codigo": "MAT0001",
          "nome": "João da Silva",
          "email": "joao@email.com",
          "cpf": "12345678900",
          "telefone": "82999999999",
          "avatarUrl": null,
          "cidade": "Maceió",
          "estado": "AL"
        },
        "statusCandidatura": "ENTREVISTA",
        "statusCandidaturaLabel": "Entrevista",
        "ultimaAtualizacaoEm": "2026-03-27T09:00:00.000Z",
        "entrevistaAtiva": false,
        "entrevistaAtivaId": null
      }
    ]
  }
}
```

### Regras

- o frontend deve usar `candidaturaId` como chave principal da seleção
- `candidato.id` vem para exibição e validação cruzada, mas não substitui a candidatura
- quando já existir entrevista ativa para aquela candidatura, a API sinaliza:
  - `entrevistaAtiva: true`
  - `entrevistaAtivaId`
- sem candidatos elegíveis, retorna `200` com `items: []`

---

## 4. Criar entrevista

### Body online

```json
{
  "empresaUsuarioId": "uuid-empresa",
  "vagaId": "uuid-vaga",
  "candidaturaId": "uuid-candidatura",
  "candidatoId": "uuid-candidato",
  "modalidade": "ONLINE",
  "dataInicio": "2026-03-28T14:00:00.000Z",
  "dataFim": "2026-03-28T15:00:00.000Z",
  "descricao": "Entrevista técnica online."
}
```

### Body presencial

```json
{
  "empresaUsuarioId": "uuid-empresa",
  "vagaId": "uuid-vaga",
  "candidaturaId": "uuid-candidatura",
  "candidatoId": "uuid-candidato",
  "modalidade": "PRESENCIAL",
  "dataInicio": "2026-03-28T14:00:00.000Z",
  "dataFim": "2026-03-28T15:00:00.000Z",
  "descricao": "Entrevista técnica presencial.",
  "enderecoPresencial": {
    "cep": "57000-000",
    "logradouro": "Rua Exemplo",
    "numero": "123",
    "complemento": "Sala 5",
    "bairro": "Centro",
    "cidade": "Maceió",
    "estado": "AL",
    "pontoReferencia": "Próximo ao shopping"
  }
}
```

### Campos

- `empresaUsuarioId` obrigatório
- `vagaId` obrigatório
- `candidaturaId` obrigatório
- `candidatoId` opcional
- `modalidade` obrigatório
  - `ONLINE`
  - `PRESENCIAL`
- `dataInicio` obrigatório, ISO datetime
- `dataFim` obrigatório, ISO datetime
- `descricao` opcional, máximo `5000`
- `enderecoPresencial` obrigatório quando `modalidade = PRESENCIAL`
- `gerarMeet` opcional, default `true`

### Validações

- `dataFim` deve ser maior que `dataInicio`
- `gerarMeet` só pode ser usado com `modalidade = ONLINE`
- `enderecoPresencial` só pode ser usado com `modalidade = PRESENCIAL`
- a candidatura precisa pertencer à vaga informada
- a vaga precisa pertencer à empresa informada
- o usuário precisa ter escopo sobre a empresa e a vaga
- se já existir entrevista ativa para a candidatura, retorna conflito

### Comportamento de agenda

#### `ONLINE`

- o usuário criador precisa estar com Google conectado
- a reunião é criada com o Google do próprio criador
- o `meetUrl` já volta no payload quando a criação é bem-sucedida
- se o criador não estiver conectado, a API retorna `400 INTERVIEW_GOOGLE_NOT_CONNECTED`
- se o Google falhar ao criar a sala, a API retorna `500 INTERVIEW_MEET_CREATE_ERROR`

#### `PRESENCIAL`

- o backend persiste `enderecoPresencial` como snapshot da entrevista
- o campo `local` deixa de ser o contrato principal do dashboard
- a API ainda pode devolver `local` já formatado como conveniência para exibição
- a entrevista também fica registrada na agenda interna do sistema
- o payload de sucesso devolve `agenda.provider = INTERNAL_ONLY`

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
    "dataInicio": "2026-03-28T14:00:00.000Z",
    "dataFim": "2026-03-28T15:00:00.000Z",
    "agendadaPara": "2026-03-28T14:00:00.000Z",
    "agendadaParaFormatada": "28/03/2026, 11:00",
    "descricao": "Entrevista técnica online.",
    "meetUrl": null,
    "local": null,
    "enderecoPresencial": null,
    "agenda": {
      "eventoInternoId": "uuid-entrevista",
      "criadoNoSistema": true,
      "provider": "GOOGLE_MEET",
      "organizerSource": "USER_OAUTH",
      "organizerUserId": "uuid-usuario-logado",
      "organizerEmail": "setor.vagas@advancemais.com.br"
    },
    "candidato": {
      "id": "uuid-candidato",
      "nome": "João da Silva",
      "codigo": "MAT0001"
    },
    "vaga": {
      "id": "uuid-vaga",
      "titulo": "Desenvolvedor Frontend",
      "codigo": "VAG-0021"
    },
    "empresa": {
      "id": "uuid-empresa",
      "nomeExibicao": "Inovação Digital S.A."
    },
    "recrutador": {
      "id": "uuid-usuario-logado",
      "nome": "Maria Souza"
    },
    "criadoEm": "2026-03-27T09:00:00.000Z"
  }
}
```

## Notificações após criação

Ao criar a entrevista com sucesso, a API também dispara notificações internas para:

- `candidato`
- `empresa`

### Comportamento esperado

- o candidato recebe uma notificação de entrevista agendada
- a empresa recebe uma notificação de entrevista marcada
- o envio da notificação não altera o contrato do `POST`
- se houver falha interna no envio das notificações, a criação da entrevista continua retornando sucesso se o registro principal tiver sido criado corretamente

## Dependência do overview

Antes de abrir o modal, o frontend deve ler no overview:

- `data.capabilities.canCreate`
- `data.capabilities.canCreateOnline`
- `data.capabilities.canCreatePresencial`
- `data.capabilities.google.connected`

Recomendação:

- manter o botão `Marcar entrevista` disponível quando `canCreate = true`
- manter `PRESENCIAL` disponível quando `canCreatePresencial = true`
- habilitar `ONLINE` apenas quando `canCreateOnline = true`
- se `google.connected = false`, mostrar CTA para `GET /api/v1/auth/google/connect`

### Dados enviados na notificação

As notificações usam pelo menos:

- `entrevistaId`
- `empresaUsuarioId`
- `vagaId`
- `candidaturaId`
- `candidatoId`
- `modalidade`
- `dataInicio`
- `dataFim`

---

## Endereço presencial

Quando a modalidade for `PRESENCIAL`:

- o frontend deve pré-preencher os campos com `enderecoPadraoEntrevista` da empresa, quando existir
- o usuário pode editar os campos manualmente
- o endereço enviado no `POST` vira snapshot da entrevista

Campos do snapshot:

- `cep`
- `logradouro`
- `numero`
- `complemento`
- `bairro`
- `cidade`
- `estado`
- `pontoReferencia`

---

## Exemplos de consumo

### Empresas

```ts
const empresasResponse = await api.get('/api/v1/entrevistas/opcoes/empresas');
const empresas = empresasResponse.data?.data?.items ?? [];
```

### Vagas

```ts
const vagasResponse = await api.get('/api/v1/entrevistas/opcoes/vagas', {
  params: { empresaUsuarioId },
});
const vagas = vagasResponse.data?.data?.items ?? [];
```

### Candidatos

```ts
const candidatosResponse = await api.get('/api/v1/entrevistas/opcoes/candidatos', {
  params: { vagaId },
});
const candidatos = candidatosResponse.data?.data?.items ?? [];
```

### Criação online

```ts
const response = await api.post('/api/v1/entrevistas', {
  empresaUsuarioId,
  vagaId,
  candidaturaId,
  candidatoId,
  modalidade: 'ONLINE',
  dataInicio,
  dataFim,
  descricao,
});

const entrevista = response.data?.data;
```

### Criação presencial

```ts
const response = await api.post('/api/v1/entrevistas', {
  empresaUsuarioId,
  vagaId,
  candidaturaId,
  candidatoId,
  modalidade: 'PRESENCIAL',
  dataInicio,
  dataFim,
  descricao,
  enderecoPresencial,
});

const entrevista = response.data?.data;
```

### Refetch da agenda após criação

Depois da criação, o frontend deve refazer a consulta da agenda do intervalo visível.

Exemplo de depuração:

```ts
await api.get('/api/v1/agenda', {
  params: {
    dataInicio: '2026-03-01T00:00:00.000Z',
    dataFim: '2026-03-31T23:59:59.999Z',
    tipos: 'ENTREVISTA',
  },
});
```

Regras:

- o intervalo precisa cobrir `dataInicio` da entrevista criada
- `ONLINE` e `PRESENCIAL` devem aparecer com `tipo = ENTREVISTA`
- `PRESENCIAL` deve aparecer mesmo com `meetUrl = null`
- para `PRESENCIAL`, a UI deve usar `local` e `enderecoPresencial`

---

## Tratamento de erros

### Listagens auxiliares

- `400 INTERVIEWS_INVALID_FILTERS`
- `403 INSUFFICIENT_PERMISSIONS`
- `404 EMPRESA_NOT_FOUND`
- `404 VAGA_NOT_FOUND`

### Criação

- `400 INTERVIEW_INVALID_PAYLOAD`
- `400 INTERVIEW_GOOGLE_NOT_CONNECTED`
- `403 INSUFFICIENT_PERMISSIONS`
- `404 EMPRESA_NOT_FOUND`
- `404 VAGA_NOT_FOUND`
- `404 CANDIDATURA_NOT_FOUND`
- `409 INTERVIEW_ALREADY_EXISTS`
- `500 INTERVIEW_MEET_CREATE_ERROR`
- `500 INTERVIEW_CREATE_ERROR`

Exemplo:

```json
{
  "success": false,
  "code": "INTERVIEW_ALREADY_EXISTS",
  "message": "Já existe uma entrevista ativa para esta candidatura."
}
```

---

## Checklist frontend

- [ ] Adicionar botão `Marcar entrevista` em `/dashboard/empresas/entrevistas`
- [ ] Consumir `GET /api/v1/entrevistas/opcoes/empresas`
- [ ] Consumir `GET /api/v1/entrevistas/opcoes/vagas`
- [ ] Consumir `GET /api/v1/entrevistas/opcoes/candidatos`
- [ ] Consumir `POST /api/v1/entrevistas`
- [ ] Limpar vaga/candidato ao trocar empresa
- [ ] Limpar candidato ao trocar vaga
- [ ] Usar `candidaturaId` como chave do fluxo
- [ ] Remover `TELEFONE` do select de modalidade
- [ ] Pré-preencher `enderecoPresencial` com a empresa quando a modalidade for `PRESENCIAL`
- [ ] Permitir editar o endereço presencial antes de salvar
- [ ] Bloquear ou alertar quando `entrevistaAtiva = true`
- [ ] Invalidar `GET /api/v1/entrevistas/overview` após sucesso
- [ ] Invalidar `GET /api/v1/agenda` após sucesso usando o intervalo visível
- [ ] Considerar que o candidato e a empresa serão notificados automaticamente após o sucesso
- [ ] Habilitar `ONLINE` apenas quando `data.capabilities.canCreateOnline = true`
- [ ] Oferecer conexão com Google quando `data.capabilities.google.connected = false`
- [ ] Tratar `403 INSUFFICIENT_PERMISSIONS`
- [ ] Tratar `400 INTERVIEW_GOOGLE_NOT_CONNECTED`
- [ ] Tratar `500 INTERVIEW_MEET_CREATE_ERROR`
- [ ] Tratar `409 INTERVIEW_ALREADY_EXISTS`
