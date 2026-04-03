# Frontend — Vínculos de Recrutador no Detalhe de Usuário

## Objetivo

Documentar o contrato da aba:

- `Vínculos`

na tela:

- `/dashboard/usuarios/:userId`

Essa aba só existe quando o usuário visualizado tiver:

- `role = RECRUTADOR`

Perfis que podem gerenciar os vínculos:

- `ADMIN`
- `MODERADOR`

---

## Regra de exibição da aba

O frontend deve seguir exatamente esta regra:

1. carregar o detalhe já existente em `GET /api/v1/usuarios/usuarios/:userId`
2. ler `usuario.role`
3. se `usuario.role !== RECRUTADOR`
   - não exibir a aba `Vínculos`
4. se `usuario.role === RECRUTADOR`
   - exibir a aba `Vínculos`

Observação:

- o backend também valida isso nas novas rotas
- se o usuário alvo não for recrutador, a API retorna `409 USER_IS_NOT_RECRUITER`

---

## Rotas

### Listar vínculos atuais

`GET /api/v1/usuarios/usuarios/:userId/vinculos-recrutador`

### Listar empresas elegíveis

`GET /api/v1/usuarios/usuarios/:userId/vinculos-recrutador/opcoes/empresas`

### Listar vagas elegíveis por empresa

`GET /api/v1/usuarios/usuarios/:userId/vinculos-recrutador/opcoes/vagas?empresaUsuarioId=uuid`

### Criar vínculo

`POST /api/v1/usuarios/usuarios/:userId/vinculos-recrutador`

### Remover vínculo

`DELETE /api/v1/usuarios/usuarios/:userId/vinculos-recrutador/:vinculoId`

---

## Permissões

Perfis permitidos:

- `ADMIN`
- `MODERADOR`

Sem permissão:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Acesso negado."
}
```

Se o usuário alvo não existir:

```json
{
  "success": false,
  "code": "USER_NOT_FOUND",
  "message": "Usuário não encontrado."
}
```

Se o usuário alvo não for recrutador:

```json
{
  "success": false,
  "code": "USER_IS_NOT_RECRUITER",
  "message": "O usuário informado não possui a função de recrutador."
}
```

---

## Regra de negócio

### Vínculo por empresa

Se o recrutador estiver vinculado a uma empresa:

- ganha acesso amplo ao escopo operacional dessa empresa
- pode operar vagas elegíveis da empresa
- pode operar candidatos dessas vagas
- pode operar entrevistas dessas vagas

Na UI isso aparece com:

- `tipoVinculo = EMPRESA`
- `escopo.label = "Acesso completo à empresa"`

### Vínculo por vaga

Se o recrutador estiver vinculado apenas a uma vaga:

- o acesso fica restrito àquela vaga
- aos candidatos daquela vaga
- e às entrevistas daquela vaga

Na UI isso aparece com:

- `tipoVinculo = VAGA`
- `escopo.label = "Acesso restrito à vaga"`

### Regra de redundância

Se já existir vínculo por empresa, o backend não permite vínculo redundante por vaga da mesma empresa.

Erro:

```json
{
  "success": false,
  "code": "RECRUITER_LINK_REDUNDANT",
  "message": "O recrutador já possui acesso completo a esta empresa."
}
```

### Regra de duplicidade

Se o vínculo exato já existir, a API retorna:

```json
{
  "success": false,
  "code": "RECRUITER_LINK_ALREADY_EXISTS",
  "message": "O recrutador já possui vínculo com esta empresa."
}
```

ou:

```json
{
  "success": false,
  "code": "RECRUITER_LINK_ALREADY_EXISTS",
  "message": "O recrutador já possui vínculo com esta vaga."
}
```

---

## 1. Listagem atual

### Rota

`GET /api/v1/usuarios/usuarios/:userId/vinculos-recrutador`

### Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-vinculo",
        "tipoVinculo": "EMPRESA",
        "ativo": true,
        "criadoEm": "2026-04-01T14:00:00.000Z",
        "empresa": {
          "id": "uuid-empresa",
          "nomeExibicao": "Consultoria RH Plus",
          "codigo": "EMP-001",
          "cnpj": "12345678000199"
        },
        "vaga": null,
        "escopo": {
          "label": "Acesso completo à empresa",
          "permiteVagasPublicadas": true,
          "permiteVagasDespublicadas": true,
          "permiteCandidatos": true
        }
      },
      {
        "id": "uuid-vinculo-2",
        "tipoVinculo": "VAGA",
        "ativo": true,
        "criadoEm": "2026-04-01T14:05:00.000Z",
        "empresa": {
          "id": "uuid-empresa",
          "nomeExibicao": "Tech Innovations LTDA",
          "codigo": "EMP-009",
          "cnpj": "12345678000199"
        },
        "vaga": {
          "id": "uuid-vaga",
          "titulo": "Analista de Recrutamento",
          "codigo": "V51386",
          "status": "DESPUBLICADA"
        },
        "escopo": {
          "label": "Acesso restrito à vaga",
          "permiteVagasPublicadas": true,
          "permiteVagasDespublicadas": true,
          "permiteCandidatos": true
        }
      }
    ]
  }
}
```

