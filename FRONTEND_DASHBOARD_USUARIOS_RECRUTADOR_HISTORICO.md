# Frontend — Histórico de Vínculos do Recrutador

## Objetivo

Documentar como a aba:

- `Histórico`

na tela:

- `/dashboard/usuarios/:userId`

passa a refletir operações da aba:

- `Vínculos`

quando o usuário alvo tiver:

- `role = RECRUTADOR`

---

## Rotas impactadas

### Histórico existente

`GET /api/v1/usuarios/usuarios/:userId/historico`

### Operações que agora geram histórico

- `POST /api/v1/usuarios/usuarios/:userId/vinculos-recrutador`
- `DELETE /api/v1/usuarios/usuarios/:userId/vinculos-recrutador/:vinculoId`

---

## Regra funcional

Sempre que um vínculo de recrutador for:

- criado por empresa
- criado por vaga
- removido por empresa
- removido por vaga

um evento correspondente passa a aparecer em:

- `GET /api/v1/usuarios/usuarios/:userId/historico`

Isso inclui também remoções automáticas de vínculos por vaga quando um vínculo por empresa da mesma empresa é criado.

---

## Tipos novos no histórico

- `USUARIO_RECRUTADOR_VINCULO_EMPRESA_CRIADO`
- `USUARIO_RECRUTADOR_VINCULO_EMPRESA_REMOVIDO`
- `USUARIO_RECRUTADOR_VINCULO_VAGA_CRIADO`
- `USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO`

### Categoria

- `ADMINISTRATIVO`

---

## 1. Vínculo por empresa criado

### Exemplo

```json
{
  "id": "uuid-log",
  "tipo": "USUARIO_RECRUTADOR_VINCULO_EMPRESA_CRIADO",
  "categoria": "ADMINISTRATIVO",
  "titulo": "Vínculo por empresa adicionado",
  "descricao": "O recrutador recebeu acesso operacional à empresa Consultoria RH Plus.",
  "dataHora": "2026-04-01T16:10:00.000Z",
  "ator": {
    "id": "uuid-admin",
    "nome": "Maria Souza",
    "role": "ADMIN",
    "roleLabel": "Administrador",
    "avatarUrl": null
  },
  "alvo": {
    "id": "uuid-recrutador",
    "nomeCompleto": "Ana Setor de Vagas",
    "email": "ana@empresa.com",
    "role": "RECRUTADOR",
    "status": "ATIVO"
  },
  "dadosAnteriores": null,
  "dadosNovos": {
    "tipoVinculo": "EMPRESA",
    "empresaId": "uuid-empresa",
    "empresaNome": "Consultoria RH Plus",
    "empresaCodigo": "EMP-001"
  },
  "meta": {
    "tipoVinculo": "EMPRESA",
    "empresaId": "uuid-empresa",
    "empresaNome": "Consultoria RH Plus",
    "empresaCodigo": "EMP-001",
    "actorRole": "ADMIN",
    "origem": "PAINEL_ADMIN"
  }
}
```

---

## 2. Vínculo por vaga criado

### Exemplo

```json
{
  "id": "uuid-log",
  "tipo": "USUARIO_RECRUTADOR_VINCULO_VAGA_CRIADO",
  "categoria": "ADMINISTRATIVO",
  "titulo": "Vínculo por vaga adicionado",
  "descricao": "O recrutador recebeu acesso restrito à vaga Estagiário de Recursos Humanos.",
  "dataHora": "2026-04-01T16:15:00.000Z",
  "ator": {
    "id": "uuid-admin",
    "nome": "Maria Souza",
    "role": "MODERADOR",
    "roleLabel": "Moderador",
    "avatarUrl": null
  },
  "alvo": {
    "id": "uuid-recrutador",
    "nomeCompleto": "Ana Setor de Vagas",
    "email": "ana@empresa.com",
    "role": "RECRUTADOR",
    "status": "ATIVO"
  },
  "dadosAnteriores": null,
  "dadosNovos": {
    "tipoVinculo": "VAGA",
    "empresaId": "uuid-empresa",
    "empresaNome": "Consultoria RH Plus",
    "empresaCodigo": "EMP-001",
    "vagaId": "uuid-vaga",
    "vagaTitulo": "Estagiário de Recursos Humanos",
    "vagaCodigo": "V51760"
  },
  "meta": {
    "tipoVinculo": "VAGA",
    "empresaId": "uuid-empresa",
    "empresaNome": "Consultoria RH Plus",
    "empresaCodigo": "EMP-001",
    "vagaId": "uuid-vaga",
    "vagaTitulo": "Estagiário de Recursos Humanos",
    "vagaCodigo": "V51760",
    "actorRole": "MODERADOR",
    "origem": "PAINEL_ADMIN"
  }
}
```

