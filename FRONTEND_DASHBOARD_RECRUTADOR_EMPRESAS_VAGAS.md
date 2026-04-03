# Frontend — Empresas e Vagas no Escopo do Recrutador

## Objetivo

Documentar o consumo das telas:

- `/dashboard/empresas`
- `/dashboard/empresas/:id`
- `/dashboard/empresas/vagas`
- `/dashboard/empresas/vagas/:id`

quando o usuário logado tiver:

- `role = RECRUTADOR`

Nessa condição, o frontend deve consumir o namespace:

- `/api/v1/recrutador/...`

---

## Regras de escopo

### Vínculo por empresa

Quando o recrutador possui vínculo por empresa:

- vê a empresa na listagem
- abre o detalhe da empresa
- vê as vagas operáveis da empresa
- abre o detalhe das vagas da empresa

### Vínculo por vaga

Quando o recrutador possui vínculo apenas por vaga:

- vê a empresa dona da vaga na listagem de empresas
- pode abrir o detalhe da empresa
- mas o detalhe da empresa devolve apenas as vagas do próprio escopo
- vê apenas a vaga vinculada na listagem de vagas
- abre apenas a vaga vinculada

### Regra fixa

- `RASCUNHO` não entra no escopo do recrutador

---

## Rotas

### Empresas do recrutador

`GET /api/v1/recrutador/empresas`

### Detalhe de empresa do recrutador

`GET /api/v1/recrutador/empresas/:empresaUsuarioId`

### Vagas do recrutador

`GET /api/v1/recrutador/vagas`

### Detalhe de vaga do recrutador

`GET /api/v1/recrutador/vagas/:vagaId`

---

## 1. Listagem de empresas

### Rota

`GET /api/v1/recrutador/empresas`

### Resposta

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-empresa",
      "nome": "Tech Innovations LTDA",
      "nomeExibicao": "Tech Innovations LTDA",
      "email": "contato@empresa.com",
      "cnpj": "12345678000190",
      "cidade": "Maceió",
      "estado": "AL",
      "cep": "57000-000",
      "bairro": "Centro",
      "logradouro": "Rua Exemplo",
      "codUsuario": "EMP-009",
      "avatarUrl": null,
      "telefone": "82999999999",
      "status": "ATIVO"
    }
  ]
}
```

### Regras

- não duplica empresas
- inclui empresas vindas de:
  - vínculo direto por empresa
  - vínculo indireto por vaga

---

## 2. Detalhe da empresa

### Rota

`GET /api/v1/recrutador/empresas/:empresaUsuarioId`

### Resposta

```json
{
  "success": true,
  "data": {
    "empresa": {
      "id": "uuid-empresa",
      "nome": "Tech Innovations LTDA",
      "nomeExibicao": "Tech Innovations LTDA",
      "email": "contato@empresa.com",
      "cnpj": "12345678000190",
      "cidade": "Maceió",
      "estado": "AL",
      "cep": "57000-000",
      "bairro": "Centro",
      "logradouro": "Rua Exemplo",
      "codUsuario": "EMP-009",
      "avatarUrl": null,
      "telefone": "82999999999",
      "status": "ATIVO"
    },
    "escopo": {
      "tipoAcesso": "EMPRESA",
      "empresaVinculadaDiretamente": true,
      "totalVagasNoEscopo": 2
    },
    "vagas": [
      {
        "id": "uuid-vaga",
        "titulo": "Desenvolvedor Full Stack Pleno",
        "codigo": "V51386",
        "status": "PUBLICADO"
      }
    ]
  }
}
```

### Semântica de `escopo`

- `tipoAcesso`
  - `EMPRESA`
  - `VAGA`
- `empresaVinculadaDiretamente`
  - `true` quando existe vínculo amplo por empresa
- `totalVagasNoEscopo`
  - quantidade de vagas retornadas naquele detalhe

### Regra importante

Se o recrutador tiver apenas vínculo por vaga:

- o detalhe da empresa continua abrindo
- mas `data.vagas` vem limitado ao escopo permitido

---

## 3. Listagem de vagas

### Rota

`GET /api/v1/recrutador/vagas`

### Query

- `search` opcional
- `empresaUsuarioId` opcional
- `localizacao` opcional
- `status` opcional, csv
- `page` opcional
- `pageSize` opcional
- `sortBy` opcional
- `sortDir` opcional

### Valores aceitos em `status`

- `EM_ANALISE`
- `PUBLICADO`
- `EXPIRADO`
- `DESPUBLICADA`
- `PAUSADA`
- `ENCERRADA`

Observação:

- `RASCUNHO` retorna `403`

### Valores aceitos em `sortBy`

- `titulo`
- `inseridaEm`
- `inscricoesAte`
- `numeroVagas`
- `empresaNome`

### Valores aceitos em `sortDir`

- `asc`
- `desc`

### Resposta

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-vaga",
      "titulo": "Desenvolvedor Full Stack Pleno",
      "codigo": "V51386",
      "status": "PUBLICADO",
      "statusLabel": "Publicado",
      "empresaUsuarioId": "uuid-empresa",
      "empresa": {
        "id": "uuid-empresa",
        "nome": "Tech Innovations LTDA",
        "nomeExibicao": "Tech Innovations LTDA",
        "codUsuario": "TESTB3244088F5DD435FAE3F",
        "cnpj": "51515527000181",
        "avatarUrl": null
      },
      "localizacao": {
        "cidade": "Maceió",
        "estado": "AL",
        "modalidadeLabel": "Remoto",
        "label": "Maceió, AL"
      },
      "numeroVagas": 1,
      "inscricoesAte": "2026-04-18T23:59:59.000Z",
      "inseridaEm": "2026-04-02T10:00:00.000Z",
      "atualizadoEm": "2026-04-02T10:30:00.000Z",
      "escopo": {
        "tipoAcesso": "VAGA",
        "empresaVinculadaDiretamente": false
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1
  },
  "filtrosDisponiveis": {
    "status": [{ "value": "PUBLICADO", "label": "Publicado", "count": 1 }],
    "empresas": [
      {
        "id": "uuid-empresa",
        "label": "Tech Innovations LTDA",
        "count": 1
      }
    ],
    "localizacoes": [
      {
        "value": "Maceió, AL",
        "label": "Maceió, AL",
        "count": 1
      }
    ]
  }
}
```

