# Frontend — Edição de Turmas

## Objetivo

Documentar o contrato do backend para a tela de edição de turma:

- `/dashboard/cursos/:cursoId/turmas/:turmaId/editar`

Foco deste arquivo:

- quem pode editar
- quais campos podem ser enviados
- quais campos são bloqueados
- comportamento quando a turma já iniciou
- erros que o frontend deve tratar

---

## Endpoint principal

`PUT /api/v1/cursos/:cursoId/turmas/:turmaId`

Se `cursoId` ou `turmaId` forem inválidos:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Identificadores de curso ou turma inválidos"
}
```

---

## Quem pode editar

### Pode editar

- `ADMIN`
- `MODERADOR`
- `PEDAGOGICO`

### Não pode editar

- `INSTRUTOR`
- demais perfis fora da gestão

Erro esperado quando não tem permissão:

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "Sem permissão para editar a turma"
}
```

Status HTTP:

- `403`

---

## Regra especial para turma já iniciada

Quando a turma já iniciou:

- somente `PEDAGOGICO` pode editar
- `ADMIN` e `MODERADOR` passam a receber bloqueio
- o período de inscrições e o período da turma ficam bloqueados para qualquer perfil

Erro esperado:

```json
{
  "success": false,
  "code": "TURMA_EDICAO_BLOQUEADA_JA_INICIADA",
  "message": "Somente o setor pedagógico pode alterar uma turma após o início"
}
```

Status HTTP:

- `409`

### Campos de período bloqueados após início

Quando a turma já iniciou, não pode mais alterar:

- `dataInicio`
- `dataFim`
- `dataInscricaoInicio`
- `dataInscricaoFim`

Erro esperado:

```json
{
  "success": false,
  "code": "TURMA_PERIODO_BLOQUEADO_APOS_INICIO",
  "message": "Não é possível alterar o período de inscrição ou o período da turma após o início.",
  "details": {
    "fields": ["dataFim"]
  }
}
```

Status HTTP:

- `409`

---

## Campos aceitos no `PUT`

O backend aceita atualização parcial. Não é necessário reenviar tudo.

Campos aceitos:

```json
{
  "nome": "Turma 2026.1",
  "instrutorId": "uuid",
  "instrutorIds": ["uuid-1", "uuid-2"],
  "turno": "MANHA",
  "dataInicio": "2026-04-01T08:00:00.000Z",
  "dataFim": "2026-06-30T18:00:00.000Z",
  "dataInscricaoInicio": "2026-03-01T00:00:00.000Z",
  "dataInscricaoFim": "2026-03-31T23:59:59.999Z",
  "vagasIlimitadas": false,
  "vagasTotais": 40,
  "vagasDisponiveis": 18,
  "status": "RASCUNHO"
}
```

### Observações

- o payload pode ser parcial
- enviar body vazio retorna erro
- `status` manual aceito apenas com:
  - `RASCUNHO`
  - `PUBLICADO`

---

## Campos que não podem ser editados

O frontend não deve enviar:

- `metodo`
- `estruturaTipo`

Se enviar, o backend bloqueia.

Exemplo:

```json
{
  "success": false,
  "code": "CAMPO_NAO_EDITAVEL",
  "message": "A modalidade (método) não pode ser alterada após a criação da turma",
  "field": "metodo"
}
```

ou

```json
{
  "success": false,
  "code": "CAMPO_NAO_EDITAVEL",
  "message": "A estrutura do curso não pode ser alterada após a criação da turma",
  "field": "estruturaTipo"
}
```

Status HTTP:

- `400`

---

## Regras de validação

### 1) Payload vazio