### Semântica

- `empresa` sempre existe
- `empresa.cnpj`
  - pode ser `null`
  - usar como segunda linha da célula de empresa
- `vaga` só existe quando `tipoVinculo = VAGA`
- `ativo` hoje sempre vem `true`
- `criadoEm` pode ser usado para ordenação e label temporal na UI

Observação:

- se existir vínculo por empresa, a API já oculta da listagem vínculos de vaga redundantes da mesma empresa

---

## 2. Empresas elegíveis

### Rota

`GET /api/v1/usuarios/usuarios/:userId/vinculos-recrutador/opcoes/empresas`

### Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-empresa",
        "nomeExibicao": "Consultoria RH Plus",
        "codigo": "EMP-001",
        "cnpj": "12345678000199",
        "totalVagasOperaveis": 12,
        "jaVinculadoPorEmpresa": false
      }
    ]
  }
}
```

### Regras

- empresas sem vagas operáveis não entram na lista
- `jaVinculadoPorEmpresa = true`
  - o frontend pode desabilitar a ação
  - ou esconder a opção

---

## 3. Vagas elegíveis por empresa

### Rota

`GET /api/v1/usuarios/usuarios/:userId/vinculos-recrutador/opcoes/vagas?empresaUsuarioId=uuid`

### Resposta

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-vaga",
        "titulo": "Analista de Recrutamento",
        "codigo": "V51386",
        "status": "DESPUBLICADA",
        "statusLabel": "Despublicada",
        "empresaUsuarioId": "uuid-empresa",
        "jaVinculadoNestaVaga": false
      }
    ]
  }
}
```

### Regras

- a lista inclui vagas operáveis da empresa
- `RASCUNHO` não entra
- se já existir vínculo por empresa naquela empresa:
  - a API retorna `items: []`
- `jaVinculadoNestaVaga = true`
  - o frontend pode desabilitar ou esconder a opção

---

## 4. Criar vínculo

### Rota

`POST /api/v1/usuarios/usuarios/:userId/vinculos-recrutador`

### Body por empresa

```json
{
  "tipoVinculo": "EMPRESA",
  "empresaUsuarioId": "uuid-empresa"
}
```

### Body por vaga

```json
{
  "tipoVinculo": "VAGA",
  "empresaUsuarioId": "uuid-empresa",
  "vagaId": "uuid-vaga"
}
```

### Regras

- `tipoVinculo` obrigatório
- `EMPRESA`
  - exige `empresaUsuarioId`
  - não aceita `vagaId`
- `VAGA`
  - exige `empresaUsuarioId`
  - exige `vagaId`
- a vaga precisa pertencer à empresa enviada
- se o vínculo por empresa for criado, a API remove vínculos de vaga redundantes da mesma empresa

### Sucesso

```json
{
  "success": true,
  "code": "RECRUITER_LINK_CREATED",
  "message": "Vínculo do recrutador criado com sucesso.",
  "data": {
    "id": "uuid-vinculo",
    "tipoVinculo": "VAGA",
    "ativo": true,
    "empresa": {
      "id": "uuid-empresa",
      "nomeExibicao": "Tech Innovations LTDA",
      "codigo": "EMP-009",
      "cnpj": "12345678000199"
    },
    "vaga": {
      "id": "uuid-vaga",
      "titulo": "Analista de Recrutamento",
      "codigo": "V51386",
      "status": "DESPUBLICADA"
    },
    "criadoEm": "2026-04-01T14:10:00.000Z"
  }
}
```