### Semântica

- `search`
  - pesquisa por título da vaga ou código
- `localizacao`
  - filtra pela chave textual já escopada em `localizacao.label`
- `empresa`
  - dados suficientes para renderizar a coluna `Empresa` no mesmo padrão visual do admin
- `localizacao.modalidadeLabel`
  - metadado da modalidade (`Remoto`, `Presencial` ou `Híbrido`)
- `localizacao.label`
  - valor canônico do filtro e da coluna de localização
- `escopo.tipoAcesso`
  - `EMPRESA` quando a vaga está visível por vínculo amplo com a empresa
  - `VAGA` quando a vaga está visível apenas por vínculo direto na vaga

### Regras

- sem filtro de empresa:
  - devolve todas as vagas do escopo do recrutador
- com `empresaUsuarioId`:
  - devolve apenas vagas daquela empresa dentro do escopo do recrutador
- `filtrosDisponiveis.status`
  - considera apenas vagas visíveis no escopo atual e no conjunto filtrado
- `filtrosDisponiveis.empresas`
  - não soma vagas fora do vínculo do recrutador
- `filtrosDisponiveis.localizacoes`
  - não inclui cidades derivadas de vagas fora do escopo
- se o recrutador tiver acesso apenas a uma vaga de uma empresa:
  - nenhuma outra vaga da mesma empresa entra na listagem
  - nenhuma outra localização da mesma empresa entra nos filtros

---

## 4. Detalhe da vaga

### Rota

`GET /api/v1/recrutador/vagas/:vagaId`

### Resposta

```json
{
  "success": true,
  "data": {
    "id": "uuid-vaga",
    "titulo": "Desenvolvedor Full Stack Pleno",
    "codigo": "V51386",
    "status": "PUBLICADO",
    "empresa": {
      "id": "uuid-empresa",
      "nome": "Tech Innovations LTDA"
    }
  }
}
```

### Regra

- só abre quando a vaga estiver no escopo do recrutador

---

## Tratamento de erros

### Empresas

- `403 FORBIDDEN`
- `404 EMPRESA_NOT_FOUND`
- `500 RECRUITER_SCOPE_ERROR`

Exemplo fora do escopo:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso a esta empresa."
}
```

### Vagas

- `403 FORBIDDEN`
- `404 VAGA_NOT_FOUND`
- `500 RECRUITER_SCOPE_ERROR`

Exemplo fora do escopo:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Você não possui acesso a esta vaga."
}
```

---

## Fluxo recomendado no frontend

1. detectar `role = RECRUTADOR`
2. manter as páginas:
   - `/dashboard/empresas`
   - `/dashboard/empresas/:id`
   - `/dashboard/empresas/vagas`
   - `/dashboard/empresas/vagas/:id`
3. trocar apenas o consumo da API para:
   - `/api/v1/recrutador/empresas`
   - `/api/v1/recrutador/empresas/:empresaUsuarioId`
   - `/api/v1/recrutador/vagas`
   - `/api/v1/recrutador/vagas/:vagaId`

---

## Checklist frontend

- [ ] detectar `RECRUTADOR` no usuário logado
- [ ] usar `/api/v1/recrutador/empresas` na listagem de empresas
- [ ] usar `/api/v1/recrutador/empresas/:empresaUsuarioId` no detalhe da empresa
- [ ] usar `/api/v1/recrutador/vagas` na listagem de vagas
- [ ] usar `/api/v1/recrutador/vagas/:vagaId` no detalhe da vaga
- [ ] usar `filtrosDisponiveis.status`, `filtrosDisponiveis.empresas` e `filtrosDisponiveis.localizacoes` como fonte oficial dos filtros
- [ ] permitir busca por `search` com título ou código da vaga
- [ ] renderizar `localizacao.label`, `inseridaEm`, `inscricoesAte` e `numeroVagas` na grade do recrutador
- [ ] tratar `403 FORBIDDEN`
- [ ] tratar `404 EMPRESA_NOT_FOUND`
- [ ] tratar `404 VAGA_NOT_FOUND`
- [ ] não esperar vagas em `RASCUNHO` no escopo do recrutador