Se nada for enviado:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Informe ao menos um campo para atualização da turma"
}
```

### 2) Datas

Regras aplicadas:

- `dataFim` deve ser posterior a `dataInicio`
- `dataInscricaoFim` deve ser posterior a `dataInscricaoInicio`
- `dataInicio` não pode ser anterior a `dataInscricaoFim`

Erro:

- `400 VALIDATION_ERROR`

### 3) Vagas

Regra:

- `vagasTotais` não pode ficar menor que o total de inscrições ativas

Erro esperado:

```json
{
  "success": false,
  "code": "INVALID_VAGAS_TOTAIS",
  "message": "Vagas totais não podem ser menores que inscrições ativas"
}
```

Status HTTP:

- `400`

### 4) Status manual após início/fim

Se a turma já iniciou ou finalizou:

- não pode alterar `status` manualmente pelo `PUT`

Erro esperado:

```json
{
  "success": false,
  "code": "STATUS_NAO_EDITAVEL_APOS_INICIO",
  "message": "Não é possível alterar o status manualmente de uma turma que já iniciou ou finalizou",
  "details": {
    "turmaIniciou": true,
    "turmaFinalizou": false,
    "dataInicio": "2026-03-10T08:00:00.000Z",
    "dataFim": "2026-06-10T18:00:00.000Z"
  }
}
```

Status HTTP:

- `400`

### 5) Pré-requisitos ao publicar pelo `PUT`

Se o frontend tentar publicar pela própria edição usando:

```json
{ "status": "PUBLICADO" }
```

O backend exige:

- pelo menos `1` aula cadastrada
- pelo menos `1` avaliação cadastrada

Erro esperado:

```json
{
  "success": false,
  "code": "TURMA_PREREQUISITOS_NAO_ATENDIDOS",
  "message": "Para publicar/abrir inscrições de uma turma é necessário ter pelo menos 1 aula e 1 avaliação cadastradas.",
  "details": {
    "aulasCount": 0,
    "avaliacoesCount": 0
  }
}
```

Status HTTP:

- `422`

---

## Resposta de sucesso

Quando a atualização funciona, a API retorna o detalhe atualizado da turma.

O frontend deve tratar a resposta como a nova fonte da verdade da tela.

Exemplo simplificado:

```json
{
  "id": "uuid",
  "nome": "Turma 2026.1",
  "status": "PUBLICADO",
  "turno": "MANHA",
  "dataInicio": "2026-04-01T08:00:00.000Z",
  "dataFim": "2026-06-30T18:00:00.000Z",
  "vagasTotais": 40,
  "vagasDisponiveis": 18
}
```

---

## Notificação automática em turma iniciada

Quando:

- o usuário é `PEDAGOGICO`
- a turma já iniciou
- existem alunos inscritos ativos
- houve alteração real no payload

O backend pode disparar notificação automática para os alunos.

Exemplo de intenção do backend:

- informar que a coordenação pedagógica atualizou dados da turma
- pedir revisão de cronograma e próximos conteúdos

O frontend não precisa construir essa notificação.
O frontend só precisa considerar a edição como concluída com sucesso.

---

## Regras práticas para a tela de edição

### Para `ADMIN` e `MODERADOR`

- podem editar turma antes do início
- se a turma já iniciou, bloquear UI ou tratar `409`

### Para `PEDAGOGICO`

- pode editar antes e depois do início
- pode ajustar nome, vagas, instrutores e demais campos editáveis
- não pode alterar período de inscrições nem período da turma após o início

### Para `INSTRUTOR`

- não exibir tela de edição da turma como ação disponível
- se tentar acessar mesmo assim, tratar `403`

---

## Recomendações de UI

### 1) Campos read-only

Deixar como somente leitura ou ocultar:

- `metodo`
- `estruturaTipo`

### 2) Publicação via tela de edição

Se a UI usar `status = PUBLICADO` dentro do `PUT`, tratar `422 TURMA_PREREQUISITOS_NAO_ATENDIDOS`.

Se a UI usa ação separada de publicar/despublicar, preferir a rota dedicada:

`PATCH /api/v1/cursos/:cursoId/turmas/:turmaId/publicar`

### 3) Turma iniciada

Se usuário for `ADMIN` ou `MODERADOR` e a turma já iniciou:

- desabilitar salvar, ou
- permitir tentativa e tratar `409`

Se usuário for `PEDAGOGICO`:

- manter edição habilitada para os demais campos permitidos
- deixar os campos de período como somente leitura

### 4) Pós-save

Após sucesso:

- atualizar formulário com retorno da API
- atualizar badge/status local
- não manter estado antigo em cache local

---

## Erros esperados na edição

- `400 VALIDATION_ERROR`
- `400 CAMPO_NAO_EDITAVEL`
- `400 INVALID_VAGAS_TOTAIS`
- `400 STATUS_NAO_EDITAVEL_APOS_INICIO`
- `403 FORBIDDEN`
- `404 TURMA_NOT_FOUND`
- `409 TURMA_EDICAO_BLOQUEADA_JA_INICIADA`
- `409 TURMA_PERIODO_BLOQUEADO_APOS_INICIO`
- `422 TURMA_PREREQUISITOS_NAO_ATENDIDOS`

---

## Checklist frontend

- [ ] Carregar dados atuais da turma antes de editar
- [ ] Não enviar `metodo`
- [ ] Não enviar `estruturaTipo`
- [ ] Tratar body vazio antes do submit
- [ ] Validar datas na UI, mas sempre respeitar validação do backend
- [ ] Tratar `403` para usuário sem permissão
- [ ] Tratar `409 TURMA_EDICAO_BLOQUEADA_JA_INICIADA` para `ADMIN/MODERADOR`
- [ ] Bloquear edição dos campos de período quando a turma já iniciou
- [ ] Tratar `409 TURMA_PERIODO_BLOQUEADO_APOS_INICIO`
- [ ] Tratar `422 TURMA_PREREQUISITOS_NAO_ATENDIDOS` se publicação ocorrer via `PUT`
- [ ] Atualizar a tela com o retorno da API após salvar
