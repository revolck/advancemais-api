# Frontend - Recursos Premium de Vagas para Empresa

## Contexto

Na tela `/dashboard/empresas/:empresaId`, usuarios `ADMIN` e `MODERADOR` podem aplicar ou remover um entitlement administrativo chamado `Recursos Premium`.

Esse recurso nao altera plano, assinatura, cobranca ou status comercial da empresa. Ele libera somente:

- vagas ilimitadas;
- destaques de vagas ilimitados;
- criacao de vaga sem depender de plano comercial ativo.

## Estado retornado pela API

O objeto `recursosPremiumVagas` e retornado no detalhe e na listagem de empresas.

### Ativo

```json
{
  "recursosPremiumVagas": {
    "ativo": true,
    "vagasIlimitadas": true,
    "destaquesIlimitados": true,
    "aplicadoEm": "2026-05-07T12:00:00.000Z",
    "aplicadoPor": {
      "id": "uuid-usuario",
      "nome": "Administrador",
      "role": "ADMIN"
    },
    "motivo": "Empresa propria da Advance"
  }
}
```

### Inativo

```json
{
  "recursosPremiumVagas": {
    "ativo": false,
    "vagasIlimitadas": false,
    "destaquesIlimitados": false,
    "aplicadoEm": null,
    "aplicadoPor": null,
    "motivo": null
  }
}
```

## Detalhe da empresa

```http
GET /api/v1/empresas/:empresaId
```

Usar `empresa.recursosPremiumVagas.ativo` para decidir qual acao exibir:

- `false`: mostrar `Aplicar recursos premium`;
- `true`: mostrar `Remover recursos premium`.

## Listagem de empresas

```http
GET /api/v1/empresas?page=1&pageSize=10&search=<texto>
```

Cada item em `data` tambem retorna `recursosPremiumVagas`.

## Empresas elegiveis para cadastro de vaga

```http
GET /api/v1/empresas?page=1&pageSize=10&search=<texto>&elegivelCadastroVaga=true
```

Quando o usuario autenticado for `ADMIN` ou `MODERADOR`, a API retorna empresas elegiveis por:

- plano normal ativo elegivel; ou
- `recursosPremiumVagas.ativo=true`.

Para os demais perfis, a API mantem o comportamento atual e nao usa premium como expansao de escopo.

Importante: o filtro e aplicado antes da paginacao.

## Aplicar recursos premium

```http
POST /api/v1/empresas/:empresaId/recursos-premium-vagas
```

### Permissao

Somente:

- `ADMIN`;
- `MODERADOR`.

Outros perfis recebem `403 Forbidden`.

### Payload

```json
{
  "motivo": "Empresa propria da Advance"
}
```

### Resposta 200

```json
{
  "success": true,
  "message": "Recursos premium aplicados com sucesso.",
  "empresa": {
    "id": "uuid-empresa",
    "recursosPremiumVagas": {
      "ativo": true,
      "vagasIlimitadas": true,
      "destaquesIlimitados": true,
      "aplicadoEm": "2026-05-07T12:00:00.000Z",
      "aplicadoPor": {
        "id": "uuid-usuario",
        "nome": "Administrador",
        "role": "ADMIN"
      },
      "motivo": "Empresa propria da Advance"
    }
  }
}
```

### Comportamento

- Idempotente: se ja estiver ativo, retorna `200` com o estado atual.
- Nao cria, edita, suspende ou cancela plano.
- Registra auditoria administrativa.

## Remover recursos premium

```http
DELETE /api/v1/empresas/:empresaId/recursos-premium-vagas
```

### Permissao

Somente:

- `ADMIN`;
- `MODERADOR`.

Outros perfis recebem `403 Forbidden`.

### Payload

```json
{
  "motivo": "Remocao administrativa",
  "novoStatusVagasPublicadas": "RASCUNHO"
}
```

`novoStatusVagasPublicadas` aceita:

- `RASCUNHO`;
- `ENCERRADA`.

Default: `RASCUNHO`.

### Resposta 200

```json
{
  "success": true,
  "message": "Recursos premium removidos com sucesso.",
  "empresa": {
    "id": "uuid-empresa",
    "recursosPremiumVagas": {
      "ativo": false,
      "vagasIlimitadas": false,
      "destaquesIlimitados": false,
      "aplicadoEm": null,
      "aplicadoPor": null,
      "motivo": null
    }
  },
  "efeitos": {
    "vagasPublicadasAlteradas": 12,
    "novoStatusVagasPublicadas": "RASCUNHO",
    "destaquesRemovidos": 8
  }
}
```

### Comportamento

- Idempotente: se ja estiver inativo, retorna `200` com efeitos zerados.
- Altera vagas `PUBLICADO` para `novoStatusVagasPublicadas`.
- Remove os destaques ativos da empresa.
- Registra auditoria administrativa com motivo e efeitos.

### Politica de destaques

Ao remover recursos premium, a API remove todos os destaques ativos da empresa e exige nova selecao manual conforme o plano normal.

Isso evita manter destaques sem origem clara apos remover uma permissao administrativa ilimitada.

## Criacao de vaga

```http
POST /api/v1/empresas/vagas
```

Quando `recursosPremiumVagas.ativo=true`:

- a empresa pode criar vaga sem plano ativo;
- a empresa pode criar vaga com `vagaEmDestaque=true`;
- a vaga e criada diretamente com status `PUBLICADO`;
- nao consome limite comercial do plano;
- destaque premium nao retorna `destaqueInfo` de plano.

Quando `recursosPremiumVagas.ativo=false`, permanecem as regras atuais de plano, avaliacao e empresa parceira.

### Slug da vaga

O campo `slug` no payload de criacao e opcional.

A API e dona do slug final:

- usa `payload.slug` quando enviado;
- se `payload.slug` nao for enviado, gera a partir de `titulo`;
- normaliza o valor no backend;
- se houver colisao, cria um slug unico com sufixo incremental.

Exemplo:

```txt
filipeteste
filipeteste-2
filipeteste-3
```

A resposta da vaga sempre retorna o `slug` final persistido.

## Status HTTP

- `200 OK`: aplicacao/remocao com sucesso ou operacao idempotente.
- `403 Forbidden`: perfil sem permissao.
- `404 Not Found`: empresa inexistente.
- `422 Unprocessable Entity`: payload invalido.

## Exemplo de uso no frontend

```ts
const recursos = empresa.recursosPremiumVagas;

const acaoPremium = recursos.ativo ? 'Remover recursos premium' : 'Aplicar recursos premium';
```

```ts
await api.post(`/api/v1/empresas/${empresaId}/recursos-premium-vagas`, {
  motivo: 'Empresa propria da Advance',
});
```

```ts
await api.delete(`/api/v1/empresas/${empresaId}/recursos-premium-vagas`, {
  data: {
    motivo: 'Remocao administrativa',
    novoStatusVagasPublicadas: 'RASCUNHO',
  },
});
```