### Efeito colateral

Após criação com sucesso, o backend também cria uma notificação para o recrutador alvo no sino do dashboard.

Referência:

- `FRONTEND_DASHBOARD_USUARIOS_RECRUTADOR_VINCULOS_NOTIFICACAO.md`

---

## 5. Remover vínculo

### Rota

`DELETE /api/v1/usuarios/usuarios/:userId/vinculos-recrutador/:vinculoId`

### Sucesso

```json
{
  "success": true,
  "code": "RECRUITER_LINK_REMOVED",
  "message": "Vínculo do recrutador removido com sucesso."
}
```

### Erro de vínculo inexistente

```json
{
  "success": false,
  "code": "RECRUITER_LINK_NOT_FOUND",
  "message": "Vínculo do recrutador não encontrado."
}
```

---

## Impacto no produto

Depois de criar ou remover vínculos, o escopo operacional do recrutador passa a refletir isso nas rotas já existentes.

Exemplos de áreas impactadas:

- `/dashboard/empresas`
- `/dashboard/empresas/vagas`
- `/dashboard/empresas/candidatos`
- `/dashboard/empresas/entrevistas`
- `/dashboard/agenda`

Semântica mínima:

- vínculo por empresa
  - acesso amplo ao escopo da empresa
- vínculo por vaga
  - acesso apenas à vaga específica e seus fluxos

---

## Fluxo recomendado no frontend

1. abrir `/dashboard/usuarios/:userId`
2. ler `usuario.role`
3. se for `RECRUTADOR`, renderizar a aba `Vínculos`
4. carregar `GET /api/v1/usuarios/usuarios/:userId/vinculos-recrutador`
5. ao criar por empresa:
   - carregar empresas elegíveis
   - selecionar empresa
   - confirmar
6. ao criar por vaga:
   - carregar empresas elegíveis
   - selecionar empresa
   - carregar vagas daquela empresa
   - selecionar vaga
   - confirmar
7. após sucesso:
   - invalidar o detalhe do usuário
   - invalidar a query da aba `Vínculos`

---

## Tratamento de erros esperado

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`
- `404 USER_NOT_FOUND`
- `404 EMPRESA_NOT_FOUND`
- `404 VAGA_NOT_FOUND`
- `404 RECRUITER_LINK_NOT_FOUND`
- `409 USER_IS_NOT_RECRUITER`
- `409 RECRUITER_LINK_ALREADY_EXISTS`
- `409 RECRUITER_LINK_REDUNDANT`
- `500 RECRUITER_LINK_ERROR`

---

## Checklist frontend

- [ ] Ler `usuario.role` no detalhe do usuário
- [ ] Exibir a aba `Vínculos` apenas para `RECRUTADOR`
- [ ] Consumir `GET /api/v1/usuarios/usuarios/:userId/vinculos-recrutador`
- [ ] Consumir `GET /api/v1/usuarios/usuarios/:userId/vinculos-recrutador/opcoes/empresas`
- [ ] Consumir `GET /api/v1/usuarios/usuarios/:userId/vinculos-recrutador/opcoes/vagas`
- [ ] Consumir `POST /api/v1/usuarios/usuarios/:userId/vinculos-recrutador`
- [ ] Consumir `DELETE /api/v1/usuarios/usuarios/:userId/vinculos-recrutador/:vinculoId`
- [ ] Renderizar `empresa.nomeExibicao`, `empresa.codigo` e `empresa.cnpj` na coluna Empresa
- [ ] Desabilitar criação quando `jaVinculadoPorEmpresa = true`
- [ ] Desabilitar criação quando `jaVinculadoNestaVaga = true`
- [ ] Invalidar detalhe + aba após criar/remover vínculo
- [ ] Tratar `409 USER_IS_NOT_RECRUITER`
- [ ] Tratar `409 RECRUITER_LINK_ALREADY_EXISTS`
- [ ] Tratar `409 RECRUITER_LINK_REDUNDANT`