---

## 3. Vínculo por vaga removido

### Exemplo

```json
{
  "id": "uuid-log",
  "tipo": "USUARIO_RECRUTADOR_VINCULO_VAGA_REMOVIDO",
  "categoria": "ADMINISTRATIVO",
  "titulo": "Vínculo por vaga removido",
  "descricao": "O recrutador perdeu o acesso restrito à vaga Estagiário de Recursos Humanos.",
  "dataHora": "2026-04-01T16:20:00.000Z",
  "ator": {
    "id": "uuid-admin",
    "nome": "Maria Souza",
    "role": "ADMIN",
    "roleLabel": "Administrador",
    "avatarUrl": null
  },
  "alvo": {
    "id": "uuid-recrutador",
    "nomeCompleto": "Ana Setor de Vagas",
    "email": "ana@empresa.com",
    "role": "RECRUTADOR",
    "status": "ATIVO"
  },
  "dadosAnteriores": {
    "tipoVinculo": "VAGA",
    "empresaId": "uuid-empresa",
    "empresaNome": "Consultoria RH Plus",
    "empresaCodigo": "EMP-001",
    "vagaId": "uuid-vaga",
    "vagaTitulo": "Estagiário de Recursos Humanos",
    "vagaCodigo": "V51760"
  },
  "dadosNovos": null,
  "meta": {
    "tipoVinculo": "VAGA",
    "empresaId": "uuid-empresa",
    "empresaNome": "Consultoria RH Plus",
    "empresaCodigo": "EMP-001",
    "vagaId": "uuid-vaga",
    "vagaTitulo": "Estagiário de Recursos Humanos",
    "vagaCodigo": "V51760",
    "actorRole": "ADMIN",
    "origem": "PAINEL_ADMIN"
  }
}
```

---

## 4. Vínculo por empresa removido

### Exemplo

```json
{
  "id": "uuid-log",
  "tipo": "USUARIO_RECRUTADOR_VINCULO_EMPRESA_REMOVIDO",
  "categoria": "ADMINISTRATIVO",
  "titulo": "Vínculo por empresa removido",
  "descricao": "O recrutador perdeu o acesso operacional à empresa Consultoria RH Plus.",
  "dadosAnteriores": {
    "tipoVinculo": "EMPRESA",
    "empresaId": "uuid-empresa",
    "empresaNome": "Consultoria RH Plus",
    "empresaCodigo": "EMP-001"
  },
  "dadosNovos": null,
  "meta": {
    "tipoVinculo": "EMPRESA",
    "empresaId": "uuid-empresa",
    "empresaNome": "Consultoria RH Plus",
    "empresaCodigo": "EMP-001",
    "actorRole": "ADMIN",
    "origem": "PAINEL_ADMIN"
  }
}
```

---

## Semântica

### Criação

- `dadosAnteriores = null`
- `dadosNovos` descreve o vínculo criado

### Remoção

- `dadosAnteriores` descreve o vínculo removido
- `dadosNovos = null`

### `meta`

`meta` repete os principais identificadores para facilitar UI, filtros e inspeção rápida:

- `tipoVinculo`
- `empresaId`
- `empresaNome`
- `empresaCodigo`
- `vagaId`
- `vagaTitulo`
- `vagaCodigo`
- `actorRole`
- `origem`

---

## Caso especial: remoções automáticas

Quando um vínculo por empresa é criado e já existem vínculos por vaga redundantes daquela mesma empresa, a timeline deve mostrar:

1. o evento de criação do vínculo por empresa
2. um evento para cada vínculo por vaga removido automaticamente

Isso evita lacuna de rastreabilidade.

---

## Impacto no frontend

O frontend já pode continuar consumindo apenas:

- `GET /api/v1/usuarios/usuarios/:userId/historico`

A diferença é que agora a timeline também pode renderizar mudanças de escopo operacional do recrutador.

---

## Checklist frontend

- [ ] Reaproveitar a aba `Histórico` já existente
- [ ] Reconhecer os tipos `USUARIO_RECRUTADOR_VINCULO_*`
- [ ] Exibir `empresaNome` e `empresaCodigo` quando existirem em `meta` ou `dadosNovos`/`dadosAnteriores`
- [ ] Exibir `vagaTitulo` e `vagaCodigo` quando o tipo for vínculo por vaga
- [ ] Tratar remoções automáticas da mesma forma que remoções manuais
- [ ] Manter o restante do contrato do histórico inalterado
